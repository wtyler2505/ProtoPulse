#!/usr/bin/env bats
setup() { cd "$(git rev-parse --show-toplevel)"; }

@test "all 9 Tier-1 chat configs exist" {
  for a in pp-codebase pp-breadboard pp-hardware pp-arscontexta pp-memories pp-research pp-backlog pp-journal pp-bench; do
    [ -f "data/pp-nlm/chat-configs/$a.txt" ] || { echo "missing: $a"; return 1; }
  done
}

@test "every chat config is under 10K chars (UTF-8 multi-byte safe)" {
  for f in data/pp-nlm/chat-configs/*.txt; do
    chars=$(wc -m < "$f")
    [ "$chars" -lt 10000 ] || { echo "FAIL: $f is $chars chars"; return 1; }
  done
}

@test "every chat config has CITATION RULE" {
  for f in data/pp-nlm/chat-configs/*.txt; do
    grep -q "CITATION RULE:" "$f" || { echo "no citation rule: $f"; return 1; }
  done
}

@test "apply-chat-configs.sh exists and is executable" {
  [ -x scripts/pp-nlm/apply-chat-configs.sh ]
}
