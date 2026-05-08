#!/usr/bin/env bats
@test "all 3 pp-* pipelines exist as YAML" {
  for p in pp-feature-research pp-codebase-refresh pp-onboarding; do
    [ -f "$HOME/.notebooklm-mcp-cli/pipelines/$p.yaml" ] || { echo "missing: $p"; return 1; }
  done
}

@test "every pipeline YAML has name and steps" {
  for p in pp-feature-research pp-codebase-refresh pp-onboarding; do
    f="$HOME/.notebooklm-mcp-cli/pipelines/$p.yaml"
    grep -q "^name: $p$" "$f" && grep -q "^steps:" "$f" || { echo "bad yaml: $p"; return 1; }
  done
}
