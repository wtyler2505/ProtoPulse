#!/usr/bin/env bash
# Phase 4 — apply per-notebook custom chat configs from data/pp-nlm/chat-configs/<alias>.txt
# Verifies char count via `wc -m` (NOT `wc -c` — UTF-8 multi-byte safety per nlm-skill SKILL.md L422).
set -uo pipefail
ROOT="$(git rev-parse --show-toplevel)"
CONFIG_DIR="$ROOT/data/pp-nlm/chat-configs"

if ! nlm login --check >/dev/null 2>&1; then
  echo "nlm: not authenticated. Run: nlm login" >&2
  exit 2
fi

for f in "$CONFIG_DIR"/*.txt; do
  alias=$(basename "$f" .txt)
  chars=$(wc -m < "$f")
  if [ "$chars" -ge 10000 ]; then
    echo "FAIL: $alias config is $chars chars (≥10K cap)" >&2
    exit 1
  fi
  if ! nlm alias get "$alias" >/dev/null 2>&1; then
    echo "skip: $alias does not resolve (notebook not yet created)"
    continue
  fi
  prompt="$(cat "$f")"
  echo "Applying chat config to $alias ($chars chars)..."
  nlm chat configure "$alias" --goal custom --prompt "$prompt"
  sleep 2
done
echo "Done."
