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
//!
//! A Code chat with Cowork on gets the same driver through the app's own daemon
//! (`ensure_driver_daemon`): the agent only runs the driver's stdio proxy, since
//! a driver it spawned itself would sit inside its sandbox.

#![cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]

use std::collections::HashSet;
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

use serde::Serialize;
use serde_json::Value;
use tauri::{command, AppHandle, Manager};

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
    /// The Mac App Store build: its App Sandbox blocks the Accessibility and
    /// Screen Recording grants that driving other apps needs.
    pub const SANDBOXED: &str = "sandboxed";
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
    /// macOS App Sandbox (the Mac App Store build).
    pub sandboxed: bool,
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
    if env.sandboxed {
        return DriverSupport::no(reason::SANDBOXED);
    }
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
        sandboxed: crate::opencode_installer::is_sandboxed(),
    }
}

/// The System Settings pane a missing grant lives in. `request_*` from the
/// permissions plugin raises the system prompt once; after a refusal only the
/// pane itself lets the user change their mind, so the panel links straight
/// to it (the plugin's own full-disk request opens its pane the same way).
///
/// Screen Recording first makes sure the app is in that pane's list: macOS
/// only lists an app once it has asked, and the plugin's request does not get
/// through on macOS 26 (tccd logs only preflight checks for it).
#[command]
pub async fn open_privacy_settings(app: AppHandle, pane: String) -> Result<(), String> {
    let anchor = privacy_pane_anchor(&pane)?;
    #[cfg(target_os = "macos")]
    {
        if pane == "screen_recording" {
            ask_screen_recording(&app).await?;
        }
        open_pane(anchor)?;
    }
    #[cfg(not(target_os = "macos"))]
    let _ = (app, anchor);
    Ok(())
}

/// Ask macOS for one Cowork grant, the way the setup checklist does, and say
/// whether it is held now. macOS shows its own alert only the first time an
/// app asks, and that alert carries its own "Open System Settings" button, so
/// the pane is opened only on a repeat ask (`open_settings`): opening it on the
/// first ask puts System Settings over the alert, where nobody sees it.
#[command]
pub async fn request_cowork_permission(
    app: AppHandle,
    kind: String,
    open_settings: bool,
) -> Result<bool, String> {
    let anchor = privacy_pane_anchor(&kind)?;
    #[cfg(target_os = "macos")]
    {
        let granted = if kind == "accessibility" {
            if !tauri_plugin_macos_permissions::check_accessibility_permission().await {
                tauri_plugin_macos_permissions::request_accessibility_permission().await;
            }
            tauri_plugin_macos_permissions::check_accessibility_permission().await
        } else {
            ask_screen_recording(&app).await?
        };
        if !granted && open_settings {
            open_pane(anchor)?;
        }
        Ok(granted)
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = (app, anchor, open_settings);
        Ok(true)
    }
}

/// Brings ibl.ai back in front once a grant lands while System Settings has
/// the user's attention. Order matters: focusing a minimized or hidden window
/// does nothing.
#[command]
pub async fn bring_app_to_front(app: AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

#[cfg(target_os = "macos")]
fn open_pane(anchor: &str) -> Result<(), String> {
    Command::new("open")
        .arg(format!(
            "x-apple.systempreferences:com.apple.preference.security?{anchor}"
        ))
        .output()
        .map(|_| ())
        .map_err(|e| e.to_string())
}

/// The Screen Recording request has to run on the main thread: off it (where
/// the permissions plugin calls it) it never reaches tccd on macOS 26, so
/// macOS neither asks nor lists the app.
#[cfg(target_os = "macos")]
async fn ask_screen_recording(app: &AppHandle) -> Result<bool, String> {
    let (tx, rx) = tokio::sync::oneshot::channel();
    app.run_on_main_thread(move || {
        let _ = tx.send(macos_screen::ask());
    })
    .map_err(|e| e.to_string())?;
    rx.await.map_err(|e| e.to_string())
}

#[cfg(target_os = "macos")]
mod macos_screen {
    #[link(name = "CoreGraphics", kind = "framework")]
    extern "C" {
        fn CGPreflightScreenCaptureAccess() -> bool;
        fn CGRequestScreenCaptureAccess() -> bool;
    }

    pub fn ask() -> bool {
        unsafe { CGPreflightScreenCaptureAccess() || CGRequestScreenCaptureAccess() }
    }
}

/// The `x-apple.systempreferences` anchor of each pane the setup dialog links to.
fn privacy_pane_anchor(pane: &str) -> Result<&'static str, String> {
    match pane {
        "screen_recording" => Ok("Privacy_ScreenCapture"),
        "accessibility" => Ok("Privacy_Accessibility"),
        other => Err(format!("unknown privacy pane: {other}")),
    }
}

/// macOS applies a Screen Recording grant only to processes started after it,
/// so Cowork can't read the screen until the app relaunches.
#[command]
pub async fn relaunch_app(app: AppHandle) {
    app.restart();
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

// ---------------------------------------------------------------------------
// What a model reads from the driver
// ---------------------------------------------------------------------------
//
// A model gets a tool result's TEXT; the driver keeps much of its answer in
// `structuredContent`. `list_windows` says "Found 9 window(s)." and keeps the
// window ids in the structured part; `get_window_state` prints the element
// tree but keeps the `snapshot_id` this driver demands with every element
// index there; a refused action carries a structured refusal that fails the
// tool's own output schema, so MCP clients replace the driver's reason with a
// validation error. A model left with that guesses ids, repeats the refused
// call, or reports that it cannot do the task. The helpers below put what the
// model needs into the text, on both routes to the driver: the webview's
// (`scrub_driver_line`) and a Code agent's (`shape_daemon_line`).

/// Text this short is a summary line, not the data.
const SUMMARY_TEXT_CHARS: usize = 200;
/// The most structured data appended to a summary line, in characters.
const STRUCTURED_TEXT_CHARS: usize = 12_000;
/// Longer strings are documents (the tree again), not facts about the result.
const SCALAR_TEXT_CHARS: usize = 200;

const STRUCTURED_TEXT_CUT: &str = "\n[Cut short. Pass `pid` to narrow the list.]";

/// Make a tool result (`content` + `structuredContent`) readable from its text
/// alone. Returns whether anything changed.
///
/// - A refusal or error loses its structured part: the text already says why,
///   and without it no client validates the refusal against the success schema.
/// - A summary-only text gets the structured data appended as text.
/// - Any other result gets its top-level facts appended (`snapshot_id`,
///   counts, flags), never the long strings or the lists.
fn fold_structured_into_text(result: &mut serde_json::Map<String, Value>) -> bool {
    if !result.get("content").is_some_and(Value::is_array) {
        return false;
    }
    if result.get("isError").and_then(Value::as_bool) == Some(true) {
        return result.remove("structuredContent").is_some();
    }
    let Some(structured) = result.get("structuredContent").and_then(Value::as_object) else {
        return false;
    };
    let text_chars: usize = result["content"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|part| part.get("text").and_then(Value::as_str))
        .map(|text| text.chars().count())
        .sum();
    let appended = if text_chars <= SUMMARY_TEXT_CHARS {
        let data = Value::Object(structured.clone()).to_string();
        if data.chars().count() > STRUCTURED_TEXT_CHARS {
            let cut: String = data.chars().take(STRUCTURED_TEXT_CHARS).collect();
            format!("{cut}{STRUCTURED_TEXT_CUT}")
        } else {
            data
        }
    } else {
        let facts: serde_json::Map<String, Value> = structured
            .iter()
            .filter(|(key, value)| {
                !key.starts_with('_')
                    && match value {
                        Value::Bool(_) | Value::Number(_) => true,
                        Value::String(s) => s.chars().count() <= SCALAR_TEXT_CHARS,
                        _ => false,
                    }
            })
            .map(|(key, value)| (key.clone(), value.clone()))
            .collect();
        if facts.is_empty() {
            return false;
        }
        Value::Object(facts).to_string()
    };
    if let Some(content) = result.get_mut("content").and_then(Value::as_array_mut) {
        content.push(serde_json::json!({ "type": "text", "text": appended }));
    }
    true
}

/// Drop `outputSchema` from a `tools/list` result. The driver's refusals do
/// not match the schemas it declares, and a client that validates against
/// them throws the refusal away. Returns whether anything changed.
fn strip_output_schemas(v: &mut Value) -> bool {
    let Some(tools) = v
        .get_mut("result")
        .and_then(|r| r.get_mut("tools"))
        .and_then(Value::as_array_mut)
    else {
        return false;
    };
    let mut changed = false;
    for tool in tools {
        if let Some(tool) = tool.as_object_mut() {
            changed |= tool.remove("outputSchema").is_some();
        }
    }
    changed
}

/// The screen tools a model running on this device is offered: what acting on
/// a window needs. The driver has 54, about 22,000 tokens of definitions that
/// a local model takes minutes to read and has little window left after. The
/// SDK keeps the same list for Cowork on its own (`LOCAL_TOOLS` in
/// `cowork-mcp.ts`).
pub(crate) const LOCAL_TOOLS: &[&str] = &[
    "click",
    "get_window_state",
    "hotkey",
    "launch_app",
    "list_apps",
    "list_windows",
    "page",
    "press_key",
    "scroll",
    "set_value",
    "type_text",
];

/// `page` as a local model gets it: the tool that reads a web page. Its own
/// description opens by sending the reader to browser tools this session does
/// not have, and most of its arguments belong to actions that change a page.
/// A browser window's element list is mostly menus, so without this a local
/// model asked about a page pressed keys at the address bar instead.
const LOCAL_PAGE_DESCRIPTION: &str = "Read a web page that is open in a browser window. `get_text` returns the page's visible text; `query_dom` lists the elements matching `css_selector`. Pass the browser's pid and the window_id of its window: the one that has a title.";
const LOCAL_PAGE_ARGS: &[&str] = &["action", "css_selector", "pid", "window_id"];
const LOCAL_PAGE_ACTIONS: &[&str] = &["get_text", "query_dom"];

/// Arguments a local model is not shown: debugging, capture and delivery
/// controls it has no use for. The driver still accepts them.
const LOCAL_HIDDEN_ARGS: &[&str] = &[
    "capture_mode",
    "debug_image_out",
    "delivery_mode",
    "from_zoom",
    "include_screenshot",
    "scope",
    "screenshot_out_file",
    "session",
];

const LOCAL_DESCRIPTION_CHARS: usize = 400;
const LOCAL_ARG_DESCRIPTION_CHARS: usize = 160;

/// The text up to its first blank line, cut at `limit` characters.
fn lead_of(text: &str, limit: usize) -> String {
    let lead = text.split("\n\n").next().unwrap_or_default().trim();
    lead.chars().take(limit).collect()
}

/// A tool definition as a local model reads it: the lead of its description
/// and its arguments minus [`LOCAL_HIDDEN_ARGS`], each described by its lead.
/// `schema_key` is where this protocol keeps the arguments.
fn compact_tool_for_local(tool: &mut serde_json::Map<String, Value>, schema_key: &str) {
    let is_page = tool.get("name").and_then(Value::as_str) == Some("page");
    if is_page {
        tool.insert("description".to_string(), LOCAL_PAGE_DESCRIPTION.into());
    } else if let Some(description) = tool.get("description").and_then(Value::as_str) {
        let lead = lead_of(description, LOCAL_DESCRIPTION_CHARS);
        tool.insert("description".to_string(), Value::String(lead));
    }
    let Some(schema) = tool.get_mut(schema_key).and_then(Value::as_object_mut) else {
        return;
    };
    if let Some(required) = schema.get_mut("required").and_then(Value::as_array_mut) {
        required.retain(|name| {
            !name
                .as_str()
                .is_some_and(|n| LOCAL_HIDDEN_ARGS.contains(&n))
        });
    }
    let Some(properties) = schema.get_mut("properties").and_then(Value::as_object_mut) else {
        return;
    };
    properties.retain(|name, _| {
        !LOCAL_HIDDEN_ARGS.contains(&name.as_str())
            && (!is_page || LOCAL_PAGE_ARGS.contains(&name.as_str()))
    });
    if let Some(action) = properties.get_mut("action").filter(|_| is_page) {
        action["enum"] = serde_json::json!(LOCAL_PAGE_ACTIONS);
    }
    for property in properties.values_mut() {
        let Some(property) = property.as_object_mut() else {
            continue;
        };
        if let Some(description) = property.get("description").and_then(Value::as_str) {
            let lead = lead_of(description, LOCAL_ARG_DESCRIPTION_CHARS);
            property.insert("description".to_string(), Value::String(lead));
        }
    }
}

/// The most of one text part an on-device Code agent is handed back, in
/// characters (about 4,000 tokens). One unfiltered window snapshot is several
/// times that and pushes the instructions and the tools out of the model's
/// window. The SDK cuts at the same size on its route (`LOCAL_RESULT_CHARS`).
const LOCAL_RESULT_CHARS: usize = 16_000;

const LOCAL_RESULT_CUT: &str = "\n[Cut short. To see the part you need, call get_window_state again with `query` or a smaller `max_elements`, or call page with action query_dom and a narrower `css_selector`.]";

/// Cut a result's long text parts to [`LOCAL_RESULT_CHARS`]. Returns whether
/// anything changed.
fn clip_long_text(result: &mut serde_json::Map<String, Value>) -> bool {
    let Some(content) = result.get_mut("content").and_then(Value::as_array_mut) else {
        return false;
    };
    let mut changed = false;
    for part in content {
        let Some(text) = part.get("text").and_then(Value::as_str) else {
            continue;
        };
        if text.chars().count() <= LOCAL_RESULT_CHARS {
            continue;
        }
        let cut: String = text.chars().take(LOCAL_RESULT_CHARS).collect();
        part["text"] = Value::String(format!("{cut}{LOCAL_RESULT_CUT}"));
        changed = true;
    }
    changed
}

/// What a window read of a web page tells a local model. A browser's element
/// list is its buttons and menus, not the page, and a small model reading it
/// pressed keys at the address bar or said it could not see the page.
fn read_the_page_hint(pid: &Value, window_id: &Value) -> String {
    format!(
        "This window shows a web page. Its element list above is the browser's buttons and menus, not the page. To read the page, call page with action get_text, pid {pid} and window_id {window_id}."
    )
}

/// Web browsers, by the exact app name or bundle id the driver reports. Whole
/// names, not words in them: "Chrome Remote Desktop" and "Ledger Live" are
/// not browsers. The SDK keeps the same lists (`cowork-mcp.ts`).
const BROWSER_NAMES: &[&str] = &[
    "google chrome",
    "safari",
    "firefox",
    "microsoft edge",
    "brave browser",
    "opera",
    "vivaldi",
    "chromium",
    "orion",
    "arc",
];
const BROWSER_BUNDLE_IDS: &[&str] = &[
    "com.google.chrome",
    "com.apple.safari",
    "org.mozilla.firefox",
    "com.microsoft.edgemac",
    "com.brave.browser",
    "com.operasoftware.opera",
    "com.vivaldi.vivaldi",
    "org.chromium.chromium",
    "com.kagi.kagimacos",
    "company.thebrowser.browser",
];

/// Whether an app the driver lists is a web browser.
fn is_browser(entry: &Value) -> bool {
    let field = |key: &str| {
        entry
            .get(key)
            .and_then(Value::as_str)
            .map(|value| value.trim().to_lowercase())
    };
    let named = field("name")
        .or_else(|| field("app_name"))
        .is_some_and(|name| BROWSER_NAMES.contains(&name.as_str()));
    named || field("bundle_id").is_some_and(|id| BROWSER_BUNDLE_IDS.contains(&id.as_str()))
}

/// The pids of running browsers, learned from the app and window lists the
/// model asks for. A window read cut short by the model's own `max_elements`
/// can stop before the page itself, so the page marker alone misses it.
fn browser_pids() -> &'static Mutex<HashSet<i64>> {
    static PIDS: OnceLock<Mutex<HashSet<i64>>> = OnceLock::new();
    PIDS.get_or_init(|| Mutex::new(HashSet::new()))
}

fn remember_browsers(structured: &Value) {
    // A full app list is the current truth: a closed browser's pid can be reused.
    if structured.get("apps").is_some_and(Value::is_array) {
        if let Ok(mut pids) = browser_pids().lock() {
            pids.clear();
        }
    }
    let entries = ["apps", "windows"]
        .iter()
        .filter_map(|key| structured.get(*key).and_then(Value::as_array))
        .flatten();
    let found: Vec<i64> = entries
        .filter(|entry| is_browser(entry))
        .filter_map(|entry| entry.get("pid").and_then(Value::as_i64))
        .collect();
    if let (false, Ok(mut pids)) = (found.is_empty(), browser_pids().lock()) {
        pids.extend(found);
    }
}

/// Append [`read_the_page_hint`] to a window read that holds a web page.
/// Returns whether anything changed.
fn hint_page_reader(result: &mut serde_json::Map<String, Value>) -> bool {
    let Some(structured) = result.get("structuredContent") else {
        return false;
    };
    remember_browsers(structured);
    if structured.get("snapshot_id").is_none() {
        return false;
    }
    let in_browser = structured
        .get("pid")
        .and_then(Value::as_i64)
        .is_some_and(|pid| browser_pids().lock().is_ok_and(|pids| pids.contains(&pid)));
    let shows_page = in_browser
        || result
            .get("content")
            .and_then(Value::as_array)
            .into_iter()
            .flatten()
            .filter_map(|part| part.get("text").and_then(Value::as_str))
            .any(|text| text.contains("AXWebArea"));
    let ids = result
        .get("structuredContent")
        .and_then(|s| Some((s.get("pid")?.clone(), s.get("window_id")?.clone())));
    let (true, Some((pid, window_id))) = (shows_page, ids) else {
        return false;
    };
    let hint = read_the_page_hint(&pid, &window_id);
    match result.get_mut("content").and_then(Value::as_array_mut) {
        Some(content) => {
            content.push(serde_json::json!({ "type": "text", "text": hint }));
            true
        }
        None => false,
    }
}

/// One daemon → agent line (`{"ok":true,"result":…}`, one JSON object per
/// line): images are dropped (no Code agent's model is handed one, and a
/// screenshot is megabytes of text), tool results are made readable from
/// their text, and for an on-device session the tool list is cut to
/// [`LOCAL_TOOLS`] in compact form and long results to [`LOCAL_RESULT_CHARS`].
/// Anything that is not the JSON we expect passes through byte-identical, so a
/// driver that changes its protocol degrades to the plain driver, not to
/// nothing.
fn shape_daemon_line(line: String, local: bool) -> String {
    let Ok(mut v) = serde_json::from_str::<Value>(&line) else {
        return line;
    };
    let mut changed = strip_image_parts(&mut v);
    let Some(result) = v.get_mut("result").and_then(Value::as_object_mut) else {
        return line;
    };
    if let Some(tools) = result.get_mut("tools").and_then(Value::as_array_mut) {
        if local {
            tools.retain(|tool| {
                tool.get("name")
                    .and_then(Value::as_str)
                    .is_some_and(|name| LOCAL_TOOLS.contains(&name))
            });
            for tool in tools.iter_mut() {
                if let Some(tool) = tool.as_object_mut() {
                    compact_tool_for_local(tool, "input_schema");
                }
            }
            changed = true;
        }
    } else {
        // Cut first: the facts appended after it (`snapshot_id`) must survive.
        if local {
            changed |= clip_long_text(result);
            changed |= hint_page_reader(result);
        }
        changed |= fold_structured_into_text(result);
    }
    if changed {
        v.to_string()
    } else {
        line
    }
}

/// The tools of a daemon tool list that take `include_screenshot`; `None`
/// when the line is not a tool list.
fn daemon_screenshot_tools(line: &str) -> Option<HashSet<String>> {
    if !line.contains("\"tools\"") {
        return None;
    }
    let v = serde_json::from_str::<Value>(line).ok()?;
    let tools = v.get("result")?.get("tools")?.as_array()?;
    Some(
        tools
            .iter()
            .filter(|tool| {
                tool.get("input_schema")
                    .and_then(|schema| schema.get("properties"))
                    .and_then(|properties| properties.get("include_screenshot"))
                    .is_some()
            })
            .filter_map(|tool| tool.get("name").and_then(Value::as_str))
            .map(str::to_string)
            .collect(),
    )
}

/// One agent → daemon line (`{"method":"call","name":…,"args":{…}}`): a call
/// to a tool that can capture gets `include_screenshot: false`, over even an
/// explicit `true`, as the webview's route does (`force_screenshot_off`). The
/// driver captures by default, and the image could never reach the model.
fn screenshot_off_daemon_line(line: String, flagged: &HashSet<String>) -> String {
    let Ok(mut v) = serde_json::from_str::<Value>(&line) else {
        return line;
    };
    if v.get("method").and_then(Value::as_str) != Some("call") {
        return line;
    }
    let is_flagged = v
        .get("name")
        .and_then(Value::as_str)
        .is_some_and(|name| flagged.contains(name));
    let Some(request) = v.as_object_mut().filter(|_| is_flagged) else {
        return line;
    };
    let args = request
        .entry("args")
        .or_insert_with(|| serde_json::json!({}));
    // Malformed arguments: left for the driver to reject loudly.
    let Some(args) = args.as_object_mut() else {
        return line;
    };
    args.insert("include_screenshot".to_string(), Value::Bool(false));
    v.to_string()
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
    let mut changed = strip_image_parts(&mut v);
    changed |= strip_output_schemas(&mut v);
    if let Some(result) = v.get_mut("result").and_then(Value::as_object_mut) {
        changed |= fold_structured_into_text(result);
    }
    if changed {
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
pub(crate) const DRIVER_ARGV: [&str; 4] = ["mcp", "--direct", "--grant", "existing-profile"];

/// The driver binary a Code session's agent spawns: the one on the augmented
/// PATH (a system install wins, as in `cua_driver_program`), else our managed
/// copy when it exists.
pub(crate) fn resolved_driver_path() -> Option<PathBuf> {
    let name = cua_driver_program();
    std::env::split_paths(&crate::opencode_acp::augmented_path())
        .map(|d| d.join(&name))
        .find(|p| p.is_file())
        .or_else(|| Some(cua_driver_bin()).filter(|p| p.is_file()))
}

/// The daemon's socket, in our data dir; the agent's proxy is handed the path.
pub(crate) fn daemon_socket() -> PathBuf {
    iblai_data_dir().join("cua-driver.sock")
}

/// `cua-driver serve` as the app's embedded daemon: `--embedded` keeps it in
/// the app's TCC chain (no disclaim re-exec, no permission gate of its own),
/// `--parent-liveness-stdio` ends it when our stdin pipe closes, `--no-overlay`
/// matches the `--direct` child, and the launch grant lives here — a proxy
/// can't add one to a running daemon.
fn daemon_argv(socket: &Path, host_bundle_id: &str) -> Vec<String> {
    [
        "serve",
        "--embedded",
        "--socket",
        &socket.to_string_lossy(),
        "--parent-liveness-stdio",
        "--host-bundle-id",
        host_bundle_id,
        "--no-overlay",
        "--grant",
        "existing-profile",
    ]
    .iter()
    .map(|s| s.to_string())
    .collect()
}

/// The agent's MCP server command: the driver's stdio proxy to the daemon.
pub(crate) fn proxy_argv(socket: &Path) -> Vec<String> {
    ["mcp", "--embedded", "--socket", &socket.to_string_lossy()]
        .iter()
        .map(|s| s.to_string())
        .collect()
}

/// The live daemon; its stdin is held open because EOF there stops it.
struct DaemonProc {
    child: Child,
    _stdin: ChildStdin,
    socket: PathBuf,
}

static DAEMON: OnceLock<Mutex<Option<DaemonProc>>> = OnceLock::new();

fn daemon_slot() -> &'static Mutex<Option<DaemonProc>> {
    DAEMON.get_or_init(|| Mutex::new(None))
}

const DAEMON_START_TIMEOUT: Duration = Duration::from_secs(10);

/// Start (or reuse) the driver daemon a Code session's agent talks to, and
/// return its socket. A direct child of the app, like the webview's driver:
/// spawned by the agent instead, it would run inside the agent's sandbox —
/// decoy `$HOME`, no writes, and keystrokes that never land.
pub(crate) fn ensure_driver_daemon(driver: &Path, host_bundle_id: &str) -> Result<PathBuf, String> {
    ensure_driver_daemon_within(
        driver,
        &daemon_socket(),
        host_bundle_id,
        DAEMON_START_TIMEOUT,
    )
}

fn ensure_driver_daemon_within(
    driver: &Path,
    socket: &Path,
    host_bundle_id: &str,
    timeout: Duration,
) -> Result<PathBuf, String> {
    let mut guard = daemon_slot()
        .lock()
        .map_err(|_| "cua-driver daemon lock poisoned")?;
    if let Some(proc) = guard.as_mut() {
        match proc.child.try_wait() {
            Ok(None) => return Ok(proc.socket.clone()),
            _ => *guard = None,
        }
    }

    // An embedded daemon refuses to start over a leftover socket file.
    clear_stale_socket(socket)?;
    let mut cmd = Command::new(driver);
    cmd.args(daemon_argv(socket, host_bundle_id))
        .env("PATH", crate::opencode_acp::augmented_path())
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Cowork's screen driver didn't start: {e}"))?;
    let stdin = child
        .stdin
        .take()
        .ok_or("cua-driver daemon: no stdin handle")?;
    if let Some(out) = child.stdout.take() {
        log_daemon(out);
    }
    if let Some(err) = child.stderr.take() {
        log_daemon(err);
    }
    if let Err(e) = wait_for_socket(socket, timeout) {
        let _ = child.kill();
        let _ = child.wait();
        return Err(e);
    }
    println!(
        "[cua-driver daemon] listening on {} (pid {:?})",
        socket.display(),
        child.id()
    );
    *guard = Some(DaemonProc {
        child,
        _stdin: stdin,
        socket: socket.to_path_buf(),
    });
    Ok(socket.to_path_buf())
}

fn log_daemon(stream: impl std::io::Read + Send + 'static) {
    std::thread::spawn(move || {
        for line in BufReader::new(stream).lines().map_while(Result::ok) {
            eprintln!("[cua-driver daemon] {line}");
        }
    });
}

fn clear_stale_socket(socket: &Path) -> Result<(), String> {
    match std::fs::remove_file(socket) {
        Err(e) if e.kind() != std::io::ErrorKind::NotFound => Err(format!(
            "Cowork's screen driver couldn't reset its socket: {e}"
        )),
        _ => Ok(()),
    }
}

#[cfg(unix)]
fn wait_for_socket(socket: &Path, timeout: Duration) -> Result<(), String> {
    let deadline = Instant::now() + timeout;
    loop {
        if std::os::unix::net::UnixStream::connect(socket).is_ok() {
            return Ok(());
        }
        if Instant::now() >= deadline {
            return Err("Cowork's screen driver didn't start.".to_string());
        }
        std::thread::sleep(Duration::from_millis(100));
    }
}

#[cfg(not(unix))]
fn wait_for_socket(_socket: &Path, _timeout: Duration) -> Result<(), String> {
    Err("Cowork inside Code isn't available on Windows.".to_string())
}

/// Whether the daemon the Code sessions' agents talk to is still running.
pub(crate) fn driver_daemon_alive() -> bool {
    let Ok(mut guard) = daemon_slot().lock() else {
        return false;
    };
    proc_alive(guard.as_mut())
}

fn proc_alive(proc: Option<&mut DaemonProc>) -> bool {
    proc.is_some_and(|p| matches!(p.child.try_wait(), Ok(None)))
}

/// Stop the daemon (best-effort) and drop its socket file.
pub(crate) fn stop_driver_daemon() {
    if let Ok(mut pids) = browser_pids().lock() {
        pids.clear();
    }
    let Ok(mut guard) = daemon_slot().lock() else {
        return;
    };
    if let Some(mut proc) = guard.take() {
        println!("[cua-driver daemon] stopping (pid {:?})", proc.child.id());
        let _ = proc.child.kill();
        let _ = proc.child.wait();
        let _ = std::fs::remove_file(&proc.socket);
    }
}

/// The socket a Code agent's driver proxy is handed: the app's relay to the
/// daemon, which shapes what comes back for a model (`shape_daemon_line`), in
/// the compact form when the session runs on this device's own model. When the
/// relay can't start the agent gets the daemon's own socket and the driver's
/// replies as they are.
pub(crate) fn agent_socket(daemon: &Path, local: bool) -> PathBuf {
    #[cfg(unix)]
    {
        let name = if local {
            "cua-driver-agent-local.sock"
        } else {
            "cua-driver-agent.sock"
        };
        let socket = daemon.with_file_name(name);
        match ensure_relay(&socket, daemon, local) {
            Ok(()) => socket,
            Err(e) => {
                eprintln!("[cua-driver relay] not started, agents get the daemon directly: {e}");
                daemon.to_path_buf()
            }
        }
    }
    #[cfg(not(unix))]
    {
        let _ = local;
        daemon.to_path_buf()
    }
}

/// The tools the relay switches the screenshot off for: learned from the
/// daemon's own tool list, and until one has passed, the tool that reads a
/// window.
#[cfg(unix)]
fn relay_screenshot_tools() -> &'static Mutex<HashSet<String>> {
    static TOOLS: OnceLock<Mutex<HashSet<String>>> = OnceLock::new();
    TOOLS.get_or_init(|| Mutex::new(HashSet::from(["get_window_state".to_string()])))
}

/// `shape` applied to one line of a relayed stream, its line ending kept.
#[cfg(unix)]
fn relay_line(raw: Vec<u8>, shape: impl FnOnce(String) -> String) -> Vec<u8> {
    match String::from_utf8(raw) {
        Ok(line) => match line.strip_suffix('\n') {
            Some(body) => {
                let mut out = shape(body.to_string());
                out.push('\n');
                out.into_bytes()
            }
            None => shape(line).into_bytes(),
        },
        Err(not_text) => not_text.into_bytes(),
    }
}

/// The relay sockets this run is serving. A relay is bound once and kept: it
/// connects to the daemon per agent connection, so it outlives daemon restarts.
#[cfg(unix)]
static RELAYS: OnceLock<Mutex<HashSet<PathBuf>>> = OnceLock::new();

#[cfg(unix)]
fn ensure_relay(socket: &Path, daemon: &Path, local: bool) -> Result<(), String> {
    let mut serving = RELAYS
        .get_or_init(|| Mutex::new(HashSet::new()))
        .lock()
        .map_err(|_| "relay lock poisoned")?;
    // Not probed with a connection: the daemon logs every one that ends
    // without a request.
    if serving.contains(socket) && socket.exists() {
        return Ok(());
    }
    clear_stale_socket(socket)?;
    let listener = tokio::net::UnixListener::bind(socket)
        .map_err(|e| format!("couldn't listen on {}: {e}", socket.display()))?;
    let daemon = daemon.to_path_buf();
    tauri::async_runtime::spawn(async move {
        while let Ok((agent, _)) = listener.accept().await {
            let daemon = daemon.clone();
            tauri::async_runtime::spawn(async move {
                let _ = relay_connection(agent, &daemon, local).await;
            });
        }
    });
    serving.insert(socket.to_path_buf());
    Ok(())
}

/// One agent connection, a line at a time each way: requests through
/// [`screenshot_off_daemon_line`], replies through [`shape_daemon_line`].
#[cfg(unix)]
async fn relay_connection(
    agent: tokio::net::UnixStream,
    daemon: &Path,
    local: bool,
) -> std::io::Result<()> {
    use tokio::io::{AsyncBufReadExt, AsyncWriteExt};
    let upstream = tokio::net::UnixStream::connect(daemon).await?;
    let (agent_read, mut agent_write) = agent.into_split();
    let (upstream_read, mut upstream_write) = upstream.into_split();
    let requests = async move {
        let mut requests = tokio::io::BufReader::new(agent_read);
        let mut raw = Vec::new();
        loop {
            raw.clear();
            match requests.read_until(b'\n', &mut raw).await {
                Ok(0) | Err(_) => break,
                Ok(_) => {}
            }
            let flagged = relay_screenshot_tools()
                .lock()
                .map(|tools| tools.clone())
                .unwrap_or_default();
            let line = relay_line(std::mem::take(&mut raw), |line| {
                screenshot_off_daemon_line(line, &flagged)
            });
            if upstream_write.write_all(&line).await.is_err() {
                break;
            }
        }
        let _ = upstream_write.shutdown().await;
    };
    let replies = async move {
        let mut replies = tokio::io::BufReader::new(upstream_read);
        let mut raw = Vec::new();
        loop {
            raw.clear();
            if replies.read_until(b'\n', &mut raw).await? == 0 {
                break;
            }
            let line = relay_line(std::mem::take(&mut raw), |line| {
                if let Some(found) = daemon_screenshot_tools(&line).filter(|f| !f.is_empty()) {
                    if let Ok(mut tools) = relay_screenshot_tools().lock() {
                        *tools = found;
                    }
                }
                shape_daemon_line(line, local)
            });
            agent_write.write_all(&line).await?;
        }
        agent_write.shutdown().await
    };
    let (_, replied) = tokio::join!(requests, replies);
    replied
}

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

    // One driver owns the screen: the Code chats' daemon goes first.
    crate::opencode_acp::close_cowork_sessions(None).await;
    stop_driver_daemon();

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
            // Never `reader_app.emit` here: see `events_go_through_the_main_thread`.
            crate::emit_on_main(&reader_app, EVENT_MESSAGE, line);
        }
        // stdout closed ⇒ the process is gone; tell the webview so it can drop
        // its cached session and reconnect on the next turn.
        println!("[cua-driver] process exited (stdout closed)");
        crate::emit_on_main(&reader_app, EVENT_CLOSED, ());
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
pub(crate) fn stop_driver() {
    let Ok(mut guard) = slot().lock() else {
        return;
    };
    if let Some(mut proc) = guard.take() {
        println!("[cua-driver] stopping (pid {:?})", proc.child.id());
        let _ = proc.child.kill();
        let _ = proc.child.wait();
    }
}

/// Cowork switched off: the webview's driver and every Code chat's driver go.
#[command]
pub async fn cua_driver_stop() -> Result<(), String> {
    stop_driver();
    crate::opencode_acp::close_cowork_sessions(None).await;
    stop_driver_daemon();
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

    /// The Mac App Store build can't drive other apps: its sandbox blocks the
    /// grants. Refusing up front keeps the pill from walking the user into a
    /// permission flow that cannot work there.
    #[test]
    fn the_sandboxed_mac_app_store_build_is_refused() {
        let env = SessionEnv {
            os: "macos".to_string(),
            sandboxed: true,
            ..Default::default()
        };
        assert_eq!(session_support(&env), DriverSupport::no(reason::SANDBOXED));
    }

    /// A direct emit from the driver's reader thread froze the app during a
    /// Cowork turn: Tauri's emit holds the webview lock while it waits for the
    /// main thread, and the main thread was waiting for that lock to answer one
    /// of the page's IPC calls. Every Cowork event goes through `emit_on_main`.
    #[test]
    fn events_go_through_the_main_thread() {
        let direct = [".", "emit("].concat();
        for (file, source) in [
            ("cua_driver_mcp.rs", include_str!("cua_driver_mcp.rs")),
            (
                "cua_driver_installer.rs",
                include_str!("cua_driver_installer.rs"),
            ),
        ] {
            let offending: Vec<&str> = source
                .lines()
                .filter(|line| !line.trim_start().starts_with("//"))
                .filter(|line| line.contains(&direct))
                .collect();
            assert!(offending.is_empty(), "{file} emits directly: {offending:?}");
        }
    }

    /// The pane names are the exact strings the composer's setup dialog sends;
    /// a wrong anchor lands the user on the Privacy & Security root instead.
    #[test]
    fn only_the_two_privacy_panes_can_be_opened() {
        assert_eq!(
            privacy_pane_anchor("accessibility"),
            Ok("Privacy_Accessibility")
        );
        assert_eq!(
            privacy_pane_anchor("screen_recording"),
            Ok("Privacy_ScreenCapture")
        );
        let err = privacy_pane_anchor("camera").unwrap_err();
        assert!(err.contains("camera"), "{err}");
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

    // --- the daemon a Code session's agent talks to ---

    fn daemon_scratch(tag: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("{tag}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn the_daemon_argv_keeps_the_hosts_tcc_chain() {
        let argv = daemon_argv(Path::new("/s/cua-driver.sock"), "ai.ibl.test");
        assert_eq!(argv[0], "serve");
        for flag in ["--embedded", "--parent-liveness-stdio", "--no-overlay"] {
            assert!(argv.iter().any(|a| a == flag), "{flag}");
        }
        for pair in [
            ["--socket", "/s/cua-driver.sock"],
            ["--host-bundle-id", "ai.ibl.test"],
            ["--grant", "existing-profile"],
        ] {
            assert!(argv.windows(2).any(|w| w == pair), "{pair:?}");
        }
        assert!(!argv.iter().any(|a| a == "--direct"));
    }

    #[test]
    fn the_agents_proxy_carries_no_grant_and_owns_no_runtime() {
        // A proxy with `--grant` is refused by a daemon that already listens,
        // and `--direct` would put the runtime back inside the agent's sandbox.
        let argv = proxy_argv(Path::new("/s/cua-driver.sock"));
        assert_eq!(
            argv,
            ["mcp", "--embedded", "--socket", "/s/cua-driver.sock"]
        );
    }

    #[test]
    fn a_stale_socket_file_is_cleared_before_the_daemon_spawns() {
        // An embedded daemon exits instead of unlinking a leftover endpoint.
        let dir = daemon_scratch("cua-stale");
        let sock = dir.join("cua-driver.sock");
        std::fs::write(&sock, "").unwrap();
        clear_stale_socket(&sock).unwrap();
        assert!(!sock.exists());
        clear_stale_socket(&sock).unwrap();
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[cfg(unix)]
    #[test]
    fn the_socket_wait_ends_when_something_listens_and_times_out_otherwise() {
        let dir = daemon_scratch("cua-wait");
        let sock = dir.join("d.sock");
        assert!(wait_for_socket(&sock, Duration::from_millis(250)).is_err());
        let _listener = std::os::unix::net::UnixListener::bind(&sock).unwrap();
        assert!(wait_for_socket(&sock, Duration::from_millis(250)).is_ok());
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn a_missing_driver_fails_the_daemon_loudly() {
        let dir = daemon_scratch("cua-missing");
        let err = ensure_driver_daemon_within(
            &dir.join("no-such-cua-driver"),
            &dir.join("cua-driver.sock"),
            "ai.ibl.test",
            Duration::from_millis(100),
        )
        .unwrap_err();
        assert!(err.contains("didn't start"), "{err}");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[cfg(unix)]
    #[test]
    fn a_driver_that_never_listens_is_killed_and_reported() {
        use std::os::unix::fs::PermissionsExt;
        let dir = daemon_scratch("cua-silent");
        let stub = dir.join("cua-driver");
        std::fs::write(&stub, "#!/bin/sh\nsleep 30\n").unwrap();
        std::fs::set_permissions(&stub, std::fs::Permissions::from_mode(0o755)).unwrap();
        let err = ensure_driver_daemon_within(
            &stub,
            &dir.join("cua-driver.sock"),
            "ai.ibl.test",
            Duration::from_millis(300),
        )
        .unwrap_err();
        assert!(err.contains("didn't start"), "{err}");
        assert!(daemon_slot().lock().unwrap().is_none());
        let _ = std::fs::remove_dir_all(&dir);
    }

    // --- what a model reads from the driver ---

    fn result(v: Value) -> serde_json::Map<String, Value> {
        v.as_object().unwrap().clone()
    }

    fn texts(result: &serde_json::Map<String, Value>) -> Vec<String> {
        result["content"]
            .as_array()
            .unwrap()
            .iter()
            .filter_map(|part| part["text"].as_str().map(str::to_string))
            .collect()
    }

    /// `list_windows` answered "Found 9 window(s)." and kept the ids out of the
    /// text, so a model guessed window 0 and 1 and gave up.
    #[test]
    fn a_summary_only_reply_gets_its_data_as_text() {
        let mut r = result(serde_json::json!({
            "content": [{ "type": "text", "text": "Found 1 window(s)." }],
            "structuredContent": { "windows": [{ "window_id": 652, "title": "Notes" }] },
        }));
        assert!(fold_structured_into_text(&mut r));
        let texts = texts(&r);
        assert_eq!(texts.len(), 2);
        assert!(texts[1].contains("\"window_id\":652"), "{}", texts[1]);
        assert!(
            r.contains_key("structuredContent"),
            "left for clients that read it"
        );
    }

    /// The element tree is the text; the `snapshot_id` every element index
    /// must travel with is not in it.
    #[test]
    fn a_long_reply_gets_its_facts_and_not_its_lists() {
        let tree = "- [3] AXButton \"New Document\"\n".repeat(20);
        let mut r = result(serde_json::json!({
            "content": [{ "type": "text", "text": tree }],
            "structuredContent": {
                "snapshot_id": "s00000015",
                "element_count": 41,
                "elements_complete": true,
                "elements": [{ "element_index": 3 }],
                "tree_markdown": tree,
                "_note": "Prefer elements",
            },
        }));
        assert!(fold_structured_into_text(&mut r));
        let facts: Value = serde_json::from_str(texts(&r).last().unwrap()).unwrap();
        assert_eq!(
            facts,
            serde_json::json!({ "snapshot_id": "s00000015", "element_count": 41, "elements_complete": true })
        );
    }

    /// A refusal's structured part fails the tool's own output schema; clients
    /// then report a validation error instead of the driver's reason.
    #[test]
    fn a_refusal_keeps_its_reason_and_loses_its_structured_part() {
        let mut r = result(serde_json::json!({
            "content": [{ "type": "text", "text": "click: pass snapshot_id with element_index" }],
            "isError": true,
            "structuredContent": { "refusal": { "code": "snapshot_id_required" }, "status": "refused" },
        }));
        assert!(fold_structured_into_text(&mut r));
        assert!(!r.contains_key("structuredContent"));
        assert_eq!(texts(&r), ["click: pass snapshot_id with element_index"]);
    }

    #[test]
    fn a_reply_with_nothing_to_add_is_left_alone() {
        for v in [
            serde_json::json!({ "content": [{ "type": "text", "text": "Typed 5 characters." }] }),
            serde_json::json!({ "tools": [] }),
            serde_json::json!({ "content": "not a list", "structuredContent": { "a": 1 } }),
        ] {
            let mut r = result(v.clone());
            assert!(!fold_structured_into_text(&mut r), "{v}");
            assert_eq!(Value::Object(r), v);
        }
    }

    #[test]
    fn a_very_long_list_is_cut_with_the_way_to_narrow_it() {
        let windows: Vec<Value> = (0..2000)
            .map(|i| serde_json::json!({ "window_id": i }))
            .collect();
        let mut r = result(serde_json::json!({
            "content": [{ "type": "text", "text": "Found 2000 window(s)." }],
            "structuredContent": { "windows": windows },
        }));
        assert!(fold_structured_into_text(&mut r));
        let data = texts(&r).pop().unwrap();
        assert!(
            data.ends_with(STRUCTURED_TEXT_CUT),
            "{}",
            &data[data.len() - 60..]
        );
        assert!(data.chars().count() <= STRUCTURED_TEXT_CHARS + STRUCTURED_TEXT_CUT.len());
    }

    #[test]
    fn the_webviews_tool_list_loses_its_output_schemas_and_its_results_are_readable() {
        let flagged = Mutex::new(HashSet::new());
        let list = serde_json::json!({ "jsonrpc": "2.0", "id": 2, "result": { "tools": [
            { "name": "click", "inputSchema": { "type": "object" }, "outputSchema": { "required": ["effect"] } },
            { "name": "list_apps", "inputSchema": { "type": "object" } },
        ] } });
        let out: Value =
            serde_json::from_str(&scrub_driver_line(list.to_string(), &flagged)).unwrap();
        for tool in out["result"]["tools"].as_array().unwrap() {
            assert!(tool.get("outputSchema").is_none(), "{tool}");
            assert!(tool.get("inputSchema").is_some(), "{tool}");
        }

        let call = serde_json::json!({ "jsonrpc": "2.0", "id": 3, "result": {
            "content": [{ "type": "text", "text": "Found 1 window(s)." }],
            "structuredContent": { "windows": [{ "window_id": 7 }] },
        } });
        let out: Value =
            serde_json::from_str(&scrub_driver_line(call.to_string(), &flagged)).unwrap();
        assert_eq!(out["result"]["content"].as_array().unwrap().len(), 2);

        let plain =
            r#"{"jsonrpc":"2.0","id":4,"result":{"content":[{"type":"text","text":"ok"}]}}"#;
        assert_eq!(
            scrub_driver_line(plain.to_string(), &flagged),
            plain,
            "byte-identical"
        );
    }

    fn daemon_tool(name: &str) -> Value {
        serde_json::json!({
            "name": name,
            "description": "Click a target.\n\nTwo addressing modes: a long explanation that a local model does not need.",
            "risk": { "class": "r2" },
            "input_schema": {
                "type": "object",
                "required": ["pid", "session"],
                "properties": {
                    "pid": { "type": "integer" },
                    "snapshot_id": { "type": "string", "description": "From get_window_state.\n\nMore." },
                    "session": { "type": "string", "description": "Optional session id." },
                    "delivery_mode": { "type": "string", "description": "x".repeat(600) },
                },
            },
        })
    }

    #[test]
    fn an_on_device_agent_gets_the_core_tools_in_compact_form() {
        let list = serde_json::json!({ "ok": true, "result": {
            "schema_version": "1",
            "tools": [daemon_tool("click"), daemon_tool("start_recording"), daemon_tool("list_apps")],
        } });
        let out: Value = serde_json::from_str(&shape_daemon_line(list.to_string(), true)).unwrap();
        let tools = out["result"]["tools"].as_array().unwrap();
        assert_eq!(
            tools
                .iter()
                .map(|t| t["name"].as_str().unwrap())
                .collect::<Vec<_>>(),
            ["click", "list_apps"]
        );
        let click = &tools[0];
        assert_eq!(click["description"], "Click a target.");
        assert_eq!(
            click["risk"]["class"], "r2",
            "the rest of the definition is untouched"
        );
        let args = click["input_schema"]["properties"].as_object().unwrap();
        assert_eq!(args.keys().collect::<Vec<_>>(), ["pid", "snapshot_id"]);
        assert_eq!(args["snapshot_id"]["description"], "From get_window_state.");
        assert_eq!(
            click["input_schema"]["required"],
            serde_json::json!(["pid"])
        );
        assert_eq!(out["result"]["schema_version"], "1");

        assert_eq!(
            shape_daemon_line(list.to_string(), false),
            list.to_string(),
            "a cloud model's session keeps the whole list, byte-identical"
        );
    }

    #[test]
    fn a_window_read_of_a_web_page_points_a_local_model_at_the_page_reader() {
        let read = serde_json::json!({ "ok": true, "result": {
            "content": [{ "type": "text", "text": "- [0] AXWindow \"Inbox\"\n  - [4] AXWebArea \"Inbox\"" }],
            "structuredContent": { "pid": 90528, "window_id": 11475, "snapshot_id": "s00000001" },
        } });
        let out: Value = serde_json::from_str(&shape_daemon_line(read.to_string(), true)).unwrap();
        let texts: Vec<&str> = out["result"]["content"]
            .as_array()
            .unwrap()
            .iter()
            .filter_map(|p| p["text"].as_str())
            .collect();
        assert!(
            texts.iter().any(
                |t| t.contains("call page with action get_text, pid 90528 and window_id 11475")
            ),
            "{texts:?}"
        );
        let cloud: Value =
            serde_json::from_str(&shape_daemon_line(read.to_string(), false)).unwrap();
        assert!(!cloud.to_string().contains("call page with action get_text"));

        let app = serde_json::json!({ "ok": true, "result": {
            "content": [{ "type": "text", "text": "- [0] AXWindow \"Calculator\"" }],
            "structuredContent": { "pid": 1, "window_id": 2, "snapshot_id": "s1" },
        } });
        let out = shape_daemon_line(app.to_string(), true);
        assert!(
            !out.contains("call page with action get_text"),
            "not a web page"
        );

        // A read cut short before the page: known as a browser from the app list.
        let apps = serde_json::json!({ "ok": true, "result": {
            "content": [{ "type": "text", "text": "Found 1 app(s)." }],
            "structuredContent": { "apps": [{ "name": "Google Chrome", "bundle_id": "com.google.Chrome", "pid": 4242 }] },
        } });
        shape_daemon_line(apps.to_string(), true);
        let cut = serde_json::json!({ "ok": true, "result": {
            "content": [{ "type": "text", "text": "- [0] AXWindow \"Inbox\"\n  - [1] AXMenuBar" }],
            "structuredContent": { "pid": 4242, "window_id": 7, "snapshot_id": "s2" },
        } });
        let out = shape_daemon_line(cut.to_string(), true);
        assert!(out.contains("pid 4242 and window_id 7"), "{out}");
    }

    #[test]
    fn browsers_are_recognised_by_name_or_bundle_id() {
        for app in [
            serde_json::json!({ "name": "Google Chrome" }),
            serde_json::json!({ "bundle_id": "com.apple.Safari" }),
            serde_json::json!({ "app_name": "Arc", "bundle_id": "company.thebrowser.Browser" }),
            serde_json::json!({ "name": "Microsoft Edge" }),
        ] {
            assert!(is_browser(&app), "{app}");
        }
        for app in [
            serde_json::json!({ "name": "Calculator", "bundle_id": "com.apple.calculator" }),
            serde_json::json!({ "name": "Archive Utility", "bundle_id": "com.apple.archiveutility" }),
            serde_json::json!({ "name": "Finder" }),
            serde_json::json!({ "name": "Chrome Remote Desktop" }),
            serde_json::json!({ "name": "Ledger Live" }),
        ] {
            assert!(!is_browser(&app), "{app}");
        }
    }

    #[test]
    fn an_on_device_agent_gets_the_page_tool_for_reading_only() {
        let page = serde_json::json!({
            "name": "page",
            "description": "Legacy browser compatibility tool. Prefer get_browser_state.",
            "input_schema": { "type": "object", "required": ["action"], "properties": {
                "action": { "type": "string", "enum": ["execute_javascript", "get_text", "query_dom", "click_element"] },
                "javascript": { "type": "string" },
                "css_selector": { "type": "string" },
                "pid": { "type": "integer" },
                "window_id": { "type": "integer" },
                "bundle_id": { "type": "string" },
            } },
        });
        let list = serde_json::json!({ "ok": true, "result": { "tools": [page] } });
        let out: Value = serde_json::from_str(&shape_daemon_line(list.to_string(), true)).unwrap();
        let tool = &out["result"]["tools"][0];
        assert_eq!(tool["description"], LOCAL_PAGE_DESCRIPTION);
        let args = tool["input_schema"]["properties"].as_object().unwrap();
        assert_eq!(
            args.keys().collect::<Vec<_>>(),
            ["action", "css_selector", "pid", "window_id"]
        );
        assert_eq!(
            args["action"]["enum"],
            serde_json::json!(["get_text", "query_dom"])
        );
    }

    #[test]
    fn a_daemon_reply_is_shaped_and_anything_else_passes_untouched() {
        let call = serde_json::json!({ "ok": true, "result": {
            "content": [{ "type": "text", "text": "Found 1 window(s)." }],
            "structuredContent": { "windows": [{ "window_id": 7 }] },
        } });
        for local in [true, false] {
            let out: Value =
                serde_json::from_str(&shape_daemon_line(call.to_string(), local)).unwrap();
            assert_eq!(
                out["result"]["content"].as_array().unwrap().len(),
                2,
                "local={local}"
            );
        }
        for line in [
            "not json",
            r#"{"ok":false,"error":"Permission denied"}"#,
            r#"{"ok":true,"result":"pong"}"#,
        ] {
            assert_eq!(shape_daemon_line(line.to_string(), true), line);
        }
    }

    /// The agent's proxy talks to the relay as it would to the daemon: one
    /// JSON line each way per connection.
    #[cfg(unix)]
    #[tokio::test]
    async fn the_relay_passes_requests_on_and_shapes_the_replies() {
        use tokio::io::{AsyncBufReadExt, AsyncReadExt, AsyncWriteExt};
        let dir = daemon_scratch("cua-relay");
        let daemon = dir.join("d.sock");
        let listener = tokio::net::UnixListener::bind(&daemon).unwrap();
        tokio::spawn(async move {
            while let Ok((stream, _)) = listener.accept().await {
                let (read, mut write) = stream.into_split();
                let mut request = String::new();
                tokio::io::BufReader::new(read)
                    .read_line(&mut request)
                    .await
                    .unwrap();
                let reply = serde_json::json!({ "ok": true, "result": {
                    "content": [{ "type": "text", "text": format!("Found 1 window(s) for {}", request.trim()) }],
                    "structuredContent": { "windows": [{ "window_id": 7 }] },
                } });
                write
                    .write_all(format!("{reply}\n").as_bytes())
                    .await
                    .unwrap();
            }
        });

        let agent = agent_socket(&daemon, false);
        assert_eq!(agent, dir.join("cua-driver-agent.sock"));
        assert_eq!(agent_socket(&daemon, false), agent, "bound once, reused");
        let mut stream = tokio::net::UnixStream::connect(&agent).await.unwrap();
        stream
            .write_all(b"{\"method\":\"call\",\"name\":\"list_windows\"}\n")
            .await
            .unwrap();
        stream.shutdown().await.unwrap();
        let mut reply = String::new();
        stream.read_to_string(&mut reply).await.unwrap();
        assert!(reply.ends_with('\n'), "{reply}");
        let reply: Value = serde_json::from_str(reply.trim()).unwrap();
        let content = reply["result"]["content"].as_array().unwrap();
        assert!(
            content[0]["text"]
                .as_str()
                .unwrap()
                .contains("\"name\":\"list_windows\""),
            "{content:?}"
        );
        assert!(
            content[1]["text"]
                .as_str()
                .unwrap()
                .contains("\"window_id\":7"),
            "{content:?}"
        );
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[cfg(unix)]
    #[test]
    fn a_daemon_counts_as_alive_only_while_its_process_runs() {
        assert!(!proc_alive(None));
        let mut child = Command::new("sleep")
            .arg("30")
            .stdin(Stdio::piped())
            .spawn()
            .unwrap();
        let stdin = child.stdin.take().unwrap();
        let mut proc = DaemonProc {
            child,
            _stdin: stdin,
            socket: PathBuf::from("/s/cua-driver.sock"),
        };
        assert!(proc_alive(Some(&mut proc)));
        proc.child.kill().unwrap();
        proc.child.wait().unwrap();
        assert!(!proc_alive(Some(&mut proc)));
    }
}
