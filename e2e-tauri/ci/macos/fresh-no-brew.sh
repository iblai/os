#!/bin/bash
# A Mac without Homebrew: the app checks the two fixed brew paths, so moving the
# binary away sends install_ollama down the DMG route into /Applications.
. "$(dirname "$0")/lib.sh"
assert_fresh
for b in /opt/homebrew/bin/brew /usr/local/bin/brew; do
  if [ -e "$b" ]; then sudo mv "$b" "$b.off"; fi
done
report
