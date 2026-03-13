#!/usr/bin/env bash
# Find insights with no incoming wiki links (orphan detection)
# An orphan insight is one that no other insight or topic map references

set -euo pipefail

VAULT="knowledge/insights"
echo "=== Orphan Insights (no incoming links) ==="

for file in "$VAULT"/*.md; do
  [[ -f "$file" ]] || continue
  basename=$(basename "$file" .md)
  # Check if any other file links to this one
  link_count=$(rg -l "\[\[$basename\]\]" "$VAULT" 2>/dev/null | grep -v "$file" | wc -l | tr -d ' ')
  if [[ "$link_count" -eq 0 ]]; then
    echo "  ORPHAN: $basename"
  fi
done
