#!/bin/bash
# Clean iOS build artifacts to force fresh rebuild

set -e

echo "Cleaning iOS build artifacts..."

cd "$(dirname "$0")/../src-tauri"

# Clean Rust builds
echo "Cleaning Rust target directory..."
rm -rf target/aarch64-apple-ios
rm -rf target/x86_64-apple-ios

# Clean Xcode derived data
echo "Cleaning Xcode build artifacts..."
rm -rf gen/apple/build
rm -rf gen/apple/Externals
rm -rf ~/Library/Developer/Xcode/DerivedData/ibl-ai-os-*

echo "✓ Clean complete!"
echo ""
echo "Next steps:"
echo "1. Delete the app from your iPhone completely"
echo "2. Rebuild in Xcode with Release configuration"
echo "3. Wait 2-3 minutes after installation"
echo "4. Test from Notes app (not Safari)"
