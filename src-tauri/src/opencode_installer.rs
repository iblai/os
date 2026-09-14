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
const OPENCODE_VERSION: &str = "1.18.13";

/// The opencode version this run wants: the runtime override, or the pin.
fn pinned_version() -> String {
    std::env::var("IBL_OPENCODE_VERSION").unwrap_or_else(|_| OPENCODE_VERSION.to_string())
}

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
    download_and_install_with(|m| log(app, m)).await
}

/// [`download_and_install`] without the Tauri handle: progress goes through
/// `log_line`. Split out because `AppHandle` cannot be constructed in tests
/// (the tauri dep ships no test feature), and the install itself never needs
/// Tauri — only the progress lines do. The binary-ensure test drives this
/// directly with `println!`.
async fn download_and_install_with(log_line: impl Fn(&str)) -> Result<(), String> {
    let version = pinned_version();
    let (os, arch, ext) = target_asset()?;
    let asset = format!("opencode-{os}-{arch}.{ext}");
    let url = format!("https://github.com/sst/opencode/releases/download/v{version}/{asset}");
    log_line(&format!("downloading {asset} (v{version})"));

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

    log_line("extracting opencode");
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
        log_line("cleared quarantine + ad-hoc signed opencode");
    }
    log_line(&format!("installed opencode at {}", bin.display()));
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

/// `--version` of the MANAGED copy specifically. `opencode_version()` reports
/// whichever copy PATH resolution wins — usually the user's own — so it can't
/// tell us whether OUR download is stale.
fn managed_opencode_version() -> Option<String> {
    let bin = opencode_bin();
    if !bin.exists() {
        return None;
    }
    let out = create_command(&bin.to_string_lossy())
        .arg("--version")
        .output()
        .ok()?;
    if !out.status.success() {
        return None;
    }
    Some(String::from_utf8_lossy(&out.stdout).trim().to_string())
}

/// Whether the managed copy needs re-downloading: it exists (`Some`) and reports
/// a version other than the pin (`opencode --version` prints the bare version).
/// `None` — no managed copy, because the user runs their own from PATH or Code
/// was never installed — is never an upgrade: this path must not conjure a
/// download nobody asked for.
fn needs_managed_upgrade(managed_version: Option<&str>, pin: &str) -> bool {
    managed_version.is_some_and(|v| v.trim() != pin)
}

/// Boot-time upgrade of the managed opencode copy to the current pin — a bumped
/// [`OPENCODE_VERSION`] would otherwise never reach a machine that already has a
/// runnable copy (`install_opencode` downloads only when one is missing, and the
/// frontend only calls it on first enable). No download race with
/// `install_opencode`: that acts only when opencode is NOT runnable, this only
/// when the managed copy IS present — disjoint conditions.
pub async fn ensure_opencode_current(app: AppHandle) {
    let pin = pinned_version();
    let managed = managed_opencode_version();
    if !needs_managed_upgrade(managed.as_deref(), &pin) {
        return;
    }
    log(
        &app,
        &format!(
            "managed opencode {} → v{pin}",
            managed.as_deref().unwrap_or("?")
        ),
    );
    if let Err(e) = download_and_install(&app).await {
        log(
            &app,
            &format!("opencode upgrade failed (keeping the current copy): {e}"),
        );
    }
}

/// macOS App Sandbox detection — the sandbox exports `APP_SANDBOX_CONTAINER_ID`.
/// Under the sandbox Code can't spawn the opencode binary (or freely touch the
/// filesystem), so the UI hides Code and the spawn path refuses when this is true.
pub fn is_sandboxed() -> bool {
    cfg!(target_os = "macos") && std::env::var_os("APP_SANDBOX_CONTAINER_ID").is_some()
}

/// First `Name=` entry of a `.desktop` file — the app's display name.
fn parse_desktop_name(text: &str) -> Option<String> {
    text.lines()
        .map(str::trim)
        .find_map(|l| l.strip_prefix("Name="))
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty())
}

/// "org.kde.dolphin.desktop" → "Dolphin": last dot-segment of the id, first
/// letter upper-cased. The not-found fallback, never the primary source.
fn prettify_desktop_id(id: &str) -> Option<String> {
    let stem = id.trim().trim_end_matches(".desktop");
    let last = stem.rsplit('.').next()?.trim();
    let mut chars = last.chars();
    let first = chars.next()?;
    Some(first.to_uppercase().collect::<String>() + chars.as_str())
}

/// Display name of whatever `xdg-open` (and thus the opener plugin's
/// `open_path`) will launch for a folder: the `inode/directory` default.
/// Honest over pretty — on a box where an editor claimed the mime type, the
/// button names the editor, because that IS what opens. No default → `None`
/// (the UI falls back to its generic label).
#[cfg(target_os = "linux")]
fn linux_file_manager() -> Option<String> {
    let out = create_command("xdg-mime")
        .args(["query", "default", "inode/directory"])
        .output()
        .ok()?;
    if !out.status.success() {
        return None;
    }
    let id = String::from_utf8_lossy(&out.stdout).trim().to_string();
    if id.is_empty() {
        return None;
    }
    // XDG data dirs, user first — flatpak exports ride XDG_DATA_DIRS.
    let mut dirs: Vec<PathBuf> = Vec::new();
    match std::env::var("XDG_DATA_HOME") {
        Ok(h) if !h.is_empty() => dirs.push(PathBuf::from(h)),
        _ => {
            if let Some(home) = home_dir() {
                dirs.push(home.join(".local/share"));
            }
        }
    }
    let sys = std::env::var("XDG_DATA_DIRS")
        .unwrap_or_else(|_| "/usr/local/share:/usr/share".to_string());
    dirs.extend(sys.split(':').filter(|s| !s.is_empty()).map(PathBuf::from));
    dirs.iter()
        .map(|d| d.join("applications").join(&id))
        .find_map(|p| parse_desktop_name(&std::fs::read_to_string(p).ok()?))
        .or_else(|| prettify_desktop_id(&id))
}

/// Report opencode readiness for the UI.
#[command]
pub async fn check_opencode_status() -> serde_json::Value {
    // Linux only: mac/windows have fixed, hand-translated open-button labels.
    #[cfg(target_os = "linux")]
    let file_manager = linux_file_manager();
    #[cfg(not(target_os = "linux"))]
    let file_manager: Option<String> = None;
    json!({
        "installed": opencode_installed(),
        "version": opencode_version(),
        "config_ready": config_file().exists(),
        "sandboxed": is_sandboxed(),
        // Platform gates: `supported` hides Code entirely (Windows);
        // `sandbox_ready` disables it with a hint while Linux lacks bubblewrap.
        "supported": cfg!(not(target_os = "windows")),
        "sandbox_ready": crate::opencode_acp::sandbox_ready(),
        // Names the "Open in <app>" button after the folder handler that will
        // actually launch; null → the UI's generic "Open Folder".
        "file_manager": file_manager,
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

    /// The open-button label names whatever will actually open: the `Name=` of
    /// the default handler's .desktop entry, or a prettified id when the file
    /// can't be located. Localized `Name[xx]=` lines are never mistaken for it.
    #[test]
    fn the_file_manager_name_comes_from_the_desktop_entry() {
        let dolphin =
            "[Desktop Entry]\nType=Application\nName[fr]=Dauphin\nName=Dolphin\nExec=dolphin %u\n";
        assert_eq!(parse_desktop_name(dolphin).as_deref(), Some("Dolphin"));
        assert_eq!(parse_desktop_name("[Desktop Entry]\nExec=foo\n"), None);
        assert_eq!(parse_desktop_name("Name=\n"), None, "empty name is no name");

        assert_eq!(
            prettify_desktop_id("org.kde.dolphin.desktop").as_deref(),
            Some("Dolphin")
        );
        assert_eq!(
            prettify_desktop_id("codium-wayland.desktop").as_deref(),
            Some("Codium-wayland")
        );
        assert_eq!(prettify_desktop_id(""), None);
    }

    /// The upgrade decision: only a PRESENT managed copy on the wrong version
    /// re-downloads. No managed copy — PATH-only users, or Code never installed —
    /// must never trigger a download.
    #[test]
    fn only_a_present_and_outdated_managed_copy_wants_an_upgrade() {
        assert!(!needs_managed_upgrade(None, "1.18.13"));
        assert!(!needs_managed_upgrade(Some("1.18.13"), "1.18.13"));
        assert!(
            !needs_managed_upgrade(Some(" 1.18.13\n"), "1.18.13"),
            "--version output is compared trimmed"
        );
        assert!(needs_managed_upgrade(Some("1.18.4"), "1.18.13"));
        assert!(
            needs_managed_upgrade(Some("1.19.0"), "1.18.13"),
            "the managed copy tracks the pin exactly — even a 'newer' stray converges"
        );
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

    /// Pinned-binary + end-to-end guidance tests. `#[cfg(unix)]` as one module
    /// (matching the acp `test_session` precedent): they spawn the real
    /// opencode binary, and the gate also keeps the helpers from tripping
    /// dead-code warnings on non-unix builds.
    #[cfg(unix)]
    mod pinned_binary {
        use super::*;

        /// Make the MANAGED pinned opencode binary real: reuse the managed copy
        /// when it reports exactly `pinned_version()`, otherwise download the
        /// release.
        ///
        /// Deliberately targets the production location (`opencode_bin()`, i.e.
        /// `~/.local/share/iblai/bin` — or under `XDG_DATA_HOME` when set), NOT
        /// a scratch dir: the download is ~100MB, the production path is
        /// exactly what boot-time `ensure_opencode_current` maintains, and
        /// caching it there makes every later test run (and the app itself)
        /// reuse it. Idempotent and self-contained so each test calls it
        /// without inter-test ordering.
        ///
        /// Holds [`crate::opencode_acp::data_dir_lock`] for the WHOLE body —
        /// resolve, version check, download, re-check: the acp settings tests
        /// repoint the process-global `XDG_DATA_HOME` under that lock, and an
        /// unlocked ensure once resolved the bin dir inside such a scratch
        /// window and aimed the download at a directory the other test's
        /// teardown was deleting (ENOENT mid-write). The guard also serializes
        /// the two tests below against double-downloading. It rides across the
        /// download `.await` on purpose (`download_and_install_with` re-reads
        /// `iblai_data_dir()`), which is fine on the default current-thread
        /// `#[tokio::test]` runtime.
        async fn ensure_pinned_opencode() -> PathBuf {
            let _data_dir = crate::opencode_acp::data_dir_lock();
            let pin = pinned_version();
            if managed_opencode_version().as_deref() != Some(pin.as_str()) {
                println!(
                    "[opencode-test] managed copy absent/stale — downloading pinned v{pin} (~100MB, cached at {})",
                    opencode_bin().display()
                );
                tokio::time::timeout(
                    std::time::Duration::from_secs(300),
                    download_and_install_with(|m| println!("[opencode-test] {m}")),
                )
                .await
                .expect("downloading the pinned opencode release timed out (300s)")
                .expect("downloading the pinned opencode release failed (needs network + tar)");
            }
            assert_eq!(
                managed_opencode_version().as_deref(),
                Some(pin.as_str()),
                "managed opencode at {} must report the pin after ensure",
                opencode_bin().display()
            );
            opencode_bin()
        }

        /// The pin contract against the real GitHub release: a managed copy
        /// already on `pinned_version()` is reused untouched; a missing or
        /// stale one is downloaded and must then report the pin. The second
        /// ensure pins the reuse branch — an unchanged mtime is the proof no
        /// re-download happened.
        #[tokio::test]
        async fn the_pinned_opencode_binary_is_reused_when_current_and_downloaded_when_not() {
            let bin = ensure_pinned_opencode().await;
            let before = std::fs::metadata(&bin)
                .expect("managed opencode binary must exist after ensure")
                .modified()
                .expect("mtime");
            ensure_pinned_opencode().await;
            let after = std::fs::metadata(&bin).unwrap().modified().unwrap();
            assert_eq!(
                before, after,
                "a version-matched managed copy must be reused, never re-downloaded"
            );
        }

        /// A proven-working OpenAI-compatible SSE completion (one "ok" chunk, a
        /// stop chunk, then [DONE]) — what @ai-sdk/openai-compatible inside
        /// opencode v1.18.13 accepts. Close-delimited body (no content-length),
        /// so the stub shuts the socket after writing.
        const STUB_SSE: &str = "HTTP/1.1 200 OK\r\ncontent-type: text/event-stream\r\nconnection: close\r\n\r\n\
data: {\"id\":\"c1\",\"object\":\"chat.completion.chunk\",\"choices\":[{\"index\":0,\"delta\":{\"role\":\"assistant\",\"content\":\"ok\"},\"finish_reason\":null}]}\n\n\
data: {\"id\":\"c1\",\"object\":\"chat.completion.chunk\",\"choices\":[{\"index\":0,\"delta\":{},\"finish_reason\":\"stop\"}]}\n\n\
data: [DONE]\n\n";

        /// A stub model endpoint on loopback: accepts until the test's runtime
        /// dies, records every request as `(method, path, body)`
        /// (content-length framing, same shape as the proxy tests'
        /// `canned_dm`), and answers each with [`STUB_SSE`]. Real HTTP over a
        /// real socket, so what gets asserted is the request body the pinned
        /// opencode binary actually sends.
        #[allow(clippy::type_complexity)]
        async fn stub_completions_server() -> (
            std::net::SocketAddr,
            std::sync::Arc<tokio::sync::Mutex<Vec<(String, String, String)>>>,
        ) {
            use tokio::io::{AsyncReadExt, AsyncWriteExt};

            let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
            let addr = listener.local_addr().unwrap();
            let seen = std::sync::Arc::new(tokio::sync::Mutex::new(Vec::new()));
            let log = seen.clone();

            tokio::spawn(async move {
                loop {
                    let Ok((mut sock, _)) = listener.accept().await else {
                        return;
                    };
                    // Per-connection task: opencode can hold several calls open
                    // at once (e.g. a title call beside the turn's own call).
                    let log = log.clone();
                    tokio::spawn(async move {
                        let mut data = Vec::new();
                        let mut split = None;
                        while split.is_none() {
                            let mut buf = [0u8; 4096];
                            match sock.read(&mut buf).await {
                                Ok(0) | Err(_) => break,
                                Ok(n) => data.extend_from_slice(&buf[..n]),
                            }
                            split = data.windows(4).position(|w| w == b"\r\n\r\n");
                        }
                        let Some(head_end) = split else { return };
                        let head = String::from_utf8_lossy(&data[..head_end]).to_string();
                        let content_len = head
                            .lines()
                            .find(|l| l.to_ascii_lowercase().starts_with("content-length:"))
                            .and_then(|l| l.split(':').nth(1)?.trim().parse::<usize>().ok())
                            .unwrap_or(0);
                        while data.len() < head_end + 4 + content_len {
                            let mut buf = [0u8; 4096];
                            match sock.read(&mut buf).await {
                                Ok(0) | Err(_) => break,
                                Ok(n) => data.extend_from_slice(&buf[..n]),
                            }
                        }
                        let mut start = head.split_whitespace();
                        let method = start.next().unwrap_or_default().to_string();
                        let path = start.next().unwrap_or_default().to_string();
                        let body = String::from_utf8_lossy(&data[(head_end + 4).min(data.len())..])
                            .to_string();
                        log.lock().await.push((method, path, body));
                        let _ = sock.write_all(STUB_SSE.as_bytes()).await;
                        let _ = sock.shutdown().await;
                    });
                }
            });
            (addr, seen)
        }

        /// The hermetic opencode config for the guidance test: the REAL shipped
        /// CONFIG_TEMPLATE via `ensure_opencode_config_at`, then the same
        /// per-spawn patches production's `apply_opencode_model` makes
        /// (top-level `model`, provider `models` entry, `options.baseURL` /
        /// `apiKey`) — pointed at the stub.
        fn write_stub_config(config_home: &Path, port: u16) {
            ensure_opencode_config_at(config_home).expect("config template write");
            let path = config_home.join("opencode").join("opencode.json");
            let mut cfg: serde_json::Value =
                serde_json::from_str(&std::fs::read_to_string(&path).unwrap()).unwrap();
            let root = cfg.as_object_mut().unwrap();
            root.insert("model".to_string(), json!("iblai/stub-model"));
            let provider = root
                .get_mut("provider")
                .and_then(|p| p.get_mut("iblai"))
                .and_then(|p| p.as_object_mut())
                .expect("CONFIG_TEMPLATE carries the iblai provider");
            provider.insert(
                "models".to_string(),
                json!({ "stub-model": { "name": "stub-model" } }),
            );
            provider.insert(
                "options".to_string(),
                json!({ "baseURL": format!("http://127.0.0.1:{port}/v1"), "apiKey": "test" }),
            );
            std::fs::write(&path, serde_json::to_string_pretty(&cfg).unwrap()).unwrap();
        }

        /// Last ~2KB of a captured stream, for failure messages.
        fn tail(bytes: &[u8]) -> String {
            let s = String::from_utf8_lossy(bytes);
            s.chars()
                .skip(s.chars().count().saturating_sub(2000))
                .collect()
        }

        /// One real `opencode run` turn under a fully scratch HOME/XDG world.
        ///
        /// `env_clear` plus upstream's own hermetic-harness recipe (v1.18.13),
        /// so the child can never read or write the developer's real
        /// config/state and never phones home (no update check, no models.dev
        /// fetch, no auth file). PATH passes through — opencode needs its
        /// subprocess plumbing — and the scratch DATA/STATE dirs are shared
        /// across calls on purpose: that is where the session for `--continue`
        /// persists. Deliberately NOT setting `OPENCODE_CONFIG_CONTENT`: the
        /// point is the on-disk opencode.json + AGENTS.md path production
        /// uses. Panics loudly with output tails on timeout or non-zero exit.
        async fn run_opencode_turn(bin: &Path, scratch: &Path, args: &[&str], secs: u64) {
            let mut cmd = tokio::process::Command::new(bin);
            cmd.arg("run")
                .args(args)
                .current_dir(scratch.join("project"))
                .env_clear()
                .env("PATH", std::env::var_os("PATH").unwrap_or_default())
                .env("HOME", scratch.join("home"))
                .env("XDG_CONFIG_HOME", scratch.join("config"))
                .env("XDG_DATA_HOME", scratch.join("data"))
                .env("XDG_STATE_HOME", scratch.join("state"))
                .env("XDG_CACHE_HOME", scratch.join("cache"))
                .env("TERM", "dumb")
                .env("OPENCODE_DISABLE_PROJECT_CONFIG", "1")
                .env("OPENCODE_PURE", "1")
                .env("OPENCODE_DISABLE_AUTOUPDATE", "1")
                .env("OPENCODE_DISABLE_AUTOCOMPACT", "1")
                .env("OPENCODE_DISABLE_MODELS_FETCH", "1")
                .env("OPENCODE_AUTH_CONTENT", "{}")
                .stdin(std::process::Stdio::null())
                .stdout(std::process::Stdio::piped())
                .stderr(std::process::Stdio::piped())
                .kill_on_drop(true);
            let out = tokio::time::timeout(std::time::Duration::from_secs(secs), cmd.output())
                .await
                .unwrap_or_else(|_| panic!("opencode run {args:?} timed out after {secs}s"))
                .expect("spawning the managed opencode binary");
            assert!(
                out.status.success(),
                "opencode run {args:?} failed (exit {:?})\n--- stdout tail ---\n{}\n--- stderr tail ---\n{}",
                out.status.code(),
                tail(&out.stdout),
                tail(&out.stderr),
            );
        }

        /// The guidance delivery contract, end to end against the REAL pinned
        /// binary: every agent-turn model call `opencode run` makes must carry
        /// the content of `$XDG_CONFIG_HOME/opencode/AGENTS.md` — written by
        /// the production writer (`write_iblai_guidance`) with the production
        /// text (`IBLAI_INSTRUCTIONS`) — and opencode must RE-READ the file per
        /// call, not cache it: the file is rewritten between two turns of one
        /// continued session, and turn 2 must carry the new marker.
        ///
        /// Agent turns are identified by the `<env>` block of opencode's full
        /// system assembly (instruction files ride only that path upstream);
        /// the one known auxiliary call — the title summarizer, which upstream
        /// gives no instruction files — is exempted BY NAME, and any call that
        /// is neither fails the test loudly so a new auxiliary path on a pin
        /// bump gets examined instead of silently ignored. This is the
        /// always-on replacement for the manual harness the repo AGENTS.md
        /// used to prescribe — it re-proves the property automatically on
        /// every `OPENCODE_VERSION` bump.
        #[tokio::test]
        async fn opencode_run_carries_the_agents_md_guidance_on_every_model_call() {
            let bin = ensure_pinned_opencode().await;
            let s = Scratch::new("guidance-e2e");
            for dir in ["home", "config", "data", "state", "cache", "project"] {
                std::fs::create_dir_all(s.path().join(dir)).unwrap();
            }
            let (addr, seen) = stub_completions_server().await;
            let config_home = s.path().join("config");
            write_stub_config(&config_home, addr.port());

            // The REAL guidance text plus a per-turn marker, through the REAL
            // writer.
            let instructions = crate::opencode_proxy::IBLAI_INSTRUCTIONS;
            crate::opencode_acp::write_iblai_guidance(
                &config_home,
                Some(&format!("{instructions}\n- TURN-MARKER-A\n")),
            )
            .expect("guidance write A");

            run_opencode_turn(&bin, s.path(), &["hi"], 120).await;
            let first_turn_calls = seen.lock().await.len();
            assert!(first_turn_calls >= 1, "turn 1 never reached the stub");

            // The rewrite between turns is the whole point: same session, new
            // file content — only a per-call re-read shows it.
            crate::opencode_acp::write_iblai_guidance(
                &config_home,
                Some(&format!("{instructions}\n- TURN-MARKER-B\n")),
            )
            .expect("guidance write B");

            run_opencode_turn(&bin, s.path(), &["--continue", "and again"], 60).await;

            let calls = seen.lock().await;
            assert!(
                calls.len() > first_turn_calls,
                "turn 2 never reached the stub ({} calls total)",
                calls.len()
            );
            let is_agent_turn = |body: &str| body.contains("<env>");
            for (i, (method, path, body)) in calls.iter().enumerate() {
                assert_eq!(method, "POST", "call {i} used the wrong method");
                assert_eq!(path, "/v1/chat/completions", "call {i} hit the wrong route");
                assert!(
                    is_agent_turn(body) || body.contains("Generate a title"),
                    "call {i} is neither an agent turn nor the known title call — a new \
auxiliary path needs examining\n--- body tail ---\n{}",
                    tail(body.as_bytes())
                );
                if is_agent_turn(body) {
                    assert!(
                        body.contains("# ibl.ai guidance"),
                        "agent-turn call {i} carried no ibl.ai guidance header\n--- body tail ---\n{}",
                        tail(body.as_bytes())
                    );
                    assert!(
                        body.contains("our default template"),
                        "agent-turn call {i} lost the guidance body text"
                    );
                }
            }
            let turn1: Vec<&str> = calls[..first_turn_calls]
                .iter()
                .filter(|(_, _, b)| is_agent_turn(b))
                .map(|(_, _, b)| b.as_str())
                .collect();
            let turn2: Vec<&str> = calls[first_turn_calls..]
                .iter()
                .filter(|(_, _, b)| is_agent_turn(b))
                .map(|(_, _, b)| b.as_str())
                .collect();
            assert!(!turn1.is_empty(), "turn 1 made no agent-turn model call");
            assert!(!turn2.is_empty(), "turn 2 made no agent-turn model call");
            for (i, body) in turn1.iter().enumerate() {
                assert!(
                    body.contains("TURN-MARKER-A"),
                    "turn-1 agent call {i} missing marker A"
                );
                assert!(
                    !body.contains("TURN-MARKER-B"),
                    "turn-1 agent call {i} leaked marker B"
                );
            }
            assert!(
                turn2.iter().any(|b| b.contains("TURN-MARKER-B")),
                "no turn-2 agent call carried the rewritten AGENTS.md — the per-call re-read is broken"
            );
        }
    }
}
