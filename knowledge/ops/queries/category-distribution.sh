#!/usr/bin/env bash
# Show insight distribution by category
set -euo pipefail
echo "=== Insights by Category ==="
rg '^category:' knowledge/insights/ 2>/dev/null | sed 's/.*category: //' | sort | uniq -c | sort -rn
echo ""
echo "=== Total ==="
find knowledge/insights -name '*.md' -not -name 'index.md' 2>/dev/null | wc -l | tr -d ' '
