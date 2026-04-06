#!/usr/bin/env bash
# dangerous-bash-guard.sh — PreToolUse hook for Bash
# Catches dangerous commands that pattern-matching in permissions can miss.
# Uses exit code 2 to block, exit 0 to allow.

set -euo pipefail

# Read the command from tool input via stdin
INPUT=$(cat)
COMMAND=$(echo "$INPUT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('tool_input',{}).get('command',''))" 2>/dev/null || echo "")

[ -z "$COMMAND" ] && { echo "{}"; exit 0; }

# Block destructive operations without explicit paths
case "$COMMAND" in
  *"rm -rf /"*|*"rm -rf ~"*|*"rm -rf \$HOME"*)
    echo '{"decision": "block", "reason": "Blocked: recursive delete of root or home directory"}' >&2
    exit 2
    ;;
  *"git push --force"*main*|*"git push -f"*main*)
    echo '{"decision": "block", "reason": "Blocked: force push to main branch. Use a feature branch."}' >&2
    exit 2
    ;;
  *"git reset --hard"*|*"git clean -fd"*)
    echo '{"decision": "block", "reason": "Blocked: destructive git operation. Consider git stash instead."}' >&2
    exit 2
    ;;
  *"DROP DATABASE"*|*"DROP TABLE"*|*"TRUNCATE"*)
    echo '{"decision": "block", "reason": "Blocked: destructive database operation detected."}' >&2
    exit 2
    ;;
esac

exit 0
