#!/usr/bin/env bash
# stale-notes.sh — Find notes not modified in 30+ days
# Usage: bash ops/queries/stale-notes.sh [days]

set -euo pipefail
cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

DAYS="${1:-30}"
echo "=== Stale Notes (not modified in ${DAYS}+ days) ==="
echo ""

found=0
for note in knowledge/*.md; do
  [ -f "$note" ] || continue
  last_modified=$(git log -1 --format='%at' -- "$note" 2>/dev/null || stat -c '%Y' "$note" 2>/dev/null || echo "0")
  now=$(date +%s)
  age_days=$(( (now - last_modified) / 86400 ))
  if [ "$age_days" -ge "$DAYS" ]; then
    basename_no_ext=$(basename "$note" .md)
    confidence=$(rg '^confidence:' "$note" 2>/dev/null | head -1 | sed 's/^confidence: *//' || echo "unknown")
    echo "  - $basename_no_ext (${age_days}d old, confidence: $confidence)"
    found=$((found + 1))
  fi
done

if [ "$found" -eq 0 ]; then
  echo "  No stale notes. Everything has been touched recently."
else
  echo ""
  echo "$found note(s) may need revisiting. Run /revisit to update them with new context."
fi
