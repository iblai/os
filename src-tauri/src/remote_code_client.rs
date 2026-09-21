//! Phone-side Code: the `opencode_*` Tauri commands, reimplemented as proxies
//! to a paired desktop's `opencode serve` (see `remote_code.rs` for the
//! desktop half).
//!
//! iOS cannot spawn opencode, so instead of the desktop's child-process ACP
//! session, a turn here is: ensure a server session for the chat, subscribe
//! the server's SSE event stream, POST the prompt, and translate the events
//! back into the EXACT Tauri events the SDK already listens for
//! (`ollama:token/done/error`, `opencode:reasoning/tool_call/
//! permission_request/permission_resolved`) with the desktop's payload shapes.
//! The frontend cannot tell the difference — which is the whole point.
//!
//! Compiled on every platform so the translation layer is testable on the
//! host (the tests stand up a fake opencode server); the commands are only
//! registered on mobile.

use std::collections::{HashMap, HashSet};
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Mutex, OnceLock};

use futures_util::{StreamExt, TryStreamExt};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::command;
#[cfg(any(target_os = "ios", target_os = "android"))]
use tauri::AppHandle;

/// Where the pairing (and per-chat session map) persists. Set once at app
/// setup on mobile; absent on desktop, where none of this is registered.
static CONFIG_PATH: OnceLock<PathBuf> = OnceLock::new();

/// Pending permission requests: opencode permission id → its server session
/// id, so `opencode_permission_respond` can address the reply.
static PENDING_PERMISSIONS: Mutex<Option<HashMap<String, String>>> = Mutex::new(None);

/// `"auto"` short-circuits permission events with an immediate allow, exactly
/// like the desktop's auto mode. Kept in the config file; defaults to manual.
const MODE_AUTO: &str = "auto";
const MODE_MANUAL: &str = "manual";

/// Hard cap on one turn; a phone must never hold an SSE stream forever.
const TURN_TIMEOUT_SECS: u64 = 30 * 60;

/// opencode's `/event` stream sends a `server.heartbeat` every 10 s, so a
/// stream that delivered NOTHING for this long is dead even when the socket
/// has not said so. A phone waking from the lock screen holds exactly such
/// a connection: the network dropped it while the app was suspended and no
/// FIN ever arrives, so a plain read would hang until the turn deadline.
const STREAM_STALL_SECS: u64 = 30;
/// How long a turn keeps trying to get its event stream back before giving
/// up — consecutive failures only; a successful reopen resets it. Wi-Fi
/// takes a few seconds to re-associate after an unlock, so this must cover
/// more than one attempt.
const RECONNECT_WINDOW_SECS: u64 = 120;

/// Bumped every time the app comes back to the foreground (mobile
/// `WindowEvent::Resumed`). A turn whose stream predates the current epoch
/// was suspended mid-turn: iOS/Android reclaim a suspended app's sockets, so
/// it reconnects at once instead of waiting for the dead socket to time out.
static FOREGROUND_EPOCH: AtomicU64 = AtomicU64::new(0);

/// Called from the app's run loop on every foreground transition.
pub fn app_resumed() {
    FOREGROUND_EPOCH.fetch_add(1, Ordering::SeqCst);
}

#[derive(Serialize, Deserialize, Default, Clone)]
struct HostConfig {
    url: Option<String>,
    password: Option<String>,
    /// Companion workspace-management base URL (see desktop `companion_router`).
    #[serde(default)]
    mgmt: Option<String>,
    /// Every other candidate base URL from the pairing payload — a desktop
    /// with several network interfaces advertises one address per interface.
    /// When the primary stops answering, `remote_code_get_host` retries
    /// these and promotes whichever answers, so one pairing survives the
    /// reachable path changing.
    #[serde(default)]
    alt_urls: Vec<String>,
    /// Companion-URL candidates matching `alt_urls`, kept for re-probing
    /// after a promotion.
    #[serde(default)]
    alt_mgmt: Vec<String>,
    #[serde(default)]
    permission_mode: Option<String>,
    /// chat session id → opencode server session id.
    #[serde(default)]
    sessions: HashMap<String, String>,
    /// chat session id → desktop directory the chat's sessions run in.
    /// Absent = the server's default project (the shared phone workspace).
    #[serde(default)]
    directories: HashMap<String, String>,
    /// chat session id → the desktop directory its server session was
    /// CREATED in. When the chat's resolved directory later differs (the
    /// mentor's folder changed from another chat), the session must be
    /// recreated there: opencode scopes events and status per directory, so
    /// a session living in the old folder is invisible to a turn scoped to
    /// the new one.
    #[serde(default)]
    session_dirs: HashMap<String, String>,
    /// "tenant::mentor" → directory. Preferred over the per-chat entry, like
    /// the desktop's mentor workspaces: chat session ids CHANGE (an unsaved
    /// chat's ephemeral id becomes real after the first send), and keying by
    /// mentor is what makes a chosen folder survive that.
    #[serde(default)]
    mentor_directories: HashMap<String, String>,
    /// Server session → project directory ("" = the server default) of
    /// every turn this app has running right now. Written when a turn
    /// starts and removed when it ends, so an entry still here at the next
    /// launch means the app died mid-turn (force-quit from the app
    /// switcher, or killed) — see [`abort_abandoned_turns`].
    #[serde(default)]
    in_flight: HashMap<String, String>,
}

/// A turn's entry in the config's `in_flight` map, held for the turn's
/// lifetime: dropping it — on any exit from the turn, errors included —
/// removes the entry.
struct InFlight(String);

impl InFlight {
    fn mark(remote: &str, dir: Option<&str>) -> Self {
        let mut cfg = read_config();
        cfg.in_flight
            .insert(remote.to_string(), dir.unwrap_or("").to_string());
        let _ = write_config(&cfg);
        Self(remote.to_string())
    }
}

impl Drop for InFlight {
    fn drop(&mut self) {
        let mut cfg = read_config();
        if cfg.in_flight.remove(&self.0).is_some() {
            let _ = write_config(&cfg);
        }
    }
}

/// Stop, on the desktop, every turn the previous run of this app left
/// running: the app was force-quit or killed mid-turn, so nobody sees the
/// agent's output any more and nobody can answer its permissions — better
/// to end it than to let it work on unwatched. A turn the desktop already
/// finished is simply forgotten. Best-effort: the desktop may be away.
///
/// A suspended app (lock screen, app switcher) is NOT this case: its turn
/// reconnects and catches up when the app returns (see `run_turn_inner`).
pub async fn abort_abandoned_turns() {
    let cfg = read_config();
    if cfg.in_flight.is_empty() {
        return;
    }
    let abandoned = cfg.in_flight.clone();
    if let (Some(base), Some(pw)) = (cfg.url.as_deref(), cfg.password.as_deref()) {
        for (remote, dir) in &abandoned {
            let dir = (!dir.is_empty()).then_some(dir.as_str());
            let status = get_json(base, pw, &scoped("/session/status", dir)).await;
            if matches!(
                classify_probe(status, remote),
                ProbeVerdict::Busy | ProbeVerdict::Retry
            ) {
                println!("[RemoteCode] stopping turn {remote}, abandoned when the app was closed");
                let _ = post_json(base, pw, &format!("/session/{remote}/abort"), &json!({})).await;
            }
        }
    }
    // Forget only what was handled: a turn started while the desktop was
    // being asked is this run's, and stays recorded.
    let mut cfg = read_config();
    for remote in abandoned.keys() {
        cfg.in_flight.remove(remote);
    }
    let _ = write_config(&cfg);
}

/// Coalesces streamed token deltas so the webview re-renders at a bounded
/// rate instead of once per token. Same policy as the remote-code turn loop:
/// the FIRST delta flushes immediately (fast perceived start), later ones
/// batch inside an adaptive window that stretches from 200ms toward 1s as
/// the reply grows — re-rendering a long markdown message is what actually
/// costs, so the bigger the message, the calmer the stream. Used by the
/// embedded local-LLM chat stream (`ollama_chat_stream`), where unthrottled
/// per-token emits (each carrying the ever-growing full content) drowned
/// phone webviews until iOS killed the app.
pub(crate) struct TokenCoalescer {
    full: String,
    pending: String,
    last_flush: Option<std::time::Instant>,
    /// Passthrough mode: every push flushes immediately — behaviorally
    /// identical to no coalescer at all. Desktop local-model streaming uses
    /// this: it never had a problem, and its event cadence must not change.
    /// Only phones (where the webview drowned) get the batching windows.
    passthrough: bool,
}

impl TokenCoalescer {
    pub(crate) fn new() -> Self {
        Self {
            full: String::new(),
            pending: String::new(),
            last_flush: None,
            passthrough: false,
        }
    }

    /// A coalescer that never holds anything back — see `passthrough` field.
    pub(crate) fn passthrough() -> Self {
        Self {
            passthrough: true,
            ..Self::new()
        }
    }

    fn window(&self) -> std::time::Duration {
        let extra_ms = (self.full.len() / 4096) as u64 * 100;
        std::time::Duration::from_millis((200 + extra_ms).min(1000))
    }

    /// Append a delta; returns the batched delta to emit when a flush is due
    /// (always due on the very first delta).
    pub(crate) fn push(&mut self, delta: &str) -> Option<String> {
        self.full.push_str(delta);
        self.pending.push_str(delta);
        let due = self.passthrough
            || match self.last_flush {
                None => true,
                Some(t) => t.elapsed() >= self.window(),
            };
        due.then(|| self.take_pending()).flatten()
    }

    /// The buffered remainder, if any — call before a terminal event so no
    /// tail is lost.
    pub(crate) fn flush(&mut self) -> Option<String> {
        self.take_pending()
    }

    pub(crate) fn full_content(&self) -> &str {
        &self.full
    }

    /// Adopt the authoritative full text (re-read from the desktop after a
    /// dropped stream). Returns the delta to emit: the unseen suffix when
    /// what we streamed is a prefix of it, else the whole text — and nothing
    /// when there is nothing new. Pending text is folded in either way.
    pub(crate) fn catch_up_to(&mut self, full: &str) -> Option<String> {
        if full == self.full {
            return self.take_pending();
        }
        let delta = match full.strip_prefix(self.full.as_str()) {
            Some(suffix) => {
                let mut d = std::mem::take(&mut self.pending);
                d.push_str(suffix);
                d
            }
            None => full.to_string(),
        };
        self.full = full.to_string();
        self.pending.clear();
        self.last_flush = Some(std::time::Instant::now());
        Some(delta)
    }

    fn take_pending(&mut self) -> Option<String> {
        if self.pending.is_empty() {
            return None;
        }
        self.last_flush = Some(std::time::Instant::now());
        Some(std::mem::take(&mut self.pending))
    }
}

/// Same shape as the desktop's mentor workspace key.
fn mentor_key(tenant: &str, mentor: &str) -> String {
    format!("{tenant}::{mentor}")
}

/// The folder a chat should run in: the mentor's chosen folder when the chat
/// is bound to a mentor, else the chat's own, else the server default (None).
fn resolve_directory(
    cfg: &HostConfig,
    session_id: &str,
    tenant: Option<&str>,
    mentor: Option<&str>,
) -> Option<String> {
    if let (Some(t), Some(m)) = (tenant, mentor) {
        if !m.is_empty() {
            if let Some(dir) = cfg.mentor_directories.get(&mentor_key(t, m)) {
                return Some(dir.clone());
            }
        }
    }
    cfg.directories.get(session_id).cloned()
}

pub fn init(config_dir: PathBuf) {
    let _ = std::fs::create_dir_all(&config_dir);
    let _ = CONFIG_PATH.set(config_dir.join("remote_code.json"));
}

fn read_config() -> HostConfig {
    let Some(path) = CONFIG_PATH.get() else {
        return HostConfig::default();
    };
    std::fs::read_to_string(path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn write_config(cfg: &HostConfig) -> Result<(), String> {
    let path = CONFIG_PATH
        .get()
        .ok_or("remote code storage not initialized")?;
    std::fs::write(
        path,
        serde_json::to_string_pretty(cfg).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())
}

/// The paired host's base URL + password, or a user-actionable error.
fn host() -> Result<(String, String), String> {
    let cfg = read_config();
    match (cfg.url, cfg.password) {
        (Some(u), Some(p)) if !u.is_empty() => Ok((u, p)),
        _ => Err("Not paired with a desktop — open Code and connect to your computer.".into()),
    }
}

/// One shared client: a fresh `reqwest::Client` per request (the old shape)
/// threw away the connection pool, so every probe and prompt re-handshaked
/// with the desktop. Per-request `.timeout()` is applied at the call sites.
fn http() -> &'static reqwest::Client {
    static CLIENT: OnceLock<reqwest::Client> = OnceLock::new();
    CLIENT.get_or_init(|| {
        reqwest::Client::builder()
            .connect_timeout(std::time::Duration::from_secs(10))
            .build()
            .expect("http client")
    })
}

async fn get_json(base: &str, pw: &str, path: &str) -> Result<Value, String> {
    get_json_within(base, pw, path, std::time::Duration::from_secs(20)).await
}

async fn get_json_within(
    base: &str,
    pw: &str,
    path: &str,
    cap: std::time::Duration,
) -> Result<Value, String> {
    let resp = http()
        .get(format!("{}{}", base.trim_end_matches('/'), path))
        .basic_auth("opencode", Some(pw))
        .timeout(cap)
        .send()
        .await
        .map_err(|e| format!("could not reach the desktop: {e}"))?;
    if !resp.status().is_success() {
        return Err(format!("desktop returned {}", resp.status()));
    }
    resp.json().await.map_err(|e| e.to_string())
}

async fn post_json(base: &str, pw: &str, path: &str, body: &Value) -> Result<Value, String> {
    let resp = http()
        .post(format!("{}{}", base.trim_end_matches('/'), path))
        .basic_auth("opencode", Some(pw))
        .timeout(std::time::Duration::from_secs(30))
        .json(body)
        .send()
        .await
        .map_err(|e| format!("could not reach the desktop: {e}"))?;
    let status = resp.status();
    let body: Value = resp.json().await.unwrap_or(Value::Null);
    if !status.is_success() {
        return Err(format!("desktop returned {status}: {body}"));
    }
    Ok(body)
}

// ---------- pairing commands ----------

fn normalize_url(u: &str) -> String {
    let u = u.trim().trim_end_matches('/').to_string();
    if u.is_empty() || u.starts_with("http") {
        u
    } else {
        format!("http://{u}")
    }
}

/// The companion (workspace-management) URL convention: opencode port + 1.
fn companion_of(url: &str) -> Option<String> {
    let (base, port) = url.rsplit_once(':')?;
    let p: u16 = port.parse().ok()?;
    let p = p.checked_add(1)?;
    Some(format!("{base}:{p}"))
}

/// How long a pairing keeps probing before it reports failure. Long enough
/// to read iOS's "find and connect to devices on your local network" prompt
/// and tap Allow — see [`first_answering`].
const PAIR_WINDOW_SECS: u64 = 25;
/// Cap on ONE probe request. Candidates race, and a SYN toward an address
/// the phone cannot reach (a VPN or container bridge the desktop also
/// advertises) would otherwise hold every round for the full connect timeout.
const PAIR_PROBE_SECS: u64 = 4;
/// Pause between rounds of probes.
const PAIR_RETRY_MS: u64 = 750;

/// A `get_json` error that came back from a desktop that WAS reached (an
/// HTTP status, e.g. 401 for a wrong password) rather than from the network
/// — retrying it cannot change anything.
fn reached_desktop(err: &str) -> bool {
    err.starts_with("desktop returned")
}

/// Probe every candidate address at once and keep probing until one answers
/// the password, one refuses it, or the window runs out. Returns the address
/// that answered with its `/path` reply.
///
/// Why a window and not one attempt: iOS raises its Local Network permission
/// prompt on the FIRST socket an app opens toward the local network, and
/// that socket fails at once (no route to host) — it does not wait for the
/// answer; every socket opened while the prompt is up fails the same way.
/// A single probe therefore lost to the prompt on every first scan: the
/// error was on screen before the user could tap Allow, and only the next
/// scan (permission now granted) got through. Probing again every
/// [`PAIR_RETRY_MS`] means the scan that raised the prompt is the scan that
/// pairs, the moment Allow is tapped.
async fn first_answering(candidates: &[String], pw: &str) -> Result<(String, Value), String> {
    if candidates.is_empty() {
        return Err("no address to connect to".to_string());
    }
    let started = std::time::Instant::now();
    let window = std::time::Duration::from_secs(PAIR_WINDOW_SECS);
    let mut last_error = "no address to connect to".to_string();
    loop {
        let mut probes: futures_util::stream::FuturesUnordered<_> = candidates
            .iter()
            .map(|c| async move {
                let r = get_json_within(
                    c,
                    pw,
                    "/path",
                    std::time::Duration::from_secs(PAIR_PROBE_SECS),
                )
                .await;
                (c.clone(), r)
            })
            .collect();
        let mut refused = None;
        while let Some((url, result)) = probes.next().await {
            match result {
                Ok(path) => return Ok((url, path)),
                Err(e) if reached_desktop(&e) => refused = Some(e),
                Err(e) => last_error = e,
            }
        }
        // The desktop answered and said no: the network path works, so
        // the password is what is wrong. Nothing to wait for.
        if let Some(e) = refused {
            return Err(e);
        }
        if started.elapsed() >= window {
            return Err(last_error);
        }
        tokio::time::sleep(std::time::Duration::from_millis(PAIR_RETRY_MS)).await;
    }
}

/// Pair with a desktop: verify that the address (or one of the other
/// addresses the same desktop advertises) answers the password, then
/// persist the pairing. Returns the desktop-side workspace directory for
/// display.
#[command]
pub async fn remote_code_set_host(
    url: String,
    password: String,
    mgmt: Option<Vec<String>>,
    urls: Option<Vec<String>>,
) -> Result<Value, String> {
    // The scanned address first, then every other one the QR carried: a
    // desktop with several interfaces advertises one address each, and
    // whichever the phone can actually reach is the one to pair with.
    let mut candidates = vec![normalize_url(&url)];
    for u in urls.iter().flatten().map(|u| normalize_url(u)) {
        if !u.is_empty() && !candidates.contains(&u) {
            candidates.push(u);
        }
    }
    candidates.retain(|c| !c.is_empty());
    let (url, path) = first_answering(&candidates, &password).await.map_err(|e| {
        let hint = if cfg!(target_os = "ios") && !reached_desktop(&e) {
            " If iOS asked about your local network and you chose Don't Allow, \
                 turn on Local Network for ibl.ai in Settings and try again."
        } else {
            ""
        };
        format!("connection failed: {e}.{hint}")
    })?;
    let directory = path
        .get("directory")
        .and_then(|d| d.as_str())
        .unwrap_or("")
        .to_string();

    // Workspace management rides on the companion API. Candidates: whatever
    // the pairing payload names, else the convention (opencode port + 1) for
    // hand-typed pairings. Optional — pairing must not fail because folder
    // management is unreachable.
    let mgmt_candidates: Vec<String> = mgmt
        .unwrap_or_default()
        .iter()
        .map(|c| normalize_url(c))
        .chain(companion_of(&url))
        .filter(|c| !c.is_empty())
        .collect();
    let mut mgmt_url = None;
    for cand in &mgmt_candidates {
        if get_json(cand, &password, "/workspaces").await.is_ok() {
            mgmt_url = Some(cand.clone());
            break;
        }
    }

    let mut cfg = read_config();
    // Session and folder maps hold ids/absolute paths that belong to ONE
    // desktop. Re-pairing with another machine (scanning desktop B's QR
    // while A is unreachable never passes through clear_host) must drop
    // them, or every turn scopes itself to a folder that does not exist
    // there. Same desktop = the new address is one we already know, or
    // the new payload lists the address we were paired to.
    let known_addresses: Vec<String> = urls
        .clone()
        .unwrap_or_default()
        .iter()
        .map(|u| normalize_url(u))
        .chain(std::iter::once(url.clone()))
        .collect();
    let same_desktop = cfg.url.is_none()
        || cfg.url.as_deref() == Some(url.as_str())
        || cfg.alt_urls.contains(&url)
        || cfg
            .url
            .as_ref()
            .is_some_and(|stored| known_addresses.iter().any(|u| u == stored));
    if !same_desktop {
        println!("[RemoteCode] pairing moved to another desktop; forgetting its folders");
        cfg.sessions.clear();
        cfg.session_dirs.clear();
        cfg.directories.clear();
        cfg.mentor_directories.clear();
    }
    cfg.url = Some(url.clone());
    cfg.password = Some(password);
    cfg.mgmt = mgmt_url;
    // Remember the OTHER candidate addresses of this desktop (a QR carries
    // one address per network interface) so the pairing can heal itself
    // when the current address stops being the reachable one.
    cfg.alt_urls = urls
        .unwrap_or_default()
        .iter()
        .map(|u| normalize_url(u))
        .filter(|u| !u.is_empty() && *u != url)
        .collect();
    cfg.alt_mgmt = mgmt_candidates;
    write_config(&cfg)?;
    Ok(json!({ "ok": true, "url": url, "directory": directory }))
}

/// Pairing state (+ live reachability probe when paired). The password never
/// leaves Rust.
#[command]
pub async fn remote_code_get_host() -> Result<Value, String> {
    let mut cfg = read_config();
    let Some(mut url) = cfg.url.clone().filter(|u| !u.is_empty()) else {
        return Ok(json!({ "configured": false, "connected": false }));
    };
    let pw = cfg.password.clone().unwrap_or_default();
    let (mut connected, mut directory) = match get_json(&url, &pw, "/path").await {
        Ok(p) => (
            true,
            p.get("directory")
                .and_then(|d| d.as_str())
                .unwrap_or("")
                .to_string(),
        ),
        Err(_) => (false, String::new()),
    };
    // Self-healing failover: the primary address is unreachable, but one of
    // the desktop's other advertised addresses may not be. Try them and
    // promote whichever answers, so every later call (turns, workspaces)
    // uses the reachable one. The old primary is kept as an alternate in
    // case the network changes back.
    if !connected {
        for alt in cfg.alt_urls.clone() {
            if alt == url {
                continue;
            }
            let Ok(p) = get_json(&alt, &pw, "/path").await else {
                continue;
            };
            connected = true;
            directory = p
                .get("directory")
                .and_then(|d| d.as_str())
                .unwrap_or("")
                .to_string();
            // Re-resolve the companion against the new base: its own
            // port+1 convention first, then every candidate from pairing.
            let mut new_mgmt = None;
            for cand in companion_of(&alt).into_iter().chain(cfg.alt_mgmt.clone()) {
                if get_json(&cand, &pw, "/workspaces").await.is_ok() {
                    new_mgmt = Some(cand);
                    break;
                }
            }
            cfg.alt_urls.retain(|u| u != &alt);
            cfg.alt_urls.push(url.clone());
            cfg.url = Some(alt.clone());
            cfg.mgmt = new_mgmt;
            let _ = write_config(&cfg);
            url = alt;
            break;
        }
    }
    // A pairing with a dead companion is a broken pairing (classic zombie:
    // an orphaned agent server answers, the desktop app behind it is gone).
    // Report disconnected so the UI steers to re-pairing instead of letting
    // turns and folder actions half-work.
    if connected {
        if let Some(mgmt) = cfg.mgmt.clone() {
            if get_json(&mgmt, &pw, "/workspaces").await.is_err() {
                connected = false;
            }
        }
    }
    Ok(json!({
        "configured": true,
        "connected": connected,
        "url": url,
        "directory": directory,
    }))
}

#[command]
pub async fn remote_code_clear_host() -> Result<(), String> {
    let mut cfg = read_config();
    cfg.url = None;
    cfg.password = None;
    cfg.mgmt = None;
    cfg.alt_urls.clear();
    cfg.alt_mgmt.clear();
    cfg.sessions.clear();
    // Folder maps hold ABSOLUTE paths on the unpaired desktop; carried into
    // a pairing with a different machine they point at folders that do not
    // exist there, and every session lands in a broken directory.
    cfg.directories.clear();
    cfg.mentor_directories.clear();
    cfg.session_dirs.clear();
    write_config(&cfg)
}

// ---------- opencode_* command surface (mobile) ----------

/// Local copy of the desktop's permission-mode commands: the mode gates the
/// phone-side auto-allow in [`run_turn`], mirroring desktop semantics.
#[cfg(any(target_os = "ios", target_os = "android"))]
#[command]
pub async fn get_opencode_permission_mode() -> Result<Option<String>, String> {
    Ok(read_config().permission_mode)
}

#[cfg(any(target_os = "ios", target_os = "android"))]
#[command]
pub async fn set_opencode_permission_mode(mode: String) -> Result<(), String> {
    if mode != MODE_AUTO && mode != MODE_MANUAL {
        return Err(format!("unknown permission mode: {mode}"));
    }
    let mut cfg = read_config();
    cfg.permission_mode = Some(mode);
    write_config(&cfg)
}

/// The workspace shown in the Code popover: this chat's chosen desktop folder,
/// else the served default project directory.
#[cfg(any(target_os = "ios", target_os = "android"))]
#[command]
pub async fn get_opencode_workspace(
    session_id: String,
    tenant: Option<String>,
    mentor: Option<String>,
) -> Result<String, String> {
    if let Some(dir) = ensure_directory(&session_id, tenant.as_deref(), mentor.as_deref()).await {
        return Ok(dir);
    }
    let (base, pw) = host()?;
    let path = get_json(&base, &pw, "/path").await?;
    Ok(path
        .get("directory")
        .and_then(|d| d.as_str())
        .unwrap_or("")
        .to_string())
}

/// Record a folder without disturbing the chat's live session — for the
/// automatic default mint, where there is no session yet to reset.
fn record_directory(
    session_id: &str,
    tenant: Option<&str>,
    mentor: Option<&str>,
    dir: &str,
) -> Result<(), String> {
    let mut cfg = read_config();
    match (tenant, mentor) {
        (Some(t), Some(m)) if !m.is_empty() => {
            cfg.mentor_directories
                .insert(mentor_key(t, m), dir.to_string());
        }
        _ => {
            cfg.directories
                .insert(session_id.to_string(), dir.to_string());
        }
    }
    write_config(&cfg)
}

/// The folder this chat runs in, minting a fresh `phone-<id>` one on the
/// desktop the first time (companion API) — every chat/mentor gets its own
/// folder by default instead of piling into the shared phone workspace, and
/// the choice persists. None only when workspace management is unavailable
/// (hand-typed pairing without the companion): the server default applies.
async fn ensure_directory(
    session_id: &str,
    tenant: Option<&str>,
    mentor: Option<&str>,
) -> Option<String> {
    let cfg = read_config();
    if let Some(dir) = resolve_directory(&cfg, session_id, tenant, mentor) {
        return Some(dir);
    }
    let mgmt = cfg.mgmt.clone()?;
    let pw = cfg.password.clone().unwrap_or_default();
    let created = post_json(&mgmt, &pw, "/workspaces", &json!({}))
        .await
        .ok()?;
    let dir = created.get("path")?.as_str()?.to_string();
    let _ = record_directory(session_id, tenant, mentor, &dir);
    println!("[RemoteCode] minted default workspace {dir}");
    Some(dir)
}

/// Record a chosen desktop folder — against the mentor when the chat has one
/// (survives session-id churn; every chat of that mentor follows), else
/// against this chat. The chat's server session resets so the next turn opens
/// in the new directory (desktop semantics: switching folders starts the
/// agent over there).
fn set_chat_directory(
    session_id: &str,
    tenant: Option<&str>,
    mentor: Option<&str>,
    dir: &str,
) -> Result<(), String> {
    let mut cfg = read_config();
    match (tenant, mentor) {
        (Some(t), Some(m)) if !m.is_empty() => {
            cfg.mentor_directories
                .insert(mentor_key(t, m), dir.to_string());
        }
        _ => {
            cfg.directories
                .insert(session_id.to_string(), dir.to_string());
        }
    }
    cfg.sessions.remove(session_id);
    write_config(&cfg)
}

#[cfg(any(target_os = "ios", target_os = "android"))]
#[command]
pub async fn set_opencode_workspace(
    session_id: String,
    path: String,
    tenant: Option<String>,
    mentor: Option<String>,
) -> Result<String, String> {
    set_chat_directory(&session_id, tenant.as_deref(), mentor.as_deref(), &path)?;
    Ok(path)
}

/// Mint a fresh folder on the desktop (companion API) and move this chat into
/// it — the phone's version of "New workspace".
#[cfg(any(target_os = "ios", target_os = "android"))]
#[command]
pub async fn new_opencode_workspace(
    session_id: String,
    tenant: Option<String>,
    mentor: Option<String>,
) -> Result<String, String> {
    let cfg = read_config();
    let mgmt = cfg
        .mgmt
        .clone()
        .ok_or("workspace management isn't available on this pairing — re-pair by QR")?;
    let pw = cfg.password.clone().unwrap_or_default();
    let created = post_json(&mgmt, &pw, "/workspaces", &json!({})).await?;
    let dir = created
        .get("path")
        .and_then(|p| p.as_str())
        .ok_or("desktop did not return a folder")?
        .to_string();
    set_chat_directory(&session_id, tenant.as_deref(), mentor.as_deref(), &dir)?;
    Ok(dir)
}

/// The desktop folders a chat can move into (companion API).
#[command]
pub async fn remote_code_list_workspaces() -> Result<Value, String> {
    let cfg = read_config();
    let mgmt = cfg
        .mgmt
        .clone()
        .ok_or("workspace management isn't available on this pairing — re-pair by QR")?;
    let pw = cfg.password.clone().unwrap_or_default();
    get_json(&mgmt, &pw, "/workspaces").await
}

/// Stop the in-flight turn for this chat (Stop button).
#[cfg(any(target_os = "ios", target_os = "android"))]
#[command]
pub async fn opencode_stop(session_id: String) -> Result<(), String> {
    let (base, pw) = host()?;
    let Some(remote) = read_config().sessions.get(&session_id).cloned() else {
        return Ok(());
    };
    let _ = post_json(&base, &pw, &format!("/session/{remote}/abort"), &json!({})).await;
    Ok(())
}

/// Chat closed / reset. The server keeps the session (it's cheap and it holds
/// the conversation); only the local mapping is kept too, so a reopened chat
/// continues where it left off — same behavior the desktop's resume map gives.
#[cfg(any(target_os = "ios", target_os = "android"))]
#[command]
pub async fn opencode_close(session_id: String) -> Result<(), String> {
    let _ = session_id;
    Ok(())
}

/// Answer a pending permission. `option_id` values are the ones this module
/// itself put on the event ("allow"/"reject"); anything absent rejects, same
/// as the desktop's cancel path.
#[cfg(any(target_os = "ios", target_os = "android"))]
#[command]
pub async fn opencode_permission_respond(
    request_id: String,
    option_id: Option<String>,
) -> Result<(), String> {
    let remote = {
        let mut map = PENDING_PERMISSIONS.lock().expect("permissions lock");
        map.get_or_insert_with(HashMap::new).remove(&request_id)
    };
    let Some(remote_session) = remote else {
        return Ok(()); // unknown/already-resolved: silent no-op, like desktop
    };
    let (base, pw) = host()?;
    let response = if option_id.as_deref() == Some("allow") {
        "once"
    } else {
        "reject"
    };
    let _ = post_json(
        &base,
        &pw,
        &format!("/session/{remote_session}/permissions/{request_id}"),
        &json!({ "response": response }),
    )
    .await;
    Ok(())
}

/// One coding turn, desktop-signature-compatible. Unused desktop parameters
/// are accepted and ignored so the SDK's invoke works verbatim.
#[cfg(any(target_os = "ios", target_os = "android"))]
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
    mentor: Option<String>,
    new_chat_key: Option<String>,
) -> Result<(), String> {
    let _ = (token, api_base, workspace);
    println!(
        "[RemoteCode] opencode_chat_stream: chat={session_id} gen={generation_id} model={model:?} mentor={mentor:?}"
    );
    let sink = TauriSink(app);
    let result = run_turn(
        &sink,
        &session_id,
        &messages,
        &generation_id,
        model.as_deref(),
        (!tenant.is_empty()).then_some(tenant.as_str()),
        mentor.as_deref().filter(|m| !m.is_empty()),
        new_chat_key.as_deref(),
    )
    .await;
    println!("[RemoteCode] turn finished: gen={generation_id} result={result:?}");
    result
}

// ---------- turn engine ----------

/// Where translated events land. Tauri in production; a channel in tests.
pub trait EventSink: Send + Sync {
    fn emit(&self, event: &str, payload: Value);
}

#[cfg(any(target_os = "ios", target_os = "android"))]
struct TauriSink(AppHandle);
#[cfg(any(target_os = "ios", target_os = "android"))]
impl EventSink for TauriSink {
    fn emit(&self, event: &str, payload: Value) {
        // NEVER `self.0.emit` here: the turn runs on a tokio worker, and a
        // direct emit from a worker deadlocks the app on iOS (see
        // `crate::emit_on_main` — the phone's Code-mode freezes were exactly
        // this, per the watchdog crash reports).
        crate::emit_on_main(&self.0, event, payload);
    }
}

/// The newest user message's text — the prompt. Same extraction rule as the
/// desktop: last `role == "user"`, content as a string or `[{text}, …]`.
fn last_user_text(messages: &[Value]) -> Option<String> {
    // Mirrors `opencode_acp::last_user_text` (that module is desktop-only,
    // so it cannot be shared across the cfg boundary): multipart text is
    // concatenated as-is, and a user message with no text at all (image
    // only) is skipped in favor of the previous one — the phone and the
    // desktop must send the same prompt for the same chat.
    messages.iter().rev().find_map(|m| {
        if m.get("role").and_then(|r| r.as_str()) != Some("user") {
            return None;
        }
        let text = match m.get("content") {
            Some(Value::String(s)) => s.clone(),
            Some(Value::Array(parts)) => parts
                .iter()
                .filter_map(|p| p.get("text").and_then(|t| t.as_str()))
                .collect::<Vec<_>>()
                .join(""),
            _ => String::new(),
        };
        (!text.trim().is_empty()).then_some(text)
    })
}

/// The chat's real id arrived (an unsaved chat's ephemeral id became real):
/// BOTH maps follow it, or the chat loses its server conversation and its
/// chosen folder in one stroke. Idempotent — once the new id owns entries,
/// the prior key is left alone. MUST run before anything resolves the
/// chat's directory: resolving first minted a fresh folder under the real
/// id, and the migration then skipped, leaving the turn's session in folder
/// A while its events and prompts targeted folder B.
fn migrate_chat_key(session_id: &str, new_chat_key: Option<&str>) {
    let Some(prior) = new_chat_key.filter(|k| *k != session_id) else {
        return;
    };
    let mut cfg = read_config();
    let mut changed = false;
    if !cfg.sessions.contains_key(session_id) {
        if let Some(remote) = cfg.sessions.remove(prior) {
            cfg.sessions.insert(session_id.to_string(), remote);
            changed = true;
        }
    }
    if !cfg.directories.contains_key(session_id) {
        if let Some(dir) = cfg.directories.remove(prior) {
            cfg.directories.insert(session_id.to_string(), dir);
            changed = true;
        }
    }
    if changed {
        let _ = write_config(&cfg);
    }
}

/// The chat's server session, creating (and persisting) one on first use.
/// `new_chat_key` migration mirrors the desktop: when a brand-new chat gains
/// its real id, the mapping follows it so one chat keeps one session.
async fn ensure_session(
    base: &str,
    pw: &str,
    session_id: &str,
    tenant: Option<&str>,
    mentor: Option<&str>,
    new_chat_key: Option<&str>,
) -> Result<String, String> {
    migrate_chat_key(session_id, new_chat_key);
    // ensure_directory may mint a folder and RECORD it (its own config
    // write); the snapshot this function writes back must be taken after
    // that, or the minted folder is lost and the next turn mints again.
    let dir = ensure_directory(session_id, tenant, mentor).await;
    {
        let cfg = read_config();
        if let Some(remote) = cfg.sessions.get(session_id) {
            // Reuse only if the session lives where this turn will look for
            // it. (Sessions recorded before session_dirs existed have no
            // entry and are trusted, so an upgrade never churns existing
            // chats.)
            let stale = cfg
                .session_dirs
                .get(session_id)
                .is_some_and(|created_in| Some(created_in) != dir.as_ref());
            if !stale {
                return Ok(remote.clone());
            }
            println!("[RemoteCode] session for {session_id} lives in another folder; recreating");
        }
    }
    // A chosen folder scopes the session via opencode's documented
    // `?directory=` parameter; without one the server's default project (the
    // shared phone workspace) applies.
    let create_path = match dir.as_deref() {
        Some(dir) => format!("/session?directory={}", urlencoding::encode(dir)),
        None => "/session".to_string(),
    };
    println!("[RemoteCode] creating server session via {create_path}");
    let created = post_json(base, pw, &create_path, &json!({ "title": "Phone chat" })).await?;
    let remote = created
        .get("id")
        .and_then(|i| i.as_str())
        .ok_or("desktop did not return a session id")?
        .to_string();
    // Re-read AFTER the network round-trip and merge only THIS chat's two
    // entries: a snapshot taken before the await carried every other chat's
    // state across it, so a config write in that window (another chat
    // creating its session, a folder pick, a re-pair) was silently undone —
    // that chat's next turn found no session and minted a second one, and
    // its conversation was gone.
    let mut cfg = read_config();
    cfg.sessions.insert(session_id.to_string(), remote.clone());
    match &dir {
        Some(d) => {
            cfg.session_dirs.insert(session_id.to_string(), d.clone());
        }
        None => {
            cfg.session_dirs.remove(session_id);
        }
    }
    write_config(&cfg)?;
    Ok(remote)
}

/// Whether a `post_json` error means the desktop REJECTED the prompt (a 4xx
/// response — e.g. an unregistered model id) as opposed to an ambiguous
/// transport failure or 5xx after which the prompt may already be queued.
/// Errors are shaped `"desktop returned {status}: {body}"` for responses and
/// `"could not reach the desktop: …"` for transport.
fn is_prompt_rejection(err: &str) -> bool {
    err.strip_prefix("desktop returned 4")
        .is_some_and(|rest| rest.chars().take(2).all(|c| c.is_ascii_digit()))
}

/// `{providerID, modelID}` for the prompt, from the app's model spec. Cloud
/// specs route through the desktop's "iblai" provider (the loopback proxy);
/// on-device specs can't run a REMOTE turn and fail with a clear message.
fn prompt_model(spec: Option<&str>) -> Result<Option<Value>, String> {
    let Some(spec) = spec.filter(|s| !s.trim().is_empty()) else {
        return Ok(None);
    };
    if spec.starts_with("ollama/") || spec.starts_with("foundry/") {
        return Err(
            "On-device models can't drive Code from the phone — pick a cloud model.".to_string(),
        );
    }
    Ok(Some(json!({ "providerID": "iblai", "modelID": spec })))
}

/// What a quiet-stream status probe concluded about the turn's session.
///
/// A FAILED request is `Unknown`, never idle: the probe only runs when the
/// stream has been silent, which is exactly when a Wi-Fi blip or a briefly
/// sleeping desktop also fails the probe — and two such failures 15s apart
/// used to close a mid-generation turn as complete with partial text.
#[derive(Debug, PartialEq, Eq)]
enum ProbeVerdict {
    Retry,
    Idle,
    Busy,
    Unknown,
}

fn classify_probe(resp: Result<Value, String>, remote: &str) -> ProbeVerdict {
    match resp {
        Err(_) => ProbeVerdict::Unknown,
        Ok(v) => match v
            .get(remote)
            .and_then(|s| s.get("type"))
            .and_then(|t| t.as_str())
        {
            Some("retry") => ProbeVerdict::Retry,
            // The server not knowing the session at all reads as idle too —
            // it is a POSITIVE answer from a reachable desktop.
            None | Some("idle") => ProbeVerdict::Idle,
            Some(_) => ProbeVerdict::Busy,
        },
    }
}

/// opencode is multi-project: each working directory is its own instance,
/// and `/event` + `/session/status` answer for ONE instance, selected by the
/// `directory` query. Without it, a session in a chosen folder streams its
/// whole turn into a channel nobody watches — the bug where a finished reply
/// existed server-side while the phone showed nothing.
fn scoped(path: &str, dir: Option<&str>) -> String {
    match dir {
        Some(d) if !d.is_empty() => {
            format!("{path}?directory={}", urlencoding::encode(d))
        }
        _ => path.to_string(),
    }
}

/// Whether the server considers this session done working. Used to vet
/// `session.idle` events, which also fire for background sub-tasks (title
/// generation) and while a permission waits on the user — ending the turn on
/// the first one truncated multi-step work to a single tool call.
async fn session_is_idle(base: &str, pw: &str, remote: &str, dir: Option<&str>) -> bool {
    // Same verdict rules as the quiet-stream probe: a FAILED request is
    // unknown, never idle — treating it as idle closed live turns on a
    // Wi-Fi blip. An unknown answer keeps streaming; the turn deadline and
    // the quiet-stream probes still end a genuinely dead turn.
    matches!(
        classify_probe(
            get_json(base, pw, &scoped("/session/status", dir)).await,
            remote
        ),
        ProbeVerdict::Idle
    )
}

/// Flush coalesced stream buffers: called before any other event (tool
/// call, permission, done, error) so ordering matches what the desktop
/// emits — text/reasoning that arrived before the event must render
/// before it.
/// opencode's `question` tool PARKS the session: the turn cannot finish until
/// someone answers over `/question/{id}/reply` (or rejects). The desktop's
/// ACP path gets that as a permission request with options; over HTTP it is a
/// `question.asked` event plus a `GET /question` list of what is pending.
/// The phone has no question UI, so the question is rendered into the reply
/// as numbered options, the turn ends, and the NEXT message the user types
/// is delivered as the answer.
async fn pending_question(base: &str, pw: &str, remote: &str, dir: Option<&str>) -> Option<Value> {
    let list = get_json(base, pw, &scoped("/question", dir)).await.ok()?;
    list.as_array()?
        .iter()
        .find(|q| q.get("sessionID").and_then(|s| s.as_str()) == Some(remote))
        .cloned()
}

/// The option labels of one question request entry.
fn question_labels(question: &Value) -> Vec<String> {
    question
        .get("options")
        .and_then(|o| o.as_array())
        .map(|a| {
            a.iter()
                .filter_map(|o| o.get("label").and_then(|l| l.as_str()))
                .map(str::to_string)
                .collect()
        })
        .unwrap_or_default()
}

/// What to send back for one question, from what the user typed: an option
/// number, an option's label (or an unambiguous prefix of it), a plain
/// yes/no for a yes/no-shaped choice — otherwise the typed text itself, as a
/// custom answer the agent reads verbatim.
fn answer_for(question: &Value, typed: &str) -> String {
    let typed = typed.trim();
    let labels = question_labels(question);
    if labels.is_empty() {
        return typed.to_string();
    }
    let bare = typed.trim_end_matches(['.', ')']).trim();
    if !bare.is_empty() && bare.chars().all(|c| c.is_ascii_digit()) {
        if let Some(label) = bare
            .parse::<usize>()
            .ok()
            .and_then(|n| n.checked_sub(1))
            .and_then(|i| labels.get(i))
        {
            return label.clone();
        }
    }
    let lower = typed.to_lowercase();
    if let Some(label) = labels.iter().find(|l| l.to_lowercase() == lower) {
        return label.clone();
    }
    if lower.len() >= 3 {
        if let Some(label) = labels.iter().find(|l| l.to_lowercase().starts_with(&lower)) {
            return label.clone();
        }
    }
    let first_word: String = lower.chars().take_while(|c| c.is_alphanumeric()).collect();
    let yes = matches!(
        first_word.as_str(),
        "y" | "yes" | "yeah" | "yep" | "yup" | "sure" | "ok" | "okay" | "default" | "recommended"
    );
    let no = matches!(first_word.as_str(), "n" | "no" | "nope" | "nah");
    if yes {
        if let Some(label) = labels.iter().find(|l| {
            l.to_lowercase().starts_with("yes") || l.to_lowercase().contains("(recommended)")
        }) {
            return label.clone();
        }
    }
    if no {
        if let Some(label) = labels.iter().find(|l| l.to_lowercase().starts_with("no")) {
            return label.clone();
        }
    }
    typed.to_string()
}

fn flush_stream_buffers(
    sink: &dyn EventSink,
    generation_id: &str,
    text: &mut TokenCoalescer,
    reasoning: &mut TokenCoalescer,
) {
    if let Some(delta) = reasoning.flush() {
        sink.emit(
            "opencode:reasoning",
            json!({ "generation_id": generation_id, "delta": delta }),
        );
    }
    if let Some(batch) = text.flush() {
        sink.emit(
            "ollama:token",
            json!({
                "generation_id": generation_id,
                "token": batch,
                "full_content": text.full_content(),
            }),
        );
    }
}

/// Cap a tool output payload: the UI shows a preview, not a transcript, and
/// re-sending a growing multi-hundred-KB output on every update is exactly
/// the kind of event traffic that froze the phone webview.
fn capped_output(v: Value) -> Value {
    const MAX: usize = 4000;
    match v {
        Value::String(s) if s.len() > MAX => {
            let tail: String = s
                .chars()
                .rev()
                .take(MAX)
                .collect::<Vec<_>>()
                .into_iter()
                .rev()
                .collect();
            Value::String(format!("…[truncated]…{tail}"))
        }
        // Tool inputs are objects whose big field is a file body — cap each
        // string field, keep the shape.
        Value::Object(map) => Value::Object(
            map.into_iter()
                .map(|(k, v)| (k, capped_output(v)))
                .collect(),
        ),
        other => other,
    }
}

/// Map an opencode ToolState status onto the ACP status strings the frontend
/// already understands.
fn acp_status(status: &str) -> &'static str {
    match status {
        "pending" => "pending",
        "running" => "in_progress",
        "completed" => "completed",
        "error" => "failed",
        _ => "in_progress",
    }
}

#[allow(clippy::too_many_arguments)]
/// One turn end to end. The SINGLE place a failed turn is reported to the
/// webview: every `Err` out of the engine becomes exactly one `ollama:error`
/// (the engine's own early returns used to emit too, and the command
/// boundary re-emitted, so the phone painted two errors per failure).
async fn run_turn(
    sink: &dyn EventSink,
    session_id: &str,
    messages: &[Value],
    generation_id: &str,
    model: Option<&str>,
    tenant: Option<&str>,
    mentor: Option<&str>,
    new_chat_key: Option<&str>,
) -> Result<(), String> {
    let result = run_turn_inner(
        sink,
        session_id,
        messages,
        generation_id,
        model,
        tenant,
        mentor,
        new_chat_key,
    )
    .await;
    if let Err(e) = &result {
        sink.emit(
            "ollama:error",
            json!({ "generation_id": generation_id, "error": e }),
        );
    }
    result
}

/// The desktop's SSE `/event` stream as raw chunks.
type EventStream = futures_util::stream::BoxStream<'static, Result<Vec<u8>, reqwest::Error>>;

/// Subscribe to the desktop's event stream, scoped to the turn's project
/// directory (see [`scoped`]).
async fn open_event_stream(base: &str, pw: &str, dir: Option<&str>) -> Result<EventStream, String> {
    let events = http()
        .get(format!(
            "{}{}",
            base.trim_end_matches('/'),
            scoped("/event", dir)
        ))
        .basic_auth("opencode", Some(pw))
        .send()
        .await
        .map_err(|e| format!("could not open the desktop event stream: {e}"))?;
    if !events.status().is_success() {
        return Err(format!("desktop event stream returned {}", events.status()));
    }
    Ok(events.bytes_stream().map_ok(|b| b.to_vec()).boxed())
}

/// Reopen the event stream, retrying with backoff for up to
/// [`RECONNECT_WINDOW_SECS`]. The desktop runs the turn whether or not
/// anyone is listening, so losing the stream is never a reason to fail the
/// turn — only failing to get it back is.
async fn reconnect_event_stream(
    base: &str,
    pw: &str,
    dir: Option<&str>,
    why: &str,
) -> Result<EventStream, String> {
    println!("[RemoteCode] {why}; reconnecting the desktop event stream");
    let started = std::time::Instant::now();
    let window = std::time::Duration::from_secs(RECONNECT_WINDOW_SECS);
    let mut delay = std::time::Duration::from_millis(500);
    loop {
        match open_event_stream(base, pw, dir).await {
            Ok(stream) => {
                println!(
                    "[RemoteCode] event stream back after {:?}",
                    started.elapsed()
                );
                return Ok(stream);
            }
            Err(e) if started.elapsed() < window => {
                println!("[RemoteCode] reconnect failed ({e}); retrying in {delay:?}");
                tokio::time::sleep(delay).await;
                delay = (delay * 2).min(std::time::Duration::from_secs(5));
            }
            Err(e) => {
                return Err(format!(
                    "lost the connection to the desktop ({why}) and could not get it back: {e}"
                ))
            }
        }
    }
}

/// What a reconnected turn found on the desktop.
enum CatchUp {
    /// Still running: keep streaming from the new stream.
    Streaming,
    /// Ended while the stream was down (done already emitted), or parked on
    /// the agent's question — which ends the turn the same way.
    Finished,
}

/// The parts of this turn's reply as the desktop has them: the assistant
/// messages answering the LAST user message, in order.
async fn turn_reply_parts(base: &str, pw: &str, remote: &str, dir: Option<&str>) -> Vec<Value> {
    // `limit` returns the NEWEST n messages (ascending). The full history of
    // a long chat can be megabytes of tool output, so start small and widen
    // only while the page has not reached back to the user message that
    // opened this turn (opencode adds an assistant message per step, so a
    // long build has many). No limit at all = everything, the last resort.
    let base_path = scoped(&format!("/session/{remote}/message"), dir);
    for limit in [Some(16), Some(64), Some(256), None] {
        let path = match limit {
            Some(n) if base_path.contains('?') => format!("{base_path}&limit={n}"),
            Some(n) => format!("{base_path}?limit={n}"),
            None => base_path.clone(),
        };
        let Ok(Value::Array(messages)) = get_json(base, pw, &path).await else {
            return Vec::new();
        };
        let last_user = messages
            .iter()
            .rposition(|m| m["info"]["role"].as_str() == Some("user"));
        match last_user {
            None if limit.is_some() && messages.len() >= limit.unwrap_or(0) => continue,
            None => return Vec::new(),
            Some(i) => {
                return messages[i + 1..]
                    .iter()
                    .filter(|m| m["info"]["role"].as_str() == Some("assistant"))
                    .flat_map(|m| m["parts"].as_array().cloned().unwrap_or_default())
                    .collect()
            }
        }
    }
    Vec::new()
}

/// After a reconnect, reconcile the turn with what the desktop did while the
/// stream was down: text, reasoning and tool parts are re-read from the
/// session's messages and whatever is new is emitted; permissions still
/// waiting on the user are re-announced (the card dedupes by id); then the
/// server's own status decides whether the turn is still running, parked
/// on a question, or finished — in which case done is emitted here, because
/// the `session.idle` that would have said so is gone with the old stream.
#[allow(clippy::too_many_arguments)]
async fn catch_up(
    sink: &dyn EventSink,
    generation_id: &str,
    session_id: &str,
    base: &str,
    pw: &str,
    remote: &str,
    dir: Option<&str>,
    auto_mode: bool,
    text: &mut TokenCoalescer,
    reasoning: &mut TokenCoalescer,
    seen_tools: &mut HashMap<String, bool>,
    awaiting_permissions: &mut HashSet<String>,
) -> Result<CatchUp, String> {
    let parts = turn_reply_parts(base, pw, remote, dir).await;
    let mut server_text = String::new();
    let mut server_reasoning = String::new();
    let mut tools = Vec::new();
    for part in &parts {
        match part["type"].as_str() {
            Some("text") => server_text.push_str(part["text"].as_str().unwrap_or("")),
            Some("reasoning") => server_reasoning.push_str(part["text"].as_str().unwrap_or("")),
            Some("tool") => tools.push(part.clone()),
            _ => {}
        }
    }
    // Text: the desktop's copy is authoritative. The frontend renders
    // `full_content`, so one event carrying it repairs whatever the stream
    // dropped; `token` is the part it has not seen, when that is knowable.
    if let Some(batch) = reasoning.catch_up_to(&server_reasoning) {
        sink.emit(
            "opencode:reasoning",
            json!({ "generation_id": generation_id, "delta": batch }),
        );
    }
    if let Some(batch) = text.catch_up_to(&server_text) {
        sink.emit(
            "ollama:token",
            json!({
                "generation_id": generation_id,
                "token": batch,
                "full_content": text.full_content(),
            }),
        );
    }
    for part in &tools {
        let call_id = part["callID"].as_str().unwrap_or("");
        if call_id.is_empty() {
            continue;
        }
        let first = !seen_tools.contains_key(call_id);
        seen_tools.insert(call_id.to_string(), true);
        let state = part.get("state").cloned().unwrap_or(Value::Null);
        let status = state["status"].as_str().unwrap_or("running");
        sink.emit(
            "opencode:tool_call",
            json!({
                "generation_id": generation_id,
                "update": {
                    "sessionUpdate": if first { "tool_call" } else { "tool_call_update" },
                    "toolCallId": call_id,
                    "title": part["tool"].as_str().unwrap_or("tool"),
                    "kind": part["tool"].as_str().unwrap_or("tool"),
                    "status": acp_status(status),
                    "rawInput": capped_output(state.get("input").cloned().unwrap_or(Value::Null)),
                    "content": capped_output(state.get("output").cloned().unwrap_or(Value::Null)),
                },
            }),
        );
    }

    // Permissions asked while we were away. Auto mode answers them the way
    // the streaming path would have; manual mode puts them back on screen.
    awaiting_permissions.clear();
    if let Ok(Value::Array(pending)) = get_json(base, pw, &scoped("/permission", dir)).await {
        for req in pending
            .iter()
            .filter(|r| r["sessionID"].as_str() == Some(remote))
        {
            let per_id = req["id"].as_str().unwrap_or("").to_string();
            if per_id.is_empty() {
                continue;
            }
            if auto_mode {
                let _ = post_json(
                    base,
                    pw,
                    &format!("/session/{remote}/permissions/{per_id}"),
                    &json!({ "response": "once" }),
                )
                .await;
                continue;
            }
            PENDING_PERMISSIONS
                .lock()
                .expect("permissions lock")
                .get_or_insert_with(HashMap::new)
                .insert(per_id.clone(), remote.to_string());
            awaiting_permissions.insert(per_id.clone());
            let patterns = req["patterns"]
                .as_array()
                .map(|a| {
                    a.iter()
                        .filter_map(|v| v.as_str())
                        .collect::<Vec<_>>()
                        .join(" ")
                })
                .unwrap_or_default();
            let permission = req["permission"].as_str().unwrap_or("tool");
            sink.emit(
                "opencode:permission_request",
                json!({
                    "generation_id": generation_id,
                    "session_id": session_id,
                    "request_id": per_id,
                    "title": permission,
                    "kind": permission,
                    "command": if patterns.is_empty() { Value::Null } else { json!(patterns) },
                    "allow_option_id": "allow",
                    "reject_option_id": "reject",
                    "options": [
                        { "optionId": "allow", "name": "Allow", "kind": "allow_once" },
                        { "optionId": "reject", "name": "Reject", "kind": "reject_once" },
                    ],
                }),
            );
        }
    }
    if !awaiting_permissions.is_empty() {
        return Ok(CatchUp::Streaming);
    }

    // Parked on a question: same exit as the `question.asked` event.
    if pending_question(base, pw, remote, dir).await.is_some() {
        flush_stream_buffers(sink, generation_id, text, reasoning);
        sink.emit(
            "ollama:done",
            json!({
                "generation_id": generation_id,
                "full_content": text.full_content(),
                "stop_reason": Value::Null,
            }),
        );
        return Ok(CatchUp::Finished);
    }

    match classify_probe(
        get_json(base, pw, &scoped("/session/status", dir)).await,
        remote,
    ) {
        ProbeVerdict::Idle => {
            if text.full_content().is_empty() && seen_tools.is_empty() {
                return Err(
                    "The desktop went idle without producing a reply — try again.".to_string(),
                );
            }
            flush_stream_buffers(sink, generation_id, text, reasoning);
            sink.emit(
                "ollama:done",
                json!({
                    "generation_id": generation_id,
                    "full_content": text.full_content(),
                    "stop_reason": Value::Null,
                }),
            );
            Ok(CatchUp::Finished)
        }
        // Busy, retrying, or unreachable: keep streaming — the quiet-stream
        // probes and the turn deadline still end a genuinely dead turn.
        _ => Ok(CatchUp::Streaming),
    }
}

#[allow(clippy::too_many_arguments)]
async fn run_turn_inner(
    sink: &dyn EventSink,
    session_id: &str,
    messages: &[Value],
    generation_id: &str,
    model: Option<&str>,
    tenant: Option<&str>,
    mentor: Option<&str>,
    new_chat_key: Option<&str>,
) -> Result<(), String> {
    let (base, pw) = host()?;
    let text = last_user_text(messages).ok_or("no user message to send to opencode")?;
    // Key migration FIRST: resolving the directory before it minted a fresh
    // folder under the chat's real id while the server session stayed in
    // the ephemeral id's folder — the turn then prompted one project and
    // listened to another for the rest of the chat.
    migrate_chat_key(session_id, new_chat_key);
    let turn_dir = ensure_directory(session_id, tenant, mentor).await;
    let remote = ensure_session(&base, &pw, session_id, tenant, mentor, new_chat_key).await?;
    println!("[RemoteCode] session {remote} ready (dir={turn_dir:?}); prompting");
    let _in_flight = InFlight::mark(&remote, turn_dir.as_deref());
    let model = prompt_model(model)?;

    // Subscribe BEFORE prompting or the first deltas race past us — and
    // scoped to the session's project directory, or its events never appear.
    let mut stream = open_event_stream(&base, &pw, turn_dir.as_deref()).await?;
    let mut stream_epoch = FOREGROUND_EPOCH.load(Ordering::SeqCst);

    // A session parked on the agent's own question (see `pending_question`)
    // takes the typed message AS the answer: a new prompt would queue behind
    // the unanswered question and the agent would only ask again.
    if let Some(request) = pending_question(&base, &pw, &remote, turn_dir.as_deref()).await {
        let qid = request
            .get("id")
            .and_then(|i| i.as_str())
            .unwrap_or_default()
            .to_string();
        let answers: Vec<Vec<String>> = request
            .get("questions")
            .and_then(|q| q.as_array())
            .map(|qs| qs.iter().map(|q| vec![answer_for(q, &text)]).collect())
            .unwrap_or_else(|| vec![vec![text.clone()]]);
        println!("[RemoteCode] answering pending question {qid} with {answers:?}");
        post_json(
            &base,
            &pw,
            &scoped(&format!("/question/{qid}/reply"), turn_dir.as_deref()),
            &json!({ "answers": answers }),
        )
        .await?;
    } else {
        let mut prompt = json!({ "parts": [{ "type": "text", "text": text }] });
        if let Some(m) = model.clone() {
            prompt["model"] = m;
        }
        let prompted = post_json(
            &base,
            &pw,
            &format!("/session/{remote}/prompt_async"),
            &prompt,
        )
        .await;
        if model.is_some() && prompted.as_ref().is_err_and(|e| is_prompt_rejection(e)) {
            // The configured provider may not list this exact model id —
            // retry on the server's default rather than failing the turn.
            // ONLY on a definite 4xx rejection: on a timeout or 5xx the
            // server may already have queued the turn, and re-posting would
            // run a (possibly destructive) instruction twice.
            let fallback = json!({ "parts": [{ "type": "text", "text": text }] });
            post_json(
                &base,
                &pw,
                &format!("/session/{remote}/prompt_async"),
                &fallback,
            )
            .await?;
        } else {
            prompted?;
        }
    }

    let auto_mode = read_config().permission_mode.as_deref() == Some(MODE_AUTO);
    // Streamed text and reasoning are batched by TokenCoalescer (first delta
    // immediately, then an adaptive 200ms→1s window) — the same policy the
    // embedded local-LLM stream uses, in one implementation.
    let mut text = TokenCoalescer::new();
    let mut reasoning = TokenCoalescer::new();
    // Raw SSE bytes; events are newline-delimited.
    let mut buffer = Vec::new();
    // Per-tool-call rate limit window (terminal states always pass).
    const EMIT_WINDOW: std::time::Duration = std::time::Duration::from_millis(200);
    // Per-tool-call rate limit (terminal states always pass).
    let mut last_tool_emit: HashMap<String, std::time::Instant> = HashMap::new();
    // part id → is-reasoning, learned from part.updated events; deltas carry
    // only the part id.
    let mut reasoning_parts: HashMap<String, bool> = HashMap::new();
    // tool call ids we've already announced ("tool_call" vs "tool_call_update").
    let mut seen_tools: HashMap<String, bool> = HashMap::new();
    // Permissions this turn is waiting on the user for: while non-empty, a
    // session.idle only means "paused for approval", never "done".
    let mut awaiting_permissions: HashSet<String> = HashSet::new();

    let deadline = std::time::Instant::now() + std::time::Duration::from_secs(TURN_TIMEOUT_SECS);
    // Consecutive quiet-period probes that found the session in "retry" —
    // opencode retrying a failing model call (expired desktop sign-in being
    // the classic). Without this, the turn spins forever with no output.
    let mut retry_probes = 0u32;
    let mut idle_probes = 0u32;

    // Probes must key off OUR session's progress: SSE keep-alives and other
    // sessions' chatter keep the raw stream "busy" forever, which is exactly
    // how a dead turn once spun for minutes with no error.
    let mut last_ours = std::time::Instant::now();
    let mut last_probe = std::time::Instant::now();
    // Anything at all from the stream — heartbeats included — for the
    // stall detector (see STREAM_STALL_SECS).
    let mut last_bytes = std::time::Instant::now();
    // Why the stream must be replaced, when the socket itself said so.
    let mut lost: Option<String> = None;

    loop {
        // The stream is gone (or cannot be trusted: the app was suspended
        // and came back): get it back and catch up. Before the deadline
        // check on purpose — a turn that FINISHED during a long lock must
        // complete cleanly, not time out.
        if lost.is_none() {
            if FOREGROUND_EPOCH.load(Ordering::SeqCst) != stream_epoch {
                lost = Some("app returned to the foreground".to_string());
            } else if last_bytes.elapsed() >= std::time::Duration::from_secs(STREAM_STALL_SECS) {
                lost = Some(format!("no heartbeat for {STREAM_STALL_SECS}s"));
            }
        }
        if let Some(why) = lost.take() {
            stream = reconnect_event_stream(&base, &pw, turn_dir.as_deref(), &why).await?;
            stream_epoch = FOREGROUND_EPOCH.load(Ordering::SeqCst);
            last_bytes = std::time::Instant::now();
            match catch_up(
                sink,
                generation_id,
                session_id,
                &base,
                &pw,
                &remote,
                turn_dir.as_deref(),
                auto_mode,
                &mut text,
                &mut reasoning,
                &mut seen_tools,
                &mut awaiting_permissions,
            )
            .await?
            {
                CatchUp::Finished => return Ok(()),
                CatchUp::Streaming => {
                    last_ours = std::time::Instant::now();
                    last_probe = std::time::Instant::now();
                }
            }
        }
        if std::time::Instant::now() >= deadline {
            return Err("turn timed out".to_string());
        }
        let tick = std::time::Duration::from_secs(5)
            .min(deadline.saturating_duration_since(std::time::Instant::now()));
        let quiet = last_ours.elapsed() >= std::time::Duration::from_secs(15)
            && last_probe.elapsed() >= std::time::Duration::from_secs(15)
            && awaiting_permissions.is_empty();
        let next = match tokio::time::timeout(tick, stream.next()).await {
            Ok(n) => n,
            Err(_) if !quiet => continue,
            Err(_) => {
                // No progress from OUR session for a while: ask the server
                // what's happening rather than trusting silence.
                last_probe = std::time::Instant::now();
                let probe =
                    get_json(&base, &pw, &scoped("/session/status", turn_dir.as_deref())).await;
                match classify_probe(probe, &remote) {
                    // Couldn't reach the desktop: no information either way.
                    // The counters stay put; a real outage still ends at the
                    // turn deadline rather than as a fake completion.
                    ProbeVerdict::Unknown => {}
                    ProbeVerdict::Retry => {
                        retry_probes += 1;
                        if retry_probes >= 3 {
                            let msg = "The desktop's model connection keeps failing — open the \
                                desktop app's Code popover to refresh Phone \
                                Access, then try again."
                                .to_string();
                            return Err(msg);
                        }
                    }
                    ProbeVerdict::Idle => {
                        // Idle with a quiet stream twice in a row = the done
                        // event was missed; close the turn cleanly.
                        idle_probes += 1;
                        if idle_probes >= 2 {
                            // Idle with NOTHING produced is a failed turn,
                            // not an empty success — mirror the done-event
                            // branch, which also refuses a contentless done.
                            if text.full_content().is_empty() && last_tool_emit.is_empty() {
                                let msg =
                                    "The desktop went idle without producing a reply — try again."
                                        .to_string();
                                return Err(msg);
                            }
                            flush_stream_buffers(sink, generation_id, &mut text, &mut reasoning);
                            sink.emit(
                                "ollama:done",
                                json!({
                                    "generation_id": generation_id,
                                    "full_content": text.full_content(),
                                    "stop_reason": Value::Null,
                                }),
                            );
                            return Ok(());
                        }
                    }
                    ProbeVerdict::Busy => {
                        retry_probes = 0;
                        idle_probes = 0;
                    }
                }
                continue;
            }
        };
        // A broken or ended stream is not the end of the turn: the desktop
        // is still running it. Loop back to reconnect and catch up — the
        // lock screen and app switcher on a phone drop this socket every
        // time, and the turn used to die with "event stream broke".
        let chunk = match next {
            Some(Ok(chunk)) => chunk,
            Some(Err(e)) => {
                lost = Some(format!("event stream broke: {e}"));
                continue;
            }
            None => {
                lost = Some("event stream ended before the turn finished".to_string());
                continue;
            }
        };
        last_bytes = std::time::Instant::now();
        buffer.extend_from_slice(&chunk);
        // SSE: events separated by newlines; each data line is one JSON event.
        while let Some(pos) = buffer.iter().position(|&b| b == b'\n') {
            let line: Vec<u8> = buffer.drain(..=pos).collect();
            let line = String::from_utf8_lossy(&line);
            let line = line.trim();
            let Some(data) = line
                .strip_prefix("data: ")
                .or_else(|| line.strip_prefix("data:"))
            else {
                continue;
            };
            let Ok(event) = serde_json::from_str::<Value>(data) else {
                continue;
            };
            let etype = event.get("type").and_then(|t| t.as_str()).unwrap_or("");
            let props = event.get("properties").cloned().unwrap_or(Value::Null);
            // `session.error` is the ONE event whose sessionID upstream
            // declares optional (an unattributed provider/auth failure).
            // Dropping it left the phone streaming nothing until the idle
            // probe reported a bogus "went idle without a reply".
            let for_us = match props.get("sessionID").and_then(|s| s.as_str()) {
                Some(sid) => sid == remote,
                None => etype == "session.error",
            };
            if !for_us {
                continue;
            }
            last_ours = std::time::Instant::now();
            retry_probes = 0;
            idle_probes = 0;

            match etype {
                "message.part.delta" => {
                    let delta = props.get("delta").and_then(|d| d.as_str()).unwrap_or("");
                    if delta.is_empty() {
                        continue;
                    }
                    if props.get("field").and_then(|f| f.as_str()) != Some("text") {
                        continue;
                    }
                    let part_id = props.get("partID").and_then(|p| p.as_str()).unwrap_or("");
                    if reasoning_parts.get(part_id).copied().unwrap_or(false) {
                        if let Some(batch) = reasoning.push(delta) {
                            sink.emit(
                                "opencode:reasoning",
                                json!({ "generation_id": generation_id, "delta": batch }),
                            );
                        }
                    } else if let Some(batch) = text.push(delta) {
                        sink.emit(
                            "ollama:token",
                            json!({
                                "generation_id": generation_id,
                                "token": batch,
                                "full_content": text.full_content(),
                            }),
                        );
                    }
                }
                "message.part.updated" => {
                    let Some(part) = props.get("part") else {
                        continue;
                    };
                    let part_id = part.get("id").and_then(|i| i.as_str()).unwrap_or("");
                    match part.get("type").and_then(|t| t.as_str()) {
                        Some("reasoning") => {
                            reasoning_parts.insert(part_id.to_string(), true);
                        }
                        Some("text") => {
                            reasoning_parts.insert(part_id.to_string(), false);
                        }
                        Some("tool") => {
                            let call_id = part.get("callID").and_then(|c| c.as_str()).unwrap_or("");
                            let first = !seen_tools.contains_key(call_id);
                            seen_tools.insert(call_id.to_string(), true);
                            let state = part.get("state").cloned().unwrap_or(Value::Null);
                            let status = state
                                .get("status")
                                .and_then(|s| s.as_str())
                                .unwrap_or("running");
                            // First sighting and terminal states always pass;
                            // mid-run output growth is rate-limited per call.
                            let terminal = matches!(status, "completed" | "error");
                            if !first && !terminal {
                                if let Some(t) = last_tool_emit.get(call_id) {
                                    if t.elapsed() < EMIT_WINDOW {
                                        continue;
                                    }
                                }
                            }
                            last_tool_emit.insert(call_id.to_string(), std::time::Instant::now());
                            flush_stream_buffers(sink, generation_id, &mut text, &mut reasoning);
                            sink.emit(
                                "opencode:tool_call",
                                json!({
                                    "generation_id": generation_id,
                                    "update": {
                                        "sessionUpdate": if first { "tool_call" } else { "tool_call_update" },
                                        "toolCallId": call_id,
                                        "title": part.get("tool").and_then(|t| t.as_str()).unwrap_or("tool"),
                                        "kind": part.get("tool").and_then(|t| t.as_str()).unwrap_or("tool"),
                                        "status": acp_status(status),
                                        "rawInput": capped_output(
                                            state.get("input").cloned().unwrap_or(Value::Null)
                                        ),
                                        "content": capped_output(
                                            state.get("output").cloned().unwrap_or(Value::Null)
                                        ),
                                    },
                                }),
                            );
                        }
                        _ => {}
                    }
                }
                "permission.asked" => {
                    let per_id = props
                        .get("id")
                        .and_then(|i| i.as_str())
                        .unwrap_or("")
                        .to_string();
                    if per_id.is_empty() {
                        continue;
                    }
                    if auto_mode {
                        let _ = post_json(
                            &base,
                            &pw,
                            &format!("/session/{remote}/permissions/{per_id}"),
                            &json!({ "response": "once" }),
                        )
                        .await;
                        continue;
                    }
                    PENDING_PERMISSIONS
                        .lock()
                        .expect("permissions lock")
                        .get_or_insert_with(HashMap::new)
                        .insert(per_id.clone(), remote.clone());
                    awaiting_permissions.insert(per_id.clone());
                    let patterns = props
                        .get("patterns")
                        .and_then(|p| p.as_array())
                        .map(|a| {
                            a.iter()
                                .filter_map(|v| v.as_str())
                                .collect::<Vec<_>>()
                                .join(" ")
                        })
                        .unwrap_or_default();
                    let permission = props
                        .get("permission")
                        .and_then(|p| p.as_str())
                        .unwrap_or("tool");
                    flush_stream_buffers(sink, generation_id, &mut text, &mut reasoning);
                    sink.emit(
                        "opencode:permission_request",
                        json!({
                            "generation_id": generation_id,
                            "session_id": session_id,
                            "request_id": per_id,
                            "title": permission,
                            "kind": permission,
                            "command": if patterns.is_empty() { Value::Null } else { json!(patterns) },
                            "allow_option_id": "allow",
                            "reject_option_id": "reject",
                            "options": [
                                { "optionId": "allow", "name": "Allow", "kind": "allow_once" },
                                { "optionId": "reject", "name": "Reject", "kind": "reject_once" },
                            ],
                        }),
                    );
                }
                "permission.replied" => {
                    if let Some(req) = props.get("requestID").and_then(|r| r.as_str()) {
                        awaiting_permissions.remove(req);
                        PENDING_PERMISSIONS
                            .lock()
                            .expect("permissions lock")
                            .get_or_insert_with(HashMap::new)
                            .remove(req);
                        sink.emit("opencode:permission_resolved", json!({ "request_id": req }));
                    }
                }
                "question.asked" => {
                    // Safety net only: the desktop denies this tool on every
                    // spawn (`opencode_acp::enforce_permission_policy`), so
                    // the agent asks in prose. If an older desktop still
                    // offers it, the session is now waiting for an answer
                    // and no idle will ever end this turn — hand the turn
                    // back so the user can type the answer (delivered by
                    // the next turn's `pending_question` branch).
                    println!(
                        "[RemoteCode] question {} asked; ending the turn for the answer",
                        props.get("id").and_then(|i| i.as_str()).unwrap_or("?")
                    );
                    flush_stream_buffers(sink, generation_id, &mut text, &mut reasoning);
                    sink.emit(
                        "ollama:done",
                        json!({
                            "generation_id": generation_id,
                            "full_content": text.full_content(),
                            "stop_reason": Value::Null,
                        }),
                    );
                    return Ok(());
                }
                "session.error" => {
                    let error = props.get("error").cloned().unwrap_or(Value::Null);
                    let name = error.get("name").and_then(|n| n.as_str()).unwrap_or("");
                    // A user-initiated Stop surfaces as an abort error — that's
                    // a normal end of turn, not a failure.
                    if name == "MessageAbortedError" {
                        flush_stream_buffers(sink, generation_id, &mut text, &mut reasoning);
                        sink.emit(
                            "ollama:done",
                            json!({
                                "generation_id": generation_id,
                                "full_content": text.full_content(),
                                "stop_reason": "aborted",
                            }),
                        );
                        return Ok(());
                    }
                    let msg = error
                        .get("data")
                        .and_then(|d| d.get("message"))
                        .and_then(|m| m.as_str())
                        .map(|s| s.to_string())
                        .unwrap_or_else(|| error.to_string());
                    flush_stream_buffers(sink, generation_id, &mut text, &mut reasoning);
                    return Err(msg);
                }
                "session.idle" => {
                    // Paused for an approval, not finished.
                    if !awaiting_permissions.is_empty() {
                        continue;
                    }
                    // Idle also fires for sub-tasks (title generation); only
                    // the server's status map is authoritative.
                    tokio::time::sleep(std::time::Duration::from_millis(600)).await;
                    if !session_is_idle(&base, &pw, &remote, turn_dir.as_deref()).await {
                        continue;
                    }
                    if text.full_content().is_empty() && seen_tools.is_empty() {
                        // Nothing streamed yet — likely the queued turn hasn't
                        // started. Give it one more beat before calling it
                        // genuinely empty.
                        tokio::time::sleep(std::time::Duration::from_millis(1500)).await;
                        if !session_is_idle(&base, &pw, &remote, turn_dir.as_deref()).await {
                            continue;
                        }
                    }
                    flush_stream_buffers(sink, generation_id, &mut text, &mut reasoning);
                    sink.emit(
                        "ollama:done",
                        json!({
                            "generation_id": generation_id,
                            "full_content": text.full_content(),
                            "stop_reason": Value::Null,
                        }),
                    );
                    return Ok(());
                }
                _ => {}
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::response::sse::{Event, Sse};
    use axum::routing::{get, post};
    use axum::{Json, Router};
    use std::sync::Arc;

    /// CONFIG_PATH is process-wide; the turn tests each rewrite the config
    /// file, so they must not interleave. Async mutex: the guard lives across
    /// the awaited turn.
    static CONFIG_TEST_LOCK: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

    struct VecSink(Mutex<Vec<(String, Value)>>);
    impl EventSink for VecSink {
        fn emit(&self, event: &str, payload: Value) {
            self.0.lock().unwrap().push((event.to_string(), payload));
        }
    }

    /// CONFIG_PATH is a process-wide OnceLock, so every test shares ONE
    /// directory (never deleted); isolation comes from rewriting a fresh
    /// config under CONFIG_TEST_LOCK.
    fn test_config(url: &str) {
        let dir = std::env::temp_dir().join(format!("ibl-rcc-shared-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        init(dir);
        let cfg = HostConfig {
            url: Some(url.to_string()),
            password: Some("pw".into()),
            ..HostConfig::default()
        };
        write_config(&cfg).unwrap();
    }

    #[test]
    fn token_coalescer_batches_a_burst_into_few_flushes() {
        // The bug this pins: every streamed token used to become its own
        // webview event (with the full reply in the payload), and a long
        // on-device reply crashed the phone app. A burst of 500 deltas
        // must flush once immediately and then hold within the window.
        let mut c = TokenCoalescer::new();
        let mut flushes = 0;
        for i in 0..500 {
            if c.push(&format!("tok{i} ")).is_some() {
                flushes += 1;
            }
        }
        assert_eq!(flushes, 1, "only the first delta flushes inside one window");
        // Nothing is lost: the tail is waiting in flush().
        let tail = c.flush().expect("pending tail");
        assert!(tail.contains("tok499"));
        assert!(c.full_content().starts_with("tok0 tok1 "));
        assert!(c.full_content().ends_with("tok499 "));
        // And a second flush has nothing.
        assert!(c.flush().is_none());
    }

    #[test]
    fn token_coalescer_passthrough_flushes_every_push() {
        // Desktop mode: behaviorally identical to the pre-coalescer code —
        // every delta emits on its own, nothing is ever held back.
        let mut c = TokenCoalescer::passthrough();
        for i in 0..50 {
            assert_eq!(c.push("x").as_deref(), Some("x"), "push {i} must flush");
        }
        assert!(c.flush().is_none());
        assert_eq!(c.full_content().len(), 50);
    }

    #[test]
    fn pairing_url_normalization_and_companion_convention() {
        assert_eq!(
            normalize_url(" 192.168.0.5:4096/ "),
            "http://192.168.0.5:4096"
        );
        assert_eq!(
            normalize_url("http://mac.local:4096"),
            "http://mac.local:4096"
        );
        assert_eq!(normalize_url(""), "");
        assert_eq!(
            companion_of("http://192.168.0.5:4096").as_deref(),
            Some("http://192.168.0.5:4097")
        );
        assert!(companion_of("nocolon").is_none());
        assert!(companion_of("http://host-no-port").is_none());
    }

    /// A pairing must keep working when the address it was made on stops
    /// answering but another address from the QR's url list still does.
    /// Primary dead + reachable alternate → get_host promotes the alternate
    /// and persists it for later turns.
    #[tokio::test]
    async fn pairing_heals_to_an_alternate_address_when_primary_dies() {
        let _guard = CONFIG_TEST_LOCK.lock().await;
        let app = Router::new().route(
            "/path",
            get(|| async { Json(json!({ "directory": "/srv/ws" })) }),
        );
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });

        // Primary points at a port nothing listens on (the "old network"
        // address); the live server is only known as an alternate.
        test_config("http://127.0.0.1:9");
        let mut cfg = read_config();
        cfg.alt_urls = vec![format!("http://{addr}")];
        write_config(&cfg).unwrap();

        let status = remote_code_get_host().await.unwrap();
        assert_eq!(status["connected"], json!(true));
        assert_eq!(status["url"], json!(format!("http://{addr}")));

        // Promotion persisted — and the dead primary kept as an alternate
        // for when the phone comes back to the original network.
        let cfg = read_config();
        assert_eq!(cfg.url, Some(format!("http://{addr}")));
        assert!(cfg.alt_urls.contains(&"http://127.0.0.1:9".to_string()));
    }

    #[test]
    fn a_failed_status_probe_is_unknown_not_idle() {
        // The bug this pins (PR review finding): a failed probe request fell
        // through .ok() into the "idle" default, and two Wi-Fi blips 15s
        // apart closed a mid-generation turn as complete with partial text.
        assert_eq!(
            classify_probe(Err("connect timed out".into()), "ses_1"),
            ProbeVerdict::Unknown
        );
        // A reachable desktop that doesn't know the session IS an answer.
        assert_eq!(classify_probe(Ok(json!({})), "ses_1"), ProbeVerdict::Idle);
        assert_eq!(
            classify_probe(Ok(json!({ "ses_1": { "type": "idle" } })), "ses_1"),
            ProbeVerdict::Idle
        );
        assert_eq!(
            classify_probe(Ok(json!({ "ses_1": { "type": "retry" } })), "ses_1"),
            ProbeVerdict::Retry
        );
        assert_eq!(
            classify_probe(Ok(json!({ "ses_1": { "type": "working" } })), "ses_1"),
            ProbeVerdict::Busy
        );
    }

    #[test]
    fn the_prompt_fallback_fires_only_on_a_definite_rejection() {
        // A 4xx means the desktop refused the prompt (e.g. unregistered model
        // id) and it is safe to retry without a model. A timeout or 5xx may
        // have already queued the turn — resending would run a possibly
        // destructive instruction twice.
        assert!(is_prompt_rejection("desktop returned 404 Not Found: {}"));
        assert!(is_prompt_rejection(
            "desktop returned 422 Unprocessable Entity: model"
        ));
        assert!(!is_prompt_rejection(
            "desktop returned 500 Internal Server Error: boom"
        ));
        assert!(!is_prompt_rejection(
            "could not reach the desktop: operation timed out"
        ));
        assert!(!is_prompt_rejection(""));
    }

    #[tokio::test]
    async fn a_session_created_in_another_folder_is_recreated_there() {
        // Mentor folder switched from a sibling chat: this chat's session
        // still lives in the OLD folder, but turns are scoped to the new one
        // — reusing it made the turn listen to a project its session isn't
        // in. The recorded creation dir detects the mismatch.
        let _guard = CONFIG_TEST_LOCK.lock().await;
        let created = std::sync::Arc::new(std::sync::atomic::AtomicUsize::new(0));
        let counter = created.clone();
        let app = Router::new()
            .route(
                "/path",
                get(|| async { Json(json!({ "directory": "/srv" })) }),
            )
            .route(
                "/session",
                post(move || {
                    let n = counter.fetch_add(1, std::sync::atomic::Ordering::SeqCst) + 1;
                    async move { Json(json!({ "id": format!("ses_{n}") })) }
                }),
            );
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
        test_config(&format!("http://{addr}"));

        // Chat B's session was created in /old.
        let mut cfg = read_config();
        cfg.sessions.insert("chat-b".into(), "ses_old".into());
        cfg.session_dirs.insert("chat-b".into(), "/old".into());
        // Meanwhile the mentor's folder moved to /new (from chat A).
        cfg.mentor_directories
            .insert(mentor_key("t", "m"), "/new".into());
        write_config(&cfg).unwrap();

        let base = format!("http://{addr}");
        let remote = ensure_session(&base, "pw", "chat-b", Some("t"), Some("m"), None)
            .await
            .unwrap();
        assert_eq!(remote, "ses_1", "stale session must be recreated in /new");
        let cfg = read_config();
        assert_eq!(
            cfg.session_dirs.get("chat-b").map(String::as_str),
            Some("/new")
        );

        // And the fresh one is reused thereafter (no churn).
        let again = ensure_session(&base, "pw", "chat-b", Some("t"), Some("m"), None)
            .await
            .unwrap();
        assert_eq!(again, "ses_1");
    }

    #[test]
    fn last_user_text_takes_newest_user_message() {
        let messages = vec![
            json!({ "role": "user", "content": "first" }),
            json!({ "role": "assistant", "content": "reply" }),
            json!({ "role": "user", "content": [{ "text": "second" }, { "text": "part" }] }),
        ];
        assert_eq!(last_user_text(&messages).as_deref(), Some("secondpart"));
        assert!(last_user_text(&[json!({ "role": "assistant", "content": "x" })]).is_none());
    }

    #[tokio::test]
    async fn a_turn_migrates_the_chat_key_before_resolving_its_folder() {
        // The bug this pins (PR review finding): run_turn resolved the
        // directory BEFORE the new_chat_key migration. A no-mentor chat that
        // gained its real id then minted/used a different folder than the
        // one its server session lives in — every later turn prompted one
        // project and listened to another.
        let _guard = CONFIG_TEST_LOCK.lock().await;
        test_config("http://127.0.0.1:9");
        let mut cfg = read_config();
        cfg.directories
            .insert("chat-eph".to_string(), "/tmp/folder-a".to_string());
        write_config(&cfg).unwrap();

        // What run_turn now does first:
        migrate_chat_key("chat-real", Some("chat-eph"));
        let dir = ensure_directory("chat-real", None, None).await;
        assert_eq!(
            dir.as_deref(),
            Some("/tmp/folder-a"),
            "the real id must inherit the ephemeral id's folder for the SAME turn"
        );
        // And the map moved rather than duplicated.
        let cfg = read_config();
        assert!(!cfg.directories.contains_key("chat-eph"));
        assert_eq!(
            cfg.directories.get("chat-real").map(String::as_str),
            Some("/tmp/folder-a")
        );
    }

    #[tokio::test]
    async fn unpairing_forgets_the_old_desktop_folders() {
        // The bug this pins (PR review finding): clear_host kept
        // `directories`/`mentor_directories`, so pairing with a SECOND
        // desktop resolved absolute paths from the first machine.
        let _guard = CONFIG_TEST_LOCK.lock().await;
        test_config("http://127.0.0.1:9");
        let mut cfg = read_config();
        cfg.sessions.insert("c1".into(), "ses_1".into());
        cfg.directories.insert("c1".into(), "/old/machine/a".into());
        cfg.mentor_directories
            .insert(mentor_key("t", "m"), "/old/machine/b".into());
        write_config(&cfg).unwrap();

        remote_code_clear_host().await.unwrap();

        let cfg = read_config();
        assert!(cfg.sessions.is_empty());
        assert!(cfg.directories.is_empty());
        assert!(cfg.mentor_directories.is_empty());
    }

    #[test]
    fn chosen_folders_survive_session_id_churn() {
        // Mentor-keyed: any session id of that mentor resolves the folder —
        // including the REAL id a chat gains after its first send (the bug:
        // per-chat keying forgot the folder the moment the id changed).
        let mut cfg = HostConfig::default();
        cfg.mentor_directories
            .insert(mentor_key("acme", "mentor-1"), "/Users/x/proj".into());
        assert_eq!(
            resolve_directory(&cfg, "coding-new-123", Some("acme"), Some("mentor-1")).as_deref(),
            Some("/Users/x/proj"),
        );
        assert_eq!(
            resolve_directory(&cfg, "real-id-456", Some("acme"), Some("mentor-1")).as_deref(),
            Some("/Users/x/proj"),
        );
        // No mentor → falls back to the per-chat entry, else None (default).
        cfg.directories
            .insert("coding-new-123".into(), "/Users/x/other".into());
        assert_eq!(
            resolve_directory(&cfg, "coding-new-123", None, None).as_deref(),
            Some("/Users/x/other"),
        );
        assert!(resolve_directory(&cfg, "real-id-456", None, None).is_none());
    }

    #[test]
    fn prompt_model_routes_cloud_specs_and_refuses_local() {
        let m = prompt_model(Some("openai/gpt-4o")).unwrap().unwrap();
        assert_eq!(m["providerID"], "iblai");
        assert_eq!(m["modelID"], "openai/gpt-4o");
        assert!(prompt_model(None).unwrap().is_none());
        assert!(prompt_model(Some("ollama/qwen3")).is_err());
        assert!(prompt_model(Some("foundry/phi")).is_err());
    }

    fn template_question() -> Value {
        json!({
            "question": "Start from our default template?",
            "header": "Template choice",
            "options": [
                { "label": "Yes, use default template (Recommended)",
                  "description": "Fastest and most reliable." },
                { "label": "No, build it from scratch",
                  "description": "A plain site with no scaffolding." }
            ]
        })
    }

    #[test]
    fn a_typed_answer_maps_onto_the_question_options() {
        let q = template_question();
        let yes = "Yes, use default template (Recommended)";
        let no = "No, build it from scratch";
        // Option numbers, with the punctuation people type.
        assert_eq!(answer_for(&q, "1"), yes);
        assert_eq!(answer_for(&q, " 2. "), no);
        assert_eq!(answer_for(&q, "2)"), no);
        // The label itself, any case, or an unambiguous prefix of it.
        assert_eq!(answer_for(&q, "no, build it from scratch"), no);
        assert_eq!(answer_for(&q, "Yes, use"), yes);
        // A plain yes/no for a yes/no-shaped question.
        assert_eq!(answer_for(&q, "yes"), yes);
        assert_eq!(answer_for(&q, "Yes please"), yes);
        assert_eq!(answer_for(&q, "ok"), yes);
        assert_eq!(answer_for(&q, "default template"), yes);
        assert_eq!(answer_for(&q, "nope"), no);
        assert_eq!(answer_for(&q, "n"), no);
        // Anything else is a custom answer the agent reads verbatim; an
        // out-of-range number is text, not a silent first option.
        assert_eq!(
            answer_for(&q, "use Next.js with tailwind"),
            "use Next.js with tailwind"
        );
        assert_eq!(answer_for(&q, "7"), "7");
        // No options at all: the text is the answer.
        assert_eq!(answer_for(&json!({ "question": "Name?" }), " Ada "), "Ada");
    }

    /// The agent's question tool parks the session — no idle ever follows. The
    /// turn must show the choices and END so the user can type an answer,
    /// instead of sitting on the stop button until the turn deadline.
    #[tokio::test(flavor = "multi_thread")]
    async fn a_question_from_the_agent_ends_the_turn() {
        let _guard = CONFIG_TEST_LOCK.lock().await;
        let app = Router::new()
            .route("/session", post(|| async { Json(json!({ "id": "ses_q" })) }))
            .route("/question", get(|| async { Json(json!([])) }))
            .route(
                "/session/{sid}/prompt_async",
                post(|| async { Json(json!({})) }),
            )
            .route(
                "/event",
                get(|| async {
                    let events: Vec<Result<Event, std::convert::Infallible>> = vec![
                        json!({ "type": "message.part.delta", "properties": {
                            "sessionID": "ses_q", "messageID": "m1", "partID": "px",
                            "field": "text", "delta": "Want to start from our default template?" } }),
                        json!({ "type": "question.asked", "properties": {
                            "id": "que_1", "sessionID": "ses_q",
                            "questions": [template_question()],
                            "tool": { "messageID": "m1", "callID": "call1" } } }),
                        // The server would now wait forever; nothing else comes.
                    ]
                    .into_iter()
                    .map(|v| Ok(Event::default().data(v.to_string())))
                    .collect();
                    Sse::new(tokio_stream::iter(events).chain(tokio_stream::pending()))
                }),
            );
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
        test_config(&format!("http://{addr}"));

        let sink = Arc::new(VecSink(Mutex::new(Vec::new())));
        tokio::time::timeout(
            std::time::Duration::from_secs(10),
            run_turn(
                sink.as_ref(),
                "chat-q",
                &[json!({ "role": "user", "content": "create a todo list website" })],
                "gen-q",
                None,
                None,
                None,
                None,
            ),
        )
        .await
        .expect("the turn must end on the question, not hang")
        .expect("a question is a normal end of turn");

        let events = sink.0.lock().unwrap().clone();
        let names: Vec<&str> = events.iter().map(|(n, _)| n.as_str()).collect();
        assert_eq!(
            names.iter().filter(|n| **n == "ollama:done").count(),
            1,
            "got: {names:?}"
        );
        assert_eq!(names.last().copied(), Some("ollama:done"));
        // Exactly what the agent said, nothing appended: the phone follows
        // the desktop (prose question, user replies by typing).
        assert_eq!(
            events.last().unwrap().1["full_content"],
            "Want to start from our default template?"
        );
    }

    /// With a question pending, the next message is the ANSWER: it goes to
    /// `/question/{id}/reply` (mapped onto the option the user meant) and no
    /// new prompt is queued — a prompt would just make the agent ask again.
    #[tokio::test(flavor = "multi_thread")]
    async fn the_next_message_answers_a_pending_question_instead_of_prompting() {
        let _guard = CONFIG_TEST_LOCK.lock().await;
        let prompts = Arc::new(std::sync::atomic::AtomicUsize::new(0));
        let prompts_route = prompts.clone();
        let replies: Arc<Mutex<Vec<Value>>> = Arc::new(Mutex::new(Vec::new()));
        let replies_route = replies.clone();
        let app = Router::new()
            .route(
                "/session",
                post(|| async { Json(json!({ "id": "ses_q" })) }),
            )
            .route(
                "/question",
                get(|| async {
                    Json(json!([
                        { "id": "que_other", "sessionID": "ses_other", "questions": [] },
                        { "id": "que_1", "sessionID": "ses_q", "questions": [template_question()] }
                    ]))
                }),
            )
            .route(
                "/question/{qid}/reply",
                post(move |Json(body): Json<Value>| {
                    let replies = replies_route.clone();
                    async move {
                        replies.lock().unwrap().push(body);
                        Json(json!({}))
                    }
                }),
            )
            .route(
                "/session/{sid}/prompt_async",
                post(move || {
                    let prompts = prompts_route.clone();
                    async move {
                        prompts.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
                        Json(json!({}))
                    }
                }),
            )
            .route(
                "/session/status",
                get(|| async { Json(json!({ "ses_q": { "type": "idle" } })) }),
            )
            .route(
                "/event",
                get(|| async {
                    let events: Vec<Result<Event, std::convert::Infallible>> = vec![
                        json!({ "type": "question.replied", "properties": {
                            "sessionID": "ses_q", "requestID": "que_1",
                            "answers": [["Yes, use default template (Recommended)"]] } }),
                        json!({ "type": "message.part.delta", "properties": {
                            "sessionID": "ses_q", "messageID": "m1", "partID": "px",
                            "field": "text", "delta": "Scaffolding the template now." } }),
                        json!({ "type": "session.idle", "properties": { "sessionID": "ses_q" } }),
                    ]
                    .into_iter()
                    .map(|v| Ok(Event::default().data(v.to_string())))
                    .collect();
                    Sse::new(tokio_stream::iter(events))
                }),
            );
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
        test_config(&format!("http://{addr}"));

        let sink = Arc::new(VecSink(Mutex::new(Vec::new())));
        run_turn(
            sink.as_ref(),
            "chat-q",
            &[
                json!({ "role": "user", "content": "create a todo list website" }),
                json!({ "role": "assistant", "content": "Start from our default template?" }),
                json!({ "role": "user", "content": "yes" }),
            ],
            "gen-a",
            None,
            None,
            None,
            None,
        )
        .await
        .expect("the answered turn completes");

        assert_eq!(
            prompts.load(std::sync::atomic::Ordering::SeqCst),
            0,
            "no new prompt while a question is pending"
        );
        let replies = replies.lock().unwrap().clone();
        assert_eq!(replies.len(), 1);
        assert_eq!(
            replies[0]["answers"],
            json!([["Yes, use default template (Recommended)"]])
        );
        let events = sink.0.lock().unwrap().clone();
        let names: Vec<&str> = events.iter().map(|(n, _)| n.as_str()).collect();
        assert_eq!(names.last().copied(), Some("ollama:done"), "got: {names:?}");
        assert_eq!(
            events.last().unwrap().1["full_content"],
            "Scaffolding the template now."
        );
    }

    /// A full simulated turn against a fake opencode server: session created,
    /// prompt accepted, SSE streams reasoning → SPURIOUS idle (a background
    /// sub-task finishing — the bug that truncated real turns to one tool) →
    /// tool call → permission ask → another idle (paused for approval) →
    /// reply → text deltas → real idle. Asserts the exact Tauri events the
    /// SDK expects, in order, and that only the REAL idle ends the turn.
    #[tokio::test(flavor = "multi_thread")]
    async fn a_turn_translates_server_events_into_desktop_events() {
        let _guard = CONFIG_TEST_LOCK.lock().await;
        // /session/status: "working" on the first probe (the spurious idle),
        // "idle" from then on (the real end).
        let status_calls = Arc::new(std::sync::atomic::AtomicUsize::new(0));
        let status_calls_route = status_calls.clone();
        let app = Router::new()
            .route("/session", post(|| async { Json(json!({ "id": "ses_test1" })) }))
            .route(
                "/session/status",
                get(move || {
                    let calls = status_calls_route.clone();
                    async move {
                        let n = calls.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
                        let state = if n == 0 { "working" } else { "idle" };
                        Json(json!({ "ses_test1": { "type": state } }))
                    }
                }),
            )
            .route(
                "/session/{sid}/prompt_async",
                post(|Json(body): Json<Value>| async move {
                    assert_eq!(body["parts"][0]["text"], "hello agent");
                    Json(json!({}))
                }),
            )
            .route(
                "/session/{sid}/permissions/{pid}",
                post(|| async { Json(json!({})) }),
            )
            .route(
                "/event",
                get(|| async {
                    let events: Vec<Result<Event, std::convert::Infallible>> = vec![
                        json!({ "type": "server.connected", "properties": {} }),
                        // another session's noise must be ignored
                        json!({ "type": "message.part.delta", "properties": {
                            "sessionID": "ses_other", "messageID": "m", "partID": "p0",
                            "field": "text", "delta": "IGNORE" } }),
                        json!({ "type": "message.part.updated", "properties": {
                            "sessionID": "ses_test1",
                            "part": { "id": "pr", "sessionID": "ses_test1", "messageID": "m1",
                                       "type": "reasoning", "text": "", "time": { "start": 1 } },
                            "time": 1 } }),
                        json!({ "type": "message.part.delta", "properties": {
                            "sessionID": "ses_test1", "messageID": "m1", "partID": "pr",
                            "field": "text", "delta": "thinking…" } }),
                        // Spurious: a background sub-task went idle mid-turn.
                        json!({ "type": "session.idle", "properties": { "sessionID": "ses_test1" } }),
                        json!({ "type": "message.part.updated", "properties": {
                            "sessionID": "ses_test1",
                            "part": { "id": "pt", "sessionID": "ses_test1", "messageID": "m1",
                                       "type": "tool", "callID": "call1", "tool": "bash",
                                       "state": { "status": "running", "input": { "command": "ls" } } },
                            "time": 2 } }),
                        json!({ "type": "permission.asked", "properties": {
                            "sessionID": "ses_test1", "id": "per_1", "permission": "bash",
                            "patterns": ["ls *"], "metadata": {}, "always": [] } }),
                        // Paused for approval — must not end the turn either.
                        json!({ "type": "session.idle", "properties": { "sessionID": "ses_test1" } }),
                        json!({ "type": "permission.replied", "properties": {
                            "sessionID": "ses_test1", "requestID": "per_1", "reply": "once" } }),
                        json!({ "type": "message.part.delta", "properties": {
                            "sessionID": "ses_test1", "messageID": "m1", "partID": "px",
                            "field": "text", "delta": "All " } }),
                        json!({ "type": "message.part.delta", "properties": {
                            "sessionID": "ses_test1", "messageID": "m1", "partID": "px",
                            "field": "text", "delta": "done" } }),
                        json!({ "type": "session.idle", "properties": { "sessionID": "ses_test1" } }),
                    ]
                    .into_iter()
                    .map(|v| Ok(Event::default().data(v.to_string())))
                    .collect();
                    Sse::new(tokio_stream::iter(events))
                }),
            );
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });

        test_config(&format!("http://{addr}"));

        let sink = Arc::new(VecSink(Mutex::new(Vec::new())));
        run_turn(
            sink.as_ref(),
            "chat-1",
            &[json!({ "role": "user", "content": "hello agent" })],
            "opencode-123",
            Some("openai/gpt-4o"),
            None,
            None,
            None,
        )
        .await
        .expect("turn succeeds");

        let events = sink.0.lock().unwrap().clone();
        let names: Vec<&str> = events.iter().map(|(n, _)| n.as_str()).collect();
        assert_eq!(
            names,
            vec![
                "opencode:reasoning",
                "opencode:tool_call",
                "opencode:permission_request",
                "opencode:permission_resolved",
                "ollama:token",
                "ollama:token",
                "ollama:done",
            ],
            "got: {events:?}"
        );
        // Exactly ONE done — the two mid-turn idles must not have ended it.
        assert_eq!(names.iter().filter(|n| **n == "ollama:done").count(), 1);

        // Payload shapes the SDK depends on, spot-checked.
        assert_eq!(events[0].1["delta"], "thinking…");
        assert_eq!(events[0].1["generation_id"], "opencode-123");
        assert_eq!(events[1].1["update"]["toolCallId"], "call1");
        assert_eq!(events[1].1["update"]["status"], "in_progress");
        assert_eq!(events[1].1["update"]["rawInput"]["command"], "ls");
        assert_eq!(events[2].1["request_id"], "per_1");
        assert_eq!(events[2].1["allow_option_id"], "allow");
        assert_eq!(events[2].1["command"], "ls *");
        assert_eq!(events[3].1["request_id"], "per_1");
        assert_eq!(events[4].1["token"], "All ");
        assert_eq!(events[5].1["full_content"], "All done");
        assert_eq!(events[6].1["full_content"], "All done");

        // The chat's server session was persisted for the next turn.
        assert_eq!(
            read_config().sessions.get("chat-1").map(String::as_str),
            Some("ses_test1")
        );
    }

    /// The freeze bug: a fast model's delta burst must coalesce into a few
    /// token events, never one event per delta — the un-throttled version
    /// re-render-stormed the phone webview until iOS killed the app.
    #[tokio::test(flavor = "multi_thread")]
    async fn a_delta_burst_coalesces_into_few_token_events() {
        let _guard = CONFIG_TEST_LOCK.lock().await;
        let app = Router::new()
            .route("/session", post(|| async { Json(json!({ "id": "ses_burst" })) }))
            .route(
                "/session/{sid}/prompt_async",
                post(|| async { Json(json!({})) }),
            )
            .route(
                "/session/status",
                get(|| async { Json(json!({ "ses_burst": { "type": "idle" } })) }),
            )
            .route(
                "/event",
                get(|| async {
                    let mut events: Vec<Result<Event, std::convert::Infallible>> = (0..200)
                        .map(|i| {
                            Ok(Event::default().data(
                                json!({ "type": "message.part.delta", "properties": {
                                    "sessionID": "ses_burst", "messageID": "m", "partID": "p",
                                    "field": "text", "delta": format!("w{i} ") } })
                                .to_string(),
                            ))
                        })
                        .collect();
                    events.push(Ok(Event::default().data(
                        json!({ "type": "session.idle", "properties": { "sessionID": "ses_burst" } })
                            .to_string(),
                    )));
                    Sse::new(tokio_stream::iter(events))
                }),
            );
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
        test_config(&format!("http://{addr}"));

        let sink = Arc::new(VecSink(Mutex::new(Vec::new())));
        run_turn(
            sink.as_ref(),
            "chat-burst",
            &[json!({ "role": "user", "content": "go" })],
            "gen-burst",
            None,
            None,
            None,
            None,
        )
        .await
        .expect("turn succeeds");

        let events = sink.0.lock().unwrap().clone();
        let tokens: Vec<&(String, Value)> =
            events.iter().filter(|(n, _)| n == "ollama:token").collect();
        // 200 deltas in well under a second → the immediate first emit plus
        // the pre-done flush (and at most a couple of window rollovers).
        assert!(
            tokens.len() <= 6,
            "expected few coalesced token events, got {}",
            tokens.len()
        );
        // Nothing lost: the final done carries every word.
        let done = events.iter().find(|(n, _)| n == "ollama:done").unwrap();
        let full = done.1["full_content"].as_str().unwrap();
        assert!(full.starts_with("w0 ") && full.ends_with("w199 "));
        assert_eq!(full.matches(' ').count(), 200);
    }

    /// `session.error` is the one event upstream declares `sessionID`
    /// optional for (an unattributed provider/auth failure). The bug this
    /// pins: the session gate dropped it, the phone streamed nothing, and
    /// the idle probe later reported a bogus "went idle without a reply".
    /// Also pins that a failed turn reports EXACTLY one `ollama:error`
    /// (the engine and the command boundary used to both emit).
    #[tokio::test(flavor = "multi_thread")]
    async fn an_unattributed_session_error_surfaces_once() {
        let _guard = CONFIG_TEST_LOCK.lock().await;
        let app = Router::new()
            .route(
                "/session",
                post(|| async { Json(json!({ "id": "ses_err" })) }),
            )
            .route(
                "/session/{sid}/prompt_async",
                post(|| async { Json(json!({})) }),
            )
            .route(
                "/event",
                get(|| async {
                    let events: Vec<Result<Event, std::convert::Infallible>> =
                        vec![json!({ "type": "session.error", "properties": {
                            "error": { "name": "ProviderAuthError",
                                       "data": { "message": "invalid platform token" } } } })]
                        .into_iter()
                        .map(|v| Ok(Event::default().data(v.to_string())))
                        .collect();
                    Sse::new(tokio_stream::iter(events))
                }),
            );
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
        test_config(&format!("http://{addr}"));

        let sink = Arc::new(VecSink(Mutex::new(Vec::new())));
        let err = run_turn(
            sink.as_ref(),
            "chat-err",
            &[json!({ "role": "user", "content": "hi" })],
            "gen-err",
            None,
            None,
            None,
            None,
        )
        .await
        .expect_err("the real cause reaches the caller");
        assert_eq!(err, "invalid platform token");
        let events = sink.0.lock().unwrap().clone();
        let errors: Vec<_> = events.iter().filter(|(n, _)| n == "ollama:error").collect();
        assert_eq!(errors.len(), 1, "exactly one error event, got {events:?}");
        assert_eq!(errors[0].1["error"], "invalid platform token");
        assert_eq!(errors[0].1["generation_id"], "gen-err");
    }

    /// The bug this pins (PR review finding): `ensure_session` snapshotted
    /// the config BEFORE `ensure_directory` minted + recorded a folder, then
    /// wrote the stale snapshot back — the minted folder was lost and the
    /// next turn minted (and re-created a server session) again.
    #[tokio::test(flavor = "multi_thread")]
    async fn a_folder_minted_during_session_creation_survives_the_write_back() {
        let _guard = CONFIG_TEST_LOCK.lock().await;
        let app = Router::new()
            .route(
                "/session",
                post(|| async { Json(json!({ "id": "ses_minted" })) }),
            )
            .route(
                "/workspaces",
                post(|| async { Json(json!({ "path": "/desktop/phone-minted" })) }),
            );
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
        let base = format!("http://{addr}");
        test_config(&base);
        let mut cfg = read_config();
        cfg.mgmt = Some(base.clone());
        write_config(&cfg).unwrap();

        let remote = ensure_session(&base, "pw", "chat-mint", None, None, None)
            .await
            .unwrap();
        assert_eq!(remote, "ses_minted");
        let cfg = read_config();
        assert_eq!(
            cfg.directories.get("chat-mint").map(String::as_str),
            Some("/desktop/phone-minted"),
            "the folder minted inside ensure_directory must survive"
        );
        assert_eq!(
            cfg.sessions.get("chat-mint").map(String::as_str),
            Some("ses_minted")
        );
        assert_eq!(
            cfg.session_dirs.get("chat-mint").map(String::as_str),
            Some("/desktop/phone-minted")
        );
        // And the next turn reuses both instead of minting again.
        let again = ensure_session(&base, "pw", "chat-mint", None, None, None)
            .await
            .unwrap();
        assert_eq!(again, "ses_minted");
    }

    /// The bug this pins (PR review round 5, blocking): `ensure_session`
    /// snapshotted the config, awaited the session-create request, then
    /// wrote the whole snapshot back — so a config write that landed during
    /// that request (here: chat B recording its own new session, the
    /// "send in A, switch to B, send" flow) was overwritten. B's next turn
    /// then found no session, minted a second server session, and its
    /// conversation was lost. The fake server blocks A's create until B has
    /// written, so the window is hit deterministically.
    #[tokio::test(flavor = "multi_thread")]
    async fn a_session_created_during_another_chats_create_request_is_kept() {
        let _guard = CONFIG_TEST_LOCK.lock().await;
        // The create request for chat A parks until this is released.
        let gate = Arc::new(tokio::sync::Notify::new());
        let gate_route = gate.clone();
        let app = Router::new().route(
            "/session",
            post(move |Json(body): Json<Value>| {
                let gate = gate_route.clone();
                async move {
                    if body["title"] == "Phone chat" {
                        gate.notified().await;
                    }
                    Json(json!({ "id": "ses_a" }))
                }
            }),
        );
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
        let base = format!("http://{addr}");
        test_config(&base);

        // Chat A starts creating its session and is now parked inside the
        // request, holding whatever snapshot it took.
        let base_a = base.clone();
        let turn_a =
            tokio::spawn(
                async move { ensure_session(&base_a, "pw", "chat-a", None, None, None).await },
            );
        tokio::time::sleep(std::time::Duration::from_millis(200)).await;

        // Meanwhile chat B records its own session — the exact write the
        // old snapshot used to clobber.
        let mut cfg = read_config();
        cfg.sessions.insert("chat-b".into(), "ses_b".into());
        cfg.session_dirs
            .insert("chat-b".into(), "/desktop/b".into());
        write_config(&cfg).unwrap();

        gate.notify_one();
        let remote_a = turn_a.await.unwrap().unwrap();
        assert_eq!(remote_a, "ses_a");

        let cfg = read_config();
        assert_eq!(
            cfg.sessions.get("chat-b").map(String::as_str),
            Some("ses_b"),
            "chat B's session must survive chat A's write-back"
        );
        assert_eq!(
            cfg.session_dirs.get("chat-b").map(String::as_str),
            Some("/desktop/b")
        );
        assert_eq!(
            cfg.sessions.get("chat-a").map(String::as_str),
            Some("ses_a")
        );
    }

    /// The bug this pins (PR review finding): scanning ANOTHER desktop's QR
    /// while the current one is unreachable re-pairs without clear_host, so
    /// the first machine's absolute folder paths and session ids were
    /// carried over. Re-pairing with the SAME desktop (a known address, or
    /// a payload that lists the stored one) must keep them.
    #[tokio::test(flavor = "multi_thread")]
    async fn re_pairing_with_another_desktop_forgets_its_folders() {
        let _guard = CONFIG_TEST_LOCK.lock().await;
        let app = Router::new().route(
            "/path",
            get(|| async { Json(json!({ "directory": "/desktop-b/phone" })) }),
        );
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
        let desktop_b = format!("http://{addr}");

        let seed = |url: &str, alt: Vec<String>| {
            test_config(url);
            let mut cfg = read_config();
            cfg.alt_urls = alt;
            cfg.sessions.insert("c1".into(), "ses_a".into());
            cfg.session_dirs.insert("c1".into(), "/desktop-a/x".into());
            cfg.directories.insert("c1".into(), "/desktop-a/x".into());
            cfg.mentor_directories
                .insert(mentor_key("t", "m"), "/desktop-a/y".into());
            write_config(&cfg).unwrap();
        };

        // Another machine: everything desktop-specific goes.
        seed("http://192.168.1.10:4096", vec![]);
        remote_code_set_host(desktop_b.clone(), "pw".into(), None, None)
            .await
            .unwrap();
        let cfg = read_config();
        assert_eq!(cfg.url.as_deref(), Some(desktop_b.as_str()));
        assert!(cfg.sessions.is_empty());
        assert!(cfg.session_dirs.is_empty());
        assert!(cfg.directories.is_empty());
        assert!(cfg.mentor_directories.is_empty());

        // Same machine, re-scanned: kept.
        seed(&desktop_b, vec![]);
        remote_code_set_host(desktop_b.clone(), "pw".into(), None, None)
            .await
            .unwrap();
        assert_eq!(
            read_config().sessions.get("c1").map(String::as_str),
            Some("ses_a")
        );

        // Same machine reached through another interface — the new payload
        // still lists the address we were paired to: kept.
        seed("http://10.8.0.2:4096", vec![]);
        remote_code_set_host(
            desktop_b.clone(),
            "pw".into(),
            None,
            Some(vec!["http://10.8.0.2:4096".into(), desktop_b.clone()]),
        )
        .await
        .unwrap();
        assert_eq!(
            read_config().sessions.get("c1").map(String::as_str),
            Some("ses_a")
        );

        // Same machine, the new address is one of the stored alternates: kept.
        seed("http://10.8.0.2:4096", vec![desktop_b.clone()]);
        remote_code_set_host(desktop_b.clone(), "pw".into(), None, None)
            .await
            .unwrap();
        assert_eq!(
            read_config().sessions.get("c1").map(String::as_str),
            Some("ses_a")
        );
    }

    #[test]
    fn companion_port_does_not_wrap_past_the_last_port() {
        // A hand-typed URL reaches this: 65535 + 1 panicked in debug and
        // wrapped to port 0 in release.
        assert_eq!(
            companion_of("http://10.0.0.2:4096").as_deref(),
            Some("http://10.0.0.2:4097")
        );
        assert!(companion_of("http://10.0.0.2:65535").is_none());
        assert!(companion_of("http://no-port").is_none());
    }

    /// An abort error ends the turn as a normal done, not a failure — a Stop
    /// press must not paint the chat red.
    #[tokio::test(flavor = "multi_thread")]
    async fn an_aborted_turn_finishes_as_done() {
        let _guard = CONFIG_TEST_LOCK.lock().await;
        let app = Router::new()
            .route(
                "/session",
                post(|| async { Json(json!({ "id": "ses_ab" })) }),
            )
            .route(
                "/session/{sid}/prompt_async",
                post(|| async { Json(json!({})) }),
            )
            .route(
                "/event",
                get(|| async {
                    let events: Vec<Result<Event, std::convert::Infallible>> =
                        vec![json!({ "type": "session.error", "properties": {
                            "sessionID": "ses_ab",
                            "error": { "name": "MessageAbortedError", "data": {} } } })]
                        .into_iter()
                        .map(|v| Ok(Event::default().data(v.to_string())))
                        .collect();
                    Sse::new(tokio_stream::iter(events))
                }),
            );
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });

        test_config(&format!("http://{addr}"));

        let sink = Arc::new(VecSink(Mutex::new(Vec::new())));
        run_turn(
            sink.as_ref(),
            "chat-ab",
            &[json!({ "role": "user", "content": "hi" })],
            "gen-ab",
            None,
            None,
            None,
            None,
        )
        .await
        .expect("abort is a clean finish");
        let events = sink.0.lock().unwrap().clone();
        assert_eq!(events.last().unwrap().0, "ollama:done");
        assert_eq!(events.last().unwrap().1["stop_reason"], "aborted");
    }

    #[test]
    fn catch_up_to_emits_only_the_unseen_suffix() {
        let mut c = TokenCoalescer::new();
        // Nothing streamed, nothing on the desktop: nothing to say.
        assert_eq!(c.catch_up_to(""), None);
        // Held-back tail plus what the desktop has beyond it: one delta.
        let _ = c.push("Hel"); // first push flushes
        assert_eq!(c.push("lo"), None); // inside the window: pending
        assert_eq!(c.catch_up_to("Hello world").as_deref(), Some("lo world"));
        assert_eq!(c.full_content(), "Hello world");
        assert_eq!(c.catch_up_to("Hello world"), None);
        // The desktop's copy diverged: adopt it whole.
        assert_eq!(c.catch_up_to("Other").as_deref(), Some("Other"));
        assert_eq!(c.full_content(), "Other");
    }

    /// The iOS Local Network prompt: the first sockets an app opens toward
    /// the LAN fail outright while the prompt is up, and only after the
    /// user taps Allow do they connect. Modelled here as a desktop that is
    /// not listening for the first 1.5 s: the ONE scan must still pair.
    #[tokio::test(flavor = "multi_thread")]
    async fn pairing_keeps_probing_until_the_desktop_answers() {
        let _guard = CONFIG_TEST_LOCK.lock().await;
        // Reserve a port, then free it: nothing answers there until the
        // desktop "appears".
        let probe = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let addr = probe.local_addr().unwrap();
        drop(probe);
        tokio::spawn(async move {
            tokio::time::sleep(std::time::Duration::from_millis(1500)).await;
            let app = Router::new().route(
                "/path",
                get(|| async { Json(json!({ "directory": "/late/phone" })) }),
            );
            let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
            axum::serve(listener, app).await.unwrap();
        });
        test_config("");
        let started = std::time::Instant::now();
        let out = remote_code_set_host(format!("http://{addr}"), "pw".into(), None, None)
            .await
            .expect("the scan that raised the prompt is the scan that pairs");
        assert_eq!(out["directory"], "/late/phone");
        assert!(
            started.elapsed() >= std::time::Duration::from_millis(1200),
            "must have waited for the desktop"
        );
        assert!(started.elapsed() < std::time::Duration::from_secs(PAIR_WINDOW_SECS));
        assert_eq!(
            read_config().url.as_deref(),
            Some(format!("http://{addr}").as_str())
        );
    }

    /// A QR carries one address per desktop interface; the phone can reach
    /// only some of them. All are probed at once and whichever answers is
    /// the one paired with — the dead one stays as an alternate.
    #[tokio::test(flavor = "multi_thread")]
    async fn pairing_pairs_with_whichever_advertised_address_answers() {
        let _guard = CONFIG_TEST_LOCK.lock().await;
        let dead = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let dead_url = format!("http://{}", dead.local_addr().unwrap());
        drop(dead);
        let app = Router::new().route(
            "/path",
            get(|| async { Json(json!({ "directory": "/live/phone" })) }),
        );
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let live_url = format!("http://{}", listener.local_addr().unwrap());
        tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
        test_config("");
        let started = std::time::Instant::now();
        let out = remote_code_set_host(
            dead_url.clone(),
            "pw".into(),
            None,
            Some(vec![dead_url.clone(), live_url.clone()]),
        )
        .await
        .expect("the reachable address pairs");
        assert_eq!(out["url"], live_url);
        assert!(
            started.elapsed() < std::time::Duration::from_secs(3),
            "candidates race; the dead one must not hold the pairing"
        );
        let cfg = read_config();
        assert_eq!(cfg.url.as_deref(), Some(live_url.as_str()));
        assert_eq!(cfg.alt_urls, vec![dead_url]);
    }

    /// A desktop that answers and says no (wrong password) is not a network
    /// problem: no point holding the user for the whole probe window.
    #[tokio::test(flavor = "multi_thread")]
    async fn a_refused_password_fails_the_pairing_at_once() {
        let _guard = CONFIG_TEST_LOCK.lock().await;
        let app = Router::new().route(
            "/path",
            get(|| async { (axum::http::StatusCode::UNAUTHORIZED, "nope") }),
        );
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
        test_config("");
        let started = std::time::Instant::now();
        let err = remote_code_set_host(format!("http://{addr}"), "bad".into(), None, None)
            .await
            .expect_err("a 401 is a failure");
        assert!(err.contains("401"), "got: {err}");
        assert!(started.elapsed() < std::time::Duration::from_secs(3));
        assert_eq!(
            read_config().url.as_deref().unwrap_or(""),
            "",
            "nothing is persisted"
        );
    }

    /// One turn server: `/event` serves `first` and then ENDS the stream
    /// (what the phone sees after the OS reclaimed its socket), and serves
    /// `second` to every later subscriber. `messages` is the desktop's copy
    /// of the reply for the catch-up; `status` answers `/session/status`
    /// per call, last value repeating.
    fn dropped_stream_server(
        first: Vec<Value>,
        second: Vec<Value>,
        messages: Value,
        status: Vec<&'static str>,
    ) -> (Router, Arc<std::sync::atomic::AtomicUsize>) {
        let subs = Arc::new(std::sync::atomic::AtomicUsize::new(0));
        let subs_route = subs.clone();
        let status_calls = Arc::new(std::sync::atomic::AtomicUsize::new(0));
        let app = Router::new()
            .route(
                "/session",
                post(|| async { Json(json!({ "id": "ses_r" })) }),
            )
            .route("/question", get(|| async { Json(json!([])) }))
            .route("/permission", get(|| async { Json(json!([])) }))
            .route(
                "/session/{sid}/message",
                get(move || {
                    let messages = messages.clone();
                    async move { Json(messages) }
                }),
            )
            .route(
                "/session/status",
                get(move || {
                    let calls = status_calls.clone();
                    let status = status.clone();
                    async move {
                        let n = calls.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
                        let state = status[n.min(status.len() - 1)];
                        Json(json!({ "ses_r": { "type": state } }))
                    }
                }),
            )
            .route(
                "/session/{sid}/prompt_async",
                post(|| async { Json(json!({})) }),
            )
            .route(
                "/event",
                get(move || {
                    let subs = subs_route.clone();
                    let first = first.clone();
                    let second = second.clone();
                    async move {
                        let n = subs.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
                        let events: Vec<Result<Event, std::convert::Infallible>> =
                            if n == 0 { first } else { second }
                                .into_iter()
                                .map(|v| Ok(Event::default().data(v.to_string())))
                                .collect();
                        if n == 0 {
                            // Ends: the socket is gone.
                            Sse::new(tokio_stream::iter(events).boxed())
                        } else {
                            Sse::new(
                                tokio_stream::iter(events)
                                    .chain(tokio_stream::pending())
                                    .boxed(),
                            )
                        }
                    }
                }),
            );
        (app, subs)
    }

    fn delta(text: &str) -> Value {
        json!({ "type": "message.part.delta", "properties": {
            "sessionID": "ses_r", "messageID": "m1", "partID": "px",
            "field": "text", "delta": text } })
    }

    fn reply_messages(text: &str, tool: Option<Value>) -> Value {
        let mut parts = vec![json!({ "id": "px", "type": "text", "text": text })];
        parts.extend(tool);
        json!([
            { "info": { "id": "m0", "role": "user" }, "parts": [] },
            { "info": { "id": "m1", "role": "assistant", "parentID": "m0" }, "parts": parts }
        ])
    }

    async fn run_dropped_stream_turn(
        app: Router,
        chat: &str,
    ) -> (Result<(), String>, Vec<(String, Value)>) {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
        test_config(&format!("http://{addr}"));
        let sink = Arc::new(VecSink(Mutex::new(Vec::new())));
        let result = tokio::time::timeout(
            std::time::Duration::from_secs(20),
            run_turn(
                sink.as_ref(),
                chat,
                &[json!({ "role": "user", "content": "build it" })],
                "gen-r",
                None,
                None,
                None,
                None,
            ),
        )
        .await
        .expect("the turn must end, not hang");
        let events = sink.0.lock().unwrap().clone();
        (result, events)
    }

    /// The phone locks mid-turn: iOS drops the SSE socket. The desktop is
    /// still working, so the turn resubscribes, catches up, and finishes
    /// from the new stream — instead of dying with "event stream broke".
    #[tokio::test(flavor = "multi_thread")]
    async fn a_dropped_event_stream_is_reconnected_and_the_turn_continues() {
        let _guard = CONFIG_TEST_LOCK.lock().await;
        let (app, subs) = dropped_stream_server(
            vec![
                json!({ "type": "server.connected", "properties": {} }),
                delta("Hello"),
            ],
            vec![
                delta(" world"),
                json!({ "type": "session.idle", "properties": { "sessionID": "ses_r" } }),
            ],
            reply_messages("Hello", None),
            // Busy at catch-up, idle when the real end arrives.
            vec!["working", "idle"],
        );
        let (result, events) = run_dropped_stream_turn(app, "chat-r1").await;
        result.expect("a dropped stream is not a failed turn");
        assert_eq!(subs.load(std::sync::atomic::Ordering::SeqCst), 2);
        let names: Vec<&str> = events.iter().map(|(n, _)| n.as_str()).collect();
        assert!(!names.contains(&"ollama:error"), "got: {events:?}");
        assert_eq!(names.iter().filter(|n| **n == "ollama:done").count(), 1);
        assert_eq!(events.last().unwrap().1["full_content"], "Hello world");
    }

    /// Locked for longer than the turn took: by the time the phone is back
    /// the desktop is idle with the finished reply. The catch-up renders
    /// the rest of the reply and its tool calls from the desktop's copy and
    /// ends the turn — no `session.idle` will ever arrive for it.
    #[tokio::test(flavor = "multi_thread")]
    async fn a_turn_that_finished_while_the_stream_was_down_completes_from_the_desktop_copy() {
        let _guard = CONFIG_TEST_LOCK.lock().await;
        let (app, subs) = dropped_stream_server(
            vec![
                json!({ "type": "server.connected", "properties": {} }),
                delta("Hel"),
            ],
            vec![],
            reply_messages(
                "Hello world",
                Some(
                    json!({ "id": "pt", "type": "tool", "callID": "call9", "tool": "bash",
                    "state": { "status": "completed", "input": { "command": "ls" }, "output": "ok" } }),
                ),
            ),
            vec!["idle"],
        );
        let (result, events) = run_dropped_stream_turn(app, "chat-r2").await;
        result.expect("the finished turn completes cleanly");
        assert_eq!(subs.load(std::sync::atomic::Ordering::SeqCst), 2);
        let names: Vec<&str> = events.iter().map(|(n, _)| n.as_str()).collect();
        assert_eq!(names.iter().filter(|n| **n == "ollama:done").count(), 1);
        let tool = events
            .iter()
            .find(|(n, _)| n == "opencode:tool_call")
            .expect("the tool call made while away is shown");
        assert_eq!(tool.1["update"]["toolCallId"], "call9");
        assert_eq!(tool.1["update"]["status"], "completed");
        let token = events
            .iter()
            .filter(|(n, _)| n == "ollama:token")
            .last()
            .expect("the rest of the reply is emitted");
        assert_eq!(token.1["token"], "lo world");
        assert_eq!(token.1["full_content"], "Hello world");
        assert_eq!(events.last().unwrap().1["full_content"], "Hello world");
    }

    /// Coming back to the foreground reconnects at once — the OS reclaims a
    /// suspended app's sockets without a FIN, so a stream that LOOKS open
    /// cannot be trusted.
    #[tokio::test(flavor = "multi_thread")]
    async fn a_foreground_return_reconnects_the_stream() {
        let _guard = CONFIG_TEST_LOCK.lock().await;
        let subs = Arc::new(std::sync::atomic::AtomicUsize::new(0));
        let subs_route = subs.clone();
        let status_calls = Arc::new(std::sync::atomic::AtomicUsize::new(0));
        let app = Router::new()
            .route("/session", post(|| async { Json(json!({ "id": "ses_r" })) }))
            .route("/question", get(|| async { Json(json!([])) }))
            .route("/permission", get(|| async { Json(json!([])) }))
            .route(
                "/session/{sid}/message",
                get(|| async { Json(reply_messages("", None)) }),
            )
            .route(
                "/session/status",
                get(move || {
                    let calls = status_calls.clone();
                    async move {
                        let n = calls.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
                        let state = if n == 0 { "working" } else { "idle" };
                        Json(json!({ "ses_r": { "type": state } }))
                    }
                }),
            )
            .route(
                "/session/{sid}/prompt_async",
                post(|| async { Json(json!({})) }),
            )
            .route(
                "/event",
                get(move || {
                    let subs = subs_route.clone();
                    async move {
                        let n = subs.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
                        if n == 0 {
                            // Alive and heartbeating: nothing says it is stale.
                            let beats = tokio_stream::wrappers::IntervalStream::new(
                                tokio::time::interval(std::time::Duration::from_millis(100)),
                            )
                            .map(|_| {
                                Ok::<_, std::convert::Infallible>(Event::default().data(
                                    json!({ "type": "server.heartbeat", "properties": {} })
                                        .to_string(),
                                ))
                            });
                            Sse::new(beats.boxed())
                        } else {
                            let events: Vec<Result<Event, std::convert::Infallible>> = vec![
                                delta("Back"),
                                json!({ "type": "session.idle", "properties": { "sessionID": "ses_r" } }),
                            ]
                            .into_iter()
                            .map(|v| Ok(Event::default().data(v.to_string())))
                            .collect();
                            Sse::new(
                                tokio_stream::iter(events)
                                    .chain(tokio_stream::pending())
                                    .boxed(),
                            )
                        }
                    }
                }),
            );
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
        test_config(&format!("http://{addr}"));
        let sink = Arc::new(VecSink(Mutex::new(Vec::new())));
        let turn = {
            let sink = sink.clone();
            tokio::spawn(async move {
                run_turn(
                    sink.as_ref(),
                    "chat-r3",
                    &[json!({ "role": "user", "content": "build it" })],
                    "gen-r",
                    None,
                    None,
                    None,
                    None,
                )
                .await
            })
        };
        // Wait for the first subscription to be live, then "unlock".
        while subs.load(std::sync::atomic::Ordering::SeqCst) == 0 {
            tokio::time::sleep(std::time::Duration::from_millis(20)).await;
        }
        tokio::time::sleep(std::time::Duration::from_millis(300)).await;
        assert_eq!(subs.load(std::sync::atomic::Ordering::SeqCst), 1);
        app_resumed();
        tokio::time::timeout(std::time::Duration::from_secs(10), turn)
            .await
            .expect("the turn must end")
            .unwrap()
            .expect("a foreground return is not a failed turn");
        assert_eq!(subs.load(std::sync::atomic::Ordering::SeqCst), 2);
        let events = sink.0.lock().unwrap().clone();
        assert_eq!(events.last().unwrap().0, "ollama:done");
        assert_eq!(events.last().unwrap().1["full_content"], "Back");
    }

    /// The app force-quit mid-turn (no Suspended/Resumed — the process is
    /// gone): the next launch must stop the abandoned turn on the desktop,
    /// leave a finished one alone, and forget both.
    #[tokio::test(flavor = "multi_thread")]
    async fn turns_abandoned_by_a_killed_app_are_stopped_on_the_next_launch() {
        let _guard = CONFIG_TEST_LOCK.lock().await;
        let aborted: Arc<Mutex<Vec<String>>> = Arc::new(Mutex::new(Vec::new()));
        let aborted_route = aborted.clone();
        let app = Router::new()
            .route(
                "/session/status",
                get(|| async {
                    Json(json!({ "ses_busy": { "type": "busy" }, "ses_done": { "type": "idle" } }))
                }),
            )
            .route(
                "/session/{sid}/abort",
                post(
                    move |axum::extract::Path(sid): axum::extract::Path<String>| {
                        let aborted = aborted_route.clone();
                        async move {
                            aborted.lock().unwrap().push(sid);
                            Json(json!({}))
                        }
                    },
                ),
            );
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
        test_config(&format!("http://{addr}"));
        let mut cfg = read_config();
        cfg.in_flight.insert("ses_busy".into(), String::new());
        cfg.in_flight.insert("ses_done".into(), "/w/x".into());
        write_config(&cfg).unwrap();

        abort_abandoned_turns().await;

        assert_eq!(*aborted.lock().unwrap(), vec!["ses_busy".to_string()]);
        assert!(read_config().in_flight.is_empty(), "forgotten either way");
    }

    /// A running turn is recorded for as long as it runs — and only that
    /// long, whichever way it ends.
    #[tokio::test]
    async fn a_turn_is_in_flight_exactly_while_it_runs() {
        let _guard = CONFIG_TEST_LOCK.lock().await;
        test_config("http://127.0.0.1:1");
        {
            let _marker = InFlight::mark("ses_1", Some("/w/a"));
            assert_eq!(
                read_config().in_flight.get("ses_1").map(String::as_str),
                Some("/w/a")
            );
        }
        assert!(read_config().in_flight.is_empty());
    }
}
