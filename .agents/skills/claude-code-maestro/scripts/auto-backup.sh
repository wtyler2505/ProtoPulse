#!/usr/bin/env bash
# auto-backup.sh: Safely backs up Claude configurations before modifications
CLAUDE_DIR=".claude"
BACKUP_DIR="$CLAUDE_DIR/.backup"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

mkdir -p "$BACKUP_DIR"
if [ -f "$CLAUDE_DIR/settings.json" ]; then
    cp "$CLAUDE_DIR/settings.json" "$BACKUP_DIR/settings_${TIMESTAMP}.json"
    echo "Backed up settings.json to $BACKUP_DIR/settings_${TIMESTAMP}.json"
else
    echo "No settings.json found to back up."
fi
