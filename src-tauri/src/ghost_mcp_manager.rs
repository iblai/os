//! Rust-owned `ghost mcp` process for in-chat Computer Use.
//!
//! ## Why this exists
//!
//! Typing into transient overlays like **Spotlight** is only possible through
//! synthetic keystrokes (`CGEvent` posted to the HID tap). macOS delivers those
//! events only when the process posting them inherits the app's **Accessibility**
//! trust. A `ghost` spawned from the webview via `tauri-plugin-shell` does *not*
//! inherit that trust — its synthetic keystrokes are silently dropped, so
//! Spotlight stays open but empty. A `ghost` spawned as a plain child of the app
//! from the Rust backend *does* inherit it — matching the old `ollama-mcp-bridge`
//! path (also a plain `std::process` child) that could type into Spotlight.
//!
//! So the Computer Use transport owns `ghost mcp` here instead of in the webview.
//! We keep ONE `ghost mcp` child alive per chat turn, forward JSON-RPC lines from
//! the webview to its stdin (`ghost_mcp_send`), and stream its stdout lines back
//! to the webview as `ghost-mcp:message` events. This is the on-device half of a
//! standard MCP stdio transport — the webview runs the MCP client.
//!
//! Deliberately NOT detached (`setsid`/new process group): ghost must stay a
//! well-attached child of the app so it inherits the app's Accessibility trust.

use std::io::{BufRead, BufReader, Write};
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::{Mutex, OnceLock};

use tauri::{command, AppHandle, Emitter};

/// TEMP diagnostics: tee the JSON-RPC responses and ghost's stderr to this file
/// so Spotlight-typing failures can be inspected without a running console.
/// Remove once the Computer Use transport is confirmed working.
const DEBUG_LOG: &str = "/tmp/ibl-ghost-mcp.log";

fn debug_log(prefix: &str, line: &str) {
    println!("[ghost-mcp {prefix}] {line}");
    if let Ok(mut f) = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(DEBUG_LOG)
    {
        let _ = writeln!(f, "[{prefix}] {line}");
    }
}

/// stdout line from `ghost mcp` (one JSON-RPC message per line).
const EVENT_MESSAGE: &str = "ghost-mcp:message";
/// Emitted once when the `ghost mcp` process exits (stdout closed).
const EVENT_CLOSED: &str = "ghost-mcp:closed";

/// The live `ghost mcp` child and a handle to its stdin. `None` when not running.
struct GhostProc {
    child: Child,
    stdin: ChildStdin,
}

static GHOST: OnceLock<Mutex<Option<GhostProc>>> = OnceLock::new();

fn slot() -> &'static Mutex<Option<GhostProc>> {
    GHOST.get_or_init(|| Mutex::new(None))
}

/// Resolve a runnable `ghost`: PATH first, then the Homebrew bins and
/// `~/.local/bin` (a GUI app's PATH often omits them; the no-Homebrew fallback
/// installs to `~/.local/bin`). Mirrors `ghost_os_manager::resolve_bin`.
fn resolve_ghost() -> Option<String> {
    let on_path = Command::new("ghost")
        .arg("--version")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false);
    if on_path {
        return Some("ghost".to_string());
    }

    #[cfg(target_os = "macos")]
    {
        let mut bases = vec![
            std::path::PathBuf::from("/opt/homebrew/bin"),
            std::path::PathBuf::from("/usr/local/bin"),
        ];
        if let Ok(home) = std::env::var("HOME") {
            bases.push(std::path::PathBuf::from(home).join(".local").join("bin"));
        }
        for base in bases {
            let p = base.join("ghost");
            if p.exists() {
                return Some(p.to_string_lossy().into_owned());
            }
        }
    }
    None
}

/// PATH for the spawned `ghost`: prepend `~/.local/bin` and the Homebrew bins so
/// `ghost` finds its `ghost-vision` sidecar even when they aren't on the app's
/// PATH. Mirrors `mcp_bridge_manager::macos_server_path`.
#[cfg(target_os = "macos")]
fn ghost_path_env() -> String {
    let mut parts: Vec<String> = Vec::new();
    if let Ok(home) = std::env::var("HOME") {
        parts.push(
            std::path::PathBuf::from(home)
                .join(".local")
                .join("bin")
                .to_string_lossy()
                .into_owned(),
        );
    }
    parts.push("/opt/homebrew/bin".to_string());
    parts.push("/usr/local/bin".to_string());
    if let Ok(existing) = std::env::var("PATH") {
        parts.push(existing);
    }
    parts.join(":")
}

/// Start (or reuse) the `ghost mcp` child. Idempotent: if a live process already
/// exists this is a no-op, so the webview can call it at the top of every turn.
#[command]
pub async fn ghost_mcp_start(app: AppHandle) -> Result<(), String> {
    let mut guard = slot().lock().map_err(|_| "ghost mcp lock poisoned")?;

    // Reuse a still-running process; clear a dead one so we respawn below.
    if let Some(proc) = guard.as_mut() {
        match proc.child.try_wait() {
            Ok(None) => return Ok(()),
            _ => {
                *guard = None;
            }
        }
    }

    let bin = resolve_ghost().ok_or_else(|| {
        "GhostOS (`ghost`) is not installed. Install it from User Profile → Advanced → System Control.".to_string()
    })?;

    let mut cmd = Command::new(&bin);
    cmd.arg("mcp")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        // TEMP: capture stderr for diagnostics instead of discarding it.
        .stderr(Stdio::piped());
    #[cfg(target_os = "macos")]
    cmd.env("PATH", ghost_path_env());

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Failed to spawn `ghost mcp`: {e}"))?;

    let stdin = child.stdin.take().ok_or("ghost mcp: no stdin handle")?;
    let stdout = child.stdout.take().ok_or("ghost mcp: no stdout handle")?;
    let stderr = child.stderr.take().ok_or("ghost mcp: no stderr handle")?;

    // TEMP: ghost's own logs (Accessibility/trust errors surface here).
    std::thread::spawn(move || {
        let reader = BufReader::new(stderr);
        for line in reader.lines().map_while(Result::ok) {
            debug_log("stderr", &line);
        }
    });

    // Pump stdout → webview. MCP writes one JSON-RPC message per line; forward
    // each non-empty line verbatim and let the webview's MCP client parse it.
    let reader_app = app.clone();
    std::thread::spawn(move || {
        let reader = BufReader::new(stdout);
        for line in reader.lines().map_while(Result::ok) {
            if line.trim().is_empty() {
                continue;
            }
            // TEMP: tee JSON-RPC responses (tool results incl. ghost_type) to log.
            debug_log("rpc", &line);
            let _ = reader_app.emit(EVENT_MESSAGE, line);
        }
        // stdout closed ⇒ the process is gone; tell the webview so it can reset.
        let _ = reader_app.emit(EVENT_CLOSED, ());
    });

    *guard = Some(GhostProc { child, stdin });
    Ok(())
}

/// Forward one JSON-RPC message (a single line) to `ghost mcp`'s stdin.
#[command]
pub async fn ghost_mcp_send(line: String) -> Result<(), String> {
    let mut guard = slot().lock().map_err(|_| "ghost mcp lock poisoned")?;
    let proc = guard
        .as_mut()
        .ok_or("ghost mcp is not running; call ghost_mcp_start first")?;

    debug_log("send", line.trim());
    proc.stdin
        .write_all(line.as_bytes())
        .map_err(|e| format!("ghost mcp stdin write failed: {e}"))?;
    if !line.ends_with('\n') {
        proc.stdin
            .write_all(b"\n")
            .map_err(|e| format!("ghost mcp stdin write failed: {e}"))?;
    }
    proc.stdin
        .flush()
        .map_err(|e| format!("ghost mcp stdin flush failed: {e}"))?;
    Ok(())
}

/// Kill the `ghost mcp` child (best-effort). Safe to call when not running.
#[command]
pub async fn ghost_mcp_stop() -> Result<(), String> {
    let mut guard = slot().lock().map_err(|_| "ghost mcp lock poisoned")?;
    if let Some(mut proc) = guard.take() {
        let _ = proc.child.kill();
        let _ = proc.child.wait();
    }
    Ok(())
}
