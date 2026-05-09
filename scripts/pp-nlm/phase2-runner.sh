#!/usr/bin/env bash
# Phase 2 sequential runner — resumes idempotently against the source manifest.
# Order: smallest-first so quick wins land before big batches; already-populated
# scripts will skip-fast via manifest check inside source-helpers.sh.
set -uo pipefail
ROOT="/home/wtyler/Projects/ProtoPulse"
LOG="$HOME/.claude/logs/pp-nlm-phase2-runner.log"
LOCK="$HOME/.claude/state/pp-nlm/phase2-runner.lock"
mkdir -p "$(dirname "$LOG")"
mkdir -p "$(dirname "$LOCK")"
exec >> "$LOG" 2>&1
exec 9>"$LOCK"
flock -n 9 || { echo "=== Phase 2 runner already active $(date -u --iso-8601=seconds) ==="; exit 75; }
echo "=== Phase 2 runner started $(date -u --iso-8601=seconds) ==="
cd "$ROOT"
for s in \
  populate-research-seed.sh \
  populate-journal-seed.sh \
  populate-bench-seed.sh \
  populate-arscontexta.sh \
  populate-breadboard.sh \
  populate-backlog.sh \
  populate-memories.sh \
  populate-codebase.sh \
; do
  echo "--- $s start $(date -u +%H:%M:%S) ---"
  bash "scripts/pp-nlm/$s"
  rc=$?
  echo "--- $s done rc=$rc $(date -u +%H:%M:%S) ---"
done
echo "=== Phase 2 runner finished $(date -u --iso-8601=seconds) ==="
