#!/usr/bin/env bash
# Phase 2 — seed pp-bench with the bench notebook format guide.
# Real bench observations grow via /pp-bench.
set -uo pipefail
ROOT="$(git rev-parse --show-toplevel)"
source "$ROOT/scripts/pp-nlm/lib/source-helpers.sh"
pp_require_auth
ALIAS="pp-bench"

TMP=$(mktemp --suffix=.md)
cat > "$TMP" <<'EOF'
# pp-bench — Bench Notes format guide

## Purpose
Physical bench observations, hardware notes, real-world part comparisons.
ProtoPulse is built by a maker — actual hardware bench tied to digital design.

## Entry shape
- **Title:** `<ISO-date> — <part-or-topic>` (e.g. `2026-05-08 — ESP32 brownout under motor switching`)
- **Body fields** (when applicable):
  - Part number(s)
  - Vendor + batch
  - Measurement (voltage, current, frequency, temperature)
  - Observed behavior
  - Hypothesis / conclusion

## How entries land
- `/pp-bench <observation>` slash command — AskUserQuestion captures the optional fields.
- Manual `nlm note create pp-bench "..." --title "..."`.

## Citation rule
Required: part number / vendor / measurement source on every claim.
EOF
add_source_text "$ALIAS" "$TMP" "Bench notes format guide v1 — $(date -u +%Y-%m-%d)"
rm -f "$TMP"

echo ""
echo "Done populating $ALIAS (seed only)"
echo "Source count in manifest: $(pp_manifest_count "$ALIAS")"
