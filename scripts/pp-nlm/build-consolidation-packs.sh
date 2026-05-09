#!/usr/bin/env bash
# Build dense source packs from retired ProtoPulse NotebookLM notebooks.
#
# Default: build packs only. Pass --add to add built packs to pp-core/pp-hardware
# through the lock-protected write helper.

set -uo pipefail

ROOT="$(git rev-parse --show-toplevel)"
PLAN="$ROOT/data/pp-nlm/consolidation/retired-notebooks.json"
OUT_DIR="$ROOT/data/pp-nlm/consolidation/packs"
CACHE_DIR="${PP_NLM_PACK_CACHE:-$HOME/.cache/pp-nlm/source-content}"
MANIFEST="$ROOT/data/pp-nlm/consolidation/manifest.json"
LOG="$HOME/.claude/logs/pp-nlm-pack-migration.log"
LEGACY_LOG="${PP_NLM_LEGACY_MIGRATION_LOG:-/tmp/protopulse-nlm-consolidation/migration-log.jsonl}"
LEGACY_CACHE_DIR="${PP_NLM_LEGACY_CONTENT_CACHE:-/tmp/protopulse-nlm-packs/content-cache}"
LEGACY_SOURCE_CACHE_DIR="${PP_NLM_LEGACY_SOURCE_CACHE:-/tmp/protopulse-nlm-consolidation/source-cache}"

LIST_TIMEOUT="${PP_NLM_PACK_LIST_TIMEOUT:-90s}"
CONTENT_TIMEOUT="${PP_NLM_PACK_CONTENT_TIMEOUT:-120s}"
ADD=0
ONLY=""
LIMIT=""

source "$ROOT/scripts/pp-nlm/lib/write-helpers.sh"

usage() {
  cat <<'USAGE'
Usage: build-consolidation-packs.sh [--only ALIAS] [--limit N] [--add]

Builds source packs from data/pp-nlm/consolidation/retired-notebooks.json.
Default mode writes pack files and manifest only. --add uploads each pack to
its target hub via the safe NotebookLM write helper.
USAGE
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --add) ADD=1; shift ;;
    --only) ONLY="${2:-}"; shift 2 ;;
    --limit) LIMIT="${2:-}"; shift 2 ;;
    --help|-h) usage; exit 0 ;;
    *) usage >&2; exit 2 ;;
  esac
done

mkdir -p "$OUT_DIR" "$CACHE_DIR" "$(dirname "$MANIFEST")" "$(dirname "$LOG")"
[ -f "$MANIFEST" ] || echo "{}" > "$MANIFEST"

slugify() {
  printf '%s' "$1" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+|-+$//g'
}

json_field() {
  local expr="$1"
  jq -r "$expr"
}

list_sources_json() {
  local notebook_id="$1"
  local live legacy

  if live="$(timeout "$LIST_TIMEOUT" nlm source list "$notebook_id" --json 2>/dev/null)"; then
    printf '%s\n' "$live"
    return 0
  fi

  if [ -s "$LEGACY_LOG" ]; then
    legacy="$(
      jq -s -c --arg notebook_id "$notebook_id" '
        [
          .[]
          | select((.event // "") == "would_add" and .source_notebook == $notebook_id)
          | {id: .source_id, title: .title, inventory_source: "legacy-migration-log"}
        ]
      ' "$LEGACY_LOG"
    )"
    if [ "$(printf '%s\n' "$legacy" | jq 'length')" -gt 0 ]; then
      printf '%s\n' "$legacy"
      return 0
    fi
  fi

  echo "live source list failed and no legacy inventory exists for $notebook_id" >&2
  return 1
}

source_id_from_row() {
  jq -r '.id // .source_id // .sourceId // empty'
}

source_title_from_row() {
  jq -r '.title // .name // .displayName // .display_name // "Untitled source"'
}

fetch_source_content() {
  local source_id="$1" output="$2"
  local legacy_match
  if [ -s "$output" ]; then
    return 0
  fi
  if [ -s "$LEGACY_CACHE_DIR/$source_id.txt" ]; then
    cp "$LEGACY_CACHE_DIR/$source_id.txt" "$output"
    return 0
  fi
  legacy_match="$(find "$LEGACY_SOURCE_CACHE_DIR" -maxdepth 1 -type f -name "$source_id*.txt" -print -quit 2>/dev/null || true)"
  if [ -n "$legacy_match" ] && [ -s "$legacy_match" ]; then
    cp "$legacy_match" "$output"
    return 0
  fi
  timeout "$CONTENT_TIMEOUT" nlm source content "$source_id" --output "$output" >/dev/null
}

write_manifest_entry() {
  local alias="$1" notebook_id="$2" title="$3" target="$4" pack="$5" count="$6" status="$7" error="${8:-}"
  local tmp hash
  hash="$(sha256sum "$pack" 2>/dev/null | awk '{print $1}')"
  tmp="$(mktemp)"
  jq \
    --arg alias "$alias" \
    --arg notebook_id "$notebook_id" \
    --arg title "$title" \
    --arg target "$target" \
    --arg pack "$pack" \
    --arg hash "$hash" \
    --argjson count "$count" \
    --arg status "$status" \
    --arg error "$error" '
      .[$alias] = {
        retired_alias: $alias,
        retired_notebook_id: $notebook_id,
        retired_title: $title,
        target_alias: $target,
        pack_path: $pack,
        pack_sha256: $hash,
        source_count: $count,
        status: $status,
        error: (if $error == "" then null else $error end),
        updated: (now | todate)
      }
    ' "$MANIFEST" > "$tmp" && mv "$tmp" "$MANIFEST"
}

process_notebook() {
  local item="$1"
  local alias notebook_id title target slug pack source_json count idx rows
  alias="$(printf '%s' "$item" | json_field '.alias')"
  notebook_id="$(printf '%s' "$item" | json_field '.notebook_id')"
  title="$(printf '%s' "$item" | json_field '.title')"
  target="$(printf '%s' "$item" | json_field '.target_alias')"

  if [ -n "$ONLY" ] && [ "$alias" != "$ONLY" ]; then
    return 0
  fi

  slug="$(slugify "$alias")"
  pack="$OUT_DIR/${slug}.txt"

  echo "$(date -u --iso-8601=seconds) build: $alias -> $target" | tee -a "$LOG"
  if ! source_json="$(list_sources_json "$notebook_id" 2>&1)"; then
    echo "$(date -u --iso-8601=seconds) FAIL list: $alias :: $source_json" | tee -a "$LOG" >&2
    : > "$pack"
    write_manifest_entry "$alias" "$notebook_id" "$title" "$target" "$pack" 0 "list_failed" "$source_json"
    return 1
  fi

  count="$(printf '%s\n' "$source_json" | jq 'length' 2>/dev/null || echo 0)"
  if [ -n "$LIMIT" ] && [ "$count" -gt "$LIMIT" ]; then
    count="$LIMIT"
  fi

  {
    echo "# ProtoPulse Consolidated Source Pack :: $title"
    echo
    echo "Generated: $(date -u --iso-8601=seconds)"
    echo "Retired alias: $alias"
    echo "Retired notebook ID: $notebook_id"
    echo "Target hub: $target"
    echo "Source count included: $count"
    echo
    echo "## Source Index"
  } > "$pack"

  rows="$(printf '%s\n' "$source_json" | jq -c '.[]?')"
  idx=0
  while IFS= read -r row; do
    [ -n "$row" ] || continue
    if [ -n "$LIMIT" ] && [ "$idx" -ge "$LIMIT" ]; then
      break
    fi
    idx=$((idx + 1))
    sid="$(printf '%s\n' "$row" | source_id_from_row)"
    stitle="$(printf '%s\n' "$row" | source_title_from_row)"
    [ -n "$sid" ] || continue
    echo "$idx. $stitle [$sid]" >> "$pack"
  done <<< "$rows"

  echo >> "$pack"
  echo "---" >> "$pack"

  idx=0
  while IFS= read -r row; do
    [ -n "$row" ] || continue
    if [ -n "$LIMIT" ] && [ "$idx" -ge "$LIMIT" ]; then
      break
    fi
    idx=$((idx + 1))
    sid="$(printf '%s\n' "$row" | source_id_from_row)"
    stitle="$(printf '%s\n' "$row" | source_title_from_row)"
    [ -n "$sid" ] || continue
    cache="$CACHE_DIR/$sid.txt"
    if ! fetch_source_content "$sid" "$cache" 2>>"$LOG"; then
      echo "$(date -u --iso-8601=seconds) WARN content failed: $alias $sid" | tee -a "$LOG" >&2
      continue
    fi
    shash="$(sha256sum "$cache" | awk '{print $1}')"
    {
      echo
      echo "## Source $idx: $stitle"
      echo
      echo "Original notebook alias: $alias"
      echo "Original notebook ID: $notebook_id"
      echo "Original source ID: $sid"
      echo "Original source title: $stitle"
      echo "Content SHA256: $shash"
      echo
      echo "BEGIN SOURCE CONTENT"
      cat "$cache"
      echo
      echo "END SOURCE CONTENT"
    } >> "$pack"
  done <<< "$rows"

  write_manifest_entry "$alias" "$notebook_id" "$title" "$target" "$pack" "$idx" "built"

  if [ "$ADD" -eq 1 ]; then
    pack_title="ProtoPulse Consolidated Source Pack :: $title"
    pp_nlm_source_add_file "$target" "$pack" "$pack_title" "consolidation-pack" "$notebook_id"
  fi
}

export -f slugify

mapfile -t items < <(jq -c '.[]' "$PLAN")
for item in "${items[@]}"; do
  process_notebook "$item"
done

echo "Manifest: $MANIFEST"
echo "Packs: $OUT_DIR"
