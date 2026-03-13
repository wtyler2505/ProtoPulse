#!/usr/bin/env bash
# Find insights that might be outdated based on file modification time
# Insights older than 30 days with sparse connections are candidates for review
set -euo pipefail
echo "=== Potentially Stale Insights (modified 30+ days ago) ==="
find knowledge/insights -name '*.md' -not -name 'index.md' -mtime +30 2>/dev/null | while read -r file; do
  link_count=$(grep -c '\[\[' "$file" 2>/dev/null || echo "0")
  confidence=$(grep '^confidence:' "$file" 2>/dev/null | head -1 | sed 's/confidence: //' || echo "unknown")
  echo "  $(basename "$file" .md) — $link_count links, confidence: $confidence"
done
