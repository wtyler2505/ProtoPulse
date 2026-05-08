#!/usr/bin/env bats
setup() { cd "$(git rev-parse --show-toplevel)"; }

@test "docs/nlm-archive/ exists and is git-tracked" {
  [ -d docs/nlm-archive ]
  ! git check-ignore docs/nlm-archive/ 2>/dev/null
}

@test "docs/nlm-archive/README.md exists" {
  [ -f docs/nlm-archive/README.md ]
}

@test "docs/nlm-archive/manifest.json is well-formed JSON" {
  jq -e '.' docs/nlm-archive/manifest.json >/dev/null
}

@test "studio-archive.sh exists and is executable" {
  [ -x .claude/hooks/pp-nlm-studio-archive.sh ]
}
