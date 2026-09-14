#!/usr/bin/env bash
# Per-journey residue bisect: runs each spec in isolation with the stale
# sweepers disabled and records the mentor/project count delta per spec.
#
# Usage: DM_URL=https://api.stg1.iblai.org/dm e2e/scripts/bisect-residue.sh [spec|glob ...]
#   PROJECT  playwright project (default mentor-desktop-chrome)
#   OUT      output dir (default e2e/.residue/bisect-<timestamp>)
set -u
cd "$(dirname "$0")/../.."
: "${DM_URL:?set DM_URL (DM API base incl. /dm)}"
export E2E_SKIP_SWEEP=1 E2E_STRICT_COUNTS=1 PLAYWRIGHT_HTML_OPEN=never
PROJECT=${PROJECT:-mentor-desktop-chrome}
OUT=${OUT:-e2e/.residue/bisect-$(date +%Y%m%d-%H%M%S)}
mkdir -p "$OUT" playwright/.auth
for b in chrome edge safari firefox; do
  echo '{"cookies":[],"origins":[]}' > "playwright/.auth/user-$b.json"
done

if [ $# -gt 0 ]; then specs=("$@"); else specs=(e2e/journeys/*.spec.ts); fi
summary="$OUT/summary.tsv"
printf 'n\tspec\tmentors_before\tmentors_after\tmentors_delta\tprojects_before\tprojects_after\tprojects_delta\tpassed\tfailed\tteardown_status\n' | tee "$summary"

n=0
leaked=0
for spec in "${specs[@]}"; do
  n=$((n + 1))
  base=$(basename "$spec" .spec.ts)
  log="$OUT/$n-$base.log"
  E2E_RUN_ID="bisect-$n-$base" pnpm exec playwright test \
    --config e2e/playwright.config.ts --project="$PROJECT" --reporter=list "$spec" 2>&1 | tee "$log"

  read -r mb ma md pb pa pd <<<"$(sed -n 's/.*\[e2e-residue\] counts [^:]*: mentors before=\([^ ]*\) after=\([^ ]*\) delta=\([^;]*\); projects before=\([^ ]*\) after=\([^ ]*\) delta=\([^ ]*\).*/\1 \2 \3 \4 \5 \6/p' "$log" | head -1)"
  passed=$(grep -oE '[0-9]+ passed' "$log" | tail -1 | grep -oE '[0-9]+')
  failed=$(grep -oE '[0-9]+ failed' "$log" | tail -1 | grep -oE '[0-9]+')
  if grep -q '\[e2e-residue\] teardown [^:]*: OK' "$log"; then td=OK
  elif grep -q '\[e2e-residue\] teardown-' "$log"; then td=FAIL
  else td=MISSING; fi

  printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n' \
    "$n" "$spec" "${mb:-?}" "${ma:-?}" "${md:-?}" "${pb:-?}" "${pa:-?}" "${pd:-?}" \
    "${passed:-0}" "${failed:-0}" "$td" | tee -a "$summary"

  if [ "${md:-?}" != 0 ] || [ "${pd:-?}" != 0 ]; then
    leaked=1
    awk '/\[e2e-residue\] new since runStart:/{p=1;print;next} p&&/^  /{print;next} p{exit}' "$log" > "$OUT/$n-$base.leaks.txt"
  fi
done

echo "summary: $summary"
exit $leaked
