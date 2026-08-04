//! Rust-owned `cua-driver mcp` process for in-chat Computer Use ("Cowork").
//!
//! ## Why the process lives here and not in the webview
//!
//! The driver posts synthetic input and captures the screen. macOS only permits
//! that when the posting process inherits the app's **Accessibility** and
//! **Screen Recording** trust, and TCC attributes those grants to a responsible
//! app identity rather than to an executable path. A child spawned from the
//! webview via `tauri-plugin-shell` does not inherit the grants — its synthetic
//! events are silently dropped. A plain child of the app spawned from Rust does.
//! `cua-driver mcp --direct` deliberately adopts the spawning host's TCC
//! attribution, which is exactly this case.
//!
//! So the Cowork transport owns `cua-driver mcp` here instead of in the webview.
//! We keep ONE child alive, forward JSON-RPC lines from the webview to its stdin
//! (`cua_driver_send`), and stream its stdout lines back as `cua-driver:message`
//! events. This is the on-device half of a standard MCP stdio transport — the
//! webview runs the MCP client.
//!
//! The child is deliberately NOT detached (no `setsid` / new process group): it
//! must stay a well-attached child of the app to inherit those grants.

#![cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]

use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::{Mutex, OnceLock};

use serde::Serialize;
use tauri::{command, AppHandle, Emitter};

use crate::opencode_acp::iblai_data_dir;

/// stdout line from `cua-driver mcp` (one JSON-RPC message per line).
const EVENT_MESSAGE: &str = "cua-driver:message";
/// Emitted once when the process exits (stdout closed).
const EVENT_CLOSED: &str = "cua-driver:closed";

/// How much of a JSON-RPC line is echoed to stdout.
///
/// Not a style choice: a `screenshot`/capture result carries a base64 image, so
/// a single message can run to megabytes. Logging those whole would bury the
/// tool calls you actually want to read and slow the turn down by writing them.
const LOG_MAX_CHARS: usize = 2000;

/// Truncate on a char boundary. Slicing a `String` at a byte index panics
/// mid-codepoint, and tool arguments carry arbitrary user text.
fn truncate_utf8(s: &str, max: usize) -> &str {
    if s.len() <= max {
        return s;
    }
    let mut end = max;
    while end > 0 && !s.is_char_boundary(end) {
        end -= 1;
    }
    &s[..end]
}

/// Echo one JSON-RPC line to stdout. `direction` is `->` (to the driver) or
/// `<-` (from it), so a turn reads as an interleaved transcript.
fn log_rpc(direction: &str, line: &str) {
    let line = line.trim();
    if line.is_empty() {
        return;
    }
    let shown = truncate_utf8(line, LOG_MAX_CHARS);
    if shown.len() < line.len() {
        println!(
            "[cua-driver {direction}] {shown}… (+{} bytes truncated)",
            line.len() - shown.len()
        );
    } else {
        println!("[cua-driver {direction}] {shown}");
    }
}

/// Bare program name, resolved through the augmented PATH so a system install
/// wins and our managed copy only fills the gap.
pub fn cua_driver_program() -> String {
    if cfg!(target_os = "windows") {
        "cua-driver.exe".to_string()
    } else {
        "cua-driver".to_string()
    }
}

/// Where our managed copy lives when the driver isn't already on PATH.
pub fn cua_driver_bin() -> PathBuf {
    iblai_data_dir().join("bin").join(cua_driver_program())
}

// ---------------------------------------------------------------------------
// Session support
// ---------------------------------------------------------------------------

/// Machine-readable reason a session is unsupported. The UI maps these to
/// translated strings — never render them raw.
pub mod reason {
    pub const UNSUPPORTED_OS: &str = "unsupported_os";
    pub const KDE_UNPROVEN: &str = "kde_unproven";
    pub const GNOME_HELPER_MISSING: &str = "gnome_helper_missing";
    pub const UNKNOWN_SESSION: &str = "unknown_session";
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct DriverSupport {
    pub supported: bool,
    /// `None` when supported; otherwise one of [`reason`].
    pub reason: Option<String>,
}

impl DriverSupport {
    fn yes() -> Self {
        Self {
            supported: true,
            reason: None,
        }
    }
    fn no(reason: &str) -> Self {
        Self {
            supported: false,
            reason: Some(reason.to_string()),
        }
    }
}

/// The environment facts session support is decided from. Split out so the
/// decision itself is a pure function and testable without a desktop.
#[derive(Debug, Clone, Default)]
pub struct SessionEnv {
    /// `std::env::consts::OS`.
    pub os: String,
    /// `XDG_SESSION_TYPE` — "x11" | "wayland" | "".
    pub session_type: String,
    /// `XDG_CURRENT_DESKTOP`, possibly colon-separated ("ubuntu:GNOME").
    pub desktop: String,
    /// `SWAYSOCK` is set.
    pub sway: bool,
    /// The WinRects GNOME Shell helper is installed.
    pub gnome_helper: bool,
}

/// Whether the current desktop session is one cua-driver has proven behaviour on.
///
/// Windows and macOS are supported wholesale. Linux is decided per display server
/// and compositor because Wayland protocols are capabilities, not one uniform API
/// — this mirrors upstream's own `docs/action-support.md` ledger:
///
/// | Environment | Upstream evidence |
/// | --- | --- |
/// | X11 | 116/116 accepted |
/// | Sway/wlroots | 116/116 accepted |
/// | GNOME/Mutter | 31/31 GTK3, but only with the WinRects helper |
/// | KDE/KWin | no accepted behavioural matrix — input refuses |
///
/// Refusing up front is deliberate: a half-working agent that silently drops
/// clicks is worse than one that says it cannot run here.
pub fn session_support(env: &SessionEnv) -> DriverSupport {
    match env.os.as_str() {
        "windows" | "macos" => return DriverSupport::yes(),
        "linux" => {}
        _ => return DriverSupport::no(reason::UNSUPPORTED_OS),
    }

    // X11 is accepted regardless of which window manager is drawing it.
    if env.session_type.eq_ignore_ascii_case("x11") {
        return DriverSupport::yes();
    }

    let desktop = env.desktop.to_ascii_lowercase();
    if env.sway || desktop.contains("sway") {
        return DriverSupport::yes();
    }
    if desktop.contains("gnome") {
        return if env.gnome_helper {
            DriverSupport::yes()
        } else {
            DriverSupport::no(reason::GNOME_HELPER_MISSING)
        };
    }
    if desktop.contains("kde") || desktop.contains("plasma") {
        return DriverSupport::no(reason::KDE_UNPROVEN);
    }
    DriverSupport::no(reason::UNKNOWN_SESSION)
}

/// The WinRects GNOME Shell helper upstream requires for target-bound input on
/// Mutter. Matched by name across the two standard extension roots rather than by
/// a hard-coded UUID, so a rename of the published extension cannot silently
/// report the helper as missing forever.
fn gnome_helper_present() -> bool {
    let mut roots = vec![PathBuf::from("/usr/share/gnome-shell/extensions")];
    if let Ok(home) = std::env::var("HOME") {
        roots.push(PathBuf::from(home).join(".local/share/gnome-shell/extensions"));
    }
    roots.iter().any(|root| {
        std::fs::read_dir(root)
            .map(|rd| {
                rd.flatten().any(|e| {
                    e.file_name()
                        .to_string_lossy()
                        .to_ascii_lowercase()
                        .contains("winrects")
                })
            })
            .unwrap_or(false)
    })
}

pub fn current_session_env() -> SessionEnv {
    SessionEnv {
        os: std::env::consts::OS.to_string(),
        session_type: std::env::var("XDG_SESSION_TYPE").unwrap_or_default(),
        desktop: std::env::var("XDG_CURRENT_DESKTOP").unwrap_or_default(),
        sway: std::env::var_os("SWAYSOCK").is_some(),
        gnome_helper: gnome_helper_present(),
    }
}

/// Whether Cowork can run on this machine, and why not when it cannot.
#[command]
pub async fn cua_driver_support() -> Result<DriverSupport, String> {
    Ok(session_support(&current_session_env()))
}

// ---------------------------------------------------------------------------
// The MCP child
// ---------------------------------------------------------------------------

/// The live `cua-driver mcp` child and a handle to its stdin.
struct DriverProc {
    child: Child,
    stdin: ChildStdin,
}

static DRIVER: OnceLock<Mutex<Option<DriverProc>>> = OnceLock::new();

fn slot() -> &'static Mutex<Option<DriverProc>> {
    DRIVER.get_or_init(|| Mutex::new(None))
}

/// Start (or reuse) the `cua-driver mcp` child. Idempotent: if a live process
/// already exists this is a no-op.
///
/// The webview holds ONE MCP session for the app's lifetime, so in practice this
/// spawns once — but it stays idempotent so a reconnect after the process dies
/// costs nothing extra.
#[command]
pub async fn cua_driver_start(app: AppHandle) -> Result<(), String> {
    let support = session_support(&current_session_env());
    if !support.supported {
        // Refuse loudly rather than spawn a driver that will drop every action.
        return Err(format!(
            "Cowork is not supported on this desktop session ({}).",
            support.reason.unwrap_or_default()
        ));
    }

    let mut guard = slot().lock().map_err(|_| "cua-driver lock poisoned")?;

    // Reuse a still-running process; clear a dead one so we respawn below.
    if let Some(proc) = guard.as_mut() {
        match proc.child.try_wait() {
            Ok(None) => return Ok(()),
            _ => *guard = None,
        }
    }

    let mut cmd = Command::new(cua_driver_program());
    // `--direct` makes this process own its runtime and adopt our TCC identity.
    //
    // `--grant existing-profile` lets the browser tools attach to the user's
    // real, logged-in Chromium rather than the isolated throwaway profile they
    // are otherwise limited to. Without it `browser_prepare` can only launch a
    // separate browser, so "do this in my browser" cannot see their tabs or
    // sessions. Note what the grant buys: for the life of this process the agent
    // can act as the user on every site they are signed into, and the grant is
    // session-wide rather than per-attachment. Upstream deliberately renders no
    // consent UI of its own — it expects the embedding app to, via
    // DriverAuthorizationHost. Until that is wired up this flag IS the consent.
    cmd.args(["mcp", "--direct", "--grant", "existing-profile"])
        .env("PATH", crate::opencode_acp::augmented_path())
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Failed to spawn `cua-driver mcp` (is the driver installed?): {e}"))?;

    let stdin = child.stdin.take().ok_or("cua-driver: no stdin handle")?;
    let stdout = child.stdout.take().ok_or("cua-driver: no stdout handle")?;
    let stderr = child.stderr.take().ok_or("cua-driver: no stderr handle")?;

    // The driver's own diagnostics (permission/trust errors surface here).
    std::thread::spawn(move || {
        for line in BufReader::new(stderr).lines().map_while(Result::ok) {
            eprintln!("[cua-driver] {line}");
        }
    });

    // Pump stdout → webview. MCP writes one JSON-RPC message per line; forward
    // each non-empty line verbatim and let the webview's MCP client parse it.
    let reader_app = app.clone();
    std::thread::spawn(move || {
        for line in BufReader::new(stdout).lines().map_while(Result::ok) {
            if line.trim().is_empty() {
                continue;
            }
            log_rpc("<-", &line);
            let _ = reader_app.emit(EVENT_MESSAGE, line);
        }
        // stdout closed ⇒ the process is gone; tell the webview so it can drop
        // its cached session and reconnect on the next turn.
        println!("[cua-driver] process exited (stdout closed)");
        let _ = reader_app.emit(EVENT_CLOSED, ());
    });

    println!(
        "[cua-driver] spawned `cua-driver mcp --direct --grant existing-profile` (pid {:?})",
        child.id()
    );
    *guard = Some(DriverProc { child, stdin });
    Ok(())
}

/// Forward one JSON-RPC message (a single line) to the driver's stdin.
#[command]
pub async fn cua_driver_send(line: String) -> Result<(), String> {
    let mut guard = slot().lock().map_err(|_| "cua-driver lock poisoned")?;
    let proc = guard
        .as_mut()
        .ok_or("cua-driver is not running; call cua_driver_start first")?;

    log_rpc("->", &line);
    proc.stdin
        .write_all(line.as_bytes())
        .map_err(|e| format!("cua-driver stdin write failed: {e}"))?;
    if !line.ends_with('\n') {
        proc.stdin
            .write_all(b"\n")
            .map_err(|e| format!("cua-driver stdin write failed: {e}"))?;
    }
    proc.stdin
        .flush()
        .map_err(|e| format!("cua-driver stdin flush failed: {e}"))?;
    Ok(())
}

/// Kill the driver child (best-effort). Safe to call when not running.
#[command]
pub async fn cua_driver_stop() -> Result<(), String> {
    let mut guard = slot().lock().map_err(|_| "cua-driver lock poisoned")?;
    if let Some(mut proc) = guard.take() {
        println!("[cua-driver] stopping (pid {:?})", proc.child.id());
        let _ = proc.child.kill();
        let _ = proc.child.wait();
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn linux(session_type: &str, desktop: &str) -> SessionEnv {
        SessionEnv {
            os: "linux".to_string(),
            session_type: session_type.to_string(),
            desktop: desktop.to_string(),
            ..Default::default()
        }
    }

    #[test]
    fn windows_and_macos_are_supported_wholesale() {
        for os in ["windows", "macos"] {
            let env = SessionEnv {
                os: os.to_string(),
                ..Default::default()
            };
            assert_eq!(session_support(&env), DriverSupport::yes(), "{os}");
        }
    }

    #[test]
    fn an_unknown_os_is_refused() {
        let env = SessionEnv {
            os: "freebsd".to_string(),
            ..Default::default()
        };
        assert_eq!(
            session_support(&env).reason.as_deref(),
            Some(reason::UNSUPPORTED_OS)
        );
    }

    #[test]
    fn x11_is_supported_whatever_the_desktop() {
        // The X11 matrix is accepted upstream regardless of window manager, so a
        // KDE-on-X11 session must NOT be caught by the KWin refusal below.
        for desktop in ["", "GNOME", "KDE", "openbox"] {
            assert!(
                session_support(&linux("x11", desktop)).supported,
                "x11/{desktop}"
            );
        }
    }

    #[test]
    fn sway_is_supported_via_either_signal() {
        assert!(session_support(&linux("wayland", "sway")).supported);
        let via_sock = SessionEnv {
            sway: true,
            ..linux("wayland", "")
        };
        assert!(session_support(&via_sock).supported);
    }

    #[test]
    fn gnome_wayland_needs_the_winrects_helper() {
        let bare = linux("wayland", "ubuntu:GNOME");
        assert_eq!(
            session_support(&bare).reason.as_deref(),
            Some(reason::GNOME_HELPER_MISSING)
        );

        let with_helper = SessionEnv {
            gnome_helper: true,
            ..bare
        };
        assert!(session_support(&with_helper).supported);
    }

    #[test]
    fn kde_wayland_is_refused_as_unproven() {
        for desktop in ["KDE", "plasma"] {
            assert_eq!(
                session_support(&linux("wayland", desktop))
                    .reason
                    .as_deref(),
                Some(reason::KDE_UNPROVEN),
                "{desktop}"
            );
        }
    }

    #[test]
    fn an_unrecognised_wayland_compositor_is_refused() {
        assert_eq!(
            session_support(&linux("wayland", "Hyprland"))
                .reason
                .as_deref(),
            Some(reason::UNKNOWN_SESSION)
        );
    }

    #[test]
    fn short_rpc_lines_are_logged_whole() {
        let line = r#"{"jsonrpc":"2.0","method":"tools/call"}"#;
        assert_eq!(truncate_utf8(line, LOG_MAX_CHARS), line);
    }

    #[test]
    fn a_long_capture_result_is_cut_short() {
        // A screenshot result is base64 and can run to megabytes; logging it
        // whole would bury the tool calls and slow the turn down.
        let line = "x".repeat(LOG_MAX_CHARS * 3);
        assert_eq!(truncate_utf8(&line, LOG_MAX_CHARS).len(), LOG_MAX_CHARS);
    }

    #[test]
    fn truncation_never_splits_a_codepoint() {
        // Tool arguments carry arbitrary user text, and slicing a String at a
        // byte index mid-codepoint panics — which would take down the send path.
        for max in 0..12 {
            let s = "héllo→wörld"; // 2- and 3-byte sequences at shifting offsets
            let cut = truncate_utf8(s, max);
            assert!(s.starts_with(cut), "max={max}");
            assert!(cut.len() <= max, "max={max}");
        }
    }

    #[test]
    fn the_managed_binary_sits_next_to_the_other_managed_tools() {
        let bin = cua_driver_bin();
        assert!(bin.ends_with(cua_driver_program()));
        assert!(bin.parent().unwrap().ends_with("bin"));
    }
}
