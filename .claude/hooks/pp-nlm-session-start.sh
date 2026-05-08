#!/usr/bin/env bash
# .claude/hooks/pp-nlm-session-start.sh — SessionStart context inject (cache 4h, parallel fetch).
set +e
CACHE_DIR="$HOME/.claude/state/pp-nlm"
CACHE_FILE="$CACHE_DIR/session-context-cache.md"
INVALIDATE_FILE="$CACHE_DIR/cache-invalidate"
TIMEOUT=6
MAX_AGE_SEC=$((4 * 60 * 60))
mkdir -p "$CACHE_DIR"

if [ -f "$CACHE_FILE" ]; then
  AGE=$(( $(date +%s) - $(stat -c %Y "$CACHE_FILE" 2>/dev/null || echo 0) ))
  INVALIDATED=0
  [ -f "$INVALIDATE_FILE" ] && [ "$INVALIDATE_FILE" -nt "$CACHE_FILE" ] && INVALIDATED=1
  if [ "$AGE" -lt "$MAX_AGE_SEC" ] && [ "$INVALIDATED" -eq 0 ]; then
    cat "$CACHE_FILE"; exit 0
  fi
fi

nlm login --check >/dev/null 2>&1 || { echo "<!-- pp-nlm: not authenticated, skipping -->"; exit 0; }

TMPDIR=$(mktemp -d)
( timeout $TIMEOUT nlm note list pp-memories --json 2>/dev/null | jq -r '.notes[:5][] | "- \(.title)"' > "$TMPDIR/mem" ) &
( timeout $TIMEOUT nlm note list pp-backlog  --json 2>/dev/null | jq -r '.notes[:3][] | "- \(.title)"' > "$TMPDIR/iter" ) &
( timeout $TIMEOUT nlm note list pp-journal  --json 2>/dev/null | jq -r '.notes[:3][] | "- \(.title)"' > "$TMPDIR/journal" ) &
wait

PENDING=""
[ -f "$CACHE_DIR/pending-recap.md" ] && PENDING="**⚠️ Pending session recap** at \`~/.claude/state/pp-nlm/pending-recap.md\` — run \`/pp-recap apply\` to push or \`/pp-recap discard\` to drop."

cat > "$CACHE_FILE" <<EOF
## ProtoPulse NLM context (auto-injected)
**Recent Memories:**
$(cat "$TMPDIR/mem" 2>/dev/null || echo "(none)")

**Recent BL/iteration decisions:**
$(cat "$TMPDIR/iter" 2>/dev/null || echo "(none)")

**Recent Journal entries:**
$(cat "$TMPDIR/journal" 2>/dev/null || echo "(none)")

$PENDING

Use \`nlm cross query --tags pp:active\` or invoke the \`pp-knowledge\` skill to dig deeper.
EOF
rm -rf "$TMPDIR"
cat "$CACHE_FILE"
exit 0
