#!/bin/bash
# SessionStart hook: Verify hook dependencies are available
# Always exits 0 — only warns, never blocks

WARNINGS=0

# Check claudekit-hooks
if ! which claudekit-hooks >/dev/null 2>&1; then
  echo "Warning: claudekit-hooks not found in PATH. Most hooks will not work." >&2
  echo "  Install with: npm install -g claudekit" >&2
  WARNINGS=$((WARNINGS + 1))
fi

# Check Node.js
if ! which node >/dev/null 2>&1; then
  echo "Warning: node not found in PATH." >&2
  WARNINGS=$((WARNINGS + 1))
else
  NODE_VERSION=$(node --version 2>/dev/null)
  # Check for Node 18+ (minimum for modern features)
  MAJOR=$(echo "$NODE_VERSION" | sed 's/^v//' | cut -d. -f1)
  if [ "$MAJOR" -lt 18 ] 2>/dev/null; then
    echo "Warning: Node.js $NODE_VERSION detected. Node 18+ recommended." >&2
    WARNINGS=$((WARNINGS + 1))
  fi
fi

# Check tmux
if ! which tmux >/dev/null 2>&1; then
  echo "Warning: tmux not found. tsc-watch hook and TUI skills will not work." >&2
  echo "  Install with: sudo apt install tmux" >&2
  WARNINGS=$((WARNINGS + 1))
fi

# Check jq
if ! which jq >/dev/null 2>&1; then
  echo "Warning: jq not found. Some hooks that parse JSON input will not work." >&2
  echo "  Install with: sudo apt install jq" >&2
  WARNINGS=$((WARNINGS + 1))
fi

if [ "$WARNINGS" -gt 0 ]; then
  echo "Hook dependency check: $WARNINGS warning(s) found." >&2
else
  echo "Hook dependency check: all dependencies available." >&2
fi

exit 0
