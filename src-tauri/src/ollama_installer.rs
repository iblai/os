#[cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]
use std::fs;
#[cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]
use std::path::Path;
#[cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]
use std::process::Command;
#[cfg(target_os = "linux")]
use crate::model_manager::can_sudo;

/// Create a Command with hidden console window on Windows
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

/// Install Ollama from the macOS DMG into /Applications. Best-effort: never
/// propagates errors — returns whether `/Applications/Ollama.app` ended up
/// present, so the caller can fall through to the install script on failure.
#[cfg(target_os = "macos")]
async fn install_macos_dmg() -> bool {
    let dmg_url = "https://ollama.com/download/Ollama.dmg";
    let dmg_path = "/tmp/Ollama.dmg";

    // Only download if not already cached.
    if !Path::new(dmg_path).exists() {
        println!("[Ollama] Downloading DMG from {}", dmg_url);
        let resp = match reqwest::get(dmg_url).await {
            Ok(r) => r,
            Err(e) => {
                println!("[Ollama] DMG download failed: {e}");
                return false;
            }
        };
        let bytes = match resp.bytes().await {
            Ok(b) => b,
            Err(e) => {
                println!("[Ollama] DMG download failed: {e}");
                return false;
            }
        };
        if let Err(e) = fs::write(dmg_path, bytes) {
            println!("[Ollama] Failed to write DMG: {e}");
            return false;
        }
        println!("[Ollama] DMG downloaded to {}", dmg_path);
    } else {
        println!("[Ollama] DMG already exists at {}", dmg_path);
    }

    println!("[Ollama] Mounting DMG...");
    let _ = create_command("hdiutil").args(["attach", dmg_path]).output();

    println!("[Ollama] Copying to /Applications...");
    let _ = create_command("cp")
        .args(["-R", "/Volumes/Ollama/Ollama.app", "/Applications"])
        .output();

    println!("[Ollama] Unmounting DMG...");
    let _ = create_command("hdiutil")
        .args(["detach", "/Volumes/Ollama"])
        .output();

    // Success iff the app actually landed.
    Path::new("/Applications/Ollama.app").exists()
}

/// Downloads and installs Ollama depending on the operating system.
/// This function is OS-aware and runs installers silently where possible.
pub async fn download_and_install_ollama() -> Result<(), String> {

    // Mobile platforms don't support Ollama installation
    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        return Err("Ollama installation is not supported on this platform".to_string());
    }

    // =========================
    // WINDOWS
    // =========================
    #[cfg(target_os = "windows")]
    {
        let installer_url = "https://ollama.com/download/OllamaSetup.exe";
        let installer_path = "C:\\Users\\Public\\ollama_installer.exe";

        // Only download if not already present
        if !Path::new(installer_path).exists() {
            println!("[Ollama] Downloading installer...");
            let bytes = reqwest::get(installer_url)
                .await
                .map_err(|e| e.to_string())?
                .bytes()
                .await
                .map_err(|e| e.to_string())?;

            fs::write(installer_path, bytes)
                .map_err(|e| e.to_string())?;
            println!("[Ollama] Installer download complete");
        } else {
            println!("[Ollama] Using cached installer");
        }

        // Run installer silently and wait for it to complete
        println!("[Ollama] Installing...");
        let status = create_command(installer_path)
            .args(["/S"])
            .status()
            .map_err(|e| e.to_string())?;

        if !status.success() {
            return Err(format!("Ollama installer failed with exit code: {:?}", status.code()));
        }
        println!("[Ollama] Installation complete");
    }

    // =========================
    // MACOS
    // =========================
    #[cfg(target_os = "macos")]
    {
        // 1) Prefer Homebrew whenever it's present — matches how many users
        //    manage Ollama and avoids a duplicate /Applications/Ollama.app over an
        //    existing `brew install ollama`.
        let brew = ["/opt/homebrew/bin/brew", "/usr/local/bin/brew"]
            .into_iter()
            .find(|p| Path::new(p).exists());
        if let Some(brew) = brew {
            println!("[Ollama] Installing via Homebrew (brew install ollama)...");
            let ok = create_command(brew)
                .args(["install", "ollama"])
                // Non-interactive: Homebrew "ask mode" is on by default and
                // would block on a "proceed?" prompt when spawned with an
                // inherited TTY (e.g. under `tauri dev`). `HOMEBREW_NO_ASK`
                // disables it; older brew without ask mode ignores it harmlessly.
                .env("HOMEBREW_NO_ASK", "1")
                .env("HOMEBREW_NO_AUTO_UPDATE", "1")
                .status()
                .map(|s| s.success())
                .unwrap_or(false);
            if ok {
                println!("[Ollama] Installed via Homebrew");
                return Ok(());
            }
            println!("[Ollama] Homebrew install failed; trying the DMG");
        }

        // 2) DMG → /Applications/Ollama.app. Falls through to the install script
        //    on any failure rather than aborting.
        if install_macos_dmg().await {
            println!("[Ollama] Installation complete (DMG)");
            return Ok(());
        }
        println!("[Ollama] DMG install failed; falling back to the install script");

        // 3) Last resort: the official install script. On macOS it downloads
        //    Ollama-darwin.zip and installs /Applications/Ollama.app. (The
        //    /usr/local/bin symlink step may want sudo and is skipped when run
        //    non-interactively — the app still works and we launch it with
        //    `open -a Ollama`.)
        println!("[Ollama] Installing via install script (curl -fsSL https://ollama.com/install.sh | sh)...");
        let status = create_command("sh")
            .arg("-c")
            .arg("curl -fsSL https://ollama.com/install.sh | sh")
            .status()
            .map_err(|e| e.to_string())?;
        if !status.success() {
            return Err(format!("Ollama install failed (exit {:?})", status.code()));
        }

        println!("[Ollama] Installation complete");
    }

    // =========================
    // LINUX
    // =========================
    #[cfg(target_os = "linux")]
    {
        // Prefer the distro package manager via sudo (bypassing the upstream
        // install script), but only when sudo is non-interactive. If sudo isn't
        // available, the package manager isn't present, or the install fails,
        // fall back to the upstream script.
        let sudo_ok = can_sudo();
        let has_pacman = Path::new("/usr/bin/pacman").exists();
        let has_dnf = Path::new("/usr/bin/dnf").exists();

        let installed_via_pkg = if sudo_ok && has_pacman {
            // Arch Linux
            println!("[Ollama] Installing via pacman...");
            create_command("sudo")
                .args(["pacman", "-Sy", "ollama", "--noconfirm"])
                .status()
                .map(|s| s.success())
                .unwrap_or(false)
        } else if sudo_ok && has_dnf {
            // Fedora / RHEL family
            println!("[Ollama] Installing via dnf...");
            create_command("sudo")
                .args(["dnf", "install", "ollama", "-y"])
                .status()
                .map(|s| s.success())
                .unwrap_or(false)
        } else {
            false
        };

        if !installed_via_pkg {
            println!("[Ollama] Installing via upstream script...");
            let status = create_command("sh")
                .arg("-c")
                .arg("curl -fsSL https://ollama.com/install.sh | sh")
                .status()
                .map_err(|e| e.to_string())?;
            if !status.success() {
                return Err(format!(
                    "Ollama install failed (exit {:?})",
                    status.code()
                ));
            }
        }
    }

    #[cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]
    Ok(())
}
