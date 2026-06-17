#!/bin/bash
# Re-apply the custom URL scheme intent filters to the generated Android manifest.
#
# Why this exists:
#   The auth flow finishes by redirecting the system browser to a custom scheme,
#   iblai-mentor:///sso-login-complete?data=…, which must route back into the app.
#   iOS handles this scheme via its WebView delegate; Android requires an explicit
#   <intent-filter> in AndroidManifest.xml. Once the OS routes it, the deep-link
#   plugin emits the URL and handle_deep_link_url (src-tauri/src/lib.rs) navigates
#   the WebView to the real https completion URL.
#
#   src-tauri/gen/android is generated and gitignored, so a fresh checkout or a
#   `cargo tauri android init` loses the manifest edit. This script re-applies it
#   and is wired into the `tauri-android-*` Makefile targets so it runs before
#   every Android build. It is idempotent.
set -e

MANIFEST="$(dirname "$0")/../src-tauri/gen/android/app/src/main/AndroidManifest.xml"

if [ ! -f "$MANIFEST" ]; then
  echo "⚠ Android manifest not found at: $MANIFEST"
  echo "  Run 'cargo tauri android init' (make tauri-android-init) first."
  exit 0
fi

if grep -q 'android:scheme="iblai-mentor"' "$MANIFEST"; then
  echo "✓ Custom-scheme intent filters already present in AndroidManifest.xml — nothing to do."
  exit 0
fi

echo "→ Injecting iblai-mentor / ai.ibl.mentorai intent filters into AndroidManifest.xml…"

# Insert the filters immediately before the closing </activity> of MainActivity
# (the manifest has a single <activity>).
awk '
  /<\/activity>/ && !done {
    print "            <!-- Custom URL scheme for the SSO deep-link return from the"
    print "                 system browser (iblai-mentor:///sso-login-complete?data=…)."
    print "                 iOS handles this scheme via its WebView delegate; Android"
    print "                 needs an explicit intent filter so the OS routes the redirect"
    print "                 back into the app. Re-applied by"
    print "                 scripts/android-add-deep-link-scheme.sh because gen/android is"
    print "                 generated/gitignored. Custom schemes cannot use autoVerify. -->"
    print "            <intent-filter>"
    print "                <action android:name=\"android.intent.action.VIEW\" />"
    print "                <category android:name=\"android.intent.category.DEFAULT\" />"
    print "                <category android:name=\"android.intent.category.BROWSABLE\" />"
    print "                <data android:scheme=\"iblai-mentor\" />"
    print "            </intent-filter>"
    print "            <intent-filter>"
    print "                <action android:name=\"android.intent.action.VIEW\" />"
    print "                <category android:name=\"android.intent.category.DEFAULT\" />"
    print "                <category android:name=\"android.intent.category.BROWSABLE\" />"
    print "                <data android:scheme=\"ai.ibl.mentorai\" />"
    print "            </intent-filter>"
    done = 1
  }
  { print }
' "$MANIFEST" > "$MANIFEST.tmp" && mv "$MANIFEST.tmp" "$MANIFEST"

echo "✓ Intent filters injected into AndroidManifest.xml."
