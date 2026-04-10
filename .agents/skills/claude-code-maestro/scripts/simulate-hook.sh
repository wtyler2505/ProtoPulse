#!/usr/bin/env bash
# simulate-hook.sh: Tests a bash hook script by piping mock JSON to it and validating the output
HOOK_FILE="$1"
if [ -z "$HOOK_FILE" ] || [ ! -f "$HOOK_FILE" ]; then
    echo "Usage: $0 <path-to-hook-script>"
    exit 1
fi

if [ ! -x "$HOOK_FILE" ]; then
    echo "Warning: Hook script is not executable. Making it executable..."
    chmod +x "$HOOK_FILE"
fi

MOCK_PAYLOAD='{"hookEventName":"PreToolUse","tool_name":"Bash","tool_input":{"command":"npm run build"}}'
echo "[*] Simulating hook with payload:"
echo "$MOCK_PAYLOAD" | jq .

echo -e "\n[*] Hook Raw Output:"
OUTPUT=$(echo "$MOCK_PAYLOAD" | "$HOOK_FILE")
echo "$OUTPUT"

echo -e "\n[*] Validation:"
if echo "$OUTPUT" | jq . >/dev/null 2>&1; then
    echo "✅ SUCCESS: Hook outputs valid JSON!"
else
    echo "❌ ERROR: Hook output is INVALID JSON. Claude Code will crash if it receives this."
fi
