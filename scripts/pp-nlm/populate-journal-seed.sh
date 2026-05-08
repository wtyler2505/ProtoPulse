#!/usr/bin/env bash
# Phase 2 — seed pp-journal with the journal format guide.
# Real entries grow via /pp-recap + the commit-to-journal hook.
set -uo pipefail
ROOT="$(git rev-parse --show-toplevel)"
source "$ROOT/scripts/pp-nlm/lib/source-helpers.sh"
pp_require_auth
ALIAS="pp-journal"

TMP=$(mktemp --suffix=.md)
cat > "$TMP" <<'EOF'
# pp-journal — Dev Journal format guide

## Purpose
Daily/weekly recaps, session digests, commit summaries. Append-only chronicle
of ProtoPulse work.

## Entry shape
- **Title:** `<YYYY-MM-DD> — <title>` for daily; `Audio: Week of <ISO-Monday>` for weekly briefs.
- **Body:** ~200-word recap. Headlines first, two-line synopsis each.

## How entries land
- `git commit` → PostToolUse hook `pp-nlm-commit-to-journal.sh` appends commit subject + body
  to today's journal note (creates note if none exists for today).
- `/pp-recap` (no args) — synthesize recap from current session, preview, confirm, push.
- `/pp-recap apply` — push the buffered Stop-hook draft.
- Weekly Sunday 9 AM cron — generates audio brief from the week's journal entries.

## Citation rule
Required: ISO date prefix on every entry.
EOF
add_source_text "$ALIAS" "$TMP" "Journal format guide v1 — $(date -u +%Y-%m-%d)"
rm -f "$TMP"

echo ""
echo "Done populating $ALIAS (seed only)"
echo "Source count in manifest: $(pp_manifest_count "$ALIAS")"
