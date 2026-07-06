//! Installs the `ollama-mcp-bridge` (https://github.com/jonigl/ollama-mcp-bridge)
//! so locally-installed Ollama models can call MCP tools.
//!
//! The bridge is a Python CLI distributed on PyPI as `ollama-mcp-bridge` and is
//! installed with `uv tool install`, which also makes the `ollama-mcp-bridge`
//! executable available on the user's PATH. This module first ensures `uv`
//! itself is present — preferring the platform package manager (Homebrew on
//! macOS, pacman on Arch, dnf on Fedora) and falling back to the official
//! Astral install script as a last resort.

#[cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]
use std::path::{Path, PathBuf};
#[cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]
use std::process::Command;
#[cfg(target_os = "linux")]
use crate::model_manager::can_sudo;

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

/// Home directory, mirroring the `HOME`/`USERPROFILE` convention used elsewhere
/// in the crate (model_manager).
#[cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]
fn home_dir() -> Option<PathBuf> {
    #[cfg(target_os = "windows")]
    let var = "USERPROFILE";
    #[cfg(not(target_os = "windows"))]
    let var = "HOME";

    std::env::var(var).ok().map(PathBuf::from)
}

/// Return a runnable path to `uv` if it is already installed.
///
/// A freshly installed `uv` is frequently not yet on this process's PATH (the
/// Astral script drops it in `~/.local/bin`, Homebrew in `/opt/homebrew/bin`),
/// so we probe PATH first and then the well-known install locations.
#[cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]
fn resolve_uv() -> Option<String> {
    let runs = |program: &str| -> bool {
        create_command(program)
            .arg("--version")
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
    };

    // On PATH already?
    if runs("uv") {
        return Some("uv".to_string());
    }

    // Well-known install locations.
    let mut candidates: Vec<PathBuf> = Vec::new();
    if let Some(home) = home_dir() {
        #[cfg(target_os = "windows")]
        {
            candidates.push(home.join(".local").join("bin").join("uv.exe"));
        }
        #[cfg(not(target_os = "windows"))]
        {
            candidates.push(home.join(".local/bin/uv"));
            candidates.push(home.join(".cargo/bin/uv"));
        }
    }
    #[cfg(target_os = "macos")]
    {
        candidates.push(PathBuf::from("/opt/homebrew/bin/uv"));
        candidates.push(PathBuf::from("/usr/local/bin/uv"));
    }

    candidates
        .into_iter()
        .find(|p| p.exists())
        .map(|p| p.to_string_lossy().into_owned())
}

/// Ensure `uv` is installed and return a runnable path to it.
#[cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]
fn ensure_uv_installed() -> Result<String, String> {
    if let Some(uv) = resolve_uv() {
        println!("[McpBridge] uv already installed ({uv})");
        return Ok(uv);
    }

    // macOS — Homebrew.
    #[cfg(target_os = "macos")]
    {
        if Path::new("/opt/homebrew/bin/brew").exists() || Path::new("/usr/local/bin/brew").exists() {
            println!("[McpBridge] Installing uv via Homebrew...");
            let _ = create_command("brew").args(["install", "uv"]).status();
            if let Some(uv) = resolve_uv() {
                return Ok(uv);
            }
        }
    }

    // Linux — distro package manager via non-interactive sudo.
    #[cfg(target_os = "linux")]
    {
        let sudo_ok = can_sudo();
        if sudo_ok && Path::new("/usr/bin/pacman").exists() {
            // Arch Linux
            println!("[McpBridge] Installing uv via pacman...");
            let _ = create_command("sudo")
                .args(["pacman", "-Sy", "uv", "--noconfirm"])
                .status();
        } else if sudo_ok && Path::new("/usr/bin/dnf").exists() {
            // Fedora / RHEL family
            println!("[McpBridge] Installing uv via dnf...");
            let _ = create_command("sudo").args(["dnf", "install", "uv", "-y"]).status();
        }
        if let Some(uv) = resolve_uv() {
            return Ok(uv);
        }
    }

    // Last resort — the official Astral install script.
    #[cfg(any(target_os = "macos", target_os = "linux"))]
    {
        println!("[McpBridge] Installing uv via Astral install script...");
        let status = create_command("sh")
            .arg("-c")
            .arg("curl -LsSf https://astral.sh/uv/install.sh | sh")
            .status()
            .map_err(|e| format!("Failed to run uv install script: {e}"))?;
        if !status.success() {
            return Err(format!("uv install script failed (exit {:?})", status.code()));
        }
    }

    #[cfg(target_os = "windows")]
    {
        println!("[McpBridge] Installing uv via Astral install script (PowerShell)...");
        let status = create_command("powershell")
            .args([
                "-NoProfile",
                "-ExecutionPolicy",
                "ByPass",
                "-Command",
                "irm https://astral.sh/uv/install.ps1 | iex",
            ])
            .status()
            .map_err(|e| format!("Failed to run uv install script: {e}"))?;
        if !status.success() {
            return Err(format!("uv install script failed (exit {:?})", status.code()));
        }
    }

    resolve_uv().ok_or_else(|| "uv was installed but could not be located".to_string())
}

/// Install (or upgrade) the `ollama-mcp-bridge` CLI via `uv tool install`,
/// installing `uv` first if necessary. Idempotent.
pub async fn install_mcp_bridge() -> Result<(), String> {
    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        return Err("ollama-mcp-bridge is not supported on this platform".to_string());
    }

    #[cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]
    {
        let uv = ensure_uv_installed()?;

        println!("[McpBridge] Installing ollama-mcp-bridge via uv tool install...");
        let status = create_command(&uv)
            .args(["tool", "install", "--upgrade", "ollama-mcp-bridge"])
            .status()
            .map_err(|e| format!("Failed to run uv: {e}"))?;

        if !status.success() {
            return Err(format!(
                "uv tool install ollama-mcp-bridge failed (exit {:?})",
                status.code()
            ));
        }

        println!("[McpBridge] ollama-mcp-bridge installed");
        Ok(())
    }
}
