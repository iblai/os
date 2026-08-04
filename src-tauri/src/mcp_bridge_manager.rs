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
use std::sync::OnceLock;

#[cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]
use std::process::{Command, Stdio};

/// Port the bridge listens on (its default; passed explicitly for clarity).
#[cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]
const BRIDGE_PORT: u16 = 8000;

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
            candidates.push(home.join(".local").join("bin").join("ollama-mcp-bridge.exe"));
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
        println!("[McpBridge] Failed to create config dir {}: {e}", dir.display());
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

/// Is something already listening on the bridge port?
#[cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]
fn is_bridge_running() -> bool {
    use std::net::{SocketAddr, TcpStream};
    use std::time::Duration;

    let addr: SocketAddr = ([127, 0, 0, 1], BRIDGE_PORT).into();
    TcpStream::connect_timeout(&addr, Duration::from_millis(300)).is_ok()
}

/// Start the bridge if it is installed and not already running. Best-effort:
/// every failure is logged, never propagated (a missing bridge must not break
/// the Ollama lifecycle). No-op on unsupported platforms.
pub fn start_bridge() {
    #[cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]
    {
        if is_bridge_running() {
            println!("[McpBridge] Bridge already running on port {BRIDGE_PORT}");
            return;
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

        println!(
            "[McpBridge] Starting bridge: {bin} --host {BRIDGE_HOST} --config {} --port {BRIDGE_PORT}",
            config.display()
        );
        let mut cmd = create_command(&bin);
        cmd.arg("--host")
            .arg(BRIDGE_HOST)
            .arg("--config")
            .arg(&config)
            .arg("--port")
            .arg(BRIDGE_PORT.to_string())
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
            Ok(_) => println!("[McpBridge] Bridge started"),
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
        parts.push(home.join(".local").join("bin").to_string_lossy().into_owned());
    }
    parts.push("/opt/homebrew/bin".to_string());
    parts.push("/usr/local/bin".to_string());
    if let Ok(existing) = std::env::var("PATH") {
        parts.push(existing);
    }
    parts.join(":")
}

/// Stop the bridge process. No-op on unsupported platforms.
pub fn stop_bridge() {
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
