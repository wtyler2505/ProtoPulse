# Handoff Spec (Reference for /extract --handoff)

> Read when `--handoff` is in the target. Defines the per-claim task files, enrichment task files, queue.json entry formats, and claim numbering that handoff mode MUST produce. The RALPH HANDOFF output block itself lives in SKILL.md (parsed by /ralph).

### Per-Claim Task Files (REQUIRED in handoff mode)

After extraction, for EACH claim, create a task file in `ops/queue/`:

**Filename:** `{source}-NNN.md` where:
- {source} is the source basename (from the extract task)
- NNN is the claim number, starting from `next_claim_start` in the extract task file

**Example:** If `article-name.md` task has `next_claim_start: 010`, claims are:
- `article-name-010.md`, `article-name-011.md`, etc.

**Why unique names:** Claim filenames must be unique across the entire vault. Claim numbers are global and never reused across batches. The pattern `{source}-NNN.md` ensures every claim file is uniquely identifiable even after archiving.

**Structure:**

```markdown
---
claim: "[the claim as a sentence]"
classification: closed | open
source_task: [source-basename]
semantic_neighbor: "[related note title]" | null
---

# Claim NNN: [claim title]

Source: [[source filename]] (lines NNN-NNN)

## Extract Notes

Extracted from [source_task]. This is a [CLOSED/OPEN] claim.

Rationale: [why this claim was extracted, what it contributes]

Semantic neighbor: [if found, explain why DISTINCT not DUPLICATE]

---

## Create
(to be filled by create phase)

## {vocabulary.cmd_connect}
(to be filled by {vocabulary.cmd_connect} phase)

## {vocabulary.cmd_revisit}
(to be filled by {vocabulary.cmd_revisit} phase)

## {vocabulary.cmd_verify}
(to be filled by {vocabulary.cmd_verify} phase)
```

### Enrichment Task Files (REQUIRED in handoff mode)

For each ENRICHMENT detected, create a task file in `ops/queue/`:

**Filename:** `{source}-EEE.md` where:
- {source} is the source basename (same as claims)
- EEE is the enrichment number, continuing from where claims left off

**Example:** If claims are 010-015, enrichments start at 016.

**Why unique names:** Enrichments share the numbering system with claims. Both use the global `next_claim_start` counter. This ensures every task file is uniquely identifiable across the entire vault.

**Structure:**

```markdown
---
type: enrichment
target_note: "[[existing note title]]"
source_task: [source-basename]
addition: "what to add from source"
source_lines: "NNN-NNN"
---

# Enrichment EEE: [[existing note title]]

Source: [[source filename]] (lines NNN-NNN)

## Extract Notes

Enrichment for [[existing note title]]. Source adds [what it adds].

Rationale: [why this enriches rather than duplicates]

---

## Enrich
(to be filled by enrich phase)

## {vocabulary.cmd_connect}
(to be filled by {vocabulary.cmd_connect} phase)

## {vocabulary.cmd_revisit}
(to be filled by {vocabulary.cmd_revisit} phase)

## {vocabulary.cmd_verify}
(to be filled by {vocabulary.cmd_verify} phase)
```

### Queue Updates (REQUIRED in handoff mode)

After creating task files, update `ops/queue/queue.json`:

1. Mark the extract task as `"status": "done"` with completion timestamp
2. For EACH claim, add ONE queue entry:

```json
{
  "id": "claim-NNN",
  "type": "claim",
  "status": "pending",
  "target": "[claim title]",
  "classification": "closed|open",
  "batch": "[source-basename]",
  "file": "[source-basename]-NNN.md",
  "created": "[ISO timestamp]",
  "current_phase": "create",
  "completed_phases": []
}
```

3. For EACH enrichment, add ONE queue entry:

```json
{
  "id": "enrich-EEE",
  "type": "enrichment",
  "status": "pending",
  "target": "[existing note title]",
  "source_detail": "[what to add]",
  "batch": "[source-basename]",
  "file": "[source-basename]-EEE.md",
  "created": "[ISO timestamp]",
  "current_phase": "enrich",
  "completed_phases": []
}
```

**Critical queue rules:**
- ONE entry per claim (NOT one per phase) — phase progression is tracked via `current_phase` and `completed_phases`
- `type` is `"claim"` or `"enrichment"` — these are the task's single queue entries
- Every task MUST have `"file"` pointing to its uniquely-named task file
- Every task MUST have `"batch"` identifying which source batch it belongs to
- Task IDs use `claim-NNN` or `enrich-EEE` format with the global claim number
- Claim numbers are global and never reused across batches
- `current_phase` starts at `"create"` for claims, `"enrich"` for enrichments
- The orchestrator advances phases through the configured phase_order sequence

### Claim Numbering

- Start from `next_claim_start` value in the extract task file (set by /seed)
- /seed calculated this by checking the queue and archive for the highest existing claim number
- Example: if highest claim in vault is 009, next_claim_start will be 010
- Claim numbers are GLOBAL and never reused across batches
- Enrichments continue the same numbering sequence after claims
