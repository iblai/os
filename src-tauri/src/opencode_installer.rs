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
/// Every look resolves the LATEST GitHub Release and syncs to it — releases
/// are what ship (the repo's release workflow cuts one on every landing),
/// never the moving branch head, and no version is ever pinned here. There is
/// deliberately NO freshness window: the app resolves latest at every launch
/// (and on Code enable) and downloads only when the tag moved.
///
/// github.com, not api.github.com: this URL's redirect names the tag, the
/// probe shares the tarball's host (one reachability question), and the
/// unauthenticated API rate limit never applies.
const VIBE_LATEST_RELEASE_URL: &str = "https://github.com/iblai/vibe/releases/latest";

/// Source tarball for a release tag — github.com (not the API host), so no
/// User-Agent requirement, same shape the branch download always had.
fn vibe_tag_tarball_url(tag: &str) -> String {
    format!("https://github.com/iblai/vibe/archive/refs/tags/{tag}.tar.gz")
}

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

/// `<data>/skills/vibe.sha` — release tag of the current vibe copy: a change
/// detector, never a pin ("did latest move since the last sync?"). Pre-release
/// copies stored a commit sha here — it matches no tag, so they self-heal with
/// one re-download.
fn vibe_sha_marker() -> PathBuf {
    crate::opencode_acp::vibe_skills_dir().with_extension("sha")
}

/// "Installed" means a populated dir: an empty `skills/vibe/` (interrupted
/// swap, manual poking) must read as absent so the next look re-installs.
fn dir_is_populated(dir: &Path) -> bool {
    std::fs::read_dir(dir)
        .map(|mut d| d.next().is_some())
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

/// The tag a `releases/latest` redirect points at (`…/releases/tag/<tag>`).
/// A redirect anywhere else — notably plain `/releases` when no release has
/// ever been published — is `None`: never guess a version.
fn tag_from_location(location: &str) -> Option<String> {
    let (_, tag) = location.split_once("/releases/tag/")?;
    let tag = tag.trim_end_matches('/');
    (!tag.is_empty() && !tag.contains('/')).then(|| tag.to_string())
}

/// Resolve the latest release tag from `probe_url` WITHOUT following the
/// redirect — the `Location` header names the tag.
async fn resolve_latest_tag(probe_url: &str) -> Option<String> {
    let resp = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .ok()?
        .get(probe_url)
        .header("User-Agent", "iblai-desktop")
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await
        .ok()?;
    if !resp.status().is_redirection() {
        return None;
    }
    tag_from_location(
        resp.headers()
            .get(reqwest::header::LOCATION)?
            .to_str()
            .ok()?,
    )
}

/// Whatever the latest published release is right now — resolved fresh on
/// every look, never cached beyond the marker's change detection.
async fn fetch_latest_vibe_tag() -> Option<String> {
    resolve_latest_tag(VIBE_LATEST_RELEASE_URL).await
}

/// Download the vibe tarball at `url` and swap its `skills/` over `dest`. The
/// old copy survives any failure (extract to temp, rename with a backup).
async fn download_vibe_skills(app: &AppHandle, dest: &Path, url: &str) -> Result<(), String> {
    log(app, "downloading iblai/vibe skills");
    let bytes = reqwest::Client::new()
        .get(url)
        // Bounded so a stalled download can't pin the sync lock (and the Code
        // pill spinner) forever; the archive is a few MB.
        .timeout(std::time::Duration::from_secs(120))
        .send()
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
/// skills, never the binary install. NO freshness window: every call (app
/// startup spawns one, and each Code enable re-invokes) resolves the latest
/// release and downloads only when the tag moved — always latest, never
/// pinned. An actual download registers an in-flight entry so the spawn path
/// holds instead of snapshotting a half-written dir. Failures keep the cached
/// copy and never error the command — the caller reads `present`.
#[command]
pub async fn ensure_vibe_skills(app: AppHandle) -> Result<serde_json::Value, String> {
    // One flight at a time: startup plus several composers can all invoke.
    static LOCK: std::sync::OnceLock<tokio::sync::Mutex<()>> = std::sync::OnceLock::new();
    let _guard = LOCK
        .get_or_init(|| tokio::sync::Mutex::new(()))
        .lock()
        .await;

    let dir = crate::opencode_acp::vibe_skills_dir();
    let marker = vibe_sha_marker();
    let cached = dir_is_populated(&dir);

    let latest = fetch_latest_vibe_tag().await;
    if cached {
        match &latest {
            Some(latest_tag) => {
                let stored = std::fs::read_to_string(&marker).unwrap_or_default();
                if stored.trim() == latest_tag.trim() {
                    // Already on the latest release.
                    return Ok(json!({ "present": true, "refreshed": false }));
                }
            }
            None => {
                // Offline/unreachable with a cache: keep it quietly; the next
                // look (startup or Code enable) tries again.
                log(&app, "vibe skills check unreachable — keeping cached copy");
                return Ok(json!({ "present": true, "refreshed": false }));
            }
        }
    }

    // Something to fetch: first install, or upstream cut a new release.
    let Some(tag) = latest else {
        // No release info and no cache (the cached case returned above). A
        // fallback to branch head would silently ship unreleased skills —
        // don't; the sync hook retries with backoff, and the next launch
        // tries again at startup.
        log(
            &app,
            "vibe release lookup unreachable — skills not installed yet",
        );
        return Ok(json!({ "present": dir_is_populated(&dir), "refreshed": false }));
    };
    crate::opencode_acp::begin_skills_sync_entry(crate::opencode_acp::VIBE_SYNC_KEY.to_string())
        .await;
    let downloaded = download_vibe_skills(&app, &dir, &vibe_tag_tarball_url(&tag)).await;
    crate::opencode_acp::end_skills_sync_entry(crate::opencode_acp::VIBE_SYNC_KEY).await;

    match downloaded {
        Ok(()) => {
            let _ = std::fs::write(&marker, &tag);
            log(&app, &format!("vibe skills installed ({tag})"));
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
    if cfg!(target_os = "windows") {
        return Err("Code isn't available on Windows.".to_string());
    }
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
        // Platform gates: `supported` hides Code entirely (Windows);
        // `sandbox_ready` disables it with a hint while Linux lacks bubblewrap.
        "supported": cfg!(not(target_os = "windows")),
        "sandbox_ready": crate::opencode_acp::sandbox_ready(),
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
        // A release-tag archive root (`vibe-<tag>`), not the old `vibe-main`:
        // the locator must not care what the tag is.
        let root = s.path().join("vibe-1.18.0");
        std::fs::create_dir_all(root.join("skills").join("iblai-vibe-auth")).unwrap();
        assert_eq!(find_extracted_skills(s.path()), Some(root.join("skills")));
    }

    /// "Installed" is a populated dir: missing and empty both mean absent, so
    /// an interrupted swap can't masquerade as a working skill set.
    #[test]
    fn an_empty_or_missing_skills_dir_reads_as_not_installed() {
        let s = Scratch::new("vibe-populated");
        let dir = s.path().join("vibe");
        assert!(!dir_is_populated(&dir), "missing");
        std::fs::create_dir_all(&dir).unwrap();
        assert!(!dir_is_populated(&dir), "empty");
        std::fs::create_dir_all(dir.join("iblai-vibe-auth")).unwrap();
        assert!(dir_is_populated(&dir), "populated");
    }

    /// Skills track whatever release is latest — the tag is read out of the
    /// `releases/latest` redirect every time, never configured.
    #[test]
    fn the_release_tag_is_read_from_the_redirect_never_configured() {
        assert_eq!(
            tag_from_location("https://github.com/iblai/vibe/releases/tag/v9.9.9").as_deref(),
            Some("v9.9.9")
        );
        assert_eq!(
            tag_from_location("https://github.com/iblai/vibe/releases/tag/v9.9.9/").as_deref(),
            Some("v9.9.9"),
            "a trailing slash is tolerated"
        );
        assert_eq!(
            tag_from_location("https://github.com/iblai/vibe/releases"),
            None,
            "no release published → no tag, never a guess"
        );
        assert_eq!(tag_from_location("https://github.com/"), None);
        assert_eq!(
            tag_from_location("https://x/releases/tag/a/b"),
            None,
            "a path after the tag is not a tag"
        );
    }

    /// End to end against a canned redirect: the latest tag comes from the
    /// `Location` header on github.com — no API host, no rate limit. A
    /// non-redirect answer yields None instead of a guessed version.
    #[tokio::test]
    async fn the_latest_tag_comes_from_the_releases_redirect() {
        use tokio::io::{AsyncReadExt, AsyncWriteExt};

        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        tokio::spawn(async move {
            // First connect: the redirect. Second: a plain 200 (no release).
            for response in [
                "HTTP/1.1 302 Found\r\nlocation: https://github.com/iblai/vibe/releases/tag/v9.9.9\r\ncontent-length: 0\r\nconnection: close\r\n\r\n",
                "HTTP/1.1 200 OK\r\ncontent-length: 0\r\nconnection: close\r\n\r\n",
            ] {
                let (mut sock, _) = listener.accept().await.unwrap();
                let mut buf = [0u8; 4096];
                let _ = sock.read(&mut buf).await;
                let _ = sock.write_all(response.as_bytes()).await;
            }
        });

        let probe = format!("http://{addr}/releases/latest");
        assert_eq!(resolve_latest_tag(&probe).await.as_deref(), Some("v9.9.9"));
        assert_eq!(
            resolve_latest_tag(&probe).await,
            None,
            "a non-redirect answer must not invent a tag"
        );
    }

    /// The download URL is the tag's source archive on github.com — not the
    /// API host (which would demand a User-Agent) and not any branch head.
    #[test]
    fn the_tarball_url_is_the_tags_source_archive() {
        assert_eq!(
            vibe_tag_tarball_url("v1.18.0"),
            "https://github.com/iblai/vibe/archive/refs/tags/v1.18.0.tar.gz"
        );
    }
}
