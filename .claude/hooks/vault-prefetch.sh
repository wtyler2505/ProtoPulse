#!/usr/bin/env bash
# vault-prefetch.sh — SessionStart hook for context-aware vault pre-fetch.
#
# Runs T14 /vault-prefetch on session start. Async-safe; won't block the session.
# Hook entry: .claude/settings.json → hooks.SessionStart with async:true, timeout:30.
#
# Environment: $CLAUDE_PROJECT_DIR is set by Claude Code. Falls back to git root.

set -euo pipefail

# Resolve repo root
if [[ -n "${CLAUDE_PROJECT_DIR:-}" ]] && [[ -d "$CLAUDE_PROJECT_DIR" ]]; then
  cd "$CLAUDE_PROJECT_DIR"
else
  cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
fi

# Skip silently if the skill isn't present (e.g. fresh clone)
SCRIPT=".claude/skills/vault-prefetch/scripts/prefetch.py"
if [[ ! -f "$SCRIPT" ]]; then
  exit 0
fi

# Run prefetch; keep output short (hook runs in parallel; too much stdout pollutes)
python3 "$SCRIPT" 2>&1 | head -3 || true

exit 0
