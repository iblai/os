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
    println!("cargo:rerun-if-changed=.env.local");
    println!("cargo:rerun-if-changed=.env.production");
    println!("cargo:rerun-if-changed=.env");
    if let Some(url) = dev_url_from_env_files() {
        println!("cargo:rustc-env=TAURI_DEV_URL={url}");
    }
    tauri_build::build()
}
