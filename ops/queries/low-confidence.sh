#!/usr/bin/env bash
# low-confidence.sh — Find notes marked experimental or likely (candidates for verification)
# Usage: bash ops/queries/low-confidence.sh

set -euo pipefail
cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

echo "=== Low-Confidence Notes (candidates for verification) ==="
echo ""

for level in experimental likely; do
  matches=$(rg -l "^confidence: $level" knowledge/ 2>/dev/null || true)
  if [ -n "$matches" ]; then
    echo "  $level:"
    for note in $matches; do
      basename_no_ext=$(basename "$note" .md)
      desc=$(rg '^description:' "$note" 2>/dev/null | head -1 | sed 's/^description: *//' || echo "")
      echo "    - $basename_no_ext"
      [ -n "$desc" ] && echo "      $desc"
    done
    echo ""
  fi
done

exp_count=$(rg -c "^confidence: experimental" knowledge/ 2>/dev/null | wc -l || echo "0")
likely_count=$(rg -c "^confidence: likely" knowledge/ 2>/dev/null | wc -l || echo "0")
echo "  Experimental: $exp_count | Likely: $likely_count"
echo "  Run /verify on high-value notes to promote confidence levels."
