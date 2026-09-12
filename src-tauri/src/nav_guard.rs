//! Desktop webview navigation allowlist, shared by BOTH desktop entry
//! points (`main.rs`, the shipped binary, and `lib.rs`'s desktop branch) so
//! the twin guards can never drift apart again.

/// Whether the desktop webview may navigate to `url_str`.
///
/// The CONFIGURED app URL is always allowed first — the static list below
/// is hardcoded, and pointing `TAURI_APP_URL` at another deployment (e.g.
/// the org platform) used to make the app block its own initial navigation.
/// An EMPTY configured origin allows nothing extra: every string starts
/// with `""`, so without the emptiness guard a bare `TAURI_APP_URL=` line
/// in a dotenv file would disable the allowlist entirely.
/// Origins the desktop webview may navigate within, besides the configured
/// app URL. Matched on an origin BOUNDARY (see `under`), never as a bare
/// string prefix.
const STATIC_ORIGINS: &[&str] = &[
    "http://localhost",
    "http://127.0.0.1",
    "https://mentorai.iblai.app",
    "https://os.ibl.ai",
    "https://auth.iblai.org",
    "https://login.iblai.app",
    "https://base.manager.iblai.app",
    "https://base.manager.iblai.org",
    "https://api.iblai.app",
    "https://api.iblai.org",
    "https://learn.iblai.app",
    "https://learn.iblai.org",
];

/// Custom schemes the webview serves itself.
const STATIC_SCHEMES: &[&str] = &["tauri://", "asset://", "mentor://"];

/// `url` is exactly `origin` or lies under it: a path, query, fragment or
/// (for the port-less localhost entries) a port must follow. A bare prefix
/// test would let `https://os.ibl.ai.attacker.example` pass for
/// `https://os.ibl.ai`.
fn under(url: &str, origin: &str) -> bool {
    url == origin
        || url[origin.len().min(url.len())..]
            .chars()
            .next()
            .is_some_and(|c| matches!(c, '/' | '?' | '#' | ':'))
            && url.starts_with(origin)
}

pub fn navigation_allowed(url_str: &str, app_origin: &str) -> bool {
    let origin = app_origin.trim_end_matches('/');
    // An EMPTY configured origin allows nothing extra: every string starts
    // with "", so a bare `TAURI_APP_URL=` line would disable the allowlist.
    if !origin.is_empty() && under(url_str, origin) {
        return true;
    }
    STATIC_ORIGINS.iter().any(|o| under(url_str, o))
        || STATIC_SCHEMES.iter().any(|s| url_str.starts_with(s))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn an_empty_configured_origin_does_not_disable_the_allowlist() {
        // The bug this pins (PR review): `"anything".starts_with("")` is
        // true, so a bare `TAURI_APP_URL=` line in a dotenv file made every
        // navigation allowed.
        assert!(!navigation_allowed("https://evil.example.com/", ""));
        assert!(!navigation_allowed("https://evil.example.com/", "/"));
        // The static list still works with no configured origin.
        assert!(navigation_allowed("https://os.ibl.ai/platform", ""));
        assert!(navigation_allowed("http://localhost:3000/", ""));
    }

    #[test]
    fn the_configured_origin_is_always_allowed() {
        assert!(navigation_allowed(
            "https://mentorai.iblai.org/platform/x",
            "https://mentorai.iblai.org"
        ));
        // Trailing slash on the configured value must not break the match.
        assert!(navigation_allowed(
            "https://mentorai.iblai.org/",
            "https://mentorai.iblai.org/"
        ));
        // …and it does not open anything else up.
        assert!(!navigation_allowed(
            "https://evil.example.com/",
            "https://mentorai.iblai.org"
        ));
        // A host that merely BEGINS with the origin is a different origin.
        assert!(!navigation_allowed(
            "https://mentorai.iblai.org.attacker.example/",
            "https://mentorai.iblai.org"
        ));
        assert!(navigation_allowed(
            "https://mentorai.iblai.org?x=1",
            "https://mentorai.iblai.org"
        ));
    }

    #[test]
    fn static_origins_are_matched_on_a_boundary_too() {
        assert!(navigation_allowed("https://os.ibl.ai/platform", ""));
        assert!(navigation_allowed("http://localhost:3000/x", ""));
        assert!(navigation_allowed("tauri://localhost/index.html", ""));
        assert!(!navigation_allowed(
            "https://os.ibl.ai.attacker.example/",
            ""
        ));
        assert!(!navigation_allowed("https://api.iblai.org.evil.net/", ""));
    }
}
