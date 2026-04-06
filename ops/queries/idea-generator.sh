#!/usr/bin/env bash
# idea-generator.sh — Find feature opportunities from graph patterns
# Usage: bash ops/queries/idea-generator.sh

set -euo pipefail
cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

echo "=== Feature Opportunity Radar ==="
echo ""

echo "--- PATTERN: Strengths with no follow-through ---"
echo "   (Claims about what ProtoPulse does well, but with connected debt)"
echo ""
for f in knowledge/*.md; do
  [ -f "$f" ] || continue
  type=$(rg '^type:' "$f" 2>/dev/null | head -1 | sed 's/type: *//')
  [ "$type" = "claim" ] || continue
  title=$(head -20 "$f" | rg '^# ' | head -1 | sed 's/^# //')

  # Check if any linked notes are debt-notes
  links=$(rg -o '\[\[[^\]]+\]\]' "$f" 2>/dev/null | sed 's/\[\[//;s/\]\]//')
  for link in $links; do
    target="knowledge/$link.md"
    if [ -f "$target" ] && rg -q '^type: debt-note' "$target" 2>/dev/null; then
      debt_title=$(head -20 "$target" | rg '^# ' | head -1 | sed 's/^# //')
      echo "  OPPORTUNITY: Strengthen '$title'"
      echo "    BLOCKED BY: $debt_title"
      echo "    -> Fixing this debt would amplify an existing strength"
      echo ""
      break
    fi
  done
done

echo "--- PATTERN: Competitor advantages we could leapfrog ---"
echo "   (Insights about competitors + our unique strengths = leapfrog)"
echo ""
# Find competitor insights
rg -l '^type: insight' knowledge/ 2>/dev/null | while read f; do
  rg -qi 'flux\|kicad\|fritzing\|tinkercad' "$f" 2>/dev/null || continue
  title=$(head -20 "$f" | rg '^# ' | head -1 | sed 's/^# //')
  # Is there a connected claim about our strength?
  links=$(rg -o '\[\[[^\]]+\]\]' "$f" 2>/dev/null | sed 's/\[\[//;s/\]\]//')
  for link in $links; do
    target="knowledge/$link.md"
    if [ -f "$target" ] && rg -q '^type: claim' "$target" 2>/dev/null; then
      claim_title=$(head -20 "$target" | rg '^# ' | head -1 | sed 's/^# //')
      echo "  LEAPFROG: Combine our '$claim_title'"
      echo "    WITH: '$title'"
      echo "    -> AI-powered version of what competitors do manually"
      echo ""
      break
    fi
  done
done

echo "--- PATTERN: Dense topic map areas (where knowledge accumulates = where opportunity lives) ---"
echo ""
for moc in knowledge/*.md; do
  rg -q '^type: moc' "$moc" 2>/dev/null || continue
  name=$(basename "$moc" .md)
  total=$(rg -c "\[\[$name\]\]" knowledge/*.md 2>/dev/null | awk -F: '{s+=$2} END {print s+0}')
  [ "$total" -gt 5 ] && printf "  %-35s %d notes -> HIGH opportunity density\n" "$name" "$total"
done | sort -t' ' -k2 -rn

echo ""
echo "--- PATTERN: Isolated claims (insights that connect to nothing = unexplored territory) ---"
echo ""
for f in knowledge/*.md; do
  [ -f "$f" ] || continue
  type=$(rg '^type:' "$f" 2>/dev/null | head -1 | sed 's/type: *//')
  [ "$type" = "moc" ] && continue
  n=$(basename "$f" .md)
  incoming=$(rg -c "\[\[$n\]\]" knowledge/*.md 2>/dev/null | awk -F: '{s+=$2} END {print s+0}')
  [ "$incoming" -le 1 ] && echo "  UNEXPLORED: $(head -20 "$f" | rg '^# ' | head -1 | sed 's/^# //')"
done

echo ""
echo "Run /arscontexta:ask 'what features would have the highest impact?' for AI synthesis."
