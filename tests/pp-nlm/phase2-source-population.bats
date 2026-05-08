#!/usr/bin/env bats
# tests/pp-nlm/phase2-source-population.bats
# Phase 2 verification: populate scripts produce a manifest with the right shape.

setup() {
  cd "$(git rev-parse --show-toplevel)"
}

MANIFEST="$HOME/.claude/state/pp-nlm/source-manifest.json"

@test "source-manifest.json exists" {
  [ -f "$MANIFEST" ]
}

@test "source-helpers.sh lib exists and is sourceable" {
  [ -f scripts/pp-nlm/lib/source-helpers.sh ]
  run bash -c 'source scripts/pp-nlm/lib/source-helpers.sh && type add_source_text'
  [ "$status" -eq 0 ]
}

@test "all 7 populate scripts exist and are executable" {
  for s in populate-codebase.sh populate-arscontexta.sh populate-memories.sh populate-backlog.sh populate-research-seed.sh populate-journal-seed.sh populate-bench-seed.sh populate-breadboard.sh; do
    [ -x "scripts/pp-nlm/$s" ] || { echo "missing executable: $s"; return 1; }
  done
}

@test "pp-codebase has ≥10 sources after populate" {
  count=$(jq -r '.["pp-codebase"] // [] | length' "$MANIFEST")
  [ "$count" -ge 10 ]
}

@test "pp-arscontexta has ≥3 sources" {
  count=$(jq -r '.["pp-arscontexta"] // [] | length' "$MANIFEST")
  [ "$count" -ge 3 ]
}

@test "pp-memories has ≥10 sources" {
  count=$(jq -r '.["pp-memories"] // [] | length' "$MANIFEST")
  [ "$count" -ge 10 ]
}

@test "pp-backlog has ≥1 source (format guide; MASTER_BACKLOG may oversize-skip)" {
  count=$(jq -r '.["pp-backlog"] // [] | length' "$MANIFEST")
  [ "$count" -ge 1 ]
}

@test "seed notebooks (research, journal, bench) have exactly 1 seed source each" {
  for nb in pp-research pp-journal pp-bench; do
    count=$(jq -r --arg a "$nb" '.[$a] // [] | length' "$MANIFEST")
    [ "$count" -ge 1 ] || { echo "FAIL: $nb has $count sources"; return 1; }
  done
}

@test "every manifest entry has id, title, kind, added" {
  result=$(jq -r 'to_entries | .[] | .value[] | select(has("id") and has("title") and has("kind") and has("added") | not)' "$MANIFEST")
  [ -z "$result" ]
}
