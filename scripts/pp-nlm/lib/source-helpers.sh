#!/usr/bin/env bash
# scripts/pp-nlm/lib/source-helpers.sh
# Shared helpers for source-population scripts.
# Source this file: `source scripts/pp-nlm/lib/source-helpers.sh`
#
# Contracts:
#   - All helpers are IDEMPOTENT: re-running skips sources whose title/hash already appear in manifest.
#   - Word-count guard: text sources >500K words are SKIPPED and logged to errors.log.
#   - Per-source manifest entry written through write-helpers.sh.
#   - Writes are serialized through a single NotebookLM lock.
#   - Failures logged but do not abort the script — caller can re-run to fill gaps.

set -uo pipefail

PP_NLM_STATE="${PP_NLM_STATE:-$HOME/.claude/state/pp-nlm}"
PP_NLM_LOGS="${PP_NLM_LOGS:-$HOME/.claude/logs}"
PP_NLM_SOURCE_MANIFEST="$PP_NLM_STATE/source-manifest.json"
PP_NLM_ERROR_LOG="$PP_NLM_LOGS/pp-nlm-errors.log"
PP_NLM_RATE_SLEEP="${PP_NLM_RATE_SLEEP:-2}"

mkdir -p "$PP_NLM_STATE" "$PP_NLM_LOGS"
[ -f "$PP_NLM_SOURCE_MANIFEST" ] || echo "{}" > "$PP_NLM_SOURCE_MANIFEST"
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/write-helpers.sh"

# --- Public: add a markdown/text file as source ---
# add_source_text <alias> <file-path> [title-override]
add_source_text() {
  local alias="$1" file="$2"
  local title_override="${3:-}"
  local stamp; stamp=$(date -u +%Y-%m-%d)
  local base; base="$(basename "$file" .md)"
  local title="${title_override:-$base v1 — $stamp}"

  local content_hash; content_hash="$(pp_nlm_sha256_file "$file" 2>/dev/null || true)"
  if [ -n "$content_hash" ] && pp_nlm_manifest_seen "$alias" "$title" "$content_hash"; then
    echo "  skip: [$alias] $title (already in manifest)"
    return 0
  fi
  if [ ! -f "$file" ]; then
    echo "  FAIL: [$alias] file not found: $file" | tee -a "$PP_NLM_ERROR_LOG"
    return 1
  fi

  # 500K word cap (Sources §22.1)
  local words; words=$(wc -w < "$file")
  if [ "$words" -gt 500000 ]; then
    echo "  SKIP-OVERSIZE: [$alias] $file = $words words (>500K cap)" | tee -a "$PP_NLM_ERROR_LOG"
    return 0
  fi

  echo "  add: [$alias] $title ($words w)"
  pp_nlm_source_add_file "$alias" "$file" "$title" "text"
  sleep "$PP_NLM_RATE_SLEEP"
}

# --- Public: add a URL as source ---
# add_source_url <alias> <url> [title-override]
add_source_url() {
  local alias="$1" url="$2" title_override="${3:-}"
  local stamp; stamp=$(date -u +%Y-%m-%d)
  local title="${title_override:-$url — $stamp}"

  if pp_nlm_manifest_seen "$alias" "$title" "$(pp_nlm_sha256_text "$url")"; then
    echo "  skip: [$alias] $title (already in manifest)"
    return 0
  fi

  echo "  add: [$alias] URL $url"
  pp_nlm_source_add_url "$alias" "$url" "$title"
  sleep "$PP_NLM_RATE_SLEEP"
}

# --- Public: add a local file (PDF, etc.) as source ---
# add_source_file <alias> <file-path> [title-override]
add_source_file() {
  local alias="$1" file="$2" title_override="${3:-}"
  local stamp; stamp=$(date -u +%Y-%m-%d)
  local base; base="$(basename "$file")"
  local title="${title_override:-$base v1 — $stamp}"

  local content_hash; content_hash="$(pp_nlm_sha256_file "$file" 2>/dev/null || true)"
  if [ -n "$content_hash" ] && pp_nlm_manifest_seen "$alias" "$title" "$content_hash"; then
    echo "  skip: [$alias] $title (already in manifest)"
    return 0
  fi
  if [ ! -f "$file" ]; then
    echo "  FAIL: [$alias] file not found: $file" | tee -a "$PP_NLM_ERROR_LOG"
    return 1
  fi

  echo "  add: [$alias] FILE $file"
  pp_nlm_source_add_file "$alias" "$file" "$title" "file"
  sleep "$PP_NLM_RATE_SLEEP"
}

# --- Public: auth gate ---
pp_require_auth() {
  if ! pp_nlm_require_auth_bounded >/dev/null 2>&1; then
    echo "nlm: not authenticated. Run: nlm login" >&2
    exit 2
  fi
}

# --- Public: count sources for an alias in manifest ---
pp_manifest_count() {
  local alias="$1"
  pp_nlm_manifest_count "$alias"
}
