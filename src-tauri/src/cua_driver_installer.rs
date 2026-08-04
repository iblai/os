//! Auto-installer for the `cua-driver` binary that backs Cowork (Computer Use).
//!
//! Downloads the pinned per-platform release from GitHub into
//! `~/.local/share/iblai/bin/cua-driver` — no Homebrew, no npm, so it works for
//! shipped end users on macOS, Windows and Linux alike. (The GhostOS path this
//! replaces was macOS/Homebrew-only, which is why Cowork used to be hidden
//! everywhere else.)
//!
//! Mirrors `opencode_installer.rs`, with three deliberate differences:
//!  - the archive is verified against the release's `checksums.txt` before it is
//!    unpacked — this binary drives the user's desktop, so a corrupted or
//!    substituted download is not something to shrug at;
//!  - the download has an explicit timeout (the opencode one can hang forever);
//!  - the binary is located by walking the extracted tree rather than assuming a
//!    layout, since the release ships several archive shapes.

#![cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]

use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::Duration;

use serde::Serialize;
use serde_json::json;
use tauri::{command, AppHandle, Emitter};

use crate::cua_driver_mcp::{cua_driver_bin, cua_driver_program, session_support, DriverSupport};
use crate::opencode_acp::iblai_data_dir;

/// Pinned cua-driver version → GitHub release tag `cua-driver-rs-v<VERSION>`.
/// Bump ONLY after testing the MCP tool surface against it. Override at runtime
/// with `IBL_CUA_DRIVER_VERSION`.
const CUA_DRIVER_VERSION: &str = "0.17.0";
const CUA_DRIVER_REPO: &str = "trycua/cua";

/// Give up rather than hang forever on a stalled connection.
const DOWNLOAD_TIMEOUT: Duration = Duration::from_secs(300);

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

/// Per-step progress for the Cowork card's bar.
const EVENT_INSTALL_PROGRESS: &str = "cua-driver:install-progress";
/// One line for the card's log pane. Shape must stay `InstallationLog`
/// (`{timestamp, level, message}`) — the hook feeds it straight to `addLog`.
const EVENT_INSTALLATION_LOG: &str = "cua-driver:installation-log";

fn log(app: &AppHandle, message: &str) {
    println!("[cua-driver-install] {message}");
    let _ = app.emit(
        EVENT_INSTALLATION_LOG,
        json!({
            "timestamp": chrono::Utc::now().to_rfc3339(),
            "level": "info",
            "message": message,
        }),
    );
}

fn progress(app: &AppHandle, status: &str, percentage: u8, message: &str) {
    let _ = app.emit(
        EVENT_INSTALL_PROGRESS,
        json!({ "status": status, "percentage": percentage, "message": message }),
    );
}

fn version() -> String {
    std::env::var("IBL_CUA_DRIVER_VERSION").unwrap_or_else(|_| CUA_DRIVER_VERSION.to_string())
}

/// `cua-driver --version`, run the same way the MCP spawn does.
///
/// The `PATH` override is load-bearing, not cosmetic: the spawn uses the bare
/// program name and our managed `bin` dir isn't on the app's own PATH. Without it
/// this reports "not installed" straight after a successful download and the
/// install loops forever (the same trap `opencode_installer.rs` documents).
fn driver_version_output() -> Option<std::process::Output> {
    create_command(&cua_driver_program())
        .arg("--version")
        .env("PATH", crate::opencode_acp::augmented_path())
        .output()
        .ok()
}

fn driver_installed() -> bool {
    driver_version_output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

fn driver_version() -> Option<String> {
    let out = driver_version_output()?;
    if !out.status.success() {
        return None;
    }
    Some(String::from_utf8_lossy(&out.stdout).trim().to_string())
}

/// Release asset name for this platform, e.g.
/// `cua-driver-rs-0.17.0-darwin-arm64.tar.gz`.
///
/// Note the arch spelling differs from the opencode release: `x86_64`, not `x64`.
fn target_asset(version: &str) -> Result<String, String> {
    let os = match std::env::consts::OS {
        "macos" => "darwin",
        "linux" => "linux",
        "windows" => "windows",
        other => return Err(format!("unsupported OS: {other}")),
    };
    let arch = match std::env::consts::ARCH {
        "x86_64" => "x86_64",
        "aarch64" => "arm64",
        other => return Err(format!("unsupported arch: {other}")),
    };
    let ext = if os == "windows" { "zip" } else { "tar.gz" };
    Ok(format!("cua-driver-rs-{version}-{os}-{arch}.{ext}"))
}

/// Pull the expected SHA-256 for `asset` out of the release's `checksums.txt`.
///
/// The file is Markdown-fenced (a ``` block around `<sha256>  <filename>` rows),
/// so parse by matching the filename column rather than assuming line offsets.
fn expected_sha256(checksums: &str, asset: &str) -> Option<String> {
    checksums.lines().find_map(|line| {
        let mut parts = line.split_whitespace();
        let sum = parts.next()?;
        let name = parts.next()?;
        (name == asset && sum.len() == 64).then(|| sum.to_ascii_lowercase())
    })
}

fn sha256_hex(bytes: &[u8]) -> String {
    use sha2::{Digest, Sha256};
    hex::encode(Sha256::digest(bytes))
}

/// Extract a `.tar.gz` (tar) or `.zip` (unzip on macOS, bsdtar elsewhere).
///
/// `output()`, never `status()`: `status()` hands the child the app's own stdio,
/// and in a GUI-launched build that is a pipe nobody drains — a chatty extractor
/// (`unzip` prints a line per entry) fills the 64KB buffer and blocks forever, so
/// the install hangs mid-extract with no error.
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
    let out = cmd.output().map_err(|e| format!("extract spawn failed: {e}"))?;
    if out.status.success() {
        Ok(())
    } else {
        Err(format!(
            "extract failed (exit {:?}): {}",
            out.status.code(),
            String::from_utf8_lossy(&out.stderr).trim()
        ))
    }
}

/// Find the driver executable anywhere in the freshly extracted tree and move it
/// to `target`.
///
/// The release publishes several archive shapes (plain and `-binary`, and a
/// universal build on macOS), so the layout is searched rather than assumed —
/// getting that guess wrong would fail as a confusing "not installed" loop.
fn hoist_binary(root: &Path, target: &Path) -> Result<(), String> {
    if target.exists() {
        return Ok(());
    }
    let name = cua_driver_program();

    fn find(dir: &Path, name: &str, depth: usize) -> Option<PathBuf> {
        if depth == 0 {
            return None;
        }
        let entries = std::fs::read_dir(dir).ok()?;
        let mut dirs = Vec::new();
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                dirs.push(path);
            } else if path.file_name().map(|n| n == name).unwrap_or(false) {
                return Some(path);
            }
        }
        dirs.into_iter().find_map(|d| find(&d, name, depth - 1))
    }

    let found = find(root, &name, 4)
        .ok_or_else(|| format!("`{name}` not found in the extracted archive"))?;
    if found == target {
        return Ok(());
    }
    std::fs::rename(&found, target).map_err(|e| format!("failed to place `{name}`: {e}"))
}

/// Download + install the pinned cua-driver into `~/.local/share/iblai/bin`.
async fn download_and_install(app: &AppHandle) -> Result<(), String> {
    let version = version();
    let asset = target_asset(&version)?;
    let base = format!(
        "https://github.com/{CUA_DRIVER_REPO}/releases/download/cua-driver-rs-v{version}"
    );

    let bin_dir = iblai_data_dir().join("bin");
    std::fs::create_dir_all(&bin_dir).map_err(|e| format!("bin dir failed: {e}"))?;

    let client = reqwest::Client::builder()
        .timeout(DOWNLOAD_TIMEOUT)
        .build()
        .map_err(|e| format!("http client failed: {e}"))?;

    // Checksums first — no point downloading 25MB we cannot verify.
    progress(app, "installing", 5, "Checking the download");
    log(app, "fetching cua-driver checksums");
    let checksums = client
        .get(format!("{base}/checksums.txt"))
        .send()
        .await
        .map_err(|e| format!("checksums download failed: {e}"))?
        .error_for_status()
        .map_err(|e| format!("checksums download failed (bad status): {e}"))?
        .text()
        .await
        .map_err(|e| format!("checksums read failed: {e}"))?;
    let expected = expected_sha256(&checksums, &asset)
        .ok_or_else(|| format!("no checksum published for {asset}"))?;

    progress(app, "installing", 15, "Downloading");
    log(app, &format!("downloading {asset} (v{version})"));
    let bytes = client
        .get(format!("{base}/{asset}"))
        .send()
        .await
        .map_err(|e| format!("download failed: {e}"))?
        .error_for_status()
        .map_err(|e| format!("download failed (bad status): {e}"))?
        .bytes()
        .await
        .map_err(|e| format!("download read failed: {e}"))?;

    let actual = sha256_hex(&bytes);
    if actual != expected {
        return Err(format!(
            "checksum mismatch for {asset}: expected {expected}, got {actual}"
        ));
    }

    let archive = bin_dir.join(format!("cua-driver-dl-{version}"));
    std::fs::write(&archive, &bytes).map_err(|e| format!("archive write failed: {e}"))?;
    // `extract` dispatches on the extension, so keep the asset's own suffix.
    let archive = {
        let named = bin_dir.join(&asset);
        std::fs::rename(&archive, &named).map_err(|e| format!("archive rename failed: {e}"))?;
        named
    };

    progress(app, "installing", 70, "Extracting");
    log(app, "extracting cua-driver");
    // Off the async runtime: extraction is fully blocking and takes seconds on a
    // 25MB release. Run inline it pins a tokio worker for the whole time, which
    // stalls the very IPC channel this command has to reply on.
    {
        let (a, d) = (archive.clone(), bin_dir.clone());
        tokio::task::spawn_blocking(move || extract(&a, &d))
            .await
            .map_err(|e| format!("extract task failed: {e}"))??;
    }
    let _ = std::fs::remove_file(&archive);

    let bin = cua_driver_bin();
    hoist_binary(&bin_dir, &bin)?;
    if !bin.exists() {
        return Err(format!(
            "cua-driver binary not found in {} after extracting {asset}",
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
        // `com.apple.quarantine` xattr — strip it + ad-hoc sign so the driver can
        // spawn at all.
        let _ = create_command("xattr")
            .args(["-d", "com.apple.quarantine"])
            .arg(&bin)
            .output();
        let _ = create_command("codesign")
            .args(["--force", "--sign", "-"])
            .arg(&bin)
            .output();
        log(app, "cleared quarantine + ad-hoc signed cua-driver");
    }

    progress(app, "completed", 100, "Cowork is ready");
    log(app, &format!("installed cua-driver at {}", bin.display()));
    Ok(())
}

/// Readiness of the Cowork driver, as the Advanced → Cowork card renders it.
#[derive(Debug, Clone, Serialize)]
pub struct CuaDriverStatus {
    pub installed: bool,
    pub version: Option<String>,
    /// Whether this desktop session is one the driver has proven behaviour on.
    #[serde(flatten)]
    pub support: DriverSupport,
}

#[command]
pub async fn check_cua_driver_status() -> Result<CuaDriverStatus, String> {
    Ok(CuaDriverStatus {
        installed: driver_installed(),
        version: driver_version(),
        support: session_support(&crate::cua_driver_mcp::current_session_env()),
    })
}

/// Install cua-driver if it isn't already runnable. Returns its version.
#[command]
pub async fn install_cua_driver(app: AppHandle) -> Result<String, String> {
    // Refuse before downloading 25MB the user could never use here.
    let support = session_support(&crate::cua_driver_mcp::current_session_env());
    if !support.supported {
        return Err(format!(
            "Cowork is not supported on this desktop session ({}).",
            support.reason.unwrap_or_default()
        ));
    }

    if driver_installed() {
        log(&app, "cua-driver already installed");
    } else {
        log(&app, "cua-driver not found — downloading");
        download_and_install(&app).await?;
        if !driver_installed() {
            return Err("cua-driver still not runnable after install".to_string());
        }
    }
    Ok(driver_version().unwrap_or_else(|| "installed".to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;

    const CHECKSUMS: &str = "\
## SHA256 Checksums
```
55ed672850492080ff4e7dab4948b4f3bc70c3b84884a89b1eb8521a5d8177a8  cua-driver-rs-0.17.0-darwin-arm64.tar.gz
7bb73735289b6b11a07dd28a20a52cea54a4ab03cc111cc058ff91e3328cf79e  cua-driver-rs-0.17.0-windows-x86_64.zip
```";

    #[test]
    fn asset_name_matches_the_published_release() {
        // Arch spelling is `x86_64` here, unlike opencode's `x64` — getting this
        // wrong 404s at download time.
        let name = target_asset("0.17.0").expect("this platform is supported");
        assert!(name.starts_with("cua-driver-rs-0.17.0-"), "{name}");
        let expected_ext = if cfg!(target_os = "windows") { ".zip" } else { ".tar.gz" };
        assert!(name.ends_with(expected_ext), "{name}");
        assert!(!name.contains("x64."), "arch must be x86_64, not x64: {name}");
    }

    #[test]
    fn checksum_is_matched_by_filename_not_position() {
        assert_eq!(
            expected_sha256(CHECKSUMS, "cua-driver-rs-0.17.0-windows-x86_64.zip").as_deref(),
            Some("7bb73735289b6b11a07dd28a20a52cea54a4ab03cc111cc058ff91e3328cf79e")
        );
    }

    #[test]
    fn markdown_fences_and_headings_are_ignored() {
        // The file is a fenced block, so a naive line parser would read "##" or
        // "```" as a checksum row.
        assert_eq!(expected_sha256(CHECKSUMS, "```"), None);
        assert_eq!(expected_sha256(CHECKSUMS, "Checksums"), None);
    }

    #[test]
    fn an_unpublished_asset_has_no_checksum() {
        assert_eq!(expected_sha256(CHECKSUMS, "cua-driver-rs-9.9.9-linux-arm64.tar.gz"), None);
    }

    #[test]
    fn sha256_matches_a_known_vector() {
        assert_eq!(
            sha256_hex(b"abc"),
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        );
    }
}
