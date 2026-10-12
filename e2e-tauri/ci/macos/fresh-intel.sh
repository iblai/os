#!/bin/bash
# Same as fresh, on an Intel runner: the ollama formula has no x86_64 bottle,
# so the app's Homebrew route builds it from source.
exec "$(dirname "$0")/fresh.sh"
