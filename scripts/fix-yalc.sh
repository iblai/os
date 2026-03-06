#!/usr/bin/env sh

VERSION_FILE=".iblai-js-version"
PACKAGE="@iblai/iblai-js"

if [ ! -f "$VERSION_FILE" ]; then
  echo "fix-yalc: $VERSION_FILE not found, skipping yalc check."
  exit 0
fi

EXPECTED_VERSION=$(cat "$VERSION_FILE" | tr -d '[:space:]')

# Read current version from package.json
CURRENT=$(node -e "const p=require('./package.json'); console.log(p.dependencies['$PACKAGE'] || '')")

# Check for yalc/file/link/portal references
case "$CURRENT" in
  file:*|link:*|portal:*|*.yalc*)
    echo ""
    echo "fix-yalc: $PACKAGE is using a local/yalc reference:"
    echo "  $CURRENT"
    echo ""
    echo "Replacing with registry version $EXPECTED_VERSION..."

    node -e "
      const fs = require('fs');
      let pkg = fs.readFileSync('package.json', 'utf8');
      pkg = pkg.replace(
        /\"$PACKAGE\":\s*\"[^\"]+\"/,
        '\"$PACKAGE\": \"$EXPECTED_VERSION\"'
      );
      fs.writeFileSync('package.json', pkg);
    "

    echo "Running pnpm install..."
    pnpm install --no-frozen-lockfile

    git add package.json pnpm-lock.yaml
    git commit -m "fix: replace yalc $PACKAGE with registry version $EXPECTED_VERSION"

    echo ""
    echo "fix-yalc: Fixed."
    exit 1
    ;;
  *)
    exit 0
    ;;
esac
