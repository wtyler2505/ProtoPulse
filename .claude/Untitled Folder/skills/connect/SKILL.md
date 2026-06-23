---
name: connect
description: Find connections between notes and update MOCs. Requires semantic judgment to identify genuine relationships. Use after /extract creates notes, when exploring connections, or when a topic needs synthesis. Triggers on "/connect", "/connect [note]", "find connections", "update MOCs", "connect these notes".
user-invocable: true
allowed-tools: Read, Write, Edit, Grep, Glob, Bash, mcp__qmd__qmd_search, mcp__qmd__qmd_vector_search, mcp__qmd__qmd_deep_search, mcp__qmd__qmd_status
context: fork
---

## Runtime Configuration (Step 0 — before any processing)

Read these files to configure domain-specific behavior:

1. **`ops/derivation-manifest.md`** — vocabulary mapping, platform hints
   - Use `vocabulary.notes` for the notes folder name
   - Use `vocabulary.note` / `vocabulary.note_plural` for note type references
   - Use `vocabulary.reflect` for the process verb in output
   - Use `vocabulary.topic_map` / `vocabulary.topic_map_plural` for MOC references
   - Use `vocabulary.cmd_reweave` for the next-phase suggestion
   - Use `vocabulary.inbox` for the inbox folder name

2. **`ops/config.yaml`** — processing depth, pipeline chaining
   - `processing.depth`: deep | standard | quick
   - `processing.chaining`: manual | suggested | automatic

If these files don't exist, use universal defaults.

**Processing depth adaptation:**

| Depth | Connection Behavior |
|-------|-------------------|
| deep | Full dual discovery (MOC + semantic search). Evaluate every candidate. Multiple passes. Synthesis opportunity detection. Bidirectional link evaluation for all connections. |
| standard | Dual discovery with top 5-10 candidates. Standard evaluation. Bidirectional check for strong connections only. |
| quick | Single pass — either MOC or semantic search. Accept obvious connections only. Skip synthesis detection. |

## EXECUTE NOW

**Target: $ARGUMENTS**

Parse immediately:
- If target contains `[[note name]]` or note name: find connections for that {vocabulary.note}
- If target contains `--handoff`: output RALPH HANDOFF block at end
- If target is empty: check for recently created {vocabulary.note_plural} or ask which {vocabulary.note}
- If target is "recent" or "new": find connections for all {vocabulary.note_plural} created today

**Execute these steps:**

1. Read the target {vocabulary.note} fully — understand its claim and context
2. **Throughout discovery:** Capture which {vocabulary.topic_map_plural} you read, which queries you ran (with scores), which candidates you evaluated. This becomes the Discovery Trace — proving methodology was followed, not reconstructed.
3. Run Phase 0 (index freshness check) — per `../shared-references/dual-discovery.md`
4. Use dual discovery in parallel (full method: `../shared-references/dual-discovery.md`):
   - Browse relevant {vocabulary.topic_map}(s) for related {vocabulary.note_plural}
   - Run semantic search for conceptually related {vocabulary.note_plural}
5. Evaluate each candidate: does a genuine connection exist? Can you articulate WHY?
6. Add inline wiki-links where connections pass the articulation test
7. Update relevant {vocabulary.topic_map}(s) with this {vocabulary.note}
8. If task file in context: update the {vocabulary.reflect} section
9. Report what was connected and why
10. If `--handoff` in target: output RALPH HANDOFF block

**START NOW.** Reference files below explain methodology — read them at the indicated points; use to guide, not as output.

---

# Reflect

Find connections, weave the knowledge graph, update {vocabulary.topic_map_plural}. This is the forward-connection phase of the processing pipeline.

**The network IS the knowledge. Quality over speed. Explicit over vague.** Every connection must pass the articulation test — "related" is not a relationship; "extends X by adding Y" or "contradicts X because Z" is. Bad connections pollute the graph; when uncertain, do not connect. Full philosophy: `references/connection-patterns.md` §Philosophy.

## Invocation Patterns

### /connect (no argument)

Check for recent additions:
1. Look for {vocabulary.note_plural} modified in the last session
2. If none obvious, ask user what {vocabulary.note_plural} to connect

### /connect [note]

Focus on connecting a specific {vocabulary.note}:
1. Read the target {vocabulary.note}
2. Discover related content
3. Add connections and update {vocabulary.topic_map_plural}

### /connect [topic area]

Synthesize an area:
1. Read the relevant {vocabulary.topic_map}
2. Identify {vocabulary.note_plural} that should connect
3. Weave connections, update synthesis

### /connect --handoff [note]

External loop mode for /ralph:
- Execute full workflow as normal
- At the end, output structured RALPH HANDOFF block
- Used when running isolated phases with fresh context per task

## Workflow

Phase-by-phase detail lives in two reference files. Read them BEFORE executing the phases:

- **`../shared-references/dual-discovery.md`** (MANDATORY before discovery) — Phase 0 index freshness check (qmd MCP → bash-with-lock → grep fallback, self-healing sync) and Phase 2 dual discovery ({vocabulary.topic_map} exploration + semantic search three-tier fallback with lock serialization, plus secondary keyword search / description scan / link following and the semantic-vs-keyword choosing table).
- **`references/connection-patterns.md`** (MANDATORY before evaluating/adding connections) — Phase 1 (understand the note), Phase 3 (articulation test, relationship types, reject criteria, agent traversal check, synthesis opportunity detection), Phase 4 (inline links as prose with good/bad galleries, relevant_notes format, bidirectional consideration), Phase 5 ({vocabulary.topic_map} structure + update patterns + size check), Phase 6 (agent notes), edge cases (no connections, split detection, conflicting notes, orphans), success criteria.

### Phase summary (execute in order)

| Phase | Action |
|-------|--------|
| 0 | Verify qmd index freshness; sync (`qmd update && qmd embed`) if file count and index count differ |
| 1 | Read target {vocabulary.note} fully — claim, mechanism, implications, scope, tensions; read task file if present |
| 2 | Dual discovery in parallel: {vocabulary.topic_map}(s) + semantic search; capture Discovery Trace as you go |
| 3 | Evaluate every candidate with the articulation test; flag (don't create) synthesis opportunities |
| 4 | Add inline wiki-links as prose + relevant_notes entries with context phrases; decide bidirectionality |
| 5 | Update {vocabulary.topic_map}(s): Core Ideas, Tensions, Gaps; run the size check and surface split signals |
| 6 | Add agent notes when navigation insights emerge |

### Reweave Task Filtering (when adding bidirectional links)

When you edit an older {vocabulary.note} to add a reverse link, you MAY flag it for full reconsideration via reweave. But SKIP reweave flagging if ANY of these apply:

| Skip Condition | Rationale |
|----------------|-----------|
| Note has >5 incoming links | Already a hub — one more link does not warrant full reconsideration |
| Note has `type: tension` in YAML | Structural framework, not content that evolves |
| Note was reweaved in current batch | Do not re-reweave what was just reweaved |
| Note is a {vocabulary.topic_map} | {vocabulary.topic_map_plural} are navigation, not claims to reconsider |

**Check incoming links:**
```bash
grep -r '\[\[note name\]\]' {vocabulary.notes}/*.md | wc -l
```

If >= 5, skip reweave flagging.

## Quality Gates

### Gate 1: Articulation Test

For every connection added, can you complete:
> [[A]] connects to [[B]] because [specific reason]

If any connection fails this test, remove it.

### Gate 2: Prose Test

For every inline link, read the sentence aloud. Does it flow naturally? Would you say this to a friend explaining the idea?

Bad: "this is related to [[note]]"
Good: "since [[note]], the implication is..."

### Gate 3: Bidirectional Check

For every A -> B link, explicitly decide: should B -> A exist?
Document your reasoning if the relationship is asymmetric.

### Gate 4: {vocabulary.topic_map} Coherence

After updating a {vocabulary.topic_map}, read the opening synthesis. Does it still hold? Do new {vocabulary.note_plural} extend or challenge it?

If the synthesis is now wrong or incomplete, update it.

### Gate 5: Link Verification

Verify every wiki link target exists. Never create links to non-existent files.

```bash
# Check that a link target exists
ls {vocabulary.notes}/"target name.md" 2>/dev/null
```

## Output Format

After reflecting, report:

```markdown
## Reflection Complete

### Discovery Trace

**Why this matters:** Shows methodology was followed. Blind delegation hides whether dual discovery happened. Trace enables verification.

**{vocabulary.topic_map} exploration:**
- Read [[moc-name]] — found candidates: [[note A]], [[note B]], [[note C]]
- Followed link from [[note A]] to [[note D]]

**Semantic search:** (via MCP | bash fallback | grep-only)
- query "[core concept from note]" — top hits:
  - [[note E]] (0.74) — evaluated: strong match, mechanism overlap
  - [[note F]] (0.61) — evaluated: weak, only surface vocabulary
  - [[note G]] (0.58) — evaluated: skip, different domain

**Keyword search:**
- grep "specific term" — found [[note H]] (already in {vocabulary.topic_map} candidates)

### Connections Added

**[[source note]]**
- -> [[target]] — [relationship type]: [why]
- <- [[incoming]] — [relationship type]: [why]
- inline: added link to [[note]] in paragraph about X

### {vocabulary.topic_map} Updates

**[[moc-name]]**
- Added [[note]] to Core Ideas — [contribution]
- Updated Tensions: [[A]] vs [[B]] now includes [[C]]
- Removed from Gaps: [what was filled]
- Agent note: [what was learned]

### Synthesis Opportunities

[{vocabulary.note_plural} that could be combined into higher-order insights, with proposed claim]

### Flagged for Attention

- [[orphan note]] — could not find connections
- [[broad note]] — might benefit from splitting
- Tension between [[X]] and [[Y]] needs resolution
```

## Critical Constraints

**Never:**
- Create wiki links to non-existent files
- Add "related" connections without specific reasoning
- Force connections that are not there
- Auto-generate without semantic judgment
- Skip the articulation test

**Always:**
- Verify link targets exist
- Explain WHY connections exist
- Consider bidirectionality
- Update relevant {vocabulary.topic_map_plural}
- Add agent notes when navigation insights emerge
- Capture discovery trace as you work

---

## Handoff Mode (--handoff flag)

When invoked with `--handoff`, output this structured format at the END of the session. This enables external loops (/ralph) to parse results and update the task queue.

**Detection:** Check if `$ARGUMENTS` contains `--handoff`. If yes, append this block after completing normal workflow.

**Handoff format:**

```
=== RALPH HANDOFF: {vocabulary.reflect} ===
Target: [[note name]]

Work Done:
- Discovery: {vocabulary.topic_map} [[moc-name]], query "[query]" (MCP|bash|grep-only), grep "[term]"
- Connections added: N (articulation test: PASS)
- {vocabulary.topic_map} updates: [[moc-name]] Core Ideas section
- Synthesis opportunities: [count or NONE]

Files Modified:
- {vocabulary.notes}/[note name].md (inline links added)
- {vocabulary.notes}/[moc-name].md (Core Ideas updated)
- [task file path] ({vocabulary.reflect} section)

Learnings:
- [Friction]: [description] | NONE
- [Surprise]: [description] | NONE
- [Methodology]: [description] | NONE
- [Process gap]: [description] | NONE

Queue Updates:
- Advance phase: {vocabulary.reflect} -> {vocabulary.reweave}
- Reweave candidates (if any pass filter): [[note]] | NONE (filtered: hub/tension/recent)
=== END HANDOFF ===
```

### Task File Update (when invoked via ralph loop)

When running in handoff mode via /ralph, the prompt includes the task file path. After completing the workflow, update the `## {vocabulary.reflect}` section of that task file with:
- Connections added and why
- {vocabulary.topic_map} updates made
- Articulation test results
- Discovery trace summary

**Critical:** The handoff block is OUTPUT, not a replacement for the workflow. Do the full reflect workflow first, update task file, then format results as handoff.

### Queue Update (interactive execution)

When running interactively (NOT via /ralph), YOU must advance the phase in the queue. /ralph handles this automatically, but interactive sessions do not.

**After completing the workflow, advance the phase:**

```bash
# get timestamp
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# advance phase (current_phase -> next, append to completed_phases)
jq '(.tasks[] | select(.id=="TASK_ID")).current_phase = "{vocabulary.reweave}" |
    (.tasks[] | select(.id=="TASK_ID")).completed_phases += ["{vocabulary.reflect}"]' \
    ops/queue/queue.json > tmp.json && mv tmp.json ops/queue/queue.json
```

The handoff block's "Queue Updates" section is not just output — it is your own todo list when running interactively.

## Pipeline Chaining

After connection finding completes, output the next step based on `ops/config.yaml` pipeline.chaining mode:

- **manual:** Output "Next: {vocabulary.cmd_reweave} [note]" — user decides when to proceed
- **suggested:** Output next step AND advance task queue entry to `current_phase: "{vocabulary.reweave}"`
- **automatic:** Queue entry advanced and backward pass proceeds immediately

The chaining output uses domain-native command names from the derivation manifest.
