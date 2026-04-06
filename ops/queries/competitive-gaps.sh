#!/usr/bin/env bash
# competitive-gaps.sh — What competitors do that ProtoPulse doesn't
# Usage: bash ops/queries/competitive-gaps.sh [competitor]

set -euo pipefail
cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

COMPETITOR="${1:-}"

echo "=== Competitive Gap Analysis ==="
echo ""

if [ -n "$COMPETITOR" ]; then
  echo "Filter: $COMPETITOR"
  echo ""
fi

# Find all notes mentioning competitors
for f in knowledge/*.md; do
  [ -f "$f" ] || continue
  type=$(rg '^type:' "$f" 2>/dev/null | head -1 | sed 's/type: *//')
  [ "$type" = "moc" ] && continue

  # Check for competitor mentions
  if [ -n "$COMPETITOR" ]; then
    rg -qi "$COMPETITOR" "$f" 2>/dev/null || continue
  else
    rg -qi 'flux\|kicad\|fritzing\|tinkercad\|wokwi\|eagle\|altium\|easyeda\|orcad' "$f" 2>/dev/null || continue
  fi

  title=$(head -20 "$f" | rg '^# ' | head -1 | sed 's/^# //')
  confidence=$(rg '^confidence:' "$f" 2>/dev/null | head -1 | sed 's/confidence: *//')

  # Categorize
  if echo "$title" | rg -qi 'protopulse.*lead\|protopulse.*only\|protopulse.*more\|uncontested\|moat\|free'; then
    category="STRENGTH"
  elif echo "$title" | rg -qi 'weak\|missing\|gap\|threat\|behind\|lacks'; then
    category="GAP"
  else
    category="INSIGHT"
  fi

  echo "  [$category] [$type] $title"
  [ -n "$confidence" ] && echo "          confidence: $confidence"

  # Extract competitor mentions
  competitors=$(rg -oi 'flux\.ai\|kicad\|fritzing\|tinkercad\|wokwi\|eagle\|altium\|easyeda\|orcad' "$f" 2>/dev/null | sort -u | tr '\n' ', ' | sed 's/,$//')
  [ -n "$competitors" ] && echo "          mentions: $competitors"
  echo ""
done

echo "---"
echo "Usage: bash ops/queries/competitive-gaps.sh [competitor]"
echo "  e.g.: bash ops/queries/competitive-gaps.sh flux"
echo "        bash ops/queries/competitive-gaps.sh kicad"
