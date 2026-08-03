//! Install / status / stop for **GhostOS** (https://github.com/ghostwright/ghost-os),
//! the native macOS device-control tool that backs the "Cowork" card in
//! User Profile → Advanced.
//!
//! GhostOS is distributed via Homebrew, so installation is `brew install` of the
//! `ghostwright/ghost-os/ghost-os` formula (the tap is implied by the formula
//! name). We deliberately DO NOT run `ghost setup`: the macOS Accessibility
//! permission GhostOS needs is requested by the app itself via
//! `tauri-plugin-macos-permissions` (the Cowork card's "Grant Access"
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

/// Pinned GhostOS release used by the no-Homebrew fallback.
#[cfg(target_os = "macos")]
const GHOST_VERSION: &str = "2.2.1";

/// Status reported to the Cowork card. Field names match what the SDK
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
/// directories and `~/.local/bin` (a GUI app's PATH often omits them, and the
/// no-Homebrew fallback installs to `~/.local/bin`, which may not be on PATH).
/// Returns `None` if missing.
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

    let mut bases: Vec<std::path::PathBuf> = vec![
        std::path::PathBuf::from("/opt/homebrew/bin"),
        std::path::PathBuf::from("/usr/local/bin"),
    ];
    if let Some(home) = home_dir() {
        bases.push(home.join(".local").join("bin"));
    }
    for base in bases {
        let p = base.join(name);
        if p.exists() {
            return Some(p.to_string_lossy().into_owned());
        }
    }
    None
}

/// Home directory (`$HOME`).
#[cfg(target_os = "macos")]
fn home_dir() -> Option<std::path::PathBuf> {
    std::env::var("HOME").ok().map(std::path::PathBuf::from)
}

/// Find `name` directly under `dir`, or one level deep (the tarball may unpack
/// into a versioned subfolder).
#[cfg(target_os = "macos")]
fn locate(dir: &Path, name: &str) -> Option<std::path::PathBuf> {
    let direct = dir.join(name);
    if direct.is_file() {
        return Some(direct);
    }
    for entry in std::fs::read_dir(dir).ok()?.flatten() {
        let candidate = entry.path().join(name);
        if candidate.is_file() {
            return Some(candidate);
        }
    }
    None
}

/// No-Homebrew fallback: install the prebuilt `ghost` + `ghost-vision` binaries
/// from the GitHub release into `~/.local/bin` (user-writable — no sudo, no
/// brew). Both land side-by-side so `ghost` finds its `ghost-vision` sidecar
/// without `~/.local/bin` being on `$PATH`; `resolve_bin` also looks there and
/// the bridge launches `ghost` by absolute path. Apple Silicon only (the only
/// released macOS arch).
#[cfg(target_os = "macos")]
fn install_ghost_from_release(app: &AppHandle) -> Result<(), String> {
    use std::os::unix::fs::PermissionsExt;

    let asset_arch = match std::env::consts::ARCH {
        "aarch64" => "arm64",
        other => {
            return Err(format!(
                "No prebuilt GhostOS build for {other}; install Homebrew (https://brew.sh) and try again"
            ))
        }
    };

    let home = home_dir().ok_or("Could not resolve the home directory")?;
    let bin_dir = home.join(".local").join("bin");
    std::fs::create_dir_all(&bin_dir)
        .map_err(|e| format!("Failed to create {}: {e}", bin_dir.display()))?;

    let url = format!(
        "https://github.com/ghostwright/ghost-os/releases/download/v{GHOST_VERSION}/ghost-os-{GHOST_VERSION}-macos-{asset_arch}.tar.gz"
    );

    // Extract into a temp dir, then place only the two binaries in ~/.local/bin.
    let tmp = std::env::temp_dir().join(format!("ghost-os-{GHOST_VERSION}"));
    let _ = std::fs::remove_dir_all(&tmp);
    std::fs::create_dir_all(&tmp).map_err(|e| format!("Failed to create temp dir: {e}"))?;

    emit_progress(app, "installing", 30.0, "Downloading the assistant…");
    emit_log(app, "info", format!("Downloading {url}"));
    let status = Command::new("sh")
        .arg("-c")
        .arg(format!("curl -fsSL '{url}' | tar xz"))
        .current_dir(&tmp)
        .status()
        .map_err(|e| format!("Failed to download/extract: {e}"))?;
    if !status.success() {
        return Err(format!("Download/extract failed (exit {:?})", status.code()));
    }

    emit_progress(app, "installing", 80.0, "Installing to ~/.local/bin…");
    for name in ["ghost", "ghost-vision"] {
        let src = locate(&tmp, name)
            .ok_or_else(|| format!("'{name}' was not in the downloaded archive"))?;
        let dst = bin_dir.join(name);
        std::fs::copy(&src, &dst).map_err(|e| format!("Failed to install {name}: {e}"))?;
        let _ = std::fs::set_permissions(&dst, std::fs::Permissions::from_mode(0o755));
        emit_log(app, "info", format!("Installed {}", dst.display()));
    }
    Ok(())
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

/// Snapshot current GhostOS state: installed (binary present), ready, and
/// version (`ghost --version`).
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

    // GhostOS is an on-demand stdio MCP server — the client (the bridge) spawns
    // `ghost mcp` only while a tool call is in flight, so there is no persistent
    // process to poll for. "running" therefore means "ready to use" == installed;
    // otherwise the card would sit on "Starting…" forever.
    GhostOsStatus {
        installed,
        running: installed,
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
        return Err("Cowork (GhostOS) is only available on macOS".to_string());
    }

    #[cfg(target_os = "macos")]
    {
        emit_progress(&app, "installing", 5.0, "Preparing install…");
        emit_log(&app, "info", "Starting GhostOS install");

        if resolve_bin("ghost").is_some() {
            emit_log(&app, "info", "GhostOS already present; ensuring it's up to date");
        }

        // Prefer Homebrew; if it's absent, install the prebuilt binaries from the
        // GitHub release into ~/.local/bin (no sudo / brew required).
        match resolve_bin("brew") {
            Some(brew) => {
                emit_progress(&app, "installing", 20.0, "Installing ghostwright/ghost-os…");
                emit_log(&app, "info", format!("Running: {brew} install {BREW_FORMULA}"));

                let mut child = Command::new(&brew)
                    .args(["install", BREW_FORMULA])
                    // Non-interactive — "ask mode" is on by default and would block
                    // on a "proceed?" prompt under an inherited TTY (e.g. `tauri
                    // dev`); older brew ignores `HOMEBREW_NO_ASK` harmlessly.
                    .env("HOMEBREW_NO_AUTO_UPDATE", "1")
                    .env("HOMEBREW_NO_ENV_HINTS", "1")
                    .env("HOMEBREW_NO_ASK", "1")
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
            }
            None => {
                emit_log(
                    &app,
                    "info",
                    "Homebrew not found; installing the prebuilt binaries to ~/.local/bin",
                );
                install_ghost_from_release(&app)?;
            }
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
        Ok("GhostOS installed".to_string())
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
