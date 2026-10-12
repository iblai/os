#!/bin/bash
# Ollama.app from the official zip (the ollama-app cask), running: the setup a
# user gets from ollama.com. The CLI link into /usr/local/bin is what the app's
# first launch would offer to create; pre-made so no dialog waits on a runner.
. "$(dirname "$0")/lib.sh"
brew install --cask ollama-app
sudo ln -sf "$OLLAMA_APP/Contents/Resources/ollama" /usr/local/bin/ollama
open -a Ollama
wait_for_ollama 120
expose_cli /usr/local/bin
report
