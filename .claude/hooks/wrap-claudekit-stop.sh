#!/usr/bin/env bash
# wrap-claudekit-stop.sh — Wrapper for claudekit Stop hooks
# Ensures valid JSON on stdout even when claudekit outputs nothing.
# Usage: bash wrap-claudekit-stop.sh <claudekit-command>
# Example: bash wrap-claudekit-stop.sh lint-project

CMD="${1:-}"
[ -z "$CMD" ] && { echo '{}'; exit 0; }

# Run the claudekit command, capture output
OUTPUT=$(claudekit-hooks run "$CMD" 2>/dev/null) || true
BYTES=$(echo -n "$OUTPUT" | wc -c)

if [ "$BYTES" -gt 0 ]; then
  # Check if it's already valid JSON
  echo "$OUTPUT" | python3 -c "import sys,json; json.load(sys.stdin)" 2>/dev/null
  if [ $? -eq 0 ]; then
    echo "$OUTPUT"
  else
    # Wrap non-JSON output in a systemMessage
    SAFE=$(echo "$OUTPUT" | head -5 | tr '\n' ' ' | sed 's/"/\\"/g' | head -c 200)
    printf '{"systemMessage": "claudekit %s: %s"}' "$CMD" "$SAFE"
  fi
else
  echo '{}'
fi
exit 0
