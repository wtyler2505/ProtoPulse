---
name: extract
description: Extract structured knowledge from source material. Comprehensive extraction is the default — every insight that serves the domain gets extracted. For domain-relevant sources, skip rate must be below 10%. Zero extraction from a domain-relevant source is a BUG. Triggers on "/extract", "/extract [file]", "extract insights", "mine this", "process this".
version: "1.0"
generated_from: "arscontexta-v1.6"
user-invocable: true
allowed-tools: Read, Write, Grep, Glob, mcp__qmd__qmd_vector_search
context: fork
---

## Runtime Configuration (Step 0 — before any processing)

Read these files to configure domain-specific behavior:

1. **`ops/derivation-manifest.md`** — vocabulary mapping, extraction categories, platform hints
   - Use `vocabulary.notes` for the notes folder name
   - Use `vocabulary.inbox` for the inbox folder name
   - Use `vocabulary.note` for the note type name in output
   - Use `vocabulary.note_plural` for the plural form
   - Use `vocabulary.reduce` for the process verb in output
   - Use `vocabulary.cmd_reflect` for the next-phase command name
   - Use `vocabulary.cmd_reweave` for the backward-pass command name
   - Use `vocabulary.cmd_verify` for the verification command name
   - Use `vocabulary.extraction_categories` for domain-specific extraction table
   - Use `vocabulary.topic_map` for MOC/topic map references
   - Use `vocabulary.topic_maps` for plural form

2. **`ops/config.yaml`** — processing depth, pipeline chaining, selectivity
   - `processing.depth`: deep | standard | quick
   - `processing.chaining`: manual | suggested | automatic
   - `processing.extraction.selectivity`: strict | moderate | permissive

3. **`ops/queue/queue.json`** — current task queue (for handoff mode)

If these files don't exist (pre-init invocation or standalone use), use universal defaults:
- depth: standard
- chaining: suggested
- selectivity: moderate
- notes folder: `knowledge/` (the manifest maps `vocabulary.notes` to `knowledge/` — there is no other fallback)
- inbox folder: `inbox/`

---

## THE MISSION (READ THIS OR YOU WILL FAIL)

You are the extraction engine. Raw source material enters. Structured, atomic {vocabulary.note_plural} exit. Everything between is your judgment — and that judgment must err toward extraction, not rejection.

### The Core Distinction

| Concept | What It Means | Example |
|---------|---------------|---------|
| **Having knowledge** | The vault contains information | "We store notes in folders" |
| **Articulated reasoning** | The vault explains WHY something works as a traversable {vocabulary.note} | "folder structure mirrors cognitive chunking because..." |

**Having knowledge is not the same as articulating it.** Even if information is embedded in the system, the vault may lack the externalized reasoning explaining WHY it works. That reasoning is what you extract.

### The Comprehensive Extraction Principle

**For domain-relevant sources, COMPREHENSIVE EXTRACTION is the default.** This means:

1. **Extract ALL core {vocabulary.note_plural}** — direct assertions about the domain that can stand alone as atomic propositions.

2. **Extract ALL evidence and validations** — if source confirms an approach, that confirmation IS the {vocabulary.note}. Evidence is extractable even when the conclusion is already known, because the reasoning path matters.

3. **Extract ALL patterns and methods** — techniques, workflows, practices. Named patterns are referenceable. Unnamed intuitions are not.

4. **Extract ALL tensions** — contradictions, trade-offs, conflicts. These are wisdom, not problems.

5. **Extract ALL enrichments** — if source adds detail to existing {vocabulary.note_plural}, create enrichment tasks. Near-duplicates almost always add value.

**"We already know this" means we NEED the articulation, not that we should skip it.**

### The Extraction Question (ask for EVERY candidate)

**"Would a future session benefit from this reasoning being a retrievable {vocabulary.note}?"**

If YES -> extract to appropriate category
If NO -> verify it is truly off-topic before skipping

### INVALID Skip Reasons (these are BUGS)

- "validates existing approach" — validations ARE the evidence. Extract them.
- "already captured in system config" — config is implementation, not articulation. The WHY needs a {vocabulary.note}.
- "we already do this" — DOING is not EXPLAINING. The explanation needs externalization.
- "obvious" — obvious to whom? Future sessions need explicit reasoning.
- "near-duplicate" — near-duplicates almost always add detail. Create enrichment task.
- "not a claim" — is it an implementation idea? tension? validation? Those ARE extractable.

### VALID Skip Reasons (rare)

- Completely off-topic (unrelated to {vocabulary.domain})
- Too vague to act on (applies to everything, disagrees with nothing)
- Pure summary with zero extractable insight
- LITERALLY identical text already exists (not "same topic" — IDENTICAL)

**For domain-relevant sources: skip rate < 10%. Zero extraction = BUG.**

---

## EXECUTE NOW

**Target: $ARGUMENTS**

Parse immediately:
- If target contains a file path: extract insights from that file
- If target contains `--handoff`: output RALPH HANDOFF block + task entries at end
- If target is empty: scan {vocabulary.inbox}/ for unprocessed items, pick one
- If target is "inbox" or "all": process all inbox items sequentially

**Execute these steps:**

1. Read the source file fully — understand what it contains
2. **Source size check:** If source exceeds 2500 lines, STOP. Plan chunks of 350-1200 lines. Process each chunk with fresh context. See "Large Source Handling" in `references/extraction-doctrine.md`.
3. Hunt for insights that serve the domain (extraction categories + detection signals: `references/extraction-doctrine.md`)
4. For each candidate:
   - Tier 1 (preferred): use `mcp__qmd__qmd_vector_search` with query "[claim as sentence]", collection="protopulse-vault" (the manifest's `vocabulary.notes_collection`), limit=5
   - Tier 2 (CLI fallback): `qmd query --collection protopulse-vault "[claim as sentence]" -n 5`
   - Tier 3 fallback if qmd is unavailable: use keyword grep duplicate checks
   - If duplicate exists: evaluate for enrichment or skip
   - Classify as OPEN (needs more investigation) or CLOSED (standalone, ready)
5. Output extraction report with titles, classifications, extraction rationale
6. Wait for user approval before creating files
7. If `--handoff` in target: create per-claim task files, update queue, output RALPH HANDOFF block (formats: `references/handoff-spec.md`)

**START NOW.** Reference files below explain methodology — read them at the indicated points; use to guide, not as output.

### Reference Files (progressive disclosure — read on demand)

| File | Read when |
|------|-----------|
| `references/extraction-doctrine.md` | Before steps 3-7. Contains: extraction categories + detection signals, the selectivity gate (off-topic filtering only), the full 7-step workflow, the note schema (v2 frontmatter banner + note template + v2-compliance checklist), large-source chunking, enrichment detection, quality gates + calibration tables, note design reference, composability test, research provenance, worked examples |
| `references/handoff-spec.md` | When `--handoff` is in target. Contains: per-claim task file format, enrichment task file format, queue.json entry formats + critical queue rules, global claim numbering |

**MANDATORY:** Before writing ANY {vocabulary.note} file, read the Workflow step 7 section of `references/extraction-doctrine.md` — the frontmatter schema (canonical `_schema` block in `ops/config.yaml`, enforced by `/vault-validate --mode gate`) and the v2-compliance checklist are non-negotiable.

### Observation Capture (during work, not at end)

When you encounter friction, surprises, methodology insights, process gaps, or contradictions — capture IMMEDIATELY:

| Observation | Action |
|-------------|--------|
| Any observation | Create atomic note in `ops/observations/` with prose-sentence title |
| Tension: content contradicts existing {vocabulary.note} | Create atomic note in `ops/tensions/` with prose-sentence title |

The handoff Learnings section summarizes what you ALREADY logged during processing.

---

## Critical

Never auto-extract. Always present findings and wait for user approval.

**When in doubt, extract.** For domain-relevant sources, err toward capturing. Implementation ideas, tensions, validations, open questions, and near-duplicates all have value — they become different output types, not rejections.

**The principle:** the goal is to capture everything relevant to {vocabulary.domain}. For domain-relevant sources, that is MOST of the content. The selectivity gate exists for OFF-TOPIC filtering, not for rejecting on-mission content that happens to have a different form.

**Remember:**
- Implementation ideas are NOT "not claims" — they are roadmap
- Tensions are NOT "not claims" — they are wisdom
- Enrichments are NOT "duplicates" — they add detail
- Validations are NOT "already known" — they are evidence
- Open questions are NOT "not testable" — they are guidance

**For domain-relevant sources: skip rate < 10%. Zero extraction = BUG.**

---

## Handoff Mode (--handoff flag)

When invoked with `--handoff`, this skill handles queue management for orchestrated execution. This includes creating per-claim task files and updating the task queue.

**Detection:** Check if `$ARGUMENTS` contains `--handoff`.

**Task file and queue formats (REQUIRED):** Read `references/handoff-spec.md` and follow it exactly — per-claim task files (`{source}-NNN.md`), enrichment task files (`{source}-EEE.md`), queue.json entries (ONE entry per claim/enrichment with `current_phase` / `completed_phases` tracking), and global claim numbering starting from `next_claim_start`.

### Handoff Output Format

After creating files and updating queue, output:

```
=== RALPH HANDOFF: reduce ===
Target: [source file]

Work Done:
- Extracted N claims from [source]
- Created claim files: {source}-NNN.md through {source}-NNN.md
- Created M enrichment files: {source}-EEE.md through {source}-EEE.md (if any)
- Duplicates skipped: [list or "none"]
- Semantic neighbors flagged for cross-linking: [list or "none"]

Files Modified:
- ops/queue/{source}-NNN.md (claim files)
- ops/queue/{source}-EEE.md (enrichment files, if any)
- ops/queue/queue.json (N claim tasks + M enrichment tasks, 1 entry each)

Learnings:
- [Friction]: [description] | NONE
- [Surprise]: [description] | NONE
- [Methodology]: [description] | NONE
- [Process gap]: [description] | NONE

Queue Updates:
- Mark: {source} done
- Create: claim-NNN entries (1 per claim, current_phase: "create")
- Create: enrich-EEE entries (1 per enrichment, current_phase: "enrich", if any)
=== END HANDOFF ===
```

**Critical:** The handoff mode adds queue management ON TOP of the standard reduce workflow. Do the full extraction workflow first, then create task files, update queue, and output handoff.

### Queue Update (Interactive Execution)

When running interactively (NOT via orchestrator), YOU must execute the queue updates. The orchestrator parses the handoff block and handles this automatically, but interactive sessions do not.

**After completing extraction, update the queue:**

```bash
# Get timestamp
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Mark extract task done (replace TASK_ID with actual task ID)
jq '(.tasks[] | select(.id=="TASK_ID")).status = "done" | (.tasks[] | select(.id=="TASK_ID")).completed = "'"$TIMESTAMP"'"' ops/queue/queue.json > tmp.json && mv tmp.json ops/queue/queue.json
```

The handoff block's "Queue Updates" section is not just output — it is your own todo list when running interactively.

---

## Skill Selection Routing

When processing content, route to the correct skill:

| Task Type | Required Skill | Why |
|-----------|---------------|-----|
| New content to process | /{vocabulary.reduce} | Extraction requires quality gates |
| {vocabulary.note} just created | /{vocabulary.cmd_reflect} | New {vocabulary.note_plural} need connections |
| After connecting | /{vocabulary.cmd_reweave} | Old {vocabulary.note_plural} need updating |
| Quality check | /{vocabulary.cmd_verify} | Combined verification gate |
| System health | /arscontexta:health (consumption-focused checks: /vault-health) | Systematic diagnostics |

## Pipeline Chaining

After extraction completes, output the next step based on `ops/config.yaml` pipeline chaining mode:

- **manual:** Output "Next: {vocabulary.cmd_reflect} [created notes]" — user decides when to proceed
- **suggested:** Output next step AND add each created {vocabulary.note} to `ops/queue/queue.json` with `current_phase: "create"` and `completed_phases: []`
- **automatic:** Queue entries created and processing continues immediately via orchestration

The chaining output uses domain-native command names from the derivation manifest.

---

## Queue-Aware Batch Mode (added 2026-04-19, BL-0855)

When invoked without a specific file (e.g., `/extract --batch` or `/extract --batch --include-user-queue`), consume pending stubs from the queue files in **priority order**:

### Priority ladder

1. **`ops/queue/gap-stubs.md`** (HIGH) — agent-detected gaps surfaced by `/vault-gap`. Trustworthy origin. Process first.
2. **`ops/queue/user-suggestions.md`** (LOW, gated) — user-submitted suggestions captured by `/vault-gap --source user` (formerly `/vault-inbox`, now merged into vault-gap). Each row's corresponding inbox stub has `triage_status: pending-review` and requires **explicit moderation approval** before extraction. Only consumed when `--include-user-queue` is passed.

### Moderation gate for user-suggestions

For every user-suggestion stub before extraction:

1. **Read the inbox stub** referenced in the `inbox_path` column.
2. **Apply the moderation checklist:**
   - [ ] Does the suggestion describe a real gap in the vault (not a duplicate, not already covered)?
   - [ ] Is the topic in-domain for ProtoPulse (EDA/hardware/UI/agent-infra)?
   - [ ] Does it include enough research context to let `/extract` proceed without hallucination?
   - [ ] Does `unblocks:` in frontmatter point to a real plan or code path?
3. **If ALL checkboxes pass:** promote `triage_status: pending-review` → `triage_status: approved`, proceed to extract.
4. **If ANY checkbox fails:** promote to `triage_status: rejected` with a one-line reason in the stub frontmatter (`rejection_reason:`); skip extraction; leave the queue row marked for human review.

### Post-extract queue update

After extracting a stub, update its queue row status:
- `gap-stubs.md`: `status: extracted` + `extracted_date`
- `user-suggestions.md`: `status: extracted` (or `rejected` if moderation blocked it)

Never mutate queue rows mid-batch — collect all state changes, write at the end in a single atomic pass.

### Invocation examples

```bash
/extract --batch                       # gap-stubs.md only (default — high-trust only)
/extract --batch --include-user-queue  # gap-stubs.md then user-suggestions.md (with moderation)
/extract --batch --limit 5             # process at most 5 pending stubs this run
```

### Non-blocking rule

User-suggestion extraction failures MUST NOT halt gap-stub processing. If a user suggestion fails moderation, log and continue to the next item.
