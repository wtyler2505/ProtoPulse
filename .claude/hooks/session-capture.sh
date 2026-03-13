#!/usr/bin/env bash
# Ars Contexta — Stop hook: capture session state
# Saves session metadata to ops/sessions/

set -euo pipefail

VAULT_MARKER=".arscontexta"
[[ -f "$VAULT_MARKER" ]] || exit 0

VAULT_ROOT="knowledge"
SESSIONS_DIR="$VAULT_ROOT/ops/sessions"

# Check if session capture is enabled
if grep -q 'session_capture: false' "$VAULT_MARKER" 2>/dev/null; then
  exit 0
fi

mkdir -p "$SESSIONS_DIR"

# Derive session ID
SESSION_ID="${CLAUDE_CONVERSATION_ID:-$(date +%Y%m%d-%H%M%S)}"
SESSION_FILE="$SESSIONS_DIR/${SESSION_ID}.json"

# Don't overwrite existing session files — append suffix
if [[ -f "$SESSION_FILE" ]]; then
  SESSION_FILE="$SESSIONS_DIR/${SESSION_ID}-$(date +%H%M%S).json"
fi

# Count what happened this session (rough heuristic from recent git changes)
insights_modified=$(git diff --name-only HEAD~1 2>/dev/null | grep -c 'knowledge/insights/' || echo "0")
captures_modified=$(git diff --name-only HEAD~1 2>/dev/null | grep -c 'knowledge/captures/' || echo "0")

cat > "$SESSION_FILE" << ENDJSON
{
  "session_id": "$SESSION_ID",
  "timestamp": "$(date -Iseconds)",
  "insights_touched": $insights_modified,
  "captures_touched": $captures_modified,
  "mined": false
}
ENDJSON

exit 0
