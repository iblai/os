# Tauri iOS Setup and Troubleshooting

## Quick Start

The Makefile handles most iOS setup automatically:

```bash
# First time setup
make tauri-ios-init

# Development build (opens in simulator)
make tauri-ios-dev

# Production build
make tauri-ios-build
```

## Xcode Build Issues

### "cargo: command not found" Error

When building through Xcode (clicking Play button), you may encounter a `PhaseScriptExecution` error because Xcode cannot find the `cargo` command.

**Solution:**

The project includes an automatic fix script that runs with `make` commands. If you're building directly through Xcode, run this first:

```bash
cd apps/mentor
./scripts/fix-xcode-cargo-path.sh
```

This patches the Xcode project to include `~/.cargo/bin` in the PATH.

**Why this happens:**

Xcode uses a minimal PATH (`/usr/bin:/bin:/usr/sbin:/sbin`) that doesn't include `~/.cargo/bin` where Rust/Cargo is installed.

### Permanent System-Level Fix (Optional)

For a system-wide solution that works with all Xcode projects:

#### Option 1: Using launchctl (macOS)

```bash
# Add cargo to Xcode's environment
launchctl setenv PATH "$HOME/.cargo/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

# Restart Xcode for changes to take effect
killall Xcode
```

**Note:** This needs to be run after every system restart. To make it permanent, create a launch agent:

```bash
# Create launch agent directory if it doesn't exist
mkdir -p ~/Library/LaunchAgents

# Create the plist file
cat > ~/Library/LaunchAgents/setenv.PATH.plist <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>setenv.PATH</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>-c</string>
    <string>launchctl setenv PATH $HOME/.cargo/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
</dict>
</plist>
EOF

# Load the launch agent
launchctl load ~/Library/LaunchAgents/setenv.PATH.plist
```

#### Option 2: Using /etc/paths.d (requires sudo)

```bash
# Add cargo to system PATH (requires admin password)
echo "$HOME/.cargo/bin" | sudo tee /etc/paths.d/cargo

# Restart your terminal and Xcode
```

## Deep Link Configuration

The app supports both custom URL schemes and universal links:

### Custom URL Schemes (Development)

- **Scheme:** `iblai://`
- **Works in:** Development builds, simulators, and production
- **Configuration:** Automatic through Tauri deep-link plugin

### Universal Links (Production Only)

- **Domain:** `https://mentorai.iblai.app/*`
- **Works in:** Production builds only (requires App Store submission)
- **Requires:**
  - Apple App Site Association (AASA) file hosted at `https://mentorai.iblai.app/.well-known/apple-app-site-association`
  - Domain verification
  - Associated Domains entitlement

### Android App Links

- **Domain:** `https://mentorai.iblai.app/*`
- **Requires:**
  - Digital Asset Links file at `https://mentorai.iblai.app/.well-known/assetlinks.json`
  - SHA-256 fingerprint in manifest

## Building for Physical Devices

### iOS

1. **Open in Xcode:**

   ```bash
   open apps/mentor/src-tauri/gen/apple/ibl-ai-os.xcodeproj
   ```

2. **Configure Signing:**

   - Select the ibl-ai-os_iOS target
   - Go to "Signing & Capabilities"
   - Select your development team: `L4FWRM8W5Z`
   - Choose automatic or manual signing

3. **Select Device:**

   - Connect your iPhone via USB
   - Select it from the device dropdown in Xcode

4. **Build and Run:**
   - Click the Play button (⌘R)
   - First build may prompt for keychain access

### Android

1. **Build APK:**

   ```bash
   cd apps/mentor/src-tauri
   cargo tauri android build
   ```

2. **Install on Device:**

   **Via USB (ADB):**

   ```bash
   adb install src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release.apk
   ```

   **Via File Transfer:**

   - Copy APK to device
   - Open file and install
   - May need to enable "Install from Unknown Sources"

## Troubleshooting

### Build fails with "invalid configuration"

- Make sure you've removed invalid properties from `tauri.conf.json`
- The `plugins.deep-link` section should be empty or removed
- No `urlSchemes` in bundle configuration

### Deep links not working in development

- Universal links (https://) only work in production builds
- Use custom URL schemes (iblai://) for development testing

### "Could not find module" errors

- Run `pnpm install` in the root directory
- Make sure all packages are built: `pnpm build:packages`

### Xcode project regeneration

- If you run `cargo tauri ios init` again, it regenerates the Xcode project
- The fix script automatically runs with `make` commands
- Or manually run: `./scripts/fix-xcode-cargo-path.sh`

## Additional Resources

- [Tauri Mobile Documentation](https://tauri.app/v2/guides/distribute/mobile)
- [Tauri Deep Link Plugin](https://github.com/tauri-apps/plugins-workspace/tree/v2/plugins/deep-link)
- [Apple Universal Links](https://developer.apple.com/ios/universal-links/)
- [Android App Links](https://developer.android.com/training/app-links)
