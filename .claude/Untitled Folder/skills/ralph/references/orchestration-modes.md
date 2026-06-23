# Ralph Orchestration Modes — Rationale, Architecture, and Report Templates

Deep explanations and output examples for /ralph. The executable mechanics (queue schema, phase_order null-handling, spawn-prompt templates, handoff parser contract) live in SKILL.md — this file carries the WHY and the long-form report formats.

## Why Subagent Spawning Is Not Optional (full rationale)

The entire architecture depends on fresh context isolation per phase. Executing tasks inline in the lead session:
- Contaminates context (later tasks run on degraded attention)
- Skips the handoff protocol (learnings are not captured)
- Violates the ralph pattern (one phase per context window)

This is not a suggestion. This is not an optimization you can skip for "simple" tasks. If you catch yourself about to execute a task directly instead of spawning a subagent, STOP. Call the Task tool. Every time. For every task. Including create tasks. Including "simple" tasks.

The lead session's ONLY job is: read queue, spawn subagent, evaluate return, update queue, repeat.

## Subagent Model Inheritance (why no per-phase model overrides)

Subagents inherit the session model. Users running opus get opus quality on processing phases. Users running sonnet get sonnet everywhere. Fresh context per phase already ensures efficiency — every phase gets full capability in the smart zone.

## Dry-Run Report Template (`--dry-run`)

Show this and STOP (do not process):

```
--=={ ralph dry-run }==--

Queue: X total tasks (Y pending, Z done)

Phase distribution:
  Claims:       {create: N, reflect: N, reweave: N, verify: N}
  Enrichments:  {enrich: N, reflect: N, reweave: N, verify: N}

Next tasks to process:
1. {id} — phase: {current_phase} — {target}
2. {id} — phase: {current_phase} — {target}
...

Estimated: ~{N} subagent spawns
```

## Parallel Mode Architecture (`--parallel`)

**Two-phase design:** Workers receive sibling claim info upfront so they can link proactively. Phase B validates and catches any gaps.

```
Ralph Lead (you) — orchestration only
|
+-- PHASE A: PARALLEL CLAIM PROCESSING (concurrent)
|   +-- worker-001: all 4 phases for claim 001 (with sibling awareness)
|   +-- worker-002: all 4 phases for claim 002 (with sibling awareness)
|   +-- worker-003: all 4 phases for claim 003 (with sibling awareness)
|   +-- ...up to 5 concurrent workers
|
+-- [semantic search index sync]
|
+-- PHASE B: CROSS-CONNECT VALIDATION (one subagent, one pass)
|   +-- validates sibling links, adds any that workers missed
|
+-- CLEANUP + FINAL REPORT
```

**Why two phases?** Workers have sibling awareness (claim titles in spawn prompt) and link proactively during reflect/revisit. But timing means some sibling notes may not exist yet during a worker's reflect phase. Phase B runs a single cross-connect pass after all notes exist.

**Why cap at 5 workers, not 6?** The lead session itself counts against the project-wide cap of 6 total agents.

**Why --parallel and --type are incompatible:** Parallel mode processes claims end-to-end (all phases). Per-phase filtering only makes sense in serial mode. Error message to emit:

```
ERROR: --parallel and --type are incompatible. Parallel processes full claim pipelines, not individual phases.
Use serial mode for per-phase filtering: /ralph N --type reflect
```

## Per-Task Selection Report (serial mode, Step 4a)

```
=== Processing task {i}/{N}: {id} — phase: {current_phase} ===
Target: {target}
File: {file}
```

## Parallel Mode Startup Report (Step 6a)

```
=== Parallel Mode ===
Parallelizable claims: {count}
Max concurrent workers: {min(count, N, 5)}
```

## Worker Completion Gate Tracking (Step 6c)

Phase B CANNOT start until ALL spawned workers have reported back (either success or error). Track completions:

```
Workers spawned: {total_spawned}
Workers completed: {completion_count}
Workers with errors: {error_count}

Phase B ready: {completion_count + error_count == total_spawned}
```

Do NOT proceed to Phase B while any worker is still running.

## Error Recovery (full detail)

**Subagent crash mid-phase:** The queue still shows `current_phase` at the failed phase. The task file confirms the corresponding section is empty. Re-running `/ralph` picks it up automatically — the task is still pending at that phase.

**Queue corruption:** If the queue file is malformed, report the error and stop. Do NOT attempt to fix it automatically.

**All tasks blocked:** Report which tasks are blocked and why. Suggest remediation.

**Empty queue:** Report "Queue is empty. Use /seed or /pipeline to add sources."

## Per-Task Progress Report (serial mode, after each task)

```
=== Task {id} complete ({i}/{N}) ===
Phase: {current_phase} -> {next_phase or "done"}
```

If learnings were captured, show a brief summary. If more unblocked tasks exist, show the next one.

## Cross-Connect Completion Report (after Phase B)

```
=== Cross-Connect Validation Complete ===
Sibling connections validated: {count}
Missing connections added: {count}
```

## Final Report Template (Step 7)

```
--=={ ralph }==--

Processed: {count} tasks
  {breakdown by phase type}

Subagents spawned: {count} (MUST equal tasks processed)

Learnings captured:
  {list any friction, surprises, methodology insights, or "None"}

Queue state:
  Pending: {count}
  Done: {count}
  Phase distribution: {create: N, reflect: N, reweave: N, verify: N}

Next steps:
  {if more pending tasks}: Run /ralph {remaining} to continue
  {if batch complete}: Archive the batch using the inline archive procedure in the pipeline skill (Phase 5): move task files to ops/queue/archive/{date}-{batch-id}/, write {batch-id}-summary.md, mark queue entries archived
  {if queue empty}: All tasks processed
```

**Verification:** The "Subagents spawned" count MUST equal "Tasks processed." If it does not, the lead executed tasks inline — this is a process violation. Report it as an error.
