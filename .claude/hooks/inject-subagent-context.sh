#!/usr/bin/env bash
# inject-subagent-context.sh — SubagentStart hook
# Injects vault state summary + active goals into subagent context
# so spawned agents don't start completely cold.

set -uo pipefail
cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

# Only run in ProtoPulse vault
[ -f ".arscontexta" ] || { echo "{}"; exit 0; }

# Build context summary
CONTEXT=""

# Active goals
if [ -f "self/goals.md" ]; then
  goals=$(head -20 self/goals.md | grep '^\- ' | head -5)
  [ -n "$goals" ] && CONTEXT="${CONTEXT}Active goals: ${goals}\n"
fi

# Vault size
note_count=$(find knowledge/ -name '*.md' 2>/dev/null | wc -l | tr -d ' ')
CONTEXT="${CONTEXT}Knowledge vault: ${note_count} notes. "

# Key guardrails
CONTEXT="${CONTEXT}Rules: zero TS errors required, use agent-teams for parallel work, max 6 concurrent agents."

# Output as systemMessage (always output valid JSON)
if [ -n "$CONTEXT" ]; then
  printf '{"systemMessage": "%s"}' "$(echo -e "$CONTEXT" | tr '\n' ' ' | sed 's/"/\\"/g')"
else
  echo '{}'
fi
