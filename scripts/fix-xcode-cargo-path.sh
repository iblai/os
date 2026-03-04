#!/bin/bash
# Fix Xcode project to include cargo in PATH for iOS builds
# This script patches the auto-generated Xcode project to add cargo to PATH
# and enable release builds without dev server
# Run this after `cargo tauri ios init` or whenever the Xcode project is regenerated

set -e

PROJECT_FILE="src-tauri/gen/apple/ibl-ai-os.xcodeproj/project.pbxproj"

if [ ! -f "$PROJECT_FILE" ]; then
    echo "Error: Xcode project not found at $PROJECT_FILE"
    echo "Run 'cargo tauri ios init' first"
    exit 1
fi

echo "Patching Xcode project for Xcode builds..."

# Check if already patched with release build support
if grep -q "Building in RELEASE mode" "$PROJECT_FILE"; then
    echo "✓ Already patched - release build support enabled"
    exit 0
fi

# Check if partially patched (has PATH but not release support)
if grep -q '.cargo/bin' "$PROJECT_FILE" | grep -q "Build Rust Code"; then
    echo "✓ PATH is configured, but updating to add release build support..."
fi

# Create the new build script content
NEW_SCRIPT='export PATH=\"$HOME/.cargo/bin:$PATH\"\\n\\n# For Release builds, compile directly without dev server\\nif [ \"${CONFIGURATION}\" = \"release\" ] || [ \"${CONFIGURATION}\" = \"Release\" ]; then\\n  echo \"Building in RELEASE mode - no dev server needed\"\\n  cd \"$SRCROOT/../..\"\\n  \\n  # Build for each architecture\\n  for ARCH in ${ARCHS}; do\\n    if [ \"$ARCH\" = \"arm64\" ]; then\\n      TARGET=\"aarch64-apple-ios\"\\n    elif [ \"$ARCH\" = \"x86_64\" ]; then\\n      TARGET=\"x86_64-apple-ios\"\\n    else\\n      echo \"Unsupported architecture: $ARCH\"\\n      continue\\n    fi\\n    \\n    echo \"Building for $TARGET...\"\\n    cargo build --release --lib --target $TARGET\\n    \\n    # Copy library to expected location\\n    mkdir -p \"$SRCROOT/Externals/$ARCH/${CONFIGURATION}\"\\n    cp \"target/$TARGET/release/libibl_ai_os.a\" \"$SRCROOT/Externals/$ARCH/${CONFIGURATION}/libapp.a\"\\n  done\\n  \\n  echo \"Release build complete\"\\nelse\\n  # For Debug builds, use the normal Tauri dev workflow\\n  echo \"Building in DEBUG mode - requires dev server on localhost:3001\"\\n  cargo tauri ios xcode-script -v --platform ${PLATFORM_DISPLAY_NAME:?} --sdk-root ${SDKROOT:?} --framework-search-paths \"${FRAMEWORK_SEARCH_PATHS:?}\" --header-search-paths \"${HEADER_SEARCH_PATHS:?}\" --gcc-preprocessor-definitions \"${GCC_PREPROCESSOR_DEFINITIONS:-}\" --configuration ${CONFIGURATION:?} ${FORCE_COLOR} ${ARCHS:?}\\nfi'

# Replace the build script (handle both original and already-patched versions)
sed -i '' "s|shellScript = \"export PATH.*ARCHS:?}\";|shellScript = \"$NEW_SCRIPT\";|g" "$PROJECT_FILE"
sed -i '' "s|shellScript = \"cargo tauri ios xcode-script.*ARCHS:?}\";|shellScript = \"$NEW_SCRIPT\";|g" "$PROJECT_FILE"

# Ensure sandboxing override is present (only once per Build Rust Code section)
if ! grep -A 5 "Build Rust Code" "$PROJECT_FILE" | head -10 | grep -q "sandboxingOverride"; then
    sed -i '' '/name = "Build Rust Code";/,/shellScript =/ {
        /runOnlyForDeploymentPostprocessing = 0;/ {
            a\
			sandboxingOverride = 0;
        }
    }' "$PROJECT_FILE"
fi

# Verify the patch
if grep -q "Building in RELEASE mode" "$PROJECT_FILE"; then
    echo "✓ Successfully patched Xcode project"
    echo "  - Cargo is now in PATH for Xcode builds"
    echo "  - Release builds work without dev server"
    echo "  - Debug builds require dev server on localhost:3001"
    echo "  - Script sandboxing disabled for build phase"
else
    echo "✗ Failed to patch - please check the project file manually"
    exit 1
fi
