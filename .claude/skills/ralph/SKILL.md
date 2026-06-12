---
name: ralph
description: Queue processing with fresh context per phase. Processes N tasks from the queue, spawning isolated subagents to prevent context contamination. Supports serial, parallel, batch filter, and dry run modes. Triggers on "/ralph", "/ralph N", "process queue", "run pipeline tasks".
version: "1.0"
generated_from: "arscontexta-v1.6"
user-invocable: true
context: fork
allowed-tools: Read, Write, Edit, Grep, Glob, Bash, Task
argument-hint: "N [--parallel] [--batch id] [--type extract] [--dry-run] — N = number of tasks to process"
---

## EXECUTE NOW

**Target: $ARGUMENTS**

Parse arguments:
- N (required unless --dry-run): number of tasks to process
- --parallel: concurrent claim workers, max 5 (within the project-wide cap of 6 total agents) + cross-connect validation
- --batch [id]: process only tasks from specific batch
- --type [type]: process only tasks at a specific phase (extract, create, reflect, reweave, verify, enrich)
- --dry-run: show what would execute without running
- --handoff: output structured RALPH HANDOFF block at end (for pipeline chaining)

**Step 0: Read Vocabulary.** Read `ops/derivation-manifest.md` (or fall back to `ops/derivation.md`) for domain vocabulary mapping. All output must use domain-native terms. If neither file exists, use universal terms.

**START NOW.** Process queue tasks. Deep guidance (mode rationale, architecture, report templates): references/orchestration-modes.md

## MANDATORY CONSTRAINT: SUBAGENT SPAWNING IS NOT OPTIONAL

**You MUST use the Task tool to spawn a subagent for EVERY task. No exceptions** — not for "simple" tasks, not for create tasks, not as an "optimization". Fresh context isolation per phase is the architecture: inline execution contaminates context, skips the handoff protocol, and violates the ralph pattern (one phase per context window). If you catch yourself about to execute a task directly, STOP and call the Task tool. The lead session's ONLY job: read queue, spawn subagent, evaluate return, update queue, repeat. (Full rationale: references/orchestration-modes.md)

## Phase Configuration

Each phase maps to specific Task tool parameters. Use these EXACTLY when spawning subagents.

| Phase | Skill Invoked | Purpose |
|-------|---------------|---------|
| extract | /extract | Extract claims from source material |
| create | (inline note creation) | Write the insight file |
| enrich | task-file instructions (/enrich wraps this) | Add content to existing insight |
| reflect | /connect | Find connections, update topic maps |
| reweave | /revisit | Update older insights with new connections |
| verify | /verify | Description quality + schema + health checks |

All phases use the same subagent configuration: `subagent_type: general-purpose`, `mode: dontAsk`. Subagents inherit the session model (no per-phase overrides — see references/orchestration-modes.md).

## Step 1: Read Queue State

Read `ops/queue/queue.json`. Parse it. Identify ALL pending tasks.

**phase_order null-handling (REQUIRED):** If the queue header's `phase_order` is null or missing, use these defaults AND repair the header before processing:

```bash
jq '.phase_order = {"claim": ["create","reflect","reweave","verify"], "enrichment": ["enrich","reflect","reweave","verify"]}' \
  ops/queue/queue.json > tmp.json && mv tmp.json ops/queue/queue.json
```

These defaults match the machine phase names stored in task `current_phase` / `completed_phases` fields. Never proceed with a null `phase_order` — phase progression (Step 4e) dereferences it.

**Queue structure (v2 schema)** — `current_phase` and `completed_phases` per task entry:

```yaml
phase_order:
  claim: [create, reflect, reweave, verify]
  enrichment: [enrich, reflect, reweave, verify]

tasks:
  - id: source-name
    type: extract
    status: pending
    source: ops/queue/archive/2026-01-30-source/source.md
    file: source-name.md
    created: "2026-01-30T10:00:00Z"

  - id: claim-010
    type: claim
    status: pending
    target: "claim title here"
    batch: source-name
    file: source-name-010.md
    current_phase: reflect
    completed_phases: [create]
```

If the queue file does not exist or is empty, report: "Queue is empty. Use /seed or /pipeline to add sources."

## Step 2: Filter Tasks

Build a list of **actionable tasks** — `status == "pending"`, ordered by position in the tasks array (first = highest priority). Apply filters: `--batch` keeps only matching `batch`; `--type` keeps only tasks whose `current_phase` matches (e.g., `--type reflect` finds tasks at "reflect"). The `phase_order` header defines the sequences: `claim`: create -> reflect -> reweave -> verify; `enrichment`: enrich -> reflect -> reweave -> verify.

## Step 3: If --dry-run, Report and Stop

Show the dry-run report (queue totals, phase distribution, next tasks, estimated subagent spawns) and STOP — do not process. Template: references/orchestration-modes.md §Dry-Run Report Template.

## Step 4: Process Loop (SERIAL MODE)

**If `--parallel` is set, skip to Step 6 instead.** Process up to N tasks (default 1). For each iteration:

### 4a. Select Next Task

Pick the first pending task from the filtered list. Read its metadata: `id`, `type`, `file`, `target`, `batch`, `current_phase`, `completed_phases`. The `current_phase` determines which skill to invoke. Report the task-selection header (template: references/orchestration-modes.md).

### 4b. Build Subagent Prompt

Construct a prompt based on `current_phase`. Every prompt MUST include: the task file path (from queue's `file` field), the task identity (id, current_phase, target), the skill to invoke with `--handoff`, the `ONE PHASE ONLY` constraint, and the instruction to output a RALPH HANDOFF block.

For **extract** phase (type=extract tasks only):
```
Read the task file at ops/queue/{FILE} for context.

You are processing task {ID} from the work queue.
Phase: extract | Target: {TARGET}

Run /extract --handoff on the source file referenced in the task file.
After extraction: create per-claim task files, update the queue with new entries
(1 entry per claim with current_phase/completed_phases), output RALPH HANDOFF.
ONE PHASE ONLY. Do NOT run reflect or other phases.
```

For **create** phase:
```
Read the task file at ops/queue/{FILE} for context.

You are processing task {ID} from the work queue.
Phase: create | Target claim: {TARGET}

Create an insight for this claim in knowledge/[claim as sentence].md
Follow note design patterns:
- YAML frontmatter with description (adds info beyond title), topics
- Body: 150-400 words showing reasoning with connective words
- Footer: Source (wiki link), Relevant Notes (with context), Topics
Update the task file's ## Create section.
ONE PHASE ONLY. Do NOT run reflect.
```

For **enrich** phase:
```
Read the enrichment task file at ops/queue/{FILE} and follow its embedded
instructions: the frontmatter names the target_note and the addition; the
## Reduce Notes section explains what to add and why. Load the target note
from knowledge/, add the enrichment content, then fill the task file's
## Enrich section with what was done. Output RALPH HANDOFF.
(The /enrich skill at .claude/skills/enrich/SKILL.md wraps this workflow —
invoke /enrich --handoff ops/queue/{FILE} if the Skill tool is available.)
ONE PHASE ONLY. Do NOT run reflect.
```

For **reflect** phase — first **build sibling list**: query the queue for other claims in the same batch where `completed_phases` includes "create" (note already exists). Format as wiki links.
```
Read the task file at ops/queue/{FILE} for context.

You are processing task {ID} from the work queue.
Phase: reflect | Target: {TARGET}

OTHER CLAIMS FROM THIS BATCH (check connections to these alongside regular discovery):
{for each sibling in batch where completed_phases includes "create":}
- [[{SIBLING_TARGET}]]
{end for, or "None yet" if this is the first claim}

Run /connect --handoff on: {TARGET}
Use dual discovery: topic map exploration AND semantic search.
Add inline links where genuine connections exist — including sibling claims listed above.
Update relevant topic map with this insight.
ONE PHASE ONLY. Do NOT run reweave.
```

For **reweave** phase — **same sibling list** as reflect (re-query queue for freshest state):
```
Read the task file at ops/queue/{FILE} for context.

You are processing task {ID} from the work queue.
Phase: reweave | Target: {TARGET}

OTHER CLAIMS FROM THIS BATCH:
{for each sibling in batch where completed_phases includes "create":}
- [[{SIBLING_TARGET}]]
{end for}

Run /revisit --handoff for: {TARGET}
This is the BACKWARD pass. Find OLDER insights AND sibling claims
that should reference this insight but don't.
Add inline links FROM older insights TO this insight.
ONE PHASE ONLY. Do NOT run verify.
```

For **verify** phase:
```
Read the task file at ops/queue/{FILE} for context.

You are processing task {ID} from the work queue.
Phase: verify | Target: {TARGET}

Run /verify --handoff on: {TARGET}
Combined verification: recite (cold-read prediction test), validate (schema check),
review (per-note health).
IMPORTANT: Recite runs FIRST — read only title+description, predict content,
THEN read full insight.
Final phase for this claim. ONE PHASE ONLY.
```

### 4c. Spawn Subagent (MANDATORY — NEVER SKIP)

```
Task(
  prompt = {the constructed prompt from 4b},
  description = "{current_phase}: {short target}" (5 words max)
)
```

**REPEAT: You MUST call the Task tool here.** Do NOT execute the prompt yourself. Do NOT "optimize" by running the task inline. The Task tool call is the ONLY acceptable action at this step. Wait for the subagent to complete and capture its return value.

### 4d. Evaluate Return

1. **Look for RALPH HANDOFF block** — search for `=== RALPH HANDOFF` and `=== END HANDOFF ===` markers
2. **If handoff found:** Parse the Work Done, Learnings, and Queue Updates sections
3. **If handoff missing:** Log a warning but continue — the work was still completed
4. **Capture learnings:** If Learnings section has non-NONE entries, note them for the final report

### 4e. Update Queue (Phase Progression)

Look up `phase_order` from the queue header. Find `current_phase` in the array. **If NOT the last phase:** set `current_phase` to the next phase in the sequence, append the completed phase to `completed_phases`. **If the last phase** (verify): set `status: done`, set `completed` to current UTC timestamp, set `current_phase` to null, append the completed phase to `completed_phases`.

**For extract tasks ONLY:** Re-read the queue after marking done. The reduce skill writes new task entries (1 entry per claim/enrichment with `current_phase`/`completed_phases`) to the queue during execution. The lead must pick these up for subsequent iterations.

### 4f. Report Progress, then 4g. Re-filter Tasks

Show the per-task progress report (template: references/orchestration-modes.md): task id, phase transition, captured learnings, next task if any. Then, before the next iteration, re-read the queue and re-filter tasks — phase advancement may have changed eligibility (e.g., after a `create` phase completes, the task is now at `reflect`; under `--type reflect` it becomes eligible).

## Step 5: Post-Batch Cross-Connect (Serial Mode)

After advancing a task to "done" (Step 4e), check if ALL tasks in that batch now have `status: "done"`. If yes and the batch has 2+ completed claims:

1. **Collect all note paths**: for each claim task with `status: "done"`, read the task file's `## Create` section to find the created note path.
2. **Spawn ONE subagent** for cross-connect validation, using the cross-connect prompt template in Step 6d (list ALL note titles + paths from completed batch tasks).
3. **Parse handoff block**, capture learnings, include cross-connect results in the final report.

**Skip if:** batch has only 1 claim (no siblings) or tasks from the batch are still pending.

## Step 6: Parallel Mode (--parallel)

**When `--parallel` is present, SKIP Step 4 entirely.** Two-phase design: Phase A spawns concurrent claim workers with sibling awareness; Phase B runs one cross-connect validation pass after all notes exist. Architecture diagram and rationale: references/orchestration-modes.md.

**Incompatible flags:** `--parallel` cannot be combined with `--type`. If both are set, report the incompatibility error (exact message: references/orchestration-modes.md) and stop.

### 6a. Identify Parallelizable Claims

From the filtered queue, find pending claims (`status == "pending"`). Cap at 5 concurrent workers (or N, whichever is smaller) — 5, not 6, because the lead session itself counts against the project-wide cap of 6 total agents. Report the parallel-mode startup header (template: references/orchestration-modes.md).

### 6b. Spawn Claim Workers

For each parallelizable claim (up to N requested, max 5 concurrent), build the worker prompt with sibling awareness:

```
You are a claim worker processing claim "{TARGET}" from batch "{BATCH}".

Claim ID: {CLAIM_ID}
Task file: ops/queue/{FILE}
Current phase: {CURRENT_PHASE}
Completed phases: {COMPLETED_PHASES}

SIBLING CLAIMS IN THIS BATCH (link to these where genuine connections exist):
{for each other claim in the batch:}
- "{SIBLING_TARGET}" (task file: ops/queue/{SIBLING_FILE})
{end for}

During REFLECT and REWEAVE, check if your claim genuinely connects to any sibling.
If a sibling insight exists in knowledge/, link to it inline where the
connection is real. If it does not exist yet (still being created), skip —
cross-connect will catch it after.

Read the task file for full context. Execute phases from current_phase onwards.
If completed_phases is not empty, skip those phases (resumption mode).

When complete, update the queue entry to status "done" and report the created
insight title, path, and claim ID. The lead needs this for cross-connect.
```

Spawn via `Task(prompt = {the constructed prompt}, description = "claim: {short target}" (5 words max))`. **Spawn workers in PARALLEL** — launch all Task tool calls in a single message, not sequentially.

### 6c. Monitor Workers (Phase A)

Wait for worker completions. As workers complete: parse the completion message (extract created note title and path — needed for Phase B), log learnings, check for issues (failures, skipped phases, resource conflicts). Maintain a list of `{note_title, note_path}` from worker completion messages.

**Completion gate:** Phase B CANNOT start until ALL spawned workers have reported back (success or error). Do NOT proceed while any worker is still running. Tracking template: references/orchestration-modes.md.

### 6d. Cross-Connect Validation (Phase B)

**Light validation pass** — workers linked proactively during Phase A; this validates and catches gaps. **Skip if only 1 claim was processed** (no siblings). Spawn ONE subagent:

```
Task(
  prompt = "You are running post-batch cross-connect validation for batch '{BATCH}'.

Notes created in this batch:
{list of ALL newly created note titles with paths from Phase A}

Verify sibling connections exist between these notes. Add any connections that
workers missed because sibling notes did not exist yet when a worker's reflect ran.
Check backward link gaps. Output RALPH HANDOFF block when done.",
  description = "cross-connect: batch {BATCH}"
)
```

Parse the handoff block, capture learnings. Report the cross-connect completion summary (template: references/orchestration-modes.md).

### 6e. Cleanup

After Phase B (or after Phase A if cross-connect was skipped): clean any lock files if created, then go to Step 7 for the final report, noting parallel mode in the output.

## Step 7: Final Report

After all iterations (or when no unblocked tasks remain), show the final report — processed count with phase breakdown, subagents spawned (MUST equal tasks processed; a mismatch means inline execution — a process violation to report as an error), learnings captured, queue state, next steps. Full template: references/orchestration-modes.md §Final Report Template.

If `--handoff` flag was set, also output:

```
=== RALPH HANDOFF: orchestration ===
Target: queue processing

Work Done:
- Processed {count} tasks: {list of task IDs}
- Types: {breakdown by type}

Learnings:
- [Friction]: {description} | NONE
- [Surprise]: {description} | NONE
- [Methodology]: {description} | NONE
- [Process gap]: {description} | NONE

Queue Updates:
- Marked done: {list of completed task IDs}
=== END HANDOFF ===
```

## Error Recovery

**Subagent crash mid-phase:** task is still pending at that phase — re-running `/ralph` picks it up automatically. **Queue corruption:** report and stop; never auto-fix. **All tasks blocked:** report which and why, suggest remediation. **Empty queue:** report "Queue is empty. Use /seed or /pipeline to add sources." Full detail: references/orchestration-modes.md §Error Recovery.

## Quality Gates

1. **Subagent Spawned** — every task MUST be processed via Task tool. If the lead detects it executed a task inline, log this as an error and flag it in the final report.
2. **Handoff Present** — every subagent SHOULD return a RALPH HANDOFF block. If missing: log warning, mark task done, continue.
3. **Extract Yield** — for extract tasks: if zero claims extracted, log as an observation. Do NOT retry automatically.
4. **Task File Updated** — after each phase, the task file's corresponding section (Create, Reflect, Reweave, Verify) should be filled. If empty after subagent completes, log warning.

## Critical Constraints

**Never:** execute tasks inline in the lead session (USE THE TASK TOOL); process more than one phase per subagent (context contamination); retry failed tasks automatically without human input; skip queue phase advancement (breaks pipeline state); process tasks that are not in pending status; run if queue file does not exist or is malformed; in parallel mode, combine with --type (incompatible).

**Always:** spawn a subagent via Task tool for EVERY task (the lead ONLY orchestrates); include sibling claim titles in reflect and reweave prompts; re-read queue after extract tasks (subagent adds new entries); re-filter tasks between iterations (phase advancement creates new eligibility); log learnings from handoff blocks; report failures clearly for human review; verify subagent count equals task count in final report.
