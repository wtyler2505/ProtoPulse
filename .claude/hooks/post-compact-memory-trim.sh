#!/usr/bin/env bash
# post-compact-memory-trim.sh — PostCompact hook
# After context compaction, check if MEMORY.md exceeds its size limit
# and surface a warning. The MEMORY.md limit is 24.4KB — ours is 39KB+.

set -euo pipefail

MEMORY_DIR="$HOME/.claude/projects/-home-wtyler-Projects-ProtoPulse/memory"
MEMORY_FILE="$MEMORY_DIR/MEMORY.md"

[ -f "$MEMORY_FILE" ] || exit 0

SIZE_KB=$(du -k "$MEMORY_FILE" 2>/dev/null | cut -f1)
LIMIT_KB=24

if [ "$SIZE_KB" -gt "$LIMIT_KB" ]; then
  LINE_COUNT=$(wc -l < "$MEMORY_FILE")
  echo "{\"systemMessage\": \"WARNING: MEMORY.md is ${SIZE_KB}KB (limit: ${LIMIT_KB}KB, ${LINE_COUNT} lines). Index entries are too long — context after line 200 gets truncated. Consider moving detail into topic files and keeping MEMORY.md index entries under 150 chars each.\"}"
else
  echo "{\"systemMessage\": \"MEMORY.md size OK: ${SIZE_KB}KB / ${LIMIT_KB}KB limit.\"}"
fi
