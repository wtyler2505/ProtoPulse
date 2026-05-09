#!/usr/bin/env bash
# Populate pp-feat-firmware-runtime (Tier-2). Roadmap notebook.
#   - 2026-03-13 C5 firmware-runtime plan
set -uo pipefail
ROOT="$(git rev-parse --show-toplevel)"
source "$ROOT/scripts/pp-nlm/lib/source-helpers.sh"
pp_require_auth
ALIAS="pp-feat-firmware-runtime"

for f in \
  docs/superpowers/plans/2026-03-13-c5-firmware-runtime-program.md \
; do
  [ -f "$ROOT/$f" ] && add_source_text "$ALIAS" "$ROOT/$f"
done

echo "Done populating $ALIAS (roadmap notebook — grows as C5 program rolls out)"
echo "Source count: $(pp_manifest_count "$ALIAS")"
