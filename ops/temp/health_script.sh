#!/bin/bash
NOTES="knowledge"
INBOX="inbox"

echo "=== CATEGORY 1: Schema Compliance ==="
for f in $NOTES/*.md; do
  [[ -f "$f" ]] || continue
  head -1 "$f" | grep -q '^---$' || echo "FAIL: $f — no YAML frontmatter"
  rg -q '^description:' "$f" || echo "WARN: $f — missing description field"
  rg -q '^topics:' "$f" || echo "WARN: $f — missing topics field"
done

echo "=== CATEGORY 2: Orphan Detection ==="
for f in $NOTES/*.md; do
  [[ -f "$f" ]] || continue
  basename=$(basename "$f" .md)
  count=$(rg -l "\[\[$basename\]\]" --glob '*.md' | grep -v "$f" | wc -l | tr -d ' ')
  if [[ "$count" -eq 0 ]]; then
    mod_days=$(( ($(date +%s) - $(stat -c %Y "$f" 2>/dev/null || stat -f %m "$f" 2>/dev/null)) / 86400 ))
    if [[ $mod_days -lt 1 ]]; then
      echo "INFO: $f — no incoming links (created <24h ago)"
    elif [[ $mod_days -le 7 ]]; then
      echo "WARN: $f — no incoming links (orphan, $mod_days days old)"
    else
      echo "FAIL: $f — no incoming links (persistent orphan, $mod_days days old)"
    fi
  fi
done

echo "=== CATEGORY 3: Link Health ==="
rg -oN '\[\[([^\]|]+)(?:\|[^\]]+)?\]\]' --glob '*.md' -r '$1' | sort -u | while read target; do
  # Avoid matching against huge subdirectories to speed up finding
  found=$(find . -path "./.git" -prune -o -path "./node_modules" -prune -o -path "./dist" -prune -o -name "$target.md" -print | head -1)
  if [[ -z "$found" ]]; then
    echo "FAIL: dangling link [[${target}]]"
    rg -l "\[\[$target\]\]" --glob '*.md' | sed 's/^/  referenced in: /'
  fi
done

echo "=== CATEGORY 4: Description Quality ==="
for f in $NOTES/*.md; do
  [[ -f "$f" ]] || continue
  basename=$(basename "$f" .md)
  desc=$(rg '^description:\s*(.*)' "$f" -r '$1' 2>/dev/null)
  if [[ -z "$desc" ]]; then
    # Already caught in category 1
    continue
  fi
  len=${#desc}
  if [[ $len -lt 30 ]]; then
    echo "WARN: $f — Description < 30 chars ($len chars)"
  fi
  title_clean=$(echo "$basename" | sed 's/-/ /g' | tr '[:upper:]' '[:lower:]')
  desc_clean=$(echo "$desc" | tr '[:upper:]' '[:lower:]')
  if [[ "$desc_clean" == *"$title_clean"* ]]; then
     echo "WARN: $f — Description is a restatement of title: $desc"
  fi
done

echo "=== CATEGORY 5: Three-Space Boundaries ==="
rg '^(current_phase|completed_phases|batch|source_task|queue_id):' $NOTES/ --glob '*.md' 2>/dev/null | sed 's/^/WARN: ops field in notes: /'
rg '## (Create|Reflect|Reweave|Verify|Enrich)$' $NOTES/ --glob '*.md' 2>/dev/null | sed 's/^/WARN: task pattern in notes: /'
rg -i '(my methodology|I observed that|agent reflection|session learning|I learned)' $NOTES/ --glob '*.md' 2>/dev/null | sed 's/^/WARN: self reflection in notes: /'
rg '^description:' ops/observations/*.md ops/methodology/*.md 2>/dev/null | sed 's/^/INFO: trapped knowledge in ops: /'
if [[ -d "self" ]]; then
  rg '^(current_phase|status|queue):' self/ --glob '*.md' 2>/dev/null | sed 's/^/WARN: ops state in self: /'
  rg -i '(my identity|I am|who I am|my personality)' ops/ --glob '*.md' 2>/dev/null | sed 's/^/WARN: identity in ops: /'
  rg '^topics:.*\[\[' self/memory/*.md 2>/dev/null | grep -v 'identity\|methodology\|goals\|relationships' | sed 's/^/WARN: domain topics in self: /'
else
  rg -i '(my goals|current goals|handoff|session handoff)' $NOTES/ --glob '*.md' 2>/dev/null | sed 's/^/WARN: self-absence effect in notes: /'
fi

echo "=== CATEGORY 6: Processing Throughput ==="
INBOX_COUNT=$(find $INBOX/ -name '*.md' -not -path '*/archive/*' 2>/dev/null | wc -l | tr -d ' ')
NOTES_COUNT=$(find $NOTES/ -name '*.md' 2>/dev/null | wc -l | tr -d ' ')
QUEUE_COUNT=$(find ops/queue/ -name '*.md' -not -path '*/archive/*' 2>/dev/null | wc -l | tr -d ' ')
if [[ $((INBOX_COUNT + NOTES_COUNT)) -gt 0 ]]; then
  RATIO=$((INBOX_COUNT * 100 / (INBOX_COUNT + NOTES_COUNT)))
else
  RATIO=0
fi
echo "Inbox: $INBOX_COUNT | Notes: $NOTES_COUNT | In-progress: $QUEUE_COUNT | Ratio: ${RATIO}%"
if [[ $RATIO -gt 75 ]]; then echo "FAIL: throughput ratio > 75%"; elif [[ $RATIO -gt 50 ]]; then echo "WARN: throughput ratio > 50%"; fi
if [[ $INBOX_COUNT -gt 20 ]]; then echo "WARN: inbox > 20 items"; fi

echo "=== CATEGORY 7: Stale Notes ==="
for f in $NOTES/*.md; do
  [[ -f "$f" ]] || continue
  basename=$(basename "$f" .md)
  mod_days=$(( ($(date +%s) - $(stat -c %Y "$f" 2>/dev/null || stat -f %m "$f" 2>/dev/null)) / 86400 ))
  incoming=$(rg -l "\[\[$basename\]\]" --glob '*.md' | grep -v "$f" | wc -l | tr -d ' ')
  if [[ $mod_days -gt 30 ]] && [[ $incoming -lt 2 ]]; then
    if [[ $mod_days -gt 90 ]] && [[ $incoming -eq 0 ]]; then
      echo "FAIL: STALE $f — $mod_days days old, $incoming incoming links"
    else
      echo "WARN: STALE $f — $mod_days days old, $incoming incoming links"
    fi
  fi
done

echo "=== CATEGORY 8: MOC Coherence ==="
for moc in $NOTES/*.md; do
  rg -q '^type: moc' "$moc" || continue
  moc_name=$(basename "$moc" .md)
  note_count=$(rg -l "\[\[$moc_name\]\]" $NOTES/ --glob '*.md' | grep -v "$moc" | wc -l | tr -d ' ')
  echo "MOC: $moc_name: $note_count notes"
  if [[ $note_count -lt 5 ]]; then echo "WARN: MOC $moc_name under 5 notes"; fi
  if [[ $note_count -gt 50 ]]; then echo "WARN: MOC $moc_name over 50 notes"; fi
  bare_links=$(rg '^\s*- \[\[' "$moc" | grep -v ' — ' | grep -v '^\s*- \[\[.*\]\].*—' | wc -l | tr -d ' ')
  if [[ $bare_links -gt 0 ]]; then
    echo "WARN: MOC $moc_name has $bare_links bare links without context phrases"
  fi
done

echo "=== MAINTENANCE SIGNALS ==="
OBS_COUNT=$(find ops/observations/ -name '*.md' 2>/dev/null | wc -l | tr -d ' ')
TENSION_COUNT=$(find ops/tensions/ -name '*.md' 2>/dev/null | wc -l | tr -d ' ')
SESSION_COUNT=$(find ops/sessions/ -name '*.md' 2>/dev/null | wc -l | tr -d ' ')
PENDING_TASKS=$(jq '[.tasks[] | select(.status=="pending")] | length' ops/queue/queue.json 2>/dev/null || echo 0)
echo "Observations: $OBS_COUNT"
echo "Tensions: $TENSION_COUNT"
echo "Sessions: $SESSION_COUNT"
echo "Pending tasks: $PENDING_TASKS"
