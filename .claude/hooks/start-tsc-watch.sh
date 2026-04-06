#!/bin/bash
# SessionStart hook: Start tsc --watch in a tmux session
# stdout = JSON for Claude Code. No stderr for informational messages.

if tmux has-session -t tsc-watch 2>/dev/null; then
  # Already running — no output needed
  exit 0
fi

tmux new-session -d -s tsc-watch \
  "cd /home/wtyler/Projects/ProtoPulse && npx tsc --noEmit --watch --pretty false 2>&1 | tee .claude/.tsc-errors.log" 2>/dev/null

echo "{}"
exit 0
