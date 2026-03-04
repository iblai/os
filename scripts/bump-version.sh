#!/bin/bash
# Bump iOS app version for TestFlight/App Store releases

set -e

if [ -z "$1" ]; then
    echo "Usage: ./bump-version.sh <new-version>"
    echo "Example: ./bump-version.sh 1.1.8"
    echo ""
    echo "Current version:"
    grep '"version"' ../src-tauri/tauri.conf.json | head -1
    exit 1
fi

NEW_VERSION="$1"

echo "Bumping version to $NEW_VERSION..."
echo ""

# Update tauri.conf.json
echo "1. Updating tauri.conf.json..."
sed -i '' "s/\"version\": \"[^\"]*\"/\"version\": \"$NEW_VERSION\"/" ../src-tauri/tauri.conf.json
echo "   ✓ Updated tauri.conf.json"

# Update Info.plist CFBundleShortVersionString
echo "2. Updating Info.plist (CFBundleShortVersionString)..."
sed -i '' "/<key>CFBundleShortVersionString<\/key>/,/<string>/ s|<string>[^<]*</string>|<string>$NEW_VERSION</string>|" ../src-tauri/gen/apple/ibl-ai-os_iOS/Info.plist
echo "   ✓ Updated CFBundleShortVersionString"

# Update Info.plist CFBundleVersion
echo "3. Updating Info.plist (CFBundleVersion)..."
sed -i '' "/<key>CFBundleVersion<\/key>/,/<string>/ s|<string>[^<]*</string>|<string>$NEW_VERSION</string>|" ../src-tauri/gen/apple/ibl-ai-os_iOS/Info.plist
echo "   ✓ Updated CFBundleVersion"

echo ""
echo "✓ Version bumped to $NEW_VERSION"
echo ""
echo "Next steps:"
echo "1. Open Xcode: open ../src-tauri/gen/apple/ibl-ai-os.xcodeproj"
echo "2. Product → Clean Build Folder (⌘⇧K)"
echo "3. Product → Archive"
echo "4. Distribute to TestFlight"
