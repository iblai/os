use futures_util::StreamExt;
use reqwest::Client;
use serde::{Deserialize, Serialize};
#[cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]
use std::path::Path;
#[cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]
use std::process::Command;
#[cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]
use sysinfo::Disks;

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
        create_command("ollama")
            .arg("serve")
            .spawn()
            .map_err(|e| format!("Failed to start Ollama: {}", e))?;
    }

    // Mobile platforms don't support Ollama
    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        return Err("Ollama is not supported on this platform".to_string());
    }

    #[cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]
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

/// Pull a model from Ollama with streaming progress updates
pub async fn pull_model<F, G>(model_name: &str, on_progress: F, on_log: G) -> Result<(), String>
where
    F: Fn(DownloadProgress) + Send + 'static,
    G: Fn(InstallationLog) + Send + 'static,
{
    let client = Client::new();

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

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("Stream error: {}", e))?;
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
                let total = resp.total.unwrap_or(0);
                let completed = resp.completed.unwrap_or(0);
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

/// Cancel an ongoing model download by killing Ollama processes
pub fn cancel_download() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        create_command("taskkill")
            .args(["/F", "/IM", "ollama.exe"])
            .output()
            .ok();
    }

    #[cfg(any(target_os = "macos", target_os = "linux"))]
    {
        // Send SIGTERM to gracefully stop the download
        create_command("pkill")
            .args(["-TERM", "-f", "ollama"])
            .output()
            .ok();
    }

    Ok(())
}
