---
name: enrich
description: Process an enrichment task from ops/queue, adding depth, sources, or connections to an existing knowledge note. The task file carries its own instructions (target_note, addition, source_lines); this skill executes them. Triggers on "/enrich", "/enrich [task file]", or ralph's enrich phase.
user-invocable: true
allowed-tools: Read, Write, Edit, Grep, Glob, Bash
context: fork
---

## EXECUTE NOW

**Target: $ARGUMENTS**

Parse immediately:
- Task file path (`ops/queue/{batch}-NNN.md`) or task id (e.g., `enrich-016`) — resolve id to file via `jq -r '.tasks[] | select(.id=="ID") | .file' ops/queue/queue.json`
- `--handoff`: output RALPH HANDOFF block at end (for /ralph chaining)
- If target is empty: list pending enrichment tasks and ask which one:
  `jq -r '.tasks[] | select(.type=="enrichment" and .status=="pending") | "\(.id) \(.file)"' ops/queue/queue.json`

**START NOW.** The task file is the spec — follow its embedded instructions.

---

## Workflow

### Step 1: Read the Task File

Enrichment task files at `ops/queue/{batch}-NNN.md` are self-contained:

| Field | Meaning |
|-------|---------|
| `target_note` (frontmatter) | Wiki link to the existing knowledge note to enrich |
| `addition` (frontmatter) | One-sentence spec of WHAT to add |
| `source_task` (frontmatter) | Batch id — source lives in `ops/queue/archive/*-{source_task}/` |
| `source_lines` (frontmatter) | Line range in the archived source backing the addition |
| `## Reduce Notes` (body) | The full instructions: content to add, rationale, often code/tables |

### Step 2: Load the Target Note

Resolve `target_note` to `knowledge/{slug}.md` and read it fully. Understand the core claim — enrichment ADDS depth (evidence, tables, second use cases, mechanisms); it never changes what the note claims. If the addition needs more detail than Reduce Notes carries, read the cited `source_lines` from the archived source under `ops/queue/archive/`.

### Step 3: Enrich the Note

- Integrate the addition where it fits the note's argument — woven into the prose or as a clearly-scoped section, not blindly appended.
- Match the note's existing voice, schema, and formatting. Preserve frontmatter (update `description` only if the addition genuinely changes what a cold reader should expect).
- Add wiki links only where genuine connections exist — every link must pass the articulation test ("[[A]] connects because [specific reason]", see /connect). Verify each link target exists in knowledge/ before linking; forward-reference pending siblings only when the task file says they are queued.
- Do NOT run discovery, MOC updates, or backward passes — those are the reflect/reweave phases. ONE PHASE ONLY.

### Step 4: Update the Task File

Fill the task file's `## Enrich` section: what was added, where in the note it landed, any wiki links added, and date. Future phases (reflect, reweave, verify) read this section for context.

### Step 5: Update the Queue

When running via /ralph, the lead advances the queue — skip this step. When running interactively, YOU advance the phase (enrichment phase order: enrich -> reflect -> reweave -> verify):

```bash
jq '(.tasks[] | select(.id=="TASK_ID")).current_phase = "reflect" |
    (.tasks[] | select(.id=="TASK_ID")).completed_phases += ["enrich"]' \
    ops/queue/queue.json > tmp.json && mv tmp.json ops/queue/queue.json
```

### Step 6: Report

```markdown
## Enrichment Complete

**Task:** {id} | **Target:** [[note title]]
**Added:** {one-line summary of the addition and where it landed}
**Links added:** [[note]] — {reason} | NONE
**Task file:** ## Enrich section updated
**Queue:** phase advanced enrich -> reflect (or "ralph lead advances")
```

---

## Quality Gates

1. **Claim preserved** — the note's core claim reads identically before and after. Enrichment that changes the claim is a rewrite; stop and flag instead.
2. **Addition matches spec** — what landed in the note is what the frontmatter `addition` describes. Scope creep is contamination.
3. **Links verified** — every wiki link added resolves to an existing file (or a flagged forward-reference the task file anticipates).
4. **Task file updated** — an empty `## Enrich` section after completion means the phase did not happen, whatever the note says.

## Edge Cases

- **Target note missing:** Do not create it. Report the broken target — the enrichment may predate a rename. Suggest checking `knowledge/` for the renamed slug.
- **Addition already present:** (e.g., a prior partial run) Verify completeness against the spec, fill the `## Enrich` section describing what was found, and advance the phase. Do not duplicate content.
- **Source archive missing:** Proceed from `## Reduce Notes` alone if it carries enough detail; otherwise flag the task as blocked.

---

## Handoff Mode (--handoff flag)

When invoked with `--handoff` (always, when run via /ralph), append this block at the END so the ralph lead can parse results and advance the queue:

```
=== RALPH HANDOFF: enrich ===
Target: [[note title]]

Work Done:
- Enriched knowledge/{slug}.md: {summary of addition}
- Links added: N (articulation test: PASS) | NONE

Files Modified:
- knowledge/{slug}.md (enrichment content)
- ops/queue/{task file} (## Enrich section)

Learnings:
- [Friction]: {description} | NONE
- [Surprise]: {description} | NONE
- [Methodology]: {description} | NONE
- [Process gap]: {description} | NONE

Queue Updates:
- Advance phase: enrich -> reflect
=== END HANDOFF ===
```

**Critical:** The handoff block is OUTPUT, not a replacement for the workflow. Do the full enrich workflow first, update the task file, then format results as handoff.
