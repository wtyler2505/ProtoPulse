#!/usr/bin/env bash
# Ars Contexta -- Stop hook: capture session state
# Saves session metadata to ops/sessions/ as JSON

set -euo pipefail

VAULT_MARKER=".arscontexta"
[[ -f "$VAULT_MARKER" ]] || exit 0

SESSIONS_DIR="ops/sessions"

# Check if session capture is enabled
if grep -q 'session_capture: false' "$VAULT_MARKER" 2>/dev/null; then
  exit 0
fi

mkdir -p "$SESSIONS_DIR"

# Derive session ID
SESSION_ID="${CLAUDE_CONVERSATION_ID:-$(date +%Y%m%d-%H%M%S)}"
SESSION_FILE="$SESSIONS_DIR/${SESSION_ID}.json"

# Don't overwrite existing session files -- append suffix
if [[ -f "$SESSION_FILE" ]]; then
  SESSION_FILE="$SESSIONS_DIR/${SESSION_ID}-$(date +%H%M%S).json"
fi
# Count what happened this session (heuristic from recent git changes)
knowledge_modified=$(git diff --name-only HEAD~1 2>/dev/null | grep -c '^knowledge/' || echo "0")
inbox_modified=$(git diff --name-only HEAD~1 2>/dev/null | grep -c '^inbox/' || echo "0")
ops_modified=$(git diff --name-only HEAD~1 2>/dev/null | grep -c '^ops/' || echo "0")
self_modified=$(git diff --name-only HEAD~1 2>/dev/null | grep -c '^self/' || echo "0")

cat > "$SESSION_FILE" << ENDJSON
{
  "session_id": "$SESSION_ID",
  "timestamp": "$(date -Iseconds)",
  "knowledge_touched": $knowledge_modified,
  "inbox_touched": $inbox_modified,
  "ops_touched": $ops_modified,
  "self_touched": $self_modified,
  "mined": false
}
ENDJSON

exit 0