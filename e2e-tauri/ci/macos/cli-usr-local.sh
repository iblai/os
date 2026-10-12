#!/bin/bash
# A bare CLI from the official tarball, linked into /usr/local/bin (no .app, no
# Homebrew formula): the last of the app's three detection paths.
. "$(dirname "$0")/lib.sh"
tmp=$(mktemp -d)
curl -fsSL -o "$tmp/ollama-darwin.tgz" \
  "https://github.com/ollama/ollama/releases/download/$OLLAMA_VERSION/ollama-darwin.tgz"
echo "--- tarball layout ---"; tar tzf "$tmp/ollama-darwin.tgz" | head -20
sudo mkdir -p /usr/local/lib/ollama-e2e
sudo tar -xzf "$tmp/ollama-darwin.tgz" -C /usr/local/lib/ollama-e2e
bin=$(find /usr/local/lib/ollama-e2e -type f -perm -u+x -name ollama | head -1)
if [ -z "$bin" ]; then echo "no ollama executable in the tarball" >&2; exit 1; fi
sudo ln -sf "$bin" /usr/local/bin/ollama
expose_cli /usr/local/bin
report
