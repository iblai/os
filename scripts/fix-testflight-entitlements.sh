#!/bin/bash
# Fix TestFlight build to include Associated Domains entitlement
# This forces Xcode to download fresh provisioning profiles with the capability

set -e

echo "==========================================="
echo "Fixing TestFlight Entitlements"
echo "==========================================="
echo ""

# Step 1: Delete old provisioning profiles
echo "Step 1: Deleting old provisioning profiles..."
rm -rf ~/Library/MobileDevice/Provisioning\ Profiles/*
echo "✓ Deleted old profiles"
echo ""

# Step 2: Clean derived data
echo "Step 2: Cleaning Xcode derived data..."
rm -rf ~/Library/Developer/Xcode/DerivedData/ibl-ai-os-*
echo "✓ Cleaned derived data"
echo ""

# Step 3: Clean build artifacts
echo "Step 3: Cleaning build artifacts..."
cd "$(dirname "$0")/../src-tauri"
rm -rf target/aarch64-apple-ios
rm -rf target/x86_64-apple-ios
rm -rf gen/apple/build
rm -rf gen/apple/Externals
echo "✓ Cleaned build artifacts"
echo ""

echo "==========================================="
echo "Next Steps in Xcode:"
echo "==========================================="
echo ""
echo "1. Open Xcode project:"
echo "   open gen/apple/ibl-ai-os.xcodeproj"
echo ""
echo "2. Select ibl-ai-os_iOS target → Signing & Capabilities"
echo ""
echo "3. Click on your Team dropdown and select your team again"
echo "   (This forces Xcode to download fresh provisioning profile)"
echo ""
echo "4. Verify you see:"
echo "   ✓ 'Associated Domains' capability listed"
echo "   ✓ 'applinks:mentorai.iblai.app' in the domains"
echo ""
echo "5. Product → Clean Build Folder (⌘⇧K)"
echo ""
echo "6. Product → Archive"
echo ""
echo "7. Distribute to TestFlight"
echo ""
echo "==========================================="
echo "After Installing from TestFlight:"
echo "==========================================="
echo ""
echo "1. Delete old app from iPhone completely"
echo "2. Restart iPhone"
echo "3. Install from TestFlight"
echo "4. Wait 5 minutes"
echo "5. Test from Notes app (not Safari!)"
echo ""
