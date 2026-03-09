#!/usr/bin/env sh

VERSION_FILE=".iblai-js-version"
PACKAGE="@iblai/iblai-js"

if [ ! -f "$VERSION_FILE" ]; then
  echo "fix-yalc: $VERSION_FILE not found, skipping yalc check."
  exit 0
fi

EXPECTED_VERSION=$(cat "$VERSION_FILE" | tr -d '[:space:]')

# Read current version from package.json using grep
CURRENT=$(grep "\"$PACKAGE\"" package.json | head -1 | sed 's/.*: *"\(.*\)".*/\1/')

# Check for yalc/file/link/portal references
case "$CURRENT" in
  file:*|link:*|portal:*|*.yalc*)
    echo ""
    echo "fix-yalc: $PACKAGE is using a local/yalc reference:"
    echo "  $CURRENT"
    echo ""
    echo "Replacing with registry version $EXPECTED_VERSION..."

    # Replace in package.json using sed
    sed -i.bak "s|\"$PACKAGE\": *\"[^\"]*\"|\"$PACKAGE\": \"$EXPECTED_VERSION\"|" package.json
    rm -f package.json.bak

    # Source nvm/fnm if available so pnpm can be found
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
    eval "$(fnm env 2>/dev/null)" || true

    echo "Running pnpm install..."
    pnpm install --no-frozen-lockfile

    git add package.json pnpm-lock.yaml
    git commit -m "fix: replace yalc $PACKAGE with registry version $EXPECTED_VERSION"

    echo ""
    echo "fix-yalc: Fixed. Please run 'git push' again."
    exit 1
    ;;
  *)
    exit 0
    ;;
esac
