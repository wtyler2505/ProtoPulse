#!/usr/bin/env bash
# check-vault-primitive.sh
#
# CI guard for 16-design-system Phase 8: every consumer of vault content in the
# app MUST go through <VaultHoverCard> / <VaultExplainer> / useVaultQuickFetch.
# Direct useVaultNote / useVaultSearch / /api/vault/ usage is only allowed in:
#   - The primitive files themselves
#   - The vault browser/explorer views (they're the vault UI)
#   - The chat answer-source panel (already shipped before this primitive)
#
# Any NEW direct consumer is a regression per the plan's gate.
#
# Exit codes:
#   0 — compliant
#   1 — one or more bypassers found
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"

# Whitelist: files allowed to import directly from useVaultSearch. Anything
# else that imports useVaultNote / useVaultSearch / useVaultMocs is a bypasser.
ALLOWED=(
  "client/src/hooks/useVaultSearch.ts"
  "client/src/hooks/useVaultQuickFetch.ts"
  "client/src/components/ui/vault-hover-card.tsx"
  "client/src/components/ui/vault-explainer.tsx"
  "client/src/components/ui/vault-info-icon.tsx"
  "client/src/components/views/VaultBrowserView.tsx"
  "client/src/components/panels/chat/AnswerSourcePanel.tsx"
  "client/src/hooks/__tests__/useVaultQuickFetch.test.tsx"
)

# Build an egrep alternation of basenames for the whitelist
WHITELIST_RE=""
for f in "${ALLOWED[@]}"; do
  [ -z "$WHITELIST_RE" ] && WHITELIST_RE="$f" || WHITELIST_RE="$WHITELIST_RE|$f"
done

# Scan all client code. Look for ANY import or named reference to the raw hooks.
BYPASSERS=$(
  grep -rlE "useVaultNote|useVaultSearch\b|useVaultMocs" \
    --include='*.ts' --include='*.tsx' \
    client/src 2>/dev/null \
  | grep -vE "^(${WHITELIST_RE})$" \
  || true
)

if [ -n "$BYPASSERS" ]; then
  echo "ERROR: vault-primitive bypass detected. These files import vault hooks" >&2
  echo "directly instead of consuming <VaultHoverCard> / <VaultExplainer>:" >&2
  echo "" >&2
  echo "$BYPASSERS" | sed 's/^/  /' >&2
  echo "" >&2
  echo "If your use case genuinely needs the raw hook (e.g., a new top-level" >&2
  echo "vault surface), add the file to the ALLOWED whitelist in this script" >&2
  echo "with a one-line comment explaining why. Otherwise route through the" >&2
  echo "primitive." >&2
  exit 1
fi

echo "vault-primitive check passed (${#ALLOWED[@]} allowed consumers, 0 bypassers)"
exit 0
