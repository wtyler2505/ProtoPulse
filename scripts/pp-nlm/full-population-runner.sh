#!/usr/bin/env bash
# Legacy population runner. The preferred 2026-05-09 path is source-pack
# consolidation via build-consolidation-packs.sh, but this remains for targeted
# repopulation if needed.
#
# Launch: nohup bash scripts/pp-nlm/full-population-runner.sh &
# This script owns its log file internally to avoid duplicate tee output.

set -uo pipefail
ROOT="$(git rev-parse --show-toplevel)"
LOG="$HOME/.claude/logs/pp-nlm-full-population.log"
LOCK="$HOME/.claude/state/pp-nlm/full-population-runner.lock"
mkdir -p "$(dirname "$LOG")"
mkdir -p "$(dirname "$LOCK")"
exec >> "$LOG" 2>&1
exec 9>"$LOCK"
flock -n 9 || { echo "$(date -u --iso-8601=seconds) full-population-runner already active"; exit 75; }
source "$ROOT/scripts/pp-nlm/lib/write-helpers.sh"

log() {
  echo "$(date -u --iso-8601=seconds) $*"
}

log "=== full-population-runner started ==="

# ---- Step 0: auth gate ----
if ! pp_nlm_require_auth_bounded >/dev/null 2>&1; then
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
log "Step 2: populate-hardware.sh..."
bash "$ROOT/scripts/pp-nlm/populate-hardware.sh"
log "Step 2: populate-hardware done. Manifest counts:"
jq -r 'to_entries | .[] | "  \(.key): \(.value | length)"' "$HOME/.claude/state/pp-nlm/source-manifest.json"

# ---- Step 3: all Tier-2 feature populates ----
log "Step 3: legacy feature populate scripts..."
for s in "$ROOT"/scripts/pp-nlm/populate-pp-feat-*.sh; do
  log "  starting $(basename "$s")"
  bash "$s"
  log "  done $(basename "$s")"
done

# ---- Step 4: REMOVED 2026-05-09 — Tier-3 per-component notebooks dropped as redundant with pp-hardware ----

# ---- Step 5: final report ----
log "=== full-population-runner finished ==="
log "Final manifest counts:"
jq -r 'to_entries | sort_by(.key) | .[] | "  \(.key): \(.value | length) sources"' "$HOME/.claude/state/pp-nlm/source-manifest.json"
log ""
log "Total sources across all pp-* notebooks:"
jq -r '[.[] | length] | add' "$HOME/.claude/state/pp-nlm/source-manifest.json"
log ""
log "Errors logged this run: $(grep -c FAIL "$LOG" || echo 0)"
log "Done. Verify with: bats tests/pp-nlm/*.bats"
