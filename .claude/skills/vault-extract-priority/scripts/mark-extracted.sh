#!/usr/bin/env bash
# mark-extracted.sh — Atomically update ops/queue/gap-stubs.md to mark a row extracted.
#
# Usage:
#   mark-extracted.sh <slug> <knowledge-slug>
# Example:
#   mark-extracted.sh wcag-focus-ring-contrast wcag-2-1-sc-1-4-11-focus-indicator-contrast
#
# Effect: rewrites the matching row's `status` column from `pending|in_progress` to
# `extracted → <knowledge-slug>.md`. Idempotent — already-extracted rows unchanged.

set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "Usage: $0 <slug> <knowledge-slug>" >&2
  exit 2
fi

slug="$1"
knowledge_slug="$2"
queue="$(git rev-parse --show-toplevel 2>/dev/null || pwd)/ops/queue/gap-stubs.md"

if [[ ! -f "$queue" ]]; then
  echo "ERROR: queue not found: $queue" >&2
  exit 1
fi

tmp="$(mktemp)"
updated=0
while IFS= read -r line; do
  # Match table rows containing the slug in column 3
  if [[ "$line" =~ ^\|[[:space:]]*([^|]+)[[:space:]]*\|[[:space:]]*([^|]+)[[:space:]]*\|[[:space:]]*${slug}[[:space:]]*\| ]]; then
    # Replace the status column (last column before trailing |)
    new_line=$(echo "$line" | awk -v ks="$knowledge_slug" 'BEGIN{FS=OFS="|"} {$7=" extracted → "ks".md "; print}')
    echo "$new_line" >> "$tmp"
    updated=1
  else
    echo "$line" >> "$tmp"
  fi
done < "$queue"

if [[ $updated -eq 0 ]]; then
  echo "WARN: no pending row for slug '$slug' in $queue" >&2
  rm "$tmp"
  exit 0
fi

mv "$tmp" "$queue"
echo "Marked extracted: $slug → knowledge/${knowledge_slug}.md"
