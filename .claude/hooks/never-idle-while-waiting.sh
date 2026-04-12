#!/usr/bin/env bash
# never-idle-while-waiting.sh — PostToolUse hook for Bash + Agent.
#
# When a background task is spawned (run_in_background: true), inject a
# system message into Claude's context forcing it to find productive parallel
# work instead of sitting idle waiting for the task to finish.
#
# Rule origin: Tyler's "coming to Jesus meeting" (2026-04-11) after multiple
# sessions where Claude went idle while tests/agents were running. Reference
# docs and memory files weren't enough — runtime enforcement via hook.
#
# Also fires on Agent(run_in_background=true) — same failure mode.

set -uo pipefail

INPUT=$(cat)

# Extract run_in_background flag from tool_input. Returns "True" or "False".
RIB=$(echo "$INPUT" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    ti = d.get('tool_input', {}) or {}
    print('True' if ti.get('run_in_background') else 'False')
except Exception:
    print('False')
" 2>/dev/null || echo "False")

if [ "$RIB" != "True" ]; then
  echo '{}'
  exit 0
fi

# Background task detected — inject the rule.
cat <<'EOF'
{"systemMessage": "BACKGROUND TASK STARTED — DO NOT SIT IDLE. Tyler's absolute rule (reinforced 2026-04-11): while a background task runs, you MUST find independent productive work to progress in parallel. Options (in order of preference): (1) write/update docs or knowledge notes about what you just built, (2) draft the next phase plan or commit messages, (3) research via Context7 or WebSearch for upcoming work, (4) read ahead in the current plan to surface risks, (5) run gap-analysis scripts in ops/queries/, (6) Improvements Radar on files you just touched, (7) write test stubs or scaffolding for the next phase, (8) verify assumptions the upcoming phase depends on. Only wait silently if (a) you genuinely have nothing independent AND (b) context budget is already tight. Say 'blocked on <specific thing>' in one sentence — blocked is acceptable, idle is NOT. Reference: memory/feedback_never_idle_while_waiting.md and ops/methodology/never-sit-idle-while-subagents-or-teammates-are-running.md."}
EOF

exit 0
