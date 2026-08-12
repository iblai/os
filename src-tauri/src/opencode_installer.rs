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

/// iblai/vibe — the public dev-toolkit skills repo, synced for Coding Mode.
/// Tarball of the default branch; unauthenticated (public repo).
const VIBE_TARBALL_URL: &str = "https://github.com/iblai/vibe/archive/refs/heads/main.tar.gz";
/// Latest-commit probe for the freshness check. Unauthenticated is plenty at
/// ~1/day; api.github.com rejects requests without a User-Agent.
const VIBE_COMMITS_URL: &str = "https://api.github.com/repos/iblai/vibe/commits/main";
/// How often to even look upstream. The sha marker's mtime is the clock.
const VIBE_REFRESH_INTERVAL: std::time::Duration = std::time::Duration::from_secs(24 * 60 * 60);

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

/// `<data>/skills/vibe.sha` — upstream commit sha of the current vibe copy; the
/// file's mtime doubles as the "last checked" stamp.
fn vibe_sha_marker() -> PathBuf {
    crate::opencode_acp::vibe_skills_dir().with_extension("sha")
}

fn vibe_marker_is_fresh(marker: &Path, max_age: std::time::Duration) -> bool {
    std::fs::metadata(marker)
        .and_then(|m| m.modified())
        .ok()
        .and_then(|t| t.elapsed().ok())
        .map(|age| age < max_age)
        .unwrap_or(false)
}

/// The `<root>/skills` dir inside an extracted vibe tarball — the tarball root is
/// `vibe-<branch>/`, so it's located, not assumed.
fn find_extracted_skills(tmp: &Path) -> Option<PathBuf> {
    for entry in std::fs::read_dir(tmp).ok()?.flatten() {
        let cand = entry.path().join("skills");
        if cand.is_dir() {
            return Some(cand);
        }
    }
    None
}

async fn fetch_latest_vibe_sha() -> Option<String> {
    let resp = reqwest::Client::new()
        .get(VIBE_COMMITS_URL)
        .header("User-Agent", "iblai-desktop")
        .header("Accept", "application/vnd.github+json")
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await
        .ok()?
        .error_for_status()
        .ok()?;
    let v: serde_json::Value = resp.json().await.ok()?;
    Some(v.get("sha")?.as_str()?.to_string())
}

/// Download the vibe tarball and swap its `skills/` over `dest`. The old copy
/// survives any failure (extract to temp, rename with a backup).
async fn download_vibe_skills(app: &AppHandle, dest: &Path) -> Result<(), String> {
    log(app, "downloading iblai/vibe skills");
    let bytes = reqwest::get(VIBE_TARBALL_URL)
        .await
        .map_err(|e| format!("vibe download failed: {e}"))?
        .error_for_status()
        .map_err(|e| format!("vibe download failed (bad status): {e}"))?
        .bytes()
        .await
        .map_err(|e| format!("vibe download read failed: {e}"))?;

    let root = dest.parent().ok_or("vibe dir has no parent")?.to_path_buf();
    std::fs::create_dir_all(&root).map_err(|e| format!("skills dir failed: {e}"))?;
    let archive = root.join("vibe-dl.tar.gz");
    std::fs::write(&archive, &bytes).map_err(|e| format!("vibe archive write failed: {e}"))?;

    let tmp = root.join("vibe.extract-tmp");
    let _ = std::fs::remove_dir_all(&tmp);
    std::fs::create_dir_all(&tmp).map_err(|e| e.to_string())?;
    // Blocking extraction off the async runtime — same reasoning as the opencode
    // binary install above.
    {
        let (a, d) = (archive.clone(), tmp.clone());
        tokio::task::spawn_blocking(move || extract(&a, &d))
            .await
            .map_err(|e| format!("extract task failed: {e}"))??;
    }
    let _ = std::fs::remove_file(&archive);

    let skills_src = find_extracted_skills(&tmp).ok_or("no skills/ dir in vibe tarball")?;
    let backup = root.join("vibe.old");
    let _ = std::fs::remove_dir_all(&backup);
    let had_old = dest.exists();
    if had_old {
        std::fs::rename(dest, &backup).map_err(|e| format!("vibe backup failed: {e}"))?;
    }
    let result = match std::fs::rename(&skills_src, dest) {
        Ok(()) => {
            let _ = std::fs::remove_dir_all(&backup);
            Ok(())
        }
        Err(e) => {
            if had_old {
                let _ = std::fs::rename(&backup, dest);
            }
            Err(format!("vibe swap failed: {e}"))
        }
    };
    let _ = std::fs::remove_dir_all(&tmp);
    result
}

/// Sync the iblai/vibe skills for Coding Mode (shared across mentors and sessions).
///
/// Standalone from `install_opencode` on purpose: the Code pill's spinner covers
/// skills, never the binary install. At most one upstream look per
/// [`VIBE_REFRESH_INTERVAL`]; an actual download registers an in-flight entry so
/// the spawn path holds instead of snapshotting a half-written dir. Failures keep
/// the cached copy and never error the command — the caller reads `present`.
#[command]
pub async fn ensure_vibe_skills(app: AppHandle) -> Result<serde_json::Value, String> {
    // One flight at a time: several composers mount the sync hook.
    static LOCK: std::sync::OnceLock<tokio::sync::Mutex<()>> = std::sync::OnceLock::new();
    let _guard = LOCK
        .get_or_init(|| tokio::sync::Mutex::new(()))
        .lock()
        .await;

    let dir = crate::opencode_acp::vibe_skills_dir();
    let marker = vibe_sha_marker();
    let cached = dir.is_dir();

    if cached && vibe_marker_is_fresh(&marker, VIBE_REFRESH_INTERVAL) {
        return Ok(json!({ "present": true, "refreshed": false }));
    }

    let latest = fetch_latest_vibe_sha().await;
    if cached {
        match &latest {
            Some(latest_sha) => {
                let stored = std::fs::read_to_string(&marker).unwrap_or_default();
                if stored.trim() == latest_sha.trim() {
                    // Up to date — restamp the marker so the daily clock resets.
                    let _ = std::fs::write(&marker, latest_sha);
                    return Ok(json!({ "present": true, "refreshed": false }));
                }
            }
            None => {
                // Offline/unreachable with a cache: keep it quietly; the next call
                // past the interval tries again.
                log(&app, "vibe skills check unreachable — keeping cached copy");
                return Ok(json!({ "present": true, "refreshed": false }));
            }
        }
    }

    // Something to fetch: first install, or upstream moved.
    crate::opencode_acp::begin_skills_sync_entry(crate::opencode_acp::VIBE_SYNC_KEY.to_string())
        .await;
    let downloaded = download_vibe_skills(&app, &dir).await;
    crate::opencode_acp::end_skills_sync_entry(crate::opencode_acp::VIBE_SYNC_KEY).await;

    match downloaded {
        Ok(()) => {
            let _ = std::fs::write(&marker, latest.as_deref().unwrap_or("unknown"));
            log(&app, "vibe skills installed");
            Ok(json!({ "present": true, "refreshed": true }))
        }
        Err(e) => {
            log(&app, &format!("vibe skills fetch failed: {e}"));
            Ok(json!({ "present": dir.is_dir(), "refreshed": false }))
        }
    }
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

    /// The vibe tarball's root dir is branch-named (`vibe-main/`), so the skills
    /// dir inside must be found, never assumed.
    #[test]
    fn the_extracted_skills_dir_is_located_not_assumed() {
        let s = Scratch::new("vibe-locate");
        assert!(find_extracted_skills(s.path()).is_none());
        let root = s.path().join("vibe-main");
        std::fs::create_dir_all(root.join("skills").join("iblai-vibe-auth")).unwrap();
        assert_eq!(find_extracted_skills(s.path()), Some(root.join("skills")));
    }

    /// The marker's mtime is the daily clock: fresh short-circuits the upstream
    /// look, missing (first run) and stale do not.
    #[test]
    fn a_fresh_marker_short_circuits_and_a_missing_one_does_not() {
        let s = Scratch::new("vibe-marker");
        let marker = s.path().join("vibe.sha");
        assert!(!vibe_marker_is_fresh(&marker, VIBE_REFRESH_INTERVAL));
        std::fs::write(&marker, "abc").unwrap();
        assert!(vibe_marker_is_fresh(&marker, VIBE_REFRESH_INTERVAL));
        assert!(!vibe_marker_is_fresh(&marker, std::time::Duration::ZERO));
    }
}
