#!/usr/bin/env bash
# Ars Contexta -- SessionStart hook: orient the agent with vault state
# Reads self/ and ops/ at session start, checks condition thresholds
# Only runs when .arscontexta vault marker exists

set -euo pipefail

VAULT_MARKER=".arscontexta"

# Skip if no vault
[[ -f "$VAULT_MARKER" ]] || exit 0

echo "--- ProtoPulse Knowledge System: Orient ---"

# Count knowledge notes
note_count=0
if [[ -d "knowledge" ]]; then
  note_count=$(find "knowledge" -name '*.md' -not -name 'index.md' 2>/dev/null | wc -l | tr -d ' ')
fi

# Count inbox captures
inbox_count=0
if [[ -d "inbox" ]]; then
  inbox_count=$(find "inbox" -name '*.md' 2>/dev/null | wc -l | tr -d ' ')
fi
# Count observations and tensions
obs_count=0
if [[ -d "ops/observations" ]]; then
  obs_count=$(find "ops/observations" -name '*.md' 2>/dev/null | wc -l | tr -d ' ')
fi

tension_count=0
if [[ -d "ops/tensions" ]]; then
  tension_count=$(find "ops/tensions" -name '*.md' 2>/dev/null | wc -l | tr -d ' ')
fi

# Count queue items
queue_count=0
if [[ -d "ops/queue" ]]; then
  queue_count=$(find "ops/queue" -maxdepth 1 -name '*.md' 2>/dev/null | wc -l | tr -d ' ')
fi

echo "Vault: $note_count knowledge notes, $inbox_count inbox captures, $queue_count queued"

# Condition-based maintenance triggers
if [[ "$inbox_count" -gt 20 ]]; then
  echo "WARNING: Inbox overflow ($inbox_count > 20). Run /extract or /pipeline to process captures."
fi
if [[ "$obs_count" -gt 10 ]]; then
  echo "WARNING: $obs_count pending observations. Consider running /rethink."
fi
if [[ "$tension_count" -gt 5 ]]; then
  echo "WARNING: $tension_count pending tensions. Consider running /rethink."
fi
if [[ "$queue_count" -gt 15 ]]; then
  echo "WARNING: Processing queue depth ($queue_count > 15). Run /ralph to batch process."
fi

# Check for due reminders
if [[ -f "ops/reminders.md" ]]; then
  today=$(date +%Y-%m-%d)
  due=$(grep -cE "^- \[ \] $today|^- \[ \] [0-9]{4}-[0-9]{2}-[0-9]{2}" "ops/reminders.md" 2>/dev/null) || due=0
  if [[ "$due" -gt 0 ]]; then
    echo "Reminders due: check ops/reminders.md"
  fi
fi

# Check for stale tasks
if [[ -f "ops/tasks.md" ]]; then
  active=$(grep -c '^\- \[ \]' "ops/tasks.md" 2>/dev/null) || active=0
  if [[ "$active" -gt 0 ]]; then
    echo "Active tasks: $active (see ops/tasks.md)"
  fi
fi

# Surface relevant knowledge for common development areas
echo ""
echo "Knowledge highlights:"
# Count notes per topic map to show which areas are richest
for moc in knowledge/*.md; do
  [[ -f "$moc" ]] || continue
  grep -q '^type: moc' "$moc" 2>/dev/null || continue
  name=$(basename "$moc" .md)
  [[ "$name" == "index" || "$name" == "identity" || "$name" == "methodology" || "$name" == "goals" ]] && continue
  count=$(grep -c '\[\[' "$moc" 2>/dev/null || echo "0")
  [[ "$count" -gt 0 ]] && echo "  $name: $count notes"
done

# Show gaps radar summary
if [[ -f "knowledge/gaps-and-opportunities.md" ]]; then
  needs=$(grep -c '^\- \[\[' "knowledge/gaps-and-opportunities.md" 2>/dev/null || echo "0")
  echo "  gaps-and-opportunities: $needs tracked gaps"
fi

# Count unmined sessions
unmined=0
if [[ -d "ops/sessions" ]]; then
  for s in ops/sessions/*.json; do
    [[ -f "$s" ]] || continue
    grep -q '"mined": true' "$s" 2>/dev/null || unmined=$((unmined + 1))
  done
  [[ "$unmined" -gt 3 ]] && echo "  $unmined unmined sessions — run /remember --mine-sessions"
fi

echo ""
echo "Read: self/identity.md, self/goals.md, knowledge/gaps-and-opportunities.md"
echo "Gap queries: bash ops/queries/gap-analysis.sh | idea-generator.sh | research-gaps.sh"
echo "--- End Orient ---"