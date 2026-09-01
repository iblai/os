fn main() {
    // `option_env!("IBL_ALLOW_IN_APP_PURCHASE")` is evaluated at compile time.
    // Cargo does not track env vars read via env!/option_env! on its own, so
    // declare it here to force a rebuild when the build-time flag changes.
    println!("cargo:rerun-if-env-changed=IBL_ALLOW_IN_APP_PURCHASE");
    println!("cargo:rerun-if-env-changed=IBL_TENANT");
    // lib.rs bakes this via option_env! for mobile builds (Makefile sets a LAN
    // IP) — without this a changed IP would leave a stale binary.
    println!("cargo:rerun-if-env-changed=TAURI_DEV_URL");
    tauri_build::build()
}
