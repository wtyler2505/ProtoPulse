#!/usr/bin/env bash
# type-distribution.sh — Count notes by type (claim, decision, concept, etc.)
# Usage: bash ops/queries/type-distribution.sh

set -euo pipefail
cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

echo "=== Note Type Distribution ==="
echo ""

for note_type in claim decision concept insight pattern debt-note need moc; do
  count=$(rg -c "^type: $note_type" knowledge/ 2>/dev/null | wc -l || echo "0")
  printf "  %-20s %s\n" "$note_type" "$count"
done

echo ""
total=$(ls knowledge/*.md 2>/dev/null | wc -l || echo "0")
echo "  Total notes: $total"
