//! Install / status / stop for **GhostOS** (https://github.com/ghostwright/ghost-os),
//! the native macOS system-control tool that backs the "System Control Manager"
//! card in User Profile → Advanced.
//!
//! GhostOS is distributed via Homebrew, so installation is `brew install` of the
//! `ghostwright/ghost-os/ghost-os` formula (the tap is implied by the formula
//! name). We deliberately DO NOT run `ghost setup`: the macOS Accessibility
//! permission GhostOS needs is requested by the app itself via
//! `tauri-plugin-macos-permissions` (the System Control card's "Grant Access"
//! button), so the app — not `ghost setup` — owns that flow.
//!
//! The command/event names here match the SDK contract (`GHOST_OS_TAURI_COMMANDS`
//! / `GHOST_OS_TAURI_EVENTS` in `@iblai/iblai-js`).

use serde::Serialize;
use tauri::{command, AppHandle, Emitter};

#[cfg(target_os = "macos")]
use std::io::{BufRead, BufReader, Read};
#[cfg(target_os = "macos")]
use std::path::Path;
#[cfg(target_os = "macos")]
use std::process::{Command, Stdio};

#[cfg(target_os = "macos")]
use crate::model_manager::{get_timestamp, InstallationLog};

#[cfg(target_os = "macos")]
const EVENT_INSTALL_PROGRESS: &str = "ghost-os:install-progress";
#[cfg(target_os = "macos")]
const EVENT_INSTALLATION_LOG: &str = "ghost-os:installation-log";
#[cfg(target_os = "macos")]
const EVENT_STATUS: &str = "ghost-os:status";

/// Homebrew formula. The `user/tap/formula` form taps automatically.
#[cfg(target_os = "macos")]
const BREW_FORMULA: &str = "ghostwright/ghost-os/ghost-os";

/// Status reported to the System Control card. Field names match what the SDK
/// reads (`installed`, `running`, `installing`, `version`).
#[derive(Clone, Serialize)]
pub struct GhostOsStatus {
    pub installed: bool,
    pub running: bool,
    pub installing: bool,
    pub version: Option<String>,
}

/// Payload for `ghost-os:install-progress`. `status` is one of
/// `installing` | `completed` | `error` (anything else is treated as installing).
#[derive(Clone, Serialize)]
struct InstallProgress {
    status: String,
    percentage: f64,
    message: String,
}

// ---------------------------------------------------------------------------
// macOS helpers
// ---------------------------------------------------------------------------

/// Resolve an executable by name, probing PATH first then the Homebrew bin
/// directories (a GUI app's PATH often omits them). Returns `None` if missing.
#[cfg(target_os = "macos")]
fn resolve_bin(name: &str) -> Option<String> {
    let on_path = Command::new(name)
        .arg("--version")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false);
    if on_path {
        return Some(name.to_string());
    }

    for base in ["/opt/homebrew/bin", "/usr/local/bin"] {
        let p = Path::new(base).join(name);
        if p.exists() {
            return Some(p.to_string_lossy().into_owned());
        }
    }
    None
}

#[cfg(target_os = "macos")]
fn emit_log(app: &AppHandle, level: &str, message: impl Into<String>) {
    let message = message.into();
    println!("[GhostOS] {message}");
    let _ = app.emit(
        EVENT_INSTALLATION_LOG,
        InstallationLog {
            timestamp: get_timestamp(),
            level: level.to_string(),
            message,
        },
    );
}

#[cfg(target_os = "macos")]
fn emit_progress(app: &AppHandle, status: &str, percentage: f64, message: &str) {
    let _ = app.emit(
        EVENT_INSTALL_PROGRESS,
        InstallProgress {
            status: status.to_string(),
            percentage,
            message: message.to_string(),
        },
    );
}

/// Snapshot current GhostOS state: installed (binary present), running (a `ghost`
/// MCP process is alive) and version (`ghost --version`).
#[cfg(target_os = "macos")]
fn compute_status() -> GhostOsStatus {
    let bin = resolve_bin("ghost");
    let installed = bin.is_some();

    let version = bin.as_ref().and_then(|b| {
        Command::new(b)
            .arg("--version")
            .output()
            .ok()
            .filter(|o| o.status.success())
            .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
            .filter(|s| !s.is_empty())
    });

    // `-x` matches the process name exactly so we don't catch `ghost-vision`
    // or unrelated processes.
    let running = Command::new("pgrep")
        .args(["-x", "ghost"])
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false);

    GhostOsStatus {
        installed,
        running,
        installing: false,
        version,
    }
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

/// Install GhostOS via Homebrew. Streams brew output as `installation-log`
/// events and coarse `install-progress` updates. Does NOT run `ghost setup`.
#[command]
pub async fn install_ghost_os(app: AppHandle) -> Result<String, String> {
    #[cfg(not(target_os = "macos"))]
    {
        let _ = app;
        return Err("System Control (GhostOS) is only available on macOS".to_string());
    }

    #[cfg(target_os = "macos")]
    {
        emit_progress(&app, "installing", 5.0, "Preparing Homebrew…");
        emit_log(&app, "info", "Starting GhostOS install via Homebrew");

        let brew = resolve_bin("brew").ok_or_else(|| {
            "Homebrew not found. Install it from https://brew.sh and try again.".to_string()
        })?;

        if resolve_bin("ghost").is_some() {
            emit_log(&app, "info", "GhostOS already present; ensuring it's up to date");
        }

        emit_progress(&app, "installing", 20.0, "Installing ghostwright/ghost-os…");
        emit_log(&app, "info", format!("Running: {brew} install {BREW_FORMULA}"));

        let mut child = Command::new(&brew)
            .args(["install", BREW_FORMULA])
            // Keep the install fast and quiet; we don't want a full tap auto-update.
            .env("HOMEBREW_NO_AUTO_UPDATE", "1")
            .env("HOMEBREW_NO_ENV_HINTS", "1")
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| format!("Failed to run brew: {e}"))?;

        // Stream stdout line-by-line as logs.
        if let Some(out) = child.stdout.take() {
            for line in BufReader::new(out).lines().map_while(Result::ok) {
                emit_log(&app, "info", line);
            }
        }

        let status = child
            .wait()
            .map_err(|e| format!("Failed to wait for brew: {e}"))?;

        if !status.success() {
            let mut stderr = String::new();
            if let Some(mut se) = child.stderr {
                let _ = se.read_to_string(&mut stderr);
            }
            let stderr = stderr.trim();
            emit_progress(&app, "error", 100.0, "Homebrew install failed");
            return Err(format!(
                "brew install {BREW_FORMULA} failed (exit {:?}).{}",
                status.code(),
                if stderr.is_empty() {
                    String::new()
                } else {
                    format!(" {stderr}")
                }
            ));
        }

        // Intentionally NOT running `ghost setup` — the app requests Accessibility
        // permission itself via tauri-plugin-macos-permissions.
        emit_log(
            &app,
            "info",
            "GhostOS installed. Skipped 'ghost setup' — Accessibility is granted from the app.",
        );
        emit_progress(&app, "completed", 100.0, "GhostOS installed");

        let _ = app.emit(EVENT_STATUS, &compute_status());
        Ok("GhostOS installed via Homebrew".to_string())
    }
}

/// Stop any running GhostOS processes (best-effort).
#[command]
pub async fn stop_ghost_os(app: AppHandle) -> Result<(), String> {
    #[cfg(not(target_os = "macos"))]
    {
        let _ = app;
        Ok(())
    }

    #[cfg(target_os = "macos")]
    {
        let _ = Command::new("pkill").args(["-x", "ghost"]).output();
        let _ = Command::new("pkill").args(["-x", "ghost-vision"]).output();
        let _ = app.emit(EVENT_STATUS, &compute_status());
        Ok(())
    }
}

/// Report current GhostOS status and broadcast it on `ghost-os:status`.
#[command]
pub async fn check_ghost_os_status(app: AppHandle) -> Result<GhostOsStatus, String> {
    #[cfg(not(target_os = "macos"))]
    {
        let _ = app;
        Ok(GhostOsStatus {
            installed: false,
            running: false,
            installing: false,
            version: None,
        })
    }

    #[cfg(target_os = "macos")]
    {
        let status = compute_status();
        let _ = app.emit(EVENT_STATUS, &status);
        Ok(status)
    }
}
