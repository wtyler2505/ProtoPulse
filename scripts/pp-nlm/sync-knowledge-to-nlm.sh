#!/usr/bin/env bash
# scripts/pp-nlm/sync-knowledge-to-nlm.sh
# Phase 10 bidirectional bridge — return leg (knowledge/ → republished NLM source).
#
# Watches knowledge/ for newly-created or recently-modified notes (since last sync
# tracked in ops/index/nlm-index.json's `last_sync` field) and republishes each as
# a versioned source on the appropriate Tier-1 notebook.
#
# Routing rules (frontmatter-driven):
#   topics contains "hardware" or filename matches *-(capacitor|resistor|esp32|atmega|74hc|mosfet|bjt|stepper|pwm|brownout|datasheet|pinout)*  → pp-hardware
#   topics contains "methodology" or "ars-contexta" → pp-arscontexta
#   topics contains "breadboard" or "drc" or "exact-part" → pp-breadboard
#   topics contains "codebase" or "architecture" or "plan" → pp-codebase
#   provenance.source == "experiment" → also pp-bench
#   provenance.source == "nlm-studio" → SKIP (already lives in NLM by definition; loop guard)
#   default fallback → pp-hardware (most permissive Tier-1 for technical claims)
#
# Versioning convention: source title = "<slug> v<N> — <YYYY-MM-DD>"
# Idempotent: skips notes already present in source-manifest.json under the routed alias.

set -uo pipefail

ROOT="/home/wtyler/Projects/ProtoPulse"
KNOWLEDGE="$ROOT/knowledge"
NLM_INDEX="$ROOT/ops/index/nlm-index.json"
SOURCE_MANIFEST="$HOME/.claude/state/pp-nlm/source-manifest.json"
LOG="$HOME/.claude/logs/pp-nlm-sync-knowledge.log"
mkdir -p "$(dirname "$NLM_INDEX")" "$(dirname "$LOG")"
[ -f "$NLM_INDEX" ] || echo "{}" > "$NLM_INDEX"
[ -f "$SOURCE_MANIFEST" ] || echo "{}" > "$SOURCE_MANIFEST"

# Auth gate
if ! nlm login --check >/dev/null 2>&1; then
  echo "$(date -u --iso-8601=seconds) FAIL: not authenticated" | tee -a "$LOG" >&2
  exit 2
fi

# Read last_sync (or seed at epoch on first run)
LAST_SYNC=$(jq -r '.last_sync // "1970-01-01T00:00:00Z"' "$NLM_INDEX")
NOW=$(date -u --iso-8601=seconds)
LAST_SYNC_EPOCH=$(date -u -d "$LAST_SYNC" +%s 2>/dev/null || echo 0)

extract_field() {
  # Extract a YAML frontmatter field from a markdown file.
  # Usage: extract_field <file> <field>
  awk -v field="$2" '
    /^---$/ { n++; next }
    n == 1 {
      if ($1 == field":") {
        # Inline value
        sub("^"field": *", "")
        gsub("^[\"']\''| *$", "")
        print
        exit
      }
    }
  ' "$1"
}

extract_topics() {
  # Extract topics array entries (YAML list form).
  awk '
    /^---$/ { n++; next }
    n == 1 && /^topics:/ { in_topics = 1; next }
    n == 1 && in_topics && /^  - / { sub("^  - ", ""); print }
    n == 1 && in_topics && !/^ / { in_topics = 0 }
  ' "$1"
}

extract_provenance_source() {
  awk '
    /^---$/ { n++; next }
    n == 1 && /^provenance:/ { in_prov = 1; next }
    n == 1 && in_prov && /^  source:/ { sub("^  source: *", ""); gsub("^[\"']\''| *$", ""); print; exit }
    n == 1 && in_prov && !/^ / { in_prov = 0 }
  ' "$1"
}

route_alias() {
  # Returns the alias (or empty) for a knowledge note based on frontmatter.
  local file="$1"
  local fname; fname=$(basename "$file")
  local topics; topics=$(extract_topics "$file" | tr '\n' ' ')
  local prov; prov=$(extract_provenance_source "$file")

  # Loop guard: nlm-studio sources don't get republished
  if [ "$prov" = "nlm-studio" ]; then
    echo ""
    return
  fi

  # Topic-based routing
  case " $topics " in
    *" methodology "*|*" ars-contexta "*) echo "pp-arscontexta"; return ;;
    *" breadboard "*|*" drc "*|*" exact-part "*) echo "pp-breadboard"; return ;;
    *" codebase "*|*" architecture "*|*" plan "*) echo "pp-codebase"; return ;;
    *" hardware "*|*" electronics "*|*" component "*) echo "pp-hardware"; return ;;
  esac

  # Filename pattern fallback for hardware
  if [[ "$fname" =~ (capacitor|resistor|esp32|atmega|74hc|mosfet|bjt|stepper|pwm|brownout|datasheet|pinout|7-segment|1088as|28byj|level-shift|decoupling|gpio) ]]; then
    echo "pp-hardware"
    return
  fi

  # Default
  echo "pp-hardware"
}

count_added=0
count_skipped=0
count_failed=0

for note in "$KNOWLEDGE"/*.md; do
  [ -f "$note" ] || continue

  # Modification time check
  mtime=$(stat -c %Y "$note" 2>/dev/null || echo 0)
  [ "$mtime" -le "$LAST_SYNC_EPOCH" ] && continue

  alias=$(route_alias "$note")
  [ -z "$alias" ] && { count_skipped=$((count_skipped + 1)); continue; }

  slug=$(basename "$note" .md)
  date_today=$(date -u +%Y-%m-%d)

  # Determine version number — count existing manifest entries for this slug + alias
  existing_count=$(jq -r --arg a "$alias" --arg s "$slug" '
    .[$a] // [] | map(select(.title | startswith($s + " v"))) | length
  ' "$SOURCE_MANIFEST" 2>/dev/null || echo 0)
  v=$((existing_count + 1))
  title="${slug} v${v} — ${date_today}"

  # Idempotency check — exact title already in manifest?
  if jq -e --arg a "$alias" --arg t "$title" '.[$a] // [] | any(.title == $t)' "$SOURCE_MANIFEST" >/dev/null 2>&1; then
    count_skipped=$((count_skipped + 1))
    continue
  fi

  # Word-count guard
  words=$(wc -w < "$note")
  if [ "$words" -gt 500000 ]; then
    echo "$(date -u --iso-8601=seconds) SKIP-OVERSIZE [$alias] $note ($words words >500K)" | tee -a "$LOG" >&2
    count_skipped=$((count_skipped + 1))
    continue
  fi

  echo "$(date -u --iso-8601=seconds) add [$alias] $title ($words w)" | tee -a "$LOG"
  content="$(cat "$note")"
  raw=$(nlm source add "$alias" --text "$content" --title "$title" --wait 2>&1)
  rc=$?
  if [ "$rc" -ne 0 ]; then
    echo "$(date -u --iso-8601=seconds) FAIL [$alias] rc=$rc $title :: $(echo "$raw" | tail -2 | tr '\n' '|')" | tee -a "$LOG" >&2
    count_failed=$((count_failed + 1))
    continue
  fi

  # Capture source_id
  sid=$(echo "$raw" | grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' | head -1)
  [ -z "$sid" ] && sid="unknown-$(date +%s)"

  # Update source-manifest
  tmp=$(mktemp)
  jq --arg a "$alias" --arg i "$sid" --arg t "$title" --arg p "$note" \
    '.[$a] = ((.[$a] // []) + [{id: $i, title: $t, path_or_url: $p, kind: "knowledge-republish", added: now | todate}])' \
    "$SOURCE_MANIFEST" > "$tmp" && mv "$tmp" "$SOURCE_MANIFEST"

  # If this knowledge note was extracted FROM an nlm-studio artifact, update nlm-index
  artifact_id_in_note=$(awk '
    /^---$/ { n++; next }
    n == 1 && /^  artifact_id:/ { sub("^  artifact_id: *", ""); print; exit }
  ' "$note" 2>/dev/null)
  if [ -n "$artifact_id_in_note" ]; then
    tmp=$(mktemp)
    jq --arg id "$artifact_id_in_note" --arg kp "$note" --arg sid "$sid" --arg alias "$alias" \
      '.[$id] = {knowledge_path: $kp, republished_source_id: $sid, republished_alias: $alias, last_updated: now | todate}' \
      "$NLM_INDEX" > "$tmp" && mv "$tmp" "$NLM_INDEX"
  fi

  count_added=$((count_added + 1))
  sleep 2
done

# Update last_sync
tmp=$(mktemp)
jq --arg ts "$NOW" '. + {last_sync: $ts}' "$NLM_INDEX" > "$tmp" && mv "$tmp" "$NLM_INDEX"

echo "$(date -u --iso-8601=seconds) sync done: added=$count_added skipped=$count_skipped failed=$count_failed" | tee -a "$LOG"
