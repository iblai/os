//! opencode ACP transport for "Coding Mode".
//!
//! Spawns `opencode acp` as a long-lived subprocess per chat session and speaks
//! the Agent Client Protocol (newline-delimited JSON-RPC over stdio). opencode is
//! configured (via `~/.config/iblai/agents/opencode/opencode.json` +
//! `XDG_CONFIG_HOME`) to use ibl.ai's OpenAI-compatible API as its model provider.
//!
//! Agent `session/update` notifications are translated into the SAME Tauri events
//! the chat UI already renders for local models — `ollama:token` / `ollama:done` /
//! `ollama:error` (keyed by `generation_id`) — plus `opencode:reasoning` and
//! `opencode:tool_call` for thinking and tool activity.
//!
//! This is hand-rolled (serde_json + tokio) rather than using the
//! `agent-client-protocol` crate: the ACP surface we need is small and we want
//! precise control over per-delta emit throttling, cancellation, and process reuse
//! — mirroring the existing `ollama_chat_stream` NDJSON loop.

#![cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::atomic::{AtomicI64, Ordering};
use std::sync::{Arc, OnceLock};
use std::time::{Duration, Instant};

use serde_json::{json, Value};
use tauri::{command, AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, ChildStdin, Command};
use tokio::sync::{oneshot, Mutex};

/// Default ibl.ai ASGI streaming host — the OpenAI-compatible chat/completions
/// stream is served HERE, not the `api.iblai.app/dm` gateway (which 500s on chat).
/// Full model endpoint: `{API_BASE}/api/ai-mentor/orgs/<tenant>/v1`.
const DEFAULT_API_BASE: &str = "https://asgi.data.iblai.app";

/// Coalesce assistant-token emits to at most one per this window, to avoid the
/// webview re-render storm documented in CLAUDE.local.md. `ollama:done` always
/// carries the final `full_content`, so throttling never drops the final text.
const TOKEN_EMIT_WINDOW: Duration = Duration::from_millis(40);

/// Respawn the process with a fresh token when the spawn token is within this many
/// seconds of expiry (proactive refresh — the frontend passes a fresh dm_token on
/// every send).
const TOKEN_REFRESH_SLACK_SECS: i64 = 120;

type Registry = Mutex<HashMap<String, Arc<Session>>>;

fn registry() -> &'static Registry {
    static REG: OnceLock<Registry> = OnceLock::new();
    REG.get_or_init(|| Mutex::new(HashMap::new()))
}

/// Per-turn streaming accumulator, shared between the reader task and the command.
struct TurnState {
    generation_id: String,
    full_content: String,
    pending_delta: String,
    last_emit: Instant,
}

impl TurnState {
    fn reset(&mut self, generation_id: String) {
        self.generation_id = generation_id;
        self.full_content.clear();
        self.pending_delta.clear();
        self.last_emit = Instant::now();
    }
}

/// A live `opencode acp` process + its ACP session.
struct Session {
    child: Mutex<Child>,
    stdin: Arc<Mutex<ChildStdin>>,
    next_id: AtomicI64,
    pending: Arc<Mutex<HashMap<i64, oneshot::Sender<Value>>>>,
    acp_session_id: String,
    spawn_token_exp: Option<i64>,
    turn: Arc<Mutex<TurnState>>,
}

impl Session {
    fn new_id(&self) -> i64 {
        self.next_id.fetch_add(1, Ordering::SeqCst)
    }

    /// Send a JSON-RPC request and await its response result.
    async fn request(&self, method: &str, params: Value) -> Result<Value, String> {
        let id = self.new_id();
        let (tx, rx) = oneshot::channel();
        self.pending.lock().await.insert(id, tx);
        let msg = json!({ "jsonrpc": "2.0", "id": id, "method": method, "params": params });
        write_line(&self.stdin, &msg).await?;
        let resp = rx
            .await
            .map_err(|_| format!("opencode closed before responding to {method}"))?;
        if let Some(err) = resp.get("error") {
            return Err(format!("opencode error on {method}: {err}"));
        }
        Ok(resp.get("result").cloned().unwrap_or(Value::Null))
    }

    /// Send a JSON-RPC notification (no response expected).
    async fn notify(&self, method: &str, params: Value) -> Result<(), String> {
        let msg = json!({ "jsonrpc": "2.0", "method": method, "params": params });
        write_line(&self.stdin, &msg).await
    }
}

/// Write one JSON value as a single ndJSON line to the child's stdin.
async fn write_line(stdin: &Arc<Mutex<ChildStdin>>, msg: &Value) -> Result<(), String> {
    let mut line = serde_json::to_string(msg).map_err(|e| e.to_string())?;
    line.push('\n');
    let mut guard = stdin.lock().await;
    guard
        .write_all(line.as_bytes())
        .await
        .map_err(|e| format!("failed writing to opencode: {e}"))?;
    guard.flush().await.map_err(|e| e.to_string())
}

/// Build a tokio Command with a hidden console window on Windows.
fn create_command(program: &str) -> Command {
    let cmd = Command::new(program);
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        let mut cmd = cmd;
        cmd.creation_flags(CREATE_NO_WINDOW);
        return cmd;
    }
    #[allow(unreachable_code)]
    cmd
}

/// Home directory (HOME on unix, USERPROFILE on Windows).
fn home_dir() -> Option<PathBuf> {
    std::env::var_os("HOME")
        .or_else(|| std::env::var_os("USERPROFILE"))
        .map(PathBuf::from)
}

/// opencode config home so it reads `~/.config/iblai/agents/opencode/opencode.json`.
fn config_home() -> PathBuf {
    home_dir()
        .unwrap_or_default()
        .join(".config")
        .join("iblai")
        .join("agents")
}

/// Base data dir for ibl.ai desktop artifacts: `~/.local/share/iblai`
/// (respects `XDG_DATA_HOME`). Holds the managed opencode binary + workspaces.
pub fn iblai_data_dir() -> PathBuf {
    if let Some(xdg) = std::env::var_os("XDG_DATA_HOME") {
        return PathBuf::from(xdg).join("iblai");
    }
    home_dir().unwrap_or_default().join(".local/share/iblai")
}

/// Managed opencode binary: `~/.local/share/iblai/bin/opencode[.exe]`.
pub fn opencode_bin() -> PathBuf {
    let name = if cfg!(target_os = "windows") {
        "opencode.exe"
    } else {
        "opencode"
    };
    iblai_data_dir().join("bin").join(name)
}

/// The opencode program to spawn: the managed binary if present, else PATH.
pub fn opencode_program() -> String {
    let bin = opencode_bin();
    if bin.exists() {
        bin.to_string_lossy().to_string()
    } else {
        "opencode".to_string()
    }
}

/// Default coding workspace: `~/.local/share/iblai/workspaces/main`.
/// (Overridable via `set_opencode_workspace`; see workspace management.)
pub fn default_workspace() -> PathBuf {
    iblai_data_dir().join("workspaces/main")
}

/// File persisting the user's chosen workspace path.
fn workspace_state_file() -> PathBuf {
    home_dir()
        .unwrap_or_default()
        .join(".local/share/iblai/workspace.txt")
}

/// The active workspace: the persisted user choice, or the default.
pub fn resolve_workspace() -> PathBuf {
    if let Ok(s) = std::fs::read_to_string(workspace_state_file()) {
        let s = s.trim();
        if !s.is_empty() {
            return PathBuf::from(s);
        }
    }
    default_workspace()
}

/// Return the active coding workspace path.
#[command]
pub async fn get_opencode_workspace() -> Result<String, String> {
    Ok(resolve_workspace().to_string_lossy().to_string())
}

/// Set (and persist) the coding workspace. The frontend supplies the path from a
/// native folder picker (`@tauri-apps/plugin-dialog`).
#[command]
pub async fn set_opencode_workspace(path: String) -> Result<String, String> {
    let dir = PathBuf::from(&path);
    ensure_workspace(&dir)?;
    let f = workspace_state_file();
    if let Some(parent) = f.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    std::fs::write(&f, dir.to_string_lossy().as_bytes()).map_err(|e| e.to_string())?;
    Ok(dir.to_string_lossy().to_string())
}

/// Ensure the workspace dir exists and is a git repo (safety net for auto-approved edits).
fn ensure_workspace(dir: &PathBuf) -> Result<(), String> {
    std::fs::create_dir_all(dir).map_err(|e| format!("workspace create failed: {e}"))?;
    if !dir.join(".git").exists() {
        let _ = std::process::Command::new("git")
            .arg("init")
            .current_dir(dir)
            .output();
    }
    Ok(())
}

/// Best-effort git snapshot commit (revert safety for auto-approved edits).
fn git_snapshot(dir: &PathBuf, message: &str) {
    let _ = std::process::Command::new("git")
        .args(["add", "-A"])
        .current_dir(dir)
        .output();
    let _ = std::process::Command::new("git")
        .args(["commit", "--no-gpg-sign", "-m", message])
        .current_dir(dir)
        .output();
}

/// Decode the `exp` (seconds since epoch) claim from a JWT without verifying it.
fn jwt_exp(token: &str) -> Option<i64> {
    use base64::Engine;
    let payload = token.split('.').nth(1)?;
    let bytes = base64::engine::general_purpose::URL_SAFE_NO_PAD
        .decode(payload)
        .ok()?;
    let claims: Value = serde_json::from_slice(&bytes).ok()?;
    claims.get("exp").and_then(|e| e.as_i64())
}

fn now_secs() -> i64 {
    chrono::Utc::now().timestamp()
}

/// Extract the latest user-message text from the frontend `messages` array.
/// opencode keeps its own conversation state, so we only forward the newest turn.
fn last_user_text(messages: &[Value]) -> Option<String> {
    for m in messages.iter().rev() {
        if m.get("role").and_then(|r| r.as_str()) == Some("user") {
            match m.get("content") {
                Some(Value::String(s)) => return Some(s.clone()),
                Some(Value::Array(parts)) => {
                    let text: String = parts
                        .iter()
                        .filter_map(|p| p.get("text").and_then(|t| t.as_str()))
                        .collect::<Vec<_>>()
                        .join("");
                    if !text.is_empty() {
                        return Some(text);
                    }
                }
                _ => {}
            }
        }
    }
    None
}

/// Reader loop: routes agent responses to `pending`, auto-approves permission
/// requests, and translates `session/update` notifications into Tauri events.
async fn reader_loop(
    app: AppHandle,
    stdout: tokio::process::ChildStdout,
    stdin: Arc<Mutex<ChildStdin>>,
    pending: Arc<Mutex<HashMap<i64, oneshot::Sender<Value>>>>,
    turn: Arc<Mutex<TurnState>>,
) {
    let mut lines = BufReader::new(stdout).lines();
    while let Ok(Some(line)) = lines.next_line().await {
        if line.trim().is_empty() {
            continue;
        }
        let Ok(v) = serde_json::from_str::<Value>(&line) else {
            continue;
        };

        // Response to one of our requests.
        if v.get("id").is_some() && (v.get("result").is_some() || v.get("error").is_some()) {
            if let Some(id) = v.get("id").and_then(|i| i.as_i64()) {
                if let Some(tx) = pending.lock().await.remove(&id) {
                    let _ = tx.send(v);
                }
            }
            continue;
        }

        let method = v.get("method").and_then(|m| m.as_str()).unwrap_or("");

        // Request from the agent (has id + method) → we must respond.
        if v.get("id").is_some() && !method.is_empty() {
            let id = v.get("id").cloned().unwrap_or(Value::Null);
            if method == "session/request_permission" {
                // Auto-approve: pick an "allow" option (first that starts with allow).
                let option_id = v
                    .get("params")
                    .and_then(|p| p.get("options"))
                    .and_then(|o| o.as_array())
                    .and_then(|opts| {
                        opts.iter()
                            .find(|o| {
                                o.get("kind")
                                    .and_then(|k| k.as_str())
                                    .map(|k| k.starts_with("allow"))
                                    .unwrap_or(false)
                            })
                            .or_else(|| opts.first())
                    })
                    .and_then(|o| o.get("optionId").and_then(|x| x.as_str()))
                    .map(|s| s.to_string());

                let result = match option_id {
                    Some(oid) => json!({ "outcome": { "outcome": "selected", "optionId": oid } }),
                    None => json!({ "outcome": { "outcome": "cancelled" } }),
                };
                let _ = write_line(&stdin, &json!({ "jsonrpc": "2.0", "id": id, "result": result })).await;
            } else {
                // We advertised no fs/terminal capabilities, so opencode does its own
                // IO. Anything else we don't handle → method-not-found.
                let _ = write_line(
                    &stdin,
                    &json!({ "jsonrpc": "2.0", "id": id, "error": { "code": -32601, "message": "method not supported" } }),
                )
                .await;
            }
            continue;
        }

        // Notification from the agent.
        if method == "session/update" {
            handle_update(&app, &v, &turn).await;
        }
    }
}

async fn handle_update(app: &AppHandle, v: &Value, turn: &Arc<Mutex<TurnState>>) {
    let update = match v.get("params").and_then(|p| p.get("update")) {
        Some(u) => u,
        None => return,
    };
    let kind = update.get("sessionUpdate").and_then(|k| k.as_str()).unwrap_or("");
    let text = update
        .get("content")
        .and_then(|c| c.get("text"))
        .and_then(|t| t.as_str());

    match kind {
        "agent_message_chunk" => {
            let Some(text) = text else { return };
            let mut ts = turn.lock().await;
            ts.full_content.push_str(text);
            ts.pending_delta.push_str(text);
            // Throttle: emit at most once per window; the trailing delta is flushed
            // on `ollama:done`.
            if ts.last_emit.elapsed() >= TOKEN_EMIT_WINDOW {
                let _ = app.emit(
                    "ollama:token",
                    json!({
                        "generation_id": ts.generation_id,
                        "token": ts.pending_delta,
                        "full_content": ts.full_content,
                    }),
                );
                ts.pending_delta.clear();
                ts.last_emit = Instant::now();
            }
        }
        "agent_thought_chunk" => {
            if let Some(text) = text {
                let gid = turn.lock().await.generation_id.clone();
                let _ = app.emit(
                    "opencode:reasoning",
                    json!({ "generation_id": gid, "delta": text }),
                );
            }
        }
        "tool_call" | "tool_call_update" => {
            let gid = turn.lock().await.generation_id.clone();
            let _ = app.emit(
                "opencode:tool_call",
                json!({ "generation_id": gid, "update": update }),
            );
        }
        _ => {}
    }
}

/// Spawn `opencode acp`, run the ACP handshake, and register the session.
async fn spawn_session(
    app: &AppHandle,
    tenant: &str,
    token: &str,
    api_base: Option<String>,
    workspace: &PathBuf,
) -> Result<Arc<Session>, String> {
    ensure_workspace(workspace)?;

    let api_base = api_base.unwrap_or_else(|| DEFAULT_API_BASE.to_string());
    let base_url = format!("{}/api/ai-mentor/orgs/{}/v1", api_base.trim_end_matches('/'), tenant);
    let auth_header = format!("Token {token}");

    let mut cmd = create_command(&opencode_program());
    cmd.arg("acp")
        .current_dir(workspace)
        .env("XDG_CONFIG_HOME", config_home())
        .env("IBL_BASE_URL", &base_url)
        .env("IBL_AUTH_HEADER", &auth_header)
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .kill_on_drop(true);

    let mut child = cmd.spawn().map_err(|e| {
        format!("failed to launch `opencode acp` (is opencode installed?): {e}")
    })?;

    let stdin = Arc::new(Mutex::new(child.stdin.take().ok_or("no stdin")?));
    let stdout = child.stdout.take().ok_or("no stdout")?;
    let stderr = child.stderr.take().ok_or("no stderr")?;

    // Log opencode stderr (never contains the token; it lives only in env).
    tokio::spawn(async move {
        let mut lines = BufReader::new(stderr).lines();
        while let Ok(Some(l)) = lines.next_line().await {
            eprintln!("[opencode-acp] {l}");
        }
    });

    let pending: Arc<Mutex<HashMap<i64, oneshot::Sender<Value>>>> =
        Arc::new(Mutex::new(HashMap::new()));
    let turn = Arc::new(Mutex::new(TurnState {
        generation_id: String::new(),
        full_content: String::new(),
        pending_delta: String::new(),
        last_emit: Instant::now(),
    }));

    // Start the reader BEFORE the handshake so responses are routed.
    tokio::spawn(reader_loop(
        app.clone(),
        stdout,
        stdin.clone(),
        pending.clone(),
        turn.clone(),
    ));

    // A pre-session shell we can use to drive the handshake requests.
    let mut session = Session {
        child: Mutex::new(child),
        stdin,
        next_id: AtomicI64::new(1),
        pending,
        acp_session_id: String::new(),
        spawn_token_exp: jwt_exp(token),
        turn,
    };

    // 1) initialize — we advertise NO fs/terminal capabilities so opencode uses its
    //    own built-in file/shell tools directly on the workspace.
    session
        .request(
            "initialize",
            json!({
                "protocolVersion": 1,
                "clientCapabilities": { "fs": { "readTextFile": false, "writeTextFile": false }, "terminal": false },
                "clientInfo": { "name": "ibl.ai", "title": "ibl.ai Coding Mode", "version": "1.0.0" }
            }),
        )
        .await?;

    // 2) session/new with the workspace cwd.
    let new_res = session
        .request(
            "session/new",
            json!({ "cwd": workspace.to_string_lossy(), "mcpServers": [] }),
        )
        .await?;
    let acp_session_id = new_res
        .get("sessionId")
        .and_then(|s| s.as_str())
        .ok_or("session/new returned no sessionId")?
        .to_string();
    session.acp_session_id = acp_session_id;

    Ok(Arc::new(session))
}

/// Get an existing live session or spawn one, refreshing the process proactively
/// when the spawn token is near expiry.
async fn get_or_spawn(
    app: &AppHandle,
    session_id: &str,
    tenant: &str,
    token: &str,
    api_base: Option<String>,
    workspace: &PathBuf,
) -> Result<Arc<Session>, String> {
    {
        let reg = registry().lock().await;
        if let Some(s) = reg.get(session_id) {
            let expiring = s
                .spawn_token_exp
                .map(|exp| exp - now_secs() < TOKEN_REFRESH_SLACK_SECS)
                .unwrap_or(false);
            if !expiring {
                return Ok(s.clone());
            }
        }
    }
    // Missing or token near expiry → (re)spawn with the fresh token.
    close_session(session_id).await;
    let s = spawn_session(app, tenant, token, api_base, workspace).await?;
    registry().lock().await.insert(session_id.to_string(), s.clone());
    Ok(s)
}

async fn close_session(session_id: &str) {
    if let Some(s) = registry().lock().await.remove(session_id) {
        let mut child = s.child.lock().await;
        let _ = child.start_kill();
    }
}

/// Stream one Coding-Mode turn through opencode, emitting `ollama:*` +
/// `opencode:*` events keyed by `generation_id`.
#[command]
pub async fn opencode_chat_stream(
    app: AppHandle,
    session_id: String,
    messages: Vec<Value>,
    generation_id: String,
    tenant: String,
    token: String,
    api_base: Option<String>,
    workspace: Option<String>,
) -> Result<(), String> {
    let workspace = workspace.map(PathBuf::from).unwrap_or_else(resolve_workspace);

    let prompt_text = last_user_text(&messages)
        .ok_or("no user message to send to opencode")?;

    let session = get_or_spawn(&app, &session_id, &tenant, &token, api_base, &workspace).await?;

    // Reset per-turn state and snapshot the workspace before the agent runs.
    session.turn.lock().await.reset(generation_id.clone());
    git_snapshot(&workspace, "opencode: pre-turn snapshot");

    let res = session
        .request(
            "session/prompt",
            json!({
                "sessionId": session.acp_session_id,
                "prompt": [ { "type": "text", "text": prompt_text } ]
            }),
        )
        .await;

    // Snapshot again so auto-approved edits are captured/revertible.
    git_snapshot(&workspace, "opencode: post-turn snapshot");

    match res {
        Ok(result) => {
            let ts = session.turn.lock().await;
            // Flush any throttled trailing delta via the final full_content.
            let _ = app.emit(
                "ollama:done",
                json!({
                    "generation_id": generation_id,
                    "full_content": ts.full_content,
                    "stop_reason": result.get("stopReason").cloned().unwrap_or(Value::Null),
                }),
            );
            Ok(())
        }
        Err(e) => {
            let _ = app.emit(
                "ollama:error",
                json!({ "generation_id": generation_id, "error": e }),
            );
            Err(e)
        }
    }
}

/// Cancel the active turn for a session (Stop button).
#[command]
pub async fn opencode_stop(session_id: String) -> Result<(), String> {
    let session = { registry().lock().await.get(&session_id).cloned() };
    if let Some(s) = session {
        s.notify("session/cancel", json!({ "sessionId": s.acp_session_id }))
            .await?;
    }
    Ok(())
}

/// Kill and drop a session's opencode process (chat closed / idle cleanup).
#[command]
pub async fn opencode_close(session_id: String) -> Result<(), String> {
    close_session(&session_id).await;
    Ok(())
}
