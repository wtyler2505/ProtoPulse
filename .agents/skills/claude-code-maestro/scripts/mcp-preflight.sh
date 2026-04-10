#!/usr/bin/env bash
# mcp-preflight.sh
# Parses settings.json to extract MCP server commands and verifies they exist in the system $PATH.

SETTINGS_FILE=".claude/settings.json"
echo "=== MCP Pre-Flight Check ==="

if [ ! -f "$SETTINGS_FILE" ]; then
    echo "No settings.json found. Skipping."
    exit 0
fi

# Extract all MCP commands
commands=$(jq -r '.mcpServers[]?.command // empty' "$SETTINGS_FILE" 2>/dev/null)

if [ -z "$commands" ]; then
    echo "No MCP servers configured."
    exit 0
fi

has_errors=0
while read -r cmd; do
    if [ -n "$cmd" ]; then
        if ! command -v "$cmd" &> /dev/null; then
            echo "❌ ERROR: MCP command '$cmd' is NOT found in your \$PATH!"
            has_errors=1
        else
            echo "✅ Command '$cmd' is available."
        fi
    fi
done <<< "$commands"

if [ $has_errors -eq 1 ]; then
    echo "⚠️ WARNING: Some MCP servers will fail to start because their base command is missing from your system."
else
    echo "✅ All MCP base commands are resolved."
fi
