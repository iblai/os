#!/bin/bash
# Force iOS to re-download and validate the AASA file
# Use this when the AASA file has been updated on the server

set -e

echo "==========================================="
echo "Force iOS to Re-Download AASA File"
echo "==========================================="
echo ""

echo "Current AASA paths on server:"
curl -s https://mentorai.iblai.app/.well-known/apple-app-site-association | python3 -c "import sys, json; data = json.load(sys.stdin); [print(f'  ✓ {p}') for p in data['applinks']['details'][0]['paths']]"
echo ""

echo "==========================================="
echo "Steps to Force AASA Refresh:"
echo "==========================================="
echo ""

echo "1. On your iPhone:"
echo "   - Delete the app completely (long-press → Remove App → Delete App)"
echo "   - This clears the cached AASA validation"
echo ""

echo "2. Restart your iPhone:"
echo "   - Hold power button → Slide to power off"
echo "   - Wait 10 seconds"
echo "   - Power on"
echo "   - This ensures iOS clears all app-related caches"
echo ""

echo "3. Reinstall from TestFlight:"
echo "   - Open TestFlight app"
echo "   - Install ibl.ai OS"
echo "   - Keep iPhone connected to WiFi"
echo ""

echo "4. Wait 10-15 minutes:"
echo "   - iOS validates AASA in the background"
echo "   - Don't open the app immediately"
echo "   - Keep WiFi enabled"
echo ""

echo "5. Test all paths from Notes app:"
echo "   - Open Notes app"
echo "   - Create test links:"
echo "     • https://mentorai.iblai.app/sso-login"
echo "     • https://mentorai.iblai.app/mobile-sso-login"
echo "     • https://mentorai.iblai.app/sso-login?redirect-path=/test&data=123"
echo "   - Tap each link"
echo "   - All should open the app"
echo ""

echo "==========================================="
echo "Why This Is Necessary:"
echo "==========================================="
echo ""
echo "iOS caches the AASA file when the app is first installed."
echo "If you updated the AASA file after installation, iOS won't"
echo "automatically re-fetch it. The only way to force a refresh"
echo "is to completely delete and reinstall the app."
echo ""
echo "Since /sso-login works but /mobile-sso-login doesn't,"
echo "iOS is likely using an old cached AASA from before"
echo "/mobile-sso-login was added to the paths."
echo ""
