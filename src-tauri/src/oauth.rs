use tauri::command;
use std::sync::{Arc, Mutex};
use tauri::AppHandle;

// Global storage for OAuth callback result
static OAUTH_RESULT: std::sync::OnceLock<Arc<Mutex<Option<String>>>> = std::sync::OnceLock::new();

/// Initiates OAuth flow by opening the URL in the system browser
/// The callback will be handled by the deep link plugin
#[command]
pub fn oauth_start(_app_handle: AppHandle, url: String) -> Result<(), String> {
    // Initialize OAuth result storage
    OAUTH_RESULT.get_or_init(|| Arc::new(Mutex::new(None)));

    // Clear any previous result
    if let Some(result_lock) = OAUTH_RESULT.get() {
        *result_lock.lock().unwrap() = None;
    }

    // Open URL in system browser
    // On iOS this will use ASWebAuthenticationSession if configured properly in Info.plist
    // On Android this will use Chrome Custom Tabs
    tauri_plugin_opener::open_url(&url, None::<&str>)
        .map_err(|e| format!("Failed to open OAuth URL: {}", e))?;

    Ok(())
}

/// Stores the OAuth callback result (called by deep link handler)
#[command]
pub fn oauth_callback(callback_url: String) -> Result<(), String> {
    if let Some(result_lock) = OAUTH_RESULT.get() {
        *result_lock.lock().unwrap() = Some(callback_url);
        Ok(())
    } else {
        Err("OAuth not initialized".to_string())
    }
}

/// Gets the OAuth callback result (polling from frontend)
#[command]
pub fn oauth_get_result() -> Option<String> {
    if let Some(result_lock) = OAUTH_RESULT.get() {
        result_lock.lock().unwrap().take()
    } else {
        None
    }
}
