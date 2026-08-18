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
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '-' || c == '_' {
                c
            } else {
                '_'
            }
        })
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

// ---------- OS sandbox for the opencode child ----------
//
// Write-allow-list confinement: the child sees the whole filesystem read-only
// and may WRITE only the enumerated set below — the session workspace, temp,
// the tool caches, opencode's own state — while credential dirs are hidden
// with fake read/write (reads see empty, writes land nowhere real). Reads stay
// open everywhere else (the child must read /usr, node, the managed binary,
// the skills dirs), and the network stays open (the loopback proxy and npm).

/// Write-allowed dirs, relative to `$HOME`, pre-created when missing
/// ([`ensure_write_dirs`]) — Code can't function without them. `.cache` is the
/// umbrella every XDG-caching tool shares (pip, pnpm, corepack, uv,
/// go-build…); `.local/share/opencode` is opencode's own state.
const WRITE_DIRS_CORE: &[&str] =
    &[".cache", ".npm", ".local/share/pnpm", ".local/share/opencode"];

/// macOS extras: the native caches root and the mac pnpm store.
// The macOS-arm items in this section stay compiled on every unix target so
// the unit tests can exercise them from Linux — hence the targeted dead_code
// allows.
#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
const WRITE_DIRS_CORE_MACOS: &[&str] = &["Library/Caches", "Library/pnpm"];

/// Toolchain dirs, writable only when already present — never created. Using
/// an installed toolchain works; installing one from scratch inside Code stays
/// blocked (read-only `$HOME`).
const WRITE_DIRS_TOOLCHAIN: &[&str] =
    &[".cargo", ".rustup", "go", ".bun", ".local/share/uv", ".pyenv"];

/// Credential dirs hidden from the child, relative to `$HOME`.
const SECRET_DIRS: &[&str] = &[
    ".ssh",
    ".gnupg",
    ".aws",
    ".azure",
    ".kube",
    ".docker",
    ".claude",
    ".config/gh",
    ".config/gcloud",
    ".config/op",
    ".password-store",
];
/// Platform extras: the GNOME keyring store / the macOS keychain files.
const SECRET_DIRS_LINUX: &[&str] = &[".local/share/keyrings"];
#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
const SECRET_DIRS_MACOS: &[&str] = &["Library/Keychains"];

/// Credential files hidden from the child, relative to `$HOME`.
const SECRET_FILES: &[&str] = &[
    ".netrc",
    ".npmrc",
    ".git-credentials",
    ".pypirc",
    ".claude.json",
    ".cargo/credentials.toml",
];

/// bwrap argv for the Linux sandbox — everything before the program name.
///
/// Order is the policy (later mounts win): the whole root read-only first,
/// `/dev` and `/proc` restored (shell redirects, `/dev/shm`), the write list
/// bound read-write over the ro root, and the secret masks stacked last — so a
/// credential file inside an allowed parent (`~/.cargo/credentials.toml`)
/// stays masked. A secret dir is masked with an empty tmpfs (reads see empty,
/// writes go to RAM and vanish); a secret file with `/dev/null`. Masks are
/// added only for paths that exist — bwrap would otherwise create the mount
/// point on the real filesystem — and `--bind-try` skips write dirs the host
/// doesn't have (toolchains are deliberately not pre-created).
fn bwrap_args(
    home: &Path,
    workspace: &Path,
    config_home: &Path,
    tmpdir: Option<&Path>,
) -> Vec<String> {
    let mut args: Vec<String> = vec![
        "--ro-bind".into(),
        "/".into(),
        "/".into(),
        "--dev-bind".into(),
        "/dev".into(),
        "/dev".into(),
        "--proc".into(),
        "/proc".into(),
    ];
    let mut rw_targets: Vec<PathBuf> = vec![
        workspace.to_path_buf(),
        PathBuf::from("/tmp"),
        PathBuf::from("/var/tmp"),
        config_home.to_path_buf(),
    ];
    if let Some(t) = tmpdir {
        if t != Path::new("/tmp") {
            rw_targets.push(t.to_path_buf());
        }
    }
    for rel in WRITE_DIRS_CORE {
        rw_targets.push(home.join(rel));
    }
    // Toolchains opt in by presence — an absent one stays read-only rather
    // than being advertised in the argv.
    for rel in WRITE_DIRS_TOOLCHAIN {
        let p = home.join(rel);
        if p.is_dir() {
            rw_targets.push(p);
        }
    }
    for target in &rw_targets {
        let p = target.to_string_lossy().into_owned();
        args.extend(["--bind-try".into(), p.clone(), p]);
    }
    for rel in SECRET_DIRS.iter().chain(SECRET_DIRS_LINUX) {
        let p = home.join(rel);
        if p.is_dir() {
            args.extend(["--tmpfs".into(), p.to_string_lossy().into_owned()]);
        }
    }
    for rel in SECRET_FILES {
        let p = home.join(rel);
        if p.is_file() {
            args.extend([
                "--ro-bind".into(),
                "/dev/null".into(),
                p.to_string_lossy().into_owned(),
            ]);
        }
    }
    // Killing the bwrap monitor (what `start_kill` hits) takes the sandboxed
    // opencode down with it, and both die if the app does.
    args.push("--die-with-parent".into());
    args
}

/// Pre-create the core write dirs so their rw binds (Linux) and the decoy's
/// symlinks (macOS) resolve on first use. Toolchain dirs are deliberately
/// left alone — absent means read-only.
fn ensure_write_dirs(home: &Path) {
    for rel in WRITE_DIRS_CORE {
        let _ = std::fs::create_dir_all(home.join(rel));
    }
    #[cfg(target_os = "macos")]
    for rel in WRITE_DIRS_CORE_MACOS {
        let _ = std::fs::create_dir_all(home.join(rel));
    }
}

/// Quote a path as an SBPL string literal (`\` and `"` escaped).
#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
fn sbpl_quote(p: &Path) -> String {
    let mut out = String::from("\"");
    for c in p.to_string_lossy().chars() {
        if c == '"' || c == '\\' {
            out.push('\\');
        }
        out.push(c);
    }
    out.push('"');
    out
}

/// SBPL profile for `sandbox-exec` on macOS: allow everything, deny ALL
/// writes, re-allow them for the write list, and deny the real credential
/// paths outright. Later rules win in SBPL, so the order IS the policy — the
/// trailing secrets deny keeps `~/.cargo/credentials.toml` blocked inside the
/// allowed `~/.cargo`.
///
/// sandbox-exec can only deny (EPERM) — the fake-empty view comes from the
/// decoy home ([`build_decoy_home`]); the secret denies are the enforcement
/// backstop for anything that reaches the real paths anyway (`getpwuid`,
/// symlink traversal — the kernel checks resolved paths).
#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
fn sandbox_profile_macos(home: &Path, workspace: &Path, config_home: &Path) -> String {
    let mut p = String::from(
        "(version 1)\n(allow default)\n(deny file-write* (subpath \"/\"))\n(allow file-write*",
    );
    // /dev: shell redirects and ttys; the tmp roots cover /tmp, /var/tmp and
    // the per-user $TMPDIR under /var/folders.
    for dir in ["/dev", "/private/tmp", "/private/var/tmp", "/private/var/folders"] {
        p.push_str("\n  (subpath ");
        p.push_str(&sbpl_quote(Path::new(dir)));
        p.push(')');
    }
    for abs in [workspace, config_home] {
        p.push_str("\n  (subpath ");
        p.push_str(&sbpl_quote(abs));
        p.push(')');
    }
    for rel in WRITE_DIRS_CORE
        .iter()
        .chain(WRITE_DIRS_CORE_MACOS)
        .chain(WRITE_DIRS_TOOLCHAIN)
    {
        p.push_str("\n  (subpath ");
        p.push_str(&sbpl_quote(&home.join(rel)));
        p.push(')');
    }
    p.push_str(")\n(deny file*");
    for rel in SECRET_DIRS.iter().chain(SECRET_DIRS_MACOS) {
        p.push_str("\n  (subpath ");
        p.push_str(&sbpl_quote(&home.join(rel)));
        p.push(')');
    }
    for rel in SECRET_FILES {
        p.push_str("\n  (literal ");
        p.push_str(&sbpl_quote(&home.join(rel)));
        p.push(')');
    }
    p.push_str(")\n");
    p
}

/// Seed the decoy `$HOME` the macOS child runs under.
///
/// Every top-level entry of the real home is symlinked into the decoy except
/// the secret list: a secret dir becomes a real empty writable dir (fake
/// read/write), a secret file is simply absent, and a parent that contains a
/// nested secret (`.config`, `.cargo`) is split into a real dir whose children
/// are linked individually. The decoy lives under `config_home(session)`, so
/// the existing close-time `remove_dir_all` cleans it up.
#[cfg(unix)]
#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
fn build_decoy_home(real_home: &Path, decoy: &Path) -> Result<(), String> {
    // Rebuild from scratch on respawn (`remove_dir_all` deletes symlinks,
    // never their targets).
    let _ = std::fs::remove_dir_all(decoy);
    let secret_dirs: Vec<PathBuf> = SECRET_DIRS
        .iter()
        .chain(SECRET_DIRS_MACOS)
        .map(PathBuf::from)
        .collect();
    let secret_files: Vec<PathBuf> = SECRET_FILES.iter().map(PathBuf::from).collect();
    populate_decoy(real_home, decoy, Path::new(""), &secret_dirs, &secret_files)
}

/// See [`build_decoy_home`]; `rel` is the subdir being populated (`""` at the top).
#[cfg(unix)]
#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
fn populate_decoy(
    real_home: &Path,
    decoy_root: &Path,
    rel: &Path,
    secret_dirs: &[PathBuf],
    secret_files: &[PathBuf],
) -> Result<(), String> {
    std::fs::create_dir_all(decoy_root.join(rel)).map_err(|e| format!("decoy home: {e}"))?;
    let real = real_home.join(rel);
    let entries = std::fs::read_dir(&real).map_err(|e| format!("decoy home: {e}"))?;
    for entry in entries.flatten() {
        let child_rel = rel.join(entry.file_name());
        if secret_dirs.contains(&child_rel) {
            std::fs::create_dir_all(decoy_root.join(&child_rel))
                .map_err(|e| format!("decoy home: {e}"))?;
        } else if secret_files.contains(&child_rel) {
            // Absent, not empty: tools probe for existence before reading.
        } else if secret_dirs
            .iter()
            .chain(secret_files.iter())
            .any(|s| s.starts_with(&child_rel) && s != &child_rel)
        {
            populate_decoy(real_home, decoy_root, &child_rel, secret_dirs, secret_files)?;
        } else {
            std::os::unix::fs::symlink(
                real.join(entry.file_name()),
                decoy_root.join(&child_rel),
            )
            .map_err(|e| format!("decoy home: {e}"))?;
        }
    }
    Ok(())
}

/// Whether the executable `name` sits on `path_var` — the bwrap preflight.
#[cfg(target_os = "linux")]
fn has_executable(path_var: &std::ffi::OsStr, name: &str) -> bool {
    use std::os::unix::fs::PermissionsExt;
    std::env::split_paths(path_var).any(|d| {
        d.join(name)
            .metadata()
            .map(|m| m.is_file() && m.permissions().mode() & 0o111 != 0)
            .unwrap_or(false)
    })
}

/// Is the OS sandbox available? Linux needs bubblewrap on PATH; macOS ships
/// `sandbox-exec`; Windows never spawns (Code is unsupported there).
pub fn sandbox_ready() -> bool {
    #[cfg(target_os = "linux")]
    return has_executable(&augmented_path(), "bwrap");
    #[allow(unreachable_code)]
    true
}

/// The sandboxed Command for a session's opencode spawn: the wrapper program
/// plus its sandbox argv, ending with the opencode program name. The caller
/// layers the ACP args, cwd, env and stdio on top unchanged.
fn sandboxed_opencode_command(_session_id: &str, workspace: &Path) -> Result<Command, String> {
    #[cfg(target_os = "linux")]
    {
        let home = home_dir().unwrap_or_default();
        ensure_write_dirs(&home);
        let tmpdir = std::env::var_os("TMPDIR").map(PathBuf::from);
        let mut cmd = create_command("bwrap");
        cmd.args(bwrap_args(
            &home,
            workspace,
            &config_home(_session_id),
            tmpdir.as_deref(),
        ));
        cmd.arg(opencode_program());
        return Ok(cmd);
    }
    #[cfg(target_os = "macos")]
    {
        let home = home_dir().unwrap_or_default();
        ensure_write_dirs(&home);
        // Named so `echo $HOME` doesn't give the game away.
        let fake_home = config_home(_session_id).join("code-mode-home");
        build_decoy_home(&home, &fake_home)?;
        let mut cmd = create_command("/usr/bin/sandbox-exec");
        cmd.args([
            "-p",
            &sandbox_profile_macos(&home, workspace, &config_home(_session_id)),
        ]);
        cmd.arg(opencode_program());
        // The fake layer: $HOME-respecting tools see the fake home; the SBPL
        // denies above catch anything that resolves the real one.
        cmd.env("HOME", fake_home);
        return Ok(cmd);
    }
    #[cfg(target_os = "windows")]
    {
        let _ = workspace;
        Err("Code isn't available on Windows.".to_string())
    }
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
    let out =
        serde_json::to_string_pretty(&Value::Object(map.clone())).map_err(|e| e.to_string())?;
    std::fs::write(&f, out).map_err(|e| format!("failed writing workspace map: {e}"))
}

/// A readable folder name for a new chat's workspace: `brave-otter-4f2a`.
///
/// Random rather than derived from the session id so the folder is pleasant to find in a
/// file manager; the map is what makes it durable. Entropy comes from the same source as
/// the proxy's session secret, so this needs no `rand` dependency.
fn workspace_slug() -> String {
    const ADJECTIVES: [&str; 16] = [
        "brave", "calm", "clever", "eager", "fuzzy", "gentle", "happy", "keen", "lively", "lucky",
        "merry", "quiet", "swift", "tidy", "warm", "wise",
    ];
    const NOUNS: [&str; 16] = [
        "otter", "falcon", "maple", "harbor", "lantern", "meadow", "pebble", "quartz", "raven",
        "river", "sparrow", "summit", "thicket", "willow", "canyon", "cedar",
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

/// An abandoned generated workspace: nothing in it beyond `.git` (and the
/// `.DS_Store` Finder litter). These are what a launch whose chat never wrote
/// anything leaves behind.
fn is_empty_project(dir: &Path) -> bool {
    match std::fs::read_dir(dir) {
        Ok(entries) => entries
            .flatten()
            .all(|e| e.file_name() == ".git" || e.file_name() == ".DS_Store"),
        Err(_) => false,
    }
}

/// The first (name-sorted, for determinism) recyclable workspace under `root`.
fn find_empty_workspace(root: &Path) -> Option<PathBuf> {
    let mut candidates: Vec<PathBuf> = std::fs::read_dir(root)
        .ok()?
        .flatten()
        .map(|e| e.path())
        .filter(|p| p.is_dir() && is_empty_project(p))
        .collect();
    candidates.sort();
    candidates.into_iter().next()
}

/// This chat's workspace, generating and recording one the first time it's asked for.
///
/// New chat = new workspace — but an untouched leftover (just `.git`) is
/// recycled instead of minting another dir on every app start, since sessions
/// aren't restored across launches and each launch would otherwise strand one
/// more empty folder. A dir with any real content is never shared.
pub fn resolve_workspace(session_id: &str) -> PathBuf {
    let mut map = read_workspace_map();
    if let Some(path) = map.get(session_id).and_then(|v| v.as_str()) {
        if !path.is_empty() {
            return PathBuf::from(path);
        }
    }
    let root = iblai_data_dir().join("workspaces");
    if let Some(dir) = find_empty_workspace(&root) {
        map.insert(session_id.to_string(), json!(dir.to_string_lossy()));
        let _ = write_workspace_map(&map);
        return dir;
    }
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

/// Move the ephemeral first-turn mapping onto the chat's real session id.
///
/// A brand-new chat's first turn runs under an SDK-minted `coding-new-*` key;
/// once the real id exists, the workspace must follow it or the chat splits
/// across two folders. On a successful adoption the remaining `coding-new-*`
/// entries are pruned too — those keys are per-app-run and never recur, and
/// the only live one is the chat being migrated right now. (The pruning must
/// NOT move into `resolve_workspace`: there it could yank the mapping out from
/// under a live unsaved chat mid-conversation.)
fn adopt_prior_mapping(
    map: &mut serde_json::Map<String, Value>,
    session_id: &str,
    prior: &str,
) -> bool {
    if map.contains_key(session_id) {
        return false; // a resumed chat already owns a folder — never overwrite
    }
    let Some(dir) = map.remove(prior) else {
        return false;
    };
    map.insert(session_id.to_string(), dir);
    map.retain(|k, _| !k.starts_with("coding-new-") || k == session_id);
    true
}

/// See [`adopt_prior_mapping`]; also reaps the ephemeral key's opencode
/// process — the same logical chat runs under its real id from here on.
async fn migrate_new_chat(session_id: &str, prior: &str) {
    let mut map = read_workspace_map();
    if adopt_prior_mapping(&mut map, session_id, prior) {
        let _ = write_workspace_map(&map);
    }
    close_session(prior).await;
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
pub async fn set_opencode_workspace(session_id: String, path: String) -> Result<String, String> {
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

/// One platform Agent Skill, fetched by the frontend (which owns API access and
/// auth) and materialised here as an opencode SKILL.md package. Binary `asset`
/// resources are not part of the payload — only text `script`/`reference` files —
/// and scripts land without an exec bit (the agent can still `sh <file>`).
#[derive(serde::Deserialize)]
pub struct SkillResourcePayload {
    pub filename: String,
    pub content: String,
}

#[derive(serde::Deserialize)]
pub struct SkillPayload {
    pub slug: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub instruction: String,
    #[serde(default)]
    pub resources: Vec<SkillResourcePayload>,
}

/// Where one mentor's synced Agent Skills live:
/// `~/.local/share/iblai/skills/mentors/<path_key(mentor)>`.
///
/// Keyed by MENTOR, not chat session: skills are mentor-level assignments, and the
/// first turn of a brand-new chat runs under an SDK-generated ephemeral session key
/// this app never sees, so a session-keyed dir could never cover it. Outside
/// `config_home` on purpose: `close_session` deletes that dir on every idle reap,
/// and skills must survive to the respawn.
pub fn mentor_skills_dir(mentor_unique_id: &str) -> PathBuf {
    iblai_data_dir()
        .join("skills")
        .join("mentors")
        .join(path_key(mentor_unique_id))
}

/// The shared iblai/vibe skills checkout, managed by
/// [`crate::opencode_installer::ensure_vibe_skills`]. Mentor-independent.
pub fn vibe_skills_dir() -> PathBuf {
    iblai_data_dir().join("skills").join("vibe")
}

/// A server-side skill slug reduced to a safe directory name that also satisfies
/// opencode's skill-name shape (lowercase, hyphenated). The name in SKILL.md is
/// this sanitised form, so the `/slug` token the composer inserts matches it.
fn sanitize_slug(slug: &str) -> String {
    let mapped: String = slug
        .to_lowercase()
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() { c } else { '-' })
        .take(64)
        .collect();
    let trimmed = mapped.trim_matches('-');
    if trimmed.is_empty() {
        "skill".to_string()
    } else {
        trimmed.to_string()
    }
}

/// A resource filename reduced to ONE safe path component, or `None` when it can't
/// name a file at all — or would clobber the SKILL.md manifest we just wrote.
fn sanitize_filename(name: &str) -> Option<String> {
    let cleaned: String = name
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || matches!(c, '.' | '_' | '-') {
                c
            } else {
                '_'
            }
        })
        .take(128)
        .collect();
    if cleaned.is_empty()
        || cleaned.chars().all(|c| c == '.')
        || cleaned.eq_ignore_ascii_case("skill.md")
    {
        return None;
    }
    Some(cleaned)
}

/// Compose a SKILL.md: YAML frontmatter (name + description) + the instruction body.
///
/// The description is embedded as a JSON string — every JSON string is a valid YAML
/// double-quoted scalar, which keeps arbitrary text (quotes, colons, newlines)
/// correct without a YAML dependency. An empty description falls back to the name:
/// opencode drops description-less skills from the model-visible listing entirely.
fn skill_md(name: &str, description: &str, instruction: &str) -> String {
    let desc = if description.trim().is_empty() {
        name
    } else {
        description
    };
    let quoted = Value::String(desc.to_string()).to_string();
    format!("---\nname: {name}\ndescription: {quoted}\n---\n\n{instruction}\n")
}

/// Materialise `skills` under `root`, replacing whatever was there — the full
/// rewrite is what makes removed assignments disappear. An empty list removes the
/// tree and does NOT recreate it: an absent dir is the "no skills" signal
/// `apply_skills_config` reads.
fn write_skills_tree(root: &Path, skills: &[SkillPayload]) -> Result<usize, String> {
    let _ = std::fs::remove_dir_all(root);
    if skills.is_empty() {
        return Ok(0);
    }
    let mut taken: Vec<String> = Vec::new();
    for skill in skills {
        let slug = sanitize_slug(&skill.slug);
        if taken.contains(&slug) {
            // Two payload slugs collapsing to one dir would silently interleave
            // their files; first wins.
            continue;
        }
        let dir = root.join(&slug);
        std::fs::create_dir_all(&dir).map_err(|e| format!("skill dir failed: {e}"))?;
        std::fs::write(
            dir.join("SKILL.md"),
            skill_md(&slug, &skill.description, &skill.instruction),
        )
        .map_err(|e| format!("SKILL.md write failed: {e}"))?;
        for res in &skill.resources {
            if let Some(name) = sanitize_filename(&res.filename) {
                std::fs::write(dir.join(name), &res.content)
                    .map_err(|e| format!("skill resource write failed: {e}"))?;
            }
        }
        taken.push(slug);
    }
    Ok(taken.len())
}

/// Reserved [`skills_syncs`] key for the shared vibe download.
pub const VIBE_SYNC_KEY: &str = "__vibe__";

/// Longest a spawn holds for an in-flight mentor sync — API pagination, not a
/// download, so a sync that outlives this is treated as crashed.
const SKILLS_SYNC_MAX_WAIT: Duration = Duration::from_secs(10);

/// Longest a spawn holds for the vibe download — a real ~28MB tarball on first run.
const VIBE_SYNC_MAX_WAIT: Duration = Duration::from_secs(120);

/// Skill syncs currently in flight, keyed by `path_key(mentor)` (plus
/// [`VIBE_SYNC_KEY`]). The spawn path waits on these so a Code session never
/// snapshots a half-written skills dir — opencode reads skills once per process.
fn skills_syncs() -> &'static Mutex<HashMap<String, Instant>> {
    static S: OnceLock<Mutex<HashMap<String, Instant>>> = OnceLock::new();
    S.get_or_init(|| Mutex::new(HashMap::new()))
}

/// Record an in-flight sync. Public: the vibe installer registers its download
/// under [`VIBE_SYNC_KEY`] through this too.
pub async fn begin_skills_sync_entry(key: String) {
    skills_syncs().lock().await.insert(key, Instant::now());
}

pub async fn end_skills_sync_entry(key: &str) {
    skills_syncs().lock().await.remove(key);
}

/// Wait (bounded) for an in-flight sync under `key`; returns immediately when there
/// is none. A 150ms poll instead of a Notify: the wait is rare (only while a sync
/// races a send) and seconds long, and polling has no missed-wakeup edge.
async fn await_skills_sync(key: &str, max_wait: Duration) {
    loop {
        {
            let mut map = skills_syncs().lock().await;
            let Some(started) = map.get(key) else { return };
            if started.elapsed() >= max_wait {
                // A sync that outlived its budget is dead — it must not gate
                // every future send.
                map.remove(key);
                return;
            }
        }
        tokio::time::sleep(Duration::from_millis(150)).await;
    }
}

/// Announce that a mentor-skills sync is starting: new spawns for this mentor hold
/// until `set_opencode_skills` lands (or the bounded wait expires — a crashed sync
/// must not gate sends forever).
#[command]
pub async fn begin_opencode_skills_sync(mentor_unique_id: String) -> Result<(), String> {
    begin_skills_sync_entry(path_key(&mentor_unique_id)).await;
    Ok(())
}

/// Materialise one mentor's Agent Skills for Code sessions.
///
/// `skills: Some(list)` rewrites the staging tree (an empty list clears it);
/// `None` only ends the in-flight sync WITHOUT touching the tree — the frontend's
/// error path, where a stale skill set beats a wrongly-emptied one.
#[command]
pub async fn set_opencode_skills(
    mentor_unique_id: String,
    skills: Option<Vec<SkillPayload>>,
) -> Result<String, String> {
    // One writer at a time: concurrent syncs (strict-mode double effects, quick
    // mentor switches) would race remove_dir_all against a sibling's writes.
    static WRITE_LOCK: OnceLock<Mutex<()>> = OnceLock::new();
    let _guard = WRITE_LOCK.get_or_init(|| Mutex::new(())).lock().await;

    let dir = mentor_skills_dir(&mentor_unique_id);
    let result = match &skills {
        Some(list) => write_skills_tree(&dir, list).map(|_| ()),
        None => Ok(()),
    };
    end_skills_sync_entry(&path_key(&mentor_unique_id)).await;
    result.map(|()| dir.to_string_lossy().to_string())
}

/// Point opencode at the skill sources that exist for this spawn: the shared vibe
/// checkout and the mentor's synced Agent Skills. Mentor staging comes LAST —
/// opencode resolves duplicate skill names last-wins, so an assigned skill
/// overrides a same-named vibe skill. Neither present → no `skills` key at all,
/// and a leftover one is dropped (the per-session config persists between spawns).
///
/// The ibl.ai guidance does NOT live here: the loopback proxy injects it as a
/// system message into skills-wired sessions' chat/completions calls (see
/// `opencode_proxy::inject_system_guidance`).
fn apply_skills_config(
    root: &mut serde_json::Map<String, Value>,
    vibe_dir: &Path,
    mentor_dir: Option<&Path>,
) {
    let mut paths: Vec<String> = Vec::new();
    if vibe_dir.is_dir() {
        paths.push(vibe_dir.to_string_lossy().to_string());
    }
    if let Some(dir) = mentor_dir {
        if dir.is_dir() {
            paths.push(dir.to_string_lossy().to_string());
        }
    }
    // Earlier iterations injected guidance via an `instructions` entry; drop
    // the key from any persisted per-session config that still carries it.
    root.remove("instructions");
    if paths.is_empty() {
        root.remove("skills");
    } else {
        root.insert("skills".to_string(), json!({ "paths": paths }));
    }
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
        PendingPermission {
            session_id: session_id.to_string(),
            tx,
        },
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
    let kind = update
        .get("sessionUpdate")
        .and_then(|k| k.as_str())
        .unwrap_or("");
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
        ModelSpec {
            provider: "ollama",
            model: rest.to_string(),
            local: true,
        }
    } else if let Some(rest) = model.strip_prefix("foundry/") {
        ModelSpec {
            provider: "foundry",
            model: rest.to_string(),
            local: true,
        }
    } else {
        ModelSpec {
            provider: "iblai",
            model: model.to_string(),
            local: false,
        }
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
    mentor: Option<&str>,
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
    // Skills the agent discovers at startup — see `apply_skills_config`.
    let mentor_dir = mentor.map(mentor_skills_dir);
    apply_skills_config(root, &vibe_skills_dir(), mentor_dir.as_deref());

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
#[allow(clippy::too_many_arguments)]
async fn spawn_session(
    app: &AppHandle,
    session_id: &str,
    tenant: &str,
    token: &str,
    model: Option<String>,
    api_base: Option<String>,
    workspace: &PathBuf,
    mentor: Option<String>,
    generation_id: &str,
) -> Result<Arc<Session>, String> {
    ensure_workspace(workspace)?;

    // Hold the spawn while skills are still landing on disk — this process will
    // snapshot its skills exactly once, so racing an in-flight sync would leave the
    // whole session skill-less. Bounded waits (a crashed sync must not gate sends
    // forever), and a hint so the pause isn't a silent hang — same pattern as the
    // local-model warmup note in `opencode_chat_stream`.
    let mentor_key = mentor.as_deref().map(path_key);
    let sync_in_flight = {
        let map = skills_syncs().lock().await;
        map.contains_key(VIBE_SYNC_KEY)
            || mentor_key.as_deref().is_some_and(|k| map.contains_key(k))
    };
    if sync_in_flight {
        let _ = app.emit(
            "opencode:reasoning",
            json!({ "generation_id": generation_id, "delta": "Preparing skills…\n" }),
        );
        await_skills_sync(VIBE_SYNC_KEY, VIBE_SYNC_MAX_WAIT).await;
        if let Some(key) = mentor_key.as_deref() {
            await_skills_sync(key, SKILLS_SYNC_MAX_WAIT).await;
        }
    }

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
        // Skills wired for this spawn → the proxy injects the ibl.ai guidance
        // as a system message into this session's chat/completions calls.
        let skills_wired = vibe_skills_dir().is_dir()
            || mentor
                .as_deref()
                .map(mentor_skills_dir)
                .is_some_and(|d| d.is_dir());
        crate::opencode_proxy::register(&secret, upstream, token.to_string(), skills_wired).await;
        (
            format!("http://127.0.0.1:{port}/v1"),
            secret.clone(),
            "ibl.ai",
            Some(secret),
        )
    };
    apply_opencode_model(
        session_id,
        mentor.as_deref(),
        &spec,
        &base_url,
        &api_key,
        display_name,
    )?;

    // Kernel confinement on top of the permission prompt in
    // `handle_permission_request`: the child spawns inside an OS sandbox — bwrap on
    // Linux, sandbox-exec + a decoy $HOME on macOS (see the sandbox section near
    // `bwrap_args`). `PATH` carries our managed `bin` dir so a downloaded opencode is
    // found when the system has none.
    let mut cmd = sandboxed_opencode_command(session_id, workspace)?;
    cmd.args(["acp", "--print-logs", "--log-level", "INFO"])
        .current_dir(workspace)
        .env("PATH", augmented_path())
        .env("XDG_CONFIG_HOME", config_home(session_id))
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .kill_on_drop(true);

    let mut child = cmd.spawn().map_err(|e| {
        if cfg!(target_os = "linux") {
            format!("failed to launch the sandboxed `opencode acp` (is bubblewrap (bwrap) installed?): {e}")
        } else {
            format!("failed to launch `opencode acp` (is opencode installed?): {e}")
        }
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
#[allow(clippy::too_many_arguments)]
async fn get_or_spawn(
    app: &AppHandle,
    session_id: &str,
    tenant: &str,
    token: &str,
    model: Option<String>,
    api_base: Option<String>,
    workspace: &PathBuf,
    mentor: Option<String>,
    generation_id: &str,
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
    let s = spawn_session(
        app,
        session_id,
        tenant,
        token,
        model,
        api_base,
        workspace,
        mentor,
        generation_id,
    )
    .await?;
    registry()
        .lock()
        .await
        .insert(session_id.to_string(), s.clone());
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
        let busy =
            s.active_turns.load(Ordering::SeqCst) > 0 || waiting.iter().any(|w| *w == session_id);
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
    // just accumulates one dead directory per chat the user ever opened. Synced Agent
    // Skills deliberately live elsewhere (`mentor_skills_dir`) — a reaped session
    // must find them again on respawn.
    let _ = std::fs::remove_dir_all(config_home(session_id));
}

/// Stream one Coding-Mode turn through opencode, emitting `ollama:*` +
/// `opencode:*` events keyed by `generation_id`.
#[command]
#[allow(clippy::too_many_arguments)]
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
    // Mentor UUID from the SDK's localStorage bridge — keys the synced Agent
    // Skills dir. Absent with an older SDK: vibe skills only, no sync wait.
    mentor: Option<String>,
    // The SDK's ephemeral first-turn key for this chat. When it differs from
    // `session_id`, the chat just gained its real id — migrate the first
    // turn's workspace (and reap its process) so the chat keeps ONE folder.
    // Absent with an older SDK: no migration.
    new_chat_key: Option<String>,
) -> Result<(), String> {
    if crate::opencode_installer::is_sandboxed() {
        return Err("Code isn't available in the sandboxed Mac App Store build.".to_string());
    }
    if cfg!(target_os = "windows") {
        return Err("Code isn't available on Windows.".to_string());
    }
    // Belt for the UI gate: on Linux the pill is disabled while bwrap is missing,
    // but a stale flag or an older frontend could still send.
    if !sandbox_ready() {
        return Err(
            "Code needs bubblewrap (bwrap) — install it with your package manager, then reopen the app."
                .to_string(),
        );
    }
    // BEFORE workspace resolution, so the real id resolves to the migrated dir.
    if let Some(prior) = new_chat_key.as_deref() {
        if prior != session_id {
            migrate_new_chat(&session_id, prior).await;
        }
    }
    let workspace = workspace
        .map(PathBuf::from)
        .unwrap_or_else(|| resolve_workspace(&session_id));

    let prompt_text = last_user_text(&messages).ok_or("no user message to send to opencode")?;

    // An on-device turn can sit silent for minutes the first time: opencode refreshes
    // the models.dev registry into ~/.cache/opencode/models.json, and the runtime loads
    // the model into memory. Both are one-off, but the chat would otherwise just hang
    // with no explanation — emit the hint BEFORE spawning so it lands immediately.
    if model
        .as_deref()
        .map(|m| parse_model_spec(m).local)
        .unwrap_or(false)
    {
        let _ = app.emit(
            "opencode:reasoning",
            json!({
                "generation_id": generation_id,
                "delta": "Warming up the on-device model — the first run can take a few minutes while it loads into memory.\n",
            }),
        );
    }

    let session = get_or_spawn(
        &app,
        &session_id,
        &tenant,
        &token,
        model,
        api_base,
        &workspace,
        mentor,
        &generation_id,
    )
    .await?;
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
            assert_eq!(
                Path::new(&key).components().count(),
                1,
                "{hostile} -> {key}"
            );
        }
    }

    /// Ids that sanitise to the same readable prefix must still get their own directory.
    #[test]
    fn ids_differing_only_in_stripped_characters_still_differ() {
        assert_ne!(path_key("a/b"), path_key("a:b"));
        assert_eq!(path_key("chat-1"), path_key("chat-1"), "and it is stable");
    }

    /// The sandbox argv is a write allow-list: the whole root read-only first,
    /// /dev and /proc restored, only the enumerated dirs bound read-write, and
    /// the secret masks stacked last — later mounts win in bwrap, so this
    /// order IS the policy (the masks must beat the rw binds so
    /// `~/.cargo/credentials.toml` stays blocked inside the allowed `.cargo`).
    #[test]
    fn the_bwrap_policy_is_a_write_allow_list() {
        let scratch =
            std::env::temp_dir().join(format!("opencode-sbx-bwrap-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&scratch);
        let home = scratch.join("home");
        let workspace = scratch.join("ws");
        let cfg_home = scratch.join("cfg");
        std::fs::create_dir_all(home.join(".ssh")).unwrap();
        // An installed toolchain opts in; .bun is deliberately absent.
        std::fs::create_dir_all(home.join(".cargo")).unwrap();
        std::fs::write(home.join(".netrc"), "machine x").unwrap();

        let args = bwrap_args(&home, &workspace, &cfg_home, None);
        let flat = args.join(" ");

        assert_eq!(&args[..3], &["--ro-bind", "/", "/"]);
        assert!(flat.contains("--dev-bind /dev /dev"));
        assert!(flat.contains("--proc /proc"));

        let rw = |p: &Path| format!("--bind-try {} {}", p.display(), p.display());
        assert!(flat.contains(&rw(&workspace)));
        assert!(flat.contains(&rw(Path::new("/tmp"))));
        assert!(flat.contains(&rw(&cfg_home)));
        assert!(flat.contains(&rw(&home.join(".cache"))), "core cache allowed");
        assert!(
            flat.contains(&rw(&home.join(".cargo"))),
            "present toolchain allowed"
        );
        assert!(!flat.contains(".bun"), "absent toolchain not advertised");

        // Masks stack AFTER the rw binds and only for existing secrets.
        let ssh_mask = format!("--tmpfs {}", home.join(".ssh").display());
        assert!(flat.contains(&ssh_mask));
        assert!(flat.rfind(&ssh_mask).unwrap() > flat.rfind("--bind-try").unwrap());
        let netrc = home.join(".netrc");
        assert!(flat.contains(&format!("--ro-bind /dev/null {}", netrc.display())));
        assert!(!flat.contains(".aws"), "missing secrets get no mask");
        assert_eq!(args.last().unwrap(), "--die-with-parent");

        // A custom $TMPDIR is bound too.
        let with_tmp =
            bwrap_args(&home, &workspace, &cfg_home, Some(Path::new("/custom/tmp"))).join(" ");
        assert!(with_tmp.contains("--bind-try /custom/tmp /custom/tmp"));

        let _ = std::fs::remove_dir_all(&scratch);
    }

    /// The macOS decoy home fakes the credential dirs: real entries stay
    /// reachable through symlinks, secret dirs exist but are empty and writable
    /// (writes evaporate with the session), secret files are absent, and a
    /// parent holding a nested secret is split rather than symlinked wholesale.
    #[test]
    #[cfg(unix)]
    fn the_decoy_home_fakes_secrets_and_links_the_rest() {
        let scratch =
            std::env::temp_dir().join(format!("opencode-sbx-decoy-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&scratch);
        let real = scratch.join("real");
        let decoy = scratch.join("decoy");
        std::fs::create_dir_all(real.join(".ssh")).unwrap();
        std::fs::write(real.join(".ssh/id_ed25519"), "SECRET").unwrap();
        std::fs::write(real.join(".netrc"), "machine x login y").unwrap();
        std::fs::write(real.join(".gitconfig"), "[user]\nname = dev").unwrap();
        std::fs::create_dir_all(real.join(".config/gh")).unwrap();
        std::fs::write(real.join(".config/gh/hosts.yml"), "oauth_token: t").unwrap();
        std::fs::create_dir_all(real.join(".config/nvim")).unwrap();
        std::fs::create_dir_all(real.join("projects")).unwrap();

        build_decoy_home(&real, &decoy).unwrap();

        // Fake .ssh: a real empty dir, writable, host untouched.
        let ssh = decoy.join(".ssh");
        assert!(ssh.is_dir() && !ssh.is_symlink());
        assert_eq!(std::fs::read_dir(&ssh).unwrap().count(), 0);
        std::fs::write(ssh.join("planted"), "x").unwrap();
        assert!(!real.join(".ssh/planted").exists());

        // Secret files are absent; ordinary entries are symlinks to the real home.
        assert!(!decoy.join(".netrc").exists());
        assert!(decoy.join(".gitconfig").is_symlink());
        assert!(decoy.join("projects").is_symlink());

        // .config holds a nested secret, so it is split: gh faked, nvim linked.
        let cfg = decoy.join(".config");
        assert!(cfg.is_dir() && !cfg.is_symlink());
        assert!(cfg.join("gh").is_dir() && !cfg.join("gh").is_symlink());
        assert_eq!(std::fs::read_dir(cfg.join("gh")).unwrap().count(), 0);
        assert!(cfg.join("nvim").is_symlink());

        let _ = std::fs::remove_dir_all(&scratch);
    }

    /// The macOS profile is a write allow-list with the secrets denied last:
    /// default-allow, ALL writes denied, the enumerated dirs re-allowed, and
    /// the real credential paths hard-denied — later rules win in SBPL, so the
    /// trailing deny keeps `~/.cargo/credentials.toml` blocked inside the
    /// allowed `~/.cargo`.
    #[test]
    fn the_macos_profile_is_a_write_allow_list_with_secrets_denied_last() {
        let p = sandbox_profile_macos(
            Path::new("/Users/dev"),
            Path::new("/Users/dev/proj"),
            Path::new("/Users/dev/.config/iblai/agents/sessions/k"),
        );
        assert!(p.starts_with(
            "(version 1)\n(allow default)\n(deny file-write* (subpath \"/\"))"
        ));
        assert!(p.contains("(allow file-write*"));
        assert!(p.contains("(subpath \"/dev\")"));
        assert!(p.contains("(subpath \"/private/var/folders\")"));
        assert!(p.contains("(subpath \"/Users/dev/proj\")"));
        assert!(p.contains("(subpath \"/Users/dev/.config/iblai/agents/sessions/k\")"));
        assert!(p.contains("(subpath \"/Users/dev/.cache\")"));
        assert!(p.contains("(subpath \"/Users/dev/Library/Caches\")"));
        assert!(p.contains("(subpath \"/Users/dev/.cargo\")"));
        assert!(p.contains("(deny file*"));
        assert!(p.contains("(subpath \"/Users/dev/.ssh\")"));
        assert!(p.contains("(subpath \"/Users/dev/Library/Keychains\")"));
        assert!(p.contains("(literal \"/Users/dev/.netrc\")"));
        assert!(p.contains("(literal \"/Users/dev/.cargo/credentials.toml\")"));
        // Later rules win: the secrets deny must come after the write allows.
        assert!(p.find("(deny file*").unwrap() > p.find("(allow file-write*").unwrap());
    }

    /// A home path containing SBPL string metacharacters cannot break out of
    /// its quoted literal.
    #[test]
    fn sbpl_paths_with_quotes_stay_quoted() {
        assert_eq!(
            sbpl_quote(Path::new(r#"/Users/a"b\c"#)),
            r#""/Users/a\"b\\c""#
        );
    }

    /// bwrap detection wants an executable file on PATH — a missing or
    /// non-executable bwrap reads as "sandbox not ready" up front instead of
    /// failing at spawn time.
    #[test]
    #[cfg(target_os = "linux")]
    fn bwrap_detection_requires_an_executable_on_path() {
        use std::os::unix::fs::PermissionsExt;
        let scratch =
            std::env::temp_dir().join(format!("opencode-sbx-path-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&scratch);
        std::fs::create_dir_all(&scratch).unwrap();
        let path_var: std::ffi::OsString = scratch.clone().into();

        assert!(!has_executable(&path_var, "bwrap"), "empty dir");

        let bin = scratch.join("bwrap");
        std::fs::write(&bin, "#!/bin/sh\n").unwrap();
        std::fs::set_permissions(&bin, std::fs::Permissions::from_mode(0o644)).unwrap();
        assert!(!has_executable(&path_var, "bwrap"), "not executable");

        std::fs::set_permissions(&bin, std::fs::Permissions::from_mode(0o755)).unwrap();
        assert!(has_executable(&path_var, "bwrap"));

        let _ = std::fs::remove_dir_all(&scratch);
    }

    /// Untouched workspaces (nothing beyond `.git`/`.DS_Store`) are
    /// recyclable; anything with real content is not — a new chat must never
    /// be handed a folder that already has someone's work in it.
    #[test]
    fn only_untouched_workspaces_are_recycled() {
        let root = std::env::temp_dir().join(format!("opencode-ws-recycle-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&root);
        let empty = root.join("a-empty");
        std::fs::create_dir_all(empty.join(".git")).unwrap();
        std::fs::write(empty.join(".DS_Store"), b"finder litter").unwrap();
        let dirty = root.join("b-dirty");
        std::fs::create_dir_all(dirty.join(".git")).unwrap();
        std::fs::write(dirty.join("notes.txt"), b"work").unwrap();
        let bare = root.join("c-bare");
        std::fs::create_dir_all(&bare).unwrap();

        assert!(is_empty_project(&empty), "only .git + .DS_Store is untouched");
        assert!(!is_empty_project(&dirty), "real content disqualifies");
        assert!(is_empty_project(&bare), "a bare dir (git init pending) counts");
        assert!(!is_empty_project(&root.join("missing")));

        // Name-sorted first candidate, deterministically.
        assert_eq!(find_empty_workspace(&root), Some(empty));
        assert_eq!(find_empty_workspace(&root.join("missing")), None);

        let _ = std::fs::remove_dir_all(&root);
    }

    /// The first-turn mapping follows the chat onto its real session id, and
    /// the stale per-run ephemeral keys are pruned with it.
    #[test]
    fn the_workspace_follows_a_new_chat_to_its_real_id() {
        let mut map = serde_json::Map::new();
        map.insert("coding-new-1".into(), json!("/ws/a"));
        map.insert("coding-new-0".into(), json!("/ws/old"));
        map.insert("chat-real".into(), json!("/ws/keep"));

        assert!(adopt_prior_mapping(&mut map, "s-new", "coding-new-1"));
        assert_eq!(
            map.get("s-new").and_then(|v| v.as_str()),
            Some("/ws/a"),
            "the real id owns the first turn's folder"
        );
        assert!(!map.contains_key("coding-new-1"));
        assert!(
            !map.contains_key("coding-new-0"),
            "stale per-run keys are pruned"
        );
        assert_eq!(
            map.get("chat-real").and_then(|v| v.as_str()),
            Some("/ws/keep"),
            "real keys are untouched"
        );
    }

    /// No adoption when the real id already owns a folder (a resumed chat) or
    /// when there is nothing to adopt — and a no-op prunes nothing.
    #[test]
    fn adoption_never_overwrites_or_fires_blind() {
        let mut map = serde_json::Map::new();
        map.insert("s-real".into(), json!("/ws/mine"));
        map.insert("coding-new-1".into(), json!("/ws/a"));

        assert!(!adopt_prior_mapping(&mut map, "s-real", "coding-new-1"));
        assert_eq!(
            map.get("s-real").and_then(|v| v.as_str()),
            Some("/ws/mine"),
            "an owned folder is never overwritten"
        );
        assert!(map.contains_key("coding-new-1"), "a no-op prunes nothing");

        let mut empty = serde_json::Map::new();
        assert!(!adopt_prior_mapping(&mut empty, "s", "coding-new-x"));
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

    /// A fresh scratch dir per test, removed on drop (best-effort) — mirrors the
    /// installer tests' helper.
    struct Scratch(PathBuf);
    impl Scratch {
        fn new(name: &str) -> Self {
            let dir = std::env::temp_dir()
                .join(format!("opencode-acp-test-{}-{name}", std::process::id()));
            let _ = std::fs::remove_dir_all(&dir);
            std::fs::create_dir_all(&dir).unwrap();
            Scratch(dir)
        }
        fn path(&self) -> &Path {
            &self.0
        }
    }
    impl Drop for Scratch {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }

    fn payload(slug: &str, resources: Vec<SkillResourcePayload>) -> SkillPayload {
        SkillPayload {
            slug: slug.to_string(),
            description: format!("{slug} description"),
            instruction: format!("Use {slug}."),
            resources,
        }
    }

    /// Slugs and filenames come from the backend. Neither may name anything outside
    /// the skill's own directory.
    #[test]
    fn a_hostile_slug_or_filename_cannot_escape_the_skills_dir() {
        for hostile in ["../../etc/passwd", "a/b/c", "..", "/absolute", "", "a\\b"] {
            let slug = sanitize_slug(hostile);
            assert!(!slug.is_empty(), "{hostile:?} -> {slug:?}");
            assert!(
                slug.chars()
                    .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-'),
                "{hostile:?} -> {slug:?}"
            );
            assert_eq!(Path::new(&slug).components().count(), 1);
        }
        for (name, expect_none) in [
            ("", true),
            (".", true),
            ("..", true),
            ("SKILL.md", true),
            ("skill.MD", true),
            ("../../etc/passwd", false),
            ("a/b.py", false),
            ("..\\up.txt", false),
        ] {
            match sanitize_filename(name) {
                None => assert!(expect_none, "{name:?} should have produced a name"),
                Some(clean) => {
                    assert!(!expect_none, "{name:?} should have been rejected");
                    assert!(!clean.contains('/') && !clean.contains('\\'), "{clean:?}");
                    assert_eq!(Path::new(&clean).components().count(), 1, "{clean:?}");
                }
            }
        }
    }

    /// The staging tree is a full rewrite: what's not in this sync no longer exists,
    /// and an empty sync removes the tree itself (absent dir = "no skills").
    #[test]
    fn a_rewrite_removes_deselected_skills() {
        let s = Scratch::new("rewrite");
        let root = s.path().join("mentor-a");

        write_skills_tree(&root, &[payload("alpha", vec![]), payload("beta", vec![])]).unwrap();
        assert!(root.join("alpha/SKILL.md").exists());
        assert!(root.join("beta/SKILL.md").exists());

        write_skills_tree(&root, &[payload("beta", vec![])]).unwrap();
        assert!(!root.join("alpha").exists(), "deselected skill must vanish");
        assert!(root.join("beta/SKILL.md").exists());

        write_skills_tree(&root, &[]).unwrap();
        assert!(!root.exists(), "an empty sync removes the tree entirely");
    }

    /// Frontmatter must survive hostile descriptions — quotes, colons, newlines —
    /// and a missing description falls back to the name (opencode hides
    /// description-less skills from the model).
    #[test]
    fn skill_md_frontmatter_is_well_formed() {
        let md = skill_md("web-research", "He said: \"hi\"\nand left", "Body text.");
        assert!(md.starts_with("---\nname: web-research\n"));
        assert!(
            md.contains(r#"description: "He said: \"hi\"\nand left""#),
            "JSON-quoted scalar keeps YAML valid: {md}"
        );
        assert!(md.ends_with("---\n\nBody text.\n"));

        let fallback = skill_md("web-research", "   ", "x");
        assert!(fallback.contains("description: \"web-research\""));
    }

    /// The config only points at skill dirs that exist, mentor staging last (so an
    /// assigned skill beats a same-named vibe skill), and stale `skills` /
    /// `instructions` keys from previous spawns (or the retired file/route
    /// guidance attempts) are dropped.
    #[test]
    fn apply_skills_config_tracks_existing_dirs() {
        let s = Scratch::new("skills-config");
        let vibe = s.path().join("vibe");
        let mentor = s.path().join("mentor");
        let mut cfg = serde_json::Map::new();
        // A persisted config from the retired instructions-based approach.
        cfg.insert("instructions".to_string(), json!(["http://stale"]));

        apply_skills_config(&mut cfg, &vibe, Some(&mentor));
        assert!(cfg.get("skills").is_none(), "nothing on disk → no key");
        assert!(
            cfg.get("instructions").is_none(),
            "a stale instructions entry is always dropped"
        );

        std::fs::create_dir_all(&vibe).unwrap();
        apply_skills_config(&mut cfg, &vibe, Some(&mentor));
        assert_eq!(
            cfg["skills"]["paths"],
            json!([vibe.to_string_lossy()]),
            "vibe only"
        );

        std::fs::create_dir_all(&mentor).unwrap();
        apply_skills_config(&mut cfg, &vibe, Some(&mentor));
        assert_eq!(
            cfg["skills"]["paths"],
            json!([vibe.to_string_lossy(), mentor.to_string_lossy()]),
            "mentor last: duplicate names resolve last-wins in opencode"
        );

        apply_skills_config(&mut cfg, &vibe, None);
        assert_eq!(cfg["skills"]["paths"], json!([vibe.to_string_lossy()]));

        std::fs::remove_dir_all(&vibe).unwrap();
        apply_skills_config(&mut cfg, &vibe, None);
        assert!(
            cfg.get("skills").is_none(),
            "a leftover key from a previous spawn is removed"
        );
    }

    /// A resource that sanitises to the manifest's own name must not clobber it,
    /// and two slugs collapsing to one directory keep the first skill intact.
    #[test]
    fn the_manifest_cannot_be_clobbered_and_duplicate_slugs_first_win() {
        let s = Scratch::new("clobber");
        let root = s.path().join("mentor-b");

        let mut evil = payload("alpha", vec![]);
        evil.resources = vec![
            SkillResourcePayload {
                filename: "skill.md".to_string(),
                content: "not the manifest".to_string(),
            },
            SkillResourcePayload {
                filename: "notes.txt".to_string(),
                content: "kept".to_string(),
            },
        ];
        let mut second = payload("Alpha!", vec![]);
        second.description = "the impostor".to_string();

        let written = write_skills_tree(&root, &[evil, second]).unwrap();
        assert_eq!(written, 1, "Alpha! collapses to alpha → first wins");

        let manifest = std::fs::read_to_string(root.join("alpha/SKILL.md")).unwrap();
        assert!(
            manifest.contains("alpha description"),
            "manifest is ours, not the resource's: {manifest}"
        );
        assert_eq!(
            std::fs::read_to_string(root.join("alpha/notes.txt")).unwrap(),
            "kept"
        );
    }

    /// The spawn-side wait: no entry → immediate; a live entry holds; `end` (what
    /// `set_opencode_skills` does for `Some` and `None` alike) releases; an entry
    /// past its budget is treated as crashed and cleaned up.
    #[tokio::test]
    async fn a_spawn_waits_only_while_a_sync_is_in_flight() {
        let key = format!("test-sync-{}", std::process::id());

        // No entry: returns immediately.
        await_skills_sync(&key, Duration::from_secs(5)).await;

        // Entry present, ended while waiting: released promptly.
        begin_skills_sync_entry(key.clone()).await;
        let done = {
            let key = key.clone();
            tokio::spawn(async move {
                tokio::time::sleep(Duration::from_millis(50)).await;
                end_skills_sync_entry(&key).await;
            })
        };
        let start = Instant::now();
        await_skills_sync(&key, Duration::from_secs(5)).await;
        assert!(start.elapsed() < Duration::from_secs(2));
        done.await.unwrap();

        // Entry past its budget: removed instead of gating future sends.
        begin_skills_sync_entry(key.clone()).await;
        await_skills_sync(&key, Duration::ZERO).await;
        assert!(
            !skills_syncs().lock().await.contains_key(&key),
            "an expired entry must be cleaned up"
        );
    }
}
