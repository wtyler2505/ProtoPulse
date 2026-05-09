#!/usr/bin/env bash
# Master runner: wait for Phase 2 to finish (if still running) → populate-hardware
# → all Tier-2 populates → all Tier-3 populates → final report.
#
# Walltime: 12-15 hours dominated by populate-hardware (744 sources at ~60s each).
# Tier-2/3 collectively: ~30-60 minutes (small source counts each).
#
# Launch: nohup bash scripts/pp-nlm/full-population-runner.sh > ~/.claude/logs/pp-nlm-full-population.log 2>&1 &
# Survives session end. Idempotent against the source manifest — re-running picks up gaps.

set -uo pipefail
ROOT="$(git rev-parse --show-toplevel)"
LOG="$HOME/.claude/logs/pp-nlm-full-population.log"
mkdir -p "$(dirname "$LOG")"

log() {
  echo "$(date -u --iso-8601=seconds) $*" | tee -a "$LOG"
}

log "=== full-population-runner started ==="

# ---- Step 0: auth gate ----
if ! nlm login --check >/dev/null 2>&1; then
  log "FAIL: nlm not authenticated. Run: nlm login"
  exit 2
fi
log "auth: OK"

# ---- Step 1: wait for any in-progress Phase 2 runner to finish ----
# Detect by looking for any running phase2-runner.sh or populate-* script not from this run.
log "Step 1: checking for in-progress Phase 2 runner..."
while true; do
  # Find any populate-* or phase2-runner.sh process NOT this one
  CONFLICTING_PIDS=$(pgrep -f "scripts/pp-nlm/(phase2-runner|populate-)" | grep -v "^$$" || true)
  if [ -z "$CONFLICTING_PIDS" ]; then
    log "Step 1: no conflicting Phase 2 process. Proceeding."
    break
  fi
  log "Step 1: waiting on PID(s) $CONFLICTING_PIDS to finish..."
  # Wait for any of them to exit, then re-check
  for pid in $CONFLICTING_PIDS; do
    while kill -0 "$pid" 2>/dev/null; do sleep 30; done
    log "Step 1: PID $pid exited"
  done
done

# ---- Step 2: populate-hardware (the big one) ----
log "Step 2: populate-hardware.sh — 744 vault notes (12-15h walltime)..."
bash "$ROOT/scripts/pp-nlm/populate-hardware.sh" 2>&1 | tee -a "$LOG"
log "Step 2: populate-hardware done. Manifest counts:"
jq -r 'to_entries | .[] | "  \(.key): \(.value | length)"' "$HOME/.claude/state/pp-nlm/source-manifest.json" 2>&1 | tee -a "$LOG"

# ---- Step 3: all Tier-2 feature populates ----
log "Step 3: 10 Tier-2 feature populates..."
for s in "$ROOT"/scripts/pp-nlm/populate-pp-feat-*.sh; do
  log "  starting $(basename "$s")"
  bash "$s" 2>&1 | tee -a "$LOG"
  log "  done $(basename "$s")"
done

# ---- Step 4: all Tier-3 component populates ----
log "Step 4: 10 Tier-3 component populates..."
for s in "$ROOT"/scripts/pp-nlm/populate-pp-cmp-*.sh; do
  log "  starting $(basename "$s")"
  bash "$s" 2>&1 | tee -a "$LOG"
  log "  done $(basename "$s")"
done

# ---- Step 5: final report ----
log "=== full-population-runner finished ==="
log "Final manifest counts:"
jq -r 'to_entries | sort_by(.key) | .[] | "  \(.key): \(.value | length) sources"' "$HOME/.claude/state/pp-nlm/source-manifest.json" 2>&1 | tee -a "$LOG"
log ""
log "Total sources across all pp-* notebooks:"
jq -r '[.[] | length] | add' "$HOME/.claude/state/pp-nlm/source-manifest.json" 2>&1 | tee -a "$LOG"
log ""
log "Errors logged this run: $(grep -c FAIL "$LOG" || echo 0)"
log "Done. Verify with: bats tests/pp-nlm/*.bats"
