#!/usr/bin/env bash
# Ensures all dependency versions in package.json are pinned (no ^ or ~ prefixes).
# Run as part of pre-commit hook to prevent unpinned versions from being committed.

set -euo pipefail

PACKAGE_JSON="${1:-package.json}"

if [ ! -f "$PACKAGE_JSON" ]; then
  echo "package.json not found at $PACKAGE_JSON"
  exit 1
fi

# Find any dependency version starting with ^ or ~
# Matches lines like: "@pkg/name": "^1.2.3" or "pkg": "~1.2.3"
UNPINNED=$(grep -nE '"[^"]+"\s*:\s*"[~^]' "$PACKAGE_JSON" || true)

if [ -n "$UNPINNED" ]; then
  echo "ERROR: Unpinned dependency versions found in $PACKAGE_JSON"
  echo "All versions must be exact (no ^ or ~ prefixes)."
  echo ""
  echo "Offending lines:"
  echo "$UNPINNED"
  echo ""
  echo "Fix: Replace '^x.y.z' or '~x.y.z' with 'x.y.z' (the exact resolved version from pnpm-lock.yaml)"
  exit 1
fi

echo "All dependency versions are pinned."
