#!/bin/bash
# PostToolUse hook: Show recent tsc errors after file edits
# Always exits 0 — informational only

LOG_FILE="/home/wtyler/Projects/ProtoPulse/.claude/.tsc-errors.log"

if [ ! -f "$LOG_FILE" ]; then
  echo "{}"; exit 0
fi

# Only show output if the log has actual errors (not just "Starting compilation" or "Found 0 errors")
ERRORS=$(tail -20 "$LOG_FILE" 2>/dev/null | grep -v "Starting compilation" | grep -v "Found 0 errors" | grep -v "File change detected" | grep -v "^$")

if [ -n "$ERRORS" ]; then
  # Errors found — include in systemMessage (not stderr!)
  SAFE_ERRORS=$(echo "$ERRORS" | head -5 | tr '\n' ' | ' | sed 's/"/\\"/g')
  printf '{"systemMessage": "TSC errors: %s"}' "$SAFE_ERRORS"
else
  echo '{}'
fi
exit 0
