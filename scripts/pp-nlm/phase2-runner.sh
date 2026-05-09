#!/usr/bin/env bash
# Phase 2 sequential runner — resumes idempotently against the source manifest.
# Order: smallest-first so quick wins land before big batches; already-populated
# scripts will skip-fast via manifest check inside source-helpers.sh.
set -uo pipefail
ROOT="/home/wtyler/Projects/ProtoPulse"
LOG="$HOME/.claude/logs/pp-nlm-phase2-runner.log"
mkdir -p "$(dirname "$LOG")"
echo "=== Phase 2 runner started $(date -u --iso-8601=seconds) ===" | tee -a "$LOG"
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
  echo "--- $s start $(date -u +%H:%M:%S) ---" | tee -a "$LOG"
  bash "scripts/pp-nlm/$s" 2>&1 | tee -a "$LOG"
  rc=${PIPESTATUS[0]}
  echo "--- $s done rc=$rc $(date -u +%H:%M:%S) ---" | tee -a "$LOG"
done
echo "=== Phase 2 runner finished $(date -u --iso-8601=seconds) ===" | tee -a "$LOG"
