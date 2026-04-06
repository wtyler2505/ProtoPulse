#!/bin/bash
# Stop hook: Run full TypeScript check — warns on failure but does NOT block exit
# Changed from blocking (exit 2) to warning (exit 0) because tsc takes 30-44s
# on ProtoPulse and blocking session exit frustrates the user.
# The PostToolUse typecheck-changed hook catches errors incrementally.

cd /home/wtyler/Projects/ProtoPulse

OUTPUT=$(NODE_OPTIONS="--max-old-space-size=4096" timeout 120 npm run check 2>&1)
EXIT_CODE=$?

if [ $EXIT_CODE -ne 0 ]; then
  echo "" >&2
  echo "> npm run check" >&2
  echo "" >&2
  echo "$OUTPUT" >&2
  # Warn but don't block — incremental typecheck-changed catches errors during work
  exit 0
fi

echo "TypeScript check passed." >&2
exit 0
