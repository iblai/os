#!/bin/bash
# The Homebrew formula run as a brew service: launchd keeps `ollama serve` alive,
# so the app's pkill-based stop and cancel bounce meet a server that comes back.
. "$(dirname "$0")/lib.sh"
brew install ollama
brew services start ollama
wait_for_ollama 120
expose_cli "$(brew --prefix)/bin"
report
