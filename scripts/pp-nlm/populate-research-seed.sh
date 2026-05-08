#!/usr/bin/env bash
# Phase 2 — seed pp-research with a "why this notebook exists" note.
# Real content grows via /pp-research and /learn --push-to-nlm pp-research.
set -uo pipefail
ROOT="$(git rev-parse --show-toplevel)"
source "$ROOT/scripts/pp-nlm/lib/source-helpers.sh"
pp_require_auth
ALIAS="pp-research"

TMP=$(mktemp --suffix=.md)
cat > "$TMP" <<'EOF'
# pp-research — Research Lab

## Purpose
Active investigations, deep-research imports, paper text, vendor docs,
and innovation explorations live here. The "what's-out-there" oracle for
ProtoPulse.

## Growth pattern
- `/pp-research <topic>` → `nlm research start --notebook-id pp-research --mode deep`
- `/learn <topic> --push-to-nlm pp-research` → web research + import
- `/pp-innovate <idea>` → notes tagged for innovation review (no separate notebook)

## Citation rule
Always quote the source title + URL when available, and flag which results
came from deep-research vs hand-imported.

## Cross-pollination
After significant research lands, the bidirectional bridge (Phase 10)
extracts atomic claims into `knowledge/` and re-publishes a versioned
knowledge note as a new source on the appropriate Tier-1 notebook.
EOF
add_source_text "$ALIAS" "$TMP" "Why this notebook exists v1 — $(date -u +%Y-%m-%d)"
rm -f "$TMP"

echo ""
echo "Done populating $ALIAS (seed only)"
echo "Source count in manifest: $(pp_manifest_count "$ALIAS")"
