#!/usr/bin/env bash
# git-guard.sh — pause/resume the vault auto-committers around deliberate commits.
#
# Root cause this solves: the arscontexta plugin's async PostToolUse hook
# (`git add -A` + `commit "Auto: N files"`) races deliberate descriptive
# commits — three collisions on 2026-07-01 alone, one of which (an amend of
# an already-auto-pushed commit) forced a patch-id/rebase repair on main.
# Both auto-committers (plugin hook + .claude/hooks/auto-commit-vault.sh)
# read the `git:` key in .arscontexta via their config readers, so toggling
# that one key pauses both through their own supported mechanism — no plugin
# cache patching (which an update would silently revert).
#
# Usage:
#   scripts/git-guard.sh pause    # before a deliberate add+commit block
#   scripts/git-guard.sh resume   # immediately after committing
#   scripts/git-guard.sh status
#
# Convention: pause and resume in the SAME turn — a paused guard means no
# auto-commit safety net. `status` warns loudly when paused.
set -uo pipefail

MARKER="$(cd "$(dirname "$0")/.." && pwd)/.arscontexta"
[ -f "$MARKER" ] || { echo "git-guard: no .arscontexta marker found" >&2; exit 1; }

current() { grep -E '^git:' "$MARKER" | head -1 | sed 's/^git:[[:space:]]*//'; }

case "${1:-status}" in
  pause)
    sed -i -E 's/^git:[[:space:]]*.*/git: false/' "$MARKER"
    echo "git-guard: auto-commit PAUSED (git: $(current)) — resume in the same turn"
    ;;
  resume)
    sed -i -E 's/^git:[[:space:]]*.*/git: true/' "$MARKER"
    echo "git-guard: auto-commit resumed (git: $(current))"
    ;;
  status)
    v="$(current)"
    if [ "$v" = "true" ]; then
      echo "git-guard: active (git: true — auto-commit on)"
    else
      echo "git-guard: ⚠ PAUSED (git: $v) — auto-commit is OFF; run 'scripts/git-guard.sh resume'"
    fi
    ;;
  *)
    echo "usage: git-guard.sh {pause|resume|status}" >&2; exit 1
    ;;
esac
