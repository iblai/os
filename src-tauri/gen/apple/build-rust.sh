#!/bin/sh
# Xcode "Build Rust Code" phase.
#
# Replaces Tauri's stock `cargo tauri ios xcode-script` phase. That one only
# works when `cargo tauri ios build/dev` is the parent process (it fetches its
# options from the CLI over a local socket), so Product > Archive in Xcode
# failed with "Connection refused". This does what xcode-script does, with no
# parent needed: compile the crate's static library for each arch Xcode asked
# for and drop it where the project links it
# (Externals/<arch>/<configuration>/libapp.a). `cargo tauri ios build` still
# works — it just drives Xcode, which runs this.
#
# Xcode runs script phases with a bare PATH, so cargo's bin dir is added first.
set -eu

# cargo, plus Homebrew (cmake for the embedded llama.cpp engine) — neither is
# on the PATH Xcode gives script phases.
export PATH="$HOME/.cargo/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
[ -f "$HOME/.cargo/env" ] && . "$HOME/.cargo/env"

cd "${SRCROOT:?}/../.."   # src-tauri

# The production URL a release archive bakes in (build.rs reads TAURI_DEV_URL;
# a release build ignores non-https values). Overridable from the shell or
# from Xcode's scheme environment.
: "${TAURI_DEV_URL:=https://os.ibl.ai}"
export TAURI_DEV_URL

case "${CONFIGURATION:?}" in
  release|Release) PROFILE=release; CARGO_FLAGS="--release" ;;
  *)               PROFILE=debug;   CARGO_FLAGS="" ;;
esac

SIM=0
case "${PLATFORM_DISPLAY_NAME:-}" in *Simulator*) SIM=1 ;; esac

for ARCH in ${ARCHS:?}; do
  case "$ARCH" in
    arm64)  if [ "$SIM" = 1 ]; then TRIPLE=aarch64-apple-ios-sim; ENVT=aarch64_apple_ios_sim; else TRIPLE=aarch64-apple-ios; ENVT=aarch64_apple_ios; fi ;;
    x86_64) TRIPLE=x86_64-apple-ios; ENVT=x86_64_apple_ios ;;
    *) echo "error: unknown arch $ARCH" >&2; exit 1 ;;
  esac
  rustup target list --installed | grep -qx "$TRIPLE" || rustup target add "$TRIPLE"

  ISYSROOT="-isysroot ${SDKROOT:?}"
  env "CFLAGS_${ENVT}=$ISYSROOT" "CXXFLAGS_${ENVT}=$ISYSROOT" "OBJC_INCLUDE_PATH_${ENVT}=${SDKROOT}/usr/include" \
      RUST_BACKTRACE=1 \
      cargo build --package ibl-ai-os --lib --no-default-features --target "$TRIPLE" $CARGO_FLAGS

  OUT="${SRCROOT}/Externals/${ARCH}/${PROFILE}"
  mkdir -p "$OUT"
  cp "target/${TRIPLE}/${PROFILE}/libibl_ai_os.a" "$OUT/libapp.a"
  echo "Built $TRIPLE ($PROFILE) -> $OUT/libapp.a"
done
