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