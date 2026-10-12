#!/bin/bash
# Between two rows on the same VM: undo whatever the previous setup and the app installed.
. "$(dirname "$0")/lib.sh"
reset_machine
report
