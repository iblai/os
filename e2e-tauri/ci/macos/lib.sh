#!/bin/bash
# Shared by the scenario scripts: they put a DISPOSABLE macOS VM into one Ollama
# setup before the e2e runs, so they refuse anywhere else.
set -euo pipefail

if [ "${RUNNER_ENVIRONMENT:-}" != "github-hosted" ] && [ "${TAURI_E2E_SCENARIO_FORCE:-}" != "1" ]; then
  echo "refusing: this script mutates the machine (brew, /Applications, pkill)." >&2
  echo "run it on a disposable VM, or set TAURI_E2E_SCENARIO_FORCE=1." >&2
  exit 1
fi

export HOMEBREW_NO_AUTO_UPDATE=1 HOMEBREW_NO_INSTALL_CLEANUP=1 HOMEBREW_NO_ENV_HINTS=1
OLLAMA_VERSION="${OLLAMA_VERSION:-v0.40.3}"
OLLAMA_APP=/Applications/Ollama.app
OLLAMA_PATHS=(/Applications/Ollama.app /opt/homebrew/bin/ollama /usr/local/bin/ollama)

ollama_up() { curl -fsS -m 2 http://127.0.0.1:11434/api/version >/dev/null 2>&1; }

wait_for_ollama() {
  local deadline=$((SECONDS + ${1:-60}))
  until ollama_up; do
    if [ "$SECONDS" -ge "$deadline" ]; then
      echo "ollama never answered on :11434" >&2
      return 1
    fi
    sleep 2
  done
}

# The runner must look like a Mac that never had Ollama.
assert_fresh() {
  local p
  for p in "${OLLAMA_PATHS[@]}"; do
    if [ -e "$p" ]; then
      echo "not fresh: $p exists" >&2
      exit 1
    fi
  done
  if ollama_up; then
    echo "not fresh: something answers on :11434" >&2
    exit 1
  fi
}

# Put a CLI dir on the job's PATH for the specs' `ollama rm` (no-op outside Actions).
expose_cli() {
  if [ -n "${GITHUB_PATH:-}" ]; then echo "$1" >> "$GITHUB_PATH"; fi
}

report() {
  local p b
  echo "--- the machine as the app will see it ---"
  for p in "${OLLAMA_PATHS[@]}"; do
    if [ -e "$p" ]; then echo "present: $p"; else echo "absent:  $p"; fi
  done
  for b in /opt/homebrew/bin/ollama /usr/local/bin/ollama "$OLLAMA_APP/Contents/Resources/ollama"; do
    if [ -x "$b" ]; then echo "version: $("$b" --version 2>&1 | head -1)"; break; fi
  done
  if ollama_up; then echo ":11434 open"; else echo ":11434 closed"; fi
  if [ -e /opt/homebrew/bin/brew ] || [ -e /usr/local/bin/brew ]; then echo "brew: present"; else echo "brew: absent"; fi
}

# Back to a Mac that never had Ollama, whichever route put it there (a setup
# script or the app itself), so the next row starts clean on the same VM.
reset_machine() {
  local b
  pkill -x ibl-ai-os || true
  pkill -x Ollama || true
  pkill -x ollama || true
  for b in /opt/homebrew/bin/brew /usr/local/bin/brew; do
    if [ -e "$b.off" ]; then sudo mv "$b.off" "$b"; fi
  done
  if command -v brew >/dev/null 2>&1; then
    brew services stop ollama >/dev/null 2>&1 || true
    brew uninstall --formula ollama >/dev/null 2>&1 || true
    brew uninstall --cask ollama-app >/dev/null 2>&1 || true
  fi
  sudo rm -rf "$OLLAMA_APP" /usr/local/bin/ollama /usr/local/lib/ollama-e2e
  rm -rf "$HOME/.ollama"
  for b in 1 2 3 4 5 6 7 8 9 10; do
    if ollama_up; then sleep 1; else break; fi
  done
  assert_fresh
}
