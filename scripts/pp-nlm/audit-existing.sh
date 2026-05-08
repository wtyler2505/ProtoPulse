#!/usr/bin/env bash
# scripts/pp-nlm/audit-existing.sh
# Phase 0 — read-only audit of existing NotebookLM state.
# Writes a dated JSON manifest to ~/.claude/state/pp-nlm/audit-<date>.json.

set -e
STATE="$HOME/.claude/state/pp-nlm"
mkdir -p "$STATE"
DATE=$(date -u +%Y-%m-%d)
OUT="$STATE/audit-$DATE.json"

# Auth gate
if ! nlm login --check >/dev/null 2>&1; then
  echo "nlm: not authenticated. Run: nlm login" >&2
  exit 2
fi

# Doctor must pass
if ! nlm doctor >/dev/null 2>&1; then
  echo "nlm doctor failed; investigate before proceeding" >&2
  nlm doctor >&2
  exit 3
fi

# Capture notebooks (JSON array of {id, title, ...})
RAW=$(nlm notebook list --json)

# Wrap into a richer audit envelope
jq --arg date "$(date -u --iso-8601=seconds)" \
   --arg account "$(nlm login --check 2>&1 | grep -oE 'Account: [^ ]+' | awk '{print $2}')" \
   '{audit_date: $date, account: $account, notebooks: .}' \
   <<<"$RAW" > "$OUT"

echo "Audit written: $OUT"
echo "Notebooks captured: $(jq -r '.notebooks | length' "$OUT")"
