#!/bin/bash
# Stage the ONNX Runtime WASM binaries that the on-device (`iblai`) TTS voice
# needs into public/ort/, so they are served same-origin.
#
# Why this exists: transformers.js -- pulled in by kokoro-js -- defaults its
# `wasmPaths` to https://cdn.jsdelivr.net/. This app's CSP `connect-src` does
# not allow that host, so the fetch is blocked and the model never initialises.
# lib/tts/config.ts points onnxruntime-web at `/ort/` instead; this script is
# what puts the files there.
#
# Source onnxruntime-web, NOT @huggingface/transformers. transformers' dist
# bundles only the `.jsep` (WebGPU) runtime, while onnxruntime-web ships both
# that and the plain CPU build. Which one gets requested is decided at runtime:
# a browser with WebGPU asks for ort-wasm-simd-threaded.jsep.wasm, a browser
# without it -- Firefox, where WebGPU is still off by default outside Windows --
# asks for ort-wasm-simd-threaded.wasm. Copying only the jsep pair meant Firefox
# 404'd on startup and the voice failed outright, while Chrome never noticed.
#
# The output is NOT committed (see .gitignore): the binaries total ~32 MB.
# Runs from `pnpm dev` and `pnpm build`.

set -e

DEST="public/ort"

# pnpm's isolated store means onnxruntime-web -- a transitive dependency of
# kokoro-js via transformers.js -- is not hoisted to node_modules/. Look for a
# hoisted layout first, then fall back to the store.
SRC=""
if [ -d "node_modules/onnxruntime-web/dist" ]; then
  SRC="node_modules/onnxruntime-web/dist"
else
  SRC=$(find node_modules/.pnpm -maxdepth 5 -type d \
    -path '*/onnxruntime-web/dist' -print -quit 2>/dev/null || true)
fi

if [ -z "$SRC" ] || [ ! -d "$SRC" ]; then
  echo "✗ Could not find onnxruntime-web/dist."
  echo "  It ships with kokoro-js — run 'pnpm install' and try again."
  exit 1
fi

echo "📦 Staging ONNX Runtime WASM assets from $SRC..."
mkdir -p "$DEST"

copied=0
for file in "$SRC"/ort-wasm-simd-threaded*.wasm "$SRC"/ort-wasm-simd-threaded*.mjs; do
  [ -e "$file" ] || continue
  cp "$file" "$DEST/"
  echo "  ✓ $(basename "$file")"
  copied=$((copied + 1))
done

# Both runtimes must be present, or one class of browser breaks at startup with
# a 404 that surfaces only as "the voice does nothing".
for required in \
  ort-wasm-simd-threaded.wasm \
  ort-wasm-simd-threaded.jsep.wasm; do
  if [ ! -f "$DEST/$required" ]; then
    echo "✗ $required is missing from $DEST/"
    echo "  Browsers without WebGPU need the plain build; those with it need .jsep."
    exit 1
  fi
done

echo "✅ $copied ONNX Runtime asset(s) staged in $DEST/"
