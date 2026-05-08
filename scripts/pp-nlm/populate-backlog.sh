#!/usr/bin/env bash
# Phase 2 — populate pp-backlog notebook (BL-XXXX iteration history).
# MASTER_BACKLOG.md is large; if >500K words, the lib auto-skips and logs.
# Future: split MASTER_BACKLOG.md by section into multiple sources.
set -uo pipefail
ROOT="$(git rev-parse --show-toplevel)"
source "$ROOT/scripts/pp-nlm/lib/source-helpers.sh"
pp_require_auth
ALIAS="pp-backlog"

MB="$ROOT/docs/MASTER_BACKLOG.md"
if [ -f "$MB" ]; then
  add_source_text "$ALIAS" "$MB" "MASTER_BACKLOG snapshot v1 — $(date -u +%Y-%m-%d)"
fi

# Format guide (seed)
TMP_GUIDE=$(mktemp --suffix=.md)
cat > "$TMP_GUIDE" <<'EOF'
# Iteration log format guide — pp-backlog

## Purpose
Time-series, append-only record of BL-XXXX decisions, Wave history, and
'we tried X, didn't work, chose Y because Z' entries.

## Entry shape
- **Title:** `<ISO-date> — <decision-tag> (BL-XXXX if applicable)`
- **Body:** four fields:
  1. **Tried:** what was attempted
  2. **Why not:** why it didn't fit
  3. **Chose:** what was chosen instead
  4. **Why:** the reasoning that made it the right call

## Entries are added via
`/pp-iter <decision>` slash command, or `nlm note create pp-backlog ...` manually.
Wave snapshots are appended via the weekly cron (`pp-nlm-weekly-cron.sh`).
EOF
add_source_text "$ALIAS" "$TMP_GUIDE" "Iteration log format guide v1 — $(date -u +%Y-%m-%d)"
rm -f "$TMP_GUIDE"

echo ""
echo "Done populating $ALIAS"
echo "Source count in manifest: $(pp_manifest_count "$ALIAS")"
