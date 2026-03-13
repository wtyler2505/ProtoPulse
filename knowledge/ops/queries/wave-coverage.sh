#!/usr/bin/env bash
# Show which development waves have insights documented
set -euo pipefail
echo "=== Insights by Wave ==="
rg '^wave:' knowledge/insights/ 2>/dev/null | sed 's/.*wave: //' | sed 's/"//g' | sort -n | uniq -c | sort -rn
echo ""
echo "=== Waves with No Insights ==="
max_wave=$(rg '^wave:' knowledge/insights/ 2>/dev/null | sed 's/.*wave: //' | sed 's/"//g' | sort -n | tail -1)
if [[ -n "$max_wave" ]]; then
  for i in $(seq 1 "$max_wave"); do
    count=$(rg -c "^wave: \"$i\"" knowledge/insights/ 2>/dev/null | wc -l || echo "0")
    if [[ "$count" -eq 0 ]]; then
      echo "  Wave $i"
    fi
  done
fi
