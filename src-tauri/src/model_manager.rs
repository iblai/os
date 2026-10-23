use futures_util::StreamExt;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::Value;
#[cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};

/// Set when the user cancels an in-flight model download. `pull_model` checks
/// this each iteration and stops cleanly (emitting a "cancelled" event) instead
/// of relying solely on killing the Ollama process.
static DOWNLOAD_CANCELLED: AtomicBool = AtomicBool::new(false);
#[cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]
use std::process::Command;
#[cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]
use sysinfo::{Disks, System};

#[cfg(target_os = "windows")]
use std::process::Stdio;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

/// Create a Command with hidden console window on Windows
#[cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]
fn create_command(program: &str) -> Command {
    let mut cmd = Command::new(program);

    #[cfg(target_os = "windows")]
    {
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    cmd
}

/// Whether `sudo` can run non-interactively right now (passwordless sudoers entry
/// or a still-valid cached credential). Used to decide whether to attempt
/// privileged systemd/package-manager commands before falling back to
/// unprivileged alternatives. `sudo -n` never prompts — it fails fast instead.
#[cfg(target_os = "linux")]
pub fn can_sudo() -> bool {
    create_command("sudo")
        .args(["-n", "true"])
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

/// Event payload for download progress updates
#[derive(Clone, Serialize)]
pub struct DownloadProgress {
    pub status: String,
    pub completed: u64,
    pub total: u64,
    pub percentage: f64,
    pub digest: Option<String>,
    pub message: String,
}

/// Event payload for installation logs
#[derive(Clone, Serialize)]
pub struct InstallationLog {
    pub timestamp: String,
    pub level: String,
    pub message: String,
}

/// Event payload for disk space errors
#[derive(Clone, Serialize)]
pub struct DiskSpaceError {
    pub required_gb: f64,
    pub available_gb: f64,
    pub message: String,
}

/// Ollama status information
#[derive(Clone, Serialize)]
pub struct OllamaStatus {
    pub installed: bool,
    pub running: bool,
    pub model_installed: bool,
    /// All model tags currently installed in Ollama (e.g. "llama3.2:latest",
    /// "phi3:mini"). Lets the UI mark every downloaded model as ready, not just
    /// the primary one.
    pub installed_models: Vec<String>,
}

/// Ollama API response for streaming pull
#[derive(Deserialize)]
struct OllamaPullResponse {
    status: Option<String>,
    digest: Option<String>,
    total: Option<u64>,
    completed: Option<u64>,
    error: Option<String>,
}

/// Ollama models list response
#[derive(Deserialize)]
struct OllamaTagsResponse {
    models: Option<Vec<OllamaModel>>,
}

#[derive(Deserialize)]
struct OllamaModel {
    name: Option<String>,
}

pub const OLLAMA_API_URL: &str = "http://localhost:11434";
pub const REQUIRED_FREE_SPACE_GB: f64 = 5.0;

/// How much free space a download of `model` actually needs. Mobile knows the
/// exact GGUF byte size from the embedded catalog, so it budgets model + 1 GB
/// of headroom — a 0.8 GB model must not demand the desktop's blanket 5 GB on
/// a phone. Desktop pulls through Ollama (sizes unknown here) and keeps the
/// blanket requirement. `mobile` is passed in so the rule is testable on any
/// host.
pub fn required_space_gb(model: Option<&str>, mobile: bool) -> f64 {
    if mobile {
        if let Some(entry) = model.and_then(crate::local_llm::resolve) {
            return entry.size as f64 / (1024.0 * 1024.0 * 1024.0) + 1.0;
        }
    }
    REQUIRED_FREE_SPACE_GB
}

/// The model-manager API base: Ollama on desktop, the embedded llama.cpp
/// server on iOS (which also prefers port 11434, but may have fallen back to
/// another port — so never assume the constant there).
pub fn api_base_url() -> String {
    #[cfg(any(target_os = "ios", target_os = "android"))]
    if let Some(url) = crate::local_llm::server_url() {
        return url;
    }
    OLLAMA_API_URL.to_string()
}

/// Base URL chat must stream from: the MCP bridge — the one and only chat port.
/// Plain Ollama on :11434 is reserved for status/version/pull checks, never
/// chat. A non-tool-capable model can't use the bridge (Ollama would 400 the
/// injected `tools` field), so we refuse rather than route anywhere.
/// `tool_support` is the selected model's catalog flag, forwarded by the SDK.
///
/// The port comes from the running bridge rather than a constant: it prefers
/// 8000 but takes any free port when that one is busy. No bridge of ours
/// running is an error, never a guessed URL — assuming 8000 is what used to
/// send chat at whatever unrelated server happened to hold the port.
pub fn chat_base_url(tool_support: bool) -> Result<String, String> {
    // iOS chats against the embedded server directly: there is no MCP bridge
    // on mobile (it's a spawned Node process), and the embedded /api/chat
    // takes no `tools` field, so tool support doesn't gate anything.
    #[cfg(any(target_os = "ios", target_os = "android"))]
    {
        let _ = tool_support;
        return crate::local_llm::server_url()
            .ok_or_else(|| "embedded local LLM server is not running".to_string());
    }
    #[cfg(not(any(target_os = "ios", target_os = "android")))]
    {
        if !tool_support {
            let msg = "Local chat requires a tool-capable model — streaming only runs \
                       through the MCP bridge, and the selected model has \
                       tool_support=false"
                .to_string();
            println!("[McpBridge] {msg}");
            return Err(msg);
        }
        match crate::mcp_bridge_manager::bridge_port() {
            Some(port) => Ok(format!("http://localhost:{port}")),
            None => {
                println!("[McpBridge] Local chat refused: no bridge of ours is running");
                Err(
                    "Local models couldn't start on this computer — turn Local Models \
                     off and on to set them up again"
                        .to_string(),
                )
            }
        }
    }
}

/// Sends a local chat through the bridge. The bridge's port lives only in this
/// process, so after a relaunch none is recorded until [`warm_up_local_chat`]
/// (called at launch while Local Models is on) or this send starts one.
///
/// Sending only reads that port — nothing is probed before a message. What
/// stopped since is noticed from the answer, and brought back once before the
/// same chat is resent: a bridge that died refuses the connection, and a
/// bridge whose Ollama was quit answers 503.
pub async fn post_local_chat(
    client: &Client,
    body: &Value,
    tool_support: bool,
) -> Result<reqwest::Response, String> {
    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        let base = chat_base_url(tool_support)?;
        return send_chat(client, &base, body)
            .await
            .map_err(unreachable_chat);
    }
    #[cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]
    {
        post_local_chat_with(
            client,
            body,
            tool_support,
            start_local_chat_runtime,
            is_ollama_running,
        )
        .await
    }
}

#[cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]
async fn post_local_chat_with<F, Fut, R, RFut>(
    client: &Client,
    body: &Value,
    tool_support: bool,
    start: F,
    ollama_running: R,
) -> Result<reqwest::Response, String>
where
    F: Fn() -> Fut,
    Fut: std::future::Future<Output = ()>,
    R: Fn() -> RFut,
    RFut: std::future::Future<Output = bool>,
{
    if tool_support && crate::mcp_bridge_manager::bridge_port_now().is_none() {
        start().await;
    }
    let base = chat_base_url(tool_support)?;
    let response = match send_chat(client, &base, body).await {
        Err(e) if e.is_connect() => {
            println!("[McpBridge] Nothing answered on {base} — restarting the bridge");
            start().await;
            let base = chat_base_url(tool_support)?;
            return send_chat(client, &base, body)
                .await
                .map_err(unreachable_chat);
        }
        sent => sent.map_err(unreachable_chat)?,
    };
    // A 503 with Ollama up is the bridge's own answer and goes back as it was.
    if response.status() == reqwest::StatusCode::SERVICE_UNAVAILABLE && !ollama_running().await {
        println!("[McpBridge] The bridge can't reach Ollama — starting it");
        start().await;
        let base = chat_base_url(tool_support)?;
        return send_chat(client, &base, body)
            .await
            .map_err(unreachable_chat);
    }
    Ok(response)
}

async fn send_chat(
    client: &Client,
    base: &str,
    body: &Value,
) -> reqwest::Result<reqwest::Response> {
    println!("[ibl.ai] Sending local chat to {base}");
    client
        .post(format!("{base}/api/chat"))
        .json(body)
        .send()
        .await
}

fn unreachable_chat(e: reqwest::Error) -> String {
    format!("Failed to connect to Ollama: {e}. Is Ollama running?")
}

/// Brings Ollama and the bridge up ahead of the first chat, so it doesn't wait
/// out the bridge's cold start. The webview calls this at launch while Local
/// Models is on; that switch lives in its storage, not here.
#[cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]
pub async fn warm_up_local_chat() {
    warm_up_local_chat_with(check_ollama_installed, start_local_chat_runtime).await
}

#[cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]
async fn warm_up_local_chat_with<F, Fut>(ollama_installed: impl Fn() -> bool, start: F)
where
    F: Fn() -> Fut,
    Fut: std::future::Future<Output = ()>,
{
    if ollama_installed() {
        start().await;
    }
}

/// One start at a time. The launch warm-up, a chat that beats it and a restart
/// after a failed send can overlap; a later caller waits for the start in
/// flight, then finds Ollama and the bridge up and starts nothing.
#[cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]
static LOCAL_CHAT_START: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

/// Starts only what isn't running. The bridge only forwards to Ollama, so
/// Ollama comes up first — a bridge in front of nothing would just move the
/// failure to the first request.
#[cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]
async fn start_local_chat_runtime() {
    start_local_chat_runtime_with(
        is_ollama_running,
        || async {
            match tokio::task::spawn_blocking(start_ollama_server).await {
                Ok(Ok(())) => {
                    wait_for_ollama_ready(20).await;
                }
                Ok(Err(e)) => println!("[McpBridge] Couldn't start Ollama for local chat: {e}"),
                Err(e) => println!("[McpBridge] Ollama start task failed: {e}"),
            }
        },
        || async {
            let _ = tokio::task::spawn_blocking(crate::mcp_bridge_manager::start_bridge).await;
        },
    )
    .await
}

#[cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]
async fn start_local_chat_runtime_with<R, RFut, O, OFut, B, BFut>(
    ollama_running: R,
    start_ollama: O,
    start_bridge: B,
) where
    R: Fn() -> RFut,
    RFut: std::future::Future<Output = bool>,
    O: Fn() -> OFut,
    OFut: std::future::Future<Output = ()>,
    B: Fn() -> BFut,
    BFut: std::future::Future<Output = ()>,
{
    let _one_start = LOCAL_CHAT_START.lock().await;
    if !ollama_running().await {
        start_ollama().await;
    }
    start_bridge().await;
}

/// Get the current timestamp in RFC3339 format
pub fn get_timestamp() -> String {
    chrono::Utc::now().to_rfc3339()
}

/// Check if Ollama is installed on the system
pub fn check_ollama_installed() -> bool {
    #[cfg(target_os = "windows")]
    {
        // Ollama installs to %LOCALAPPDATA%\Programs\Ollama
        if let Ok(local_appdata) = std::env::var("LOCALAPPDATA") {
            let ollama_path = format!("{}\\Programs\\Ollama\\ollama.exe", local_appdata);
            return Path::new(&ollama_path).exists();
        }
        return false;
    }

    #[cfg(target_os = "macos")]
    {
        // The DMG installs /Applications/Ollama.app; Homebrew installs only the
        // `ollama` CLI (no .app). Detect either, otherwise we reinstall over an
        // existing `brew install ollama` and end up with a duplicate Ollama.app.
        if Path::new("/Applications/Ollama.app").exists() {
            return true;
        }
        return Path::new("/opt/homebrew/bin/ollama").exists()
            || Path::new("/usr/local/bin/ollama").exists();
    }

    #[cfg(target_os = "linux")]
    {
        let ollama_path = "/usr/bin/ollama";
        return Path::new(ollama_path).exists();
    }

    // iOS ships its model manager inside the binary (local_llm.rs) — nothing
    // to install, so it always reads as installed.
    #[cfg(any(target_os = "ios", target_os = "android"))]
    {
        true
    }
}

/// How long Ollama gets to answer a health check. Generous for a healthy one,
/// which answers in milliseconds even while loading a model.
const OLLAMA_CHECK_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(5);

/// Check if Ollama server is running by pinging the API. Bounded: one that
/// accepts the connection but never answers (stuck after the computer wakes,
/// say) reads as not running, instead of hanging the caller — and every chat
/// queued behind a start — for good.
pub async fn is_ollama_running() -> bool {
    let status = ollama_answers(&api_base_url(), OLLAMA_CHECK_TIMEOUT).await;
    println!("[Ollama] running: {}", status);
    status
}

async fn ollama_answers(base: &str, timeout: std::time::Duration) -> bool {
    let Ok(client) = Client::builder().timeout(timeout).build() else {
        return false;
    };
    let Ok(resp) = client.get(format!("{base}/api/version")).send().await else {
        return false;
    };
    let Ok(json) = resp.json::<Value>().await else {
        return false;
    };
    json.get("version").is_some_and(Value::is_string)
}

/// Poll until Ollama is actually answering its API, up to `timeout_secs`.
/// Starting Ollama (systemd or `ollama serve`) returns before the server is
/// ready to serve, so callers that just started it must wait for readiness
/// instead of assuming a fixed delay is enough. Returns true once reachable.
///
/// Ollama starts accepting connections (`/api/version`) a moment before it can
/// actually serve real requests (e.g. `/api/tags`), so once it first responds we
/// wait a short grace period before declaring it ready — otherwise callers reach
/// it too early and fail.
pub async fn wait_for_ollama_ready(timeout_secs: u64) -> bool {
    const GRACE: std::time::Duration = std::time::Duration::from_secs(1);
    for _ in 0..timeout_secs.max(1) {
        if is_ollama_running().await {
            return true;
        }
        tokio::time::sleep(std::time::Duration::from_secs(1)).await;
    }
    if is_ollama_running().await {
        true
    } else {
        false
    }
}

/// Start Ollama server if not running
pub fn start_ollama_server() -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        // Prefer the GUI app when present; otherwise start the Homebrew CLI
        // server directly (`brew install ollama` provides no .app bundle).
        if Path::new("/Applications/Ollama.app").exists() {
            create_command("open")
                .arg("-a")
                .arg("Ollama")
                .spawn()
                .map_err(|e| format!("Failed to start Ollama: {}", e))?;
        } else {
            let bin = ["/opt/homebrew/bin/ollama", "/usr/local/bin/ollama"]
                .into_iter()
                .find(|p| Path::new(p).exists())
                .unwrap_or("ollama");
            create_command(bin)
                .arg("serve")
                .spawn()
                .map_err(|e| format!("Failed to start Ollama: {}", e))?;
        }
    }

    #[cfg(target_os = "windows")]
    {
        // Ollama installs to %LOCALAPPDATA%\Programs\Ollama
        let local_appdata = std::env::var("LOCALAPPDATA")
            .map_err(|_| "LOCALAPPDATA environment variable not set".to_string())?;
        let ollama_exe = format!("{}\\Programs\\Ollama\\ollama.exe", local_appdata);

        Command::new(ollama_exe)
            .arg("serve")
            .creation_flags(0x08000000)
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|e| format!("Failed to start Ollama: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        // Prefer the systemd service via sudo (only attempted when sudo is
        // non-interactive); fall back to spawning the server executable directly.
        let systemctl_started = can_sudo()
            && create_command("sudo")
                .args(["systemctl", "start", "ollama"])
                .status()
                .map(|s| s.success())
                .unwrap_or(false);
        if !systemctl_started {
            create_command("ollama")
                .arg("serve")
                .spawn()
                .map_err(|e| format!("Failed to start Ollama: {}", e))?;
        }
    }

    // Mobile: the embedded server is started at app setup; retry that start
    // here (idempotent) so a launch-time failure is recoverable on the next
    // download instead of being permanent until the app restarts.
    #[cfg(any(target_os = "ios", target_os = "android"))]
    {
        return crate::local_llm::ensure_started().map(|_| ());
    }

    #[cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]
    {
        // The MCP bridge runs alongside Ollama, so bring it up with the server.
        crate::mcp_bridge_manager::start_bridge();
        Ok(())
    }
}

/// Stop the Ollama server (the model manager). On Linux prefer the systemd
/// service, falling back to killing the process; on macOS/Windows kill the
/// process directly.
pub fn stop_ollama_server() -> Result<(), String> {
    // iOS: the embedded HTTP server stays up (it's cheap), but the loaded
    // model is dropped — that's the ~1 GB a phone actually wants back when
    // local models are switched off.
    #[cfg(any(target_os = "ios", target_os = "android"))]
    {
        let _ = crate::local_llm::engine_unload();
        return Ok(());
    }

    #[cfg(target_os = "windows")]
    {
        create_command("taskkill")
            .args(["/F", "/IM", "ollama.exe"])
            .output()
            .ok();
    }

    #[cfg(target_os = "macos")]
    {
        create_command("pkill")
            .args(["-TERM", "-f", "ollama"])
            .output()
            .ok();
    }

    #[cfg(target_os = "linux")]
    {
        // Prefer the systemd service via sudo (only when sudo is non-interactive);
        // fall back to killing the process directly.
        let systemctl_stopped = can_sudo()
            && create_command("sudo")
                .args(["systemctl", "stop", "ollama"])
                .status()
                .map(|s| s.success())
                .unwrap_or(false);
        if !systemctl_stopped {
            create_command("pkill")
                .args(["-TERM", "-f", "ollama"])
                .output()
                .ok();
        }
    }

    #[cfg(not(any(target_os = "ios", target_os = "android")))]
    {
        // The MCP bridge follows Ollama's lifecycle: stop it with the server.
        crate::mcp_bridge_manager::stop_bridge();

        Ok(())
    }
}

/// Check available disk space on the drive where models are stored
pub fn check_disk_space() -> Result<f64, String> {
    // Mobile: measure the filesystem the models actually land on — the
    // app-data models dir remembered at local_llm startup. NOT `$HOME`:
    // iOS happens to set it to the sandbox, but Android leaves it unset and
    // statvfs on `/` reports 0 bytes available to an app, which blocked
    // every download with "0.0 GB available".
    #[cfg(any(target_os = "ios", target_os = "android"))]
    {
        if let Some(dir) = crate::local_llm::models_dir() {
            // The dir may not exist before the first pull; statvfs needs a
            // real path.
            let _ = std::fs::create_dir_all(&dir);
            return crate::local_llm::available_disk_gb(&dir);
        }
        let home = std::env::var("HOME").unwrap_or_else(|_| "/".to_string());
        return crate::local_llm::available_disk_gb(std::path::Path::new(&home));
    }

    #[cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]
    {
        let disks = Disks::new_with_refreshed_list();

        // Get the path where Ollama stores models
        #[cfg(target_os = "macos")]
        let models_path = std::env::var("HOME").unwrap_or_else(|_| "/Users".to_string());

        #[cfg(target_os = "windows")]
        let models_path = std::env::var("USERPROFILE").unwrap_or_else(|_| "C:\\Users".to_string());

        #[cfg(target_os = "linux")]
        let models_path = std::env::var("HOME").unwrap_or_else(|_| "/home".to_string());

        for disk in disks.list() {
            let mount_point = disk.mount_point().to_string_lossy();
            if models_path.starts_with(mount_point.as_ref()) || mount_point == "/" {
                let available_gb = disk.available_space() as f64 / (1024.0 * 1024.0 * 1024.0);
                return Ok(available_gb);
            }
        }

        // Fallback: return the first disk's available space
        if let Some(disk) = disks.list().first() {
            let available_gb = disk.available_space() as f64 / (1024.0 * 1024.0 * 1024.0);
            return Ok(available_gb);
        }

        Err("Could not determine available disk space".to_string())
    }
}

/// Total memory the host can bring to bear on running a model, in bytes.
/// `vram_total` is the largest single GPU's memory (0 when no discrete GPU is
/// detected — e.g. integrated graphics or Apple unified memory, where system
/// RAM is the right figure to size a model against).
#[derive(Clone, Serialize)]
pub struct SystemMemory {
    pub ram_total: u64,
    pub vram_total: u64,
}

/// Best-effort total VRAM of the largest GPU, in bytes. Queries `nvidia-smi`
/// (present on NVIDIA Linux/Windows installs); returns 0 when it's unavailable
/// or reports nothing, so callers fall back to system RAM.
#[cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]
fn get_vram_total() -> u64 {
    let output = create_command("nvidia-smi")
        .args(["--query-gpu=memory.total", "--format=csv,noheader,nounits"])
        .output();

    let output = match output {
        Ok(output) if output.status.success() => output,
        _ => return 0,
    };

    // Each line is one GPU's total memory in MiB. Use the largest single GPU,
    // since a model runs on one device rather than the summed pool.
    String::from_utf8_lossy(&output.stdout)
        .lines()
        .filter_map(|line| line.trim().parse::<u64>().ok())
        .max()
        .map(|mib| mib * 1024 * 1024)
        .unwrap_or(0)
}

#[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
fn get_vram_total() -> u64 {
    0
}

/// Read total system RAM (and best-effort VRAM) in bytes. Used to warn the user
/// before downloading a model that is large relative to what the machine can run.
pub fn get_system_memory() -> SystemMemory {
    #[cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]
    {
        let mut sys = System::new();
        sys.refresh_memory();
        let ram = sys.total_memory();
        let vram = get_vram_total();
        println!("RAM: {ram}, VRAM: {vram}",);
        SystemMemory {
            ram_total: ram,
            vram_total: vram,
        }
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        SystemMemory {
            // iOS: real physical RAM so the "model too big for this device"
            // warnings work; 0 elsewhere (unknown).
            #[cfg(any(target_os = "ios", target_os = "android"))]
            ram_total: crate::local_llm::physical_ram_bytes(),
            #[cfg(not(any(target_os = "ios", target_os = "android")))]
            ram_total: 0,
            vram_total: get_vram_total(),
        }
    }
}

/// Check if a specific model is installed in Ollama
pub async fn is_model_installed(model_name: &str) -> bool {
    let client = Client::new();
    let response = client
        .get(format!("{}/api/tags", api_base_url()))
        .timeout(std::time::Duration::from_secs(5))
        .send()
        .await;

    match response {
        Ok(resp) => {
            if let Ok(tags) = resp.json::<OllamaTagsResponse>().await {
                if let Some(models) = tags.models {
                    return models.iter().any(|m| {
                        m.name
                            .as_ref()
                            .map(|n| n.starts_with(model_name) || n == model_name)
                            .unwrap_or(false)
                    });
                }
            }
            false
        }
        Err(_) => false,
    }
}

/// Fetch the installed model tags from Ollama (e.g. "llama3.2:latest").
/// Returns `None` when Ollama is UNREACHABLE — so callers can distinguish "no
/// models installed" from "couldn't ask" (the latter must not be shown as
/// not-downloaded) — and `Some(tags)` when reachable (possibly an empty list).
pub async fn list_installed_models() -> Option<Vec<String>> {
    let client = Client::new();
    let response = match client
        .get(format!("{}/api/tags", api_base_url()))
        .timeout(std::time::Duration::from_secs(5))
        .send()
        .await
    {
        Ok(r) => r,
        Err(e) => {
            println!("[Ollama] /api/tags request failed: {}", e);
            return None;
        }
    };

    match response.json::<OllamaTagsResponse>().await {
        Ok(tags) => {
            let names: Vec<String> = tags
                .models
                .unwrap_or_default()
                .into_iter()
                .filter_map(|m| m.name)
                .collect();
            println!(
                "[Ollama] /api/tags ok: {} model(s) {:?}",
                names.len(),
                names
            );
            Some(names)
        }
        Err(e) => {
            println!("[Ollama] /api/tags parse failed: {}", e);
            None
        }
    }
}

/// Pull a model from Ollama with streaming progress updates
pub async fn pull_model<F, G>(model_name: &str, on_progress: F, on_log: G) -> Result<(), String>
where
    F: Fn(DownloadProgress) + Send + 'static,
    G: Fn(InstallationLog) + Send + 'static,
{
    let client = Client::new();

    // Clear any cancellation request left over from a previous download.
    DOWNLOAD_CANCELLED.store(false, Ordering::SeqCst);

    #[cfg(target_os = "windows")]
    on_log(InstallationLog {
        timestamp: get_timestamp(),
        level: "info".to_string(),
        message: "Starting model download...".to_string(),
    });

    #[cfg(not(target_os = "windows"))]
    on_log(InstallationLog {
        timestamp: get_timestamp(),
        level: "info".to_string(),
        message: format!("Starting download of {}", model_name),
    });

    on_progress(DownloadProgress {
        status: "downloading".to_string(),
        completed: 0,
        total: 0,
        percentage: 0.0,
        digest: None,
        message: "Connecting to Ollama...".to_string(),
    });

    let response = client
        .post(format!("{}/api/pull", api_base_url()))
        .json(&serde_json::json!({ "name": model_name, "stream": true }))
        .send()
        .await
        .map_err(|e| format!("Failed to connect to Ollama: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Ollama returned error: {}", response.status()));
    }

    let mut stream = response.bytes_stream();
    let mut last_percentage: f64 = 0.0;
    // Track per-layer (digest) byte counts so the reported percentage reflects the
    // WHOLE pull, not just the current layer. Ollama downloads layers sequentially
    // and only reveals a layer's `total` once it starts, but summing across every
    // layer seen so far keeps the bar smooth instead of snapping back to 0% each
    // time a new layer begins.
    let mut layers: std::collections::HashMap<String, (u64, u64)> =
        std::collections::HashMap::new();

    while let Some(chunk) = stream.next().await {
        // The user requested cancellation — stop cleanly (not as an error).
        if DOWNLOAD_CANCELLED.load(Ordering::SeqCst) {
            on_progress(DownloadProgress {
                status: "cancelled".to_string(),
                completed: 0,
                total: 0,
                percentage: 0.0,
                digest: None,
                message: "Download cancelled".to_string(),
            });
            on_log(InstallationLog {
                timestamp: get_timestamp(),
                level: "info".to_string(),
                message: "Download cancelled".to_string(),
            });
            return Ok(());
        }

        let chunk = match chunk {
            Ok(c) => c,
            Err(e) => {
                // Cancelling restarts/kills Ollama, which breaks the stream — treat
                // that as a clean cancellation rather than a download error.
                if DOWNLOAD_CANCELLED.load(Ordering::SeqCst) {
                    on_progress(DownloadProgress {
                        status: "cancelled".to_string(),
                        completed: 0,
                        total: 0,
                        percentage: 0.0,
                        digest: None,
                        message: "Download cancelled".to_string(),
                    });
                    return Ok(());
                }
                return Err(format!("Stream error: {}", e));
            }
        };
        let text = String::from_utf8_lossy(&chunk);

        // Ollama streams newline-delimited JSON
        for line in text.lines() {
            if line.is_empty() {
                continue;
            }

            if let Ok(resp) = serde_json::from_str::<OllamaPullResponse>(line) {
                // Check for errors
                if let Some(error) = resp.error {
                    on_log(InstallationLog {
                        timestamp: get_timestamp(),
                        level: "error".to_string(),
                        message: error.clone(),
                    });
                    return Err(error);
                }

                let status_text = resp.status.clone().unwrap_or_default();

                // Accumulate per-layer byte counts keyed by digest, then report the
                // cumulative totals across every layer seen so far (keeps the bar
                // smooth/monotonic instead of resetting at each new layer).
                if let Some(digest) = resp.digest.clone() {
                    let entry = layers.entry(digest).or_insert((0, 0));
                    if let Some(t) = resp.total {
                        entry.1 = t;
                    }
                    if let Some(c) = resp.completed {
                        entry.0 = c;
                    }
                }
                let completed: u64 = layers.values().map(|(c, _)| *c).sum();
                let total: u64 = layers.values().map(|(_, t)| *t).sum();
                let percentage = if total > 0 {
                    (completed as f64 / total as f64) * 100.0
                } else {
                    0.0
                };

                // Determine the status type
                let progress_status = if status_text.contains("pulling") {
                    "downloading"
                } else if status_text.contains("verifying") {
                    "verifying"
                } else if status_text == "success" {
                    "completed"
                } else {
                    "downloading"
                };

                // On Windows, simplify the progress message shown in UI
                #[cfg(target_os = "windows")]
                let progress_message = if progress_status == "completed" {
                    "Download completed".to_string()
                } else if progress_status == "verifying" {
                    "Verifying model...".to_string()
                } else {
                    "Downloading model...".to_string()
                };

                #[cfg(not(target_os = "windows"))]
                let progress_message = status_text.clone();

                // Emit progress update
                on_progress(DownloadProgress {
                    status: progress_status.to_string(),
                    completed,
                    total,
                    percentage,
                    digest: resp.digest.clone(),
                    message: progress_message,
                });

                // Log significant progress updates (every 10% or status changes)
                if !status_text.is_empty()
                    && (percentage - last_percentage >= 10.0
                        || progress_status == "completed"
                        || progress_status == "verifying")
                {
                    // On Windows, show simplified messages without detailed progress
                    #[cfg(target_os = "windows")]
                    let log_message = if progress_status == "completed" {
                        "Model download completed".to_string()
                    } else if progress_status == "verifying" {
                        "Verifying model...".to_string()
                    } else {
                        "Downloading model...".to_string()
                    };

                    #[cfg(not(target_os = "windows"))]
                    let log_message = if total > 0 {
                        format!(
                            "{} - {:.1}% ({:.1} MB / {:.1} MB)",
                            status_text,
                            percentage,
                            completed as f64 / (1024.0 * 1024.0),
                            total as f64 / (1024.0 * 1024.0)
                        )
                    } else {
                        status_text.clone()
                    };

                    on_log(InstallationLog {
                        timestamp: get_timestamp(),
                        level: "info".to_string(),
                        message: log_message,
                    });
                    last_percentage = percentage;
                }
            }
        }
    }

    #[cfg(target_os = "windows")]
    on_log(InstallationLog {
        timestamp: get_timestamp(),
        level: "info".to_string(),
        message: "Model download completed successfully".to_string(),
    });

    #[cfg(not(target_os = "windows"))]
    on_log(InstallationLog {
        timestamp: get_timestamp(),
        level: "info".to_string(),
        message: format!("{} download completed successfully", model_name),
    });

    on_progress(DownloadProgress {
        status: "completed".to_string(),
        completed: 0,
        total: 0,
        percentage: 100.0,
        digest: None,
        message: "Download completed".to_string(),
    });

    Ok(())
}

/// Cancel an ongoing model download. Sets a cancellation flag so `pull_model`
/// stops cleanly, then aborts the in-flight server-side pull — always leaving
/// the Ollama server running afterwards (cancelling a download must not take the
/// model manager down).
pub fn cancel_download() -> Result<(), String> {
    // Setting the flag is instant and is what actually cancels the download:
    // pull_model polls it every chunk and stops cleanly. Do this synchronously,
    // then return right away.
    DOWNLOAD_CANCELLED.store(true, Ordering::SeqCst);

    // Break the in-flight server-side pull in the BACKGROUND. Restarting/killing
    // Ollama blocks — `systemctl restart ollama` waits for the full service
    // restart (several seconds mid-pull), and pkill + start_ollama_server block
    // too. Running it inline stalled the async command's runtime worker while the
    // frontend awaited the invoke, freezing the app on cancel. This is only a
    // best-effort measure to break the stream faster; the flag above already
    // stops the download, so it must never block the command.
    std::thread::spawn(|| {
        #[cfg(target_os = "linux")]
        {
            // Restarting the systemd service via sudo cleanly aborts the pull AND
            // leaves Ollama running. If sudo isn't available/permitted, kill the
            // process and start it back up so the manager stays available.
            let restarted = can_sudo()
                && create_command("sudo")
                    .args(["systemctl", "restart", "ollama"])
                    .status()
                    .map(|s| s.success())
                    .unwrap_or(false);
            if !restarted {
                create_command("pkill")
                    .args(["-TERM", "-f", "ollama"])
                    .output()
                    .ok();
                let _ = start_ollama_server();
            }
        }

        #[cfg(target_os = "macos")]
        {
            create_command("pkill")
                .args(["-TERM", "-f", "ollama"])
                .output()
                .ok();
            // Bring Ollama back up so the manager stays available after cancel.
            let _ = start_ollama_server();
        }

        #[cfg(target_os = "windows")]
        {
            create_command("taskkill")
                .args(["/F", "/IM", "ollama.exe"])
                .output()
                .ok();
            let _ = start_ollama_server();
        }
    });

    Ok(())
}

#[cfg(all(
    test,
    any(target_os = "windows", target_os = "macos", target_os = "linux")
))]
mod tests {
    #[test]
    fn mobile_disk_budget_is_model_size_plus_headroom() {
        // The phone download fix: a 0.8 GB model must budget ~1.75 GB, not
        // the desktop's blanket 5 GB; unknown/desktop stays at the blanket.
        let gb = required_space_gb(Some("llama3.2"), true);
        assert!(gb > 1.7 && gb < 1.8, "got {gb}");
        assert_eq!(
            required_space_gb(Some("no-such-model"), true),
            REQUIRED_FREE_SPACE_GB
        );
        assert_eq!(
            required_space_gb(Some("llama3.2"), false),
            REQUIRED_FREE_SPACE_GB
        );
        assert_eq!(required_space_gb(None, true), REQUIRED_FREE_SPACE_GB);
    }

    use super::*;
    use crate::mcp_bridge_manager::{bridge_state_lock, set_bridge_port_for_test};

    /// Chat streams from whatever port the bridge actually took — the number is
    /// read from the running bridge, never assumed to be 8000.
    #[test]
    fn the_chat_url_follows_the_port_the_bridge_took() {
        let _guard = bridge_state_lock();
        set_bridge_port_for_test(Some(8137));
        assert_eq!(
            chat_base_url(true).unwrap(),
            "http://localhost:8137",
            "a fallback port must reach the chat URL"
        );
        set_bridge_port_for_test(None);
    }

    /// No bridge of ours running is an ERROR. Guessing 8000 here is what used
    /// to send chat at an unrelated server that happened to hold the port.
    #[test]
    fn no_running_bridge_is_an_error_not_a_guessed_url() {
        let _guard = bridge_state_lock();
        set_bridge_port_for_test(None);
        let err = chat_base_url(true).expect_err("a missing bridge must not yield a URL");
        assert!(err.contains("turn Local Models off and on"), "{err}");
        assert!(
            !err.contains("MCP"),
            "the toast is read by people who never coded: {err}"
        );
    }

    use serde_json::json;
    use std::sync::atomic::AtomicUsize;

    /// A stand-in bridge. Each request gets the next status in `statuses`
    /// (the last one repeats) and an empty JSON body.
    async fn fake_bridge_answering(statuses: &'static [u16]) -> u16 {
        use tokio::io::{AsyncReadExt, AsyncWriteExt};
        let listener = tokio::net::TcpListener::bind(("127.0.0.1", 0))
            .await
            .unwrap();
        let port = listener.local_addr().unwrap().port();
        tokio::spawn(async move {
            let mut served = 0;
            while let Ok((mut conn, _)) = listener.accept().await {
                let status = statuses[served.min(statuses.len() - 1)];
                served += 1;
                let mut request = [0u8; 4096];
                let _ = conn.read(&mut request).await;
                let reply = format!(
                    "HTTP/1.1 {status} Fake\r\ncontent-length: 2\r\nconnection: close\r\n\r\n{{}}"
                );
                let _ = conn.write_all(reply.as_bytes()).await;
            }
        });
        port
    }

    async fn fake_bridge() -> u16 {
        fake_bridge_answering(&[200]).await
    }

    fn closed_port() -> u16 {
        std::net::TcpListener::bind(("127.0.0.1", 0))
            .unwrap()
            .local_addr()
            .unwrap()
            .port()
    }

    fn client() -> Client {
        Client::builder().no_proxy().build().unwrap()
    }

    fn chat_body() -> Value {
        json!({ "model": "m", "messages": [], "stream": false })
    }

    async fn never_started() {
        panic!("nothing here may start Ollama or the bridge")
    }

    async fn ollama_never_checked() -> bool {
        panic!("only a 503 from the bridge may lead to an Ollama check")
    }

    /// The reported bug: after a relaunch no bridge port is recorded. A chat
    /// that beats the launch warm-up must start the bridge itself instead of
    /// failing until Local Models is toggled.
    #[tokio::test]
    async fn a_chat_after_a_relaunch_starts_the_bridge_instead_of_failing() {
        let _guard = bridge_state_lock();
        set_bridge_port_for_test(None);
        let port = fake_bridge().await;
        let starts = AtomicUsize::new(0);

        let sent = post_local_chat_with(
            &client(),
            &chat_body(),
            true,
            || async {
                starts.fetch_add(1, Ordering::SeqCst);
                set_bridge_port_for_test(Some(port));
            },
            ollama_never_checked,
        )
        .await;

        assert!(sent.unwrap().status().is_success());
        assert_eq!(starts.load(Ordering::SeqCst), 1);
        set_bridge_port_for_test(None);
    }

    /// The common case costs nothing extra: a recorded bridge is sent to
    /// straight away, with no start and no health check first.
    #[tokio::test]
    async fn a_running_bridge_is_sent_to_without_starting_or_checking_anything() {
        let _guard = bridge_state_lock();
        let port = fake_bridge().await;
        set_bridge_port_for_test(Some(port));

        let sent = post_local_chat_with(
            &client(),
            &chat_body(),
            true,
            never_started,
            ollama_never_checked,
        )
        .await;

        assert!(sent.unwrap().status().is_success());
        set_bridge_port_for_test(None);
    }

    /// A bridge that died after we recorded it shows up as a refused
    /// connection: it is restarted once and the same chat resent.
    #[tokio::test]
    async fn a_bridge_that_died_is_restarted_once_and_the_chat_resent() {
        let _guard = bridge_state_lock();
        let port = fake_bridge().await;
        set_bridge_port_for_test(Some(closed_port()));
        let starts = AtomicUsize::new(0);

        let sent = post_local_chat_with(
            &client(),
            &chat_body(),
            true,
            || async {
                starts.fetch_add(1, Ordering::SeqCst);
                set_bridge_port_for_test(Some(port));
            },
            ollama_never_checked,
        )
        .await;

        assert!(sent.unwrap().status().is_success());
        assert_eq!(starts.load(Ordering::SeqCst), 1);
        set_bridge_port_for_test(None);
    }

    /// Ollama quit from its menu bar (or restarting for an update) while the
    /// bridge stays up: the bridge answers 503, so Ollama is started and the
    /// same chat resent once.
    #[tokio::test]
    async fn a_chat_after_ollama_was_quit_starts_it_and_resends_once() {
        let _guard = bridge_state_lock();
        let port = fake_bridge_answering(&[503, 200]).await;
        set_bridge_port_for_test(Some(port));
        let starts = AtomicUsize::new(0);

        let sent = post_local_chat_with(
            &client(),
            &chat_body(),
            true,
            || async {
                starts.fetch_add(1, Ordering::SeqCst);
            },
            || async { false },
        )
        .await;

        assert!(sent.unwrap().status().is_success());
        assert_eq!(starts.load(Ordering::SeqCst), 1);
        set_bridge_port_for_test(None);
    }

    /// A 503 while Ollama is up is the bridge's own error: no start, no
    /// resend, and the caller shows it exactly as before.
    #[tokio::test]
    async fn a_503_with_ollama_running_is_returned_unchanged() {
        let _guard = bridge_state_lock();
        let port = fake_bridge_answering(&[503, 200]).await;
        set_bridge_port_for_test(Some(port));

        let sent = post_local_chat_with(&client(), &chat_body(), true, never_started, || async {
            true
        })
        .await;

        assert_eq!(
            sent.unwrap().status(),
            reqwest::StatusCode::SERVICE_UNAVAILABLE
        );
        set_bridge_port_for_test(None);
    }

    /// Ollama that can't be started (uninstalled, say) gets one resend, then
    /// the same 503 the user saw before — never a loop.
    #[tokio::test]
    async fn an_ollama_that_cannot_start_gets_one_resend_then_the_same_error() {
        let _guard = bridge_state_lock();
        let port = fake_bridge_answering(&[503]).await;
        set_bridge_port_for_test(Some(port));
        let starts = AtomicUsize::new(0);

        let sent = post_local_chat_with(
            &client(),
            &chat_body(),
            true,
            || async {
                starts.fetch_add(1, Ordering::SeqCst);
            },
            || async { false },
        )
        .await;

        assert_eq!(
            sent.unwrap().status(),
            reqwest::StatusCode::SERVICE_UNAVAILABLE
        );
        assert_eq!(starts.load(Ordering::SeqCst), 1);
        set_bridge_port_for_test(None);
    }

    #[tokio::test]
    async fn a_model_without_tool_support_never_starts_the_bridge() {
        let _guard = bridge_state_lock();
        set_bridge_port_for_test(None);

        let err = post_local_chat_with(
            &client(),
            &chat_body(),
            false,
            never_started,
            ollama_never_checked,
        )
        .await
        .expect_err("non-tool models are refused");

        assert!(err.contains("tool_support=false"), "{err}");
    }

    /// Not installed, or never came up in time: the chat still fails, with the
    /// toggle as the way out (turning Local Models on reinstalls the bridge).
    #[tokio::test]
    async fn a_bridge_that_cannot_start_still_fails_with_the_way_out() {
        let _guard = bridge_state_lock();
        set_bridge_port_for_test(None);

        let err = post_local_chat_with(
            &client(),
            &chat_body(),
            true,
            || async {},
            ollama_never_checked,
        )
        .await
        .expect_err("no bridge came up");

        assert!(err.contains("turn Local Models off and on"), "{err}");
    }

    /// Accepts connections and never answers, like an Ollama stuck after the
    /// computer wakes.
    async fn silent_server() -> u16 {
        let listener = tokio::net::TcpListener::bind(("127.0.0.1", 0))
            .await
            .unwrap();
        let port = listener.local_addr().unwrap().port();
        tokio::spawn(async move {
            let mut held = Vec::new();
            while let Ok((conn, _)) = listener.accept().await {
                held.push(conn);
            }
        });
        port
    }

    #[tokio::test]
    async fn an_ollama_that_never_answers_reads_as_not_running_in_bounded_time() {
        let port = silent_server().await;
        let checked = std::time::Instant::now();

        let up = ollama_answers(
            &format!("http://127.0.0.1:{port}"),
            std::time::Duration::from_millis(300),
        )
        .await;

        assert!(!up);
        assert!(
            checked.elapsed() < std::time::Duration::from_secs(3),
            "the check must give up, not hang"
        );
    }

    #[tokio::test]
    async fn an_answering_ollama_still_reads_as_running() {
        use tokio::io::{AsyncReadExt, AsyncWriteExt};
        let listener = tokio::net::TcpListener::bind(("127.0.0.1", 0))
            .await
            .unwrap();
        let port = listener.local_addr().unwrap().port();
        tokio::spawn(async move {
            let body = r#"{"version":"0.12.0"}"#;
            while let Ok((mut conn, _)) = listener.accept().await {
                let mut request = [0u8; 4096];
                let _ = conn.read(&mut request).await;
                let reply = format!(
                    "HTTP/1.1 200 OK\r\ncontent-type: application/json\r\ncontent-length: {}\r\nconnection: close\r\n\r\n{body}",
                    body.len()
                );
                let _ = conn.write_all(reply.as_bytes()).await;
            }
        });

        assert!(ollama_answers(&format!("http://127.0.0.1:{port}"), OLLAMA_CHECK_TIMEOUT).await);
    }

    /// The launch half of odm-09: with Ollama installed, the warm-up brings
    /// local chat up before anyone sends a message.
    #[tokio::test]
    async fn the_launch_warm_up_starts_local_chat_when_ollama_is_installed() {
        let starts = AtomicUsize::new(0);
        warm_up_local_chat_with(
            || true,
            || async {
                starts.fetch_add(1, Ordering::SeqCst);
            },
        )
        .await;
        assert_eq!(starts.load(Ordering::SeqCst), 1);
    }

    /// Without Ollama there is nothing to warm up, and starting the bridge
    /// would only fail in front of nothing.
    #[tokio::test]
    async fn the_launch_warm_up_starts_nothing_without_ollama() {
        warm_up_local_chat_with(|| false, never_started).await;
    }

    #[tokio::test]
    async fn local_chat_brings_ollama_up_before_the_bridge() {
        let order = std::sync::Mutex::new(Vec::new());
        start_local_chat_runtime_with(
            || async { false },
            || async { order.lock().unwrap().push("ollama") },
            || async { order.lock().unwrap().push("bridge") },
        )
        .await;
        assert_eq!(*order.lock().unwrap(), ["ollama", "bridge"]);
    }

    #[tokio::test]
    async fn a_running_ollama_is_not_started_again_but_the_bridge_is() {
        let bridge_starts = AtomicUsize::new(0);
        start_local_chat_runtime_with(
            || async { true },
            never_started,
            || async {
                bridge_starts.fetch_add(1, Ordering::SeqCst);
            },
        )
        .await;
        assert_eq!(bridge_starts.load(Ordering::SeqCst), 1);
    }

    /// The launch warm-up and a chat that beats it overlap; the later one
    /// must wait for the start in flight instead of racing it.
    #[tokio::test]
    async fn overlapping_starts_run_one_at_a_time() {
        let running = AtomicUsize::new(0);
        let overlapped = AtomicBool::new(false);
        let start = || async {
            if running.fetch_add(1, Ordering::SeqCst) > 0 {
                overlapped.store(true, Ordering::SeqCst);
            }
            tokio::time::sleep(std::time::Duration::from_millis(50)).await;
            running.fetch_sub(1, Ordering::SeqCst);
        };
        tokio::join!(
            start_local_chat_runtime_with(|| async { true }, never_started, start),
            start_local_chat_runtime_with(|| async { true }, never_started, start),
        );
        assert!(!overlapped.load(Ordering::SeqCst));
    }

    /// The pre-existing rule: a model without tool support can't use the
    /// bridge at all, and that refusal comes before any port lookup.
    #[test]
    fn a_model_without_tool_support_is_refused_whatever_the_port() {
        let _guard = bridge_state_lock();
        set_bridge_port_for_test(Some(8000));
        let err = chat_base_url(false).expect_err("non-tool models are refused");
        assert!(err.contains("tool_support=false"), "{err}");
        set_bridge_port_for_test(None);
    }
}
