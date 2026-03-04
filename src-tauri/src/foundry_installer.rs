use std::process::{Command, Stdio};
use std::io::{BufRead, BufReader};
use tauri::{Window, Emitter};

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

/// Installs Microsoft Foundry Local using winget
/// Supports Windows and macOS
pub async fn download_and_install_foundry() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        println!("[FoundryInstaller] Starting Foundry Local installation via winget...");

        // Use winget to install Foundry Local
        // winget is built into Windows 10/11 by default
        let output = create_command("winget")
            .args([
                "install",
                "Microsoft.FoundryLocal",
                "--accept-package-agreements",
                "--accept-source-agreements",
                "--silent",
            ])
            .output()
            .map_err(|e| format!("Failed to run winget: {}. Make sure winget is available on this system.", e))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            let stdout = String::from_utf8_lossy(&output.stdout);
            return Err(format!(
                "Foundry installation via winget failed.\nStdout: {}\nStderr: {}",
                stdout, stderr
            ));
        }

        let stdout = String::from_utf8_lossy(&output.stdout);
        println!("[FoundryInstaller] Installation output: {}", stdout);

        // Verify installation
        println!("[FoundryInstaller] Verifying installation...");
        tokio::time::sleep(tokio::time::Duration::from_secs(3)).await; // Wait for installation to complete

        let verify_status = create_command("foundry")
            .arg("--version")
            .output();

        match verify_status {
            Ok(output) if output.status.success() => {
                let version = String::from_utf8_lossy(&output.stdout);
                println!("[FoundryInstaller] Foundry Local installed successfully: {}", version.trim());
                Ok(())
            }
            _ => {
                println!("[FoundryInstaller] Warning: Installation completed but foundry command not immediately available");
                println!("[FoundryInstaller] User may need to restart terminal or refresh PATH");
                Ok(()) // Don't fail, might just need PATH refresh
            }
        }
    }

    #[cfg(target_os = "macos")]
    {
        println!("[FoundryInstaller] Starting Foundry Local installation via Homebrew...");

        // First tap the Microsoft Foundry repository
        println!("[FoundryInstaller] Adding Homebrew tap...");
        let tap_output = create_command("brew")
            .args(["tap", "microsoft/foundrylocal"])
            .output()
            .map_err(|e| format!("Failed to run brew tap: {}. Make sure Homebrew is installed.", e))?;

        if !tap_output.status.success() {
            let stderr = String::from_utf8_lossy(&tap_output.stderr);
            return Err(format!("Failed to tap microsoft/foundrylocal: {}", stderr));
        }

        // Install Foundry Local
        println!("[FoundryInstaller] Installing foundrylocal...");
        let install_output = create_command("brew")
            .args(["install", "foundrylocal"])
            .output()
            .map_err(|e| format!("Failed to run brew install: {}", e))?;

        if !install_output.status.success() {
            let stderr = String::from_utf8_lossy(&install_output.stderr);
            return Err(format!("Failed to install foundrylocal: {}", stderr));
        }

        // Verify installation
        println!("[FoundryInstaller] Verifying installation...");
        let verify_status = create_command("foundry")
            .arg("--version")
            .output();

        match verify_status {
            Ok(output) if output.status.success() => {
                let version = String::from_utf8_lossy(&output.stdout);
                println!("[FoundryInstaller] Foundry Local installed successfully: {}", version.trim());
                Ok(())
            }
            _ => {
                Err("Installation completed but foundry command not available. Please restart your terminal.".to_string())
            }
        }
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        Err("Foundry Local is only available for Windows and macOS".to_string())
    }
}

/// Download a specific Foundry model
/// Uses `foundry model download` to download a model with progress tracking
/// The system automatically downloads the variant that best matches the hardware
pub async fn download_foundry_model(model_id: &str, window: Window) -> Result<(), String> {
    println!("[FoundryInstaller] Downloading Foundry model: {}", model_id);

    #[cfg(any(target_os = "windows", target_os = "macos"))]
    {
        // Use Foundry CLI to download the model
        println!("[FoundryInstaller] Running: foundry model download {}", model_id);

        let mut child = create_command("foundry")
            .args(&["model", "download", model_id])
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| format!("Failed to execute foundry model download: {}", e))?;

        // Read stdout line by line and emit progress events
        if let Some(stdout) = child.stdout.take() {
            let reader = BufReader::new(stdout);
            for line in reader.lines() {
                if let Ok(line_str) = line {
                    println!("[FoundryInstaller] {}", line_str);

                    // Emit progress event to frontend
                    let _ = window.emit("model:installation-log", serde_json::json!({
                        "timestamp": chrono::Utc::now().to_rfc3339(),
                        "level": "info",
                        "message": line_str
                    }));
                }
            }
        }

        // Wait for the process to complete
        let status = child.wait()
            .map_err(|e| format!("Failed to wait for foundry process: {}", e))?;

        if !status.success() {
            // Read stderr if available
            let mut stderr_output = String::new();
            if let Some(mut stderr) = child.stderr {
                use std::io::Read;
                let _ = stderr.read_to_string(&mut stderr_output);
            }

            return Err(format!(
                "Failed to download model {}. Exit code: {:?}\nStderr: {}",
                model_id, status.code(), stderr_output
            ));
        }

        println!("[FoundryInstaller] Model download completed successfully");
        Ok(())
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        Err("Foundry Local is only available for Windows and macOS".to_string())
    }
}

/// Get list of recommended models to download
/// These are models that work well with Foundry Local
pub fn get_recommended_models() -> Vec<&'static str> {
    vec![
        "qwen2.5-0.5b",        // Qwen 2.5 0.5B - very fast, minimal resources
        "phi3:mini",           // Microsoft's Phi-3 Mini - fast and efficient
        "phi3:medium",         // Phi-3 Medium - more capable, more resources
    ]
}
