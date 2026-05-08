#!/usr/bin/env bash
# scripts/pp-nlm/lib/source-helpers.sh
# Shared helpers for Phase 2/3 source-population scripts.
# Source this file: `source scripts/pp-nlm/lib/source-helpers.sh`
#
# Contracts:
#   - All helpers are IDEMPOTENT: re-running skips sources whose `(notebook_alias, title)` already in manifest.
#   - Word-count guard: text sources >500K words are SKIPPED and logged to errors.log.
#   - Per-source manifest entry written atomically.
#   - 2s sleep after every successful add per nlm-skill SKILL.md L709-713 rate-limiting table.
#   - Failures logged but do not abort the script — caller can re-run to fill gaps.

set -uo pipefail

PP_NLM_STATE="${PP_NLM_STATE:-$HOME/.claude/state/pp-nlm}"
PP_NLM_LOGS="${PP_NLM_LOGS:-$HOME/.claude/logs}"
PP_NLM_SOURCE_MANIFEST="$PP_NLM_STATE/source-manifest.json"
PP_NLM_ERROR_LOG="$PP_NLM_LOGS/pp-nlm-errors.log"
PP_NLM_RATE_SLEEP="${PP_NLM_RATE_SLEEP:-2}"

mkdir -p "$PP_NLM_STATE" "$PP_NLM_LOGS"
[ -f "$PP_NLM_SOURCE_MANIFEST" ] || echo "{}" > "$PP_NLM_SOURCE_MANIFEST"

# --- Internal: atomic manifest write ---
_pp_manifest_record() {
  local alias="$1" id="$2" title="$3" path_or_url="$4" kind="$5"
  local tmp
  tmp=$(mktemp)
  jq --arg a "$alias" \
     --arg i "$id" \
     --arg t "$title" \
     --arg s "$path_or_url" \
     --arg k "$kind" \
     '.[$a] = ((.[$a] // []) + [{id: $i, title: $t, path_or_url: $s, kind: $k, added: now | todate}])' \
     "$PP_NLM_SOURCE_MANIFEST" > "$tmp" \
     && mv "$tmp" "$PP_NLM_SOURCE_MANIFEST" \
     || rm -f "$tmp"
}

# --- Internal: check if already added ---
_pp_already_added() {
  local alias="$1" title="$2"
  jq -e --arg a "$alias" --arg t "$title" \
    '.[$a] // [] | any(.title == $t)' \
    "$PP_NLM_SOURCE_MANIFEST" >/dev/null 2>&1
}

# --- Public: add a markdown/text file as source ---
# add_source_text <alias> <file-path> [title-override]
add_source_text() {
  local alias="$1" file="$2"
  local title_override="${3:-}"
  local stamp; stamp=$(date -u +%Y-%m-%d)
  local base; base="$(basename "$file" .md)"
  local title="${title_override:-$base v1 — $stamp}"

  if _pp_already_added "$alias" "$title"; then
    echo "  skip: [$alias] $title (already in manifest)"
    return 0
  fi
  if [ ! -f "$file" ]; then
    echo "  FAIL: [$alias] file not found: $file" | tee -a "$PP_NLM_ERROR_LOG"
    return 1
  fi

  local content; content="$(cat "$file")"
  # 500K word cap (Sources §22.1)
  local words; words=$(echo "$content" | wc -w)
  if [ "$words" -gt 500000 ]; then
    echo "  SKIP-OVERSIZE: [$alias] $file = $words words (>500K cap)" | tee -a "$PP_NLM_ERROR_LOG"
    return 0
  fi

  echo "  add: [$alias] $title ($words w)"
  local raw
  raw=$(nlm source add "$alias" --text "$content" --title "$title" --wait 2>&1)
  local rc=$?
  if [ "$rc" -ne 0 ]; then
    echo "  FAIL: [$alias] $title rc=$rc :: $(echo "$raw" | tail -3 | tr '\n' '|')" | tee -a "$PP_NLM_ERROR_LOG"
    return 1
  fi
  local sid
  sid=$(echo "$raw" | grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' | head -1)
  if [ -z "$sid" ]; then
    echo "  WARN: [$alias] $title — no source-id parsed; recording with placeholder" | tee -a "$PP_NLM_ERROR_LOG"
    sid="unknown-$(date +%s)"
  fi
  _pp_manifest_record "$alias" "$sid" "$title" "$file" "text"
  sleep "$PP_NLM_RATE_SLEEP"
}

# --- Public: add a URL as source ---
# add_source_url <alias> <url> [title-override]
add_source_url() {
  local alias="$1" url="$2" title_override="${3:-}"
  local stamp; stamp=$(date -u +%Y-%m-%d)
  local title="${title_override:-$url — $stamp}"

  if _pp_already_added "$alias" "$title"; then
    echo "  skip: [$alias] $title (already in manifest)"
    return 0
  fi

  echo "  add: [$alias] URL $url"
  local raw
  raw=$(nlm source add "$alias" --url "$url" --title "$title" --wait 2>&1)
  local rc=$?
  if [ "$rc" -ne 0 ]; then
    echo "  FAIL: [$alias] url=$url rc=$rc :: $(echo "$raw" | tail -3 | tr '\n' '|')" | tee -a "$PP_NLM_ERROR_LOG"
    return 1
  fi
  local sid
  sid=$(echo "$raw" | grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' | head -1)
  [ -z "$sid" ] && sid="unknown-$(date +%s)"
  _pp_manifest_record "$alias" "$sid" "$title" "$url" "url"
  sleep "$PP_NLM_RATE_SLEEP"
}

# --- Public: add a local file (PDF, etc.) as source ---
# add_source_file <alias> <file-path> [title-override]
add_source_file() {
  local alias="$1" file="$2" title_override="${3:-}"
  local stamp; stamp=$(date -u +%Y-%m-%d)
  local base; base="$(basename "$file")"
  local title="${title_override:-$base v1 — $stamp}"

  if _pp_already_added "$alias" "$title"; then
    echo "  skip: [$alias] $title (already in manifest)"
    return 0
  fi
  if [ ! -f "$file" ]; then
    echo "  FAIL: [$alias] file not found: $file" | tee -a "$PP_NLM_ERROR_LOG"
    return 1
  fi

  echo "  add: [$alias] FILE $file"
  local raw
  raw=$(nlm source add "$alias" --file "$file" --title "$title" --wait 2>&1)
  local rc=$?
  if [ "$rc" -ne 0 ]; then
    echo "  FAIL: [$alias] file=$file rc=$rc :: $(echo "$raw" | tail -3 | tr '\n' '|')" | tee -a "$PP_NLM_ERROR_LOG"
    return 1
  fi
  local sid
  sid=$(echo "$raw" | grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' | head -1)
  [ -z "$sid" ] && sid="unknown-$(date +%s)"
  _pp_manifest_record "$alias" "$sid" "$title" "$file" "file"
  sleep "$PP_NLM_RATE_SLEEP"
}

# --- Public: auth gate ---
pp_require_auth() {
  if ! nlm login --check >/dev/null 2>&1; then
    echo "nlm: not authenticated. Run: nlm login" >&2
    exit 2
  fi
}

# --- Public: count sources for an alias in manifest ---
pp_manifest_count() {
  local alias="$1"
  jq -r --arg a "$alias" '.[$a] // [] | length' "$PP_NLM_SOURCE_MANIFEST"
}
