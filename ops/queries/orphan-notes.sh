#!/usr/bin/env bash
# orphan-notes.sh — Find notes with no incoming wiki-links
# Usage: bash ops/queries/orphan-notes.sh

set -euo pipefail
cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

echo "=== Orphan Notes (no incoming wiki-links) ==="
echo ""

for note in knowledge/*.md; do
  [ -f "$note" ] || continue
  basename_no_ext=$(basename "$note" .md)
  # Count incoming links from other files (wiki-link format: [[title]])
  incoming=$(rg -l "\[\[$basename_no_ext\]\]" knowledge/ self/ ops/methodology/ 2>/dev/null | grep -cv "^$note$" || true)
  if [ "$incoming" -eq 0 ]; then
    desc=$(rg '^description:' "$note" 2>/dev/null | head -1 | sed 's/^description: *//' || echo "(no description)")
    echo "  - $basename_no_ext"
    echo "    $desc"
  fi
done

echo ""
echo "Orphan notes need connections. Run /connect to link them into the graph."
