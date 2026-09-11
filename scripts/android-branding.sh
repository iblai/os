#!/usr/bin/env bash
# Apply ibl.ai branding (launcher icons + splash screen) to the generated
# Android project.
#
# `src-tauri/gen/android/` is gitignored — `cargo tauri android init`
# regenerates it with Tauri's default robot icon and no splash. This script
# re-applies the branding from COMMITTED sources (src-tauri/icons/android,
# produced by `cargo tauri icon`), so run it once after any `android init`:
#
#   ./scripts/android-branding.sh
#
# Idempotent: safe to run repeatedly.
set -euo pipefail

cd "$(dirname "$0")/.."
SRC=src-tauri/icons/android
RES=src-tauri/gen/android/app/src/main/res

if [ ! -d "$RES" ]; then
  echo "No Android project at $RES — run 'cargo tauri android init' first." >&2
  exit 1
fi
if [ ! -d "$SRC" ]; then
  echo "No branded icons at $SRC — run 'cargo tauri icon src-tauri/icons/icon-source-1024.png' first." >&2
  exit 1
fi

# 1. Launcher icons: branded PNGs over the template's defaults.
for dpi in mdpi hdpi xhdpi xxhdpi xxxhdpi; do
  cp "$SRC/mipmap-$dpi/"*.png "$RES/mipmap-$dpi/"
done

# 2. Adaptive icon (Android 8+): the launcher masks foreground-on-background
# into its shape; without this the raw PNG shows unmasked and looks legacy.
mkdir -p "$RES/mipmap-anydpi-v26"
cat > "$RES/mipmap-anydpi-v26/ic_launcher.xml" <<'XML'
<?xml version="1.0" encoding="utf-8"?>
<!-- Adaptive icon: Android masks this into the launcher's shape (circle,
     squircle, ...). Only the middle ~66% of the canvas survives the mask,
     and the ibl.ai wordmark is wide - inset it so nothing gets cropped.
     Background matches the logo's white field. -->
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background" />
    <foreground>
        <inset
            android:drawable="@mipmap/ic_launcher_foreground"
            android:inset="18%" />
    </foreground>
</adaptive-icon>
XML
cp "$RES/mipmap-anydpi-v26/ic_launcher.xml" "$RES/mipmap-anydpi-v26/ic_launcher_round.xml"

# 3. Colors used by the icon background and both splash implementations.
python3 - "$RES/values/colors.xml" <<'PY'
import sys
p = sys.argv[1]
s = open(p).read()
for name in ("ic_launcher_background", "splash_background"):
    if name not in s:
        s = s.replace(
            "</resources>",
            f'    <color name="{name}">#FFFFFFFF</color>\n</resources>',
        )
open(p, "w").write(s)
PY

# 4. Cold-start splash, both generations: Android 12+ system splash via the
# windowSplashScreen* theme items; older versions via windowBackground.
cat > "$RES/drawable/splash_icon.xml" <<'XML'
<?xml version="1.0" encoding="utf-8"?>
<!-- Splash icon for the Android 12+ system splash. The system crops it to a
     circle; the inset keeps the wide ibl.ai wordmark inside that circle.
     References the foreground PNG directly - @mipmap/ic_launcher is an
     adaptive-icon XML here and several drawable contexts cannot inflate
     that (it crashed the app when a <bitmap> pointed at it). -->
<inset xmlns:android="http://schemas.android.com/apk/res/android"
    android:drawable="@mipmap/ic_launcher_foreground"
    android:inset="25%" />
XML

cat > "$RES/drawable/splash_screen.xml" <<'XML'
<?xml version="1.0" encoding="utf-8"?>
<!-- Cold-start splash for Android < 12 (windowBackground); Android 12+ uses
     the windowSplashScreen* theme items instead and covers this. The bitmap
     points at the foreground PNG: @mipmap/ic_launcher is an adaptive-icon
     XML, and <bitmap> cannot inflate that (startup crash). -->
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item android:drawable="@color/splash_background" />
    <item
        android:width="160dp"
        android:height="160dp"
        android:gravity="center">
        <bitmap
            android:gravity="fill"
            android:src="@mipmap/ic_launcher_foreground" />
    </item>
</layer-list>
XML

for f in "$RES/values/themes.xml" "$RES/values-night/themes.xml"; do
  cat > "$f" <<'XML'
<resources xmlns:tools="http://schemas.android.com/tools">
    <!-- Base application theme. -->
    <style name="Theme.ibl_ai_os" parent="Theme.MaterialComponents.DayNight.NoActionBar">
        <!-- Cold-start splash. Android 12+ renders the system splash from the
             windowSplashScreen* items (white ground, centered ibl.ai mark);
             older versions show the windowBackground drawable until the
             webview paints. Kept white in dark mode too - the web app boots
             on a white loader, so a dark splash would flash. -->
        <item name="android:windowBackground">@drawable/splash_screen</item>
        <item name="android:windowSplashScreenBackground" tools:targetApi="31">@color/splash_background</item>
        <item name="android:windowSplashScreenAnimatedIcon" tools:targetApi="31">@drawable/splash_icon</item>
        <!-- Fitted (non-edge-to-edge) layout: the WebView cannot read the
             display-cutout insets from CSS, so drawing under the notch hides
             the app's top bar. Android 15 forces edge-to-edge for
             targetSdk 35+ unless opted out. Bars are white with dark icons,
             matching the app's header. -->
        <item name="android:windowOptOutEdgeToEdgeEnforcement" tools:targetApi="35">true</item>
        <item name="android:statusBarColor">@color/splash_background</item>
        <item name="android:navigationBarColor">@color/splash_background</item>
        <item name="android:windowLightStatusBar" tools:targetApi="23">true</item>
        <item name="android:windowLightNavigationBar" tools:targetApi="27">true</item>
    </style>
</resources>
XML
done

# 5. Fitted layout: the template's MainActivity calls enableEdgeToEdge(),
# which puts the webview under the notch/status bar while the WebView
# reports env(safe-area-inset-*) as 0 - the app's top bar becomes
# unreachable. Rewrite it to plain fitted decor (the theme above also opts
# out of Android 15's edge-to-edge enforcement).
cat > "$RES/../java/ai/ibl/mentorai/MainActivity.kt" <<'KT'
package ai.ibl.mentorai

import android.os.Bundle

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    // Deliberately NOT calling enableEdgeToEdge() (the template default):
    // Android's WebView reports env(safe-area-inset-*) as 0, so an
    // edge-to-edge webview puts the app's top bar behind the notch/status
    // bar with no way for CSS to compensate. Fitted decor lays the webview
    // out below the status bar; the theme paints that bar white with dark
    // icons to match the app's header.
    super.onCreate(savedInstanceState)
  }
}
KT

echo "Android branding applied (icons + adaptive icon + splash)."
