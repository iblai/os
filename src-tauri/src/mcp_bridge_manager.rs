//! Runtime lifecycle + file-based configuration for the `ollama-mcp-bridge`.
//!
//! The bridge runs *alongside* Ollama: it is started right after the Ollama
//! server starts and stopped when the Ollama server stops (see
//! `model_manager::start_ollama_server` / `stop_ollama_server`).
//!
//! MCP servers are managed by editing `mcp-config.json` in the app data
//! directory — there is no UI. A companion `mcp-config.example.json` documents
//! the format. Edits take effect the next time the bridge (re)starts, i.e. when
//! "Enable Local Models" is toggled off and on again, or the app restarts.

use std::path::PathBuf;
use std::sync::{Mutex, OnceLock};

#[cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]
use std::process::{Command, Stdio};

/// Port the bridge prefers. Only a preference: when it is taken (another app, a
/// second copy of this one) the OS picks a free one instead — a busy 8000 must
/// never break local chat.
#[cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]
const DEFAULT_BRIDGE_PORT: u16 = 8000;

/// How long a freshly spawned bridge gets to accept connections before the
/// start is called a failure. Python + MCP server boot, so seconds, not millis.
#[cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]
const BRIDGE_READY_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(10);

/// The port a bridge WE started is listening on. `None` means no bridge of ours
/// is up, and callers must fail loudly rather than guess a URL: the old code
/// assumed 8000 unconditionally, so an unrelated server there silently became
/// the chat backend.
static ACTIVE_PORT: Mutex<Option<u16>> = Mutex::new(None);

/// The port the running bridge listens on, or `None` when we haven't started one.
pub fn bridge_port() -> Option<u16> {
    *ACTIVE_PORT.lock().unwrap_or_else(|e| e.into_inner())
}

/// Pretend a bridge is (or isn't) running, for tests that exercise the callers
/// of [`bridge_port`] without spawning a real Python process.
#[cfg(test)]
pub(crate) fn set_bridge_port_for_test(port: Option<u16>) {
    *ACTIVE_PORT.lock().unwrap_or_else(|e| e.into_inner()) = port;
}

/// Serializes tests that write [`ACTIVE_PORT`] — it is process-global, so
/// parallel set-then-assert sequences interleave and flake.
#[cfg(test)]
pub(crate) fn bridge_state_lock() -> std::sync::MutexGuard<'static, ()> {
    static L: std::sync::Mutex<()> = std::sync::Mutex::new(());
    L.lock().unwrap_or_else(|e| e.into_inner())
}

/// Bind to loopback only. The bridge defaults to `0.0.0.0` (all interfaces);
/// pin it to localhost so it isn't reachable from the network.
#[cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]
const BRIDGE_HOST: &str = "127.0.0.1";
const CONFIG_FILE: &str = "mcp-config.json";
#[cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]
const EXAMPLE_FILE: &str = "mcp-config.example.json";

/// App data directory, recorded once during Tauri `setup()` so the bridge
/// lifecycle (which runs without an `AppHandle`) can locate the MCP config.
static CONFIG_DIR: OnceLock<PathBuf> = OnceLock::new();

/// Minimal valid config the bridge accepts: no servers configured yet.
#[cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]
const DEFAULT_CONFIG: &str = "{\n  \"mcpServers\": {}\n}\n";

/// A documented, copy-paste-friendly example written alongside the live config.
/// Not loaded by the bridge — purely a reference for hand-editing.
#[cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]
const EXAMPLE_CONFIG: &str = r#"{
  "_help": "Copy entries from 'mcpServers' below into mcp-config.json. Local servers use command/args/env; remote servers use url. Changes apply when local models are toggled off/on or the app restarts. Supports ${workspaceFolder} and ${env:VAR}.",
  "mcpServers": {
    "filesystem": {
      "command": "uvx",
      "args": ["mcp-server-filesystem", "/path/to/allowed/dir"]
    },
    "github": {
      "command": "uvx",
      "args": ["mcp-server-git"],
      "env": { "GITHUB_TOKEN": "${env:GITHUB_TOKEN}" }
    },
    "example-remote": {
      "url": "https://example.com/mcp"
    }
  }
}
"#;

/// Record the app data directory and make sure the user-editable config exists.
/// Call once at startup (Tauri `setup`).
pub fn init(dir: PathBuf) {
    let _ = CONFIG_DIR.set(dir);

    #[cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]
    {
        if let Some(path) = ensure_config() {
            println!("[McpBridge] MCP servers config: {}", path.display());
        }
    }
}

/// Absolute path to the live, user-editable MCP config file (if known).
pub fn mcp_config_path() -> Option<PathBuf> {
    CONFIG_DIR.get().map(|d| d.join(CONFIG_FILE))
}

/// Create a Command with a hidden console window on Windows.
#[cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]
fn create_command(program: &str) -> Command {
    let mut cmd = Command::new(program);

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    cmd
}

/// Home directory, mirroring the `HOME`/`USERPROFILE` convention used elsewhere.
#[cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]
fn home_dir() -> Option<PathBuf> {
    #[cfg(target_os = "windows")]
    let var = "USERPROFILE";
    #[cfg(not(target_os = "windows"))]
    let var = "HOME";

    std::env::var(var).ok().map(PathBuf::from)
}

/// Resolve a runnable path to the `ollama-mcp-bridge` executable, probing PATH
/// first and then the locations `uv tool install` / pip use. Returns `None`
/// when the bridge isn't installed.
#[cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]
fn resolve_bridge_bin() -> Option<String> {
    let on_path = create_command("ollama-mcp-bridge")
        .arg("--help")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false);
    if on_path {
        return Some("ollama-mcp-bridge".to_string());
    }

    let mut candidates: Vec<PathBuf> = Vec::new();
    if let Some(home) = home_dir() {
        #[cfg(target_os = "windows")]
        {
            candidates.push(
                home.join(".local")
                    .join("bin")
                    .join("ollama-mcp-bridge.exe"),
            );
        }
        #[cfg(not(target_os = "windows"))]
        {
            candidates.push(home.join(".local/bin/ollama-mcp-bridge"));
            candidates.push(home.join(".cargo/bin/ollama-mcp-bridge"));
        }
    }

    candidates
        .into_iter()
        .find(|p| p.exists())
        .map(|p| p.to_string_lossy().into_owned())
}

/// Ensure the live config exists (scaffolding an empty one) and refresh the
/// example file. Returns the live config path.
#[cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]
fn ensure_config() -> Option<PathBuf> {
    let dir = CONFIG_DIR.get()?;
    if let Err(e) = std::fs::create_dir_all(dir) {
        println!(
            "[McpBridge] Failed to create config dir {}: {e}",
            dir.display()
        );
        return None;
    }

    let live = dir.join(CONFIG_FILE);
    if !live.exists() {
        if let Err(e) = std::fs::write(&live, DEFAULT_CONFIG) {
            println!("[McpBridge] Failed to scaffold {}: {e}", live.display());
            return None;
        }
        println!("[McpBridge] Created MCP config at {}", live.display());
    }

    // Keep the reference example current (cheap, never clobbers the live file).
    let _ = std::fs::write(dir.join(EXAMPLE_FILE), EXAMPLE_CONFIG);

    Some(live)
}

/// Is the bridge we started still answering?
#[cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]
fn is_listening(port: u16) -> bool {
    use std::net::{SocketAddr, TcpStream};
    use std::time::Duration;

    let addr: SocketAddr = ([127, 0, 0, 1], port).into();
    TcpStream::connect_timeout(&addr, Duration::from_millis(300)).is_ok()
}

/// Pick a port for the bridge: `preferred` when it is genuinely free, otherwise
/// whatever the OS hands out (bind to 0).
///
/// The test is a BIND, never a connect. A successful connect only proves that
/// *something* answers there — which is precisely how an unrelated server on
/// 8000 used to be adopted as "our bridge", silently becoming the chat backend.
///
/// The probe listener is dropped before the child spawns, so a racing process
/// could still take the port in that window; the readiness poll in
/// [`start_bridge`] is what turns that into a loud failure instead of a wedge.
#[cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]
fn pick_port(preferred: u16) -> Option<u16> {
    use std::net::TcpListener;

    [preferred, 0].into_iter().find_map(|candidate| {
        TcpListener::bind((BRIDGE_HOST, candidate))
            .ok()
            .and_then(|l| l.local_addr().ok())
            .map(|addr| addr.port())
    })
}

/// Block until the freshly spawned bridge accepts connections, or the timeout
/// expires. Without this a failed bind in the child (its stderr is discarded)
/// would look exactly like a successful start.
#[cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]
fn wait_until_listening(port: u16, timeout: std::time::Duration) -> bool {
    let deadline = std::time::Instant::now() + timeout;
    while std::time::Instant::now() < deadline {
        if is_listening(port) {
            return true;
        }
        std::thread::sleep(std::time::Duration::from_millis(100));
    }
    false
}

/// Start the bridge if it is installed and not already running. Best-effort:
/// every failure is logged, never propagated (a missing bridge must not break
/// the Ollama lifecycle). No-op on unsupported platforms.
pub fn start_bridge() {
    #[cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]
    {
        // Held across the whole start so two concurrent callers (the Ollama
        // lifecycle and `ensure_mcp_bridge`) can't race into killing each
        // other's freshly spawned child.
        let mut active = ACTIVE_PORT.lock().unwrap_or_else(|e| e.into_inner());

        if let Some(port) = *active {
            if is_listening(port) {
                println!("[McpBridge] Bridge already running on port {port}");
                return;
            }
            println!("[McpBridge] Bridge on port {port} is gone — restarting");
            *active = None;
        }

        let bin = match resolve_bridge_bin() {
            Some(b) => b,
            None => {
                println!("[McpBridge] ollama-mcp-bridge not installed; skipping start");
                return;
            }
        };

        let config = match ensure_config() {
            Some(c) => c,
            None => {
                println!("[McpBridge] MCP config unavailable; skipping bridge start");
                return;
            }
        };

        // We have no bridge of our own, so any surviving one is a leftover from
        // a crashed run: reap it rather than leave an orphan holding a port.
        // NOT `stop_bridge`: that re-takes the lock we are holding.
        kill_bridge_processes();

        let port = match pick_port(DEFAULT_BRIDGE_PORT) {
            Some(p) => p,
            None => {
                println!("[McpBridge] No free port available; skipping bridge start");
                return;
            }
        };
        if port != DEFAULT_BRIDGE_PORT {
            println!("[McpBridge] Port {DEFAULT_BRIDGE_PORT} is taken — using {port}");
        }

        println!(
            "[McpBridge] Starting bridge: {bin} --host {BRIDGE_HOST} --config {} --port {port}",
            config.display()
        );
        let mut cmd = create_command(&bin);
        cmd.arg("--host")
            .arg(BRIDGE_HOST)
            .arg("--config")
            .arg(&config)
            .arg("--port")
            .arg(port.to_string())
            .stdout(Stdio::null())
            .stderr(Stdio::null());

        // macOS: the bridge spawns the configured MCP servers and they may spawn
        // sidecars of their own. A server installed to ~/.local/bin or a Homebrew
        // prefix often isn't on a GUI app's PATH, so prepend the common bins to
        // the bridge's PATH so the servers and their sidecars resolve.
        #[cfg(target_os = "macos")]
        {
            cmd.env("PATH", macos_server_path());
        }

        match cmd.spawn() {
            Ok(_) => {
                // Recorded only once it actually answers: a port that never came
                // up must read as "no bridge", not as a chat URL that 404s.
                if wait_until_listening(port, BRIDGE_READY_TIMEOUT) {
                    *active = Some(port);
                    println!("[McpBridge] Bridge started on port {port}");
                } else {
                    println!("[McpBridge] Bridge did not start listening on port {port}");
                }
            }
            Err(e) => println!("[McpBridge] Failed to start bridge: {e}"),
        }
    }
}

/// PATH for spawned MCP servers on macOS: `~/.local/bin` and the Homebrew bins
/// (so a helper installed by the no-Homebrew fallback resolves even when
/// `~/.local/bin` isn't on the app's PATH), followed by the inherited PATH.
#[cfg(target_os = "macos")]
fn macos_server_path() -> String {
    let mut parts: Vec<String> = Vec::new();
    if let Some(home) = home_dir() {
        parts.push(
            home.join(".local")
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

/// Stop the bridge process and forget its port. No-op on unsupported platforms.
pub fn stop_bridge() {
    kill_bridge_processes();
    *ACTIVE_PORT.lock().unwrap_or_else(|e| e.into_inner()) = None;
}

/// Kill any bridge process by name, WITHOUT touching [`ACTIVE_PORT`] — the
/// memo's lock is already held by `start_bridge` when it reaps leftovers, and
/// re-entering it there would deadlock.
fn kill_bridge_processes() {
    // macOS/Linux: match the full command line (the executable is a shim that
    // contains "ollama-mcp-bridge").
    #[cfg(any(target_os = "macos", target_os = "linux"))]
    {
        create_command("pkill")
            .args(["-TERM", "-f", "ollama-mcp-bridge"])
            .output()
            .ok();
    }

    // Windows: uv installs an `ollama-mcp-bridge.exe` shim; /T kills the Python
    // child it launches too.
    #[cfg(target_os = "windows")]
    {
        create_command("taskkill")
            .args(["/F", "/T", "/IM", "ollama-mcp-bridge.exe"])
            .output()
            .ok();
    }
}

#[cfg(all(
    test,
    any(target_os = "windows", target_os = "macos", target_os = "linux")
))]
mod tests {
    use super::*;
    use std::net::TcpListener;

    /// The happy path: nothing is holding the preferred port, so the bridge
    /// keeps its documented one.
    ///
    /// Retried across candidates: "reserve an ephemeral port, release it, bind
    /// it again" races the sibling port tests, which the OS is happy to hand
    /// the just-released number. One stolen candidate is a scheduling accident;
    /// five in a row is a real preference bug.
    #[test]
    fn a_free_preferred_port_is_the_one_chosen() {
        for _ in 0..5 {
            // Ask the OS for a port and release it — free until someone races us.
            let free = TcpListener::bind((BRIDGE_HOST, 0))
                .unwrap()
                .local_addr()
                .unwrap()
                .port();
            if pick_port(free) == Some(free) {
                return;
            }
        }
        panic!("a free preferred port was never the one chosen");
    }

    /// The whole point: a busy 8000 must move the bridge, not break it.
    #[test]
    fn a_busy_preferred_port_falls_back_to_a_free_one() {
        // Held for the duration, so the preferred port is genuinely occupied.
        let squatter = TcpListener::bind((BRIDGE_HOST, 0)).unwrap();
        let taken = squatter.local_addr().unwrap().port();

        let picked = pick_port(taken).expect("a busy port must not stop us");
        assert_ne!(picked, taken, "the occupied port cannot be handed out");
        // Usable, not merely different: bind it to prove the bridge could too.
        drop(TcpListener::bind((BRIDGE_HOST, picked)).expect("picked port is bindable"));
    }

    /// A *connect* probe would call the squatter "our bridge" — the old bug
    /// that silently pointed chat at whatever answered on 8000.
    #[test]
    fn an_occupied_port_is_never_mistaken_for_our_bridge() {
        let _guard = bridge_state_lock();
        let squatter = TcpListener::bind((BRIDGE_HOST, 0)).unwrap();
        let taken = squatter.local_addr().unwrap().port();

        set_bridge_port_for_test(None);
        assert_eq!(
            bridge_port(),
            None,
            "someone else's listener is not a bridge of ours"
        );
        assert!(is_listening(taken), "the squatter really is answering");
        set_bridge_port_for_test(None);
    }

    /// Stopping forgets the port: a later `chat_base_url` must fail loudly
    /// rather than name a port nothing is serving.
    #[test]
    fn stopping_the_bridge_forgets_its_port() {
        let _guard = bridge_state_lock();
        set_bridge_port_for_test(Some(8123));
        assert_eq!(bridge_port(), Some(8123));

        stop_bridge();
        assert_eq!(bridge_port(), None);
    }
}
