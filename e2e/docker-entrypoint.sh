#!/bin/bash
# docker-entrypoint.sh — Playwright test runner with S3 log/report uploads
#
# Environment variables (passed from OCI Container Instance):
#   BROWSERS        Comma-separated browsers (default: chrome)
#   PLATFORM        Playwright project platform (default: mentor)
#   TEST_FILES      Comma-separated test files for selective execution (optional)
#   WORKERS         Playwright worker count (default: 1)
#   S3_BUCKET       S3 bucket for logs/reports (optional)
#   RUN_ID          Unique run identifier for S3 paths
#   AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION  AWS credentials
#   PR_NUMBER       PR number for test result caching (enables test resumption)
#   CLOUDFRONT_DOMAIN  Domain for viewing logs/reports (default: tests.iblai.app)

set -e

BROWSERS="${BROWSERS:-chrome}"
PLATFORM="${PLATFORM:-mentor}"
TEST_FILES="${TEST_FILES:-}"
WORKERS="${WORKERS:-1}"
S3_BUCKET="${S3_BUCKET:-}"
RUN_ID="${RUN_ID:-$(date +%Y%m%d-%H%M%S)}"
AWS_REGION="${AWS_REGION:-us-east-1}"
PR_NUMBER="${PR_NUMBER:-}"
CLOUDFRONT_DOMAIN="${CLOUDFRONT_DOMAIN:-tests.iblai.app}"

BROWSER_LIST=$(echo "$BROWSERS" | tr ',' ' ')
LOG_FILE="/tmp/test-run.log"
REPORT_DIR="/app/playwright-report"

# Determine app name for S3 paths
APP_NAME="$PLATFORM"

# Capture all output to log file while showing on console
exec > >(tee -a "$LOG_FILE") 2>&1

echo "================================================================================"
echo "Playwright Test Runner"
echo "================================================================================"
echo "Platform:   $PLATFORM"
echo "Browser(s): $BROWSER_LIST"
echo "Workers:    $WORKERS"
echo "Test Files: ${TEST_FILES:-all tests}"
echo "S3 Bucket:  ${S3_BUCKET:-(not set)}"
echo "Run ID:     $RUN_ID"
echo "PR Number:  ${PR_NUMBER:-(not set)}"
echo "App Name:   $APP_NAME"
echo "CloudFront: $CLOUDFRONT_DOMAIN"
echo "================================================================================"
echo ""

# --- S3 upload functions ---

upload_logs() {
  local exit_code=$1

  if [ -z "$S3_BUCKET" ] || [ -z "$AWS_ACCESS_KEY_ID" ]; then
    return 0
  fi

  echo "" >> "$LOG_FILE"
  echo "================================================================================" >> "$LOG_FILE"
  echo "Container Exit Code: $exit_code" >> "$LOG_FILE"
  echo "Completed: $(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$LOG_FILE"
  echo "================================================================================" >> "$LOG_FILE"

  S3_PATH="s3://$S3_BUCKET/runs/$RUN_ID/$APP_NAME/logs/test-run.log"
  echo "Uploading log to $S3_PATH" | tee -a "$LOG_FILE"

  if aws s3 cp "$LOG_FILE" "$S3_PATH" \
    --region "$AWS_REGION" \
    --content-type "text/plain; charset=utf-8" \
    --content-disposition "inline" 2>&1 | tee -a "$LOG_FILE"; then
    CLOUDFRONT_URL="https://${CLOUDFRONT_DOMAIN}/runs/${RUN_ID}/$APP_NAME/logs/test-run.log"
    echo "Log uploaded: $CLOUDFRONT_URL" | tee -a "$LOG_FILE"
  else
    echo "Failed to upload log" | tee -a "$LOG_FILE"
  fi
}

upload_report() {
  if [ ! -d "$REPORT_DIR" ] || [ -z "$S3_BUCKET" ] || [ -z "$AWS_ACCESS_KEY_ID" ]; then
    return 0
  fi

  S3_PREFIX="s3://$S3_BUCKET/runs/$RUN_ID/$APP_NAME/reports"
  echo "Uploading HTML report to $S3_PREFIX"
  aws s3 cp "$REPORT_DIR" "$S3_PREFIX/" --recursive --region "$AWS_REGION" 2>&1 || echo "Failed to upload report"
}

upload_traces() {
  local traces_dir="/app/test-results"
  if [ ! -d "$traces_dir" ] || [ -z "$S3_BUCKET" ] || [ -z "$AWS_ACCESS_KEY_ID" ]; then
    return 0
  fi

  echo ""
  echo "================================================================================"
  echo "Uploading Trace Files to S3"
  echo "================================================================================"

  TRACE_COUNT=0
  UPLOAD_SUCCESS=0

  while IFS= read -r -d '' trace_file; do
    TRACE_COUNT=$((TRACE_COUNT + 1))
    TEST_DIR=$(dirname "$trace_file")
    TEST_NAME=$(basename "$TEST_DIR")
    SAFE_NAME=$(echo "$TEST_NAME" | sed 's/[^a-zA-Z0-9._-]/_/g')
    S3_TRACE_PATH="s3://$S3_BUCKET/runs/$RUN_ID/$APP_NAME/traces/${SAFE_NAME}-trace.zip"

    if aws s3 cp "$trace_file" "$S3_TRACE_PATH" \
      --region "$AWS_REGION" \
      --content-type "application/zip" 2>&1; then
      UPLOAD_SUCCESS=$((UPLOAD_SUCCESS + 1))
      TRACE_URL="https://${CLOUDFRONT_DOMAIN}/runs/${RUN_ID}/$APP_NAME/traces/${SAFE_NAME}-trace.zip"
      echo "Uploaded: $TEST_NAME -> https://trace.playwright.dev/?trace=${TRACE_URL}"
    else
      echo "Failed to upload trace: $TEST_NAME"
    fi
  done < <(find "$traces_dir" -name "trace.zip" -print0 2>/dev/null)

  echo "Traces: $UPLOAD_SUCCESS/$TRACE_COUNT uploaded"
  echo ""
}

upload_test_results() {
  local exit_code=$1

  if [ -z "$PR_NUMBER" ]; then
    return 0
  fi

  if [ -z "$S3_BUCKET" ] || [ -z "$AWS_ACCESS_KEY_ID" ] || [ -z "$AWS_SECRET_ACCESS_KEY" ]; then
    return 0
  fi

  RESULTS_FILE="/app/test-results.json"
  if [ ! -f "$RESULTS_FILE" ]; then
    echo "No test-results.json found - skipping results upload"
    return 0
  fi

  BROWSER_KEY=$(echo "$BROWSERS" | tr ',' '-' | tr '[:upper:]' '[:lower:]')
  S3_RESULTS_PATH="s3://$S3_BUCKET/pr/$PR_NUMBER/$APP_NAME/test-results-${BROWSER_KEY}.json"

  echo ""
  echo "================================================================================"
  echo "Uploading Per-File Test Results (test resumption)"
  echo "================================================================================"
  echo "Browser:   $BROWSER_KEY"
  echo "PR Number: $PR_NUMBER"
  echo "S3 Path:   $S3_RESULTS_PATH"

  # Parse Playwright JSON results to extract per-file pass/fail
  NEW_RESULTS=$(jq '
    [.suites[] | recurse(.suites[]?) | .specs[]? | {file: .file, ok: .ok}] |
    group_by(.file) |
    map({key: .[0].file, value: (if all(.[]; .ok) then "passed" else "failed" end)}) |
    from_entries |
    {version: 1, tests: .}
  ' "$RESULTS_FILE" 2>/dev/null) || {
    echo "Failed to parse test-results.json - skipping"
    return 0
  }

  NEW_COUNT=$(echo "$NEW_RESULTS" | jq '.tests | length')
  NEW_PASSED=$(echo "$NEW_RESULTS" | jq '[.tests | to_entries[] | select(.value == "passed")] | length')
  NEW_FAILED=$(echo "$NEW_RESULTS" | jq '[.tests | to_entries[] | select(.value == "failed")] | length')
  echo "Current run: $NEW_COUNT files ($NEW_PASSED passed, $NEW_FAILED failed)"

  # Merge logic: full run replaces, selective run overlays
  if [ -z "$TEST_FILES" ]; then
    echo "Mode: Full run - replacing results"
    MERGED_RESULTS="$NEW_RESULTS"
  else
    echo "Mode: Selective run - merging with previous"
    PREV_FILE="/tmp/prev-test-results.json"
    if aws s3 cp "$S3_RESULTS_PATH" "$PREV_FILE" --region "$AWS_REGION" 2>/dev/null; then
      PREV_COUNT=$(jq '.tests | length' "$PREV_FILE" 2>/dev/null || echo "0")
      echo "Previous results: $PREV_COUNT files"
      MERGED_RESULTS=$(jq -s '
        {version: 1, tests: (.[0].tests // {} | to_entries | map({(.key): .value}) | add // {}) * (.[1].tests | to_entries | map({(.key): .value}) | add // {})} |
        {version: .version, tests: .tests}
      ' "$PREV_FILE" <(echo "$NEW_RESULTS") 2>/dev/null) || {
        echo "Merge failed - using current results only"
        MERGED_RESULTS="$NEW_RESULTS"
      }
    else
      echo "No previous results - using current"
      MERGED_RESULTS="$NEW_RESULTS"
    fi
  fi

  MERGED_COUNT=$(echo "$MERGED_RESULTS" | jq '.tests | length')
  MERGED_PASSED=$(echo "$MERGED_RESULTS" | jq '[.tests | to_entries[] | select(.value == "passed")] | length')
  MERGED_FAILED=$(echo "$MERGED_RESULTS" | jq '[.tests | to_entries[] | select(.value == "failed")] | length')
  echo "Merged: $MERGED_COUNT files ($MERGED_PASSED passed, $MERGED_FAILED failed)"

  echo "$MERGED_RESULTS" > /tmp/test-results-upload.json
  if aws s3 cp /tmp/test-results-upload.json "$S3_RESULTS_PATH" \
    --region "$AWS_REGION" \
    --content-type "application/json" 2>&1; then
    echo "Test results uploaded: $S3_RESULTS_PATH"
  else
    echo "Failed to upload test results"
  fi
  echo ""
}

# Trap: traces first, then test results, then logs (logs last so they capture upload output)
trap 'EXIT_CODE=$?; echo ""; echo "Caught exit with code: $EXIT_CODE"; upload_traces; upload_test_results $EXIT_CODE; upload_report; upload_logs $EXIT_CODE; echo "Final exit code: $EXIT_CODE"; exit $EXIT_CODE' EXIT

# --- Build test command ---

TEST_FILES_ARGS=""
if [ -n "$TEST_FILES" ]; then
  TEST_FILES_ARGS=$(echo "$TEST_FILES" | tr ',' ' ')
  echo "Selective execution: $TEST_FILES_ARGS"
  echo ""
fi

# --- Run tests per browser ---

OVERALL_EXIT_CODE=0
BROWSER_COUNT=0
BROWSER_PASSED=0
BROWSER_FAILED=0

for CURRENT_BROWSER in $BROWSER_LIST; do
  BROWSER_COUNT=$((BROWSER_COUNT + 1))
  PROJECT_NAME="${PLATFORM}-desktop-${CURRENT_BROWSER}"

  echo "================================================================================"
  echo "Browser $BROWSER_COUNT: $CURRENT_BROWSER (project: $PROJECT_NAME)"
  echo "================================================================================"

  CMD="npx playwright test --config e2e/playwright.config.ts --project=$PROJECT_NAME --workers=$WORKERS"

  if [ -n "$TEST_FILES_ARGS" ]; then
    CMD="$CMD $TEST_FILES_ARGS"
  fi

  echo "Command: $CMD"
  echo ""

  set +e
  CI=true NODE_ENV=production eval "$CMD" 2>&1
  EXIT_CODE=$?
  set -e

  if [ $EXIT_CODE -eq 0 ]; then
    echo "PASSED: $CURRENT_BROWSER"
    BROWSER_PASSED=$((BROWSER_PASSED + 1))
  else
    echo "FAILED: $CURRENT_BROWSER (exit: $EXIT_CODE)"
    BROWSER_FAILED=$((BROWSER_FAILED + 1))
    OVERALL_EXIT_CODE=1
  fi
  echo ""
done

echo "================================================================================"
echo "Test Summary: $BROWSER_COUNT browsers ($BROWSER_PASSED passed, $BROWSER_FAILED failed)"
echo "Exit code: $OVERALL_EXIT_CODE"
echo "================================================================================"

exit $OVERALL_EXIT_CODE
