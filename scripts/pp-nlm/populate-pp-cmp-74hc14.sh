#!/usr/bin/env bash
set -uo pipefail
ROOT="$(git rev-parse --show-toplevel)"
source "$ROOT/scripts/pp-nlm/lib/source-helpers.sh"
pp_require_auth
ALIAS="pp-cmp-74hc14"

for f in \
  knowledge/74hc14-schmitt-trigger-buffer-isolates-esp32-strapping-pins-from-external-loads-during-boot.md \
  knowledge/74hc14-inverting-and-74hct245-non-inverting-buffers-trade-firmware-complexity-against-level-shifting-integration.md \
; do
  [ -f "$ROOT/$f" ] && add_source_text "$ALIAS" "$ROOT/$f"
done

echo "Done populating $ALIAS"
echo "Source count: $(pp_manifest_count "$ALIAS")"
