#!/usr/bin/env bash
# append-queue.sh — Append a vault-gap entry to ops/queue/gap-stubs.md.
#
# Usage:
#   ./append-queue.sh <slug> <topic> <origin-plan> <origin-task> <coverage> [status]
# Example:
#   ./append-queue.sh wcag-focus-ring-contrast "WCAG focus ring contrast" \
#     "docs/superpowers/plans/2026-04-18-e2e-walkthrough/03-a11y-systemic.md" \
#     "Wave 10 Task 10.1" missing
#
# Coverage: sufficient | thin | missing
# Status:   pending | in_progress | extracted | archived  (default: pending)

set -euo pipefail

if [[ $# -lt 5 ]]; then
  echo "Usage: $0 <slug> <topic> <origin-plan> <origin-task> <coverage> [status]" >&2
  exit 2
fi

slug="$1"
topic="$2"
origin_plan="$3"
origin_task="$4"
coverage="$5"
status="${6:-pending}"

queue_file="$(git rev-parse --show-toplevel 2>/dev/null || pwd)/ops/queue/gap-stubs.md"

# Bootstrap queue file if missing
if [[ ! -f "$queue_file" ]]; then
  mkdir -p "$(dirname "$queue_file")"
  cat > "$queue_file" <<'EOF'
# Vault Gap Stubs Queue

Ordered append-only log of vault gaps flagged by `/vault-gap`. `/extract` processes these in priority order (most-referenced-by-pending-plans first per T15; FIFO otherwise).

Managed by skill `.claude/skills/vault-gap/SKILL.md`.

| timestamp | topic | slug | origin plan | task | coverage | status |
|-----------|-------|------|-------------|------|----------|--------|
EOF
fi

ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

# Escape pipes in user-provided fields to avoid breaking the table
esc() { printf '%s' "$1" | sed 's/|/\\|/g'; }

printf "| %s | %s | %s | %s | %s | %s | %s |\n" \
  "$ts" \
  "$(esc "$topic")" \
  "$(esc "$slug")" \
  "$(esc "$origin_plan")" \
  "$(esc "$origin_task")" \
  "$(esc "$coverage")" \
  "$(esc "$status")" \
  >> "$queue_file"

echo "Queued: $slug ($coverage) from $origin_plan#$origin_task → $queue_file"
