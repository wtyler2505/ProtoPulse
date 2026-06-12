#!/bin/bash
# Quick initref staleness check — runs on session start
# Exit 0 = fresh, Exit 0 with message = stale (informational only, never blocks)

META=".ref/.initref-meta.json"
if [ ! -f "$META" ]; then
  echo "initref: No .ref/ metadata found. Run /initref to generate project context."
  exit 0
fi

STORED_SHA=$(jq -r '.git_sha' "$META" 2>/dev/null)
CURRENT_SHA=$(git rev-parse HEAD 2>/dev/null || echo "no-git")
GENERATED_AT=$(jq -r '.generated_at' "$META" 2>/dev/null)

if [ "$STORED_SHA" = "$CURRENT_SHA" ]; then
  # Fresh — say nothing
  exit 0
fi

COMMITS_SINCE=$(git rev-list --count ${STORED_SHA}..HEAD 2>/dev/null || echo "?")
echo "initref: ${COMMITS_SINCE} commits since last scan (${GENERATED_AT}). Consider /initref --update or /initref --validate."
exit 0
