#!/usr/bin/env bash
# gap-analysis.sh — Surface contradictions between claims and debt/needs
# Usage: bash ops/queries/gap-analysis.sh

set -euo pipefail
cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

echo "=== ProtoPulse Gap Analysis ==="
echo ""

# Collect claims (what we say we have)
echo "--- CLAIMS vs DEBT: What we say we have but is broken ---"
echo ""
claims=$(rg -l '^type: claim' knowledge/ 2>/dev/null || true)
debts=$(rg -l '^type: debt-note' knowledge/ 2>/dev/null || true)

for debt in $debts; do
  debt_title=$(head -20 "$debt" | rg '^# ' | head -1 | sed 's/^# //')
  debt_desc=$(rg '^description:' "$debt" 2>/dev/null | head -1 | sed 's/^description: *//' | tr -d '"')
  # Find claims that the debt contradicts (shared wiki-links)
  debt_links=$(rg -o '\[\[[^\]]+\]\]' "$debt" 2>/dev/null | sed 's/\[\[//;s/\]\]//' | sort -u)
  for claim_file in $claims; do
    claim_links=$(rg -o '\[\[[^\]]+\]\]' "$claim_file" 2>/dev/null | sed 's/\[\[//;s/\]\]//' | sort -u)
    shared=$(comm -12 <(echo "$debt_links") <(echo "$claim_links") 2>/dev/null | head -1)
    if [ -n "$shared" ]; then
      claim_title=$(head -20 "$claim_file" | rg '^# ' | head -1 | sed 's/^# //')
      echo "  TENSION: $claim_title"
      echo "     vs    $debt_title"
      echo "     shared: [[$shared]]"
      echo ""
    fi
  done
done

echo "--- UNMET NEEDS: What users need but we haven't built ---"
echo ""
needs=$(rg -l '^type: need' knowledge/ 2>/dev/null || true)
for need in $needs; do
  title=$(head -20 "$need" | rg '^# ' | head -1 | sed 's/^# //')
  desc=$(rg '^description:' "$need" 2>/dev/null | head -1 | sed 's/^description: *//' | tr -d '"')
  echo "  NEED: $title"
  [ -n "$desc" ] && echo "        $desc"
  echo ""
done

echo "--- COMPETITIVE GAPS: Insights about competitors with no ProtoPulse response ---"
echo ""
insights=$(rg -l '^type: insight' knowledge/ 2>/dev/null || true)
for insight in $insights; do
  title=$(head -20 "$insight" | rg '^# ' | head -1 | sed 's/^# //')
  # Check if this insight mentions a competitor
  if rg -qi 'flux\|kicad\|fritzing\|tinkercad\|wokwi\|eagle\|altium' "$insight" 2>/dev/null; then
    echo "  GAP: $title"
    echo ""
  fi
done

echo "--- DEBT BLOCKING FEATURES ---"
echo ""
for debt in $debts; do
  title=$(head -20 "$debt" | rg '^# ' | head -1 | sed 's/^# //')
  echo "  BLOCKED: $title"
done

echo ""
echo "Run /arscontexta:ask 'what should we build next?' for AI-powered analysis."
