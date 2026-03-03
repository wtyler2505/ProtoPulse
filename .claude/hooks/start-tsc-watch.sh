#!/bin/bash
# SessionStart hook: Start tsc --watch in a tmux session
# Always exits 0 — never blocks session start

if tmux has-session -t tsc-watch 2>/dev/null; then
  echo "tsc-watch tmux session already running." >&2
  exit 0
fi

tmux new-session -d -s tsc-watch \
  "cd /home/wtyler/Projects/ProtoPulse && npx tsc --noEmit --watch --pretty false 2>&1 | tee .claude/.tsc-errors.log"

if [ $? -eq 0 ]; then
  echo "Started tsc-watch tmux session." >&2
else
  echo "Warning: Failed to start tsc-watch tmux session." >&2
fi

exit 0
