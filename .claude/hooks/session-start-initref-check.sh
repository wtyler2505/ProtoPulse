#!/bin/bash
# initref staleness check — runs on SessionStart. Informational only: ALWAYS exit 0, never blocks.
#
# Noise-aware by design. ProtoPulse auto-commits `.claude/.tsc-errors.log` (and other vault
# churn) constantly, so a raw `git rev-list --count` over-reports drift wildly — that's how the
# .ref bundle once read "426 commits stale" when only ~60 were real source changes. This version
# counts SUBSTANTIVE commits only: ones that touch real source dirs AND aren't `Auto:` machine
# commits. Stays silent until meaningful drift accumulates, so the signal is worth trusting.

META=".ref/.initref-meta.json"
if [ ! -f "$META" ]; then
  echo "initref: No .ref/ metadata found. Run /initref to generate project context."
  exit 0
fi

STORED_SHA=$(jq -r '.git_sha' "$META" 2>/dev/null)
CURRENT_SHA=$(git rev-parse HEAD 2>/dev/null || echo "no-git")

# Fresh, git unavailable, or stored sha not in history (rebase/reset) → say nothing.
[ "$STORED_SHA" = "$CURRENT_SHA" ] && exit 0
[ "$CURRENT_SHA" = "no-git" ] && exit 0
git cat-file -e "$STORED_SHA" 2>/dev/null || exit 0

RANGE="${STORED_SHA}..HEAD"
# Substantive = non-merge commits touching real source dirs whose subject isn't an `Auto:` commit.
SUBSTANTIVE=$(git log --no-merges --format='%s' "$RANGE" -- client server shared packages tools 2>/dev/null | grep -vc '^Auto: ')
TOTAL=$(git rev-list --count "$RANGE" 2>/dev/null || echo '?')

# Only speak up on meaningful drift; ignore pure auto-commit churn.
if [ "${SUBSTANTIVE:-0}" -ge 15 ]; then
  echo "initref: ${SUBSTANTIVE} substantive source commits since last .ref scan (${TOTAL} total incl. auto-commits). Consider /initref --update or /initref --validate."
fi
exit 0
