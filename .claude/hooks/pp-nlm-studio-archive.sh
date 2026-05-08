#!/usr/bin/env bash
# Archive a single Studio artifact, or sweep all if no args.
# Idempotent via docs/nlm-archive/manifest.json.
set -e
ROOT="/home/wtyler/Projects/ProtoPulse"
ARCHIVE="$ROOT/docs/nlm-archive"
MANIFEST="$ARCHIVE/manifest.json"
LOG="$HOME/.claude/logs/pp-nlm-archive.log"
mkdir -p "$ARCHIVE" "$(dirname "$LOG")"
[ -f "$MANIFEST" ] || echo "{}" > "$MANIFEST"

download_one() {
  local alias="$1" aid="$2"
  if jq -e --arg id "$aid" '.[$id]' "$MANIFEST" >/dev/null 2>&1; then return 0; fi
  local meta type title status
  meta=$(nlm studio status "$alias" --json 2>/dev/null | jq --arg id "$aid" '.artifacts[] | select(.id == $id)')
  [ -z "$meta" ] && return 1
  type=$(echo "$meta" | jq -r '.type')
  title=$(echo "$meta" | jq -r '.title // .id' | tr ' /' '_-')
  status=$(echo "$meta" | jq -r '.status')
  [ "$status" != "completed" ] && return 0
  mkdir -p "$ARCHIVE/$alias"
  local out="$ARCHIVE/$alias/$(date -u +%Y-%m-%d)-$title-$aid"
  case "$type" in
    audio)         nlm download audio      "$alias" --output "$out.mp3" 2>&1 | tee -a "$LOG" ;;
    video)         nlm download video      "$alias" --output "$out.mp4" 2>&1 | tee -a "$LOG" ;;
    report)        nlm download report     "$alias" --output "$out.md"  2>&1 | tee -a "$LOG" ;;
    slide_deck)    nlm download slide-deck "$alias" --output "$out.pdf" 2>&1 | tee -a "$LOG"
                   nlm download slide-deck "$alias" --output "$out.pptx" --format pptx 2>&1 | tee -a "$LOG" ;;
    quiz|flashcards|data_table|infographic|mind_map)
                   nlm download "$type"    "$alias" --output "$out.json" --format json 2>&1 | tee -a "$LOG" ;;
    *)             echo "Unknown artifact type: $type" >> "$LOG"; return 1 ;;
  esac
  jq --arg id "$aid" --arg type "$type" --arg title "$title" --arg alias "$alias" --arg path "$out" \
    '. + {($id): {type: $type, title: $title, alias: $alias, path: $path, archived: now | todate}}' \
    "$MANIFEST" > "$MANIFEST.tmp" && mv "$MANIFEST.tmp" "$MANIFEST"
}

if [ -n "${1:-}" ] && [ -n "${2:-}" ]; then
  download_one "$1" "$2"
else
  for alias in $(nlm alias list --quiet 2>/dev/null); do
    [[ "$alias" == pp-* ]] || continue
    nlm studio status "$alias" --json 2>/dev/null | jq -r '.artifacts[] | select(.status == "completed") | .id' | while read -r aid; do
      download_one "$alias" "$aid"
    done
  done
fi
