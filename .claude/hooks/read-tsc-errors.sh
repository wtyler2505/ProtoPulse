#!/bin/bash
# PostToolUse hook: Show recent tsc errors after file edits
# Always exits 0 — informational only

LOG_FILE="/home/wtyler/Projects/ProtoPulse/.claude/.tsc-errors.log"
STATE_FILE="/home/wtyler/Projects/ProtoPulse/.claude/.tsc-errors.log.last-line"

if [ ! -f "$LOG_FILE" ]; then
  echo "{}"; exit 0
fi

# Only surface lines added since the last time this hook ran — otherwise a
# stale watch-mode kill (tsc-watch died, log stopped changing) gets re-reported
# as a fresh error on every single Edit forever.
TOTAL_LINES=$(wc -l < "$LOG_FILE" 2>/dev/null || echo 0)
LAST_SEEN=$(cat "$STATE_FILE" 2>/dev/null || echo 0)

if [ "$TOTAL_LINES" -le "$LAST_SEEN" ]; then
  echo "{}"; exit 0
fi

NEW_LINES=$(tail -n "+$((LAST_SEEN + 1))" "$LOG_FILE" 2>/dev/null)
echo "$TOTAL_LINES" > "$STATE_FILE"

ERRORS=$(echo "$NEW_LINES" | tail -20 | grep -v "Starting compilation" | grep -v "Found 0 errors" | grep -v "File change detected" | grep -v "^$")

if [ -n "$ERRORS" ]; then
  # Errors found — include in systemMessage (not stderr!)
  SAFE_ERRORS=$(echo "$ERRORS" | head -5 | tr '\n' ' | ' | sed 's/"/\\"/g')
  printf '{"systemMessage": "TSC errors: %s"}' "$SAFE_ERRORS"
else
  echo '{}'
fi
exit 0
