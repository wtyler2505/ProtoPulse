#!/usr/bin/env bash
# ping-mcp.sh: Tests if a local MCP server command is executable and responds to stdio
COMMAND="$@"
if [ -z "$COMMAND" ]; then
    echo "Usage: $0 <mcp-command> [args...]"
    exit 1
fi
echo "[*] Testing MCP Server Command: $COMMAND"
# Stdio servers block waiting for input. If it exits immediately, it crashed.
# We run it with a 2-second timeout.
timeout 2s bash -c "$COMMAND" < /dev/null > /dev/null 2>&1
EXIT_CODE=$?

if [ $EXIT_CODE -eq 124 ]; then
    echo "✅ SUCCESS: The MCP server stayed alive listening to stdio. The path and command appear valid."
    exit 0
else
    echo "❌ ERROR: The MCP server process exited immediately (Code $EXIT_CODE). It may be missing dependencies, using the wrong path, or throwing a syntax error."
    echo "Try running it manually to see the error output: $COMMAND"
    exit 1
fi
