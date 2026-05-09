#!/usr/bin/env bash
set -uo pipefail
ROOT="$(git rev-parse --show-toplevel)"
source "$ROOT/scripts/pp-nlm/lib/source-helpers.sh"
pp_require_auth
ALIAS="pp-cmp-74hc595"

# All 74hc595-* atomic claims + the daisy-chain claim + canonical part note + datasheet doc
for f in $ROOT/knowledge/74hc595-*.md; do
  [ -f "$f" ] && add_source_text "$ALIAS" "$f"
done

for f in \
  knowledge/daisy-chained-74hc595s-share-clock-and-latch-lines-so-n-chips-update-simultaneously-from-one-latch-pulse.md \
  knowledge/hardware-component-74hc595-8-bit-shift-register.md \
  docs/parts/74hc595-8-bit-shift-register-serial-to-parallel-dip16.md \
; do
  [ -f "$ROOT/$f" ] && add_source_text "$ALIAS" "$ROOT/$f"
done

echo "Done populating $ALIAS"
echo "Source count: $(pp_manifest_count "$ALIAS")"
