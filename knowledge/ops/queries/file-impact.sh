#!/usr/bin/env bash
# Show which source files have the most insights referencing them
set -euo pipefail
echo "=== Most-Referenced Source Files ==="
rg 'affected_files:' knowledge/insights/ -A 5 2>/dev/null | \
  grep -oP '"[^"]+\.(ts|tsx|js)"' | \
  sed 's/"//g' | sort | uniq -c | sort -rn | head -20
