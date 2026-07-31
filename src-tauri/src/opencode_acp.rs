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
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicI64, AtomicUsize, Ordering};
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

/// Coalesce assistant-token emits to at most one per this window — the buffer that
/// keeps a fast opencode stream from re-render-storming (and freezing) the webview,
/// per the pattern in CLAUDE.local.md. `ollama:done` always carries the final
/// `full_content`, so widening the window never drops the trailing text.
// ponytail: 200ms = 5 renders/sec — coarse enough to stop the freeze, still reads as
// live streaming. Lower for snappier text; add a frontend typewriter buffer if a
// heavy message renderer still janks at this rate.
const TOKEN_EMIT_WINDOW: Duration = Duration::from_millis(200);

/// How long a permission card may sit unanswered before it resolves as denied. An
/// ignored prompt must never leave the turn hanging with no explanation.
const PERMISSION_TIMEOUT: Duration = Duration::from_secs(180);

/// Live `opencode acp` processes allowed at once. Each is a Bun binary holding real
/// memory, and a user with many chats open would otherwise accumulate one per chat.
const MAX_SESSIONS: usize = 5;

/// A session untouched for this long is closed. Second bound behind [`MAX_SESSIONS`],
/// so a user who opens five chats and walks away doesn't leave five processes resident.
const IDLE_TIMEOUT: Duration = Duration::from_secs(15 * 60);

/// How often the reaper looks for idle sessions.
const REAP_INTERVAL: Duration = Duration::from_secs(60);

type Registry = Mutex<HashMap<String, Arc<Session>>>;

fn registry() -> &'static Registry {
    static REG: OnceLock<Registry> = OnceLock::new();
    REG.get_or_init(|| Mutex::new(HashMap::new()))
}

/// A permission request shown to the user and waiting on their answer.
struct PendingPermission {
    /// Chat session it belongs to, so Stop can resolve just that chat's cards.
    session_id: String,
    /// `Some(option_id)` = allow, `None` = deny/cancel.
    tx: oneshot::Sender<Option<String>>,
}

fn permissions() -> &'static Mutex<HashMap<String, PendingPermission>> {
    static P: OnceLock<Mutex<HashMap<String, PendingPermission>>> = OnceLock::new();
    P.get_or_init(|| Mutex::new(HashMap::new()))
}

/// Resolve every open permission card for a chat as denied — Stop and process
/// teardown must not leave opencode blocked on an answer that can no longer come.
async fn deny_pending_for(session_id: &str) {
    let mut map = permissions().lock().await;
    let ids: Vec<String> = map
        .iter()
        .filter(|(_, p)| p.session_id == session_id)
        .map(|(k, _)| k.clone())
        .collect();
    for id in ids {
        if let Some(p) = map.remove(&id) {
            let _ = p.tx.send(None);
        }
    }
}

/// Answer a permission card. `option_id` is one of the ids from the
/// `opencode:permission_request` payload; `None` denies.
#[command]
pub async fn opencode_permission_respond(
    request_id: String,
    option_id: Option<String>,
) -> Result<(), String> {
    if let Some(p) = permissions().lock().await.remove(&request_id) {
        let _ = p.tx.send(option_id);
    }
    Ok(())
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
    /// The compat model id this process was spawned for (e.g. "openai/gpt-5.5"); a
    /// change means the mentor's LLM switched → respawn with the new model.
    requested_model: Option<String>,
    /// Throwaway key this session uses against the loopback model proxy (cloud only).
    /// The real DM token lives in the proxy, keyed by this.
    proxy_secret: Option<String>,
    turn: Arc<Mutex<TurnState>>,
    /// Last time this session was asked to do anything, for eviction and reaping.
    last_used: Mutex<Instant>,
    /// Turns in flight. A session mid-turn is never the preferred eviction victim, and
    /// is never reaped — so this MUST be decremented on every exit path, including
    /// errors, or the session pins itself alive forever.
    active_turns: AtomicUsize,
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
    eprintln!("[acp→] {msg}");
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

/// A chat session id reduced to something safe to use as a single path component.
///
/// Session ids are opaque strings from the backend and may contain `/`, `..` or worse;
/// dropped straight into a path they would escape the directory we mean to create. Keep
/// a readable prefix so the folders are still identifiable by eye, and append a hash so
/// two ids that sanitise to the same prefix don't share a directory.
fn path_key(session_id: &str) -> String {
    use sha2::{Digest, Sha256};
    let safe: String = session_id
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() || c == '-' || c == '_' { c } else { '_' })
        .take(24)
        .collect();
    let digest = hex::encode(Sha256::digest(session_id.as_bytes()));
    format!("{safe}-{}", &digest[..8])
}

/// opencode config home for ONE chat, so it reads
/// `~/.config/iblai/agents/sessions/<key>/opencode/opencode.json`.
///
/// Per session, not shared: `apply_opencode_model` rewrites this file on every spawn, so
/// a single shared copy meant a second chat could retune the model under a running first
/// one, or read it half-written. (The `ponytail` note that used to sit on
/// `apply_opencode_model` called this out as the fix once concurrent sessions mattered.)
pub fn config_home(session_id: &str) -> PathBuf {
    home_dir()
        .unwrap_or_default()
        .join(".config")
        .join("iblai")
        .join("agents")
        .join("sessions")
        .join(path_key(session_id))
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

/// The opencode program to spawn: the bare name, resolved off PATH.
///
/// Paired with [`augmented_path`], which appends our managed `bin` dir — so a user's own
/// `opencode` wins and the one we download is the zero-install fallback. Anything that
/// runs this program (spawn, `--version` probes) must use that PATH, or the managed
/// binary is invisible and the app concludes opencode isn't installed.
pub fn opencode_program() -> String {
    "opencode".to_string()
}

/// `PATH` with the managed `bin` dir appended, for spawning or probing `opencode`.
///
/// Appended, not prepended: a system install takes precedence and ours only fills the gap.
pub fn augmented_path() -> std::ffi::OsString {
    let mut dirs: Vec<PathBuf> = std::env::var_os("PATH")
        .map(|p| std::env::split_paths(&p).collect())
        .unwrap_or_default();
    dirs.push(iblai_data_dir().join("bin"));
    // `join_paths` uses the platform separator, so this is correct on Windows' `;` too.
    std::env::join_paths(dirs).unwrap_or_else(|_| std::env::var_os("PATH").unwrap_or_default())
}

/// Chat → workspace folder, persisted as `~/.local/share/iblai/workspaces.json`.
///
/// Replaces the single global `workspace.txt`: every chat now gets its own folder, so a
/// path has to be looked up per session rather than read from one file. A chat's entry is
/// either a generated folder under `workspaces/` or an arbitrary path the user picked.
fn workspace_map_file() -> PathBuf {
    iblai_data_dir().join("workspaces.json")
}

fn read_workspace_map() -> serde_json::Map<String, Value> {
    std::fs::read_to_string(workspace_map_file())
        .ok()
        .and_then(|s| serde_json::from_str::<Value>(&s).ok())
        .and_then(|v| v.as_object().cloned())
        .unwrap_or_default()
}

fn write_workspace_map(map: &serde_json::Map<String, Value>) -> Result<(), String> {
    let f = workspace_map_file();
    if let Some(parent) = f.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let out = serde_json::to_string_pretty(&Value::Object(map.clone())).map_err(|e| e.to_string())?;
    std::fs::write(&f, out).map_err(|e| format!("failed writing workspace map: {e}"))
}

/// A readable folder name for a new chat's workspace: `brave-otter-4f2a`.
///
/// Random rather than derived from the session id so the folder is pleasant to find in a
/// file manager; the map is what makes it durable. Entropy comes from the same source as
/// the proxy's session secret, so this needs no `rand` dependency.
fn workspace_slug() -> String {
    const ADJECTIVES: [&str; 16] = [
        "brave", "calm", "clever", "eager", "fuzzy", "gentle", "happy", "keen", "lively",
        "lucky", "merry", "quiet", "swift", "tidy", "warm", "wise",
    ];
    const NOUNS: [&str; 16] = [
        "otter", "falcon", "maple", "harbor", "lantern", "meadow", "pebble", "quartz",
        "raven", "river", "sparrow", "summit", "thicket", "willow", "canyon", "cedar",
    ];
    let seed = crate::opencode_proxy::new_secret();
    let byte = |i: usize| usize::from_str_radix(&seed[i..i + 2], 16).unwrap_or(0);
    format!(
        "{}-{}-{}",
        ADJECTIVES[byte(0) % ADJECTIVES.len()],
        NOUNS[byte(2) % NOUNS.len()],
        &seed[4..8]
    )
}

/// This chat's workspace, generating and recording one the first time it's asked for.
pub fn resolve_workspace(session_id: &str) -> PathBuf {
    let mut map = read_workspace_map();
    if let Some(path) = map.get(session_id).and_then(|v| v.as_str()) {
        if !path.is_empty() {
            return PathBuf::from(path);
        }
    }
    let root = iblai_data_dir().join("workspaces");
    // Collisions are astronomically unlikely but cheap to rule out, and a collision would
    // silently hand two chats the same folder.
    let taken: Vec<&str> = map.values().filter_map(|v| v.as_str()).collect();
    let dir = std::iter::repeat_with(workspace_slug)
        .map(|slug| root.join(slug))
        .find(|d| !d.exists() && !taken.iter().any(|t| Path::new(t) == d))
        .unwrap_or_else(|| root.join("main"));

    // Create it now, not at first turn. This is what the Code popover displays the
    // moment a chat opens, so a folder the user is told about has to actually be
    // there when they go looking for it.
    let _ = std::fs::create_dir_all(&dir);
    map.insert(session_id.to_string(), json!(dir.to_string_lossy()));
    let _ = write_workspace_map(&map);
    dir
}

/// Return this chat's coding workspace path.
#[command]
pub async fn get_opencode_workspace(session_id: String) -> Result<String, String> {
    Ok(resolve_workspace(&session_id).to_string_lossy().to_string())
}

/// Point ONE chat at a folder. The frontend supplies the path from a native folder picker
/// (`@tauri-apps/plugin-dialog`); it can be anywhere on disk and is used as-is, not moved
/// under the app-managed tree.
#[command]
pub async fn set_opencode_workspace(
    session_id: String,
    path: String,
) -> Result<String, String> {
    let dir = PathBuf::from(&path);
    ensure_workspace(&dir)?;
    let mut map = read_workspace_map();
    map.insert(session_id, json!(dir.to_string_lossy()));
    write_workspace_map(&map)?;
    Ok(dir.to_string_lossy().to_string())
}

/// Ensure the workspace dir exists and is a git repo.
///
/// The `git init` stays even though the automatic pre/post-turn snapshot commits are
/// gone: being a repo is what lets the user review and revert Code's work with ordinary
/// git. The snapshots themselves were revert-safety for the auto-approve era — now that
/// every write is individually approved they only added noise to the user's history, and
/// two concurrent sessions would have collided on `.git/index.lock`.
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

/// Pick the option id of the first option whose ACP `kind` starts with `prefix`
/// ("allow" / "reject").
fn option_id(options: &Value, prefix: &str) -> Option<String> {
    options
        .as_array()?
        .iter()
        .find(|o| {
            o.get("kind")
                .and_then(|k| k.as_str())
                .map(|k| k.starts_with(prefix))
                .unwrap_or(false)
        })
        .and_then(|o| o.get("optionId").and_then(|x| x.as_str()))
        .map(|s| s.to_string())
}

/// The JSON-RPC result answering a `session/request_permission`.
fn permission_result(id: &Value, chosen: Option<String>) -> Value {
    let outcome = match chosen {
        Some(oid) => json!({ "outcome": "selected", "optionId": oid }),
        None => json!({ "outcome": "cancelled" }),
    };
    json!({ "jsonrpc": "2.0", "id": id, "result": { "outcome": outcome } })
}

/// The shell command a tool call wants to run, so the card can show it verbatim.
fn command_of(tool_call: &Value) -> Option<String> {
    let input = tool_call.get("rawInput")?.as_object()?;
    ["command", "cmd", "script"].iter().find_map(|key| {
        input
            .get(*key)
            .and_then(|v| v.as_str())
            .filter(|s| !s.trim().is_empty())
            .map(|s| s.to_string())
    })
}

/// Handle one `session/request_permission` by asking the user. Every request becomes an
/// inline card — there is no auto-approval, and no policy of our own.
///
/// Nothing else confines the agent, so this is the boundary: what opencode asks about is
/// decided by the `permission` block we write into its config (`edit`/`bash`/`webfetch`
/// all `"ask"`), and what happens next is decided by the person reading the card.
///
/// The wait runs in its own task so the turn keeps streaming while a card is up —
/// blocking the reader loop would freeze the reasoning/tool output the user needs in
/// order to judge the request.
async fn handle_permission_request(
    app: &AppHandle,
    stdin: &Arc<Mutex<ChildStdin>>,
    turn: &Arc<Mutex<TurnState>>,
    session_id: &str,
    id: Value,
    params: &Value,
) {
    let tool_call = params.get("toolCall").cloned().unwrap_or(Value::Null);
    let options = params.get("options").cloned().unwrap_or(Value::Null);
    let allow = option_id(&options, "allow");
    let reject = option_id(&options, "reject");

    static NEXT_REQ: AtomicI64 = AtomicI64::new(1);
    let request_id = format!("perm-{}", NEXT_REQ.fetch_add(1, Ordering::SeqCst));
    let (tx, rx) = oneshot::channel();
    permissions().lock().await.insert(
        request_id.clone(),
        PendingPermission { session_id: session_id.to_string(), tx },
    );

    let generation_id = turn.lock().await.generation_id.clone();
    let _ = app.emit(
        "opencode:permission_request",
        json!({
            "generation_id": generation_id,
            // Which chat is waiting. The card itself scopes by generation_id (it renders
            // in the streaming message that produced it); this is what lets the sidebar
            // badge a chat the user isn't currently looking at.
            "session_id": session_id,
            "request_id": request_id,
            "title": tool_call.get("title").cloned().unwrap_or(Value::Null),
            "kind": tool_call.get("kind").cloned().unwrap_or(Value::Null),
            "command": command_of(&tool_call),
            "allow_option_id": allow,
            "reject_option_id": reject.clone(),
            "options": options,
        }),
    );

    let app = app.clone();
    let stdin = stdin.clone();
    tokio::spawn(async move {
        // Timeout, denial and "the sender was dropped by Stop" all mean the same
        // thing: don't run it.
        let chosen = match tokio::time::timeout(PERMISSION_TIMEOUT, rx).await {
            Ok(Ok(Some(opt))) => Some(opt),
            _ => reject,
        };
        permissions().lock().await.remove(&request_id);
        let _ = app.emit(
            "opencode:permission_resolved",
            json!({ "request_id": request_id }),
        );
        let _ = write_line(&stdin, &permission_result(&id, chosen)).await;
    });
}

/// Reader loop: routes agent responses to `pending`, prompts the user on permission
/// requests, and translates `session/update` notifications into Tauri events.
async fn reader_loop(
    app: AppHandle,
    stdout: tokio::process::ChildStdout,
    stdin: Arc<Mutex<ChildStdin>>,
    pending: Arc<Mutex<HashMap<i64, oneshot::Sender<Value>>>>,
    turn: Arc<Mutex<TurnState>>,
    session_id: String,
) {
    let mut lines = BufReader::new(stdout).lines();
    while let Ok(Some(line)) = lines.next_line().await {
        if line.trim().is_empty() {
            continue;
        }
        eprintln!("[acp←] {line}");
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
                let params = v.get("params").cloned().unwrap_or(Value::Null);
                handle_permission_request(&app, &stdin, &turn, &session_id, id, &params).await;
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

/// Which opencode provider block a selected model maps to.
///
/// The model string doubles as the routing signal so the SDK wire format doesn't have
/// to change: `ollama/<id>` and `foundry/<id>` are on-device, anything else is a
/// cloud ibl.ai compat id that already carries its own prefix (`openai/gpt-5.5`).
struct ModelSpec {
    /// opencode provider key: "ollama" | "foundry" | "iblai".
    provider: &'static str,
    /// Bare model id as the runtime knows it (routing prefix stripped for local).
    model: String,
    /// On-device runtimes need an explicit baseURL and no ibl.ai auth.
    local: bool,
}

fn parse_model_spec(model: &str) -> ModelSpec {
    if let Some(rest) = model.strip_prefix("ollama/") {
        ModelSpec { provider: "ollama", model: rest.to_string(), local: true }
    } else if let Some(rest) = model.strip_prefix("foundry/") {
        ModelSpec { provider: "foundry", model: rest.to_string(), local: true }
    } else {
        ModelSpec { provider: "iblai", model: model.to_string(), local: false }
    }
}

/// Match model ids ignoring a `:tag` suffix on either side ("qwen3" ≡ "qwen3:latest"),
/// mirroring the frontend's `sameModel`. Catalog base names are unique, so this can't
/// select the wrong model.
fn same_model(a: &str, b: &str) -> bool {
    a == b || a.split(':').next() == b.split(':').next()
}

/// Force the policy Code runs under: opencode must ASK before **every** operation —
/// reading a file as much as editing one, shelling out, globbing, grepping, fetching.
///
/// The bare `"ask"` string is opencode's own shorthand for "this action, for every
/// permission key" (see the `PermissionConfig` anyOf in <https://opencode.ai/config.json>).
/// Deliberately not an explicit `{read, edit, bash, …}` map: that list is opencode's to
/// grow, and a tool added in a future version would silently arrive unprompted.
///
/// Applied on **every** `opencode acp` start, not just when the config is first written.
/// opencode reads this file once at startup, so a config that drifted — hand-edited, left
/// over from an older build, or shipped by a future template — would otherwise hand the
/// agent unprompted access for the whole session. Nothing else confines Code, so this is
/// enforced rather than defaulted: whatever is there gets overwritten.
fn enforce_permission_policy(root: &mut serde_json::Map<String, Value>) {
    root.insert("permission".to_string(), json!("ask"));
    // A per-agent `permission` block takes precedence over the top-level one, so leaving
    // one in place would quietly defeat the line above. Drop them; everything else about
    // those agents is left alone.
    if let Some(agents) = root.get_mut("agent").and_then(|a| a.as_object_mut()) {
        for agent in agents.values_mut() {
            if let Some(obj) = agent.as_object_mut() {
                obj.remove("permission");
            }
        }
    }
}

/// Point opencode at a model by patching its config: set the top-level `model`, keep
/// `enabled_providers` to just the active provider, and reset that provider's `models`
/// map to only the active model.
///
/// `base_url` + `api_key` are always explicit now — an on-device runtime's own
/// endpoint, or the loopback proxy for cloud. The old `{env:IBL_*}` placeholders are
/// gone, which is what lets the real DM token stay out of the agent's environment.
///
// ponytail: patches the single shared config at ~/.config/iblai/agents/opencode —
// fine for one Code session at a time; give each session its own XDG_CONFIG_HOME if
// concurrent Code sessions with different models ever matter.
fn apply_opencode_model(
    session_id: &str,
    spec: &ModelSpec,
    base_url: &str,
    api_key: &str,
    display_name: &str,
) -> Result<(), String> {
    // The config ships embedded in the app and is materialized on first use — make
    // sure this session's copy is on disk before we patch it.
    let home = config_home(session_id);
    crate::opencode_installer::ensure_opencode_config_at(&home)?;
    let path = home.join("opencode").join("opencode.json");
    let text = std::fs::read_to_string(&path)
        .map_err(|e| format!("opencode config not found ({}): {e}", path.display()))?;
    let mut cfg: Value =
        serde_json::from_str(&text).map_err(|e| format!("bad opencode config: {e}"))?;

    let root = cfg
        .as_object_mut()
        .ok_or("opencode config is not a JSON object")?;
    root.insert(
        "model".to_string(),
        json!(format!("{}/{}", spec.provider, spec.model)),
    );
    // Only the active provider is enabled, so opencode never tries to resolve
    // credentials for one we're not using this session.
    root.insert("enabled_providers".to_string(), json!([spec.provider]));
    // The security boundary — see `enforce_permission_policy`. Re-applied here because
    // this runs on every spawn, immediately before the process starts.
    enforce_permission_policy(root);

    let providers = root
        .entry("provider")
        .or_insert_with(|| json!({}))
        .as_object_mut()
        .ok_or("opencode config `provider` is not an object")?;
    let entry = providers
        .entry(spec.provider.to_string())
        .or_insert_with(|| json!({}))
        .as_object_mut()
        .ok_or("opencode provider entry is not an object")?;

    // Reset to JUST the active model each spawn (no accumulation across sessions).
    let mut models = serde_json::Map::new();
    models.insert(spec.model.clone(), json!({ "name": spec.model }));
    entry.insert("models".to_string(), Value::Object(models));

    entry.insert("npm".to_string(), json!("@ai-sdk/openai-compatible"));
    entry.insert("name".to_string(), json!(display_name));
    // On-device runtimes are unauthenticated and the key is a placeholder that just
    // satisfies @ai-sdk/openai-compatible; cloud gets the throwaway proxy secret.
    entry.insert(
        "options".to_string(),
        json!({ "baseURL": base_url, "apiKey": api_key }),
    );

    let out = serde_json::to_string_pretty(&cfg).map_err(|e| e.to_string())?;
    std::fs::write(&path, out).map_err(|e| format!("failed writing opencode config: {e}"))
}

/// Resolve the OpenAI-compatible base URL for an on-device runtime, starting Ollama
/// if it isn't up yet.
///
/// NOTE: this deliberately targets PLAIN Ollama on :11434, NOT the `ollama-mcp-bridge`
/// on :8000 that `model_manager::chat_base_url` calls "the one and only chat port".
/// That rule governs the app's own chat path, which needs the bridge to inject MCP
/// tools. Code must not use it: the bridge speaks the *Ollama* API (`/api/chat`) while
/// opencode needs *OpenAI*-compatible `/v1/chat/completions`, and opencode ships its own
/// file/shell tools, so the bridge's injected tools would duplicate them.
async fn resolve_local_base_url(spec: &ModelSpec) -> Result<String, String> {
    match spec.provider {
        "ollama" => {
            if !crate::model_manager::wait_for_ollama_ready(1).await {
                crate::model_manager::start_ollama_server()?;
                if !crate::model_manager::wait_for_ollama_ready(20).await {
                    return Err("Ollama isn't running and couldn't be started.".to_string());
                }
            }
            Ok(format!(
                "{}/v1",
                crate::model_manager::OLLAMA_API_URL.trim_end_matches('/')
            ))
        }
        "foundry" => {
            let endpoint = crate::foundry_manager::get_foundry_service_endpoint()
                .ok_or("Foundry Local isn't running — start it and try again.")?;
            Ok(format!("{}/v1", endpoint.trim_end_matches('/')))
        }
        other => Err(format!("unknown on-device runtime: {other}")),
    }
}

/// Foundry persists the UI id (e.g. "phi-3-mini-128k_npu") but its OpenAI-compatible
/// endpoint wants the runtime id (e.g. "phi-3-mini-128k-instruct-qnn-npu:2"). Mirror
/// the translation `foundry_chat_stream` does in main.rs, or Code sends an id Foundry
/// doesn't recognise. Falls back to the input when it can't be resolved.
async fn foundry_runtime_id(model: &str) -> String {
    if let Ok(status) = crate::foundry_manager::check_foundry_status().await {
        if let Some(m) = status
            .models
            .iter()
            .find(|m| m.id == model || m.foundry_id == model)
        {
            return m.foundry_id.clone();
        }
    }
    model.to_string()
}

/// Read a model's `capabilities` from Ollama's `/api/tags`. `None` = unknown (model
/// not installed, or Ollama unreachable).
async fn ollama_supports_tools(model: &str) -> Option<bool> {
    let url = format!(
        "{}/api/tags",
        crate::model_manager::OLLAMA_API_URL.trim_end_matches('/')
    );
    let body: Value = reqwest::get(&url).await.ok()?.json().await.ok()?;
    let entry = body.get("models")?.as_array()?.iter().find(|m| {
        m.get("name")
            .and_then(|n| n.as_str())
            .map(|n| same_model(n, model))
            .unwrap_or(false)
    })?;
    let caps = entry.get("capabilities")?.as_array()?;
    Some(caps.iter().any(|c| c.as_str() == Some("tools")))
}

/// Report whether the selected on-device model can actually drive Code.
///
/// opencode is agentic: without tool calling it can't read/write files or run commands,
/// so it degrades to plain chat and looks broken. Ollama publishes per-model
/// `capabilities`, so we can refuse up front — the same rule
/// `model_manager::chat_base_url` already applies to local chat. Foundry Local exposes
/// no capability metadata, so it reports `null` (unknown) and the UI warns instead of
/// blocking.
/// `model` is the app's selected on-device model (`ibl_local_llm_model`, e.g.
/// "qwen3:latest"). It may carry an explicit `ollama/` or `foundry/` prefix; if not,
/// the runtime is auto-detected — Ollama when it's up and knows the model, else
/// Foundry Local. The returned `spec` is the prefixed string to persist as
/// `ibl_coding_mode_model`, which is what routes the spawn.
#[command]
pub async fn check_code_local_model(model: String) -> Value {
    // Everything here is treated as on-device: `foundry/` picks Foundry, `ollama/`
    // picks Ollama, and a bare id auto-detects (Ollama when it's up and knows the
    // model, else Foundry). We never infer "cloud" from a slash — Ollama ids can
    // contain one, e.g. `hf.co/user/model`.
    if let Some(rest) = model.strip_prefix("foundry/") {
        let runtime_id = foundry_runtime_id(rest).await;
        return foundry_result(
            &runtime_id,
            crate::foundry_manager::get_foundry_service_endpoint(),
        );
    }
    let explicit_ollama = model.starts_with("ollama/");
    let bare = model.strip_prefix("ollama/").unwrap_or(&model).to_string();

    if !crate::model_manager::wait_for_ollama_ready(1).await {
        if !explicit_ollama {
            if let Some(endpoint) = crate::foundry_manager::get_foundry_service_endpoint() {
                return foundry_result(&foundry_runtime_id(&bare).await, Some(endpoint));
            }
        }
        return json!({
            "runtime": "ollama", "spec": format!("ollama/{bare}"), "model": bare,
            "endpoint": Value::Null, "running": false, "tools_supported": Value::Null,
            "reason": "Ollama isn't running."
        });
    }

    let tools = ollama_supports_tools(&bare).await;
    // Unknown to Ollama and the caller didn't insist on it → Foundry may serve it.
    if tools.is_none() && !explicit_ollama {
        if let Some(endpoint) = crate::foundry_manager::get_foundry_service_endpoint() {
            return foundry_result(&bare, Some(endpoint));
        }
    }
    ollama_result(&bare, tools)
}

fn ollama_result(model: &str, tools: Option<bool>) -> Value {
    let reason = match tools {
        Some(true) => String::new(),
        Some(false) => format!(
            "{model} doesn't support tool calling, so Code can't edit files or run commands with it."
        ),
        None => format!("Couldn't read tool support for {model} from Ollama."),
    };
    json!({
        "runtime": "ollama",
        "spec": format!("ollama/{model}"),
        "model": model,
        "endpoint": crate::model_manager::OLLAMA_API_URL,
        "running": true,
        "tools_supported": tools,
        "reason": reason,
    })
}

fn foundry_result(model: &str, endpoint: Option<String>) -> Value {
    match endpoint {
        // Foundry Local publishes no per-model capability metadata, so tool support is
        // unknown — the UI warns instead of blocking (blocking would disable Foundry).
        Some(endpoint) => json!({
            "runtime": "foundry", "spec": format!("foundry/{model}"), "model": model,
            "endpoint": endpoint, "running": true, "tools_supported": Value::Null,
            "reason": "Foundry Local doesn't report tool-calling support — Code may not be able to edit files with this model."
        }),
        None => json!({
            "runtime": "foundry", "spec": format!("foundry/{model}"), "model": model,
            "endpoint": Value::Null, "running": false, "tools_supported": Value::Null,
            "reason": "Foundry Local isn't running."
        }),
    }
}

/// Spawn `opencode acp`, run the ACP handshake, and register the session.
async fn spawn_session(
    app: &AppHandle,
    session_id: &str,
    tenant: &str,
    token: &str,
    model: Option<String>,
    api_base: Option<String>,
    workspace: &PathBuf,
) -> Result<Arc<Session>, String> {
    ensure_workspace(workspace)?;

    // Match opencode's model to the selection — NO default: an absent/empty model
    // means Code doesn't run, so a broken selection fails loudly instead of silently
    // falling back to some other model.
    let chosen_model = match model.as_deref() {
        Some(m) if !m.is_empty() => m.to_string(),
        _ => return Err("no model selected for Code".to_string()),
    };
    let spec = parse_model_spec(&chosen_model);

    // On-device runtimes talk straight to their own local endpoint. Cloud goes through
    // the loopback proxy, which holds the real DM token — the agent only ever sees a
    // throwaway per-session key, so `echo $IBL_AUTH_HEADER` has nothing to steal.
    let (base_url, api_key, display_name, proxy_secret) = if spec.local {
        let url = resolve_local_base_url(&spec).await?;
        let name = if spec.provider == "ollama" {
            "Ollama (on-device)"
        } else {
            "Foundry Local (on-device)"
        };
        (url, "local".to_string(), name, None)
    } else {
        let api_base = api_base.unwrap_or_else(|| DEFAULT_API_BASE.to_string());
        let upstream = format!(
            "{}/api/ai-mentor/orgs/{}/v1",
            api_base.trim_end_matches('/'),
            tenant
        );
        let port = crate::opencode_proxy::ensure_started().await?;
        let secret = crate::opencode_proxy::new_secret();
        crate::opencode_proxy::register(&secret, upstream, token.to_string()).await;
        (
            format!("http://127.0.0.1:{port}/v1"),
            secret.clone(),
            "ibl.ai",
            Some(secret),
        )
    };
    apply_opencode_model(session_id, &spec, &base_url, &api_key, display_name)?;

    // A plain child process, at the user's own privilege — the confinement is the
    // permission prompt in `handle_permission_request`, not the kernel. `PATH` carries our
    // managed `bin` dir so a downloaded opencode is found when the system has none.
    let mut cmd = create_command(&opencode_program());
    cmd.args(["acp", "--print-logs", "--log-level", "INFO"])
        .current_dir(workspace)
        .env("PATH", augmented_path())
        .env("XDG_CONFIG_HOME", config_home(session_id))
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
            eprintln!("[opencode] {l}");
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
        session_id.to_string(),
    ));

    // A pre-session shell we can use to drive the handshake requests.
    let mut session = Session {
        child: Mutex::new(child),
        stdin,
        next_id: AtomicI64::new(1),
        pending,
        acp_session_id: String::new(),
        requested_model: model,
        proxy_secret,
        turn,
        last_used: Mutex::new(Instant::now()),
        active_turns: AtomicUsize::new(0),
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

/// Get an existing live session or spawn one.
///
/// Token expiry no longer forces a respawn: the proxy holds the credential, so the
/// fresh dm_token the frontend sends each turn is swapped in place and the session
/// (and opencode's conversation state) survives.
async fn get_or_spawn(
    app: &AppHandle,
    session_id: &str,
    tenant: &str,
    token: &str,
    model: Option<String>,
    api_base: Option<String>,
    workspace: &PathBuf,
) -> Result<Arc<Session>, String> {
    let live = { registry().lock().await.get(session_id).cloned() };
    if let Some(s) = live {
        if s.requested_model.as_deref() == model.as_deref() {
            *s.last_used.lock().await = Instant::now();
            if let Some(secret) = &s.proxy_secret {
                crate::opencode_proxy::set_token(secret, token).await;
            }
            return Ok(s);
        }
    }
    // Missing or the model switched → (re)spawn.
    close_session(session_id).await;
    evict_for_new_session(session_id).await;
    start_reaper();
    let s = spawn_session(app, session_id, tenant, token, model, api_base, workspace).await?;
    registry().lock().await.insert(session_id.to_string(), s.clone());
    Ok(s)
}

/// Marks a session as mid-turn for as long as it lives.
///
/// A guard rather than manual bookkeeping: the turn has several exit paths (`?` on the
/// prompt, the error arm, an early return), and one missed decrement would pin the
/// session as permanently busy — never evicted, never reaped.
struct TurnGuard(Arc<Session>);

impl TurnGuard {
    fn new(session: Arc<Session>) -> Self {
        session.active_turns.fetch_add(1, Ordering::SeqCst);
        Self(session)
    }
}

impl Drop for TurnGuard {
    fn drop(&mut self) {
        self.0.active_turns.fetch_sub(1, Ordering::SeqCst);
        // Restart the idle clock on the way out, so a turn that ran longer than
        // IDLE_TIMEOUT isn't instantly reapable the moment it finishes. `try_lock`
        // because Drop can't await; losing the race just means someone else is
        // already updating it.
        if let Ok(mut last) = self.0.last_used.try_lock() {
            *last = Instant::now();
        }
    }
}

/// A session's state at one instant, for the eviction/reap decisions. Snapshotted so
/// those decisions are pure functions we can actually test.
struct SessionState {
    session_id: String,
    idle_for: Duration,
    busy: bool,
}

/// Which session to close to make room, or `None` if there's already room.
///
/// Prefers the least-recently-used session that is doing nothing. Only if all of them
/// are busy — mid-turn or sitting on an unanswered prompt — does it take the
/// least-recently-used one anyway: killing that turn (which surfaces as an error) beats
/// leaving the new chat hanging, which is the exact failure this whole change removes.
fn pick_eviction(states: &[SessionState], cap: usize) -> Option<String> {
    if states.len() < cap {
        return None;
    }
    let lru = |only_idle: bool| {
        states
            .iter()
            .filter(|s| !only_idle || !s.busy)
            .max_by_key(|s| s.idle_for)
            .map(|s| s.session_id.clone())
    };
    lru(true).or_else(|| lru(false))
}

/// Sessions the reaper should close: idle past the timeout AND doing nothing. A chat
/// sitting on an unanswered prompt is idle by the clock but must not be killed under
/// the user, so `busy` covers pending permissions as well as in-flight turns.
fn pick_reapable(states: &[SessionState], idle_timeout: Duration) -> Vec<String> {
    states
        .iter()
        .filter(|s| !s.busy && s.idle_for >= idle_timeout)
        .map(|s| s.session_id.clone())
        .collect()
}

/// Snapshot every live session. `busy` folds together in-flight turns and unanswered
/// permission prompts, which are the two reasons not to touch a session.
async fn session_states() -> Vec<SessionState> {
    let waiting: Vec<String> = permissions()
        .lock()
        .await
        .values()
        .map(|p| p.session_id.clone())
        .collect();
    let sessions: Vec<(String, Arc<Session>)> = registry()
        .lock()
        .await
        .iter()
        .map(|(k, v)| (k.clone(), v.clone()))
        .collect();

    let mut out = Vec::with_capacity(sessions.len());
    for (session_id, s) in sessions {
        let busy = s.active_turns.load(Ordering::SeqCst) > 0
            || waiting.iter().any(|w| *w == session_id);
        out.push(SessionState {
            idle_for: s.last_used.lock().await.elapsed(),
            session_id,
            busy,
        });
    }
    out
}

/// Close the least-valuable session if a new one would exceed [`MAX_SESSIONS`].
async fn evict_for_new_session(incoming: &str) {
    let states: Vec<SessionState> = session_states()
        .await
        .into_iter()
        // The incoming chat isn't in the registry yet, but guard anyway: evicting the
        // session we're about to spawn for would be a self-inflicted respawn loop.
        .filter(|s| s.session_id != incoming)
        .collect();
    if let Some(victim) = pick_eviction(&states, MAX_SESSIONS) {
        eprintln!("[opencode] evicting idle session {victim} to stay under the cap");
        close_session(&victim).await;
    }
}

/// Background sweep closing sessions nobody has used in a while. Started lazily on the
/// first spawn so an app that never uses Code carries no timer.
fn start_reaper() {
    static STARTED: OnceLock<()> = OnceLock::new();
    if STARTED.set(()).is_err() {
        return;
    }
    tokio::spawn(async {
        loop {
            tokio::time::sleep(REAP_INTERVAL).await;
            for session_id in pick_reapable(&session_states().await, IDLE_TIMEOUT) {
                eprintln!("[opencode] reaping idle session {session_id}");
                close_session(&session_id).await;
            }
        }
    });
}

async fn close_session(session_id: &str) {
    // Anything waiting on the user can never be answered now — release it so the
    // dying process isn't blocked mid-teardown.
    deny_pending_for(session_id).await;
    if let Some(s) = registry().lock().await.remove(session_id) {
        if let Some(secret) = &s.proxy_secret {
            crate::opencode_proxy::unregister(secret).await;
        }
        let mut child = s.child.lock().await;
        let _ = child.start_kill();
    }
    // The session's opencode config is rewritten on every spawn, so leaving it behind
    // just accumulates one dead directory per chat the user ever opened.
    let _ = std::fs::remove_dir_all(config_home(session_id));
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
    model: Option<String>,
    api_base: Option<String>,
    workspace: Option<String>,
) -> Result<(), String> {
    if crate::opencode_installer::is_sandboxed() {
        return Err("Code isn't available in the sandboxed Mac App Store build.".to_string());
    }
    let workspace = workspace
        .map(PathBuf::from)
        .unwrap_or_else(|| resolve_workspace(&session_id));

    let prompt_text = last_user_text(&messages)
        .ok_or("no user message to send to opencode")?;

    // An on-device turn can sit silent for minutes the first time: opencode refreshes
    // the models.dev registry into ~/.cache/opencode/models.json, and the runtime loads
    // the model into memory. Both are one-off, but the chat would otherwise just hang
    // with no explanation — emit the hint BEFORE spawning so it lands immediately.
    if model.as_deref().map(|m| parse_model_spec(m).local).unwrap_or(false) {
        let _ = app.emit(
            "opencode:reasoning",
            json!({
                "generation_id": generation_id,
                "delta": "Warming up the on-device model — the first run can take a few minutes while it loads into memory.\n",
            }),
        );
    }

    let session =
        get_or_spawn(&app, &session_id, &tenant, &token, model, api_base, &workspace).await?;
    let _turn_guard = TurnGuard::new(session.clone());

    session.turn.lock().await.reset(generation_id.clone());

    let res = session
        .request(
            "session/prompt",
            json!({
                "sessionId": session.acp_session_id,
                "prompt": [ { "type": "text", "text": prompt_text } ]
            }),
        )
        .await;

    match res {
        Ok(result) => {
            let mut ts = session.turn.lock().await;
            // Flush the final throttled delta as one last token so the committed
            // message includes the tail — the last <TOKEN_EMIT_WINDOW of tokens lived
            // only in `pending_delta` and never shipped. Then signal done.
            if !ts.pending_delta.is_empty() {
                let _ = app.emit(
                    "ollama:token",
                    json!({
                        "generation_id": generation_id,
                        "token": ts.pending_delta,
                        "full_content": ts.full_content,
                    }),
                );
                ts.pending_delta.clear();
            }
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
    // Stop with a permission card open must not hang: deny it first, so opencode gets
    // its answer and the cancel can actually land.
    deny_pending_for(&session_id).await;
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

#[cfg(test)]
mod tests {
    use super::*;

    /// The one thing standing between the agent and unprompted access. A config that
    /// already says "allow" must not survive a spawn.
    #[test]
    fn every_operation_is_forced_back_to_ask() {
        let mut cfg: serde_json::Map<String, Value> = serde_json::from_str(
            r#"{
              "permission": { "edit": "allow", "bash": "allow", "read": "allow" },
              "model": "openai/gpt-4o"
            }"#,
        )
        .unwrap();

        enforce_permission_policy(&mut cfg);

        // The bare string covers every key opencode knows about — including `read`,
        // and including any it adds later.
        assert_eq!(cfg.get("permission").unwrap(), &json!("ask"));
        // Unrelated config is left alone.
        assert_eq!(cfg.get("model").unwrap(), "openai/gpt-4o");
    }

    /// Per-agent blocks override the top level, so an `allow` hidden in one would
    /// silently defeat the policy for that agent.
    #[test]
    fn per_agent_overrides_cannot_reopen_it() {
        let mut cfg: serde_json::Map<String, Value> = serde_json::from_str(
            r#"{
              "agent": {
                "build": { "permission": { "bash": "allow" }, "model": "x" },
                "plan": { "model": "y" }
              }
            }"#,
        )
        .unwrap();

        enforce_permission_policy(&mut cfg);

        let agents = cfg.get("agent").unwrap();
        assert!(
            agents["build"].get("permission").is_none(),
            "a per-agent permission override must not survive"
        );
        assert_eq!(agents["build"]["model"], "x", "the rest of the agent stays");
        assert_eq!(agents["plan"]["model"], "y");
    }

    /// A config with no `permission` key at all still gets one.
    #[test]
    fn a_config_without_a_policy_gains_one() {
        let mut cfg = serde_json::Map::new();
        enforce_permission_policy(&mut cfg);
        assert_eq!(cfg.get("permission").unwrap(), &json!("ask"));
    }

    fn state(id: &str, idle_secs: u64, busy: bool) -> SessionState {
        SessionState {
            session_id: id.to_string(),
            idle_for: Duration::from_secs(idle_secs),
            busy,
        }
    }

    /// Session ids are opaque backend strings. One containing a path separator must not
    /// be able to place a config directory outside the sessions folder.
    #[test]
    fn a_session_id_cannot_escape_its_config_directory() {
        for hostile in ["../../etc/passwd", "a/b/c", "..", "/absolute"] {
            let key = path_key(hostile);
            assert!(!key.contains('/'), "{hostile} -> {key}");
            assert!(!key.contains(".."), "{hostile} -> {key}");
            assert_eq!(Path::new(&key).components().count(), 1, "{hostile} -> {key}");
        }
    }

    /// Ids that sanitise to the same readable prefix must still get their own directory.
    #[test]
    fn ids_differing_only_in_stripped_characters_still_differ() {
        assert_ne!(path_key("a/b"), path_key("a:b"));
        assert_eq!(path_key("chat-1"), path_key("chat-1"), "and it is stable");
    }

    #[test]
    fn workspace_slugs_are_readable_and_unique() {
        let a = workspace_slug();
        let b = workspace_slug();
        assert_ne!(a, b);
        assert_eq!(a.matches('-').count(), 2, "adjective-noun-hex: {a}");
        assert!(
            a.chars().all(|c| c.is_ascii_alphanumeric() || c == '-'),
            "must be usable as a folder name: {a}"
        );
    }

    #[test]
    fn nothing_is_evicted_below_the_cap() {
        let states = vec![state("a", 900, false), state("b", 10, false)];
        assert_eq!(pick_eviction(&states, 5), None);
    }

    /// At the cap, the longest-untouched idle session goes — not the busiest, and not
    /// the one the user is actively using.
    #[test]
    fn eviction_takes_the_least_recently_used_idle_session() {
        let states = vec![
            state("busy-and-oldest", 900, true),
            state("idle-old", 600, false),
            state("idle-recent", 5, false),
        ];
        assert_eq!(
            pick_eviction(&states, 3),
            Some("idle-old".to_string()),
            "a busy session is spared even though it is the least recently used"
        );
    }

    /// All five mid-turn or awaiting an answer: something still has to give, or the new
    /// chat hangs — which is the bug this whole change exists to remove.
    #[test]
    fn eviction_falls_back_to_the_lru_when_everything_is_busy() {
        let states = vec![state("newer", 5, true), state("older", 500, true)];
        assert_eq!(pick_eviction(&states, 2), Some("older".to_string()));
    }

    #[test]
    fn reaping_takes_only_sessions_idle_past_the_timeout() {
        let states = vec![
            state("stale", 1_000, false),
            state("fresh", 10, false),
            state("exactly-at-timeout", 900, false),
        ];
        let reaped = pick_reapable(&states, Duration::from_secs(900));
        assert!(reaped.contains(&"stale".to_string()));
        assert!(reaped.contains(&"exactly-at-timeout".to_string()));
        assert!(!reaped.contains(&"fresh".to_string()));
    }

    /// A chat sitting on an unanswered prompt is idle by the clock. Killing it would
    /// take the question off the screen and strand the turn.
    #[test]
    fn reaping_spares_a_session_waiting_on_the_user() {
        let states = vec![state("awaiting-permission", 100_000, true)];
        assert!(pick_reapable(&states, Duration::from_secs(900)).is_empty());
    }
}
