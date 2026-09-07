# macOS Builds: Mac App Store vs. Developer ID

The app ships in **two macOS variants** because Cowork (GhostOS) and the
Mac App Store are mutually exclusive.

|                  | MAS build                             | Developer ID build                          |
| ---------------- | ------------------------------------- | ------------------------------------------- |
| Config           | `src-tauri/tauri.conf.json` (default) | + `src-tauri/tauri.devid.conf.json` overlay |
| Entitlements     | `entitlements.mac.plist`              | `entitlements.devid.plist`                  |
| App Sandbox      | **on** (`app-sandbox = true`)         | **off**                                     |
| Signing identity | `Apple Distribution: …`               | `Developer ID Application: …`               |
| Distribution     | Mac App Store                         | Direct download (DMG), notarized            |
| Cowork works?    | ❌ no                                 | ✅ yes                                      |

## Why two builds

macOS blocks a **sandboxed** app from controlling _other_ apps through the
Accessibility API — even after the user grants Accessibility permission. So the
sandboxed MAS build can show the permission prompt but GhostOS can't actually
drive other apps. App Sandbox is required for the Mac App Store and not allowed
for what Cowork does, hence the split.

Accessibility itself needs no entitlement — it's a runtime (TCC) permission the
user grants in System Settings → Privacy & Security → Accessibility. The app
requests it via `tauri-plugin-macos-permissions` (the "Grant Access" button in
User Profile → Advanced → Cowork).

## Building

```bash
# Mac App Store (sandboxed) — uses the default config
pnpm tauri:build:mas

# Developer ID (non-sandboxed, Cowork works) — applies the overlay
pnpm tauri:build:devid
```

`tauri:build:devid` merges `src-tauri/tauri.devid.conf.json` over the base
config, swapping the signing identity and entitlements. Everything else
(hardened runtime, provider short name, min OS) is inherited.

## Post-build (distribution)

**Developer ID:** hardened-runtime `.app`/`.dmg` must be notarized:

```bash
xcrun notarytool submit "path/to/ibl.ai.dmg" \
  --apple-id "$APPLE_ID" --team-id L4FWRM8W5Z --password "$APP_SPECIFIC_PASSWORD" --wait
xcrun stapler staple "path/to/ibl.ai.dmg"
```

**Mac App Store:** the signed `.app` must be wrapped in a `.pkg` and uploaded:

```bash
xcrun productbuild --component "path/to/ibl.ai.app" /Applications "ibl.ai.pkg" \
  --sign "3rd Party Mac Developer Installer: Class Generation, LLC (L4FWRM8W5Z)"
xcrun altool --upload-app -f "ibl.ai.pkg" -t macos \
  --apple-id "$APPLE_ID" --password "$APP_SPECIFIC_PASSWORD"
```

## Prerequisites / certs

Both certificates live under the same team (`L4FWRM8W5Z`):

- **Apple Distribution** + a Mac App Store provisioning profile → MAS build.
- **Developer ID Application** (and **Developer ID Installer** if you also ship a
  signed installer) → Developer ID build.

If a cert is missing, signing fails. For unsigned local testing, set
`signingIdentity` to `"-"` (ad-hoc) in the relevant config.

> Note: the Developer ID signing identity string in `tauri.devid.conf.json` is a
> placeholder following Apple's naming (`Developer ID Application: Class
Generation, LLC (L4FWRM8W5Z)`). Adjust it to match the exact name in your
> keychain (`security find-identity -v -p codesigning`).
