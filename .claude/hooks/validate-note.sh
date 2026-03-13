#!/usr/bin/env bash
# Ars Contexta — PostToolUse (Write) hook: validate knowledge vault notes
# Only validates files inside knowledge/insights/ or knowledge/captures/
# Checks: YAML frontmatter exists, required fields present

set -euo pipefail

VAULT_MARKER=".arscontexta"
[[ -f "$VAULT_MARKER" ]] || exit 0

# Get the file path from the tool input
FILE_PATH="${CLAUDE_TOOL_INPUT_FILE_PATH:-}"
[[ -z "$FILE_PATH" ]] && exit 0

# Only validate knowledge vault files
case "$FILE_PATH" in
  knowledge/insights/*.md|*/knowledge/insights/*.md)
    # Validate insight: check for required YAML fields
    if ! head -1 "$FILE_PATH" | grep -q '^---'; then
      echo "VALIDATION WARNING: $FILE_PATH missing YAML frontmatter"
      exit 0
    fi
    # Check required fields
    for field in summary category areas; do
      if ! grep -q "^${field}:" "$FILE_PATH" 2>/dev/null; then
        echo "VALIDATION WARNING: $FILE_PATH missing required field: $field"
      fi
    done
    # Check Areas footer
    if ! grep -q '^Areas:' "$FILE_PATH" 2>/dev/null; then
      echo "VALIDATION WARNING: $FILE_PATH missing Areas footer (topic map membership)"
    fi
    ;;
  knowledge/captures/*.md|*/knowledge/captures/*.md)
    # Validate capture: check for YAML frontmatter
    if ! head -1 "$FILE_PATH" | grep -q '^---'; then
      echo "VALIDATION WARNING: $FILE_PATH missing YAML frontmatter"
    fi
    ;;
  *)
    # Not a vault file, skip
    ;;
esac

exit 0
