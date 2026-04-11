#!/usr/bin/env bash
# Ars Contexta -- Stop hook: capture session state
# Saves session metadata to ops/sessions/ as JSON

set -uo pipefail

VAULT_MARKER=".arscontexta"
[[ -f "$VAULT_MARKER" ]] || { echo "{}"; exit 0; }

SESSIONS_DIR="ops/sessions"

# Check if session capture is enabled
if grep -q 'session_capture: false' "$VAULT_MARKER" 2>/dev/null; then
  echo "{}"; exit 0
fi

mkdir -p "$SESSIONS_DIR"

# Read Claude Code's Stop-hook JSON payload from stdin.
# Per claudekit's ClaudePayload contract (cli/hooks/base.ts:13-25),
# Claude Code delivers session_id + transcript_path via stdin JSON.
# We prefer those fields, fall back to env vars (empty in practice),
# and finally fall back to a timestamp as a last-resort safety net.
HOOK_PAYLOAD="$(cat 2>/dev/null || true)"
CLAUDE_ID_FROM_PAYLOAD="$(echo "$HOOK_PAYLOAD" | jq -r '.session_id // empty' 2>/dev/null || true)"
TRANSCRIPT_PATH="$(echo "$HOOK_PAYLOAD" | jq -r '.transcript_path // empty' 2>/dev/null || true)"
SESSION_ID="${CLAUDE_ID_FROM_PAYLOAD:-${CLAUDE_CONVERSATION_ID:-${CLAUDE_SESSION_ID:-$(date +%Y%m%d-%H%M%S)}}}"
SESSION_FILE="$SESSIONS_DIR/${SESSION_ID}.json"

# Don't overwrite existing session files -- append suffix
if [[ -f "$SESSION_FILE" ]]; then
  SESSION_FILE="$SESSIONS_DIR/${SESSION_ID}-$(date +%H%M%S).json"
fi
# Count what happened this session (heuristic from recent git changes)
knowledge_modified=$(git diff --name-only HEAD~1 2>/dev/null | grep -c '^knowledge/') || knowledge_modified=0
inbox_modified=$(git diff --name-only HEAD~1 2>/dev/null | grep -c '^inbox/') || inbox_modified=0
ops_modified=$(git diff --name-only HEAD~1 2>/dev/null | grep -c '^ops/') || ops_modified=0
self_modified=$(git diff --name-only HEAD~1 2>/dev/null | grep -c '^self/') || self_modified=0

cat > "$SESSION_FILE" << ENDJSON
{
  "session_id": "$SESSION_ID",
  "timestamp": "$(date -Iseconds)",
  "transcript_path": "${TRANSCRIPT_PATH:-}",
  "knowledge_touched": $knowledge_modified,
  "inbox_touched": $inbox_modified,
  "ops_touched": $ops_modified,
  "self_touched": $self_modified,
  "mined": false
}
ENDJSON

echo '{}'
exit 0