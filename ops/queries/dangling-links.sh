#!/usr/bin/env bash
# dangling-links.sh — Find wiki-links that point to non-existent notes
# Usage: bash ops/queries/dangling-links.sh

set -euo pipefail
cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

echo "=== Dangling Links (wiki-links to non-existent notes) ==="
echo ""

found=0
for note in knowledge/*.md self/*.md ops/methodology/*.md; do
  [ -f "$note" ] || continue
  # Extract wiki-links
  links=$(rg -o '\[\[([^\]]+)\]\]' "$note" 2>/dev/null | sed 's/\[\[//;s/\]\]//' | sort -u || true)
  for link in $links; do
    # Check if target exists in any known location
    target_found=false
    for dir in knowledge self ops/methodology manual; do
      if [ -f "$dir/$link.md" ]; then
        target_found=true
        break
      fi
    done
    if [ "$target_found" = false ]; then
      echo "  $note -> [[$link]] (NOT FOUND)"
      found=$((found + 1))
    fi
  done
done

if [ "$found" -eq 0 ]; then
  echo "  No dangling links found. Graph is healthy."
else
  echo ""
  echo "$found dangling link(s) found. Create the missing notes or fix the link targets."
fi
