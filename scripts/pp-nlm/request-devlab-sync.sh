#!/usr/bin/env bash
# Coalesced DevLab sync requests.
#
# Canonical hub writes can call this script to request a private pp-devlab mirror
# refresh without blocking the foreground write on a full NotebookLM scan.

set -uo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || echo /home/wtyler/Projects/ProtoPulse)"
STATE="${PP_NLM_STATE:-$HOME/.claude/state/pp-nlm}"
LOGS="${PP_NLM_LOGS:-$HOME/.claude/logs}"
REQUEST="$STATE/devlab-sync-request.json"
LOCK="$STATE/devlab-autosync.lock"
LAST_SUCCESS="$STATE/devlab-autosync-last-success"
LOG="$LOGS/pp-nlm-devlab-autosync.log"

AUTOSYNC="${PP_NLM_DEVLAB_AUTOSYNC:-1}"
DELAY="${PP_NLM_DEVLAB_AUTOSYNC_DELAY:-45}"
MIN_INTERVAL="${PP_NLM_DEVLAB_AUTOSYNC_MIN_INTERVAL:-300}"
SOURCE_ADD_TIMEOUT="${PP_NLM_DEVLAB_SOURCE_ADD_TIMEOUT:-300}"
CONTENT_ATTEMPTS="${PP_NLM_DEVLAB_CONTENT_ATTEMPTS:-4}"
CONTENT_RETRY_SLEEP="${PP_NLM_DEVLAB_CONTENT_RETRY_SLEEP:-5}"

MODE="request"
SOURCE="manual"
TITLE=""
REASON="canonical-source-write"
SPAWN=1

usage() {
  cat <<'USAGE'
Usage: request-devlab-sync.sh [--request] [--run-due] [--status] [--source ALIAS] [--title TITLE] [--reason TEXT] [--no-spawn]

Requests or runs a coalesced pp-devlab mirror sync.

Modes:
  --request   Record a pending sync request and optionally launch delayed background worker.
  --run-due   Run a sync if a request is pending and the minimum interval has elapsed.
  --status    Print pending request and last-success state.
USAGE
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --request) MODE="request"; shift ;;
    --run-due) MODE="run-due"; shift ;;
    --status) MODE="status"; shift ;;
    --source) SOURCE="${2:-manual}"; shift 2 ;;
    --title) TITLE="${2:-}"; shift 2 ;;
    --reason) REASON="${2:-canonical-source-write}"; shift 2 ;;
    --no-spawn) SPAWN=0; shift ;;
    --help|-h) usage; exit 0 ;;
    *) usage >&2; exit 2 ;;
  esac
done

mkdir -p "$STATE" "$LOGS"

log() {
  printf '%s %s\n' "$(date -u --iso-8601=seconds)" "$*" | tee -a "$LOG"
}

write_request() {
  local tmp
  tmp="$(mktemp)"
  jq -n \
    --arg requested_at "$(date -u --iso-8601=seconds)" \
    --arg source "$SOURCE" \
    --arg title "$TITLE" \
    --arg reason "$REASON" \
    '{
      pending: true,
      requested_at: $requested_at,
      source: $source,
      title: $title,
      reason: $reason
    }' > "$tmp" && mv "$tmp" "$REQUEST"
}

spawn_worker() {
  [ "$SPAWN" -eq 1 ] || return 0
  [ "$AUTOSYNC" = "1" ] || return 0
  nohup bash -c 'sleep "$1"; "$2" --run-due' _ "$DELAY" "$0" >> "$LOG" 2>&1 &
}

run_due() {
  [ -f "$REQUEST" ] || { log "skip: no pending DevLab sync request"; return 0; }

  (
    flock -n 9 || { log "skip: DevLab autosync already running"; exit 0; }
    [ -f "$REQUEST" ] || { log "skip: no pending DevLab sync request"; exit 0; }

    local now_ts last_ts age
    now_ts="$(date +%s)"
    last_ts="0"
    [ -f "$LAST_SUCCESS" ] && last_ts="$(cat "$LAST_SUCCESS" 2>/dev/null || echo 0)"
    age=$((now_ts - last_ts))
    if [ "$age" -lt "$MIN_INTERVAL" ]; then
      log "defer: last successful DevLab autosync was ${age}s ago"
      exit 0
    fi

    log "start: DevLab autosync requested by $(jq -r '.source // "unknown"' "$REQUEST" 2>/dev/null)"
    if bash "$ROOT/scripts/pp-nlm/sync-devlab.sh" \
      --apply \
      --source-add-timeout "$SOURCE_ADD_TIMEOUT" \
      --content-fetch-attempts "$CONTENT_ATTEMPTS" \
      --content-fetch-retry-sleep "$CONTENT_RETRY_SLEEP"; then
      date +%s > "$LAST_SUCCESS"
      rm -f "$REQUEST"
      log "done: DevLab autosync complete"
      exit 0
    fi

    log "FAIL: DevLab autosync failed; request left pending"
    exit 1
  ) 9>"$LOCK"
}

case "$MODE" in
  request)
    write_request
    log "request: DevLab sync requested by $SOURCE ${TITLE:+for $TITLE}"
    spawn_worker
    ;;
  run-due)
    run_due
    ;;
  status)
    if [ -f "$REQUEST" ]; then
      echo "Pending DevLab sync request:"
      jq . "$REQUEST"
    else
      echo "No pending DevLab sync request."
    fi
    if [ -f "$LAST_SUCCESS" ]; then
      echo "Last success epoch: $(cat "$LAST_SUCCESS")"
    fi
    ;;
esac
