#!/usr/bin/env bash
# Populate pp-feat-design-system (Tier-2). Curated source set:
#   - docs/design-system/ canonical token/primitive docs
#   - Sample VaultExplainer/HoverCard component code (the project-specific primitives)
set -uo pipefail
ROOT="$(git rev-parse --show-toplevel)"
source "$ROOT/scripts/pp-nlm/lib/source-helpers.sh"
pp_require_auth
ALIAS="pp-feat-design-system"

# Design system docs
for f in \
  docs/design-system/tokens.md \
  docs/design-system/vault-primitives.md \
; do
  [ -f "$ROOT/$f" ] && add_source_text "$ALIAS" "$ROOT/$f"
done

# Vault primitive components (find any *VaultExplainer*.tsx, *VaultHoverCard*.tsx)
for f in $(find "$ROOT/client/src/components" -type f \( -name "*VaultExplainer*" -o -name "*VaultHoverCard*" -o -name "*SourceChip*" \) 2>/dev/null | head -10); do
  [ -f "$f" ] && add_source_text "$ALIAS" "$f"
done

echo "Done populating $ALIAS"
echo "Source count: $(pp_manifest_count "$ALIAS")"
