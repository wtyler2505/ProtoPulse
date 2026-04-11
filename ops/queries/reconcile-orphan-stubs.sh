#!/usr/bin/env bash
# Reconcile orphan session stubs — stubs with no matching transcript.
# Usage: ops/queries/reconcile-orphan-stubs.sh [--dry-run]
#
# Orphan stubs are a byproduct of (a) the pre-fix capture hook writing
# timestamp IDs instead of UUIDs and (b) Claude Code transcript
# retention cleanup deleting transcripts before any mining run.
#
# This script marks each stub whose "mined" field is null/missing as
# mined:"transcript-unavailable" with provenance, so health scans and
# the /remember pipeline stop flagging them.
#
# Stubs that are already mined:true, or that have a matching transcript,
# are left alone.
#
# Note: this script does NOT attempt timestamp-proximity matching
# against current transcripts. Phase 1 of the session-mining plan
# established that zero of the 10 extant transcripts correlate to any
# stub (stub IDs are timestamps, transcript IDs are UUIDs, and the
# 10 old-format UUID stubs point to March sessions whose transcripts
# have been deleted by retention cleanup). So any stub with mined:null
# is unambiguously unmineable.

set -uo pipefail

DRY_RUN=false
if [ "${1:-}" = "--dry-run" ]; then
  DRY_RUN=true
fi

SESSIONS_DIR="ops/sessions"
if [ ! -d "$SESSIONS_DIR" ]; then
  echo "ERROR: $SESSIONS_DIR not found. Run from repository root." >&2
  exit 2
fi

COUNT=0
SKIPPED_MINED=0
SKIPPED_MALFORMED=0

for stub_path in "$SESSIONS_DIR"/*.json; do
  [ -f "$stub_path" ] || continue
  # Skip the current-session file (live state)
  [ "$(basename "$stub_path")" = "current.json" ] && continue

  mined_status="$(jq -r '.mined // "null"' "$stub_path" 2>/dev/null || echo "malformed")"

  case "$mined_status" in
    "null")
      # This stub is unmined and has no transcript — reconcile
      if $DRY_RUN; then
        echo "WOULD reconcile: $stub_path"
      else
        tmp_file="${stub_path}.tmp"
        jq '.mined = "transcript-unavailable" | .reconciled_at = (now | todate) | .reconciled_reason = "Claude Code retention cleanup deleted transcript before any mining run; stub keyed by timestamp (pre-fix hook) with no transcript correlation"' \
          "$stub_path" > "$tmp_file" 2>/dev/null
        if [ -s "$tmp_file" ]; then
          mv "$tmp_file" "$stub_path"
        else
          rm -f "$tmp_file"
          SKIPPED_MALFORMED=$((SKIPPED_MALFORMED + 1))
          continue
        fi
      fi
      COUNT=$((COUNT + 1))
      ;;
    "true"|"transcript-unavailable"|"false")
      SKIPPED_MINED=$((SKIPPED_MINED + 1))
      ;;
    "malformed")
      SKIPPED_MALFORMED=$((SKIPPED_MALFORMED + 1))
      ;;
    *)
      # Unknown value — leave alone, count as skipped
      SKIPPED_MINED=$((SKIPPED_MINED + 1))
      ;;
  esac
done

echo ""
if $DRY_RUN; then
  echo "DRY RUN: $COUNT stubs would be reconciled"
else
  echo "Reconciled: $COUNT"
fi
echo "Skipped (already mined/terminal): $SKIPPED_MINED"
echo "Skipped (malformed/unreadable): $SKIPPED_MALFORMED"
