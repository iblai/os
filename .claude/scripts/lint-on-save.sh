#!/usr/bin/env bash
# PostToolUse hook: auto-format + lint + typecheck edited .ts/.tsx/.js/.jsx files
set -euo pipefail

f=$(jq -r '.tool_input.file_path // .tool_response.filePath')

# Skip non-JS/TS files
echo "$f" | grep -qE '\.(ts|tsx|js|jsx)$' || exit 0

# Auto-fix formatting and lint issues
pnpm prettier --write "$f" 2>/dev/null || true
pnpm eslint --fix "$f" 2>/dev/null || true

# Check for TypeScript errors in this specific file
errs=$(pnpm tsc --noEmit 2>&1 | grep "^${f}" || true)
if [ -n "$errs" ]; then
  # Return errors as additional context so the model sees them
  printf '{"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"TypeScript errors in %s:\\n%s"}}' "$f" "$errs"
fi
