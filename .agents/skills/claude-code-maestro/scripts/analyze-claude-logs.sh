#!/usr/bin/env bash
# analyze-claude-logs.sh
# Tails the most recent claude cache/logs to diagnose crashes or issues.
LOG_FILE=".claude/stats-cache.json"

if [ ! -f "$LOG_FILE" ]; then
    echo "No .claude/stats-cache.json found in the local directory."
    echo "Tip: Make sure you are in the project root and have run Claude Code."
    exit 0
fi

echo "=== Recent Claude Logs & Errors ==="
echo "Displaying the last 20 events from the local stats cache:"
echo "--------------------------------------------------------"

# Try to parse as JSON stream, otherwise just tail raw text
tail -n 20 "$LOG_FILE" | jq . 2>/dev/null || tail -n 20 "$LOG_FILE"

echo "--------------------------------------------------------"
echo "Log Autopsy Complete."
