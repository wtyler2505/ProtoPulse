#!/usr/bin/env bash
# One-way exact mirror from pp-core + pp-hardware into Tyler's private pp-devlab.
#
# Default is dry-run. Pass --apply to create/update remote DevLab sources.

set -uo pipefail

ROOT="$(git rev-parse --show-toplevel)"
STATE="${PP_NLM_STATE:-$HOME/.claude/state/pp-nlm}"
LOGS="${PP_NLM_LOGS:-$HOME/.claude/logs}"
TARGET_ALIAS="${PP_NLM_DEVLAB_ALIAS:-pp-devlab}"
TARGET_TITLE="${PP_NLM_DEVLAB_TITLE:-ProtoPulse :: DevLab Sandbox}"
TARGET_TAGS="${PP_NLM_DEVLAB_TAGS:-pp:devlab,pp:sandbox,pp:private,pp:mirror}"
MIRROR_MANIFEST="${PP_NLM_DEVLAB_MANIFEST:-$STATE/devlab-mirror-manifest.json}"
NOTEBOOK_MANIFEST="$STATE/notebook-manifest.json"
CACHE_DIR="${PP_NLM_DEVLAB_CACHE:-$HOME/.cache/pp-nlm/devlab-source-content}"
LOG="$LOGS/pp-nlm-devlab-sync.log"
LOCK="$STATE/devlab-sync.lock"

LIST_TIMEOUT="${PP_NLM_DEVLAB_LIST_TIMEOUT:-180s}"
CONTENT_TIMEOUT="${PP_NLM_DEVLAB_CONTENT_TIMEOUT:-120s}"
APPLY=0
ONLY_ORIGIN=""
MAX_ADDS=""
CREATE=1
ORIGINS=(pp-core pp-hardware)

source "$ROOT/scripts/pp-nlm/lib/write-helpers.sh"

usage() {
  cat <<'USAGE'
Usage: sync-devlab.sh [--dry-run] [--apply] [--only-origin pp-core|pp-hardware] [--max-adds N] [--no-create]

Mirrors every source from pp-core and pp-hardware into the private pp-devlab
notebook as separate sources. The sync is one-way only; pp-devlab content is
never promoted back into the canonical hubs by this script.
USAGE
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --apply) APPLY=1; shift ;;
    --dry-run) APPLY=0; shift ;;
    --only-origin) ONLY_ORIGIN="${2:-}"; shift 2 ;;
    --max-adds) MAX_ADDS="${2:-}"; shift 2 ;;
    --no-create) CREATE=0; shift ;;
    --help|-h) usage; exit 0 ;;
    *) usage >&2; exit 2 ;;
  esac
done

mkdir -p "$STATE" "$LOGS" "$CACHE_DIR" "$(dirname "$MIRROR_MANIFEST")"
[ -f "$MIRROR_MANIFEST" ] || echo '{"sources":{}}' > "$MIRROR_MANIFEST"
[ -f "$NOTEBOOK_MANIFEST" ] || echo "{}" > "$NOTEBOOK_MANIFEST"

log() {
  printf '%s %s\n' "$(date -u --iso-8601=seconds)" "$*" | tee -a "$LOG"
}

json_string() {
  jq -Rs .
}

safe_filename() {
  printf '%s' "$1" | sed -E 's/[^A-Za-z0-9._-]+/-/g; s/^-+|-+$//g' | cut -c1-140
}

origin_label() {
  case "$1" in
    pp-core) printf '%s\n' "Core" ;;
    pp-hardware) printf '%s\n' "Hardware" ;;
    *) printf '%s\n' "$1" ;;
  esac
}

manifest_status() {
  local key="$1"
  jq -r --arg key "$key" '.sources[$key].status // ""' "$MIRROR_MANIFEST"
}

manifest_hash() {
  local key="$1"
  jq -r --arg key "$key" '.sources[$key].content_hash // ""' "$MIRROR_MANIFEST"
}

record_source() {
  local key="$1" origin_alias="$2" origin_id="$3" origin_title="$4" origin_type="$5" origin_url="$6"
  local target_id="$7" mirror_title="$8" mirror_source_id="$9" content_hash="${10}" status="${11}" cache_path="${12}" error="${13:-}"
  local tmp
  tmp="$(mktemp)"
  jq \
    --arg key "$key" \
    --arg origin_alias "$origin_alias" \
    --arg origin_id "$origin_id" \
    --arg origin_title "$origin_title" \
    --arg origin_type "$origin_type" \
    --arg origin_url "$origin_url" \
    --arg target_alias "$TARGET_ALIAS" \
    --arg target_id "$target_id" \
    --arg mirror_title "$mirror_title" \
    --arg mirror_source_id "$mirror_source_id" \
    --arg content_hash "$content_hash" \
    --arg status "$status" \
    --arg cache_path "$cache_path" \
    --arg error "$error" '
      .target_alias = $target_alias
      | .target_id = $target_id
      | .updated = (now | todate)
      | .sources[$key] = {
          origin_alias: $origin_alias,
          origin_id: $origin_id,
          origin_title: $origin_title,
          origin_type: $origin_type,
          origin_url: (if $origin_url == "" then null else $origin_url end),
          target_alias: $target_alias,
          target_id: $target_id,
          mirror_title: $mirror_title,
          mirror_source_id: (if $mirror_source_id == "" then null else $mirror_source_id end),
          content_hash: $content_hash,
          status: $status,
          cache_path: $cache_path,
          last_error: (if $error == "" then null else $error end),
          updated: (now | todate)
        }
    ' "$MIRROR_MANIFEST" > "$tmp" && mv "$tmp" "$MIRROR_MANIFEST"
}

update_notebook_manifest() {
  local id="$1" tmp
  tmp="$(mktemp)"
  jq \
    --arg id "$id" \
    --arg title "$TARGET_TITLE" \
    '.["pp-devlab"] = {
      id: $id,
      title: $title,
      devlab: true,
      private_sandbox: true,
      canonical: false,
      updated: (now | todate)
    }' "$NOTEBOOK_MANIFEST" > "$tmp" && mv "$tmp" "$NOTEBOOK_MANIFEST"
}

ensure_devlab() {
  local id raw
  id="$(pp_nlm_resolve_alias "$TARGET_ALIAS" 2>/dev/null || true)"
  if [ -n "$id" ]; then
    update_notebook_manifest "$id"
    printf '%s\n' "$id"
    return 0
  fi

  if [ "$CREATE" -ne 1 ] || [ "$APPLY" -ne 1 ]; then
    echo "missing"
    return 1
  fi

  log "create notebook: $TARGET_TITLE"
  raw="$(timeout 180s nlm notebook create "$TARGET_TITLE" 2>&1)"
  id="$(printf '%s\n' "$raw" | grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' | head -1)"
  if [ -z "$id" ]; then
    echo "$raw" >&2
    return 1
  fi
  timeout 60s nlm alias set "$TARGET_ALIAS" "$id" --type notebook
  timeout 60s nlm tag add "$id" --tags "$TARGET_TAGS" --title "$TARGET_TITLE"
  update_notebook_manifest "$id"
  printf '%s\n' "$id"
}

list_origin_sources() {
  local origin="$1"
  timeout "$LIST_TIMEOUT" nlm source list "$origin" --json
}

fetch_origin_content() {
  local origin="$1" source_id="$2" output="$3"
  if [ -s "$output" ]; then
    return 0
  fi
  mkdir -p "$(dirname "$output")"
  timeout "$CONTENT_TIMEOUT" nlm source content "$source_id" --output "$output" >/dev/null
}

write_mirror_file() {
  local origin="$1" source_id="$2" title="$3" type="$4" url="$5" raw_file="$6" mirror_file="$7"
  {
    echo "# ProtoPulse DevLab Mirror Source"
    echo
    echo "Mirror schema: protopulse-devlab-exact-mirror-v1"
    echo "Origin hub: $origin"
    echo "Origin source ID: $source_id"
    echo "Origin source title: $title"
    echo "Origin source type: $type"
    echo "Origin URL: ${url:-none}"
    echo "Mirrored at: $(date -u --iso-8601=seconds)"
    echo
    echo "---"
    echo
    echo "BEGIN ORIGIN SOURCE CONTENT"
    cat "$raw_file"
    echo
    echo "END ORIGIN SOURCE CONTENT"
  } > "$mirror_file"
}

sync_origin() {
  local origin="$1" target_id="$2" label source_json total idx key sid short_sid title type url slug mirror_title base raw_file mirror_file hash status remote_id attempts_done
  label="$(origin_label "$origin")"
  log "list origin: $origin"
  if ! source_json="$(list_origin_sources "$origin" 2>&1)"; then
    log "FAIL list origin: $origin :: $source_json"
    return 1
  fi
  total="$(printf '%s\n' "$source_json" | jq 'length')"
  log "origin count: $origin = $total"

  idx=0
  attempts_done=0
  while IFS= read -r row; do
    [ -n "$row" ] || continue
    idx=$((idx + 1))
    sid="$(printf '%s\n' "$row" | jq -r '.id // .source_id // .sourceId // empty')"
    title="$(printf '%s\n' "$row" | jq -r '.title // .name // .displayName // .display_name // "Untitled source"')"
    type="$(printf '%s\n' "$row" | jq -r '.type // "unknown"')"
    url="$(printf '%s\n' "$row" | jq -r '.url // ""')"
    [ -n "$sid" ] || continue
    short_sid="$(printf '%s' "$sid" | cut -c1-8)"

    key="$origin:$sid"
    slug="$(safe_filename "$title")"
    base="$CACHE_DIR/$origin/$sid-$slug"
    raw_file="$base.txt.raw"
    mirror_file="$base.mirror.txt"
    mirror_title="$label Mirror :: $title [$short_sid]"

    status="$(manifest_status "$key")"
    if [ "$status" = "mirrored" ]; then
      log "skip mirrored: $origin $idx/$total $title"
      continue
    fi

    if [ "$APPLY" -ne 1 ]; then
      log "would mirror: $origin $idx/$total $title"
      continue
    fi

    if [ -n "$MAX_ADDS" ] && [ "$attempts_done" -ge "$MAX_ADDS" ]; then
      log "max adds reached: $MAX_ADDS"
      break
    fi
    attempts_done=$((attempts_done + 1))

    if ! fetch_origin_content "$origin" "$sid" "$raw_file"; then
      log "WARN content failed: $origin $sid $title"
      record_source "$key" "$origin" "$sid" "$title" "$type" "$url" "$target_id" "$mirror_title" "" "" "content_failed" "$raw_file" "source content fetch failed or timed out"
      continue
    fi

    write_mirror_file "$origin" "$sid" "$title" "$type" "$url" "$raw_file" "$mirror_file"
    hash="$(pp_nlm_sha256_file "$mirror_file")"

    if [ "$(manifest_hash "$key")" = "$hash" ] && [ "$status" = "mirrored" ]; then
      log "skip unchanged: $origin $idx/$total $title"
      continue
    fi

    log "mirror add: $origin $idx/$total $title"
    if PP_NLM_SKIP_PRE_ADD_RECONCILE=1 pp_nlm_source_add_file "$TARGET_ALIAS" "$mirror_file" "$mirror_title" "devlab-mirror" "$sid"; then
      remote_id="$(pp_nlm_reconcile_source_id "$target_id" "$mirror_title" || true)"
      record_source "$key" "$origin" "$sid" "$title" "$type" "$url" "$target_id" "$mirror_title" "$remote_id" "$hash" "mirrored" "$mirror_file"
    else
      remote_id="$(pp_nlm_reconcile_source_id "$target_id" "$mirror_title" || true)"
      if [ -n "$remote_id" ]; then
        record_source "$key" "$origin" "$sid" "$title" "$type" "$url" "$target_id" "$mirror_title" "$remote_id" "$hash" "mirrored_after_failure" "$mirror_file"
        log "reconciled after failed add: $origin $sid -> $remote_id"
        continue
      fi
      record_source "$key" "$origin" "$sid" "$title" "$type" "$url" "$target_id" "$mirror_title" "" "$hash" "add_failed" "$mirror_file" "source add failed"
    fi
  done < <(printf '%s\n' "$source_json" | jq -c '.[]?')
}

main() {
  local target_id origin
  pp_nlm_require_auth_bounded || exit $?

  (
    flock -w 300 9 || { echo "FAIL: could not acquire DevLab sync lock" >&2; exit 75; }
    target_id="$(ensure_devlab)"
    if [ "$target_id" = "missing" ] || [ -z "$target_id" ]; then
      echo "FAIL: $TARGET_ALIAS does not exist. Re-run with --apply to create it." >&2
      exit 1
    fi
    log "target: $TARGET_ALIAS -> $target_id"

    for origin in "${ORIGINS[@]}"; do
      if [ -n "$ONLY_ORIGIN" ] && [ "$origin" != "$ONLY_ORIGIN" ]; then
        continue
      fi
      sync_origin "$origin" "$target_id"
    done

    jq -r '
      .sources
      | to_entries
      | group_by(.value.status)
      | map({status: .[0].value.status, count: length})
      | sort_by(.status)
    ' "$MIRROR_MANIFEST"
  ) 9>"$LOCK"

  if [ "$APPLY" -ne 1 ]; then
    echo "Dry run complete. Re-run with --apply to mutate NotebookLM."
  fi
  echo "Manifest: $MIRROR_MANIFEST"
  echo "Cache: $CACHE_DIR"
}

main
