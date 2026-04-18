#!/usr/bin/env bash
# update-check-status.sh — wrapper that runs `npm run check` and caches
# the exit code + timestamp + error count to .claude/.check-status.
#
# Usage: bash .claude/hooks/update-check-status.sh
# Output format (single line): "<exit-code> <timestamp> <err-count>"
#
# Read by smart-stop-gate.sh Signal 5 to detect stale-failing type-checks.
# The file is the source of truth; if missing, Signal 5 is silent.

set -uo pipefail
PROJECT_ROOT="/home/wtyler/Projects/ProtoPulse"
cd "$PROJECT_ROOT" || exit 1

STATUS_FILE="$PROJECT_ROOT/.claude/.check-status"
LOG_FILE="$PROJECT_ROOT/logs/check-latest.log"
mkdir -p "$(dirname "$LOG_FILE")"

# Run check, capture output, preserve exit code through tee
NODE_OPTIONS='--max-old-space-size=16384' npx tsc --noEmit 2>&1 | tee "$LOG_FILE" > /dev/null
exit_code=${PIPESTATUS[0]}

err_count=$(grep -cE "error TS[0-9]+:" "$LOG_FILE" 2>/dev/null || echo 0)
ts=$(date +%s)

echo "$exit_code $ts $err_count" > "$STATUS_FILE"
exit "$exit_code"
