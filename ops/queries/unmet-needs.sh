#!/usr/bin/env bash
# unmet-needs.sh — Cross-reference user needs against implemented features
# Usage: bash ops/queries/unmet-needs.sh

set -euo pipefail
cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

echo "=== Unmet Needs Analysis ==="
echo ""

echo "--- USER NEEDS (from knowledge vault) ---"
echo ""
rg -l '^type: need' knowledge/ 2>/dev/null | while read f; do
  title=$(head -20 "$f" | rg '^# ' | head -1 | sed 's/^# //')
  desc=$(rg '^description:' "$f" 2>/dev/null | head -1 | sed 's/^description: *//' | tr -d '"')
  echo "  $title"
  [ -n "$desc" ] && echo "    $desc"
  echo ""
done

echo "--- DEBT THAT BLOCKS USER NEEDS ---"
echo ""
rg -l '^type: debt-note' knowledge/ 2>/dev/null | while read f; do
  title=$(head -20 "$f" | rg '^# ' | head -1 | sed 's/^# //')
  # Check if this debt connects to a need note via wiki-links
  links=$(rg -o '\[\[[^\]]+\]\]' "$f" 2>/dev/null | sed 's/\[\[//;s/\]\]//')
  for link in $links; do
    target="knowledge/$link.md"
    if [ -f "$target" ] && rg -q '^type: need' "$target" 2>/dev/null; then
      need_title=$(head -20 "$target" | rg '^# ' | head -1 | sed 's/^# //')
      echo "  BLOCKS: $title"
      echo "    -> $need_title"
      echo ""
    fi
  done
done

echo "--- IDEA DENSITY: Topics with most gap-relevant notes ---"
echo ""
for moc in knowledge/*.md; do
  rg -q '^type: moc' "$moc" 2>/dev/null || continue
  name=$(basename "$moc" .md)
  # Count how many debt/need/insight notes link to this MOC
  gap_count=0
  for f in knowledge/*.md; do
    [ "$f" = "$moc" ] && continue
    type=$(rg '^type:' "$f" 2>/dev/null | head -1 | sed 's/type: *//')
    case "$type" in debt-note|need|insight)
      if rg -q "\[\[$name\]\]" "$f" 2>/dev/null; then
        gap_count=$((gap_count + 1))
      fi
      ;;
    esac
  done
  [ "$gap_count" -gt 0 ] && printf "  %-30s %d gap-relevant notes\n" "$name" "$gap_count"
done | sort -t' ' -k2 -rn
