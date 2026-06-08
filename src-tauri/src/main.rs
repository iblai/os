// Hide console window on Windows in release builds
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod foundry_installer;
mod foundry_manager;
mod model_manager;
mod oauth;
mod offline_server;
mod ollama_installer;
mod web_cache;

use foundry_installer::{
    download_and_install_foundry, download_foundry_model, get_recommended_models,
};
use foundry_manager::{check_foundry_status, FoundryStatus};
use model_manager::{
    cancel_download, check_disk_space, check_ollama_installed, get_timestamp, is_model_installed,
    is_ollama_running, list_installed_models, pull_model, start_ollama_server, stop_ollama_server,
    wait_for_ollama_ready, DiskSpaceError, DownloadProgress, InstallationLog, OllamaStatus,
    SystemMemory, REQUIRED_FREE_SPACE_GB,
};
use offline_server::{get_server_url, start_offline_server_with_signal};
use ollama_installer::download_and_install_ollama;
use std::sync::Arc;
use tauri::{command, AppHandle, Emitter, Listener, Manager, Window};
use tokio::sync::RwLock;

use tauri::WebviewWindowBuilder;

// OAuth provider URL patterns that should be opened in a separate auth window
// Note: login.iblai.app loads in the main window - only OAuth providers need a separate window
const OAUTH_URL_PATTERNS: &[&str] = &[
    // Google OAuth
    "accounts.google.com",
    "google.com/o/oauth",
    "googleapis.com/oauth",
    "google-oauth2",
    "/auth/login/google",
    "/login/google",
    // Apple OAuth
    "appleid.apple.com",
    "/auth/login/apple",
    "/login/apple",
];

fn is_oauth_url(url: &str) -> bool {
    OAUTH_URL_PATTERNS
        .iter()
        .any(|pattern| url.contains(pattern))
}

/// Open OAuth URL in an in-app popup window
/// The window monitors for callback URLs and closes automatically when auth completes
fn open_oauth_in_popup(url: &str, app_handle: &AppHandle) -> Result<(), String> {
    println!("[ibl.ai] Opening OAuth in popup window: {}", url);

    let app_handle_clone = app_handle.clone();

    // Create a popup window for OAuth
    let _auth_window = WebviewWindowBuilder::new(
        app_handle,
        "oauth-popup",
        tauri::WebviewUrl::External(url.parse().map_err(|e| format!("Invalid URL: {}", e))?),
    )
    .title("Sign In")
    .inner_size(500.0, 700.0)
    .center()
    .focused(true)
    .on_navigation(move |nav_url| {
        let url_str = nav_url.as_str();
        println!("[OAuth Popup] Navigation to: {}", url_str);

        // Check if this is a callback URL (auth completed)
        let is_callback = url_str.contains("login.iblai.app")
            && (url_str.contains("/callback")
                || url_str.contains("code=")
                || url_str.contains("token=")
                || url_str.contains("access_token="));

        // Also check for custom scheme callbacks
        let is_custom_scheme =
            url_str.starts_with("iblai-mentor://") || url_str.starts_with("ai.ibl.mentorai://");

        if is_callback || is_custom_scheme {
            println!("[OAuth Popup] Auth callback detected: {}", url_str);

            // Navigate the main window to the callback URL
            if let Some(main_win) = app_handle_clone.get_webview_window("main") {
                let target_url = if is_custom_scheme {
                    // Convert custom scheme to app URL
                    let path = url_str
                        .replace("iblai-mentor://", "/")
                        .replace("ai.ibl.mentorai://", "/");
                    format!("{}{}", get_app_url(), path)
                } else {
                    url_str.to_string()
                };

                println!("[OAuth Popup] Navigating main window to: {}", target_url);
                let _ = main_win.eval(&format!("window.location.href = '{}';", target_url));
                let _ = main_win.set_focus();
            }

            // Close the OAuth popup
            if let Some(oauth_win) = app_handle_clone.get_webview_window("oauth-popup") {
                println!("[OAuth Popup] Closing popup window");
                let _ = oauth_win.close();
            }

            return false; // Don't navigate the popup
        }

        // Allow all other navigations in the OAuth popup
        true
    })
    .build()
    .map_err(|e| format!("Failed to create OAuth popup: {}", e))?;

    println!("[ibl.ai] ✅ OAuth popup window created");
    Ok(())
}

/// Handle deep link callback from OAuth (called when custom URL scheme is opened)
fn handle_oauth_deep_link(app_handle: &AppHandle, url: &str) {
    println!("[ibl.ai] OAuth deep link received: {}", url);

    // Convert custom scheme URL to app URL
    let target_url = if url.starts_with("iblai-mentor://") {
        let path = url.replace("iblai-mentor://", "/");
        format!("{}{}", get_app_url(), path)
    } else if url.starts_with("ai.ibl.mentorai://") {
        let path = url.replace("ai.ibl.mentorai://", "/");
        format!("{}{}", get_app_url(), path)
    } else {
        url.to_string()
    };

    println!("[ibl.ai] Navigating main window to: {}", target_url);

    // Navigate main window to the callback URL
    if let Some(main_win) = app_handle.get_webview_window("main") {
        let _ = main_win.eval(&format!("window.location.href = '{}';", target_url));
        let _ = main_win.set_focus();
        // Bring app to foreground
        let _ = main_win.show();
        let _ = main_win.unminimize();
    }
}
use base64::Engine;
use web_cache::{CacheStats, PrecacheResult, WebCache};

// Global web cache instance
static WEB_CACHE: std::sync::OnceLock<Arc<RwLock<Option<WebCache>>>> = std::sync::OnceLock::new();

// Global storage for last mentor route (persists across origins)
static LAST_MENTOR_ROUTE: std::sync::OnceLock<Arc<RwLock<Option<String>>>> =
    std::sync::OnceLock::new();

// Global storage for selected Foundry model
static SELECTED_FOUNDRY_MODEL: std::sync::OnceLock<Arc<RwLock<Option<String>>>> =
    std::sync::OnceLock::new();

// File name for persisting the last route
const LAST_ROUTE_FILE: &str = "last_mentor_route.txt";

// File name for persisting selected Foundry model
const FOUNDRY_MODEL_FILE: &str = "foundry_selected_model.txt";

// App URL - configurable via TAURI_APP_URL env variable, with sensible defaults
fn get_app_url() -> String {
    // First check environment variable
    if let Ok(url) = std::env::var("TAURI_APP_URL") {
        return url;
    }

    // Default: localhost for debug, production URL for release
    #[cfg(debug_assertions)]
    return "https://mentorai.iblai.org".to_string();

    #[cfg(not(debug_assertions))]
    return "https://mentorai.iblai.app".to_string();
}

// Fallback internet connectivity check using multiple reliable services
fn check_internet_fallback() -> bool {
    println!("[ibl.ai] Running fallback internet connectivity check...");

    let client = match reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(2))
        .connect_timeout(std::time::Duration::from_secs(1))
        .danger_accept_invalid_certs(true)
        .build()
    {
        Ok(c) => c,
        Err(e) => {
            println!("[ibl.ai] Failed to create HTTP client for fallback: {}", e);
            return false;
        }
    };

    // Try multiple reliable services
    let test_urls = [
        "https://www.google.com",
        "https://www.cloudflare.com",
        "https://1.1.1.1",
    ];

    for url in test_urls.iter() {
        println!("[ibl.ai] Trying fallback connectivity check to {}...", url);
        match client.head(*url).send() {
            Ok(response) => {
                if response.status().is_success() || response.status().is_redirection() {
                    println!("[ibl.ai] Fallback check succeeded with {}", url);
                    return true;
                }
                println!(
                    "[ibl.ai] Fallback check to {} returned status {}",
                    url,
                    response.status()
                );
            }
            Err(e) => {
                println!("[ibl.ai] Fallback check to {} failed: {}", url, e);
            }
        }
    }

    println!("[ibl.ai] All fallback checks failed - assuming OFFLINE");
    false
}

fn get_web_cache() -> &'static Arc<RwLock<Option<WebCache>>> {
    WEB_CACHE.get_or_init(|| Arc::new(RwLock::new(None)))
}

fn get_last_route_storage() -> &'static Arc<RwLock<Option<String>>> {
    LAST_MENTOR_ROUTE.get_or_init(|| Arc::new(RwLock::new(None)))
}

fn get_foundry_model_storage() -> &'static Arc<RwLock<Option<String>>> {
    SELECTED_FOUNDRY_MODEL.get_or_init(|| Arc::new(RwLock::new(None)))
}

// Event name constants
const EVENT_DOWNLOAD_PROGRESS: &str = "model:download-progress";
const EVENT_INSTALLATION_LOG: &str = "model:installation-log";
const EVENT_DISK_SPACE_ERROR: &str = "model:disk-space-error";
const EVENT_OLLAMA_STATUS: &str = "model:ollama-status";

/// Install Ollama on the system
#[command]
async fn install_ollama() -> Result<String, String> {
    // "Enable Local Models" === ensure the model manager is installed AND running.
    // Check if already installed using the same logic as model_manager.
    if check_ollama_installed() {
        // Already installed — make sure the server is actually running.
        if !is_ollama_running().await {
            start_ollama_server().map_err(|e| e.to_string())?;
            // Wait until the server actually answers its API (it returns from
            // start before it is serving) so the follow-up status check sees
            // "running" instead of racing it.
            wait_for_ollama_ready(5).await;
        }
        return Ok("Model manager is installed and running".into());
    }

    download_and_install_ollama().await?;

    // Start Ollama server using the correct path
    start_ollama_server().map_err(|e| e.to_string())?;
    wait_for_ollama_ready(5).await;

    Ok("Model manager installed and started".into())
}

/// Stop the Ollama model manager server. Backs "Enable Local Models" === run the
/// model manager: turning the toggle off stops it.
#[command]
async fn stop_ollama(app: AppHandle) -> Result<(), String> {
    stop_ollama_server()?;
    // Give the server a moment to shut down, then re-broadcast status so the UI
    // reflects that the manager is no longer running.
    tokio::time::sleep(tokio::time::Duration::from_millis(800)).await;
    let _ = check_ollama_status(app).await;
    Ok(())
}

/// Check Ollama installation and model status
/// Also checks Foundry Local first - if Foundry has models, skip Ollama checks
#[command]
async fn check_ollama_status(app: AppHandle) -> Result<OllamaStatus, String> {
    // First, check if Foundry Local is available with models
    // If yes, we don't need Ollama at all
    println!("[OllamaStatus] Checking Foundry Local first...");
    if let Ok(foundry_status) = check_foundry_status().await {
        if foundry_status.is_available && foundry_status.has_models {
            println!("[OllamaStatus] Foundry Local available with models, skipping Ollama");
            // Return a status indicating Ollama is not needed
            let status = OllamaStatus {
                installed: true,       // Pretend installed so UI doesn't prompt for installation
                running: true,         // Pretend running so UI shows ready state
                model_installed: true, // Pretend model is installed
                installed_models: Vec::new(), // Foundry path: Ollama model table is hidden
            };
            let _ = app.emit(EVENT_OLLAMA_STATUS, &status);
            return Ok(status);
        }
    }

    println!("[OllamaStatus] Foundry not available, checking Ollama...");
    // Determine availability FIRST (/api/version), then — only once it's
    // available — wait a short grace period BEFORE reaching /api/tags. Ollama
    // answers /api/version slightly before /api/tags is ready to serve, so
    // reading the model list immediately reports "stopped"/"no models" for a
    // server that is actually up.
    let running = wait_for_ollama_ready(5).await;
    let installed_models = if running {
        tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
        let mut t = list_installed_models().await;
        if t.is_none() {
            // Still warming up — wait a little more and retry rather than giving up.
            tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
            t = list_installed_models().await;
        }
        t.unwrap_or_default()
    } else {
        Vec::new()
    };
    // If Ollama answered, it is obviously installed; otherwise fall back to the
    // on-disk check (installed-but-stopped). Robust to package-manager paths.
    let installed = running || check_ollama_installed();
    let model_installed = installed_models
        .iter()
        .any(|n| n.starts_with("phi3:mini") || n == "phi3:mini");

    println!(
        "[OllamaStatus] version_reachable={} installed={} model_installed={} models={}",
        running,
        installed,
        model_installed,
        installed_models.len()
    );

    let status = OllamaStatus {
        installed,
        running,
        model_installed,
        installed_models,
    };

    // Emit status update event
    let _ = app.emit(EVENT_OLLAMA_STATUS, &status);

    Ok(status)
}

/// Check Foundry Local availability and models
#[command]
async fn check_foundry_local_status() -> Result<FoundryStatus, String> {
    check_foundry_status().await
}

/// Start Foundry Local service
#[command]
async fn start_foundry_local_service() -> Result<(), String> {
    foundry_manager::start_foundry_service()
}

/// Load a specific Foundry model
#[command]
async fn load_foundry_local_model(model_id: String) -> Result<(), String> {
    foundry_manager::load_foundry_model(&model_id)
}

/// Set the selected Foundry model for chat
#[command]
async fn set_selected_foundry_model(app: AppHandle, model_id: String) -> Result<(), String> {
    println!("[ibl.ai] Setting selected Foundry model: {}", model_id);

    // Store in memory
    let storage = get_foundry_model_storage();
    let mut model = storage.write().await;
    *model = Some(model_id.clone());

    // Persist to file
    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;

    if !app_dir.exists() {
        std::fs::create_dir_all(&app_dir)
            .map_err(|e| format!("Failed to create app data dir: {}", e))?;
    }

    let file_path = app_dir.join(FOUNDRY_MODEL_FILE);
    std::fs::write(&file_path, model_id.as_bytes())
        .map_err(|e| format!("Failed to save selected model: {}", e))?;

    println!("[ibl.ai] Selected Foundry model saved to: {:?}", file_path);
    Ok(())
}

/// Get the selected Foundry model for chat
#[command]
async fn get_selected_foundry_model(app: AppHandle) -> Result<Option<String>, String> {
    // First check memory
    let storage = get_foundry_model_storage();
    let model = storage.read().await;

    if model.is_some() {
        return Ok(model.clone());
    }

    // If not in memory, try to load from file
    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;

    let file_path = app_dir.join(FOUNDRY_MODEL_FILE);

    if file_path.exists() {
        match std::fs::read_to_string(&file_path) {
            Ok(model_id) => {
                // Store in memory for future use
                drop(model); // Release read lock
                let mut model_write = storage.write().await;
                *model_write = Some(model_id.clone());
                println!(
                    "[ibl.ai] Loaded selected Foundry model from file: {}",
                    model_id
                );
                Ok(Some(model_id))
            }
            Err(e) => {
                println!("[ibl.ai] Failed to read selected model file: {}", e);
                Ok(None)
            }
        }
    } else {
        Ok(None)
    }
}

/// Install Foundry Local on the system
#[command]
async fn install_foundry() -> Result<String, String> {
    println!("[ibl.ai] Starting Foundry Local installation...");

    // Check if already installed
    if let Ok(status) = check_foundry_status().await {
        if status.is_supported && foundry_manager::check_foundry_installed() {
            return Ok("Foundry Local already installed".to_string());
        }
    }

    // Download and install
    download_and_install_foundry().await?;

    // Start service
    foundry_manager::start_foundry_service()?;

    Ok("Foundry Local installed and started".to_string())
}

/// Download a Foundry model
#[command]
async fn download_foundry_model_cmd(model_id: String, window: Window) -> Result<(), String> {
    println!("[ibl.ai] Downloading Foundry model: {}", model_id);
    download_foundry_model(&model_id, window).await
}

/// Get list of recommended Foundry models
#[command]
fn get_recommended_foundry_models() -> Vec<String> {
    get_recommended_models()
        .iter()
        .map(|s| s.to_string())
        .collect()
}

/// Check if there's enough disk space for the model download
#[command]
async fn check_disk_space_for_model(app: AppHandle) -> Result<bool, String> {
    let available_gb = check_disk_space()?;

    if available_gb < REQUIRED_FREE_SPACE_GB {
        let error = DiskSpaceError {
            required_gb: REQUIRED_FREE_SPACE_GB,
            available_gb,
            message: format!(
                "Insufficient disk space. {:.1} GB available, {:.1} GB required.",
                available_gb, REQUIRED_FREE_SPACE_GB
            ),
        };
        let _ = app.emit(EVENT_DISK_SPACE_ERROR, &error);
        return Ok(false);
    }

    Ok(true)
}

/// Report total system RAM and best-effort VRAM (bytes) so the UI can warn
/// before downloading a model that is large relative to the machine's capacity.
#[command]
async fn get_system_memory() -> Result<SystemMemory, String> {
    Ok(model_manager::get_system_memory())
}

/// Download the Phi3 Mini model
#[command]
async fn download_phi3_model(app: AppHandle) -> Result<(), String> {
    download_ollama_model(app, "phi3:mini".to_string()).await
}

/// Download (pull) an arbitrary Ollama model with streaming progress events.
#[command]
async fn download_model(app: AppHandle, model: Option<String>) -> Result<(), String> {
    let model = model.unwrap_or_else(|| "phi3:mini".to_string());
    println!("[ibl.ai] download_model: pulling {}", model);
    download_ollama_model(app, model).await
}

#[command]
async fn log_stdout(s: Option<String>) -> Result<(), String> {
    if let Some(val) = s {
        println!("[ibl.ai OS Frontend] {val}");
    }
    Ok(())
}

/// Shared implementation: pull an Ollama model, emitting progress/log/disk events.
async fn download_ollama_model(app: AppHandle, model: String) -> Result<(), String> {
    let app_progress = Arc::new(app.clone());
    let app_log = Arc::new(app.clone());

    // Emit initial log
    let _ = app.emit(
        EVENT_INSTALLATION_LOG,
        InstallationLog {
            timestamp: get_timestamp(),
            level: "info".to_string(),
            message: "Checking Ollama status...".to_string(),
        },
    );

    // Check if Ollama is running
    if !is_ollama_running().await {
        let _ = app.emit(
            EVENT_INSTALLATION_LOG,
            InstallationLog {
                timestamp: get_timestamp(),
                level: "info".to_string(),
                message: "Starting Ollama server...".to_string(),
            },
        );

        // Try to start it
        start_ollama_server()?;

        // Wait for it to actually become ready (it can take several seconds; a
        // fixed short delay raced the server and made downloads fail with
        // "Could not start Ollama server").
        if !wait_for_ollama_ready(30).await {
            return Err("Could not start Ollama server. Please start Ollama manually.".to_string());
        }

        let _ = app.emit(
            EVENT_INSTALLATION_LOG,
            InstallationLog {
                timestamp: get_timestamp(),
                level: "info".to_string(),
                message: "Ollama server started successfully".to_string(),
            },
        );
    }

    // Check disk space
    let available_gb = check_disk_space()?;
    if available_gb < REQUIRED_FREE_SPACE_GB {
        let error = DiskSpaceError {
            required_gb: REQUIRED_FREE_SPACE_GB,
            available_gb,
            message: format!(
                "Insufficient disk space. {:.1} GB available, {:.1} GB required.",
                available_gb, REQUIRED_FREE_SPACE_GB
            ),
        };
        let _ = app.emit(EVENT_DISK_SPACE_ERROR, &error);
        return Err(error.message);
    }

    // Check if already installed
    if is_model_installed(&model).await {
        let _ = app.emit(
            EVENT_DOWNLOAD_PROGRESS,
            DownloadProgress {
                status: "completed".to_string(),
                completed: 0,
                total: 0,
                percentage: 100.0,
                digest: None,
                message: "Model already installed".to_string(),
            },
        );

        let _ = app.emit(
            EVENT_INSTALLATION_LOG,
            InstallationLog {
                timestamp: get_timestamp(),
                level: "info".to_string(),
                message: format!("{} model is already installed", model),
            },
        );

        return Ok(());
    }

    // Start the model download
    pull_model(
        &model,
        move |progress| {
            let _ = app_progress.emit(EVENT_DOWNLOAD_PROGRESS, &progress);
        },
        move |log| {
            let _ = app_log.emit(EVENT_INSTALLATION_LOG, &log);
        },
    )
    .await
}

/// Check network connectivity by attempting to reach a reliable endpoint
#[command]
async fn check_network_status() -> Result<bool, String> {
    // Try to reach a reliable endpoint with a short timeout
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .map_err(|e| e.to_string())?;

    // Try multiple endpoints for reliability
    let endpoints = [
        "https://www.google.com/generate_204",
        "https://connectivity-check.ubuntu.com/",
        "https://www.apple.com/library/test/success.html",
    ];

    for endpoint in endpoints {
        match client.head(endpoint).send().await {
            Ok(response) => {
                if response.status().is_success() || response.status().as_u16() == 204 {
                    return Ok(true);
                }
            }
            Err(_) => continue,
        }
    }

    Ok(false)
}

/// Cancel an ongoing model download
#[command]
async fn cancel_model_download(app: AppHandle) -> Result<(), String> {
    let _ = app.emit(
        EVENT_INSTALLATION_LOG,
        InstallationLog {
            timestamp: get_timestamp(),
            level: "info".to_string(),
            message: "Cancelling download...".to_string(),
        },
    );

    cancel_download()?;

    let _ = app.emit(
        EVENT_DOWNLOAD_PROGRESS,
        DownloadProgress {
            status: "cancelled".to_string(),
            completed: 0,
            total: 0,
            percentage: 0.0,
            digest: None,
            message: "Download cancelled".to_string(),
        },
    );

    Ok(())
}

/// Set the online/offline status for the web cache
#[command]
async fn set_cache_online_status(is_online: bool) -> Result<(), String> {
    let cache_lock = get_web_cache().read().await;
    if let Some(cache) = cache_lock.as_ref() {
        cache.set_online(is_online).await;
        Ok(())
    } else {
        Err("Cache not initialized".to_string())
    }
}

/// Clear the web cache
#[command]
async fn clear_web_cache() -> Result<(), String> {
    let cache_lock = get_web_cache().read().await;
    if let Some(cache) = cache_lock.as_ref() {
        cache.clear().await
    } else {
        Err("Cache not initialized".to_string())
    }
}

/// Get web cache statistics
#[command]
async fn get_web_cache_stats() -> Result<CacheStats, String> {
    let cache_lock = get_web_cache().read().await;
    if let Some(cache) = cache_lock.as_ref() {
        Ok(cache.get_stats().await)
    } else {
        Err("Cache not initialized".to_string())
    }
}

/// Get the offline server URL
#[command]
fn get_offline_server_url() -> String {
    get_server_url()
}

/// Check if the offline server is running
#[command]
async fn is_offline_server_ready() -> bool {
    // Try a few times with small delays to handle startup timing
    for i in 0..5 {
        if offline_server::is_server_running().await {
            println!("[ibl.ai] Offline server is ready (attempt {})", i + 1);
            return true;
        }
        if i < 4 {
            tokio::time::sleep(tokio::time::Duration::from_millis(200)).await;
        }
    }
    println!("[ibl.ai] Offline server not ready after 5 attempts");
    false
}

/// Pre-cache the app and all its assets for offline use
#[command]
async fn precache_app(app: AppHandle, url: String) -> Result<PrecacheResult, String> {
    // Extract the route from the URL and save it
    // URL format: https://mentorai.iblai.app/platform/<tenant>/<mentorId>
    if let Some(path_start) = url.find("/platform/") {
        let route = &url[path_start..];
        println!("[ibl.ai] Extracting route from precache URL: {}", route);

        // Save to memory
        let storage = get_last_route_storage();
        let mut lock = storage.write().await;
        *lock = Some(route.to_string());
        drop(lock);

        // Save to file
        if let Ok(app_data_dir) = app.path().app_data_dir() {
            let route_file = app_data_dir.join(LAST_ROUTE_FILE);
            if let Err(e) = std::fs::write(&route_file, route) {
                println!("[ibl.ai] Failed to save route to file: {}", e);
            } else {
                println!("[ibl.ai] Saved route from precache: {:?}", route_file);
            }
        }
    }

    let cache_lock = get_web_cache().read().await;
    if let Some(cache) = cache_lock.as_ref() {
        cache.precache_with_assets(&url).await
    } else {
        Err("Cache not initialized".to_string())
    }
}

/// Cache images from API responses (call after precache_app)
#[command]
async fn cache_images() -> Result<PrecacheResult, String> {
    println!("[ibl.ai] Caching images from API responses...");

    let cache_lock = get_web_cache().read().await;
    if let Some(cache) = cache_lock.as_ref() {
        cache.cache_images_from_api_responses().await
    } else {
        Err("Cache not initialized".to_string())
    }
}

/// Save the last mentor route (persists across origins and app restarts)
#[command]
async fn save_last_mentor_route(app: AppHandle, route: String) -> Result<(), String> {
    println!("[ibl.ai] Saving last mentor route: {}", route);

    // Save to memory
    let storage = get_last_route_storage();
    let mut lock = storage.write().await;
    *lock = Some(route.clone());
    drop(lock);

    // Save to file for persistence across app restarts
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let route_file = app_data_dir.join(LAST_ROUTE_FILE);
    std::fs::write(&route_file, &route).map_err(|e| e.to_string())?;

    println!("[ibl.ai] Saved route to: {:?}", route_file);
    Ok(())
}

const OFFLINE_CONTEXT_FILE: &str = "offline_context.json";

/// Save the full offline context (localStorage data needed for offline mode)
#[command]
async fn save_offline_context(app: AppHandle, context: String) -> Result<(), String> {
    println!("[ibl.ai] Saving offline context ({} bytes)", context.len());

    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let context_file = app_data_dir.join(OFFLINE_CONTEXT_FILE);
    std::fs::write(&context_file, &context).map_err(|e| e.to_string())?;

    println!("[ibl.ai] Saved offline context to: {:?}", context_file);
    Ok(())
}

/// Get the saved offline context
#[command]
async fn get_offline_context(app: AppHandle) -> Option<String> {
    let app_data_dir = match app.path().app_data_dir() {
        Ok(dir) => dir,
        Err(_) => return None,
    };
    let context_file = app_data_dir.join(OFFLINE_CONTEXT_FILE);

    match std::fs::read_to_string(&context_file) {
        Ok(context) => {
            println!("[ibl.ai] Loaded offline context ({} bytes)", context.len());
            Some(context)
        }
        Err(e) => {
            println!("[ibl.ai] No offline context found: {}", e);
            None
        }
    }
}

/// Get the operating system type
#[command]
fn get_os_type() -> String {
    #[cfg(target_os = "windows")]
    return "windows".to_string();

    #[cfg(target_os = "macos")]
    return "macos".to_string();

    #[cfg(target_os = "linux")]
    return "linux".to_string();

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    return "unknown".to_string();
}

/// Proxy a chat request to Ollama
/// This is needed because the app runs on HTTPS but local LLMs run on HTTP (localhost)
/// Browsers block mixed content, so we proxy through Tauri
/// Checks Foundry Local first, falls back to Ollama if not available
#[command]
async fn ollama_chat(
    messages: Vec<serde_json::Value>,
    model: Option<String>,
) -> Result<String, String> {
    let model = model.unwrap_or_else(|| "phi3:mini".to_string());

    println!("[ibl.ai] Chat using model: {}", model);
    println!(
        "[ibl.ai] Proxying chat request with {} messages",
        messages.len()
    );

    // Check if Foundry Local is available first (auto-preference)
    if let Ok(foundry_status) = check_foundry_status().await {
        if foundry_status.is_available && foundry_status.has_models {
            println!("[ibl.ai] Using Foundry Local for chat");
            // Get selected model from storage
            let storage = get_foundry_model_storage();
            let selected_model = storage.read().await.clone();
            return foundry_chat(messages, foundry_status, selected_model).await;
        }
    }

    println!("[ibl.ai] Using Ollama for chat");
    let ollama_url = "http://localhost:11434/api/chat";

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let body = serde_json::json!({
        "model": model,
        "messages": messages,
        "stream": false
    });

    let response = client
        .post(ollama_url)
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Failed to connect to Ollama: {}. Is Ollama running?", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_default();
        return Err(format!("Ollama returned error {}: {}", status, error_text));
    }

    let response_body = response
        .text()
        .await
        .map_err(|e| format!("Failed to read Ollama response: {}", e))?;

    println!("[ibl.ai] Ollama chat response received");
    Ok(response_body)
}

/// Stream a chat request to Ollama (returns chunks via events)
/// For streaming responses, we emit events instead of returning all at once
/// Checks Foundry Local first, falls back to Ollama if not available
#[command]
async fn ollama_chat_stream(
    app: AppHandle,
    messages: Vec<serde_json::Value>,
    model: Option<String>,
    generation_id: String,
) -> Result<(), String> {
    let model = model.unwrap_or_else(|| "phi3:mini".to_string());

    println!("[ibl.ai] Chat using model: {} (streaming)", model);
    println!(
        "[ibl.ai] Proxying streaming chat request with {} messages",
        messages.len()
    );

    // Check if Foundry Local is available first (auto-preference)
    if let Ok(foundry_status) = check_foundry_status().await {
        if foundry_status.is_available && foundry_status.has_models {
            println!("[ibl.ai] Using Foundry Local for streaming chat");
            // Get selected model from storage
            let storage = get_foundry_model_storage();
            let selected_model = storage.read().await.clone();
            return foundry_chat_stream(
                app,
                messages,
                foundry_status,
                generation_id,
                selected_model,
            )
            .await;
        }
    }

    println!("[ibl.ai] Using Ollama for streaming chat");
    let ollama_url = "http://localhost:11434/api/chat";

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(300))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let body = serde_json::json!({
        "model": model,
        "messages": messages,
        "stream": true
    });

    let response = client
        .post(ollama_url)
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Failed to connect to Ollama: {}. Is Ollama running?", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_default();
        return Err(format!("Ollama returned error {}: {}", status, error_text));
    }

    // Stream the response
    let mut stream = response.bytes_stream();
    let mut full_content = String::new();

    use futures_util::StreamExt;

    while let Some(chunk_result) = stream.next().await {
        match chunk_result {
            Ok(chunk) => {
                let chunk_str = String::from_utf8_lossy(&chunk);
                // Ollama returns newline-delimited JSON
                for line in chunk_str.lines() {
                    if line.trim().is_empty() {
                        continue;
                    }
                    if let Ok(json) = serde_json::from_str::<serde_json::Value>(line) {
                        if let Some(content) = json
                            .get("message")
                            .and_then(|m| m.get("content"))
                            .and_then(|c| c.as_str())
                        {
                            full_content.push_str(content);
                            // Emit token event
                            let _ = app.emit(
                                "ollama:token",
                                serde_json::json!({
                                    "generation_id": generation_id,
                                    "token": content,
                                    "full_content": full_content
                                }),
                            );
                        }
                        if json.get("done").and_then(|d| d.as_bool()).unwrap_or(false) {
                            // Emit done event
                            let _ = app.emit(
                                "ollama:done",
                                serde_json::json!({
                                    "generation_id": generation_id,
                                    "full_content": full_content
                                }),
                            );
                            return Ok(());
                        }
                    }
                }
            }
            Err(e) => {
                let _ = app.emit(
                    "ollama:error",
                    serde_json::json!({
                        "generation_id": generation_id,
                        "error": format!("Stream error: {}", e)
                    }),
                );
                return Err(format!("Stream error: {}", e));
            }
        }
    }

    // If we get here without done=true, still emit done
    let _ = app.emit(
        "ollama:done",
        serde_json::json!({
            "generation_id": generation_id,
            "full_content": full_content
        }),
    );

    Ok(())
}

/// Get the last mentor route
#[command]
async fn get_last_mentor_route(app: AppHandle) -> Option<String> {
    // Try memory first
    let storage = get_last_route_storage();
    let lock = storage.read().await;
    if let Some(route) = lock.as_ref() {
        println!("[ibl.ai] Got last mentor route from memory: {}", route);
        return Some(route.clone());
    }
    drop(lock);

    // Try file
    let app_data_dir = match app.path().app_data_dir() {
        Ok(dir) => dir,
        Err(_) => return None,
    };
    let route_file = app_data_dir.join(LAST_ROUTE_FILE);

    if let Ok(route) = std::fs::read_to_string(&route_file) {
        let route = route.trim().to_string();
        if !route.is_empty() {
            println!("[ibl.ai] Got last mentor route from file: {}", route);
            // Store in memory for faster access next time
            let mut lock = storage.write().await;
            *lock = Some(route.clone());
            return Some(route);
        }
    }

    println!("[ibl.ai] No last mentor route found");
    None
}

/// Cache an API response for offline use
/// For POST requests, include the request body hash in the cache key
#[command]
async fn cache_api_response(
    _app: AppHandle,
    url: String,
    body: String,
    content_type: String,
    method: Option<String>,
    request_body: Option<String>,
    is_base64: Option<bool>,
) -> Result<(), String> {
    use crate::web_cache::CacheResponse;
    use sha2::{Digest, Sha256};

    let method = method.unwrap_or_else(|| "GET".to_string());
    let is_base64 = is_base64.unwrap_or(false);

    // For POST requests, create a cache key that includes method and request body hash
    let cache_key = if method == "POST" {
        if let Some(ref req_body) = request_body {
            let mut hasher = Sha256::new();
            hasher.update(req_body.as_bytes());
            let body_hash = hex::encode(hasher.finalize());
            format!("{}#POST#{}", url, body_hash)
        } else {
            format!("{}#POST", url)
        }
    } else {
        url.clone()
    };

    println!(
        "[ibl.ai] Caching {} response for: {} (key: {}, base64: {})",
        method, url, cache_key, is_base64
    );

    // Decode base64 if needed (for images)
    let body_bytes = if is_base64 {
        base64::engine::general_purpose::STANDARD
            .decode(&body)
            .map_err(|e| format!("Failed to decode base64: {}", e))?
    } else {
        body.into_bytes()
    };

    let cache_lock = get_web_cache().read().await;
    if let Some(cache) = cache_lock.as_ref() {
        let response = CacheResponse {
            status: 200,
            content_type,
            headers: std::collections::HashMap::new(),
            body: body_bytes,
        };
        cache.store_response(&cache_key, &response).await;
        println!("[ibl.ai] Cached {} response for: {}", method, url);
        Ok(())
    } else {
        Err("Cache not initialized".to_string())
    }
}

/// Get a cached API response
/// For POST requests, include method and request_body to look up the correct cached response
#[command]
async fn get_cached_api_response(
    url: String,
    method: Option<String>,
    request_body: Option<String>,
) -> Result<Option<String>, String> {
    use sha2::{Digest, Sha256};

    let method = method.unwrap_or_else(|| "GET".to_string());

    // For POST requests, create the same cache key format used when storing
    let cache_key = if method == "POST" {
        if let Some(ref req_body) = request_body {
            let mut hasher = Sha256::new();
            hasher.update(req_body.as_bytes());
            let body_hash = hex::encode(hasher.finalize());
            format!("{}#POST#{}", url, body_hash)
        } else {
            format!("{}#POST", url)
        }
    } else {
        url.clone()
    };

    println!(
        "[ibl.ai] Looking up cached {} response for: {} (key: {})",
        method, url, cache_key
    );

    let cache_lock = get_web_cache().read().await;
    if let Some(cache) = cache_lock.as_ref() {
        if let Some(response) = cache.get_cached(&cache_key).await {
            println!("[ibl.ai] Found cached {} response for: {}", method, url);
            return Ok(Some(String::from_utf8_lossy(&response.body).to_string()));
        }

        // If POST request with body not found, try without body hash (fallback)
        if method == "POST" && request_body.is_some() {
            let fallback_key = format!("{}#POST", url);
            if let Some(response) = cache.get_cached(&fallback_key).await {
                println!(
                    "[ibl.ai] Found cached POST response (fallback) for: {}",
                    url
                );
                return Ok(Some(String::from_utf8_lossy(&response.body).to_string()));
            }
        }
    }

    println!("[ibl.ai] No cached {} response found for: {}", method, url);
    Ok(None)
}

/// JavaScript that monitors URL changes and saves mentor routes via Tauri (online mode)
/// Also intercepts fetch requests to cache API responses for offline use
const URL_MONITOR_SCRIPT_ONLINE: &str = r#"
(function() {
    console.log('[MentorRouteMonitor] Script starting...', {
        alreadyInstalled: window.__mentorRouteMonitorInstalled,
        hasTauri: typeof window.__TAURI__ !== 'undefined',
        location: window.location.href
    });

    // Only run once per page
    if (window.__mentorRouteMonitorInstalled) {
        console.log('[MentorRouteMonitor] Already installed, skipping');
        return;
    }
    window.__mentorRouteMonitorInstalled = true;

    // Mark as online mode
    window.__TAURI_OFFLINE_MODE__ = false;
    localStorage.setItem('tauri_offline_mode', 'false');

    // Intercept fetch to cache API responses for offline use (GET and POST)
    var originalFetch = window.fetch;
    window.fetch = function(input, init) {
        var url = typeof input === 'string' ? input : (input && input.url ? input.url : (input && input.href ? input.href : String(input)));
        var method = (init && init.method) ? init.method.toUpperCase() : 'GET';
        var requestBody = (init && init.body) ? init.body : null;

        var isApiCall = url.includes('/api/') && (
            url.includes('manager.iblai') ||
            url.includes('learn.iblai') ||
            url.includes('ai-mentor') ||
            url.includes('custom-domains') ||
            url.includes('mentor') ||
            url.includes('tenant') ||
            url.includes('ibl/users') ||
            url.includes('rbac')
        );

        // Also cache JavaScript and CSS chunks for offline use
        var isAsset = url.includes('/_next/static/') || url.includes('/static/');

        // Check if this is an image URL (common image hosts and formats)
        var isImage = url.match(/\.(jpg|jpeg|png|gif|webp|svg|ico|bmp)(\?|$)/i) ||
                     url.includes('gravatar.com') ||
                     url.includes('.s3.') ||
                     url.includes('s3.amazonaws.com') ||
                     url.includes('cloudfront.net') ||
                     url.includes('/_next/image');

        // Cache API calls (GET and POST), static assets (GET only), and images (GET only)
        var shouldCache = (isApiCall && (method === 'GET' || method === 'POST')) ||
                         (isAsset && method === 'GET') ||
                         (isImage && method === 'GET');

        return originalFetch.apply(this, arguments).then(function(response) {
            // Cache successful API responses (both GET and POST)
            if (shouldCache && response.ok) {
                // Clone the response so we can read the body
                var clonedResponse = response.clone();
                var contentType = response.headers.get('Content-Type') || 'application/json';

                // For images, use arrayBuffer and convert to base64
                // For text content (JSON, HTML, JS, CSS), use text()
                var isImageContent = contentType.startsWith('image/') || isImage;
                var bodyPromise = isImageContent ?
                    clonedResponse.arrayBuffer().then(function(buffer) {
                        // Convert ArrayBuffer to base64
                        var bytes = new Uint8Array(buffer);
                        var binary = '';
                        for (var i = 0; i < bytes.length; i++) {
                            binary += String.fromCharCode(bytes[i]);
                        }
                        return btoa(binary);
                    }) :
                    clonedResponse.text();

                bodyPromise.then(function(body) {
                    // Cache via Tauri command
                    if (window.__TAURI__ && window.__TAURI__.core && window.__TAURI__.core.invoke) {
                        var cacheParams = {
                            url: url,
                            body: body,
                            contentType: contentType,
                            method: method,
                            isBase64: isImageContent
                        };

                        // For POST requests, include the request body for cache key generation
                        if (method === 'POST' && requestBody) {
                            // Convert request body to string if it's not already
                            if (typeof requestBody === 'string') {
                                cacheParams.requestBody = requestBody;
                            } else if (requestBody instanceof FormData) {
                                // Skip caching FormData for now (complex to serialize)
                                console.log('[MentorRouteMonitor] Skipping FormData POST cache for:', url);
                                return;
                            } else {
                                try {
                                    cacheParams.requestBody = JSON.stringify(requestBody);
                                } catch (e) {
                                    cacheParams.requestBody = null;
                                }
                            }
                        }

                        window.__TAURI__.core.invoke('cache_api_response', cacheParams)
                            .then(function() {
                                console.log('[MentorRouteMonitor] Cached', method, 'response for:', url);
                            })
                            .catch(function(e) {
                                // Silently fail - caching is best effort
                            });
                    }
                });
            }
            return response;
        });
    };

    console.log('[MentorRouteMonitor] Fetch interceptor installed for API caching (GET + POST)');

    // Cache the current page HTML and assets for offline use
    // Wait for the page to fully load and render before caching
    function cachePageHtml() {
        console.log('[MentorRouteMonitor] cachePageHtml called', {
            hasTauri: typeof window.__TAURI__ !== 'undefined',
            hasCore: window.__TAURI__ && typeof window.__TAURI__.core !== 'undefined',
            hasInvoke: window.__TAURI__ && window.__TAURI__.core && typeof window.__TAURI__.core.invoke === 'function'
        });

        if (!window.__TAURI__ || !window.__TAURI__.core || !window.__TAURI__.core.invoke) {
            console.error('[MentorRouteMonitor] Tauri API not available, cannot cache page');
            return;
        }

        var currentUrl = window.location.href;
        console.log('[MentorRouteMonitor] Starting precache for:', currentUrl);

        // Use the precache_app command which caches both HTML and assets
        window.__TAURI__.core.invoke('precache_app', {
            url: currentUrl
        }).then(function(result) {
            console.log('[MentorRouteMonitor] Pre-cache complete:', result);
        }).catch(function(e) {
            console.error('[MentorRouteMonitor] Pre-cache failed:', e);
        });
    }

    // Wait for Next.js to finish rendering before caching HTML
    // Try multiple approaches to ensure we cache after the page is ready
    console.log('[MentorRouteMonitor] Setting up page load handlers, readyState:', document.readyState);

    if (document.readyState === 'complete') {
        // Page already loaded, wait a bit for React to hydrate
        console.log('[MentorRouteMonitor] Page already complete, scheduling cache in 2s');
        setTimeout(cachePageHtml, 2000);
    } else {
        // Wait for load event, then wait for React hydration
        console.log('[MentorRouteMonitor] Waiting for load event');
        window.addEventListener('load', function() {
            console.log('[MentorRouteMonitor] Load event fired, scheduling cache in 2s');
            setTimeout(cachePageHtml, 2000);
        });
    }

    var MENTOR_ROUTE_PATTERN = /^\/platform\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_-]+)/;
    var lastSavedRoute = null;

    // Save offline context (localStorage snapshot) for offline mode
    function saveOfflineContext() {
        if (!window.__TAURI__ || !window.__TAURI__.core) return;

        try {
            // Collect important localStorage keys for offline mode
            var keysToSave = [
                'axd_token', 'dm_token', 'axd_token_expires', 'dm_token_expires',
                'user_data', 'username', 'tenant', 'current_tenant', 'tenants',
                'user_object', 'auth', 'ibl_user', 'visiting_tenant'
            ];

            var context = {};
            for (var i = 0; i < keysToSave.length; i++) {
                var value = localStorage.getItem(keysToSave[i]);
                if (value) {
                    context[keysToSave[i]] = value;
                }
            }

            // Also save any ibl-related keys
            for (var j = 0; j < localStorage.length; j++) {
                var key = localStorage.key(j);
                if (key && (key.indexOf('ibl') !== -1 || key.indexOf('token') !== -1 || key.indexOf('user') !== -1)) {
                    context[key] = localStorage.getItem(key);
                }
            }

            var contextStr = JSON.stringify(context);
            window.__TAURI__.core.invoke('save_offline_context', { context: contextStr })
                .then(function() {
                    console.log('[MentorRouteMonitor] Offline context saved (' + Object.keys(context).length + ' keys)');
                })
                .catch(function(e) {
                    console.error('[MentorRouteMonitor] Failed to save offline context:', e);
                });
        } catch (e) {
            console.error('[MentorRouteMonitor] Error saving offline context:', e);
        }
    }

    function saveMentorRoute(route) {
        if (route === lastSavedRoute) return;
        lastSavedRoute = route;

        console.log('[MentorRouteMonitor] Saving route:', route);

        if (window.__TAURI__ && window.__TAURI__.core && window.__TAURI__.core.invoke) {
            window.__TAURI__.core.invoke('save_last_mentor_route', { route: route })
                .then(function() {
                    console.log('[MentorRouteMonitor] Route saved successfully');
                    // Also save the offline context when we save a route
                    saveOfflineContext();
                })
                .catch(function(e) {
                    console.error('[MentorRouteMonitor] Failed to save route:', e);
                });
        }
    }

    function checkAndSaveRoute() {
        var path = window.location.pathname;
        var match = path.match(MENTOR_ROUTE_PATTERN);
        if (match) {
            // Extract route without query params
            var route = '/platform/' + match[1] + '/' + match[2];
            saveMentorRoute(route);
        }
    }

    // Check on load
    checkAndSaveRoute();

    // Monitor for SPA navigation (history changes)
    var originalPushState = history.pushState;
    var originalReplaceState = history.replaceState;

    history.pushState = function() {
        originalPushState.apply(this, arguments);
        setTimeout(checkAndSaveRoute, 100);
    };

    history.replaceState = function() {
        originalReplaceState.apply(this, arguments);
        setTimeout(checkAndSaveRoute, 100);
    };

    window.addEventListener('popstate', function() {
        setTimeout(checkAndSaveRoute, 100);
    });

    // Also check periodically in case of any missed navigations
    setInterval(checkAndSaveRoute, 5000);

    console.log('[MentorRouteMonitor] Installed (online mode) - monitoring URL changes');
})();
"#;

/// JavaScript for offline mode - intercepts fetch calls and routes API calls through offline server
/// CRITICAL: This script must restore localStorage context BEFORE the app initializes
const URL_MONITOR_SCRIPT_OFFLINE: &str = r#"
(function() {
    // Only run once per page
    if (window.__mentorRouteMonitorInstalled) return;
    window.__mentorRouteMonitorInstalled = true;

    // Mark as offline mode FIRST - critical for the app to skip auth checks
    window.__TAURI_OFFLINE_MODE__ = true;
    localStorage.setItem('tauri_offline_mode', 'true');

    var OFFLINE_SERVER = 'http://127.0.0.1:3457';

    // Override __ENV__ to route API calls through our offline server
    window.__ENV__ = window.__ENV__ || {};
    window.__ENV__.NEXT_PUBLIC_DM_URL = OFFLINE_SERVER;
    window.__ENV__.NEXT_PUBLIC_AXD_URL = OFFLINE_SERVER;
    window.__ENV__.NEXT_PUBLIC_LMS_URL = OFFLINE_SERVER;

    console.log('[OfflineMode] Starting offline mode initialization...');

    // CRITICAL: Restore localStorage context from saved file
    // This runs synchronously to ensure data is available before app initialization
    function restoreOfflineContext() {
        console.log('[OfflineMode] Checking for saved offline context...');

        // We need to wait for Tauri to be ready
        function waitForTauri(callback, maxAttempts) {
            maxAttempts = maxAttempts || 50;
            var attempts = 0;

            function check() {
                attempts++;
                if (window.__TAURI__ && window.__TAURI__.core && window.__TAURI__.core.invoke) {
                    console.log('[OfflineMode] Tauri ready after', attempts, 'attempts');
                    callback();
                } else if (attempts < maxAttempts) {
                    setTimeout(check, 100);
                } else {
                    console.error('[OfflineMode] Tauri not available after', maxAttempts, 'attempts');
                }
            }
            check();
        }

        waitForTauri(function() {
            window.__TAURI__.core.invoke('get_offline_context')
                .then(function(contextStr) {
                    if (!contextStr) {
                        console.warn('[OfflineMode] No saved offline context found');
                        return;
                    }

                    try {
                        var context = JSON.parse(contextStr);
                        var restoredCount = 0;

                        // Restore all saved localStorage keys
                        for (var key in context) {
                            if (context.hasOwnProperty(key)) {
                                var existingValue = localStorage.getItem(key);
                                // Only restore if the value doesn't exist or is different
                                if (!existingValue || existingValue !== context[key]) {
                                    localStorage.setItem(key, context[key]);
                                    restoredCount++;
                                    console.log('[OfflineMode] Restored localStorage key:', key);
                                }
                            }
                        }

                        console.log('[OfflineMode] Restored', restoredCount, 'localStorage keys from offline context');

                        // Dispatch a custom event to notify the app that context is ready
                        window.dispatchEvent(new CustomEvent('offlineContextRestored', { detail: { count: restoredCount } }));

                    } catch (e) {
                        console.error('[OfflineMode] Error parsing offline context:', e);
                    }
                })
                .catch(function(e) {
                    console.error('[OfflineMode] Error loading offline context:', e);
                });
        });
    }

    // Start context restoration immediately
    restoreOfflineContext();

    // CRITICAL: Intercept ALL fetch calls and redirect to offline server
    var originalFetch = window.fetch;
    window.fetch = function(input, init) {
        var url = typeof input === 'string' ? input : (input && input.url ? input.url : '');

        // Check if this is an API call to external services
        var apiPatterns = [
            'base.manager.iblai.app',
            'base.manager.iblai.org',
            'api.iblai.app',
            'api.iblai.org',
            'learn.iblai.app',
            'learn.iblai.org'
        ];

        var isExternalApi = apiPatterns.some(function(pattern) {
            return url.indexOf(pattern) !== -1;
        });

        // Check if this is a relative URL (starts with /) or a tauri:// URL
        var isRelativeUrl = url.startsWith('/');
        var isTauriProtocol = url.startsWith('tauri://');

        // Redirect external API calls OR relative/tauri URLs to offline server
        if ((isExternalApi && url.indexOf('/api/') !== -1) || isRelativeUrl || isTauriProtocol) {
            try {
                var newUrl;
                if (isRelativeUrl) {
                    // Relative URL - prepend offline server
                    newUrl = OFFLINE_SERVER + url;
                    console.log('[OfflineMode] Redirecting relative URL:', url, '->', newUrl);
                } else if (isTauriProtocol) {
                    // Extract path from tauri://localhost/path
                    var path = url.replace('tauri://localhost', '');
                    newUrl = OFFLINE_SERVER + path;
                    console.log('[OfflineMode] Redirecting tauri URL:', url, '->', newUrl);
                } else {
                    // External API - extract path and redirect
                    var urlObj = new URL(url);
                    newUrl = OFFLINE_SERVER + urlObj.pathname + urlObj.search;
                    console.log('[OfflineMode] Redirecting API call:', url, '->', newUrl);
                }

                // Create new input with redirected URL
                if (typeof input === 'string') {
                    input = newUrl;
                } else if (input && input.url) {
                    input = new Request(newUrl, input);
                }
            } catch (e) {
                console.error('[OfflineMode] Error redirecting URL:', e);
            }
        }

        return originalFetch.call(this, input, init);
    };

    console.log('[OfflineMode] Fetch interceptor installed, API calls routed to:', OFFLINE_SERVER);

    // Save route same as online mode
    var MENTOR_ROUTE_PATTERN = /^\/platform\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_-]+)/;

    function checkAndSaveRoute() {
        var path = window.location.pathname;
        var match = path.match(MENTOR_ROUTE_PATTERN);
        if (match) {
            var route = '/platform/' + match[1] + '/' + match[2];
            if (window.__TAURI__ && window.__TAURI__.core && window.__TAURI__.core.invoke) {
                window.__TAURI__.core.invoke('save_last_mentor_route', { route: route }).catch(function() {});
            }
        }
    }

    checkAndSaveRoute();

    console.log('[OfflineMode] Initialization complete');
})();
"#;

/// Helper function to send streaming chat request to Foundry Local (OpenAI-compatible API)
async fn foundry_chat_stream(
    app: AppHandle,
    messages: Vec<serde_json::Value>,
    foundry_status: FoundryStatus,
    generation_id: String,
    selected_model: Option<String>,
) -> Result<(), String> {
    let endpoint = foundry_status
        .endpoint
        .ok_or("Foundry endpoint not available")?;

    // Use selected model if provided, otherwise use first available model
    // Convert from UI ID (e.g., "phi-3-mini-128k_npu") to Foundry ID (e.g., "phi-3-mini-128k-instruct-qnn-npu:2")
    let model = if let Some(model_id) = selected_model {
        println!("[FoundryChat] Looking for model with UI ID: {}", model_id);
        // Find the model by UI ID and get its foundry_id
        let foundry_model = foundry_status
            .models
            .iter()
            .find(|m| m.id == model_id)
            .ok_or_else(|| format!("Selected model '{}' not found in Foundry models", model_id))?;
        println!(
            "[FoundryChat] Streaming with selected model - UI ID: {}, Foundry ID: {}",
            model_id, foundry_model.foundry_id
        );
        foundry_model.foundry_id.clone()
    } else {
        let default_model = foundry_status
            .models
            .first()
            .ok_or("No Foundry models available")?;
        println!(
            "[FoundryChat] Streaming with default model - UI ID: {}, Foundry ID: {}",
            default_model.id, default_model.foundry_id
        );
        default_model.foundry_id.clone()
    };

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(300))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    // Foundry uses OpenAI-compatible format with streaming
    let body = serde_json::json!({
        "model": model,
        "messages": messages,
        "stream": true
    });

    let url = format!("{}/v1/chat/completions", endpoint);
    println!("[FoundryChat] Sending request to: {}", url);
    println!(
        "[FoundryChat] Request body: {}",
        serde_json::to_string_pretty(&body).unwrap_or_default()
    );

    let response = client
        .post(&url)
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| {
            let err_msg = format!("Failed to connect to Foundry: {}", e);
            println!("[FoundryChat] ERROR: {}", err_msg);
            err_msg
        })?;

    println!("[FoundryChat] Response status: {}", response.status());

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_default();
        let err_msg = format!("Foundry returned error {}: {}", status, error_text);
        println!("[FoundryChat] ERROR: {}", err_msg);
        return Err(err_msg);
    }

    println!("[FoundryChat] Starting to stream response...");

    // Stream the response - OpenAI format uses server-sent events (SSE)
    let mut stream = response.bytes_stream();
    let mut full_content = String::new();
    let mut chunk_count = 0;

    use futures_util::StreamExt;

    while let Some(chunk_result) = stream.next().await {
        match chunk_result {
            Ok(chunk) => {
                chunk_count += 1;
                let chunk_str = String::from_utf8_lossy(&chunk);
                println!(
                    "[FoundryChat] Received chunk #{}: {} bytes",
                    chunk_count,
                    chunk.len()
                );

                // OpenAI SSE format: "data: {json}\n\n"
                for line in chunk_str.lines() {
                    if line.trim().is_empty() {
                        continue;
                    }
                    if line.trim() == "data: [DONE]" {
                        println!("[FoundryChat] Received [DONE] signal");
                        continue;
                    }
                    if let Some(json_str) = line.strip_prefix("data: ") {
                        println!("[FoundryChat] Parsing SSE line: {}", json_str);
                        match serde_json::from_str::<serde_json::Value>(json_str) {
                            Ok(json) => {
                                if let Some(content) = json
                                    .get("choices")
                                    .and_then(|c| c.get(0))
                                    .and_then(|choice| choice.get("delta"))
                                    .and_then(|delta| delta.get("content"))
                                    .and_then(|c| c.as_str())
                                {
                                    full_content.push_str(content);
                                    println!("[FoundryChat] Emitting token: '{}'", content);
                                    // Emit token event
                                    let _ = app.emit(
                                        "ollama:token",
                                        serde_json::json!({
                                            "generation_id": generation_id,
                                            "token": content,
                                            "full_content": full_content
                                        }),
                                    );
                                } else {
                                    println!("[FoundryChat] No content in delta: {}", json);
                                }
                            }
                            Err(e) => {
                                println!(
                                    "[FoundryChat] Failed to parse JSON: {} - Raw: {}",
                                    e, json_str
                                );
                            }
                        }
                    } else {
                        println!("[FoundryChat] Non-SSE line: {}", line);
                    }
                }
            }
            Err(e) => {
                let err_msg = format!("Stream error: {}", e);
                println!("[FoundryChat] ERROR: {}", err_msg);
                let _ = app.emit(
                    "ollama:error",
                    serde_json::json!({
                        "generation_id": generation_id,
                        "error": err_msg
                    }),
                );
                return Err(err_msg);
            }
        }
    }

    println!(
        "[FoundryChat] Stream complete. Total chunks: {}, Total content length: {}",
        chunk_count,
        full_content.len()
    );

    // Emit done event
    let _ = app.emit(
        "ollama:done",
        serde_json::json!({
            "generation_id": generation_id,
            "full_content": full_content
        }),
    );

    Ok(())
}

/// Helper function to send chat request to Foundry Local (OpenAI-compatible API)
async fn foundry_chat(
    messages: Vec<serde_json::Value>,
    foundry_status: FoundryStatus,
    selected_model: Option<String>,
) -> Result<String, String> {
    let endpoint = foundry_status
        .endpoint
        .ok_or("Foundry endpoint not available")?;

    // Use selected model if provided, otherwise use first available model
    // Convert from UI ID (e.g., "phi-3-mini-128k_npu") to Foundry ID (e.g., "phi-3-mini-128k-instruct-qnn-npu:2")
    let model = if let Some(model_id) = selected_model {
        println!("[FoundryChat] Looking for model with UI ID: {}", model_id);
        // Find the model by UI ID and get its foundry_id
        let foundry_model = foundry_status
            .models
            .iter()
            .find(|m| m.id == model_id)
            .ok_or_else(|| format!("Selected model '{}' not found in Foundry models", model_id))?;
        println!(
            "[FoundryChat] Using selected model - UI ID: {}, Foundry ID: {}",
            model_id, foundry_model.foundry_id
        );
        foundry_model.foundry_id.clone()
    } else {
        let default_model = foundry_status
            .models
            .first()
            .ok_or("No Foundry models available")?;
        println!(
            "[FoundryChat] Using default model - UI ID: {}, Foundry ID: {}",
            default_model.id, default_model.foundry_id
        );
        default_model.foundry_id.clone()
    };

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    // Foundry uses OpenAI-compatible format: /v1/chat/completions
    let body = serde_json::json!({
        "model": model,
        "messages": messages,
        "stream": false
    });

    let url = format!("{}/v1/chat/completions", endpoint);
    println!("[FoundryChat] Sending non-streaming request to: {}", url);
    println!(
        "[FoundryChat] Request body: {}",
        serde_json::to_string_pretty(&body).unwrap_or_default()
    );

    let response = client
        .post(&url)
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| {
            let err_msg = format!("Failed to connect to Foundry: {}", e);
            println!("[FoundryChat] ERROR: {}", err_msg);
            err_msg
        })?;

    println!("[FoundryChat] Response status: {}", response.status());

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_default();
        let err_msg = format!("Foundry returned error {}: {}", status, error_text);
        println!("[FoundryChat] ERROR: {}", err_msg);
        return Err(err_msg);
    }

    let response_body = response
        .json::<serde_json::Value>()
        .await
        .map_err(|e| format!("Failed to parse Foundry response: {}", e))?;

    // OpenAI format: { "choices": [{ "message": { "content": "..." } }] }
    response_body
        .get("choices")
        .and_then(|c| c.get(0))
        .and_then(|choice| choice.get("message"))
        .and_then(|msg| msg.get("content"))
        .and_then(|content| content.as_str())
        .map(|s| s.to_string())
        .ok_or_else(|| "Failed to extract content from Foundry response".to_string())
}

fn main() {
    // Load .env file if present (for local development and custom builds)
    // First try current directory (dev mode), then try next to the executable (bundled app)
    if dotenvy::dotenv().is_err() {
        // Try loading from executable directory (for bundled apps)
        if let Ok(exe_path) = std::env::current_exe() {
            if let Some(exe_dir) = exe_path.parent() {
                // Try multiple possible locations for bundled .env
                let possible_paths = vec![
                    exe_dir.join(".env"),
                    exe_dir.join("resources").join(".env"),
                    exe_dir.join("..").join("resources").join(".env"),
                ];

                for env_path in possible_paths {
                    if env_path.exists() {
                        println!("[ibl.ai] Loading .env from: {:?}", env_path);
                        let _ = dotenvy::from_path(&env_path);
                        break;
                    }
                }
            }
        }
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_os::init())
        .setup(|app| {
            // Initialize web cache with app data directory
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to get app data directory");

            // Ensure app data directory exists
            if let Err(e) = std::fs::create_dir_all(&app_data_dir) {
                println!("[ibl.ai] Failed to create app data dir: {}", e);
            }

            // CRITICAL FIX: Clear only the webview HTTP cache, not localStorage
            // We need to preserve localStorage (auth tokens) but clear stale HTTP cache
            if let Ok(webview_data_dir) = app.path().app_data_dir() {
                #[cfg(target_os = "windows")]
                {
                    // On Windows, EBWebView has separate subdirectories:
                    // - EBWebView/Default/Cache - HTTP cache (safe to delete)
                    // - EBWebView/Default/Local Storage - localStorage (MUST PRESERVE)
                    let cache_dir = webview_data_dir
                        .join("EBWebView")
                        .join("Default")
                        .join("Cache");
                    if cache_dir.exists() {
                        println!("[ibl.ai] Clearing webview HTTP cache at: {:?}", cache_dir);
                        if let Err(e) = std::fs::remove_dir_all(&cache_dir) {
                            println!(
                                "[ibl.ai] Failed to clear webview cache (may be in use): {}",
                                e
                            );
                        } else {
                            println!("[ibl.ai] Webview HTTP cache cleared successfully");
                        }
                    }
                }

                #[cfg(target_os = "macos")]
                {
                    // On macOS, clear only the Cache subdirectory
                    let cache_dir = webview_data_dir.join("WebKit").join("Cache");
                    if cache_dir.exists() {
                        println!("[ibl.ai] Clearing webview HTTP cache at: {:?}", cache_dir);
                        if let Err(e) = std::fs::remove_dir_all(&cache_dir) {
                            println!("[ibl.ai] Failed to clear webview cache: {}", e);
                        } else {
                            println!("[ibl.ai] Webview HTTP cache cleared successfully");
                        }
                    }
                }

                #[cfg(target_os = "linux")]
                {
                    // On Linux, clear only the cache subdirectory
                    let cache_dir = webview_data_dir.join("webview").join("cache");
                    if cache_dir.exists() {
                        println!("[ibl.ai] Clearing webview HTTP cache at: {:?}", cache_dir);
                        if let Err(e) = std::fs::remove_dir_all(&cache_dir) {
                            println!("[ibl.ai] Failed to clear webview cache: {}", e);
                        } else {
                            println!("[ibl.ai] Webview HTTP cache cleared successfully");
                        }
                    }
                }
            }

            let cache = WebCache::new(app_data_dir.clone());

            // Store cache in global state
            let cache_holder = get_web_cache();
            let rt = tokio::runtime::Runtime::new().unwrap();
            rt.block_on(async {
                let mut lock = cache_holder.write().await;
                *lock = Some(cache);
            });

            // Log cache status for debugging (async, don't block startup)
            let cache_holder_clone = cache_holder.clone();
            std::thread::spawn(move || {
                let rt = tokio::runtime::Runtime::new().unwrap();
                rt.block_on(async {
                    let lock = cache_holder_clone.read().await;
                    if let Some(cache) = lock.as_ref() {
                        let stats = cache.get_stats().await;
                        println!(
                            "[ibl.ai] Cache status - {} entries, {} bytes",
                            stats.entry_count, stats.total_size_bytes
                        );

                        if stats.entry_count == 0 {
                            println!("[ibl.ai] Cache is empty - offline mode will show setup page");
                        }
                    }
                });
            });

            // Start the offline HTTP server in a background thread with ready signal
            let cache_for_server = get_web_cache().clone();
            let (ready_tx, ready_rx) = std::sync::mpsc::channel();
            std::thread::spawn(move || {
                println!("[ibl.ai] Starting offline server thread...");
                match tokio::runtime::Runtime::new() {
                    Ok(rt) => {
                        println!("[ibl.ai] Tokio runtime created, starting server...");
                        rt.block_on(async {
                            start_offline_server_with_signal(cache_for_server, Some(ready_tx))
                                .await;
                        });
                        println!("[ibl.ai] Server exited");
                    }
                    Err(e) => {
                        println!("[ibl.ai] Failed to create tokio runtime: {}", e);
                    }
                }
            });

            // Wait for server to be ready (with timeout)
            match ready_rx.recv_timeout(std::time::Duration::from_secs(5)) {
                Ok(is_ready) => {
                    if is_ready {
                        println!(
                            "[ibl.ai] Offline server started successfully at {}",
                            get_server_url()
                        );
                    } else {
                        println!("[ibl.ai] Offline server failed to start");
                    }
                }
                Err(e) => {
                    println!("[ibl.ai] Timeout waiting for offline server: {}", e);
                }
            }

            // Check network status to decide initial URL
            let app_url = get_app_url();
            println!("[ibl.ai] App URL from config: {}", app_url);
            println!("[ibl.ai] Checking network connectivity to: {}", app_url);

            // Check for TAURI_FORCE_ONLINE env var to skip network check (for debugging)
            let force_online = std::env::var("TAURI_FORCE_ONLINE").is_ok();
            if force_online {
                println!("[ibl.ai] TAURI_FORCE_ONLINE is set, skipping network check");
            }

            // Quick network check - try app URL, then fallback to known services
            let check_network = || -> bool {
                if force_online {
                    return true;
                }

                let client = match reqwest::blocking::Client::builder()
                    .timeout(std::time::Duration::from_secs(2))
                    .connect_timeout(std::time::Duration::from_secs(1))
                    .build()
                {
                    Ok(c) => c,
                    Err(e) => {
                        println!(
                            "[ibl.ai] Failed to create HTTP client: {}, trying fallback",
                            e
                        );
                        return check_internet_fallback();
                    }
                };

                // Try HEAD request to app URL
                println!("[ibl.ai] Checking connectivity to {}...", app_url);
                match client.head(&app_url).send() {
                    Ok(response) => {
                        let status = response.status();
                        let is_ok = status.is_success() || status.is_redirection();
                        println!(
                            "[ibl.ai] App URL check: {} - {}",
                            status,
                            if is_ok { "ONLINE" } else { "trying fallback" }
                        );

                        if is_ok {
                            true
                        } else {
                            // App URL failed, try fallback
                            check_internet_fallback()
                        }
                    }
                    Err(e) => {
                        println!("[ibl.ai] App URL check failed: {}, trying fallback", e);
                        check_internet_fallback()
                    }
                }
            };

            let is_online = check_network();

            println!(
                "[ibl.ai] Network check result: is_online = {} (app_url: {})",
                is_online, app_url
            );

            // Determine initial URL
            let initial_url = if is_online {
                // Online - go directly to the app
                println!("[ibl.ai] ONLINE MODE: Loading from {}", app_url);
                tauri::WebviewUrl::External(app_url.parse().unwrap())
            } else {
                // Offline - use tauri://localhost to allow IPC access
                // The offline shell will be served from the bundled assets
                // API calls will be routed to the HTTP server (localhost:3456) via fetch intercept
                println!("[ibl.ai] OFFLINE MODE: Using tauri://localhost for IPC access");

                // Store the last route for the initialization script to use
                let rt = tokio::runtime::Runtime::new().unwrap();
                let last_route = rt.block_on(async {
                    let storage = get_last_route_storage();
                    let lock = storage.read().await;
                    lock.clone()
                });

                // Try to read from file if not in memory
                let route_file = app_data_dir.join(LAST_ROUTE_FILE);
                println!("[ibl.ai] Checking for saved route at: {:?}", route_file);

                let saved_route = last_route.or_else(|| {
                    std::fs::read_to_string(&route_file)
                        .ok()
                        .map(|r| {
                            let trimmed = r.trim().to_string();
                            println!("[ibl.ai] Found saved route: {}", trimmed);
                            trimmed
                        })
                        .filter(|r| !r.is_empty())
                });

                if let Some(route) = saved_route {
                    println!("[ibl.ai] Will restore route: {}", route);
                    // Store the route in memory for the init script to access
                    // The init script will read this and navigate to it
                } else {
                    println!("[ibl.ai] No saved route, will load root");
                }

                tauri::WebviewUrl::App("index.html".into())
            };

            // Create main window with appropriate URL monitoring script
            let init_script = if is_online {
                println!("[ibl.ai] Using ONLINE initialization script");
                URL_MONITOR_SCRIPT_ONLINE
            } else {
                println!("[ibl.ai] Using OFFLINE initialization script");
                URL_MONITOR_SCRIPT_OFFLINE
            };

            println!("[ibl.ai] Creating main window with URL: {:?}", initial_url);

            // Add localStorage polyfill for offline mode to work around Tauri/WebView2 restrictions
            let storage_polyfill = r#"
(function() {
    // Test if localStorage is accessible
    try {
        localStorage.setItem('__test__', '1');
        localStorage.removeItem('__test__');
        console.log('[Storage] localStorage is accessible');
    } catch (e) {
        console.warn('[Storage] localStorage blocked, using polyfill:', e);

        // Create polyfill using in-memory storage
        const storage = {};
        Object.defineProperty(window, 'localStorage', {
            value: {
                getItem: (key) => storage[key] || null,
                setItem: (key, value) => { storage[key] = String(value); },
                removeItem: (key) => { delete storage[key]; },
                clear: () => { for (let key in storage) delete storage[key]; },
                get length() { return Object.keys(storage).length; },
                key: (i) => Object.keys(storage)[i] || null
            },
            writable: false,
            configurable: false
        });
        console.log('[Storage] localStorage polyfill installed');
    }
})();
            "#;

            let combined_init_script = format!("{}\n{}", storage_polyfill, init_script);

            // Clone app handle for use in on_navigation closure
            let app_handle = app.handle().clone();

            let window = tauri::WebviewWindowBuilder::new(app, "main", initial_url.clone())
                .title("ibl.ai")
                .inner_size(1200.0, 800.0)
                .min_inner_size(800.0, 600.0)
                .maximized(true)
                .center()
                .initialization_script(&combined_init_script)
                .on_navigation(move |url| {
                    let url_str = url.as_str();

                    // Check if this is an OAuth URL - open in popup window
                    if is_oauth_url(url_str) {
                        println!("[ibl.ai] OAuth URL detected, opening in popup: {}", url_str);
                        if let Err(e) = open_oauth_in_popup(url_str, &app_handle) {
                            println!("[ibl.ai] Failed to open OAuth popup: {}", e);
                            return true; // Allow navigation as last resort
                        }
                        return false; // Prevent webview navigation in main window
                    }

                    // Custom-scheme deep links: rewrite to the app URL and navigate the
                    // main window there. The webview can't load iblai-mentor:// directly,
                    // so we intercept here and redirect via window.location.href.
                    //
                    // Desktop only — on mobile (iOS/Android) the OS handles the deep-link
                    // hand-off via the tauri deep-link plugin, so the webview never sees
                    // the custom scheme as an on_navigation event.
                    #[cfg(any(target_os = "macos", target_os = "windows", target_os = "linux"))]
                    {
                        if url_str.starts_with("iblai-mentor://")
                            || url_str.starts_with("ai.ibl.mentorai://")
                        {
                            let path = url_str
                                .replace("iblai-mentor://", "/")
                                .replace("ai.ibl.mentorai://", "/");
                            let target_url = format!("{}{}", get_app_url(), path);
                            println!("[ibl.ai] Rewriting deep-link {} -> {}", url_str, target_url);
                            if let Some(main_win) = app_handle.get_webview_window("main") {
                                let _ = main_win
                                    .eval(&format!("window.location.href = '{}';", target_url));
                            }
                            return false; // Block the deep-link navigation; redirect runs via eval
                        }
                    }

                    // Allow navigation within the app's domains and localhost
                    let allowed = url_str.starts_with("http://localhost")
                        || url_str.starts_with("http://127.0.0.1")
                        || url_str.starts_with("https://mentorai.iblai.app")
                        || url_str.starts_with("https://login.iblai.app")
                        || url_str.starts_with("https://base.manager.iblai.app")
                        || url_str.starts_with("https://base.manager.iblai.org")
                        || url_str.starts_with("https://api.iblai.app")
                        || url_str.starts_with("https://api.iblai.org")
                        || url_str.starts_with("https://learn.iblai.app")
                        || url_str.starts_with("https://learn.iblai.org")
                        || url_str.starts_with("tauri://")
                        || url_str.starts_with("asset://")
                        || url_str.starts_with("mentor://");

                    if !allowed {
                        println!("[ibl.ai] Blocked external navigation to: {}", url_str);
                    }

                    allowed
                })
                .build()
                .expect("Failed to create main window");

            println!("[ibl.ai] Main window created successfully");
            println!(
                "[ibl.ai] Mode: {} | URL: {:?}",
                if is_online { "ONLINE" } else { "OFFLINE" },
                initial_url
            );

            // Set up deep link handler for OAuth callbacks and universal links
            // This handles iblai-mentor:// URL scheme callbacks from system browser OAuth
            #[cfg(target_os = "macos")]
            {
                use tauri_plugin_deep_link::DeepLinkExt;

                // Check for any pending deep links from app launch
                if let Ok(Some(urls)) = app.deep_link().get_current() {
                    println!(
                        "[ibl.ai] Found {} current deep link(s) at launch",
                        urls.len()
                    );
                    let app_handle = app.handle().clone();
                    for url in urls {
                        handle_oauth_deep_link(&app_handle, url.as_str());
                    }
                }

                // Listen for deep link events (from system browser OAuth callback)
                let app_handle_for_deep_link = app.handle().clone();
                app.listen("deep-link://new-url", move |event: tauri::Event| {
                    println!("[ibl.ai] Deep link event received: {}", event.payload());

                    if let Ok(urls) = serde_json::from_str::<Vec<String>>(event.payload()) {
                        println!("[ibl.ai] Parsed {} URL(s) from deep link event", urls.len());
                        for url in urls {
                            println!("[ibl.ai] Processing OAuth callback: {}", url);
                            handle_oauth_deep_link(&app_handle_for_deep_link, &url);
                        }
                    } else {
                        println!("[ibl.ai] Failed to parse deep link URLs from event payload");
                    }
                });

                println!("[ibl.ai] Deep link event listener registered for OAuth callbacks");
            }

            // Keep window reference to prevent it from being dropped
            drop(window);

            Ok(())
        })
        .register_asynchronous_uri_scheme_protocol("mentor", |ctx, request, responder| {
            // Extract the URL path
            // Supports two formats:
            // 1. mentor://fetch/<encoded_url> - fetch from cache
            // 2. mentor://localhost/<path> - proxy to offline server
            let uri = request.uri();
            let path = uri.path().to_string(); // Clone to get 'static lifetime

            println!("[Protocol] mentor:// request - path: {}", path);

            // Handle fetch protocol (original behavior)
            if path.starts_with("/fetch/") {
                let encoded_url = path[7..].to_string(); // Skip "/fetch/"
                let url = match urlencoding::decode(&encoded_url) {
                    Ok(u) => u.to_string(),
                    Err(_) => {
                        responder.respond(
                            http::Response::builder()
                                .status(http::StatusCode::BAD_REQUEST)
                                .body(b"Invalid URL encoding".to_vec())
                                .unwrap(),
                        );
                        return;
                    }
                };

                // Get app handle for accessing cache (unused but kept for future use)
                let _app = ctx.app_handle().clone();

                std::thread::spawn(move || {
                    let rt = tokio::runtime::Runtime::new().unwrap();
                    rt.block_on(async {
                        let cache_lock = get_web_cache().read().await;
                        if let Some(cache) = cache_lock.as_ref() {
                            match cache.fetch(&url).await {
                                Ok(response) => {
                                    let mut builder = http::Response::builder()
                                        .status(response.status)
                                        .header("Content-Type", response.content_type);

                                    // Add CORS headers to allow the shell to access
                                    builder = builder
                                        .header("Access-Control-Allow-Origin", "*")
                                        .header("Access-Control-Allow-Methods", "GET, OPTIONS")
                                        .header("Access-Control-Allow-Headers", "*");

                                    responder.respond(builder.body(response.body).unwrap());
                                }
                                Err(e) => {
                                    responder.respond(
                                        http::Response::builder()
                                            .status(http::StatusCode::SERVICE_UNAVAILABLE)
                                            .header("Content-Type", "application/json")
                                            .body(
                                                format!(
                                                    r#"{{"error": "{}",  "offline": true}}"#,
                                                    e.replace('"', "\\\"")
                                                )
                                                .into_bytes(),
                                            )
                                            .unwrap(),
                                    );
                                }
                            }
                        } else {
                            responder.respond(
                                http::Response::builder()
                                    .status(http::StatusCode::INTERNAL_SERVER_ERROR)
                                    .body(b"Cache not initialized".to_vec())
                                    .unwrap(),
                            );
                        }
                    });
                });
            } else {
                // Handle mentor://localhost/<path> - proxy to offline HTTP server
                // This allows the app to stay on mentor:// origin while loading content from offline server
                println!("[Protocol] Proxying to offline server: {}", path);

                std::thread::spawn(move || {
                    let offline_server_url = format!("http://127.0.0.1:3457{}", path);
                    println!(
                        "[Protocol] Fetching from offline server: {}",
                        offline_server_url
                    );

                    let rt = tokio::runtime::Runtime::new().unwrap();
                    rt.block_on(async {
                        match reqwest::get(&offline_server_url).await {
                            Ok(response) => {
                                let status = response.status();
                                let content_type = response
                                    .headers()
                                    .get("content-type")
                                    .and_then(|v| v.to_str().ok())
                                    .unwrap_or("text/html")
                                    .to_string();

                                match response.bytes().await {
                                    Ok(body) => {
                                        println!(
                                            "[Protocol] Got {} bytes with content-type: {}",
                                            body.len(),
                                            content_type
                                        );

                                        let mut builder = http::Response::builder()
                                            .status(status.as_u16())
                                            .header("Content-Type", content_type);

                                        // Add CORS headers
                                        builder = builder
                                            .header("Access-Control-Allow-Origin", "*")
                                            .header(
                                                "Access-Control-Allow-Methods",
                                                "GET, POST, PUT, DELETE, OPTIONS",
                                            )
                                            .header("Access-Control-Allow-Headers", "*");

                                        responder.respond(builder.body(body.to_vec()).unwrap());
                                    }
                                    Err(e) => {
                                        println!("[Protocol] Failed to read response body: {}", e);
                                        responder.respond(
                                            http::Response::builder()
                                                .status(http::StatusCode::INTERNAL_SERVER_ERROR)
                                                .body(
                                                    format!("Failed to read response: {}", e)
                                                        .into_bytes(),
                                                )
                                                .unwrap(),
                                        );
                                    }
                                }
                            }
                            Err(e) => {
                                println!("[Protocol] Failed to fetch from offline server: {}", e);
                                responder.respond(
                                    http::Response::builder()
                                        .status(http::StatusCode::SERVICE_UNAVAILABLE)
                                        .body(
                                            format!("Offline server not available: {}", e)
                                                .into_bytes(),
                                        )
                                        .unwrap(),
                                );
                            }
                        }
                    });
                });
            }
        })
        .invoke_handler(tauri::generate_handler![
            install_ollama,
            stop_ollama,
            check_ollama_status,
            check_foundry_local_status,
            start_foundry_local_service,
            load_foundry_local_model,
            set_selected_foundry_model,
            get_selected_foundry_model,
            install_foundry,
            download_foundry_model_cmd,
            get_recommended_foundry_models,
            check_disk_space_for_model,
            get_system_memory,
            download_phi3_model,
            download_model,
            cancel_model_download,
            check_network_status,
            set_cache_online_status,
            clear_web_cache,
            get_web_cache_stats,
            get_offline_server_url,
            is_offline_server_ready,
            precache_app,
            cache_images,
            save_last_mentor_route,
            get_last_mentor_route,
            cache_api_response,
            get_cached_api_response,
            save_offline_context,
            get_offline_context,
            get_os_type,
            ollama_chat,
            ollama_chat_stream,
            oauth::oauth_start,
            oauth::oauth_callback,
            oauth::oauth_get_result,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri app");
}
