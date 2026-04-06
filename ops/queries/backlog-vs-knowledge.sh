#!/usr/bin/env bash
# backlog-vs-knowledge.sh — Cross-reference vault knowledge against MASTER_BACKLOG
# Finds backlog items that the knowledge vault has evidence about
# Usage: bash ops/queries/backlog-vs-knowledge.sh [keyword]

set -euo pipefail
cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

KEYWORD="${1:-}"
BACKLOG="docs/MASTER_BACKLOG.md"

[ -f "$BACKLOG" ] || { echo "MASTER_BACKLOG.md not found"; exit 1; }

echo "=== Backlog vs Knowledge Cross-Reference ==="
echo ""

if [ -n "$KEYWORD" ]; then
  echo "Filter: $KEYWORD"
  echo ""
fi

# Extract BL-XXXX items from backlog that are still open
echo "--- OPEN BACKLOG ITEMS with knowledge vault evidence ---"
echo ""

# Get all note titles as searchable terms
note_terms=$(for f in knowledge/*.md; do
  [ -f "$f" ] || continue
  rg -q '^type: moc' "$f" 2>/dev/null && continue
  basename "$f" .md | tr '-' ' '
done)

# Search backlog for lines with BL- IDs that match vault knowledge
rg 'BL-[0-9]{4}' "$BACKLOG" 2>/dev/null | while read -r line; do
  # Skip done items
  echo "$line" | rg -qi 'DONE\|done\|completed' && continue
  # Apply keyword filter
  [ -n "$KEYWORD" ] && { echo "$line" | rg -qi "$KEYWORD" || continue; }

  bl_id=$(echo "$line" | rg -o 'BL-[0-9]{4}' | head -1)
  # Check if any knowledge note is relevant to this backlog item
  for f in knowledge/*.md; do
    [ -f "$f" ] || continue
    rg -q '^type: moc' "$f" 2>/dev/null && continue
    note_name=$(basename "$f" .md)
    # Simple relevance: do key terms from the note appear in the backlog line?
    key_terms=$(echo "$note_name" | tr '-' '\n' | rg -v '^the$\|^is$\|^a$\|^in$\|^of$\|^for$\|^and$\|^or$\|^was$\|^that$' | head -3)
    match=0
    for term in $key_terms; do
      [ ${#term} -lt 4 ] && continue
      echo "$line" | rg -qi "$term" && match=$((match + 1))
    done
    if [ "$match" -ge 2 ]; then
      title=$(head -20 "$f" | rg '^# ' | head -1 | sed 's/^# //')
      echo "  $bl_id: $(echo "$line" | head -c 80)"
      echo "    EVIDENCE: $title"
      echo ""
      break
    fi
  done
done | head -60

echo "---"
echo "Usage: bash ops/queries/backlog-vs-knowledge.sh [keyword]"
echo "  e.g.: bash ops/queries/backlog-vs-knowledge.sh pcb"
echo "        bash ops/queries/backlog-vs-knowledge.sh export"
