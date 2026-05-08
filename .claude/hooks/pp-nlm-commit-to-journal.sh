#!/usr/bin/env bash
# PostToolUse on Bash that ran `git commit` — appends commit to today's pp-journal buffer + remote note.
# Local buffer is canonical (nlm note get does NOT exist).
set +e
TODAY=$(date -u +%Y-%m-%d)
BUFFER_DIR="$HOME/.claude/state/pp-nlm/journal-buffers"
BUFFER="$BUFFER_DIR/$TODAY.md"
NOTEMAP="$HOME/.claude/state/pp-nlm/journal-notemap.json"
TITLE="$TODAY — daily commits"
LAST_FIRE_FILE="$HOME/.claude/state/pp-nlm/last-commit-hook-fire"
mkdir -p "$BUFFER_DIR" "$(dirname "$NOTEMAP")"
[ -f "$NOTEMAP" ] || echo "{}" > "$NOTEMAP"

LAST_HASH=$(git rev-parse HEAD 2>/dev/null) || exit 0
if [ -f "$LAST_FIRE_FILE" ]; then
  PREV_HASH=$(cut -d' ' -f1 "$LAST_FIRE_FILE")
  PREV_TIME=$(cut -d' ' -f2 "$LAST_FIRE_FILE")
  NOW=$(date +%s)
  [ "$LAST_HASH" = "$PREV_HASH" ] && [ $((NOW - PREV_TIME)) -lt 5 ] && exit 0
fi
echo "$LAST_HASH $(date +%s)" > "$LAST_FIRE_FILE"

LAST_COMMIT=$(git log -1 --pretty=format:"%s%n%n%b" 2>/dev/null) || exit 0
[ -z "$LAST_COMMIT" ] && exit 0

{
  echo
  echo "---"
  echo "**$(date -u +%H:%M) UTC** — \`$LAST_HASH\`"
  echo "$LAST_COMMIT"
} >> "$BUFFER"

nlm login --check >/dev/null 2>&1 || exit 0

NOTE_ID=$(jq -r --arg d "$TODAY" '.[$d] // empty' "$NOTEMAP")
if [ -z "$NOTE_ID" ]; then
  NOTE_ID=$(timeout 6 nlm note list pp-journal --json 2>/dev/null | jq -r --arg t "$TITLE" '.notes[] | select(.title == $t) | .id' | head -1)
fi

CONTENT=$(cat "$BUFFER")
if [ -n "$NOTE_ID" ]; then
  timeout 6 nlm note update pp-journal "$NOTE_ID" --content "$CONTENT" >/dev/null 2>&1
else
  NEW_ID=$(timeout 6 nlm note create pp-journal "$CONTENT" --title "$TITLE" 2>&1 | grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' | head -1)
  if [ -n "$NEW_ID" ]; then
    jq --arg d "$TODAY" --arg id "$NEW_ID" '. + {($d): $id}' "$NOTEMAP" > "$NOTEMAP.tmp" && mv "$NOTEMAP.tmp" "$NOTEMAP"
  fi
fi

touch "$HOME/.claude/state/pp-nlm/cache-invalidate"
exit 0
