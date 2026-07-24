#!/usr/bin/env bash
#
# prune-static.sh — retention/GC for immutable per-deployment static assets.
#
# Keeps the newest KEEP_LAST deployments (by manifest upload time) plus whatever
# apps/<app>/current.json points at, and deletes the rest's
# apps/<app>/<version>/ tree + manifest. This is the ONLY thing that ever
# removes published assets — everything else is additive — so it runs on a
# schedule, defaults to a dry run, and always protects `current`.
#
# The keep window must exceed your rollback horizon: if you might roll back to
# vX, vX's assets must still be here. Bump KEEP_LAST accordingly.
#
# Required env: S3_BUCKET, S3_ENDPOINT, AWS_* (same as upload-static.sh)
# Optional env:
#   APP_NAME     default "os"
#   KEEP_LAST    number of most-recent deployments to retain (default 10)
#   DRY_RUN      "true" (DEFAULT) prints deletions without performing them;
#                set "false" to actually delete

set -euo pipefail

: "${S3_BUCKET:?S3_BUCKET is required}"
: "${S3_ENDPOINT:?S3_ENDPOINT is required}"

APP_NAME="${APP_NAME:-os}"
KEEP_LAST="${KEEP_LAST:-10}"
DRY_RUN="${DRY_RUN:-true}"

MANIFEST_PREFIX="s3://${S3_BUCKET}/apps/${APP_NAME}/manifest/"

aws_s3() { aws s3 --endpoint-url "${S3_ENDPOINT}" "$@"; }

echo "→ Retention for ${APP_NAME}: keep newest ${KEEP_LAST} + current (dry_run=${DRY_RUN})"

# Version pointed at by current.json — always protected.
CURRENT_VERSION="$(
  aws_s3 cp "s3://${S3_BUCKET}/apps/${APP_NAME}/current.json" - 2>/dev/null \
    | grep -o '"version"[[:space:]]*:[[:space:]]*"[^"]*"' \
    | head -1 | sed 's/.*"\([^"]*\)"$/\1/'
)" || true
echo "  current = ${CURRENT_VERSION:-<none>}"

# All deployment versions, newest first (manifest object LastModified).
ALL_VERSIONS="$(
  aws_s3 ls "${MANIFEST_PREFIX}" \
    | sort -r \
    | awk '{print $NF}' \
    | sed 's/\.json$//'
)"

[[ -z "${ALL_VERSIONS}" ]] && { echo "  no manifests found — nothing to do"; exit 0; }

KEEP_SET=$'\n'"${CURRENT_VERSION}"$'\n'
count=0
while IFS= read -r v; do
  [[ -z "$v" ]] && continue
  count=$((count + 1))
  if (( count <= KEEP_LAST )); then
    KEEP_SET+="${v}"$'\n'
  fi
done <<< "${ALL_VERSIONS}"

# Delete anything not in the keep set.
while IFS= read -r v; do
  [[ -z "$v" ]] && continue
  if grep -qxF "$v" <<< "${KEEP_SET}"; then
    continue
  fi
  echo "  ✖ prune ${APP_NAME} v${v}"
  if [[ "${DRY_RUN}" == "true" ]]; then
    echo "     DRY_RUN: would delete apps/${APP_NAME}/${v}/ and manifest/${v}.json"
  else
    aws_s3 rm "s3://${S3_BUCKET}/apps/${APP_NAME}/${v}/" --recursive --only-show-errors
    aws_s3 rm "s3://${S3_BUCKET}/apps/${APP_NAME}/manifest/${v}.json" --only-show-errors
  fi
done <<< "${ALL_VERSIONS}"

echo "✅ Retention pass complete"
