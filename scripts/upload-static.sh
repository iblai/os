#!/usr/bin/env bash
#
# upload-static.sh — publish this build's immutable static assets to object
# storage under apps/<app>/<version>/, then write the deployment manifest.
#
# Runs in CI AFTER `next build` (needs .next/static + public on disk and the
# storage credentials — never bake creds into the image). Layout:
#
#   s3://<bucket>/apps/<app>/<version>/_next/static/...   <- immutable, additive
#   s3://<bucket>/apps/<app>/<version>/public/...         <- immutable, additive
#   s3://<bucket>/apps/<app>/manifest/<version>.json      <- this build's record
#   s3://<bucket>/apps/<app>/current.json                 <- desired-live pointer
#
# The CDN's origin is the bucket, so a browser fetches
#   <NEXT_PUBLIC_ASSET_CDN>/apps/<app>/<version>/_next/static/...
# which mirrors these keys 1:1 (that same prefix is what next.config.ts bakes
# into every emitted asset URL).
#
# OCI Object Storage is addressed through its S3-compatible endpoint, so the
# plain AWS CLI works — auth is an OCI "Customer Secret Key" (access key/secret).
#
# Required env:
#   S3_BUCKET         object storage bucket name (e.g. ibl-static)
#   S3_ENDPOINT       S3-compat endpoint
#                     https://<namespace>.compat.objectstorage.<region>.oraclecloud.com
#   AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_REGION   OCI Customer Secret Key
#   VERSION           deployment id = release version (must match the built image)
#
# Optional env:
#   APP_NAME          default "os"
#   STATIC_DIR        default ".next/static"
#   PUBLIC_DIR        default "public"
#   GIT_SHA           recorded in the manifest (default "unknown")
#   IMAGE_TAG         recorded in the manifest (default "$VERSION")
#   UPDATE_CURRENT    "true" (default) also updates apps/<app>/current.json
#   DRY_RUN           "true" prints the aws commands without running them

set -euo pipefail

: "${S3_BUCKET:?S3_BUCKET is required}"
: "${S3_ENDPOINT:?S3_ENDPOINT is required}"
: "${VERSION:?VERSION (release version / deployment id) is required}"

APP_NAME="${APP_NAME:-os}"
STATIC_DIR="${STATIC_DIR:-.next/static}"
PUBLIC_DIR="${PUBLIC_DIR:-public}"
GIT_SHA="${GIT_SHA:-unknown}"
IMAGE_TAG="${IMAGE_TAG:-$VERSION}"
UPDATE_CURRENT="${UPDATE_CURRENT:-true}"
DRY_RUN="${DRY_RUN:-false}"

BASE="s3://${S3_BUCKET}/apps/${APP_NAME}/${VERSION}"
IMMUTABLE="public, max-age=31536000, immutable"

aws_s3() {
  if [[ "${DRY_RUN}" == "true" ]]; then
    echo "DRY_RUN: aws s3 --endpoint-url ${S3_ENDPOINT} $*"
  else
    aws s3 --endpoint-url "${S3_ENDPOINT}" "$@"
  fi
}

echo "→ Publishing ${APP_NAME} v${VERSION} static assets to ${BASE}"

if [[ ! -d "${STATIC_DIR}" ]]; then
  echo "✗ ${STATIC_DIR} not found — did 'next build' run?" >&2
  exit 1
fi

# NOTE: no --delete. Uploads are additive and immutable; older deployments'
# assets must survive for in-flight clients and rollback (see the retention job).
echo "  → _next/static"
aws_s3 sync "${STATIC_DIR}" "${BASE}/_next/static/" \
  --only-show-errors --cache-control "${IMMUTABLE}"

if [[ -d "${PUBLIC_DIR}" ]]; then
  echo "  → public"
  aws_s3 sync "${PUBLIC_DIR}" "${BASE}/public/" \
    --only-show-errors --cache-control "${IMMUTABLE}"
fi

# ---- manifest -------------------------------------------------------------
BUILT_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
ASSET_BASE="${NEXT_PUBLIC_ASSET_CDN:-<cdn-not-set>}/apps/${APP_NAME}/${VERSION}"
MANIFEST="$(cat <<JSON
{
  "app": "${APP_NAME}",
  "version": "${VERSION}",
  "deploymentId": "${VERSION}",
  "imageTag": "${IMAGE_TAG}",
  "gitSha": "${GIT_SHA}",
  "assetBase": "${ASSET_BASE}",
  "builtAt": "${BUILT_AT}"
}
JSON
)"

TMP="$(mktemp)"
trap 'rm -f "${TMP}"' EXIT
printf '%s\n' "${MANIFEST}" > "${TMP}"

echo "  → manifest/${VERSION}.json"
aws_s3 cp "${TMP}" "s3://${S3_BUCKET}/apps/${APP_NAME}/manifest/${VERSION}.json" \
  --only-show-errors --content-type application/json \
  --cache-control "no-cache"

if [[ "${UPDATE_CURRENT}" == "true" ]]; then
  echo "  → current.json (desired-live pointer)"
  aws_s3 cp "${TMP}" "s3://${S3_BUCKET}/apps/${APP_NAME}/current.json" \
    --only-show-errors --content-type application/json \
    --cache-control "no-cache"
fi

echo "✅ Published ${APP_NAME} v${VERSION}"
echo "   assets:   ${ASSET_BASE}/_next/static/"
echo "   manifest: s3://${S3_BUCKET}/apps/${APP_NAME}/manifest/${VERSION}.json"
