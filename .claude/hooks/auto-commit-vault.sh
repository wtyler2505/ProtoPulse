#!/usr/bin/env bash
# Ars Contexta -- PostToolUse (Write) hook: auto-commit vault changes
# Commits changes to knowledge/, inbox/, self/, ops/, templates/, manual/
# Runs async to avoid blocking the session

set -euo pipefail

VAULT_MARKER=".arscontexta"
[[ -f "$VAULT_MARKER" ]] || { echo "{}"; exit 0; }

# Check if git auto-commit is enabled
if grep -q 'git: false' "$VAULT_MARKER" 2>/dev/null; then
  exit 0
fi

# Get the file path from the tool input
FILE_PATH="${CLAUDE_TOOL_INPUT_FILE_PATH:-}"
[[ -z "$FILE_PATH" ]] && { echo "{}"; exit 0; }

# Only auto-commit vault content files
case "$FILE_PATH" in
  knowledge/*|inbox/*|self/*|ops/*|templates/*|manual/*)
    dir=$(echo "$FILE_PATH" | cut -d'/' -f1)
    basename_file=$(basename "$FILE_PATH")
    git add "$FILE_PATH" 2>/dev/null || { echo "{}"; exit 0; }
    git commit -m "vault($dir): auto-commit $basename_file" --no-verify 2>/dev/null || { echo "{}"; exit 0; }
    ;;
  */knowledge/*|*/inbox/*|*/self/*|*/ops/*|*/templates/*|*/manual/*)
    dir=$(echo "$FILE_PATH" | grep -oE '(knowledge|inbox|self|ops|templates|manual)' | head -1)
    basename_file=$(basename "$FILE_PATH")
    git add "$FILE_PATH" 2>/dev/null || { echo "{}"; exit 0; }
    git commit -m "vault($dir): auto-commit $basename_file" --no-verify 2>/dev/null || { echo "{}"; exit 0; }
    ;;
esac

exit 0