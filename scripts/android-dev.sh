#!/usr/bin/env bash
# Run the Android dev app against this Mac's dev server over the USB cable.
#
# The phone loads http://127.0.0.1:3000, which `adb reverse` forwards through
# the cable to the Mac's dev server. This is immune to every network failure
# mode that produced white screens: DHCP changing the Mac's IP, Android's
# inability to resolve .local (mDNS) names, Wi-Fi AP isolation, and a VPN on
# the phone swallowing the LAN route.
#
# Prereqs: device connected via USB with debugging authorized, and
# `pnpm run dev` serving on :3000. Re-run this script after replugging the
# cable (adb reverse does not survive a replug).
set -euo pipefail

cd "$(dirname "$0")/.."

export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export NDK_HOME="${NDK_HOME:-$(ls -d "$ANDROID_HOME"/ndk/* 2>/dev/null | sort -V | tail -1)}"
export PATH="$ANDROID_HOME/platform-tools:$PATH"

adb reverse tcp:3000 tcp:3000
echo "USB tunnel up: phone's 127.0.0.1:3000 -> Mac's dev server"

# Baked into the build (mobile reads it at compile time).
export TAURI_DEV_URL=http://127.0.0.1:3000

cd src-tauri
exec cargo tauri android dev "$@"
