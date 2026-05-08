#!/usr/bin/env bats
setup() { cd "$(git rev-parse --show-toplevel)"; }
HOOKS=".claude/hooks"

@test "all 5 pp-nlm hooks exist and are executable" {
  for h in pp-nlm-session-start.sh pp-nlm-commit-to-journal.sh pp-nlm-stop-draft-recap.sh pp-nlm-studio-archive.sh pp-nlm-weekly-cron.sh; do
    [ -x "$HOOKS/$h" ] || { echo "missing exe: $h"; return 1; }
  done
}

@test "session-start hook exits 0 on cache hit" {
  mkdir -p "$HOME/.claude/state/pp-nlm"
  touch "$HOME/.claude/state/pp-nlm/session-context-cache.md"
  run bash "$HOOKS/pp-nlm-session-start.sh"
  [ "$status" -eq 0 ]
}

@test "stop-draft-recap exits 0 on empty stdin" {
  run bash -c 'echo "{}" | bash .claude/hooks/pp-nlm-stop-draft-recap.sh'
  [ "$status" -eq 0 ]
}

@test "settings.json has pp-nlm-session-start wired" {
  grep -q "pp-nlm-session-start.sh" .claude/settings.json
}

@test "settings.json has pp-nlm-commit-to-journal wired" {
  grep -q "pp-nlm-commit-to-journal.sh" .claude/settings.json
}

@test "settings.json has pp-nlm-stop-draft-recap wired" {
  grep -q "pp-nlm-stop-draft-recap.sh" .claude/settings.json
}
