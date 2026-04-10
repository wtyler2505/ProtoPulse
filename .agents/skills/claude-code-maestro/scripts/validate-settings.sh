#!/usr/bin/env bash
# Quick script to validate settings.json syntax

SETTINGS_FILE=".claude/settings.json"

if [ ! -f "$SETTINGS_FILE" ]; then
    echo "Error: $SETTINGS_FILE not found."
    exit 1
fi

if jq -e . >/dev/null 2>&1 <<< "$(cat $SETTINGS_FILE)"; then
    echo "Success: $SETTINGS_FILE is valid JSON."
    exit 0
else
    echo "Error: $SETTINGS_FILE contains invalid JSON syntax."
    jq . "$SETTINGS_FILE" # This will print the specific error
    exit 1
fi
