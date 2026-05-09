#!/usr/bin/env bash
# Apply PP-NLM chat configs safely.
#
# Default is dry-run for the two active hubs. Pass --apply to mutate.

set -uo pipefail

ROOT="$(git rev-parse --show-toplevel)"
CONFIG_DIR="$ROOT/data/pp-nlm/chat-configs"
LOCK="$HOME/.claude/state/pp-nlm/chat-config.lock"
CORE_ID="7565a078-8051-43ea-8512-c54c3b4d363e"
HARDWARE_ID="bb95833a-926e-47b1-8f45-d23427fbc58d"

source "$ROOT/scripts/pp-nlm/lib/write-helpers.sh"

APPLY=0
ALL_COMPAT=0
ALIASES=(pp-core pp-hardware)

for arg in "$@"; do
  case "$arg" in
    --apply) APPLY=1 ;;
    --dry-run) APPLY=0 ;;
    --all-compat) ALL_COMPAT=1 ;;
    *)
      echo "Usage: $0 [--dry-run] [--apply] [--all-compat]" >&2
      exit 2
      ;;
  esac
done

if [ "$ALL_COMPAT" -eq 1 ]; then
  mapfile -t ALIASES < <(find "$CONFIG_DIR" -maxdepth 1 -type f -name 'pp-*.txt' -printf '%f\n' | sed 's/\.txt$//' | sort)
fi

preflight_config() {
  local alias="$1" f="$CONFIG_DIR/$alias.txt" chars id
  if [ ! -f "$f" ]; then
    echo "FAIL: missing config for $alias: $f" >&2
    return 1
  fi

  chars=$(wc -m < "$f")
  if [ "$chars" -le 0 ]; then
    echo "FAIL: $alias config is empty" >&2
    return 1
  fi
  if [ "$chars" -ge 10000 ]; then
    echo "FAIL: $alias config is $chars chars (>=10K cap)" >&2
    return 1
  fi

  if grep -Eq 'pp-cmp|Tier-3|pp-feat-breadboard-view' "$f"; then
    echo "FAIL: $alias config references retired topology" >&2
    return 1
  fi

  id="$(timeout 20s nlm alias get "$alias" 2>/dev/null | tail -1 || true)"
  if [ "$id" != "$CORE_ID" ] && [ "$id" != "$HARDWARE_ID" ]; then
    echo "FAIL: $alias resolves to ${id:-nothing}, not a live hub" >&2
    return 1
  fi

  echo "OK: $alias ($chars chars) -> $id"
}

failures=0
for alias in "${ALIASES[@]}"; do
  if ! preflight_config "$alias"; then
    failures=$((failures + 1))
  fi
done

if [ "$failures" -gt 0 ]; then
  echo "FAIL: $failures chat config preflight check(s) failed" >&2
  exit 1
fi

if [ "$APPLY" -ne 1 ]; then
  echo "Dry run complete. Re-run with --apply to mutate NotebookLM chat configs."
  exit 0
fi

pp_nlm_require_auth_bounded
mkdir -p "$(dirname "$LOCK")"
(
  flock -w 300 9 || { echo "FAIL: could not acquire chat config lock" >&2; exit 75; }
  for alias in "${ALIASES[@]}"; do
    f="$CONFIG_DIR/$alias.txt"
    prompt="$(< "$f")"
    echo "Applying chat config to $alias..."
    if ! timeout 90s nlm chat configure "$alias" --goal custom --prompt "$prompt"; then
      echo "FAIL: chat configure failed or timed out for $alias" >&2
      exit 1
    fi
    sleep 2
  done
) 9>"$LOCK"

echo "Done."
