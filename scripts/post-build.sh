#!/bin/bash
# Post-build script to copy static assets for standalone deployment
# This is required because Next.js standalone output doesn't include static files

set -e

echo "📦 Copying static assets to standalone output..."

STANDALONE_DIR=".next/standalone/apps/mentor"

# Copy static files
if [ -d ".next/static" ]; then
  echo "  → Copying .next/static..."
  mkdir -p "$STANDALONE_DIR/.next"
  cp -R .next/static "$STANDALONE_DIR/.next/static"
  echo "  ✓ Copied .next/static"
else
  echo "  ✗ .next/static not found"
fi

# Copy public folder
if [ -d "public" ]; then
  echo "  → Copying public folder..."
  cp -R public "$STANDALONE_DIR/public"
  echo "  ✓ Copied public folder"
else
  echo "  ⚠ public folder not found"
fi

# Copy offline-shell if it exists
if [ -d "offline-shell" ]; then
  echo "  → Copying offline-shell..."
  cp -R offline-shell "$STANDALONE_DIR/offline-shell"
  echo "  ✓ Copied offline-shell"
fi

echo "✅ Static assets copied successfully!"
echo ""
echo "Standalone server is ready at: $STANDALONE_DIR/server.js"
