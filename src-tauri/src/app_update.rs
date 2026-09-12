//! App update checks + (desktop) in-place installation.
//!
//! One frontend contract on every platform: `check_app_update` returns
//! `{ available, version, url?, notes? }`, and the UI prompts. What the
//! prompt's button does differs by platform:
//!
//! - **Desktop (macOS/Windows/Linux, non-sandboxed)**: `install_app_update`
//!   downloads the signed artifact named by the release's
//!   `latest-<target>.json` (tauri-plugin-updater verifies the minisign
//!   signature against the pubkey pinned in `tauri.conf.json`), installs it
//!   and relaunches. Progress streams as `app-update:progress` events.
//! - **iOS**: stores can't be bypassed — the check asks Apple's lookup API
//!   for the published version and the prompt opens the App Store page. Both
//!   derive from the bundle identifier; nothing to configure.
//! - **Android**: same pattern against the Play Store listing page. Parsing
//!   that page is best-effort by necessity (Google publishes no version
//!   API); a parse failure reports "no update" rather than a wrong prompt.
//!
//! The Mac App Store build never self-updates (the sandbox forbids it); it
//! reports `supported: false` and the UI stays quiet — MAS handles updates.

use serde_json::{json, Value};

/// Compare two dotted versions numerically, ignoring any non-numeric suffix
/// per segment ("1.2.3-beta" == 1.2.3). Missing segments are 0, so
/// "1.2" == "1.2.0". Unparsable strings compare as 0.0.0 — an update is
/// offered only when the remote is STRICTLY newer, so garbage never prompts.
fn is_newer(remote: &str, local: &str) -> bool {
    fn parse(v: &str) -> [u64; 3] {
        let mut out = [0u64; 3];
        for (i, seg) in v
            .trim()
            .trim_start_matches('v')
            .split('.')
            .take(3)
            .enumerate()
        {
            let digits: String = seg.chars().take_while(|c| c.is_ascii_digit()).collect();
            out[i] = digits.parse().unwrap_or(0);
        }
        out
    }
    parse(remote) > parse(local)
}

/// The version Apple's lookup API reports for our bundle id, plus the store
/// page to send the user to. `None` when the app isn't published (empty
/// `results`) or the response is unexpected.
#[cfg_attr(not(target_os = "ios"), allow(dead_code))]
fn parse_itunes_lookup(body: &Value) -> Option<(String, String)> {
    let first = body.get("results")?.as_array()?.first()?;
    let version = first.get("version")?.as_str()?.to_string();
    let url = first
        .get("trackViewUrl")
        .and_then(Value::as_str)
        .map(str::to_string)?;
    Some((version, url))
}

/// Best-effort version scrape of a Play Store listing page. Google embeds the
/// current version in the page's data blobs as `[[["x.y.z"]]`; when that
/// shape ever changes this returns `None` and the check reports no update.
#[cfg_attr(not(target_os = "android"), allow(dead_code))]
fn parse_play_listing(html: &str) -> Option<String> {
    let idx = html.find("[[[\"")?;
    let rest = &html[idx + 4..];
    let end = rest.find('"')?;
    let candidate = &rest[..end];
    // Only accept something version-shaped; the first [[[" match on a
    // redesigned page could be arbitrary text.
    let looks_like_version = !candidate.is_empty()
        && candidate.len() <= 24
        && candidate.chars().all(|c| c.is_ascii_digit() || c == '.')
        && candidate.contains('.');
    looks_like_version.then(|| candidate.to_string())
}

// ---------- desktop: tauri-plugin-updater ----------

#[cfg(not(any(target_os = "ios", target_os = "android")))]
mod desktop {
    use super::*;
    use tauri::{command, AppHandle, Emitter};
    use tauri_plugin_updater::UpdaterExt;

    /// Whether this build can self-update at all: release build, not the
    /// sandboxed Mac App Store variant (MAS owns updates there), and not a
    /// tenant-locked build — the `latest` release serves GENERIC artifacts,
    /// and a tenant-locked app must never update itself into one.
    fn self_update_supported() -> bool {
        !cfg!(debug_assertions)
            && !crate::opencode_installer::is_sandboxed()
            && option_env!("IBL_TENANT").unwrap_or("").trim().is_empty()
    }

    #[command]
    pub async fn check_app_update(app: AppHandle) -> Result<Value, String> {
        if !self_update_supported() {
            return Ok(json!({ "available": false, "supported": false }));
        }
        let updater = app
            .updater_builder()
            .build()
            .map_err(|e| format!("updater unavailable: {e}"))?;
        match updater.check().await {
            Ok(Some(update)) => Ok(json!({
                "available": true,
                "supported": true,
                "version": update.version,
                "notes": update.body,
            })),
            Ok(None) => Ok(json!({ "available": false, "supported": true })),
            // A dead endpoint (offline, release without updater artifacts yet)
            // must not error-toast anyone — it just means "nothing to offer".
            Err(e) => {
                eprintln!("[AppUpdate] check failed: {e}");
                Ok(json!({ "available": false, "supported": true }))
            }
        }
    }

    /// Download + verify + install the pending update, then relaunch.
    /// Progress reaches the UI as `app-update:progress {downloaded, total}`.
    #[command]
    pub async fn install_app_update(app: AppHandle) -> Result<(), String> {
        if !self_update_supported() {
            return Err("self-update is not supported in this build".into());
        }
        let updater = app
            .updater_builder()
            .build()
            .map_err(|e| format!("updater unavailable: {e}"))?;
        let update = updater
            .check()
            .await
            .map_err(|e| format!("update check failed: {e}"))?
            .ok_or("no update available")?;

        let progress_app = app.clone();
        let mut downloaded: u64 = 0;
        update
            .download_and_install(
                move |chunk, total| {
                    downloaded += chunk as u64;
                    let _ = progress_app.emit(
                        "app-update:progress",
                        json!({ "downloaded": downloaded, "total": total }),
                    );
                },
                || {},
            )
            .await
            .map_err(|e| format!("update failed: {e}"))?;

        app.restart();
    }
}

#[cfg(not(any(target_os = "ios", target_os = "android")))]
pub use desktop::*;

// ---------- mobile: store version checks ----------

#[cfg(any(target_os = "ios", target_os = "android"))]
mod mobile {
    use super::*;
    use tauri::{command, AppHandle};

    #[command]
    pub async fn check_app_update(app: AppHandle) -> Result<Value, String> {
        // Dev builds run against the dev server with a fixed conf version —
        // a store prompt there is only noise.
        if cfg!(debug_assertions) {
            return Ok(json!({ "available": false, "supported": false }));
        }
        let local = app.package_info().version.to_string();
        let identifier = app.config().identifier.clone();

        #[cfg(target_os = "ios")]
        {
            let resp: Value = reqwest::get(format!(
                "https://itunes.apple.com/lookup?bundleId={identifier}"
            ))
            .await
            .map_err(|e| e.to_string())?
            .json()
            .await
            .map_err(|e| e.to_string())?;
            let Some((version, url)) = parse_itunes_lookup(&resp) else {
                // Not published (yet) — nothing to prompt.
                return Ok(json!({ "available": false, "supported": true }));
            };
            return Ok(json!({
                "available": is_newer(&version, &local),
                "supported": true,
                "version": version,
                "url": url,
            }));
        }

        #[cfg(target_os = "android")]
        {
            let url = format!("https://play.google.com/store/apps/details?id={identifier}&hl=en");
            let html = match reqwest::get(&url).await {
                Ok(r) if r.status().is_success() => r.text().await.unwrap_or_default(),
                // 404 = not on Play (yet); network errors = stay quiet.
                _ => return Ok(json!({ "available": false, "supported": true })),
            };
            let Some(version) = parse_play_listing(&html) else {
                return Ok(json!({ "available": false, "supported": true }));
            };
            return Ok(json!({
                "available": is_newer(&version, &local),
                "supported": true,
                "version": version,
                "url": url,
            }));
        }
    }
}

#[cfg(any(target_os = "ios", target_os = "android"))]
pub use mobile::*;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn version_comparison_is_numeric_and_lenient() {
        assert!(is_newer("0.95.20", "0.95.19"));
        assert!(is_newer("0.96.0", "0.95.19"));
        assert!(is_newer("1.0", "0.95.19")); // missing patch = 0
        assert!(!is_newer("0.95.19", "0.95.19"));
        assert!(!is_newer("0.95.18", "0.95.19"));
        // Numeric, not lexicographic: 0.100.0 > 0.95.0.
        assert!(is_newer("0.100.0", "0.95.0"));
        // v-prefix and suffixes are tolerated.
        assert!(is_newer("v0.95.20", "0.95.19"));
        assert!(!is_newer("0.95.19-beta", "0.95.19"));
        // Garbage never prompts.
        assert!(!is_newer("", "0.95.19"));
        assert!(!is_newer("latest", "0.95.19"));
    }

    #[test]
    fn itunes_lookup_parses_published_and_unpublished() {
        let published = json!({
            "resultCount": 1,
            "results": [{
                "version": "1.2.3",
                "trackViewUrl": "https://apps.apple.com/app/id123456789"
            }]
        });
        assert_eq!(
            parse_itunes_lookup(&published),
            Some((
                "1.2.3".to_string(),
                "https://apps.apple.com/app/id123456789".to_string()
            ))
        );
        // Unpublished app: empty results — no prompt, not an error.
        let unpublished = json!({ "resultCount": 0, "results": [] });
        assert_eq!(parse_itunes_lookup(&unpublished), None);
        assert_eq!(parse_itunes_lookup(&json!({})), None);
    }

    #[test]
    fn play_listing_parse_is_best_effort() {
        let page = r#"<script>AF_initDataCallback({data:[[["1.4.2"]],["x"]]});</script>"#;
        assert_eq!(parse_play_listing(page), Some("1.4.2".to_string()));
        // A redesigned page where the first match isn't version-shaped must
        // yield None (quiet no-update), never a bogus prompt.
        assert_eq!(parse_play_listing(r#"[[["not a version"]]"#), None);
        assert_eq!(parse_play_listing("<html>no data blobs</html>"), None);
        assert_eq!(
            parse_play_listing(r#"[[["12345678901234567890123456"]]"#),
            None
        );
    }
}
