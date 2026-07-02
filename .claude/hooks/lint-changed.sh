#!/usr/bin/env bash
# lint-changed.sh — PostToolUse hook (Write|Edit|MultiEdit).
#
# Replaces claudekit's `lint-changed`, which silently no-ops on this repo:
# its linter detection looks for legacy .eslintrc* and does not recognize the
# flat eslint.config.js, so it printed "No linters configured, skipping lint
# check" on every file — which is how 45 react-hooks errors reached CI on
# 2026-07-01 (both workflows red on 7e0deb3d). This script runs the repo's
# real eslint against the single changed file and BLOCKS (exit 2) on errors,
# so lint failures are fixed at write time, not discovered in CI.
set -uo pipefail

REPO="/home/wtyler/Projects/ProtoPulse"
INPUT=$(cat)

FILE=$(printf '%s' "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null)
[ -z "$FILE" ] && { echo '{}'; exit 0; }

# Only lintable JS/TS sources, only inside the repo, only if still present.
case "$FILE" in
  "$REPO"/*) : ;;
  *) echo '{}'; exit 0 ;;
esac
case "$FILE" in
  *.ts|*.tsx|*.js|*.jsx|*.mts|*.cts|*.mjs|*.cjs) : ;;
  *) echo '{}'; exit 0 ;;
esac
case "$FILE" in
  */node_modules/*|*/dist/*|*/build/*|*/.claude/worktrees/*|*/ds-bundle/*)
    echo '{}'; exit 0 ;;
esac
[ -f "$FILE" ] || { echo '{}'; exit 0; }

OUT=$(cd "$REPO" && npx eslint --quiet --no-warn-ignored "$FILE" 2>&1)
RC=$?

if [ "$RC" -ne 0 ] && [ -n "$OUT" ]; then
  # Blocking: stderr is fed back to Claude so the errors get fixed now.
  printf 'eslint errors in %s (fix before continuing):\n%s\n' "$FILE" "$OUT" >&2
  exit 2
fi

echo '{}'
exit 0
