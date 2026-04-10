#!/usr/bin/env bash
# claude-panic.sh
# The Emergency Kill-Switch for Claude Code and zombie MCP processes.

echo "🚨 INITIATING CLAUDE CODE PANIC PROTOCOL 🚨"

# Kill main claude processes
pkill -f "claude" && echo "✅ Terminated 'claude' processes." || echo "No 'claude' processes running."
pkill -f "claudekit" && echo "✅ Terminated 'claudekit' processes." || echo "No 'claudekit' processes running."

# Attempt to find and kill common MCP server processes that might be orphaned
echo "⚠️ Note: Check for orphaned 'node', 'npx', 'python', or 'uvx' processes that were running as MCP servers."
echo "If your CPU is spiking, run: 'top' or 'htop' to investigate."

echo "✅ Panic protocol complete."
