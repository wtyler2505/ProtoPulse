#!/usr/bin/env bash
# scripts/pp-nlm/create-tier1.sh
# Phase 1 — create the 9 Tier-1 ProtoPulse NotebookLM notebooks, set aliases + tags.
# Idempotent: safe to re-run; skips notebooks whose alias already resolves.
# NOTE: `nlm tag add <id> --tags "a,b"` requires the --tags flag (verified 2026-05-08 Phase 0).

set -e
STATE="$HOME/.claude/state/pp-nlm"
MANIFEST="$STATE/notebook-manifest.json"
mkdir -p "$STATE"
[ -f "$MANIFEST" ] || echo "{}" > "$MANIFEST"

if ! nlm login --check >/dev/null 2>&1; then
  echo "nlm: not authenticated. Run: nlm login" >&2
  exit 2
fi

# Tier-1 taxonomy: alias → "Title|tag-suffix"
# tag-suffix is the second-half of the per-notebook tag (`pp:<suffix>`).
declare -A NOTEBOOKS=(
  [pp-codebase]="ProtoPulse :: Codebase Atlas|codebase"
  [pp-breadboard]="ProtoPulse :: Breadboard Lab|breadboard"
  [pp-hardware]="ProtoPulse :: Hardware Knowledge|hardware"
  [pp-arscontexta]="ProtoPulse :: Ars Contexta|arscontexta"
  [pp-memories]="ProtoPulse :: Memories|memories"
  [pp-research]="ProtoPulse :: Research Lab|research"
  [pp-backlog]="ProtoPulse :: Backlog & Iteration|backlog"
  [pp-journal]="ProtoPulse :: Dev Journal|journal"
  [pp-bench]="ProtoPulse :: Bench Notes|bench"
)

for alias in "${!NOTEBOOKS[@]}"; do
  IFS='|' read -r title suffix <<<"${NOTEBOOKS[$alias]}"

  # Skip if alias already resolves
  if nlm alias get "$alias" >/dev/null 2>&1; then
    echo "skip: $alias already exists"
    continue
  fi

  echo "Creating: $title"
  # `nlm notebook create` returns "✓ Created notebook: <id>" or similar; capture id from --quiet flag if available
  raw=$(nlm notebook create "$title" 2>&1)
  # Extract UUID-shaped ID from output
  id=$(echo "$raw" | grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' | head -1)
  if [ -z "$id" ]; then
    echo "FAIL: could not parse notebook id from: $raw" >&2
    exit 3
  fi

  nlm alias set "$alias" "$id"
  nlm tag add "$id" --tags "pp:$suffix,pp:active"

  jq --arg a "$alias" --arg i "$id" --arg t "$title" \
    '. + {($a): {id: $i, title: $t, created: now | todate}}' \
    "$MANIFEST" > "$MANIFEST.tmp"
  mv "$MANIFEST.tmp" "$MANIFEST"

  echo "  ✓ $alias → $id"
  sleep 2  # rate-limit per nlm-skill SKILL.md
done

echo ""
echo "Manifest: $MANIFEST"
jq -r 'to_entries | .[] | "  \(.key): \(.value.id)"' "$MANIFEST"
