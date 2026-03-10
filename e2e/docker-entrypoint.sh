#!/bin/bash
# docker-entrypoint.sh — Playwright test runner with S3 log/report uploads
#
# Environment variables (passed from OCI Container Instance):
#   BROWSERS        Comma-separated browsers (default: chrome)
#   PLATFORM        Playwright project platform (default: mentornextjs)
#   TEST_FILES      Comma-separated test files for selective execution (optional)
#   WORKERS         Playwright worker count (default: 1)
#   S3_BUCKET       S3 bucket for logs/reports (optional)
#   RUN_ID          Unique run identifier for S3 paths
#   AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION  AWS credentials
#   PR_NUMBER       PR number for test result caching

set -e

BROWSERS="${BROWSERS:-chrome}"
PLATFORM="${PLATFORM:-mentor}"
TEST_FILES="${TEST_FILES:-}"
WORKERS="${WORKERS:-1}"
S3_BUCKET="${S3_BUCKET:-}"
RUN_ID="${RUN_ID:-$(date +%Y%m%d-%H%M%S)}"
AWS_REGION="${AWS_REGION:-us-east-1}"
PR_NUMBER="${PR_NUMBER:-}"

BROWSER_LIST=$(echo "$BROWSERS" | tr ',' ' ')
LOG_FILE="/tmp/test-run.log"
REPORT_DIR="/app/playwright-report"

# Determine app name for S3 paths
APP_NAME="$PLATFORM"

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
  echo "Uploading log to $S3_PATH"
  aws s3 cp "$LOG_FILE" "$S3_PATH" --region "$AWS_REGION" 2>&1 || echo "Failed to upload log"
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

  TRACE_FILES=$(find "$traces_dir" -name "*.zip" 2>/dev/null || echo "")
  if [ -z "$TRACE_FILES" ]; then
    return 0
  fi

  S3_PREFIX="s3://$S3_BUCKET/runs/$RUN_ID/$APP_NAME/traces"
  echo "Uploading trace files to $S3_PREFIX"
  for trace_file in $TRACE_FILES; do
    aws s3 cp "$trace_file" "$S3_PREFIX/$(basename "$trace_file")" --region "$AWS_REGION" 2>&1 || true
  done
}

# Trap to ensure uploads happen even on failure
trap 'EXIT_CODE=$?; echo ""; echo "Caught exit with code: $EXIT_CODE"; upload_logs $EXIT_CODE; upload_report; upload_traces; echo "Final exit code: $EXIT_CODE"; exit $EXIT_CODE' EXIT

# --- Build test command ---

TEST_FILES_ARGS=""
if [ -n "$TEST_FILES" ]; then
  TEST_FILES_ARGS=$(echo "$TEST_FILES" | tr ',' ' ')
  echo "Selective execution: $TEST_FILES_ARGS"
  echo ""
fi

# --- Run tests per browser ---

OVERALL_EXIT_CODE=0

for CURRENT_BROWSER in $BROWSER_LIST; do
  PROJECT_NAME="${PLATFORM}-desktop-${CURRENT_BROWSER}"

  echo "================================================================================" | tee -a "$LOG_FILE"
  echo "Running: $PROJECT_NAME" | tee -a "$LOG_FILE"
  echo "================================================================================" | tee -a "$LOG_FILE"

  CMD="npx playwright test --config e2e/playwright.config.ts --project=$PROJECT_NAME --workers=$WORKERS"

  if [ -n "$TEST_FILES_ARGS" ]; then
    CMD="$CMD $TEST_FILES_ARGS"
  fi

  echo "Command: $CMD" | tee -a "$LOG_FILE"
  echo "" | tee -a "$LOG_FILE"

  set +e
  CI=true NODE_ENV=production eval "$CMD" 2>&1 | tee -a "$LOG_FILE"
  EXIT_CODE=${PIPESTATUS[0]}
  set -e

  if [ $EXIT_CODE -eq 0 ]; then
    echo "PASSED: $CURRENT_BROWSER" | tee -a "$LOG_FILE"
  else
    echo "FAILED: $CURRENT_BROWSER (exit: $EXIT_CODE)" | tee -a "$LOG_FILE"
    OVERALL_EXIT_CODE=1
  fi
  echo "" | tee -a "$LOG_FILE"
done

echo "================================================================================" | tee -a "$LOG_FILE"
echo "Tests completed with exit code: $OVERALL_EXIT_CODE" | tee -a "$LOG_FILE"
echo "================================================================================" | tee -a "$LOG_FILE"

exit $OVERALL_EXIT_CODE
