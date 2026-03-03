#!/bin/bash
# PreToolUse hook: Block edits to protected files
# Exit 2 = block, Exit 0 = allow

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.file_path // empty')

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# Get just the filename for pattern matching
BASENAME=$(basename "$FILE_PATH")

# Protected file patterns
case "$BASENAME" in
  package-lock.json)
    echo "BLOCKED: package-lock.json is auto-generated. Use npm install to modify it." >&2
    exit 2
    ;;
  replit.md|replit.nix)
    echo "BLOCKED: $BASENAME is a Replit configuration file and should not be edited." >&2
    exit 2
    ;;
  .env|.env.*)
    echo "BLOCKED: $BASENAME contains secrets. Use Desktop Commander or edit manually." >&2
    exit 2
    ;;
esac

# Also check if the filename starts with .env (handles .env.local, .env.production, etc.)
if [[ "$BASENAME" == .env* ]]; then
  echo "BLOCKED: $BASENAME contains secrets. Use Desktop Commander or edit manually." >&2
  exit 2
fi

exit 0
