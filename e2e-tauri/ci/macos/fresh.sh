#!/bin/bash
# A Mac that never had Ollama; Homebrew is there (every GitHub runner ships it).
# The app's install_ollama must take the Homebrew route.
. "$(dirname "$0")/lib.sh"
assert_fresh
report
