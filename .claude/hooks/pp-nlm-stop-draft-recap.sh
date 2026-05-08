#!/usr/bin/env bash
# Stop hook — drafts a recap into pending-recap.md if session was substantial.
# Stop hooks CANNOT prompt user; SessionStart hook surfaces "pending recap" notice next session.
set +e
INPUT=$(cat)
PENDING="$HOME/.claude/state/pp-nlm/pending-recap.md"
mkdir -p "$(dirname "$PENDING")"

TRANSCRIPT_PATH=$(echo "$INPUT" | jq -r '.transcript_path // empty' 2>/dev/null)
STOP_HOOK_ACTIVE=$(echo "$INPUT" | jq -r '.stop_hook_active // false' 2>/dev/null)
[ "$STOP_HOOK_ACTIVE" = "true" ] && exit 0
[ -z "$TRANSCRIPT_PATH" ] || [ ! -f "$TRANSCRIPT_PATH" ] && exit 0

TOOL_USES=$(grep -c '"type":"tool_use"' "$TRANSCRIPT_PATH" 2>/dev/null || echo 0)
GIT_COMMITS=$(grep -c "git commit" "$TRANSCRIPT_PATH" 2>/dev/null || echo 0)
[ "$TOOL_USES" -lt 5 ] && [ "$GIT_COMMITS" -lt 1 ] && exit 0

[ -f "$PENDING" ] && exit 0

TODAY=$(date -u +%Y-%m-%d-%H%M)
{
  echo "# Draft recap — $TODAY"
  echo
  echo "**Tool uses**: $TOOL_USES • **Commits**: $GIT_COMMITS"
  echo
  echo "## What happened"
  echo "(Claude: fill via \`/pp-recap apply\`. Synthesize from transcript.)"
  echo
  echo "## Decisions / Insights worth capturing"
  echo "(none drafted)"
  echo
  echo "## Open threads for next session"
  echo "(none drafted)"
} > "$PENDING"

touch "$HOME/.claude/state/pp-nlm/cache-invalidate"
exit 0
