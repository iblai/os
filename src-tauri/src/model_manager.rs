use futures_util::StreamExt;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, Ordering};
#[cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]
use std::path::Path;

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
        let ollama_path = "/Applications/Ollama.app";
        return Path::new(ollama_path).exists();
    }

    #[cfg(target_os = "linux")]
    {
        let ollama_path = "/usr/bin/ollama";
        return Path::new(ollama_path).exists();
    }

    // Mobile platforms (iOS, Android) don't support Ollama
    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        false
    }
}

/// Check if Ollama server is running by pinging the API
pub async fn is_ollama_running() -> bool {
    let client = Client::new();
    client
        .get(format!("{}/api/version", OLLAMA_API_URL))
        .timeout(std::time::Duration::from_secs(2))
        .send()
        .await
        .is_ok()
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
            tokio::time::sleep(GRACE).await;
            return true;
        }
        tokio::time::sleep(std::time::Duration::from_secs(1)).await;
    }
    if is_ollama_running().await {
        tokio::time::sleep(GRACE).await;
        true
    } else {
        false
    }
}

/// Start Ollama server if not running
pub fn start_ollama_server() -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        create_command("open")
            .arg("-a")
            .arg("Ollama")
            .spawn()
            .map_err(|e| format!("Failed to start Ollama: {}", e))?;
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

    // Mobile platforms don't support Ollama
    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        return Err("Ollama is not supported on this platform".to_string());
    }

    #[cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]
    Ok(())
}

/// Stop the Ollama server (the model manager). On Linux prefer the systemd
/// service, falling back to killing the process; on macOS/Windows kill the
/// process directly.
pub fn stop_ollama_server() -> Result<(), String> {
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

    Ok(())
}

/// Check available disk space on the drive where models are stored
pub fn check_disk_space() -> Result<f64, String> {
    // Mobile platforms don't support disk space checks for Ollama
    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        return Err("Disk space check is not supported on this platform".to_string());
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
        SystemMemory {
            ram_total: sys.total_memory(),
            vram_total: get_vram_total(),
        }
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        SystemMemory {
            ram_total: 0,
            vram_total: get_vram_total(),
        }
    }
}

/// Check if a specific model is installed in Ollama
pub async fn is_model_installed(model_name: &str) -> bool {
    let client = Client::new();
    let response = client
        .get(format!("{}/api/tags", OLLAMA_API_URL))
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
        .get(format!("{}/api/tags", OLLAMA_API_URL))
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
            println!("[Ollama] /api/tags ok: {} model(s) {:?}", names.len(), names);
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
        .post(format!("{}/api/pull", OLLAMA_API_URL))
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
    let mut layers: std::collections::HashMap<String, (u64, u64)> = std::collections::HashMap::new();

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
    DOWNLOAD_CANCELLED.store(true, Ordering::SeqCst);

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

    Ok(())
}
