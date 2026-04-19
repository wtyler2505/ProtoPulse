#!/usr/bin/env bash
# append-user-suggestion.sh — Append a user-suggested inbox entry to
# ops/queue/user-suggestions.md (separate from vault-gap's gap-stubs.md queue;
# different priority class per the vault-inbox spec).
#
# Usage:
#   ./append-user-suggestion.sh <slug> <topic> <submitter> <origin-slug> <inbox-path> [surface] [status]
#
# surface: ui | cli        (default: cli)
# status:  pending-review | approved | promoted | archived   (default: pending-review)

set -euo pipefail

if [[ $# -lt 5 ]]; then
  echo "Usage: $0 <slug> <topic> <submitter> <origin-slug> <inbox-path> [surface] [status]" >&2
  exit 2
fi

slug="$1"
topic="$2"
submitter="$3"
origin_slug="$4"
inbox_path="$5"
surface="${6:-cli}"
status="${7:-pending-review}"

queue_file="$(git rev-parse --show-toplevel 2>/dev/null || pwd)/ops/queue/user-suggestions.md"

# Bootstrap queue file if missing
if [[ ! -f "$queue_file" ]]; then
  mkdir -p "$(dirname "$queue_file")"
  cat > "$queue_file" <<'EOF'
# User-Suggested Inbox Queue

Ordered append-only log of user-submitted vault suggestions captured by `.claude/skills/vault-inbox/`.

`/extract` processes AUTHORITATIVE content (datasheets, standards) first per T15 ranking. User-suggested stubs get a **lower priority class** than agent-detected gaps in `ops/queue/gap-stubs.md`, unless `unblocks:` in the stub frontmatter points at a pending plan.

Weekly moderation pass: review new rows, either promote to real extract pipeline or archive as spam.

Managed by skill `.claude/skills/vault-inbox/SKILL.md`.

| timestamp | topic | slug | submitter | origin_slug | surface | inbox_path | status |
|-----------|-------|------|-----------|-------------|---------|------------|--------|
EOF
fi

ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

# Escape pipes in user-provided fields to avoid breaking the table
esc() { printf '%s' "$1" | sed 's/|/\\|/g'; }

printf "| %s | %s | %s | %s | %s | %s | %s | %s |\n" \
  "$ts" \
  "$(esc "$topic")" \
  "$(esc "$slug")" \
  "$(esc "$submitter")" \
  "$(esc "$origin_slug")" \
  "$(esc "$surface")" \
  "$(esc "$inbox_path")" \
  "$(esc "$status")" \
  >> "$queue_file"

echo "Queued user suggestion: $slug by $submitter → $queue_file"
