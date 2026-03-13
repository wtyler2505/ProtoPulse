#!/usr/bin/env bash
# Ars Contexta — PostToolUse (Write) hook: auto-commit vault changes
# Only commits changes inside knowledge/ directory
# Runs async to avoid blocking

set -euo pipefail

VAULT_MARKER=".arscontexta"
[[ -f "$VAULT_MARKER" ]] || exit 0

# Check if git is configured for auto-commit
if grep -q 'git: false' "$VAULT_MARKER" 2>/dev/null; then
  exit 0
fi

# Get the file path from the tool input
FILE_PATH="${CLAUDE_TOOL_INPUT_FILE_PATH:-}"
[[ -z "$FILE_PATH" ]] && exit 0

# Only auto-commit knowledge vault files
case "$FILE_PATH" in
  knowledge/*|*/knowledge/*)
    # Stage and commit the specific file
    git add "$FILE_PATH" 2>/dev/null || exit 0
    git commit -m "knowledge: auto-commit $(basename "$FILE_PATH")" --no-verify 2>/dev/null || exit 0
    ;;
esac

exit 0
