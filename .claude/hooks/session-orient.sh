#!/usr/bin/env bash
# Ars Contexta — SessionStart hook: orient the agent with vault state
# Only runs when .arscontexta vault marker exists

set -euo pipefail

VAULT_MARKER=".arscontexta"
VAULT_ROOT="knowledge"

# Skip if no vault
[[ -f "$VAULT_MARKER" ]] || exit 0

echo "--- ProtoPulse Knowledge System: Orient ---"

# Show vault structure
if [[ -d "$VAULT_ROOT/insights" ]]; then
  insight_count=$(find "$VAULT_ROOT/insights" -name '*.md' -not -name 'index.md' 2>/dev/null | wc -l | tr -d ' ')
  capture_count=$(find "$VAULT_ROOT/captures" -name '*.md' 2>/dev/null | wc -l | tr -d ' ')
  obs_count=$(find "$VAULT_ROOT/ops/observations" -name '*.md' 2>/dev/null | wc -l | tr -d ' ')
  tension_count=$(find "$VAULT_ROOT/ops/tensions" -name '*.md' 2>/dev/null | wc -l | tr -d ' ')

  echo "Knowledge vault: $insight_count insights, $capture_count captures pending"

  # Condition-based maintenance triggers
  if [[ "$capture_count" -gt 20 ]]; then
    echo "WARNING: Captures overflow ($capture_count > 20). Process through pipeline."
  fi
  if [[ "$obs_count" -gt 10 ]]; then
    echo "WARNING: $obs_count pending observations. Consider running /arscontexta:rethink."
  fi
  if [[ "$tension_count" -gt 5 ]]; then
    echo "WARNING: $tension_count pending tensions. Consider running /arscontexta:rethink."
  fi

  # Check for due reminders
  if [[ -f "$VAULT_ROOT/ops/reminders.md" ]]; then
    today=$(date +%Y-%m-%d)
    due=$(grep -c "^\- \[ \] $today\|^\- \[ \] [0-9]\{4\}-[0-9]\{2\}-[0-9]\{2\}" "$VAULT_ROOT/ops/reminders.md" 2>/dev/null || true)
    if [[ "$due" -gt 0 ]]; then
      echo "Reminders: check $VAULT_ROOT/ops/reminders.md for due items"
    fi
  fi
fi

echo "Read: knowledge/self/identity.md, knowledge/self/goals.md"
echo "--- End Orient ---"
