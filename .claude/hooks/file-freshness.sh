#!/bin/bash
# PreToolUse hook: Warn if a file was modified very recently (possible concurrent edit)
# Exit 0 always — warning only, never blocks

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.file_path // empty')

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

if [ ! -f "$FILE_PATH" ]; then
  exit 0
fi

# Get file modification time and current time in epoch seconds
FILE_MTIME=$(stat -c %Y "$FILE_PATH" 2>/dev/null)
CURRENT_TIME=$(date +%s)

if [ -z "$FILE_MTIME" ]; then
  exit 0
fi

DIFF=$((CURRENT_TIME - FILE_MTIME))

# Warn if file was modified less than 2 seconds ago
if [ "$DIFF" -lt 2 ] && [ "$DIFF" -ge 0 ]; then
  echo "Warning: $FILE_PATH was modified less than 2 seconds ago. Another process may be editing this file." >&2
fi

exit 0
