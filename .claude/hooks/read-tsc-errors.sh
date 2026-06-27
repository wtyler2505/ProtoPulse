#!/bin/bash
# PostToolUse hook: Show recent tsc errors after file edits
# Always exits 0 — informational only

LOG_FILE="/home/wtyler/Projects/ProtoPulse/.claude/.tsc-errors.log"

if [ ! -f "$LOG_FILE" ]; then
  echo "{}"; exit 0
fi

# Match ONLY genuine tsc diagnostics ("path(line,col): error TSxxxx: ...").
# A killed tsc --watch (earlyoom SIGTERM / OOM / timeout) logs "Terminated",
# "Killed", "out of memory", etc. — those are NOT type errors and must not be
# reported as "TSC errors: Terminated" (a false signal that wasted ~15 cycles
# in one session). See AGENTS.md §Engine verification + memory
# project_earlyoom_kills_heavy_builds.
TAIL=$(tail -20 "$LOG_FILE" 2>/dev/null)
ERRORS=$(echo "$TAIL" | grep -E "error TS[0-9]" | head -5 | tr '\n' ' | ' | sed 's/"/\\"/g')

if [ -n "$ERRORS" ]; then
  # Real type errors — surface them.
  printf '{"systemMessage": "TSC errors: %s"}' "$ERRORS"
elif echo "$TAIL" | grep -qiE 'terminated|killed|out of memory|heap limit|ELIFECYCLE'; then
  # Watcher was killed before finishing — inconclusive, not a type error.
  printf '{"systemMessage": "tsc watcher was killed before finishing (earlyoom/timeout) — typecheck INCONCLUSIVE, not type errors. Verify manually: cd <pkg> && NODE_OPTIONS=--max-old-space-size=16384 npx tsc --noEmit --incremental false (trust the exit code)."}'
else
  echo '{}'
fi
exit 0
