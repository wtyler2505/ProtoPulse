#!/usr/bin/env bash
# Populate pp-cmp-mosfet-pmos (Tier-3). Roadmap notebook — vault is N-MOS-heavy.
set -uo pipefail
ROOT="$(git rev-parse --show-toplevel)"
source "$ROOT/scripts/pp-nlm/lib/source-helpers.sh"
pp_require_auth
ALIAS="pp-cmp-mosfet-pmos"

# Closest tangentially-related claim — the protection-discipline parent claim.
[ -f "$ROOT/knowledge/zs-x11h-has-no-reverse-polarity-overcurrent-or-thermal-protection-making-inline-fuse-mandatory.md" ] && \
  add_source_text "$ALIAS" "$ROOT/knowledge/zs-x11h-has-no-reverse-polarity-overcurrent-or-thermal-protection-making-inline-fuse-mandatory.md"

# Cross-link N-MOS family for the polarity-inversion contrast
for f in \
  knowledge/floating-gate-pull-down-on-mosfet-is-mandatory-to-prevent-random-actuation-during-mcu-boot.md \
  knowledge/logic-level-mosfet-gate-threshold-below-3v-eliminates-need-for-gate-driver-circuit.md \
; do
  [ -f "$ROOT/$f" ] && add_source_text "$ALIAS" "$ROOT/$f"
done

echo "Done populating $ALIAS (roadmap — vault gap explicit; grows as Tyler does P-channel work)"
echo "Source count: $(pp_manifest_count "$ALIAS")"
