#!/usr/bin/env bash
# schema-change-verifier.sh — PostToolUse hook for schema.ts changes
# When shared/schema.ts is modified, warn about downstream impact.
# This is the "type: command" version — a "type: agent" hook would be
# even better but command hooks are more reliable.

set -euo pipefail

FILE_PATH="${CLAUDE_TOOL_INPUT_FILE_PATH:-}"
[ -z "$FILE_PATH" ] && { echo "{}"; exit 0; }

# Only trigger on schema changes
case "$FILE_PATH" in
  *shared/schema.ts|*shared/schema.ts)
    echo '{"systemMessage": "SCHEMA CHANGED: shared/schema.ts was modified. Verify: (1) storage.ts methods match new columns, (2) route handlers use correct field names, (3) Zod insert schemas are regenerated, (4) client types are updated. Run: npm run check"}'
    ;;
  *server/storage*.ts)
    echo '{"systemMessage": "STORAGE CHANGED: Verify route handlers still match the storage interface. Run: npm run check"}'
    ;;
esac

exit 0
