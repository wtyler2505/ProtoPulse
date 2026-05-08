#!/usr/bin/env bash
# Phase 2 — populate pp-arscontexta notebook (methodology layer).
set -uo pipefail
ROOT="$(git rev-parse --show-toplevel)"
source "$ROOT/scripts/pp-nlm/lib/source-helpers.sh"
pp_require_auth
ALIAS="pp-arscontexta"

# Methodology corpus
for f in \
  ops/derivation.md \
  ops/derivation-manifest.md \
  self/methodology.md \
  self/identity.md \
  self/goals.md \
  CLAUDE.md \
; do
  [ -f "$ROOT/$f" ] && add_source_text "$ALIAS" "$ROOT/$f"
done

# All ops/methodology/*.md
if [ -d "$ROOT/ops/methodology" ]; then
  for f in "$ROOT"/ops/methodology/*.md; do
    [ -f "$f" ] && add_source_text "$ALIAS" "$f"
  done
fi

echo ""
echo "Done populating $ALIAS"
echo "Source count in manifest: $(pp_manifest_count "$ALIAS")"
