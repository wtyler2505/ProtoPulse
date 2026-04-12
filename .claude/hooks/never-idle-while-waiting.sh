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

# Background task detected — inject the rule + safe/unsafe guardrails.
# Message is compact to minimize context bloat but complete enough to be actionable.
cat <<'EOF'
{"systemMessage": "BACKGROUND TASK RUNNING — DO NOT SIT IDLE. Find independent productive work. SAFE DURING WAIT: (1) Read/Grep/Glob any file; (2) Research via Context7, WebSearch, WebFetch; (3) Write NEW files in docs/ (except the active plan), knowledge/, ops/observations/, ops/queue/, ops/methodology/, reports/; (4) Append to README/CHANGELOG/docs that are NOT an active task; (5) TaskCreate/TaskUpdate/TaskList (internal state); (6) Run read-only gap-analysis scripts in ops/queries/; (7) Draft the NEXT phase in a NEW scratch file; (8) Plan/research upcoming work without touching source. UNSAFE — NEVER during wait: (a) Edit/MultiEdit/Write ANY file in client/, server/, shared/, .claude/hooks/, .claude/settings.json, schema.ts, package.json, package-lock.json, tsconfig.json, drizzle.config.ts, vite.config.ts, .env*, .mcp.json; (b) Edit the active plan file being executed (READ OK, EDIT NO); (c) npm install/update/ci, npm run build, db:push, any migration; (d) git commit/push/reset/rebase/merge/stash pop/cherry-pick — anything that touches the working tree or git state; (e) Spawn NEW background tasks or agent-teams (hard cap: max 6 agents + 8 background total, and resource collision risk); (f) Kill/restart processes (kill/pkill/lsof); (g) prettier --write or eslint --fix on any file; (h) Run another test suite concurrently (DB state collision); (i) Modify ops/sessions/ checkpoints, data/metrics.json, or anything in .claude/. IF IN DOUBT: READ don't WRITE. Ask 'could this collide with the running task?' — if yes, skip it. 'Blocked on <specific thing>' in one sentence is acceptable. Silent idle is NOT. Reference: feedback_never_idle_while_waiting.md + ops/methodology/never-sit-idle-while-subagents-or-teammates-are-running.md."}
EOF

exit 0
