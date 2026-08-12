//! Auto-installer for the `opencode` binary used by Coding Mode.
//!
//! Downloads the pinned per-platform opencode release binary from GitHub into
//! `~/.local/share/iblai/bin/opencode` (no npm/node required — works for shipped
//! end users), writes the ibl.ai opencode config, and ensures the default
//! git-backed workspace. Mirrors the Ollama/Foundry installer shape.

#![cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]

use std::path::{Path, PathBuf};
use std::process::Command;

use serde_json::json;
use tauri::{command, AppHandle, Emitter};

use crate::opencode_acp::{iblai_data_dir, opencode_bin, opencode_program};

/// Pinned opencode version → GitHub release tag `v<VERSION>`. Bump ONLY after
/// testing ACP + config against it. Override at runtime with `IBL_OPENCODE_VERSION`.
const OPENCODE_VERSION: &str = "1.18.4";

/// The ibl.ai opencode config, installed at
/// `~/.config/iblai/agents/opencode/opencode.json`. baseURL + auth are injected as
/// env at spawn time; the top-level `model` and the provider `models` are filled in
/// per-session by `apply_opencode_model` from the user's selected LLM — there is no
/// baked-in default (see opencode_acp.rs).
/// `permission: "ask"` is the whole security boundary for Code — nothing else confines
/// the agent. The bare string is opencode's shorthand for "ask for every operation":
/// reads and edits, shell, glob/grep/list, fetch, everything. Each ask becomes a card
/// the user answers. Note this is a floor, not a default: `enforce_permission_policy`
/// (opencode_acp.rs) rewrites it on every spawn, so editing it here or on disk won't
/// loosen it. `options` is a placeholder — the endpoint is the loopback proxy (cloud) or
/// the on-device runtime, filled in per session.
const CONFIG_TEMPLATE: &str = r#"{
  "$schema": "https://opencode.ai/config.json",
  "enabled_providers": ["iblai"],
  "permission": "ask",
  "provider": {
    "iblai": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "ibl.ai",
      "options": {},
      "models": {}
    }
  }
}
"#;

fn create_command(program: &str) -> Command {
    let cmd = Command::new(program);
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        let mut cmd = cmd;
        cmd.creation_flags(CREATE_NO_WINDOW);
        return cmd;
    }
    #[allow(unreachable_code)]
    cmd
}

fn log(app: &AppHandle, message: &str) {
    println!("[opencode-install] {message}");
    let _ = app.emit(
        "model:installation-log",
        json!({ "message": message, "source": "opencode" }),
    );
}

fn home_dir() -> Option<PathBuf> {
    std::env::var_os("HOME")
        .or_else(|| std::env::var_os("USERPROFILE"))
        .map(PathBuf::from)
}

fn config_file() -> PathBuf {
    home_dir()
        .unwrap_or_default()
        .join(".config/iblai/agents/opencode/opencode.json")
}

/// `opencode --version`, run the same way the ACP spawn does.
///
/// The `PATH` override is load-bearing, not cosmetic: `opencode_program()` is the bare
/// name, and our managed `bin` dir isn't on the app's own PATH. Without it this reports
/// "not installed" immediately after a successful download, and `install_opencode`
/// re-downloads forever.
fn opencode_version_output() -> Option<std::process::Output> {
    create_command(&opencode_program())
        .arg("--version")
        .env("PATH", crate::opencode_acp::augmented_path())
        .output()
        .ok()
}

/// Whether opencode (on PATH, or the copy we downloaded) is runnable.
fn opencode_installed() -> bool {
    opencode_version_output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

fn opencode_version() -> Option<String> {
    let out = opencode_version_output()?;
    if !out.status.success() {
        return None;
    }
    Some(String::from_utf8_lossy(&out.stdout).trim().to_string())
}

/// (os, arch, ext) for the current platform's opencode release asset, e.g.
/// `opencode-darwin-arm64.zip` / `opencode-linux-x64.tar.gz`.
fn target_asset() -> Result<(&'static str, &'static str, &'static str), String> {
    let os = match std::env::consts::OS {
        "macos" => "darwin",
        "linux" => "linux",
        "windows" => "windows",
        other => return Err(format!("unsupported OS: {other}")),
    };
    let arch = match std::env::consts::ARCH {
        "x86_64" => "x64",
        "aarch64" => "arm64",
        other => return Err(format!("unsupported arch: {other}")),
    };
    let ext = if os == "linux" { "tar.gz" } else { "zip" };
    Ok((os, arch, ext))
}

/// Extract a `.tar.gz` (tar) or `.zip` (unzip on macOS, bsdtar elsewhere).
fn extract(archive: &Path, dir: &Path) -> Result<(), String> {
    let a = archive.to_string_lossy().to_string();
    let d = dir.to_string_lossy().to_string();
    let mut cmd = if a.ends_with(".tar.gz") {
        let mut c = create_command("tar");
        c.args(["-xzf", &a, "-C", &d]);
        c
    } else if cfg!(target_os = "macos") {
        let mut c = create_command("unzip");
        c.args(["-o", &a, "-d", &d]);
        c
    } else {
        // Windows/Linux: bsdtar handles .zip.
        let mut c = create_command("tar");
        c.args(["-xf", &a, "-C", &d]);
        c
    };
    // `output()`, never `status()`. `status()` hands the child the app's own stdio,
    // and in a GUI-launched build that is a pipe nobody drains — a chatty extractor
    // (`unzip` prints a line per entry) fills the 64KB buffer and blocks forever, so
    // the install hangs after "extracting opencode" with no error. `output()` also
    // nulls stdin, so the child can't stall waiting on input, and it gives us the
    // extractor's own stderr to report instead of a bare exit code.
    let out = cmd
        .output()
        .map_err(|e| format!("extract spawn failed: {e}"))?;
    if out.status.success() {
        Ok(())
    } else {
        let stderr = String::from_utf8_lossy(&out.stderr);
        Err(format!(
            "extract failed (exit {:?}): {}",
            out.status.code(),
            stderr.trim()
        ))
    }
}

/// If the binary landed one directory deep, move it up to `target`.
fn hoist_binary(bin_dir: &Path, target: &Path) -> Result<(), String> {
    if target.exists() {
        return Ok(());
    }
    let name = match target.file_name() {
        Some(n) => n.to_owned(),
        None => return Ok(()),
    };
    if let Ok(rd) = std::fs::read_dir(bin_dir) {
        for e in rd.flatten() {
            let p = e.path();
            if p.is_dir() {
                let cand = p.join(&name);
                if cand.exists() {
                    std::fs::rename(&cand, target).map_err(|x| x.to_string())?;
                    return Ok(());
                }
            }
        }
    }
    Ok(())
}

/// Download + install the pinned opencode binary into `~/.local/share/iblai/bin`.
async fn download_and_install(app: &AppHandle) -> Result<(), String> {
    let version =
        std::env::var("IBL_OPENCODE_VERSION").unwrap_or_else(|_| OPENCODE_VERSION.to_string());
    let (os, arch, ext) = target_asset()?;
    let asset = format!("opencode-{os}-{arch}.{ext}");
    let url = format!("https://github.com/sst/opencode/releases/download/v{version}/{asset}");
    log(app, &format!("downloading {asset} (v{version})"));

    let bin_dir = iblai_data_dir().join("bin");
    std::fs::create_dir_all(&bin_dir).map_err(|e| format!("bin dir failed: {e}"))?;
    let archive = bin_dir.join(format!("opencode-dl.{ext}"));

    let bytes = reqwest::get(&url)
        .await
        .map_err(|e| format!("download failed: {e}"))?
        .error_for_status()
        .map_err(|e| format!("download failed (bad status): {e}"))?
        .bytes()
        .await
        .map_err(|e| format!("download read failed: {e}"))?;
    std::fs::write(&archive, &bytes).map_err(|e| format!("archive write failed: {e}"))?;

    log(app, "extracting opencode");
    // Off the async runtime: extraction is fully blocking and takes seconds on a
    // ~100MB release. Run inline it pins a tokio worker for the whole time, which
    // stalls the very IPC channel this command has to reply on — the UI then sees a
    // hang rather than a slow install.
    {
        let (a, d) = (archive.clone(), bin_dir.clone());
        tokio::task::spawn_blocking(move || extract(&a, &d))
            .await
            .map_err(|e| format!("extract task failed: {e}"))??;
    }
    let _ = std::fs::remove_file(&archive);

    let bin = opencode_bin();
    hoist_binary(&bin_dir, &bin)?;
    if !bin.exists() {
        return Err(format!(
            "opencode binary not found in {} after extracting {asset}",
            bin_dir.display()
        ));
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = std::fs::set_permissions(&bin, std::fs::Permissions::from_mode(0o755));
    }
    #[cfg(target_os = "macos")]
    {
        // arm64 macOS SIGKILLs unsigned binaries, and a download can carry the
        // `com.apple.quarantine` xattr — strip it + ad-hoc sign so opencode can spawn.
        let _ = create_command("xattr")
            .args(["-d", "com.apple.quarantine"])
            .arg(&bin)
            .output();
        let _ = create_command("codesign")
            .args(["--force", "--sign", "-"])
            .arg(&bin)
            .output();
        log(app, "cleared quarantine + ad-hoc signed opencode");
    }
    log(app, &format!("installed opencode at {}", bin.display()));
    Ok(())
}

/// Write the ibl.ai opencode config into `config_home` if missing. Public so the ACP
/// spawn path can materialise a session's own copy — the config ships embedded in the app
/// (CONFIG_TEMPLATE), not as a loose file on the user's disk.
pub fn ensure_opencode_config_at(config_home: &Path) -> Result<(), String> {
    let path = config_home.join("opencode").join("opencode.json");
    if path.exists() {
        return Ok(());
    }
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("config dir failed: {e}"))?;
    }
    std::fs::write(&path, CONFIG_TEMPLATE).map_err(|e| format!("config write failed: {e}"))
}

/// The canonical copy, kept only so `check_opencode_status` can answer "is Code set up at
/// all". Sessions each get their own under `config_home(session_id)`.
pub fn ensure_opencode_config() -> Result<(), String> {
    let path = config_file();
    if path.exists() {
        return Ok(());
    }
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("config dir failed: {e}"))?;
    }
    std::fs::write(&path, CONFIG_TEMPLATE).map_err(|e| format!("config write failed: {e}"))
}

/// `ensure_opencode_config` + a log line on first write.
fn ensure_config(app: &AppHandle) -> Result<(), String> {
    let existed = config_file().exists();
    ensure_opencode_config()?;
    if !existed {
        log(
            app,
            &format!("wrote opencode config at {}", config_file().display()),
        );
    }
    Ok(())
}

/// Install opencode (if needed), write the config, and prepare the workspace.
#[command]
pub async fn install_opencode(app: AppHandle) -> Result<String, String> {
    if !opencode_installed() {
        log(&app, "opencode not found — downloading");
        download_and_install(&app).await?;
        if !opencode_installed() {
            return Err("opencode still not runnable after install".to_string());
        }
    } else {
        log(&app, "opencode already installed");
    }

    ensure_config(&app)?;

    Ok(opencode_version().unwrap_or_else(|| "installed".to_string()))
}

/// macOS App Sandbox detection — the sandbox exports `APP_SANDBOX_CONTAINER_ID`.
/// Under the sandbox Code can't spawn the opencode binary (or freely touch the
/// filesystem), so the UI hides Code and the spawn path refuses when this is true.
pub fn is_sandboxed() -> bool {
    cfg!(target_os = "macos") && std::env::var_os("APP_SANDBOX_CONTAINER_ID").is_some()
}

/// Report opencode readiness for the UI.
#[command]
pub async fn check_opencode_status() -> serde_json::Value {
    json!({
        "installed": opencode_installed(),
        "version": opencode_version(),
        "config_ready": config_file().exists(),
        "sandboxed": is_sandboxed(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A fresh scratch dir per test, removed on drop (best-effort).
    struct Scratch(PathBuf);
    impl Scratch {
        fn new(name: &str) -> Self {
            let dir = std::env::temp_dir().join(format!(
                "opencode-installer-test-{}-{name}",
                std::process::id()
            ));
            let _ = std::fs::remove_dir_all(&dir);
            std::fs::create_dir_all(&dir).unwrap();
            Scratch(dir)
        }
        fn path(&self) -> &Path {
            &self.0
        }
    }
    impl Drop for Scratch {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }

    #[test]
    fn extract_unpacks_a_real_archive() {
        let s = Scratch::new("ok");
        let src = s.path().join("src");
        std::fs::create_dir_all(&src).unwrap();
        std::fs::write(src.join("opencode"), b"#!/bin/sh\n").unwrap();
        // The `.tar.gz` name forces the `tar` branch on every platform, so the
        // test exercises one deterministic code path everywhere.
        let archive = s.path().join("release.tar.gz");
        let built = Command::new("tar")
            .arg("-czf")
            .arg(&archive)
            .arg("-C")
            .arg(&src)
            .arg("opencode")
            .status()
            .expect("tar is present on every supported platform");
        assert!(built.success());
        let dest = s.path().join("out");
        std::fs::create_dir_all(&dest).unwrap();

        extract(&archive, &dest).expect("extract should succeed");
        assert!(dest.join("opencode").exists());
    }

    #[test]
    fn a_failed_extract_reports_the_extractor_s_own_stderr() {
        // The freeze regression, pinned from its observable side. `extract` once
        // ran the child with `status()`, which hands it the app's own stdio: in a
        // GUI-launched build that pipe is drained by nobody, a chatty extractor
        // fills it and blocks forever, and a failure carried no detail. With
        // `output()` the pipes are drained and stderr comes back to us — so a
        // corrupt archive must fail WITH the extractor's own words in the error,
        // which the old code could never produce.
        let s = Scratch::new("corrupt");
        let archive = s.path().join("not-really.tar.gz");
        std::fs::write(&archive, b"this is not a gzip stream").unwrap();
        let dest = s.path().join("out");
        std::fs::create_dir_all(&dest).unwrap();

        let err = extract(&archive, &dest).expect_err("a corrupt archive must fail");
        assert!(err.contains("extract failed"), "{err}");
        let lower = err.to_lowercase();
        assert!(lower.contains("tar") || lower.contains("gzip"), "{err}");
    }
}
