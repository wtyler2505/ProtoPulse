#!/usr/bin/env bash
# pre-compact-checkpoint.sh — PreCompact hook
# Saves critical session state before context compaction so nothing is lost.
# Writes a checkpoint to ops/sessions/ with current goals, active tasks, and
# recent discoveries.

set -euo pipefail
cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

[ -f ".arscontexta" ] || exit 0

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
CHECKPOINT="ops/sessions/compact-${TIMESTAMP}.json"

# Gather state
GOALS=""
[ -f "self/goals.md" ] && GOALS=$(head -30 self/goals.md | grep '^\- ' | head -5 | tr '\n' '|')

NOTE_COUNT=$(find knowledge/ -name '*.md' 2>/dev/null | wc -l | tr -d ' ')

RECENT_NOTES=""
if [ -d "knowledge" ]; then
  RECENT_NOTES=$(git log --oneline --diff-filter=A -- 'knowledge/*.md' -5 2>/dev/null | sed 's/^[a-f0-9]* //' | tr '\n' '|')
fi

PENDING_TASKS=""
[ -f "ops/tasks.md" ] && PENDING_TASKS=$(grep '^\- \[ \]' ops/tasks.md 2>/dev/null | head -5 | tr '\n' '|')

# Write checkpoint
cat > "$CHECKPOINT" << CEOF
{
  "type": "pre-compact-checkpoint",
  "timestamp": "${TIMESTAMP}",
  "vault_notes": ${NOTE_COUNT},
  "active_goals": "$(echo "$GOALS" | sed 's/"/\\"/g')",
  "recent_notes": "$(echo "$RECENT_NOTES" | sed 's/"/\\"/g')",
  "pending_tasks": "$(echo "$PENDING_TASKS" | sed 's/"/\\"/g')"
}
CEOF

echo '{"systemMessage": "Context compaction checkpoint saved. Active goals and recent work preserved in ops/sessions/."}'
