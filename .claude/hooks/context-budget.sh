#!/bin/bash
# PostToolUse hook: Monitor transcript file size as a proxy for context budget
# Always exits 0 — informational warning only

# Derive the project slug from the working directory
# Claude Code uses the pattern: ~/.claude/projects/{slug}/
PROJECT_DIR="/home/wtyler/Projects/ProtoPulse"
SLUG=$(echo "$PROJECT_DIR" | sed 's|^/||' | sed 's|/|-|g')
TRANSCRIPT_DIR="$HOME/.claude/projects/-${SLUG}"

# If the directory doesn't exist with leading dash, try without
if [ ! -d "$TRANSCRIPT_DIR" ]; then
  SLUG=$(echo "$PROJECT_DIR" | sed 's|/|-|g')
  TRANSCRIPT_DIR="$HOME/.claude/projects/${SLUG}"
fi

if [ ! -d "$TRANSCRIPT_DIR" ]; then
  # Can't find transcript directory, silently exit
  exit 0
fi

# Find the most recently modified .jsonl file (current session transcript)
LATEST_TRANSCRIPT=$(find "$TRANSCRIPT_DIR" -name "*.jsonl" -type f -printf '%T@ %p\n' 2>/dev/null | sort -rn | head -1 | cut -d' ' -f2-)

if [ -z "$LATEST_TRANSCRIPT" ]; then
  exit 0
fi

FILE_SIZE=$(stat -c%s "$LATEST_TRANSCRIPT" 2>/dev/null)
if [ -z "$FILE_SIZE" ]; then
  exit 0
fi

# Warn at 500KB
WARN_THRESHOLD=512000
# Critical at 1MB
CRITICAL_THRESHOLD=1048576

if [ "$FILE_SIZE" -gt "$CRITICAL_THRESHOLD" ]; then
  SIZE_MB=$(echo "scale=1; $FILE_SIZE / 1048576" | bc)
  echo "CRITICAL: Session transcript is ${SIZE_MB}MB. Context window may be near capacity. Consider starting a new session." >&2
elif [ "$FILE_SIZE" -gt "$WARN_THRESHOLD" ]; then
  SIZE_KB=$(echo "scale=0; $FILE_SIZE / 1024" | bc)
  echo "Warning: Session transcript is ${SIZE_KB}KB. Context is getting large." >&2
fi

echo "{}"
exit 0
