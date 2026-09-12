/// Mobile builds bake `TAURI_DEV_URL` in via `option_env!` (a device can't read
/// the Mac's dotenv files at runtime), so resolve it here at build time: shell
/// env first, then the same dotenv files — in the same order — that
/// `lib.rs::run()` loads for desktop. Keeps `src-tauri/.env.local` the single
/// place to point dev builds, desktop and mobile alike.
fn dev_url_from_env_files() -> Option<String> {
    if let Ok(v) = std::env::var("TAURI_DEV_URL") {
        return Some(v);
    }
    let manifest_dir = std::env::var("CARGO_MANIFEST_DIR").ok()?;
    for f in [".env.local", ".env.production", ".env"] {
        let path = std::path::Path::new(&manifest_dir).join(f);
        let Ok(text) = std::fs::read_to_string(&path) else {
            continue;
        };
        for line in text.lines() {
            if let Some(rest) = line.trim().strip_prefix("TAURI_DEV_URL=") {
                let val = rest.trim().trim_matches('"').trim_matches('\'');
                if !val.is_empty() {
                    return Some(val.to_string());
                }
            }
        }
    }
    None
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
    if let Some(url) = dev_url_from_env_files() {
        // Release binaries must never carry a dev-server URL: a forgotten
        // `TAURI_DEV_URL=http://…` in a shell or dotenv file would point a
        // shipped app at a developer's machine. Only https URLs (a hosted
        // platform, e.g. the org deployment) may be baked into release;
        // anything else is dropped with a visible warning and the binary
        // falls back to its built-in production URL.
        let release = std::env::var("PROFILE").as_deref() == Ok("release");
        if release && !url.starts_with("https://") {
            println!(
                "cargo:warning=TAURI_DEV_URL '{url}' is not https — ignored for a release build"
            );
        } else {
            println!("cargo:rustc-env=TAURI_DEV_URL={url}");
        }
    }
    tauri_build::build()
}
