#!/bin/bash
# PostToolUse hook: Show recent tsc errors after file edits
# Always exits 0 — informational only

LOG_FILE="/home/wtyler/Projects/ProtoPulse/.claude/.tsc-errors.log"

if [ ! -f "$LOG_FILE" ]; then
  exit 0
fi

# Only show output if the log has actual errors (not just "Starting compilation" or "Found 0 errors")
ERRORS=$(tail -20 "$LOG_FILE" 2>/dev/null | grep -v "Starting compilation" | grep -v "Found 0 errors" | grep -v "File change detected" | grep -v "^$")

if [ -n "$ERRORS" ]; then
  echo "Recent tsc --watch output:" >&2
  echo "$ERRORS" >&2
fi

exit 0
