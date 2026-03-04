#!/bin/bash
# Verify that the installed app has Associated Domains entitlement
# This checks the actual installed app from TestFlight

set -e

echo "==========================================="
echo "Verifying Associated Domains Entitlement"
echo "==========================================="
echo ""

# Check if the app is installed on a connected device
BUNDLE_ID="ai.ibl.mentorai"

echo "Step 1: Checking installed app..."
echo ""

# For simulator or connected device, we can use codesign
# This requires the app to be installed

echo "To verify the entitlements in your TestFlight build:"
echo ""
echo "Option 1: Check on your iPhone"
echo "  1. Go to Settings → ibl.ai OS"
echo "  2. Look for any mention of 'Associated Domains' or 'Universal Links'"
echo "  3. Or go to Settings → General → VPN & Device Management"
echo ""

echo "Option 2: Download and inspect the IPA from App Store Connect"
echo "  1. Go to App Store Connect → My Apps → ibl.ai OS"
echo "  2. Go to TestFlight → iOS Builds → Version 1.1.7"
echo "  3. Click 'Download dSYM' button area and download the build"
echo "  4. Extract the IPA: unzip ibl-ai-os.ipa"
echo "  5. Check entitlements:"
echo "     codesign -d --entitlements - Payload/ibl-ai-os.app"
echo ""

echo "Option 3: Check provisioning profile in Xcode"
echo "  1. Open Xcode: open ../src-tauri/gen/apple/ibl-ai-os.xcodeproj"
echo "  2. Select ibl-ai-os_iOS target"
echo "  3. Go to Signing & Capabilities tab"
echo "  4. Under 'Provisioning Profile', click the (i) info button"
echo "  5. Check if 'Associated Domains' is listed in the capabilities"
echo ""

echo "==========================================="
echo "Correct Testing Methodology"
echo "==========================================="
echo ""

echo "❌ WRONG: These will NEVER work:"
echo "  - Typing URL in Safari's address bar"
echo "  - Pasting URL in Safari's address bar"
echo "  - Tapping links while browsing mentorai.iblai.app in Safari"
echo ""

echo "✅ CORRECT: Test from external sources:"
echo "  1. Open Notes app"
echo "  2. Create a new note"
echo "  3. Type: https://mentorai.iblai.app/mobile-sso-login?data=test"
echo "  4. Tap the link"
echo "  5. Expected: Banner 'Open in ibl.ai OS' → App opens"
echo ""

echo "Alternative: Reset iOS preference if you previously chose 'Open in Safari'"
echo "  1. In Notes app, LONG-PRESS the link (don't just tap)"
echo "  2. Select 'Open in ibl.ai OS' from the menu"
echo "  3. This resets the cached preference"
echo ""

echo "==========================================="
echo "If Universal Links Still Don't Work"
echo "==========================================="
echo ""

echo "1. Verify AASA file App ID matches:"
echo "   curl https://mentorai.iblai.app/.well-known/apple-app-site-association | grep appID"
echo "   Should show: L4FWRM8W5Z.ai.ibl.mentorai"
echo ""

echo "2. Use Apple's validation tool:"
echo "   https://search.developer.apple.com/appsearch-validation-tool/"
echo "   Enter domain: mentorai.iblai.app"
echo ""

echo "3. Complete refresh:"
echo "   - Delete app completely from iPhone"
echo "   - Restart iPhone"
echo "   - Wait 1 minute"
echo "   - Reinstall from TestFlight"
echo "   - Wait 10 minutes with WiFi on"
echo "   - Test from Notes app"
echo ""

echo "4. Fallback to custom URL scheme (always works):"
echo "   iblai://mentorai/mobile-sso-login?data=test"
echo ""
