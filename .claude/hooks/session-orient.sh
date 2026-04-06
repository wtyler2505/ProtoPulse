#!/usr/bin/env bash
# Ars Contexta -- SessionStart hook: orient the agent with vault state
# IMPORTANT: stdout = JSON for Claude Code. NO stderr (stderr = hook error).

set -euo pipefail

VAULT_MARKER=".arscontexta"
[[ -f "$VAULT_MARKER" ]] || exit 0

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

# Count queue items
queue_count=0
if [[ -d "ops/queue" ]]; then
  queue_count=$(find "ops/queue" -maxdepth 1 -name '*.md' 2>/dev/null | wc -l | tr -d ' ')
fi

# Build warnings
WARNINGS=""

obs_count=0
if [[ -d "ops/observations" ]]; then
  obs_count=$(find "ops/observations" -name '*.md' 2>/dev/null | wc -l | tr -d ' ')
fi
tension_count=0
if [[ -d "ops/tensions" ]]; then
  tension_count=$(find "ops/tensions" -name '*.md' 2>/dev/null | wc -l | tr -d ' ')
fi

[[ "$inbox_count" -gt 20 ]] && WARNINGS="${WARNINGS} Inbox overflow (${inbox_count}>20)."
[[ "$obs_count" -gt 10 ]] && WARNINGS="${WARNINGS} ${obs_count} pending observations."
[[ "$tension_count" -gt 5 ]] && WARNINGS="${WARNINGS} ${tension_count} pending tensions."

# Check due reminders
if [[ -f "ops/reminders.md" ]]; then
  today=$(date +%Y-%m-%d)
  due=$(grep -cE "^- \[ \] $today" "ops/reminders.md" 2>/dev/null) || due=0
  [[ "$due" -gt 0 ]] && WARNINGS="${WARNINGS} ${due} reminder(s) due today."
fi

# Count unmined sessions
unmined=0
if [[ -d "ops/sessions" ]]; then
  for s in ops/sessions/*.json; do
    [[ -f "$s" ]] || continue
    grep -q '"mined": true' "$s" 2>/dev/null || unmined=$((unmined + 1))
  done
  [[ "$unmined" -gt 3 ]] && WARNINGS="${WARNINGS} ${unmined} unmined sessions."
fi

# Build topic highlights
HIGHLIGHTS=""
for moc in knowledge/*.md; do
  [[ -f "$moc" ]] || continue
  grep -q '^type: moc' "$moc" 2>/dev/null || continue
  name=$(basename "$moc" .md)
  [[ "$name" == "index" || "$name" == "identity" || "$name" == "methodology" || "$name" == "goals" ]] && continue
  count=$(grep -c '\[\[' "$moc" 2>/dev/null) || count=0
  [[ "$count" -gt 0 ]] && HIGHLIGHTS="${HIGHLIGHTS} ${name}:${count}"
done

# Build the systemMessage
MSG="Vault: ${note_count} notes, ${inbox_count} inbox, ${queue_count} queued."
[[ -n "$WARNINGS" ]] && MSG="${MSG} Warnings:${WARNINGS}"
[[ -n "$HIGHLIGHTS" ]] && MSG="${MSG} Topics:${HIGHLIGHTS}"
MSG="${MSG} Read self/identity.md, self/goals.md, knowledge/gaps-and-opportunities.md."

# Output ONLY valid JSON to stdout. No stderr.
printf '{"continue": true, "suppressOutput": false, "systemMessage": "%s"}' "$(echo "$MSG" | sed 's/"/\\"/g')"
exit 0
