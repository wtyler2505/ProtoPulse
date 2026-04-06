#!/bin/bash
# Stop hook: Run full TypeScript check — warns on failure but does NOT block exit
# Changed from blocking (exit 2) to warning (exit 0) because tsc takes 30-44s
# on ProtoPulse and blocking session exit frustrates the user.
# The PostToolUse typecheck-changed hook catches errors incrementally.

cd /home/wtyler/Projects/ProtoPulse

OUTPUT=$(NODE_OPTIONS="--max-old-space-size=4096" timeout 120 npm run check 2>&1)
EXIT_CODE=$?

if [ $EXIT_CODE -ne 0 ]; then
  # Output valid JSON for Claude Code hook parser
  ERROR_LINES=$(echo "$OUTPUT" | grep "error TS" | head -5 | tr '\n' ' | ' | sed 's/"/\\"/g')
  echo "{\"decision\": \"approve\", \"reason\": \"TypeScript errors found (non-blocking): ${ERROR_LINES}\"}"
  exit 0
fi

echo '{"decision": "approve", "reason": "TypeScript check passed."}'
exit 0
