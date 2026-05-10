#!/usr/bin/env bash
# Read-only PP-NLM health check for the consolidated two-hub topology.

set -uo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || echo /home/wtyler/Projects/ProtoPulse)"
STATE="${PP_NLM_STATE:-$HOME/.claude/state/pp-nlm}"
LOGS="${PP_NLM_LOGS:-$HOME/.claude/logs}"
SOURCE_MANIFEST="$STATE/source-manifest.json"
NOTEBOOK_MANIFEST="$STATE/notebook-manifest.json"
DEVLAB_MIRROR_MANIFEST="$STATE/devlab-mirror-manifest.json"
ARCHIVE_MANIFEST="$ROOT/docs/nlm-archive/manifest.json"
DEVLAB_SOURCE_TIMEOUT="${PP_NLM_HEALTH_DEVLAB_SOURCE_TIMEOUT:-120s}"

CORE_ID="7565a078-8051-43ea-8512-c54c3b4d363e"
HARDWARE_ID="bb95833a-926e-47b1-8f45-d23427fbc58d"
DEVLAB_ID="d4188389-eef8-4aa3-a27d-1fed3f8cf444"

echo "PP-NLM Health"
echo "============="
echo

echo "Auth"
if timeout 30s nlm doctor >/tmp/pp-nlm-health-doctor.$$ 2>&1; then
  echo "  OK: nlm doctor passed"
else
  echo "  WARN: nlm doctor failed or timed out"
  sed 's/^/    /' /tmp/pp-nlm-health-doctor.$$ 2>/dev/null | tail -20
fi
rm -f /tmp/pp-nlm-health-doctor.$$
echo

echo "Live Hubs"
for alias in pp-core pp-hardware; do
  id="$(timeout 20s nlm alias get "$alias" 2>/dev/null | tail -1 || true)"
  case "$alias" in
    pp-core) expected="$CORE_ID" ;;
    pp-hardware) expected="$HARDWARE_ID" ;;
  esac
  if [ "$id" = "$expected" ]; then
    echo "  OK: $alias -> $id"
  else
    echo "  WARN: $alias -> ${id:-unresolved} (expected $expected)"
  fi
done
echo

echo "Compatibility Aliases"
for alias in pp-codebase pp-arscontexta pp-memories pp-backlog pp-journal pp-research pp-breadboard pp-bench pp-feat-parts-catalog; do
  id="$(timeout 20s nlm alias get "$alias" 2>/dev/null | tail -1 || true)"
  if [ "$id" = "$CORE_ID" ] || [ "$id" = "$HARDWARE_ID" ]; then
    echo "  OK: $alias -> $id"
  else
    echo "  WARN: $alias -> ${id:-unresolved}"
  fi
done
echo

echo "Private DevLab"
id="$(timeout 20s nlm alias get pp-devlab 2>/dev/null | tail -1 || true)"
if [ "$id" = "$DEVLAB_ID" ]; then
  count="$(timeout "$DEVLAB_SOURCE_TIMEOUT" nlm source list pp-devlab --json 2>/dev/null | jq 'length' 2>/dev/null || echo "unknown")"
  echo "  OK: pp-devlab -> $id ($count sources)"
else
  echo "  WARN: pp-devlab -> ${id:-unresolved} (expected $DEVLAB_ID)"
fi
echo

echo "Local Notebook Manifest"
if [ -f "$NOTEBOOK_MANIFEST" ]; then
  jq -r 'to_entries | sort_by(.key) | .[] | "  \(.key): \(.value.id // .value)"' "$NOTEBOOK_MANIFEST" 2>/dev/null | sed -n '1,80p'
else
  echo "  WARN: missing $NOTEBOOK_MANIFEST"
fi
echo

echo "Source Manifest Counts"
if [ -f "$SOURCE_MANIFEST" ]; then
  jq -r 'to_entries | sort_by(.key) | .[] | "  \(.key): \(.value | length) sources"' "$SOURCE_MANIFEST" 2>/dev/null
  unresolved="$(jq '[.[]?[]? | select((.status // "added") | test("failed|timeout|unknown"))] | length' "$SOURCE_MANIFEST" 2>/dev/null || echo 0)"
  echo "  unresolved_or_failed: $unresolved"
else
  echo "  WARN: missing $SOURCE_MANIFEST"
fi
echo

echo "DevLab Mirror Manifest"
if [ -f "$DEVLAB_MIRROR_MANIFEST" ]; then
  jq -r '
    .sources
    | to_entries
    | group_by(.value.status)
    | map({status: .[0].value.status, count: length})
    | sort_by(.status)
    | .[]
    | "  \(.status): \(.count)"
  ' "$DEVLAB_MIRROR_MANIFEST" 2>/dev/null || echo "  WARN: could not parse $DEVLAB_MIRROR_MANIFEST"
else
  echo "  WARN: missing $DEVLAB_MIRROR_MANIFEST"
fi
echo

echo "Retired Tag Exposure"
tag_output="$(timeout 30s nlm tag list 2>/dev/null || true)"
if [ -n "$tag_output" ]; then
  printf '%s\n' "$tag_output" | rg 'pp:feature|pp:component|pp:cmp-' | sed 's/^/  WARN: /' || echo "  OK: no retired feature/component tags visible"
else
  echo "  WARN: could not read tag list"
fi
echo

echo "Archive"
if [ -d "$ROOT/docs/nlm-archive" ]; then
  du -sh "$ROOT/docs/nlm-archive" 2>/dev/null | sed 's/^/  size: /'
else
  echo "  WARN: missing docs/nlm-archive"
fi
if [ -f "$ARCHIVE_MANIFEST" ]; then
  echo "  artifacts: $(jq 'length' "$ARCHIVE_MANIFEST" 2>/dev/null || echo 0)"
fi
echo

echo "Recent Errors"
if [ -s "$LOGS/pp-nlm-errors.log" ]; then
  tail -8 "$LOGS/pp-nlm-errors.log" | sed 's/^/  /'
else
  echo "  OK: no pp-nlm-errors.log entries"
fi
