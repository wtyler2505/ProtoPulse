#!/usr/bin/env bash
# Ars Contexta -- PostToolUse (Write) hook: validate knowledge vault notes
# Validates files in knowledge/ and inbox/ against schema templates
# Checks: YAML frontmatter exists, required fields present, enum values valid

set -euo pipefail

VAULT_MARKER=".arscontexta"
[[ -f "$VAULT_MARKER" ]] || exit 0

# Get the file path from the tool input
FILE_PATH="${CLAUDE_TOOL_INPUT_FILE_PATH:-}"
[[ -z "$FILE_PATH" ]] && exit 0

# Only validate vault files
case "$FILE_PATH" in
  knowledge/*.md|*/knowledge/*.md)
    # Skip index.md -- it's a hub, not a regular note
    [[ "$(basename "$FILE_PATH")" == "index.md" ]] && exit 0

    # Check for YAML frontmatter
    if ! head -1 "$FILE_PATH" | grep -q '^---'; then
      echo "VALIDATION WARNING: $FILE_PATH missing YAML frontmatter"
      exit 0
    fi