#!/usr/bin/env bash
# never-idle-while-waiting.sh — PostToolUse hook for Bash + Agent.
#
# When a background task is spawned (run_in_background: true), inject a system
# message into Claude's context forcing it to find productive parallel work
# instead of sitting idle. The message includes a DURATION CLASSIFICATION so
# Claude can pick work sized appropriately for the wait:
#
#   SHORT  (< 1 min)  → micro-work: reads, quick lookups, single scratch draft
#   MEDIUM (1–5 min)  → focused work: 1 knowledge note, next-phase prep, research
#   LONG   (5 min+)   → substantive work: full docs, plan drafting, gap analysis
#
# Rule origin: Tyler's "coming to Jesus meeting" (2026-04-11) after multiple
# sessions where Claude went idle. Duration tier added 2026-04-11 (same day)
# after the first iteration showed tier-less recommendations were too generic
# to drive smart decisions — wasted context on big-work during 30s tsc runs,
# and under-used 10-min test suites by doing nothing.

set -uo pipefail

INPUT=$(cat)

# Extract tool_name, run_in_background, and command via a dedicated python
# helper. Output is 3 lines: tool name, rib flag, command.
PARSE_SCRIPT='
import sys, json
try:
    d = json.load(sys.stdin)
    tool = d.get("tool_name", "Unknown") or "Unknown"
    ti = d.get("tool_input", {}) or {}
    rib = "True" if ti.get("run_in_background") else "False"
    cmd = ti.get("command", "") or ""
    print(tool)
    print(rib)
    print(cmd)
except Exception:
    print("Unknown")
    print("False")
    print("")
'

PARSED="$(echo "$INPUT" | python3 -c "$PARSE_SCRIPT" 2>/dev/null)"
TOOL_NAME="$(echo "$PARSED" | sed -n '1p')"
RIB="$(echo "$PARSED" | sed -n '2p')"
COMMAND="$(echo "$PARSED" | sed -n '3,$p')"

if [ "${RIB:-False}" != "True" ]; then
  echo '{}'
  exit 0
fi

# ---------------------------------------------------------------------------
# Duration classifier
# ---------------------------------------------------------------------------
# Returns one of: SHORT / MEDIUM / LONG (falls through to MEDIUM as default).
# Also sets ESTIMATE (human-readable) and CATEGORY (what kind of task).

TIER=""
ESTIMATE=""
CATEGORY=""

classify() {
  local cmd_lower
  cmd_lower="$(echo "$COMMAND" | tr '[:upper:]' '[:lower:]')"

  # ---- LONG (5 min+) ----
  if echo "$cmd_lower" | grep -Eq 'npm (run )?test( |$)' && ! echo "$cmd_lower" | grep -Eq -- '(--project|__tests__/|test:watch|test:coverage)'; then
    TIER="LONG"; ESTIMATE="~10-15 min"; CATEGORY="full test suite (server + client)"; return
  fi
  if echo "$cmd_lower" | grep -Eq 'vitest run' && ! echo "$cmd_lower" | grep -Eq -- '(--project|__tests__/|\.test\.ts)'; then
    TIER="LONG"; ESTIMATE="~10-15 min"; CATEGORY="full vitest run (unfiltered)"; return
  fi
  if echo "$cmd_lower" | grep -Eq 'npm (run )?build'; then
    TIER="LONG"; ESTIMATE="~5-8 min"; CATEGORY="production build"; return
  fi
  if echo "$cmd_lower" | grep -Eq 'test:coverage'; then
    TIER="LONG"; ESTIMATE="~15 min+"; CATEGORY="test coverage"; return
  fi
  if [ "$TOOL_NAME" = "Agent" ]; then
    TIER="LONG"; ESTIMATE="~3-10 min"; CATEGORY="subagent (duration depends on prompt)"; return
  fi

  # ---- MEDIUM (1-5 min) ----
  if echo "$cmd_lower" | grep -Eq -- '--project server'; then
    TIER="MEDIUM"; ESTIMATE="~2-3 min"; CATEGORY="server test project"; return
  fi
  if echo "$cmd_lower" | grep -Eq -- '--project client'; then
    TIER="MEDIUM"; ESTIMATE="~2-4 min"; CATEGORY="client test project"; return
  fi
  if echo "$cmd_lower" | grep -Eq 'db:push|drizzle.*push'; then
    TIER="MEDIUM"; ESTIMATE="~30s-2 min"; CATEGORY="drizzle schema push"; return
  fi
  if echo "$cmd_lower" | grep -Eq 'vitest.*\.test\.ts.*\.test\.ts'; then
    TIER="MEDIUM"; ESTIMATE="~1-2 min"; CATEGORY="multi-file test run"; return
  fi
  if echo "$cmd_lower" | grep -Eq 'playwright|test:e2e'; then
    TIER="MEDIUM"; ESTIMATE="~2-5 min"; CATEGORY="playwright / e2e"; return
  fi

  # ---- SHORT (< 1 min) ----
  if echo "$cmd_lower" | grep -Eq 'vitest.*__tests__/.*\.test\.ts'; then
    TIER="SHORT"; ESTIMATE="~5-30s"; CATEGORY="single test file"; return
  fi
  if echo "$cmd_lower" | grep -Eq 'npm (run )?check' || echo "$cmd_lower" | grep -Eq 'tsc ' || echo "$cmd_lower" | grep -Eq 'tsc$'; then
    TIER="SHORT"; ESTIMATE="~30-60s"; CATEGORY="TypeScript check"; return
  fi
  if echo "$cmd_lower" | grep -Eq 'eslint|npm (run )?lint|prettier.*--check'; then
    TIER="SHORT"; ESTIMATE="~10-30s"; CATEGORY="lint / format check"; return
  fi
  if echo "$cmd_lower" | grep -Eq '^(git|ls|find|grep|wc|cat|tail|head) '; then
    TIER="SHORT"; ESTIMATE="~1-5s"; CATEGORY="simple fs/git op"; return
  fi

  # ---- Unclassified fallback ----
  TIER="MEDIUM"
  ESTIMATE="unknown"
  CATEGORY="unclassified background task — assume MEDIUM until proven otherwise"
}

classify

# ---------------------------------------------------------------------------
# Tier-specific recommendations
# ---------------------------------------------------------------------------

case "$TIER" in
  SHORT)
    RECOMMEND="SHORT wait — micro-work only. Pick ONE: (a) Read/Grep one file for upcoming phase, (b) check git status/log, (c) draft 1-2 sentences of a next-phase scratch note. Do NOT start writing a knowledge note or plan section — you will be interrupted mid-draft. If you genuinely have nothing sub-30s to do, say 'waiting on <estimate>' in one sentence and wait."
    ;;
  MEDIUM)
    RECOMMEND="MEDIUM wait — focused work sized to finish in $ESTIMATE. Pick ONE substantial item: (a) write ONE knowledge note about what you just built, (b) draft the next phase in a NEW scratch file, (c) read all relevant source files for Phase N+1 so you can start immediately when this completes, (d) run ONE read-only gap-analysis script and summarize, (e) research via Context7/WebSearch for upcoming work. Do NOT start a 10-minute research arc or multi-file plan."
    ;;
  LONG)
    RECOMMEND="LONG wait — substantive work. Pick multiple items or one big one: (a) write full knowledge notes for every non-trivial change in the current phase, (b) draft the next phase plan from scratch with file lists and TDD tasks, (c) deep research arc via Context7 + WebSearch on upcoming tech, (d) Improvements Radar on every file you touched this phase, (e) run gap-analysis.sh + competitive-gaps.sh + idea-generator.sh and synthesize into a queue note, (f) review recent commits for cleanup opportunities. You have real time — use it."
    ;;
esac

# ---------------------------------------------------------------------------
# Shared safe/unsafe guardrails (compacted)
# ---------------------------------------------------------------------------

SAFE="SAFE: Read/Grep/Glob any file; Context7/WebSearch/WebFetch; write NEW files in docs/ (not active plan), knowledge/, ops/observations/, ops/queue/, ops/methodology/, reports/; TaskCreate/TaskUpdate/TaskList; read-only gap-analysis scripts in ops/queries/."

UNSAFE="UNSAFE: Edit/Write anything in client/, server/, shared/, .claude/, or build configs (schema.ts, package.json, tsconfig.json, drizzle.config.ts, vite.config.ts, dotenv files, .mcp.json); edit the active plan; npm install/build/db:push/migrations; git commit/push/reset/rebase/merge/stash pop/cherry-pick/checkout/clean; spawn NEW background tasks or agent-teams (resource collision + hard cap 6 agents / 8 total); kill/restart processes; prettier --write / eslint --fix; concurrent test suites; modify workspace state (data/metrics.json, ops/sessions/, dist/, coverage/)."

# ---------------------------------------------------------------------------
# Emit JSON systemMessage via python3 (safer escaping than shell printf)
# ---------------------------------------------------------------------------

export TIER ESTIMATE CATEGORY RECOMMEND SAFE UNSAFE

python3 <<'PY'
import json, os
msg_parts = [
    f"BACKGROUND TASK STARTED ({os.environ['TIER']}, est {os.environ['ESTIMATE']}) — {os.environ['CATEGORY']}. DO NOT SIT IDLE. {os.environ['RECOMMEND']}",
    "",
    os.environ['SAFE'],
    "",
    os.environ['UNSAFE'],
    "",
    "Rule of thumb: READ don't WRITE. 'Blocked on <specific thing>' in one sentence is acceptable — silent idle is NOT. Full guardrails: memory/feedback_never_idle_while_waiting.md + ops/methodology/never-sit-idle-while-subagents-or-teammates-are-running.md.",
]
print(json.dumps({"systemMessage": "\n".join(msg_parts)}))
PY

exit 0
