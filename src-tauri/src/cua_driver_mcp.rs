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

use std::collections::HashSet;
use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::{Mutex, OnceLock};

use serde::Serialize;
use serde_json::Value;
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
// Screenshot suppression
// ---------------------------------------------------------------------------
//
// The Cowork chat runs over an OpenAI-compatible endpoint whose tool results
// are text-only — the AI SDK JSON-stringifies anything that is not a string —
// so an MCP image part never reaches the model as an image. It arrives as
// ~100k tokens of base64 the model cannot decode, re-sent with every later
// step of the loop: unreadable AND a context detonation. Until the SDK ships
// its own suppression, this bridge is where the guarantee lives (and it is
// worth keeping even then: stripping here means multi-megabyte lines never
// cross the Tauri event bridge into the webview at all).
//
// Two halves, mirroring what the SDK-side fix will do:
//  - outgoing `tools/call`: force `include_screenshot: false` wherever the
//    tool's schema offers the flag, so the driver skips the capture entirely;
//  - incoming results: drop any image part that still appears (the `screenshot`
//    tool has no opt-out) and say so, or the model re-requests one forever.

/// What replaces a stripped image part. Text, so it survives the ride.
const SCREENSHOT_OMITTED_NOTE: &str =
    "[screenshot omitted: this connection cannot carry images — work from the element tree]";

/// Tools whose input schema offers `include_screenshot`, learned from the
/// driver's own `tools/list` response so the set can never go stale. Injecting
/// the flag blindly would be rejected — the driver enforces
/// `additionalProperties: false`.
static SCREENSHOT_FLAG_TOOLS: OnceLock<Mutex<HashSet<String>>> = OnceLock::new();

fn screenshot_flag_tools() -> &'static Mutex<HashSet<String>> {
    SCREENSHOT_FLAG_TOOLS.get_or_init(|| Mutex::new(HashSet::new()))
}

/// The flagged-tool names in a `tools/list` response; `None` for any other line.
fn harvest_screenshot_flag_tools(v: &Value) -> Option<HashSet<String>> {
    let tools = v.get("result")?.get("tools")?.as_array()?;
    Some(
        tools
            .iter()
            .filter_map(|tool| {
                tool.get("inputSchema")?
                    .get("properties")?
                    .get("include_screenshot")?;
                Some(tool.get("name")?.as_str()?.to_string())
            })
            .collect(),
    )
}

/// Drop image parts from a tool result, appending the omission note. Returns
/// whether anything changed; lines without a `result.content` array never do.
fn strip_image_parts(v: &mut Value) -> bool {
    let Some(content) = v
        .get_mut("result")
        .and_then(|r| r.get_mut("content"))
        .and_then(|c| c.as_array_mut())
    else {
        return false;
    };
    let before = content.len();
    content.retain(|part| part.get("type").and_then(Value::as_str) != Some("image"));
    if content.len() == before {
        return false;
    }
    content.push(serde_json::json!({ "type": "text", "text": SCREENSHOT_OMITTED_NOTE }));
    true
}

/// Force `include_screenshot: false` on a `tools/call` to a flagged tool —
/// over even an explicit `true`: the image could never reach the model, only
/// bill it. Returns whether anything changed.
fn force_screenshot_off(v: &mut Value, flagged: &HashSet<String>) -> bool {
    if v.get("method").and_then(Value::as_str) != Some("tools/call") {
        return false;
    }
    let Some(params) = v.get_mut("params").and_then(Value::as_object_mut) else {
        return false;
    };
    let is_flagged = params
        .get("name")
        .and_then(Value::as_str)
        .is_some_and(|name| flagged.contains(name));
    if !is_flagged {
        return false;
    }
    match params.get_mut("arguments") {
        Some(Value::Object(args)) => {
            args.insert("include_screenshot".to_string(), Value::Bool(false));
            true
        }
        None => {
            params.insert(
                "arguments".to_string(),
                serde_json::json!({ "include_screenshot": false }),
            );
            true
        }
        // Malformed arguments — leave them for the driver to reject loudly.
        Some(_) => false,
    }
}

/// One driver → webview line: harvest tool schemas, strip images. Non-JSON
/// lines pass through untouched (the webview's MCP client ignores them), and
/// an unmodified line is forwarded byte-identical rather than re-serialised.
///
/// The learned set is a parameter — production passes the global, tests pass a
/// local one so parallel `cargo test` never races on shared state.
fn scrub_driver_line(line: String, flagged: &Mutex<HashSet<String>>) -> String {
    let Ok(mut v) = serde_json::from_str::<Value>(&line) else {
        return line;
    };
    if let Some(found) = harvest_screenshot_flag_tools(&v) {
        if let Ok(mut guard) = flagged.lock() {
            *guard = found;
        }
    }
    if strip_image_parts(&mut v) {
        v.to_string()
    } else {
        line
    }
}

/// One webview → driver line: apply the `include_screenshot` override.
fn force_screenshot_off_line(line: String, flagged: &Mutex<HashSet<String>>) -> String {
    let Ok(mut v) = serde_json::from_str::<Value>(&line) else {
        return line;
    };
    let Ok(guard) = flagged.lock() else {
        return line;
    };
    if force_screenshot_off(&mut v, &guard) {
        drop(guard);
        v.to_string()
    } else {
        line
    }
}

// ---------------------------------------------------------------------------
// The MCP child
// ---------------------------------------------------------------------------

/// Exactly how the driver is spawned; a const so a test pins every flag.
///
/// `--direct` makes the process own its runtime and adopt our TCC identity.
///
/// `--grant existing-profile` lets the browser tools attach to the user's
/// real, logged-in Chromium rather than the isolated throwaway profile they
/// are otherwise limited to. Without it `browser_prepare` can only launch a
/// separate browser, so "do this in my browser" cannot see their tabs or
/// sessions. Note what the grant buys: for the life of this process the agent
/// can act as the user on every site they are signed into, and the grant is
/// session-wide rather than per-attachment. Upstream deliberately renders no
/// consent UI of its own — it expects the embedding app to, via
/// DriverAuthorizationHost. Until that is wired up this flag IS the consent —
/// and the Cowork consent dialog's browser-access sentence is true because of
/// it. Neither flag may change silently, in either direction.
const DRIVER_ARGV: [&str; 4] = ["mcp", "--direct", "--grant", "existing-profile"];

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
    cmd.args(DRIVER_ARGV)
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

    // Pump stdout → webview. MCP writes one JSON-RPC message per line; each is
    // scrubbed (tool schemas harvested, image parts stripped) and forwarded for
    // the webview's MCP client to parse. Logging after the scrub means the
    // base64 image bytes never reach stdout either.
    let reader_app = app.clone();
    std::thread::spawn(move || {
        for line in BufReader::new(stdout).lines().map_while(Result::ok) {
            if line.trim().is_empty() {
                continue;
            }
            let line = scrub_driver_line(line, screenshot_flag_tools());
            log_rpc("<-", &line);
            let _ = reader_app.emit(EVENT_MESSAGE, line);
        }
        // stdout closed ⇒ the process is gone; tell the webview so it can drop
        // its cached session and reconnect on the next turn.
        println!("[cua-driver] process exited (stdout closed)");
        let _ = reader_app.emit(EVENT_CLOSED, ());
    });

    println!(
        "[cua-driver] spawned `cua-driver {}` (pid {:?})",
        DRIVER_ARGV.join(" "),
        child.id()
    );
    *guard = Some(DriverProc { child, stdin });
    Ok(())
}

/// Forward one JSON-RPC message (a single line) to the driver's stdin.
#[command]
pub async fn cua_driver_send(line: String) -> Result<(), String> {
    let line = force_screenshot_off_line(line, screenshot_flag_tools());
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

    // --- screenshot suppression ---

    fn parse(s: &str) -> Value {
        serde_json::from_str(s).unwrap()
    }

    #[test]
    fn tools_list_harvest_finds_only_the_flagged_tools() {
        let v = parse(
            r#"{"jsonrpc":"2.0","id":1,"result":{"tools":[
                {"name":"get_window_state","inputSchema":{"properties":{"pid":{},"include_screenshot":{}}}},
                {"name":"click","inputSchema":{"properties":{"element_token":{}}}},
                {"name":"list_apps"}
            ]}}"#,
        );
        let flagged = harvest_screenshot_flag_tools(&v).unwrap();
        assert!(flagged.contains("get_window_state"));
        assert!(!flagged.contains("click"));
        assert!(!flagged.contains("list_apps"));
    }

    #[test]
    fn non_tools_list_lines_harvest_nothing() {
        // A tool RESULT also has `result` — it must not wipe the learned set.
        assert!(harvest_screenshot_flag_tools(&parse(r#"{"result":{"content":[]}}"#)).is_none());
        assert!(harvest_screenshot_flag_tools(&parse(r#"{"method":"tools/call"}"#)).is_none());
    }

    #[test]
    fn image_parts_are_stripped_and_the_omission_is_noted() {
        let mut v = parse(
            r#"{"id":3,"result":{"content":[
                {"type":"image","data":"iVBORw0KGgo","mimeType":"image/png"},
                {"type":"text","text":"window_id=1 elements=3"}
            ]}}"#,
        );
        assert!(strip_image_parts(&mut v));
        let content = v["result"]["content"].as_array().unwrap();
        assert_eq!(content.len(), 2);
        assert_eq!(content[0]["text"], "window_id=1 elements=3");
        assert!(content[1]["text"]
            .as_str()
            .unwrap()
            .contains("screenshot omitted"));
    }

    #[test]
    fn an_image_only_result_becomes_just_the_note() {
        // The `screenshot` tool returns nothing but the image; the note is what
        // stops the model from re-requesting one forever.
        let mut v =
            parse(r#"{"id":4,"result":{"content":[{"type":"image","data":"iVBORw0KGgo"}]}}"#);
        assert!(strip_image_parts(&mut v));
        let content = v["result"]["content"].as_array().unwrap();
        assert_eq!(content.len(), 1);
        assert_eq!(content[0]["type"], "text");
    }

    #[test]
    fn image_free_results_and_requests_pass_through_untouched() {
        let mut text_only = parse(r#"{"id":5,"result":{"content":[{"type":"text","text":"ok"}]}}"#);
        assert!(!strip_image_parts(&mut text_only));
        assert_eq!(text_only["result"]["content"].as_array().unwrap().len(), 1);

        let mut request = parse(r#"{"method":"tools/call","params":{"name":"click"}}"#);
        assert!(!strip_image_parts(&mut request));
    }

    #[test]
    fn calls_to_flagged_tools_get_the_screenshot_forced_off() {
        // Over even an explicit `true` — the image could never reach the model.
        let flagged: HashSet<String> = HashSet::from(["get_window_state".to_string()]);
        let mut v = parse(
            r#"{"method":"tools/call","params":{"name":"get_window_state",
                "arguments":{"pid":7,"window_id":42,"include_screenshot":true}}}"#,
        );
        assert!(force_screenshot_off(&mut v, &flagged));
        assert_eq!(v["params"]["arguments"]["include_screenshot"], false);
        assert_eq!(v["params"]["arguments"]["pid"], 7);
    }

    #[test]
    fn a_flagged_call_without_arguments_still_gets_the_flag() {
        let flagged: HashSet<String> = HashSet::from(["get_window_state".to_string()]);
        let mut v = parse(r#"{"method":"tools/call","params":{"name":"get_window_state"}}"#);
        assert!(force_screenshot_off(&mut v, &flagged));
        assert_eq!(v["params"]["arguments"]["include_screenshot"], false);
    }

    #[test]
    fn unflagged_tools_and_other_methods_are_left_alone() {
        // `click` offers no `include_screenshot`; injecting it would be rejected
        // by the driver's additionalProperties:false.
        let flagged: HashSet<String> = HashSet::from(["get_window_state".to_string()]);
        let mut click =
            parse(r#"{"method":"tools/call","params":{"name":"click","arguments":{"x":1}}}"#);
        assert!(!force_screenshot_off(&mut click, &flagged));
        assert!(click["params"]["arguments"]
            .get("include_screenshot")
            .is_none());

        let mut init = parse(r#"{"method":"initialize","params":{}}"#);
        assert!(!force_screenshot_off(&mut init, &flagged));
    }

    #[test]
    fn the_driver_argv_carries_exactly_the_agreed_flags() {
        // A tripwire, not a computation: the Cowork consent dialog tells the
        // user the agent can act as them in their signed-in browser BECAUSE of
        // `--grant existing-profile`, and TCC attribution depends on `--direct`.
        // Changing either — adding a grant, dropping one — must arrive here
        // consciously, together with the consent copy.
        assert_eq!(
            DRIVER_ARGV,
            ["mcp", "--direct", "--grant", "existing-profile"]
        );
    }

    // --- the wiring: what a LINE in produces as a LINE out ---

    #[test]
    fn a_tools_list_teaches_the_flag_for_later_calls() {
        let flagged = Mutex::new(HashSet::new());
        let list = r#"{"jsonrpc":"2.0","id":1,"result":{"tools":[{"name":"get_window_state","inputSchema":{"properties":{"pid":{},"include_screenshot":{}}}}]}}"#;

        // The list itself is forwarded byte-identical…
        assert_eq!(scrub_driver_line(list.to_string(), &flagged), list);

        // …and a later call to the tool it flagged gets the override.
        let call =
            r#"{"method":"tools/call","params":{"name":"get_window_state","arguments":{"pid":7}}}"#;
        let sent = force_screenshot_off_line(call.to_string(), &flagged);
        let v = parse(&sent);
        assert_eq!(v["params"]["arguments"]["include_screenshot"], false);
        assert_eq!(v["params"]["arguments"]["pid"], 7);
    }

    #[test]
    fn calls_to_tools_the_list_did_not_flag_pass_through_byte_identical() {
        let flagged = Mutex::new(HashSet::new());
        let list = r#"{"id":1,"result":{"tools":[{"name":"click","inputSchema":{"properties":{"element_token":{}}}}]}}"#;
        scrub_driver_line(list.to_string(), &flagged);

        let call = r#"{"method":"tools/call","params":{"name":"click","arguments":{"x":1}}}"#;
        assert_eq!(force_screenshot_off_line(call.to_string(), &flagged), call);
    }

    #[test]
    fn a_result_line_with_an_image_is_rewritten_and_non_json_passes_through() {
        let flagged = Mutex::new(HashSet::new());
        let result = r#"{"id":2,"result":{"content":[{"type":"image","data":"iVBORw0KGgo"}]}}"#;
        let out = scrub_driver_line(result.to_string(), &flagged);
        let content = parse(&out)["result"]["content"].clone();
        let types: Vec<&str> = content
            .as_array()
            .unwrap()
            .iter()
            .map(|p| p["type"].as_str().unwrap())
            .collect();
        assert_eq!(types, ["text"]);

        // A stray non-JSON stdout line is forwarded untouched, both directions.
        let junk = "warming up...".to_string();
        assert_eq!(scrub_driver_line(junk.clone(), &flagged), junk);
        assert_eq!(force_screenshot_off_line(junk.clone(), &flagged), junk);
    }

    #[test]
    fn a_newer_tools_list_replaces_the_learned_set() {
        // A respawned driver re-lists its tools; flags learned from the previous
        // process must not linger and misdirect the override.
        let flagged = Mutex::new(HashSet::from(["stale_tool".to_string()]));
        let list = r#"{"id":1,"result":{"tools":[{"name":"fresh_tool","inputSchema":{"properties":{"include_screenshot":{}}}}]}}"#;
        scrub_driver_line(list.to_string(), &flagged);

        let guard = flagged.lock().unwrap();
        assert!(guard.contains("fresh_tool"));
        assert!(!guard.contains("stale_tool"));
    }
}
