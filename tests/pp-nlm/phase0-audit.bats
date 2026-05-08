#!/usr/bin/env bats
# tests/pp-nlm/phase0-audit.bats
# Phase 0 verification: auth, doctor, audit script produces valid manifest.

setup() {
  cd "$(git rev-parse --show-toplevel)"
}

@test "nlm CLI is on PATH" {
  run command -v nlm
  [ "$status" -eq 0 ]
}

@test "nlm login --check passes" {
  run nlm login --check
  [ "$status" -eq 0 ]
}

@test "nlm doctor passes" {
  run nlm doctor
  [ "$status" -eq 0 ]
}

@test "audit script exists and is executable" {
  [ -x scripts/pp-nlm/audit-existing.sh ]
}

@test "audit script produces a JSON manifest" {
  run bash scripts/pp-nlm/audit-existing.sh
  [ "$status" -eq 0 ]
  date_today=$(date -u +%Y-%m-%d)
  [ -f "$HOME/.claude/state/pp-nlm/audit-$date_today.json" ]
}

@test "audit JSON is well-formed and lists notebooks" {
  date_today=$(date -u +%Y-%m-%d)
  run jq -e '.notebooks | type == "array" and length >= 0' \
    "$HOME/.claude/state/pp-nlm/audit-$date_today.json"
  [ "$status" -eq 0 ]
}

@test "audit envelope has audit_date and account fields" {
  date_today=$(date -u +%Y-%m-%d)
  file="$HOME/.claude/state/pp-nlm/audit-$date_today.json"
  jq -e 'has("audit_date") and has("account") and has("notebooks")' "$file"
}
