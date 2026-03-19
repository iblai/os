#!/usr/bin/env bash

# check-test-coverage.sh
# Enforce ≥95% line coverage on changed source files

set -euo pipefail

MIN_COVERAGE="${MIN_COVERAGE:-95}"
BASE_BRANCH="${BASE_BRANCH:-origin/main}"

SKIP_COVERAGE_FILES=(
  "providers/index.tsx"
)

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo_step()    { echo -e "\n${BLUE}→ $1${NC}"; }
echo_success() { echo -e "${GREEN}✔ $1${NC}"; }
echo_warn()    { echo -e "${YELLOW}⚠ $1${NC}"; }
echo_error()   { echo -e "${RED}✖ $1${NC}" >&2; }

should_skip_coverage() {
  local file="$1"
  for skip_pattern in "${SKIP_COVERAGE_FILES[@]}"; do
    if [[ "${file}" == *"${skip_pattern}"* ]]; then
      return 0
    fi
  done
  return 1
}

echo_step "Detecting changed files against ${BASE_BRANCH}..."

CHANGED_FILES=$(git diff --name-only "${BASE_BRANCH}"...HEAD 2>/dev/null || git diff --name-only HEAD~1 || echo "")

[[ -z "${CHANGED_FILES}" ]] && { echo_success "No changed files."; exit 0; }

SOURCE_FILES=()
for file in ${CHANGED_FILES}; do
  [[ -f "${file}" ]] || continue
  [[ "${file}" =~ \.(ts|tsx|js|jsx)$ ]] || continue
  if [[ "${file}" =~ (\.test\.|\.spec\.|\.d\.ts$|__tests__|__mocks__|types?\.ts$|constants?\.ts$|index\.ts$|vitest\.|setup\.ts$) ]]; then
    continue
  fi
  # Skip non-source directories
  if [[ "${file}" == e2e/* ]] || [[ "${file}" == scripts/* ]] || [[ "${file}" == public/* ]]; then
    continue
  fi
  SOURCE_FILES+=("${file}")
done

[[ ${#SOURCE_FILES[@]} -eq 0 ]] && { echo_success "No relevant source files changed."; exit 0; }

printf "Changed source files:\n"; for f in "${SOURCE_FILES[@]}"; do echo "  • $f"; done

include_args=()
for file in "${SOURCE_FILES[@]}"; do
  if should_skip_coverage "${file}"; then
    echo_warn "Excluding '${file}' from coverage (in exclusion list)"
    continue
  fi
  include_args+=("--coverage.include=${file}")
done

[[ ${#include_args[@]} -eq 0 ]] && { echo_success "All changed files are excluded from coverage."; exit 0; }

coverage_dir=$(mktemp -d)
trap "rm -rf '${coverage_dir}'" EXIT

cmd="npx vitest run --coverage --coverage.enabled --coverage.provider=istanbul --coverage.exclude=node_modules/** --coverage.reporter=json --coverage.reporter=text --coverage.reportsDirectory=${coverage_dir} --coverage.thresholds.lines=0 --coverage.thresholds.functions=0 --coverage.thresholds.branches=0 --coverage.thresholds.statements=0 ${include_args[*]}"

echo_step "Running coverage check..."
echo -e "${BLUE}Running:${NC} ${cmd}\n"

set +e
output=$(eval "${cmd}" 2>&1)
exit_code=$?
set -e

echo "${output}" | tail -n 80

if [[ ${exit_code} -ne 0 ]]; then
  echo_error "Tests failed"
  exit 1
fi

coverage_json="${coverage_dir}/coverage-final.json"

if [[ ! -f "${coverage_json}" ]]; then
  echo_error "Coverage JSON file not found at ${coverage_json}"
  exit 1
fi

OVERALL_SUCCESS=true
ws_abs_dir=$(pwd)

for file in "${SOURCE_FILES[@]}"; do
  if should_skip_coverage "${file}"; then
    echo_warn "Skipping coverage check for '${file}' (in exclusion list)"
    continue
  fi

  abs_file="${ws_abs_dir}/${file}"

  pct=$(node -e "
    const fs = require('fs');
    const data = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
    const targetAbs = process.argv[2];
    const targetRel = process.argv[3];

    let entry = data[targetAbs];
    if (!entry) {
      for (const [key, val] of Object.entries(data)) {
        if (key.endsWith('/' + targetRel) || key.endsWith('/' + targetRel.replace(/^\\.\\//,''))) {
          entry = val;
          break;
        }
      }
    }

    if (!entry || !entry.statementMap || !entry.s) {
      console.log('0');
      process.exit(0);
    }

    const lineHits = {};
    for (const [id, count] of Object.entries(entry.s)) {
      const stmt = entry.statementMap[id];
      if (!stmt) continue;
      const line = stmt.start.line;
      lineHits[line] = (lineHits[line] || 0) + count;
    }

    const totalLines = Object.keys(lineHits).length;
    const coveredLines = Object.values(lineHits).filter(v => v > 0).length;
    const pct = totalLines === 0 ? 100 : (coveredLines / totalLines) * 100;
    console.log(pct.toFixed(2));
  " "${coverage_json}" "${abs_file}" "${file}" 2>/dev/null) || pct="0"

  if [[ "${pct}" != "0" ]]; then
    echo -e "${BLUE}Match:${NC} '${file}' → ${pct}% lines"
  else
    echo_warn "No coverage data found for '${file}' - defaulting to 0%"
  fi

  if (( $(echo "${pct} < ${MIN_COVERAGE}" | bc -l) )); then
    echo_error "Low coverage: ${file}: ${pct}% < ${MIN_COVERAGE}%"
    OVERALL_SUCCESS=false
  else
    echo_success "${file}: ${pct}% ≥ ${MIN_COVERAGE}%"
  fi
done

echo ""
if [[ "${OVERALL_SUCCESS}" == true ]]; then
  echo_success "All changed files have ≥ ${MIN_COVERAGE}% line coverage!"
  exit 0
else
  echo_error "Coverage check FAILED."
  exit 1
fi
