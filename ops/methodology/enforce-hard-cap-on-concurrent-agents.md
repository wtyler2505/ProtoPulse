---
description: Never spawn more than 6 agents or 8 background tasks simultaneously — hard cap to prevent freezing the machine
type: methodology
category: behavior
source: session-mining
session_source: c5fc7f99-1c39-4eb0-9cea-9a036e51dba9.jsonl
created: 2026-04-06
status: active
---

# Enforce a hard cap of 6 simultaneous agents and 8 background tasks

## What to Do

Before spawning any agent or background task, count how many are currently active. If the total would exceed 6 concurrent agents OR 8 total background tasks, hold off and wait for some to complete before launching more.

Scale the caps DOWN further based on work complexity:
- Heavy computation (TS compile, test runs, large builds): cap at 4 agents / 6 tasks
- Light research/read-only work: up to 6 agents / 8 tasks is acceptable
- When uncertain, default to the lower bound

## What to Avoid

Spawning 10, 12, or more agents at once because the work is theoretically parallelizable. Never prioritize theoretical throughput over hardware reality. Do not assume the machine can handle maximum concurrency just because the task list is long.

## Why This Matters

Tyler's machine froze completely when 12+ agents were spawned simultaneously. This blocks all work and wastes more time than sequential execution would have. A frozen computer is strictly worse than a slower but stable one.

Direct quote: "Can't start 12 fucking agents at the same time... hard cap at 8 background tasks | 6 agents working simultaneously and/or parallel... and those hard caps need to be lowered depending on the amount of work being done and complexity."

## Scope

Always. No exception unless Tyler explicitly gives the go-ahead for a higher count for a specific session.

---

Related: [[methodology]], [[use-agent-teams-not-raw-parallel-subagents-for-implementation]]
