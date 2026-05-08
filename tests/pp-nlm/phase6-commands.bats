#!/usr/bin/env bats
# Phase 6: 14 /pp-* slash commands have valid frontmatter + reference $ARGUMENTS or are no-arg.

setup() { cd "$(git rev-parse --show-toplevel)"; }

EXPECTED="pp-capture pp-query pp-status pp-recap pp-iter pp-research pp-innovate pp-bench pp-podcast pp-mindmap pp-report pp-sync pp-promote pp-archive"

@test "all 14 pp-* command files exist" {
  for c in $EXPECTED; do
    [ -f ".claude/commands/$c.md" ] || { echo "missing: $c"; return 1; }
  done
}

@test "every pp-* command has YAML frontmatter (--- markers)" {
  for c in $EXPECTED; do
    head -1 ".claude/commands/$c.md" | grep -q '^---$' || { echo "no frontmatter: $c"; return 1; }
  done
}

@test "every pp-* command frontmatter has 'description'" {
  for c in $EXPECTED; do
    awk '/^---$/{n++; next} n==1' ".claude/commands/$c.md" | grep -qE '^description:' || { echo "no description: $c"; return 1; }
  done
}

@test "every pp-* command frontmatter has 'allowed-tools'" {
  for c in $EXPECTED; do
    awk '/^---$/{n++; next} n==1' ".claude/commands/$c.md" | grep -qE '^allowed-tools:' || { echo "no allowed-tools: $c"; return 1; }
  done
}

@test "arg-taking commands reference \$ARGUMENTS or \$1" {
  for c in pp-capture pp-query pp-recap pp-iter pp-research pp-innovate pp-bench pp-promote; do
    grep -qE '\$ARGUMENTS|\$1' ".claude/commands/$c.md" || { echo "missing args ref: $c"; return 1; }
  done
}
