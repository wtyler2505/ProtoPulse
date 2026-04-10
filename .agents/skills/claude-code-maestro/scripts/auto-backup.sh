#!/usr/bin/env bash
# auto-backup.sh: Safely backs up the ENTIRE Claude configuration directory before modifications
CLAUDE_DIR=".claude"
BACKUP_DIR=".claude_backups" # Kept outside .claude to prevent recursive backup bloat
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

if [ ! -d "$CLAUDE_DIR" ]; then
    echo "No .claude directory found to back up."
    exit 0
fi

mkdir -p "$BACKUP_DIR"
BACKUP_FILE="$BACKUP_DIR/claude_backup_${TIMESTAMP}.tar.gz"

# Create a compressed tarball of the .claude directory, excluding caches
tar --exclude="$CLAUDE_DIR/stats-cache.json" -czf "$BACKUP_FILE" "$CLAUDE_DIR" 2>/dev/null

if [ $? -eq 0 ]; then
    echo "✅ Full snapshot backup of .claude created at $BACKUP_FILE"
else
    echo "❌ Failed to create backup."
    exit 1
fi
