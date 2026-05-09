#!/usr/bin/env bash
# Phase 3 — populate pp-hardware notebook with the 744-note knowledge vault.
#
# Walltime: 12-15 hours typical (per empirical benchmarks in
# ~/.claude/skills/nlm-skill/references/performance-and-batching.md).
# Run in background: `nohup bash scripts/pp-nlm/populate-hardware.sh > ~/.claude/logs/pp-nlm-hardware.log 2>&1 &`
#
# Idempotent via manifest. Re-running picks up where left off.
# Chunked: 50 sources per batch with 30s inter-batch rest to avoid rate limiting.

set -uo pipefail
ROOT="$(git rev-parse --show-toplevel)"
source "$ROOT/scripts/pp-nlm/lib/source-helpers.sh"
pp_require_auth
ALIAS="pp-hardware"

KNOWLEDGE="$ROOT/knowledge"
if [ ! -d "$KNOWLEDGE" ]; then
  echo "FAIL: $KNOWLEDGE not found" >&2
  exit 2
fi

# Build sorted file list
mapfile -t FILES < <(ls "$KNOWLEDGE"/*.md 2>/dev/null | sort)
TOTAL=${#FILES[@]}
echo "$(date -u --iso-8601=seconds) Starting populate-hardware: $TOTAL knowledge notes to consider"

BATCH_SIZE=50
INTER_BATCH_REST=30
batch_num=0
processed=0
added=0
skipped=0
failed=0

for ((i=0; i<TOTAL; i+=BATCH_SIZE)); do
  batch_num=$((batch_num + 1))
  echo "$(date -u --iso-8601=seconds) Batch $batch_num — files $i..$((i + BATCH_SIZE - 1)) of $TOTAL"
  for ((j=i; j<i+BATCH_SIZE && j<TOTAL; j++)); do
    f="${FILES[$j]}"
    processed=$((processed + 1))
    # add_source_text returns 0 on success/skip, 1 on fail
    before_count=$(pp_manifest_count "$ALIAS")
    add_source_text "$ALIAS" "$f" || failed=$((failed + 1))
    after_count=$(pp_manifest_count "$ALIAS")
    if [ "$after_count" -gt "$before_count" ]; then
      added=$((added + 1))
    else
      # Either skipped (already in manifest) or oversized
      :
    fi
  done
  echo "$(date -u --iso-8601=seconds) Batch $batch_num done. Manifest count: $(pp_manifest_count "$ALIAS"). Sleeping ${INTER_BATCH_REST}s before next batch..."
  sleep "$INTER_BATCH_REST"
done

echo "$(date -u --iso-8601=seconds) populate-hardware complete."
echo "  Total considered: $processed"
echo "  Added (this run): $added"
echo "  Failed:           $failed"
echo "  Manifest total:   $(pp_manifest_count "$ALIAS")"
