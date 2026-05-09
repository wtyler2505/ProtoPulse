#!/usr/bin/env bash
# Shared, lock-protected NotebookLM write helpers.
#
# Source this file from pp-nlm scripts. It intentionally treats timeouts as
# unknown state: after any ambiguous write result, reconcile before retrying.

set -uo pipefail

PP_NLM_ROOT="${PP_NLM_ROOT:-/home/wtyler/Projects/ProtoPulse}"
PP_NLM_STATE="${PP_NLM_STATE:-$HOME/.claude/state/pp-nlm}"
PP_NLM_LOGS="${PP_NLM_LOGS:-$HOME/.claude/logs}"
PP_NLM_SOURCE_MANIFEST="${PP_NLM_SOURCE_MANIFEST:-$PP_NLM_STATE/source-manifest.json}"
PP_NLM_ERROR_LOG="${PP_NLM_ERROR_LOG:-$PP_NLM_LOGS/pp-nlm-errors.log}"
PP_NLM_WRITE_LOCK="${PP_NLM_WRITE_LOCK:-$PP_NLM_STATE/write.lock}"

PP_NLM_AUTH_TIMEOUT="${PP_NLM_AUTH_TIMEOUT:-30s}"
PP_NLM_ALIAS_TIMEOUT="${PP_NLM_ALIAS_TIMEOUT:-20s}"
PP_NLM_LIST_TIMEOUT="${PP_NLM_LIST_TIMEOUT:-60s}"
PP_NLM_ADD_TIMEOUT="${PP_NLM_ADD_TIMEOUT:-180s}"
PP_NLM_WAIT_TIMEOUT="${PP_NLM_WAIT_TIMEOUT:-90}"
PP_NLM_LOCK_TIMEOUT="${PP_NLM_LOCK_TIMEOUT:-900}"

PP_NLM_CORE_ID="${PP_NLM_CORE_ID:-7565a078-8051-43ea-8512-c54c3b4d363e}"
PP_NLM_HARDWARE_ID="${PP_NLM_HARDWARE_ID:-bb95833a-926e-47b1-8f45-d23427fbc58d}"

mkdir -p "$PP_NLM_STATE" "$PP_NLM_LOGS"
[ -f "$PP_NLM_SOURCE_MANIFEST" ] || echo "{}" > "$PP_NLM_SOURCE_MANIFEST"

pp_nlm_log_error() {
  printf '%s %s\n' "$(date -u --iso-8601=seconds)" "$*" | tee -a "$PP_NLM_ERROR_LOG" >&2
}

pp_nlm_require_auth_bounded() {
  if timeout "$PP_NLM_AUTH_TIMEOUT" nlm doctor >/dev/null 2>&1; then
    return 0
  fi
  if timeout "$PP_NLM_AUTH_TIMEOUT" nlm login --check >/dev/null 2>&1; then
    return 0
  fi
  pp_nlm_log_error "FAIL: bounded NotebookLM auth check failed or timed out"
  return 2
}

pp_nlm_resolve_alias() {
  local alias="$1"
  if [[ "$alias" =~ ^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$ ]]; then
    printf '%s\n' "$alias"
    return 0
  fi
  timeout "$PP_NLM_ALIAS_TIMEOUT" nlm alias get "$alias" 2>/dev/null | tail -1
}

pp_nlm_canonical_alias_for_id() {
  local target_id="$1" fallback="$2"
  case "$target_id" in
    "$PP_NLM_CORE_ID") printf '%s\n' "pp-core" ;;
    "$PP_NLM_HARDWARE_ID") printf '%s\n' "pp-hardware" ;;
    *) printf '%s\n' "$fallback" ;;
  esac
}

pp_nlm_sha256_file() {
  sha256sum "$1" | awk '{print $1}'
}

pp_nlm_sha256_text() {
  printf '%s' "$1" | sha256sum | awk '{print $1}'
}

pp_nlm_manifest_seen() {
  local requested_alias="$1" title="$2" content_hash="${3:-}"
  local target_id canonical_alias
  target_id="$(pp_nlm_resolve_alias "$requested_alias" 2>/dev/null || true)"
  canonical_alias="$(pp_nlm_canonical_alias_for_id "$target_id" "$requested_alias")"

  jq -e \
    --arg canonical "$canonical_alias" \
    --arg requested "$requested_alias" \
    --arg title "$title" \
    --arg hash "$content_hash" '
      [(.[$canonical] // []), (.[$requested] // [])] | add
      | any(
          (.title == $title or ($hash != "" and ((.content_hash // .sha256 // "") == $hash)))
          and ((((.status // "added") | test("^(failed|timeout_unresolved)$"))) | not)
        )
    ' "$PP_NLM_SOURCE_MANIFEST" >/dev/null 2>&1
}

pp_nlm_manifest_count() {
  local requested_alias="$1"
  local target_id canonical_alias
  target_id="$(pp_nlm_resolve_alias "$requested_alias" 2>/dev/null || true)"
  canonical_alias="$(pp_nlm_canonical_alias_for_id "$target_id" "$requested_alias")"
  jq -r --arg a "$canonical_alias" '.[$a] // [] | length' "$PP_NLM_SOURCE_MANIFEST"
}

pp_nlm_manifest_record() {
  local requested_alias="$1" canonical_alias="$2" target_id="$3" remote_source_id="$4"
  local title="$5" path_or_url="$6" kind="$7" content_hash="$8" status="$9"
  local attempts="${10:-1}" last_error="${11:-}" original_source_id="${12:-}"
  local tmp
  tmp="$(mktemp)"
  jq \
    --arg a "$canonical_alias" \
    --arg requested "$requested_alias" \
    --arg target "$target_id" \
    --arg sid "$remote_source_id" \
    --arg title "$title" \
    --arg path "$path_or_url" \
    --arg kind "$kind" \
    --arg hash "$content_hash" \
    --arg status "$status" \
    --argjson attempts "$attempts" \
    --arg err "$last_error" \
    --arg original "$original_source_id" '
      .[$a] = ((.[$a] // []) + [{
        id: $sid,
        remote_source_id: $sid,
        original_source_id: (if $original == "" then null else $original end),
        title: $title,
        path_or_url: $path,
        kind: $kind,
        content_hash: $hash,
        requested_alias: $requested,
        target_alias: $a,
        target_id: $target,
        status: $status,
        attempts: $attempts,
        last_error: (if $err == "" then null else $err end),
        added: (now | todate)
      }])
    ' "$PP_NLM_SOURCE_MANIFEST" > "$tmp" \
    && mv "$tmp" "$PP_NLM_SOURCE_MANIFEST" \
    || rm -f "$tmp"
}

pp_nlm_reconcile_source_id() {
  local target_id="$1" title="$2"
  local json sid
  json="$(timeout "$PP_NLM_LIST_TIMEOUT" nlm source list "$target_id" --json 2>/dev/null || true)"
  [ -n "$json" ] || return 1
  sid="$(printf '%s\n' "$json" | jq -r --arg title "$title" '
    .[]? |
    select((.title // .name // .displayName // .display_name // "") == $title) |
    (.id // .source_id // .sourceId // empty)
  ' 2>/dev/null | head -1)"
  [ -n "$sid" ] || return 1
  printf '%s\n' "$sid"
}

pp_nlm_parse_source_id() {
  grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' | head -1
}

pp_nlm_tail_error() {
  tail -8 | tr '\n' '|' | cut -c1-1000
}

pp_nlm_source_add_file() {
  local requested_alias="$1" file="$2" title="$3" kind="${4:-file}" original_source_id="${5:-}"
  if [ ! -f "$file" ]; then
    pp_nlm_log_error "FAIL: [$requested_alias] file not found: $file"
    return 1
  fi

  local content_hash
  content_hash="$(pp_nlm_sha256_file "$file")"
  if pp_nlm_manifest_seen "$requested_alias" "$title" "$content_hash"; then
    echo "  skip: [$requested_alias] $title (already in manifest)"
    return 0
  fi

  (
    flock -w "$PP_NLM_LOCK_TIMEOUT" 9 || {
      pp_nlm_log_error "FAIL: could not acquire NotebookLM write lock: $PP_NLM_WRITE_LOCK"
      exit 75
    }

    pp_nlm_require_auth_bounded || exit $?

    local target_id canonical_alias
    target_id="$(pp_nlm_resolve_alias "$requested_alias" || true)"
    if [ -z "$target_id" ]; then
      pp_nlm_log_error "FAIL: [$requested_alias] could not resolve alias"
      exit 2
    fi
    canonical_alias="$(pp_nlm_canonical_alias_for_id "$target_id" "$requested_alias")"

    if pp_nlm_manifest_seen "$requested_alias" "$title" "$content_hash"; then
      echo "  skip: [$canonical_alias] $title (already in manifest)"
      exit 0
    fi

    echo "  add-file: [$canonical_alias] $title"

    local raw rc sid status err
    if [ "${PP_NLM_USE_WAIT:-0}" = "1" ]; then
      raw="$(timeout "$PP_NLM_ADD_TIMEOUT" nlm source add "$target_id" --file "$file" --title "$title" --wait --wait-timeout "$PP_NLM_WAIT_TIMEOUT" 2>&1)"
    else
      raw="$(timeout "$PP_NLM_ADD_TIMEOUT" nlm source add "$target_id" --file "$file" --title "$title" 2>&1)"
    fi
    rc=$?
    sid="$(printf '%s\n' "$raw" | pp_nlm_parse_source_id || true)"
    err="$(printf '%s\n' "$raw" | pp_nlm_tail_error)"

    if [ "$rc" -eq 0 ]; then
      [ -n "$sid" ] || sid="$(pp_nlm_reconcile_source_id "$target_id" "$title" || true)"
      status="added"
      [ -n "$sid" ] || { sid="unknown-$(date +%s)"; status="added_unreconciled"; }
      pp_nlm_manifest_record "$requested_alias" "$canonical_alias" "$target_id" "$sid" "$title" "$file" "$kind" "$content_hash" "$status" 1 "" "$original_source_id"
      exit 0
    fi

    sid="$(pp_nlm_reconcile_source_id "$target_id" "$title" || true)"
    if [ -n "$sid" ]; then
      status="unknown_reconciled"
      pp_nlm_manifest_record "$requested_alias" "$canonical_alias" "$target_id" "$sid" "$title" "$file" "$kind" "$content_hash" "$status" 1 "$err" "$original_source_id"
      echo "  reconciled: [$canonical_alias] $title -> $sid"
      exit 0
    fi

    if [ "$rc" -eq 124 ]; then
      status="timeout_unresolved"
    else
      status="failed"
    fi
    pp_nlm_log_error "FAIL: [$canonical_alias] $title rc=$rc :: $err"
    pp_nlm_manifest_record "$requested_alias" "$canonical_alias" "$target_id" "unknown-$(date +%s)" "$title" "$file" "$kind" "$content_hash" "$status" 1 "$err" "$original_source_id"
    exit 1
  ) 9>"$PP_NLM_WRITE_LOCK"
}

pp_nlm_source_add_url() {
  local requested_alias="$1" url="$2" title="$3"
  local content_hash
  content_hash="$(pp_nlm_sha256_text "$url")"
  if pp_nlm_manifest_seen "$requested_alias" "$title" "$content_hash"; then
    echo "  skip: [$requested_alias] $title (already in manifest)"
    return 0
  fi

  (
    flock -w "$PP_NLM_LOCK_TIMEOUT" 9 || {
      pp_nlm_log_error "FAIL: could not acquire NotebookLM write lock: $PP_NLM_WRITE_LOCK"
      exit 75
    }

    pp_nlm_require_auth_bounded || exit $?

    local target_id canonical_alias raw rc sid status err
    target_id="$(pp_nlm_resolve_alias "$requested_alias" || true)"
    if [ -z "$target_id" ]; then
      pp_nlm_log_error "FAIL: [$requested_alias] could not resolve alias"
      exit 2
    fi
    canonical_alias="$(pp_nlm_canonical_alias_for_id "$target_id" "$requested_alias")"

    echo "  add-url: [$canonical_alias] $url"
    if [ "${PP_NLM_USE_WAIT:-0}" = "1" ]; then
      raw="$(timeout "$PP_NLM_ADD_TIMEOUT" nlm source add "$target_id" --url "$url" --title "$title" --wait --wait-timeout "$PP_NLM_WAIT_TIMEOUT" 2>&1)"
    else
      raw="$(timeout "$PP_NLM_ADD_TIMEOUT" nlm source add "$target_id" --url "$url" --title "$title" 2>&1)"
    fi
    rc=$?
    sid="$(printf '%s\n' "$raw" | pp_nlm_parse_source_id || true)"
    err="$(printf '%s\n' "$raw" | pp_nlm_tail_error)"

    if [ "$rc" -eq 0 ]; then
      [ -n "$sid" ] || sid="$(pp_nlm_reconcile_source_id "$target_id" "$title" || true)"
      status="added"
      [ -n "$sid" ] || { sid="unknown-$(date +%s)"; status="added_unreconciled"; }
      pp_nlm_manifest_record "$requested_alias" "$canonical_alias" "$target_id" "$sid" "$title" "$url" "url" "$content_hash" "$status" 1 ""
      exit 0
    fi

    sid="$(pp_nlm_reconcile_source_id "$target_id" "$title" || true)"
    if [ -n "$sid" ]; then
      pp_nlm_manifest_record "$requested_alias" "$canonical_alias" "$target_id" "$sid" "$title" "$url" "url" "$content_hash" "unknown_reconciled" 1 "$err"
      exit 0
    fi

    [ "$rc" -eq 124 ] && status="timeout_unresolved" || status="failed"
    pp_nlm_log_error "FAIL: [$canonical_alias] url=$url rc=$rc :: $err"
    pp_nlm_manifest_record "$requested_alias" "$canonical_alias" "$target_id" "unknown-$(date +%s)" "$title" "$url" "url" "$content_hash" "$status" 1 "$err"
    exit 1
  ) 9>"$PP_NLM_WRITE_LOCK"
}
