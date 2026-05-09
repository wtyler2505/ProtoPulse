#!/usr/bin/env bats
# tests/pp-nlm/phase10-bridge.bats
# Phase 10 bidirectional bridge — verifies forward + return leg infrastructure.

setup() { cd "$(git rev-parse --show-toplevel)"; }

@test "studio-output-to-inbox.sh exists and is executable" {
  [ -x scripts/pp-nlm/studio-output-to-inbox.sh ]
}

@test "sync-knowledge-to-nlm.sh exists and is executable" {
  [ -x scripts/pp-nlm/sync-knowledge-to-nlm.sh ]
}

@test "ops/index/nlm-index.json exists and is well-formed JSON" {
  [ -f ops/index/nlm-index.json ]
  jq -e '.' ops/index/nlm-index.json >/dev/null
}

@test "ops/index/README.md documents the schema" {
  [ -f ops/index/README.md ]
  grep -q "nlm-index.json" ops/index/README.md
  grep -q "loop prevention" ops/index/README.md
}

@test "studio-output-to-inbox bails cleanly without arg" {
  run bash scripts/pp-nlm/studio-output-to-inbox.sh
  [ "$status" -eq 2 ]
}

@test "studio-output-to-inbox bails cleanly with non-existent file" {
  run bash scripts/pp-nlm/studio-output-to-inbox.sh /tmp/does-not-exist-$(date +%s).md
  [ "$status" -eq 3 ]
}

@test "studio-output-to-inbox produces inbox file with proper frontmatter from a fixture" {
  # Create a fixture archive entry + content
  fixture_id="test-fixture-$(date +%s)"
  fixture_path="docs/nlm-archive/pp-codebase/test-fixture-${fixture_id}.md"
  mkdir -p docs/nlm-archive/pp-codebase
  cat > "$fixture_path" <<EOF
# Test fixture report

This is a test artifact for round-trip verification.

Source: docs/superpowers/plans/2026-04-12-parts-knowledge-extraction.md:42 — components are routed via the parts catalog.
EOF
  # Add to manifest
  tmp=$(mktemp)
  jq --arg id "$fixture_id" --arg p "$fixture_path" \
    '. + {($id): {type: "report", alias: "pp-codebase", title: "Test fixture report", path: $p, archived: now | todate}}' \
    docs/nlm-archive/manifest.json > "$tmp" && mv "$tmp" docs/nlm-archive/manifest.json

  # Run forward leg
  run bash scripts/pp-nlm/studio-output-to-inbox.sh "$fixture_path"
  [ "$status" -eq 0 ]

  # Verify inbox file
  inbox_file=$(ls inbox/*nlm-${fixture_id}*.md 2>/dev/null | head -1)
  [ -n "$inbox_file" ]

  # Frontmatter checks
  grep -q "provenance:" "$inbox_file"
  grep -q "source: nlm-studio" "$inbox_file"
  grep -q "artifact_id: $fixture_id" "$inbox_file"
  grep -q "notebook_alias: pp-codebase" "$inbox_file"

  # Cleanup fixture
  rm -f "$fixture_path" "$inbox_file"
  tmp=$(mktemp)
  jq --arg id "$fixture_id" 'del(.[$id])' docs/nlm-archive/manifest.json > "$tmp" && mv "$tmp" docs/nlm-archive/manifest.json
}

@test "studio-output-to-inbox skips when artifact_id already in nlm-index" {
  fixture_id="test-loopguard-$(date +%s)"
  # Pre-populate nlm-index with this id
  tmp=$(mktemp)
  jq --arg id "$fixture_id" --arg kp "knowledge/test-fake.md" \
    '. + {($id): {knowledge_path: $kp, last_updated: now | todate}}' \
    ops/index/nlm-index.json > "$tmp" && mv "$tmp" ops/index/nlm-index.json

  # Create fixture
  fixture_path="docs/nlm-archive/pp-codebase/loopguard-${fixture_id}.md"
  mkdir -p docs/nlm-archive/pp-codebase
  echo "loopguard test" > "$fixture_path"
  tmp=$(mktemp)
  jq --arg id "$fixture_id" --arg p "$fixture_path" \
    '. + {($id): {type: "report", alias: "pp-codebase", title: "Loop guard test", path: $p, archived: now | todate}}' \
    docs/nlm-archive/manifest.json > "$tmp" && mv "$tmp" docs/nlm-archive/manifest.json

  # Run — should skip
  run bash scripts/pp-nlm/studio-output-to-inbox.sh "$fixture_path"
  [ "$status" -eq 0 ]
  # Verify no inbox file was written
  inbox_count=$(ls inbox/*nlm-${fixture_id}*.md 2>/dev/null | wc -l)
  [ "$inbox_count" -eq 0 ]

  # Cleanup
  rm -f "$fixture_path"
  tmp=$(mktemp)
  jq --arg id "$fixture_id" 'del(.[$id])' docs/nlm-archive/manifest.json > "$tmp" && mv "$tmp" docs/nlm-archive/manifest.json
  tmp=$(mktemp)
  jq --arg id "$fixture_id" 'del(.[$id])' ops/index/nlm-index.json > "$tmp" && mv "$tmp" ops/index/nlm-index.json
}
