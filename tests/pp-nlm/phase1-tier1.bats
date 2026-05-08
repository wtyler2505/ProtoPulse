#!/usr/bin/env bats
# tests/pp-nlm/phase1-tier1.bats
# Phase 1 verification: 9 Tier-1 notebooks exist with aliases + tags; .mcp.json wired.

setup() {
  cd "$(git rev-parse --show-toplevel)"
}

ALIASES="pp-codebase pp-breadboard pp-hardware pp-arscontexta pp-memories pp-research pp-backlog pp-journal pp-bench"

@test ".mcp.json contains notebooklm-mcp" {
  run jq -e '.mcpServers | has("notebooklm-mcp")' .mcp.json
  [ "$status" -eq 0 ]
}

@test "all 9 pp-* aliases resolve" {
  for nb in $ALIASES; do
    run nlm alias get "$nb"
    [ "$status" -eq 0 ] || { echo "alias missing: $nb"; return 1; }
  done
}

@test "all 9 pp-* notebooks tagged pp:active" {
  # `nlm tag select` returns matched notebooks, one per numbered line.
  count=$(nlm tag select "pp:active" 2>/dev/null | grep -cE '^\s+[0-9]+\.')
  [ "$count" -eq 9 ]
}

@test "notebook-manifest.json has all 9 entries" {
  manifest="$HOME/.claude/state/pp-nlm/notebook-manifest.json"
  [ -f "$manifest" ]
  run jq -e 'length >= 9' "$manifest"
  [ "$status" -eq 0 ]
}

@test "every alias in manifest has an id field" {
  manifest="$HOME/.claude/state/pp-nlm/notebook-manifest.json"
  for nb in $ALIASES; do
    run jq -e --arg a "$nb" '.[$a].id | length > 0' "$manifest"
    [ "$status" -eq 0 ] || { echo "manifest missing id for: $nb"; return 1; }
  done
}
