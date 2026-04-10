#!/usr/bin/env bash
# log-action.sh
# Logs changes made by the Claude Code Maestro to a central changelog.

CHANGELOG_FILE=".agents/skills/claude-code-maestro/data/CHANGELOG.md"
ACTION="$1"
DETAILS="$2"

if [ -z "$ACTION" ]; then
    echo "Usage: $0 \"Action Title\" \"Details (optional)\""
    exit 1
fi

mkdir -p "$(dirname "$CHANGELOG_FILE")"

if [ ! -f "$CHANGELOG_FILE" ]; then
    echo "# Claude Code Maestro - Configuration Changelog" > "$CHANGELOG_FILE"
    echo "Tracks all autonomous changes made to the Claude Code ecosystem." >> "$CHANGELOG_FILE"
    echo "" >> "$CHANGELOG_FILE"
fi

TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")
echo "## [$TIMESTAMP] $ACTION" >> "$CHANGELOG_FILE"

if [ -n "$DETAILS" ]; then
    echo "$DETAILS" >> "$CHANGELOG_FILE"
fi
echo "" >> "$CHANGELOG_FILE"

echo "Action logged to $CHANGELOG_FILE successfully."
