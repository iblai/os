#!/bin/bash
# Add dynamic export to all client component pages that don't have it

set -e

echo "Adding 'export const dynamic = force-dynamic' to client pages..."

# List of pages that need the fix
PAGES=(
  "app/platform/[tenantKey]/[mentorId]/analytics/financial/page.tsx"
  "app/platform/[tenantKey]/[mentorId]/analytics/page.tsx"
  "app/platform/[tenantKey]/[mentorId]/analytics/reports/page.tsx"
  "app/platform/[tenantKey]/[mentorId]/analytics/topics/page.tsx"
  "app/platform/[tenantKey]/[mentorId]/analytics/transcripts/page.tsx"
  "app/platform/[tenantKey]/[mentorId]/analytics/users/page.tsx"
  "app/platform/[tenantKey]/projects/[projectId]/[mentorId]/page.tsx"
)

for page in "${PAGES[@]}"; do
  if [ -f "$page" ]; then
    # Check if already has dynamic export
    if grep -q "export const dynamic" "$page"; then
      echo "✓ $page already has dynamic export"
    else
      # Add dynamic export after 'use client' line
      sed -i '' "/['\"]use client['\"];/a\\
\\
// Prevent static generation - this page uses browser APIs\\
export const dynamic = 'force-dynamic';
" "$page"
      echo "✓ Added dynamic export to $page"
    fi
  else
    echo "✗ File not found: $page"
  fi
done

echo ""
echo "Done! Rebuild the app with: pnpm build"
