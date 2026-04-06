#!/bin/bash
# SessionStart hook: Verify hook dependencies are available
# stdout = JSON for Claude Code. Only use stderr for actual BLOCKING errors (exit 2).

WARNINGS=""

# Check claudekit-hooks
if ! which claudekit-hooks >/dev/null 2>&1; then
  WARNINGS="${WARNINGS} claudekit-hooks not found (install: npm i -g claudekit)."
fi

# Check Node.js
if ! which node >/dev/null 2>&1; then
  WARNINGS="${WARNINGS} node not found."
else
  NODE_VERSION=$(node --version 2>/dev/null)
  MAJOR=$(echo "$NODE_VERSION" | sed 's/^v//' | cut -d. -f1)
  if [ "$MAJOR" -lt 18 ] 2>/dev/null; then
    WARNINGS="${WARNINGS} Node.js $NODE_VERSION (18+ recommended)."
  fi
fi

# Check tmux
if ! which tmux >/dev/null 2>&1; then
  WARNINGS="${WARNINGS} tmux not found."
fi

# Check jq
if ! which jq >/dev/null 2>&1; then
  WARNINGS="${WARNINGS} jq not found."
fi

if [ -n "$WARNINGS" ]; then
  printf '{"continue": true, "systemMessage": "Hook deps:%s"}' "$WARNINGS"
else
  # All good — no output needed, just exit clean
  true
fi

exit 0
