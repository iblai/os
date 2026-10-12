#!/bin/bash
# Ollama.app installed but not running: the app has to `open -a Ollama` itself.
. "$(dirname "$0")/lib.sh"
brew install --cask ollama-app
sudo ln -sf "$OLLAMA_APP/Contents/Resources/ollama" /usr/local/bin/ollama
pkill -x Ollama || true
pkill -x ollama || true
if ollama_up; then echo "Ollama still answers after the kill" >&2; exit 1; fi
expose_cli /usr/local/bin
report
