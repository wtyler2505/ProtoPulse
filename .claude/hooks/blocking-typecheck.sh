#!/bin/bash
# Stop hook: Run full TypeScript check and block on failure
# Exit 0 = allow stop, non-zero = block stop with errors

cd /home/wtyler/Projects/ProtoPulse

OUTPUT=$(npm run check 2>&1)
EXIT_CODE=$?

if [ $EXIT_CODE -ne 0 ]; then
  echo "BLOCKED: TypeScript check failed. Fix errors before stopping." >&2
  echo "$OUTPUT" >&2
  exit 2
fi

echo "TypeScript check passed." >&2
exit 0
