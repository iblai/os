use serde::{Deserialize, Serialize};
use std::process::Command;

// Foundry Local default endpoint
const FOUNDRY_LOCAL_ENDPOINT: &str = "http://localhost:5272";

/// Create a Command with hidden console window on Windows
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FoundryStatus {
    pub is_windows: bool,
    pub is_supported: bool,
    pub is_available: bool,
    pub has_models: bool,
    pub models: Vec<FoundryModel>,
    pub endpoint: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FoundryModel {
    /// Unique ID for UI selection (e.g., "phi-3-mini-128k_npu")
    pub id: String,
    /// Base model name for display (e.g., "phi-3-mini-128k")
    pub name: String,
    /// Full Foundry model identifier for loading (e.g., "phi-3-mini-128k-instruct-qnn-npu:2")
    /// This is extracted from the last column of `foundry model list` output
    pub foundry_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub device: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub size: Option<String>,
    /// Whether this model is downloaded (true) or available for download (false)
    pub is_downloaded: bool,
}

/// Check if the current OS is Windows
pub fn is_windows() -> bool {
    cfg!(target_os = "windows")
}

/// Check if the current OS supports Foundry Local (Windows or macOS)
pub fn is_foundry_supported_os() -> bool {
    cfg!(any(target_os = "windows", target_os = "macos"))
}

/// Check if Foundry CLI is installed by running `foundry --version`
pub fn check_foundry_installed() -> bool {
    println!("[FoundryManager] Checking if Foundry CLI is installed...");

    match create_command("foundry").arg("--version").output() {
        Ok(output) => {
            let installed = output.status.success();
            if installed {
                let version = String::from_utf8_lossy(&output.stdout);
                println!("[FoundryManager] Foundry CLI installed: {}", version.trim());
            } else {
                println!("[FoundryManager] Foundry CLI not found or returned error");
            }
            installed
        }
        Err(e) => {
            println!("[FoundryManager] Failed to execute foundry command: {}", e);
            false
        }
    }
}

/// List available models using `foundry model list`
fn list_foundry_models() -> Result<Vec<FoundryModel>, String> {
    println!("[FoundryManager] ===== LISTING FOUNDRY MODELS =====");

    // Get the list of downloaded models ONCE for efficiency
    let downloaded_models = get_downloaded_models();
    println!("[FoundryManager] Found {} downloaded models", downloaded_models.len());
    for model_id in &downloaded_models {
        println!("[FoundryManager]   Downloaded: {}", model_id);
    }

    // Try with --json flag first
    println!("[FoundryManager] Attempting: foundry model list --json");
    let output = create_command("foundry")
        .args(&["model", "list", "--json"])
        .output()
        .map_err(|e| format!("Failed to execute foundry model list: {}", e))?;

    println!("[FoundryManager] Command exit status: {}", output.status);

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        println!("[FoundryManager] ❌ Command failed with stderr:\n{}", stderr);

        // If --json flag failed, try without it
        println!("[FoundryManager] Retrying without --json flag...");
        let output_plain = create_command("foundry")
            .args(&["model", "list"])
            .output()
            .map_err(|e| format!("Failed to execute foundry model list: {}", e))?;

        if !output_plain.status.success() {
            let stderr_plain = String::from_utf8_lossy(&output_plain.stderr);
            println!("[FoundryManager] ❌ Plain command also failed: {}", stderr_plain);
            return Err(format!("Failed to list models: {}", stderr_plain));
        }

        let stdout_plain = String::from_utf8_lossy(&output_plain.stdout);
        return parse_plain_text_models(&stdout_plain, &downloaded_models);
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    println!("[FoundryManager] ✓ Raw stdout length: {} bytes", stdout.len());
    println!("[FoundryManager] ✓ Raw stdout preview (first 500 chars):\n{}",
        if stdout.len() > 500 { &stdout[..500] } else { &stdout });
    println!("[FoundryManager] ✓ Full raw stdout:\n{}", stdout);

    // Try to parse as JSON first
    println!("[FoundryManager] Attempting JSON parse...");
    match serde_json::from_str::<Vec<serde_json::Value>>(&stdout) {
        Ok(json_models) => {
            println!("[FoundryManager] ✓ Successfully parsed as JSON array with {} items", json_models.len());
            let models: Vec<FoundryModel> = json_models
                .iter()
                .enumerate()
                .filter_map(|(idx, model)| {
                    println!("[FoundryManager] Processing JSON model {}: {:?}", idx, model);
                    let foundry_id = model.get("id")?.as_str()?.to_string();
                    let raw_name = model
                        .get("name")
                        .and_then(|n| n.as_str())
                        .unwrap_or(&foundry_id)
                        .to_string();
                    // Strip device suffix to get base model name for display
                    let name = strip_device_suffix(&raw_name);
                    let device = model
                        .get("device")
                        .and_then(|d| d.as_str())
                        .map(|s| s.to_string());
                    let size = model
                        .get("size")
                        .and_then(|s| s.as_str())
                        .map(|s| s.to_string());
                    // Create composite UI ID
                    let device_suffix = device.as_ref().map(|d| format!("_{}", d.to_lowercase())).unwrap_or_default();
                    let id = format!("{}{}", raw_name, device_suffix);
                    // Check if model is actually downloaded
                    let is_downloaded = is_model_downloaded(&foundry_id, &downloaded_models);
                    println!("[FoundryManager]   → Extracted: ui_id='{}', foundry_id='{}', display_name='{}', device='{:?}', size='{:?}', downloaded={}",
                        id, foundry_id, name, device, size, is_downloaded);
                    Some(FoundryModel { id, name, foundry_id, device, size, is_downloaded })
                })
                .collect();

            println!("[FoundryManager] ✓ Parsed {} models from JSON", models.len());
            for (idx, model) in models.iter().enumerate() {
                println!("[FoundryManager]   Model {}: id='{}', name='{}'", idx, model.id, model.name);
            }
            return Ok(models);
        }
        Err(e) => {
            println!("[FoundryManager] ❌ JSON parse failed: {}", e);
            println!("[FoundryManager] Falling back to plain text parsing...");
        }
    }

    parse_plain_text_models(&stdout, &downloaded_models)
}

/// Strip device suffix from model name to get base model name
/// Examples:
///   "phi-3-mini-128k-npu" -> "phi-3-mini-128k"
///   "deepseek-r1-distill-qwen-14b-qnn-npu" -> "deepseek-r1-distill-qwen-14b-qnn"
///   "llama-3-8b-cpu" -> "llama-3-8b"
fn strip_device_suffix(model_name: &str) -> String {
    let device_suffixes = ["-npu", "-cpu", "-gpu", "-cuda", "-rocm", "-metal", "-directml", "-vulkan"];

    for suffix in device_suffixes.iter() {
        if model_name.to_lowercase().ends_with(suffix) {
            let base_name = &model_name[..model_name.len() - suffix.len()];
            println!("[FoundryManager] Stripped device suffix: '{}' -> base: '{}', suffix: '{}'",
                model_name, base_name, suffix);
            return base_name.to_string();
        }
    }

    // No device suffix found, return as-is
    println!("[FoundryManager] No device suffix found in: '{}'", model_name);
    model_name.to_string()
}

/// Check if a model is downloaded by attempting to get its info
/// Get a HashSet of all downloaded model IDs from `foundry service list`
fn get_downloaded_models() -> std::collections::HashSet<String> {
    use std::collections::HashSet;

    let output = create_command("foundry")
        .args(&["service", "list"])
        .output();

    let mut downloaded = HashSet::new();

    if let Ok(result) = output {
        if result.status.success() {
            let stdout = String::from_utf8_lossy(&result.stdout);

            // Parse the output to find models with green circle indicators
            // Format: 🟢  phi-3.5-mini                   phi-3.5-mini-instruct-qnn-npu:1
            for line in stdout.lines() {
                if line.contains("🟢") {
                    // Split by whitespace and get the last column (foundry_id)
                    let parts: Vec<&str> = line.split_whitespace().collect();
                    if parts.len() >= 2 {
                        // Last part is the foundry_id
                        let foundry_id = parts.last().unwrap().trim();
                        downloaded.insert(foundry_id.to_string());
                    }
                }
            }
        }
    }

    downloaded
}

/// Check if a model is downloaded by checking against `foundry service list`
fn is_model_downloaded(foundry_id: &str, downloaded_models: &std::collections::HashSet<String>) -> bool {
    downloaded_models.contains(foundry_id)
}

/// Parse models from plain text output
fn parse_plain_text_models(stdout: &str, downloaded_models: &std::collections::HashSet<String>) -> Result<Vec<FoundryModel>, String> {
    println!("[FoundryManager] ===== PARSING PLAIN TEXT (TABLE FORMAT WITH DEVICE VARIANTS) =====");
    println!("[FoundryManager] Total lines in output: {}", stdout.lines().count());

    let mut line_num = 0;
    for line in stdout.lines() {
        line_num += 1;
        println!("[FoundryManager] Line {}: '{}'", line_num, line);
    }

    println!("[FoundryManager] Extracting ALL model variants (with device info)...");

    let mut models: Vec<FoundryModel> = Vec::new();
    let mut current_alias: Option<String> = None;

    for (idx, line) in stdout.lines().enumerate() {
        let trimmed = line.trim();

        // Skip empty lines
        if trimmed.is_empty() {
            println!("[FoundryManager]   Line {} SKIP: empty", idx);
            continue;
        }

        // Skip header and separator lines
        if trimmed.starts_with("Alias") || trimmed.starts_with("Model") ||
           trimmed.starts_with("NAME") || trimmed.chars().all(|c| c == '-') {
            println!("[FoundryManager]   Line {} SKIP: header/separator", idx);
            continue;
        }

        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.is_empty() {
            continue;
        }

        // Check if this is a new model alias line (left-aligned)
        if !line.starts_with(' ') && !line.starts_with('\t') {
            // This is a model alias line
            let full_alias = parts[0].to_string();
            current_alias = Some(full_alias.clone());

            // Parse this line (first device variant)
            if parts.len() >= 4 {
                let device = parts.get(1).unwrap_or(&"").to_string();
                let size = if parts.len() >= 5 {
                    format!("{} {}", parts.get(3).unwrap_or(&""), parts.get(4).unwrap_or(&""))
                } else {
                    String::new()
                };

                // Extract the foundry_id from the last column (full model identifier with version)
                // Example: "qwen2.5-7b-instruct-qnn-npu:2"
                let foundry_id = parts.last().unwrap_or(&"").to_string();

                // Strip device suffix from the alias to get the base model name for display
                let base_name = strip_device_suffix(&full_alias);

                // Create composite UI ID for unique identification
                let model_id = format!("{}_{}", full_alias, device.to_lowercase());

                // Check if model is actually downloaded
                let is_downloaded = is_model_downloaded(&foundry_id, downloaded_models);

                let model = FoundryModel {
                    id: model_id.clone(),
                    name: base_name.clone(),
                    foundry_id: foundry_id.clone(),
                    device: Some(device.clone()),
                    size: Some(size.clone()),
                    is_downloaded,
                };

                println!("[FoundryManager]   Line {} ✓ ACCEPT: ui_id='{}', display_name='{}', foundry_id='{}', device='{}', size='{}', downloaded={}",
                    idx, model_id, base_name, foundry_id, device, size, is_downloaded);
                models.push(model);
            }
        } else if current_alias.is_some() {
            // This is a device variant line (indented)
            if parts.len() >= 3 {
                let device = parts.get(0).unwrap_or(&"").to_string();
                let size = if parts.len() >= 4 {
                    format!("{} {}", parts.get(2).unwrap_or(&""), parts.get(3).unwrap_or(&""))
                } else {
                    String::new()
                };

                // Extract the foundry_id from the last column
                let foundry_id = parts.last().unwrap_or(&"").to_string();

                let full_alias = current_alias.as_ref().unwrap();
                let base_name = strip_device_suffix(full_alias);
                let model_id = format!("{}_{}", full_alias, device.to_lowercase());

                // Check if model is actually downloaded
                let is_downloaded = is_model_downloaded(&foundry_id, downloaded_models);

                let model = FoundryModel {
                    id: model_id.clone(),
                    name: base_name.clone(),
                    foundry_id: foundry_id.clone(),
                    device: Some(device.clone()),
                    size: Some(size.clone()),
                    is_downloaded,
                };

                println!("[FoundryManager]   Line {} ✓ ACCEPT VARIANT: ui_id='{}', display_name='{}', foundry_id='{}', device='{}', size='{}', downloaded={}",
                    idx, model_id, base_name, foundry_id, device, size, is_downloaded);
                models.push(model);
            }
        }
    }

    println!("[FoundryManager] ===== PARSING COMPLETE =====");
    println!("[FoundryManager] ✓ Parsed {} model variants from table format", models.len());
    for (idx, model) in models.iter().enumerate() {
        println!("[FoundryManager]   Model {}: id='{}', name='{}', device='{}', size='{}'",
            idx, model.id, model.name,
            model.device.as_ref().unwrap_or(&String::from("N/A")),
            model.size.as_ref().unwrap_or(&String::from("N/A")));
    }

    Ok(models)
}

/// Get the actual Foundry service endpoint by running `foundry service status`
fn get_foundry_service_endpoint() -> Option<String> {
    let output = create_command("foundry")
        .args(&["service", "status"])
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    let stdout = String::from_utf8_lossy(&output.stdout);

    // Parse output to find the endpoint
    // Format: "🟢 Model management service is running on http://127.0.0.1:52394/openai/status"
    for line in stdout.lines() {
        if line.contains("Model management service is running on") {
            // Extract the URL
            if let Some(start) = line.find("http://") {
                let url_part = &line[start..];
                // Remove the "/openai/status" suffix and keep just the base URL (without /openai)
                // The OpenAI-compatible API is at the base URL (e.g., http://127.0.0.1:52394/v1/...)
                if let Some(end) = url_part.find("/openai/status") {
                    let base = &url_part[..end];
                    return Some(base.to_string());
                }
            }
        }
    }

    None
}

/// Check if Foundry Local service is running by checking the actual endpoint
async fn check_foundry_service_running() -> bool {
    println!("[FoundryManager] Checking if Foundry Local service is running...");

    // Get the actual service endpoint from `foundry service status`
    let endpoint = match get_foundry_service_endpoint() {
        Some(ep) => {
            println!("[FoundryManager] Found service endpoint: {}", ep);
            ep
        }
        None => {
            println!("[FoundryManager] Could not determine service endpoint from `foundry service status`");
            return false;
        }
    };

    // Try to connect to the Foundry Local endpoint
    let client = reqwest::Client::new();
    match client
        .get(format!("{}/v1/models", endpoint))
        .timeout(std::time::Duration::from_secs(2))
        .send()
        .await
    {
        Ok(response) => {
            let running = response.status().is_success();
            println!("[FoundryManager] Service running: {}", running);
            running
        }
        Err(e) => {
            println!("[FoundryManager] Service not running or unreachable: {}", e);
            false
        }
    }
}

/// Check if Foundry Local is supported and available on this device
pub async fn check_foundry_status() -> Result<FoundryStatus, String> {
    println!("[FoundryManager] Checking Foundry Local status...");

    // First check: Is this a supported OS (Windows or macOS)?
    let is_windows = is_windows();
    let is_supported = is_foundry_supported_os();

    if !is_supported {
        println!("[FoundryManager] OS not supported, Foundry Local only works on Windows and macOS");
        return Ok(FoundryStatus {
            is_windows,
            is_supported: false,
            is_available: false,
            has_models: false,
            models: vec![],
            endpoint: None,
        });
    }

    println!("[FoundryManager] Running on supported OS, checking Foundry Local availability...");

    // Second check: Is Foundry CLI installed?
    let is_installed = check_foundry_installed();
    if !is_installed {
        println!("[FoundryManager] Foundry CLI not installed");
        return Ok(FoundryStatus {
            is_windows: true,
            is_supported: true,
            is_available: false,
            has_models: false,
            models: vec![],
            endpoint: None,
        });
    }

    // Third check: Is the service running and get its endpoint
    let service_endpoint = get_foundry_service_endpoint();
    let is_running = check_foundry_service_running().await;

    if !is_running {
        println!("[FoundryManager] Foundry Local service is not running");
        // Still check for models even if service isn't running
        // User might have models but service needs to be started
        let models = list_foundry_models().unwrap_or_else(|e| {
            println!("[FoundryManager] Could not list models: {}", e);
            vec![]
        });

        return Ok(FoundryStatus {
            is_windows: true,
            is_supported: true,
            is_available: false,
            has_models: !models.is_empty(),
            models,
            endpoint: service_endpoint.or_else(|| Some(FOUNDRY_LOCAL_ENDPOINT.to_string())),
        });
    }

    // Fourth check: Get list of available models
    let models = list_foundry_models().unwrap_or_else(|e| {
        println!("[FoundryManager] Failed to list models: {}", e);
        vec![]
    });

    let has_models = !models.is_empty();
    println!("[FoundryManager] Has models: {}", has_models);

    Ok(FoundryStatus {
        is_windows: true,
        is_supported: true,
        is_available: true,
        has_models,
        models,
        endpoint: service_endpoint.or_else(|| Some(FOUNDRY_LOCAL_ENDPOINT.to_string())),
    })
}

/// Start Foundry Local service
pub fn start_foundry_service() -> Result<(), String> {
    println!("[FoundryManager] Starting Foundry Local service...");

    let output = create_command("foundry")
        .arg("start")
        .output()
        .map_err(|e| format!("Failed to execute foundry start: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        println!("[FoundryManager] Failed to start service: {}", stderr);
        return Err(format!("Failed to start Foundry service: {}", stderr));
    }

    println!("[FoundryManager] Foundry Local service started successfully");
    Ok(())
}

/// Load a specific model using `foundry model load <model-id>`
pub fn load_foundry_model(model_id: &str) -> Result<(), String> {
    println!("[FoundryManager] Loading model: {}", model_id);

    let output = create_command("foundry")
        .args(&["model", "load", model_id])
        .output()
        .map_err(|e| format!("Failed to execute foundry model load: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        println!("[FoundryManager] Failed to load model: {}", stderr);
        return Err(format!("Failed to load model: {}", stderr));
    }

    println!("[FoundryManager] Model loaded successfully: {}", model_id);
    Ok(())
}
