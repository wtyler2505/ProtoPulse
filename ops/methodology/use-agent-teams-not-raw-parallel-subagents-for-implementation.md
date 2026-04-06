---
description: Use /agent-teams for all parallel implementation work — never spawn raw parallel subagents without explicit permission
type: methodology
category: behavior
source: session-mining
session_source: c5fc7f99-1c39-4eb0-9cea-9a036e51dba9.jsonl
created: 2026-04-06
status: active
---

# Use /agent-teams for parallel implementation work, not raw parallel subagents

## What to Do

When parallel execution is needed for implementation tasks (writing code, modifying files, running builds), invoke `/agent-teams` with the teammate configuration. Let the team system coordinate agents via the shared task list, Shift+Up/Down navigation, and direct teammate messaging.

For read-only research or exploration, background subagents (via the Task tool with `run_in_background`) are acceptable.

## What to Avoid

Spawning multiple raw parallel subagents for implementation work without going through `/agent-teams`. This includes using the Task tool with `subagent_type: general-purpose` and `run_in_background: true` for anything that writes files or modifies state.

Never bypass `/agent-teams` to "save time" by launching bare parallel agents. Tyler sees this as the same violation regardless of the framing.

## Why This Matters

Tyler made this explicit and emphatic: "FOR NOW ON, /agent-teams shall be used unless oked by me to not do so when multiple agents are executed simultaneously... no more of that parallel shit! do you fucking hear me?"

The agent-teams system provides coordination, shared task visibility (Shift+Up/Down), file ownership enforcement, and teammate messaging. Raw parallel subagents bypass all of this, leading to file conflicts and uncoordinated work.

## Scope

All parallel implementation work. If Tyler explicitly says "go ahead and run them in parallel without teams" for a specific task, that overrides this rule for that task only.

---

Related: [[methodology]], [[enforce-hard-cap-on-concurrent-agents]]
