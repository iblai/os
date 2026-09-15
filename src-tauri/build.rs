/// Mobile builds bake `TAURI_DEV_URL` in via `option_env!` (a device can't read
/// the Mac's dotenv files at runtime), so resolve it here at build time: shell
/// env first, then — for DEBUG builds only — the same dotenv files, in the
/// same order, that `lib.rs::run()` loads for desktop. Keeps
/// `src-tauri/.env.local` the single place to point dev builds, desktop and
/// mobile alike.
///
/// Release builds read the shell only. A dotenv value is the developer's
/// machine config (typically a dev platform), and baking it into a release
/// meant an archive cut on that machine shipped aimed at the dev platform
/// while the same archive from CI aimed at production — the compile-time
/// twin of the runtime leak `local_env` / the dotenv loads used to have. A
/// release that must target another platform passes `TAURI_DEV_URL=…`
/// explicitly (see scripts/android-release.sh, gen/apple/build-rust.sh).
fn dev_url_from_env_files(release: bool) -> Option<String> {
    if let Ok(v) = std::env::var("TAURI_DEV_URL") {
        return Some(v);
    }
    if release {
        return None;
    }
    let manifest_dir = std::env::var("CARGO_MANIFEST_DIR").ok()?;
    dev_url_from_dotenv_dir(std::path::Path::new(&manifest_dir))
}

/// `TAURI_DEV_URL=` from the first dotenv file under `dir` that sets it.
fn dev_url_from_dotenv_dir(dir: &std::path::Path) -> Option<String> {
    for f in [".env.local", ".env.production", ".env"] {
        let Ok(text) = std::fs::read_to_string(dir.join(f)) else {
            continue;
        };
        if let Some(val) = dotenv_value(&text, "TAURI_DEV_URL") {
            return Some(val);
        }
    }
    None
}

fn dotenv_value(text: &str, key: &str) -> Option<String> {
    text.lines().find_map(|line| {
        let rest = line.trim().strip_prefix(key)?.strip_prefix('=')?;
        let val = rest.trim().trim_matches('"').trim_matches('\'');
        (!val.is_empty()).then(|| val.to_string())
    })
}

/// Whether a resolved URL may be baked into a build of this profile.
/// Release binaries must never carry a dev-server URL: a forgotten
/// `TAURI_DEV_URL=http://…` in the shell would point a shipped app at a
/// developer's machine, so release accepts https only.
fn bakeable(url: &str, release: bool) -> bool {
    !release || url.starts_with("https://")
}

fn main() {
    // `option_env!("IBL_ALLOW_IN_APP_PURCHASE")` is evaluated at compile time.
    // Cargo does not track env vars read via env!/option_env! on its own, so
    // declare it here to force a rebuild when the build-time flag changes.
    println!("cargo:rerun-if-env-changed=IBL_ALLOW_IN_APP_PURCHASE");
    println!("cargo:rerun-if-env-changed=IBL_TENANT");
    // lib.rs bakes this via option_env! for mobile builds — without these a
    // changed URL (shell or dotenv) would leave a stale binary.
    println!("cargo:rerun-if-env-changed=TAURI_DEV_URL");
    // Only files that EXIST: Cargo treats a missing rerun-if-changed path as
    // always stale, which re-ran this script — and recompiled the whole
    // crate — on every single build/test on any machine lacking one of
    // them (measured: a zero-change build took 1m13s). A file that appears
    // later is picked up by the next build via the env-changed lines above
    // plus the usual source-change triggers.
    for f in [".env.local", ".env.production", ".env"] {
        if std::path::Path::new(f).exists() {
            println!("cargo:rerun-if-changed={f}");
        }
    }
    let release = std::env::var("PROFILE").as_deref() == Ok("release");
    if let Some(url) = dev_url_from_env_files(release) {
        if bakeable(&url, release) {
            println!("cargo:rustc-env=TAURI_DEV_URL={url}");
        } else {
            // Dropped with a visible warning; the binary falls back to its
            // built-in production URL.
            println!(
                "cargo:warning=TAURI_DEV_URL '{url}' is not https — ignored for a release build"
            );
        }
    }
    tauri_build::build()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn dir_with(files: &[(&str, &str)]) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "ibl-build-rs-{}-{}",
            std::process::id(),
            files.iter().map(|(n, _)| *n).collect::<Vec<_>>().join("_")
        ));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        for (name, text) in files {
            std::fs::write(dir.join(name), text).unwrap();
        }
        dir
    }

    #[test]
    fn dotenv_lookup_takes_the_first_file_that_sets_the_key() {
        let dir = dir_with(&[
            (".env.local", "# comment\nOTHER=1\n"),
            (".env.production", "TAURI_DEV_URL=\"https://org.example\"\n"),
            (".env", "TAURI_DEV_URL=https://never.example\n"),
        ]);
        assert_eq!(
            dev_url_from_dotenv_dir(&dir).as_deref(),
            Some("https://org.example")
        );
        assert_eq!(dotenv_value("TAURI_DEV_URL=\n", "TAURI_DEV_URL"), None);
        assert_eq!(dotenv_value("TAURI_DEV_URLX=1\n", "TAURI_DEV_URL"), None);
    }

    /// The compile-time twin of the runtime rule (PR review B3): a release
    /// build takes `TAURI_DEV_URL` from the shell only, never from the
    /// checkout's dotenv files — otherwise an archive cut on a machine whose
    /// `.env.local` names the dev platform ships aimed at it.
    #[test]
    fn a_release_build_ignores_the_checkout_dotenv() {
        // Serialise against the other test's env var use.
        let _g = ENV_LOCK.lock().unwrap();
        let dir = dir_with(&[(".env.local", "TAURI_DEV_URL=https://org.example\n")]);
        std::env::remove_var("TAURI_DEV_URL");
        std::env::set_var("CARGO_MANIFEST_DIR", &dir);
        assert_eq!(
            dev_url_from_env_files(false).as_deref(),
            Some("https://org.example"),
            "debug builds keep reading the dotenv"
        );
        assert_eq!(
            dev_url_from_env_files(true),
            None,
            "release builds must not bake the dotenv value"
        );
        // An explicit shell value still wins in both profiles.
        std::env::set_var("TAURI_DEV_URL", "https://shell.example");
        assert_eq!(
            dev_url_from_env_files(true).as_deref(),
            Some("https://shell.example")
        );
        std::env::remove_var("TAURI_DEV_URL");
    }

    #[test]
    fn only_https_may_be_baked_into_a_release() {
        assert!(bakeable("http://127.0.0.1:3000", false));
        assert!(!bakeable("http://127.0.0.1:3000", true));
        assert!(bakeable("https://os.ibl.ai", true));
    }

    static ENV_LOCK: std::sync::Mutex<()> = std::sync::Mutex::new(());
}
