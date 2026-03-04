#!/bin/bash
# Test and debug universal links setup
# This script helps verify that universal links are properly configured

set -e

echo "========================================="
echo "Universal Links Configuration Test"
echo "========================================="
echo ""

# Check AASA file
echo "1. Checking AASA file..."
AASA_URL="https://mentorai.iblai.app/.well-known/apple-app-site-association"
echo "   URL: $AASA_URL"

if curl -f -s "$AASA_URL" > /dev/null 2>&1; then
    echo "   ✓ AASA file is accessible"

    # Check content type
    CONTENT_TYPE=$(curl -sI "$AASA_URL" | grep -i "content-type" | awk '{print $2}' | tr -d '\r')
    echo "   Content-Type: $CONTENT_TYPE"

    if [[ "$CONTENT_TYPE" == "application/json"* ]]; then
        echo "   ✓ Content-Type is correct"
    else
        echo "   ✗ Content-Type should be 'application/json' (without charset)"
        echo "   Current: $CONTENT_TYPE"
    fi

    # Validate JSON
    AASA_CONTENT=$(curl -s "$AASA_URL")
    echo ""
    echo "   AASA Content:"
    echo "$AASA_CONTENT"
    echo ""
else
    echo "   ✗ AASA file is not accessible"
    exit 1
fi

# Check entitlements
echo "2. Checking entitlements file..."
ENTITLEMENTS_FILE="src-tauri/gen/apple/ibl-ai-os_iOS/ibl-ai-os_iOS.entitlements"
if [ -f "$ENTITLEMENTS_FILE" ]; then
    echo "   ✓ Entitlements file exists"
    DOMAIN=$(grep -o "applinks:[^<]*" "$ENTITLEMENTS_FILE" | sed 's/applinks://')
    echo "   Associated Domain: applinks:$DOMAIN"

    if [ "$DOMAIN" = "mentorai.iblai.app" ]; then
        echo "   ✓ Domain matches AASA file location"
    else
        echo "   ✗ Domain mismatch"
    fi
else
    echo "   ✗ Entitlements file not found"
fi

echo ""
echo "3. Checking Xcode project configuration..."
PROJECT_FILE="src-tauri/gen/apple/ibl-ai-os.xcodeproj/project.pbxproj"
if grep -q "CODE_SIGN_ENTITLEMENTS.*ibl-ai-os_iOS.entitlements" "$PROJECT_FILE"; then
    echo "   ✓ Entitlements file is configured in Xcode project"
else
    echo "   ✗ Entitlements file not properly configured in Xcode project"
fi

if grep -q "DEVELOPMENT_TEAM.*L4FWRM8W5Z" "$PROJECT_FILE"; then
    TEAM_ID=$(grep "DEVELOPMENT_TEAM" "$PROJECT_FILE" | head -1 | sed 's/.*= "\(.*\)";/\1/')
    echo "   ✓ Development team is set: $TEAM_ID"
else
    echo "   ✗ Development team not configured"
fi

echo ""
echo "========================================="
echo "Next Steps to Fix Universal Links"
echo "========================================="
echo ""
echo "1. ⚠️  CRITICAL: Enable Associated Domains in Apple Developer Portal"
echo "   - Go to: https://developer.apple.com/account/resources/identifiers/list"
echo "   - Find App ID: ai.ibl.mentorai"
echo "   - Enable 'Associated Domains' capability"
echo "   - Save"
echo ""
echo "2. Clean install the app:"
echo "   - Delete the app completely from your device"
echo "   - Build and install again (Xcode or 'make tauri-ios-build')"
echo "   - iOS will fetch and validate AASA on first install"
echo ""
echo "3. Test universal link (NOT from Safari address bar):"
echo "   a. Open Notes app"
echo "   b. Create note with: https://mentorai.iblai.app/mobile-sso-login?data=test"
echo "   c. Tap the link"
echo "   d. Should show banner: 'Open in ibl.ai OS'"
echo ""
echo "4. Debug with Console.app (if still not working):"
echo "   - Connect iPhone to Mac"
echo "   - Open Console.app"
echo "   - Device → Your iPhone"
echo "   - Search for: 'swcd' or 'associated domains'"
echo "   - Uninstall app, then reinstall while watching Console"
echo "   - Look for AASA validation messages"
echo ""
echo "5. Alternative: Use custom URL scheme for testing"
echo "   - Custom URL schemes work immediately: iblai://mentorai/sso-login"
echo "   - Universal links require proper signing + App Store/TestFlight"
echo ""
echo "========================================="
echo ""
echo "Quick Test Link (copy to Notes app):"
echo "https://mentorai.iblai.app/mobile-sso-login?data=test123"
echo ""
