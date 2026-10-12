#!/bin/bash
# The Homebrew formula installed, nothing running: the app starts
# `<brew prefix>/bin/ollama serve` itself.
. "$(dirname "$0")/lib.sh"
brew install ollama
if ollama_up; then echo "unexpected: ollama already running" >&2; exit 1; fi
expose_cli "$(brew --prefix)/bin"
report
