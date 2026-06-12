---
name: revisit
description: Update old knowledge with new connections. The backward pass that /connect doesn't do. Revisit existing knowledge that predates newer related content, add connections, sharpen claims, consider splits. Triggers on "/revisit", "/revisit [note]", "update old knowledge", "backward connections", "revisit knowledge".
user-invocable: true
allowed-tools: Read, Write, Edit, Grep, Glob, Bash, mcp__qmd__qmd_search, mcp__qmd__qmd_vector_search, mcp__qmd__qmd_deep_search, mcp__qmd__qmd_status
context: fork
---

## Runtime Configuration (Step 0 — before any processing)

Read these files to configure domain-specific behavior:

1. **`ops/derivation-manifest.md`** — vocabulary mapping, platform hints
   - Use `vocabulary.knowledge` for the knowledge folder name
   - Use `vocabulary.note` / `vocabulary.note_plural` for note type references
   - Use `vocabulary.revisit` for the process verb in output
   - Use `vocabulary.topic_map` / `vocabulary.topic_map_plural` for topic map references
   - Use `vocabulary.cmd_verify` for the next-phase suggestion

2. **`ops/config.yaml`** — processing depth, pipeline chaining
   - `processing.depth`: deep | standard | quick
   - `processing.chaining`: manual | suggested | automatic
   - `processing.revisit.scope`: related | broad | full

If these files don't exist, use universal defaults.

**Processing depth adaptation:**

| Depth | Revisit Behavior |
|-------|-----------------|
| deep | Full reconsideration. Search extensively for newer related {vocabulary.note_plural}. Consider splits, rewrites, challenges. Evaluate claim sharpening. Multiple search passes. |
| standard | Balanced review. Search semantic neighbors and same-{vocabulary.topic_map} {vocabulary.note_plural}. Add connections, sharpen if needed. |
| quick | Minimal backward pass. Add obvious connections only. No rewrites or splits. |

**Revisit scope:** `related` = search {vocabulary.note_plural} directly related to the target (same {vocabulary.topic_map}, semantic neighbors); `broad` = search across all {vocabulary.topic_map_plural} and semantic space for potential connections; `full` = complete review including potential splits, rewrites, and claim challenges.

## EXECUTE NOW

**Target: $ARGUMENTS**

Parse immediately:
- If target contains `[[note name]]` or note name: revisit that specific {vocabulary.note}
- If target contains `--handoff`: output RALPH HANDOFF block at end
- If target is empty: find {vocabulary.note_plural} that most need revisiting (oldest, sparsest, most outdated)
- If target is "recent" or "--since Nd": revisit {vocabulary.note_plural} not touched in N days
- If target is "sparse": find {vocabulary.note_plural} with fewest connections

**Execute these steps:**

1. **Read the target {vocabulary.note} fully** — understand its current claim, connections, and age
2. **Ask the revisit question:** "If I wrote this {vocabulary.note} today, with everything I now know, what would be different?"
3. **If a task file exists** (pipeline execution): read it to see what /connect discovered. The Connect section shows which connections were just added and which {vocabulary.topic_map_plural} were updated — this is your starting context for the backward pass.
4. **Search for newer related {vocabulary.note_plural}** — use dual discovery (semantic search + {vocabulary.topic_map} browsing) to find {vocabulary.note_plural} created AFTER the target that should connect
5. **Evaluate what needs changing:**
   - Add connections to newer {vocabulary.note_plural} that did not exist when this was written
   - Sharpen the claim if understanding has evolved
   - Consider splitting if the {vocabulary.note} now covers what should be separate ideas
   - Challenge the claim if new evidence contradicts it
   - Rewrite prose if understanding is deeper now
6. **Make the changes** — edit the {vocabulary.note} with new connections (inline links with context), improved prose, sharper claim if needed
7. **Update {vocabulary.topic_map_plural}** — if the {vocabulary.note}'s topic membership changed, update relevant {vocabulary.topic_map_plural}
8. **If task file exists:** update the {vocabulary.revisit} section
9. **Report** — structured summary of what changed and why
10. If `--handoff` in target: output RALPH HANDOFF block

**START NOW.** Reference below explains methodology — use to guide, not as output.

---

# Revisit

Revisit old {vocabulary.note_plural} with everything you know today. {vocabulary.note_plural} are living documents — they grow, get rewritten, split apart, sharpen their claims. This is the backward pass that keeps the network alive. Revisiting is a full reconsideration: ask **"If I wrote this {vocabulary.note} today, what would be different?"**

Deep guidance (extended philosophy, action examples, evaluation tests, proposal format): references/reweave-actions.md

## What Revisiting Can Do

| Action | When to Do It |
|--------|---------------|
| **Add connections** | Newer {vocabulary.note_plural} exist that should link here |
| **Rewrite content** | Understanding evolved, prose should reflect it |
| **Sharpen the claim** | Title is too vague to be useful |
| **Split the {vocabulary.note}** | Multiple claims bundled together |
| **Challenge the claim** | New evidence contradicts the original |
| **Improve the description** | Better framing emerged |
| **Update examples** | Better illustrations exist now |

## Invocation Patterns

- **/revisit [[note]]** — fully reconsider a specific {vocabulary.note} against current knowledge
- **/revisit** (no argument) — scan for candidates needing revisiting, present ranked list
- **/revisit --sparse** — process {vocabulary.note_plural} flagged as sparse by arscontexta:health
- **/revisit --since Nd** — revisit all {vocabulary.note_plural} not updated in N days. Find candidates: `find {vocabulary.knowledge}/ -name "*.md" -mtime +30 -type f`
- **/revisit --handoff [[note]]** — external loop mode for /ralph: execute full workflow, then output structured RALPH HANDOFF block (used when running isolated phases with fresh context per task)

---

## Workflow

### Phase 1: Understand the {vocabulary.note} as It Exists

Read the target {vocabulary.note} completely: what claim does it make? What reasoning supports it? What connections does it have? When was it written/last modified? What was the context when created?

**Also read the task file** if one exists (pipeline execution). The task file's Connect section shows what connections /connect just added, which {vocabulary.topic_map_plural} were updated, what synthesis opportunities were flagged, and the discovery trace. This context prevents redundant work — you know what /connect already found, so you can focus on what it missed or what needs deeper reconsideration.

### Phase 2: Gather Current Knowledge (Dual Discovery)

Use the same dual discovery pattern as /connect — {vocabulary.topic_map} exploration AND semantic search in parallel, with the canonical qmd three-tier fallback (MCP `mcp__qmd__qmd_deep_search` → bash `qmd query` with lock-dir serialization → grep-only) and index-freshness check.

**Canonical procedure (do not fork — shared with /connect):** ../shared-references/dual-discovery.md

Revisit-specific framing for Path 1 ({vocabulary.topic_map} exploration): from the {vocabulary.note}'s Topics footer, identify its {vocabulary.topic_map}(s) and ask — what synthesis exists that might affect this {vocabulary.note}? What newer {vocabulary.note_plural} in Core Ideas should it reference? What tensions involve it?

Evaluate results by relevance — read any result where title or snippet suggests genuine connection.

**Also check backlinks** — what {vocabulary.note_plural} already reference this one? Do they suggest the target should cite back?

```bash
grep -rl '\[\[target note title\]\]' {vocabulary.knowledge}/ --include="*.md"
```

**Key question:** What do I know today that I did not know when this {vocabulary.note} was written?

### Phase 3: Evaluate the Claim

**Does the original claim still hold?**

| Finding | Action |
|---------|--------|
| Claim holds, evidence strengthened | Add supporting connections |
| Claim holds but framing is weak | Rewrite for clarity |
| Claim is too vague | Sharpen to be more specific |
| Claim is too broad | Split into focused {vocabulary.note_plural} |
| Claim is partially wrong | Revise with nuance |
| Claim is contradicted | Flag tension, propose revision |

Apply the **Sharpening Test** (could someone disagree with this specific claim?) and the **Split Test** (multiple claims that could stand alone? 5+ topics across domains?). Examples: references/reweave-actions.md.

### Phase 4: Evaluate Connections

**Backward connections (what this {vocabulary.note} should reference):** For each newer {vocabulary.note}, ask: does it extend this argument? Provide evidence or examples? Share mechanisms? Create tension worth acknowledging? Would referencing it strengthen the reasoning?

**Forward connections (what should reference this {vocabulary.note}):** Check newer {vocabulary.note_plural} that SHOULD link here but do not — do they make arguments relying on this claim? Would following this link provide useful context?

**Agent Traversal Check (apply to all connections):** Ask **"If an agent follows this link during traversal, what decision or understanding does it enable?"** Connections exist to serve agent navigation. Adding a link because content is "related" without operational value creates noise. Every connection should help an agent understand WHY something works, decide HOW to implement something, or surface a tension to consider. Reject connections that are merely "interesting" without agent utility.

**Articulation requirement:** Every new connection must articulate WHY — "extends this by adding the temporal dimension", "provides evidence that supports this claim", "contradicts this — needs resolution". Never: "related" or "see also".

### Phase 5: Apply Changes

**For pipeline execution (--handoff mode):** Apply changes directly. The pipeline needs to proceed without waiting for approval.

**For interactive execution (no --handoff):** Present the revisit proposal first, then apply after approval. Proposal format: references/reweave-actions.md.

**When applying changes:**

1. Make changes atomically
2. Preserve existing valid content
3. Maintain prose flow — new links should read naturally inline
4. Verify all link targets exist
5. Update description if claim changed

The five revisit actions (add connections, rewrite, sharpen, split, challenge) each have detailed procedures and examples in references/reweave-actions.md.

---

## Enrichment-Triggered Actions

When processing a {vocabulary.note} that came through the enrichment pipeline, check the task file for `post_enrich_action` signals (`title-sharpen`, `split-recommended`, `merge-candidate`). These were surfaced by /enrich and need execution. Never auto-merge or auto-delete on merge-candidate — log for human review.

Deep guidance: references/enrichment-actions.md

---

## Quality Gates

1. **Articulation Test** — every change must be articulable: "I am adding this because..." with a specific reason.
2. **Improvement Test** — after changes, is the {vocabulary.note} better? More useful? More connected? More accurate? If you cannot confidently say yes, do not make the change.
3. **Coherence Test** — does the {vocabulary.note} still cohere as a single focused piece? Or did you accidentally make it broader?
4. **Network Test** — do the changes improve the network? More traversal paths? Better paths?
5. **When NOT to change** — the {vocabulary.note} is accurate, well-connected, and recent (leave it alone); the "improvement" would be cosmetic rewording (do not churn); the {vocabulary.note} is a historical record (these evolve through status changes, not rewrites).

---

## Output Format

```markdown
## Revisit Complete: [[target note]]

### Changes Applied

| Type | Description |
|------|-------------|
| connection | added [[note A]] inline, [[note B]] to footer |
| rewrite | clarified reasoning in paragraph 2 |
| sharpen | title unchanged, description updated |

### Claim Status

[unchanged | sharpened | split | challenged]

### Network Effect

- Outgoing links: 3 -> 5
- This {vocabulary.note} now bridges [[domain A]] and [[domain B]]

### Cascade Recommendations

- [[related note]] might benefit from revisit (similar vintage)
- {vocabulary.topic_map} [[topic]] should be updated to reflect changes

### Observations

[Patterns noticed, insights for future]
```

---

## Critical Constraints

**Never:** silently change claims without acknowledging evolution; split {vocabulary.note_plural} into pieces too thin to stand alone; add connections without articulating why; rewrite voice/style (preserve the {vocabulary.note}'s character); make changes without approval in interactive mode; create wiki links to non-existent files.

**Always:** present proposals before editing (interactive mode); explain rationale for each change; preserve what is still valid; log significant claim changes; verify link targets exist.

---

## Handoff Mode (--handoff flag)

When invoked with `--handoff`, output this structured format at the END of the session. This enables external loops (/ralph) to parse results and update the task queue.

**Detection:** Check if `$ARGUMENTS` contains `--handoff`. If yes, append this block after completing normal workflow.

**Handoff format:**

```
=== RALPH HANDOFF: {vocabulary.revisit} ===
Target: [[note name]]

Work Done:
- Older {vocabulary.note_plural} updated: N
- Claim status: unchanged | sharpened | challenged | split
- Network effect: M new traversal paths

Files Modified:
- {vocabulary.knowledge}/[older note 1].md (inline link added)
- {vocabulary.knowledge}/[older note 2].md (footer connection added)
- [task file path] ({vocabulary.revisit} section)

Learnings:
- [Friction]: [description] | NONE
- [Surprise]: [description] | NONE
- [Methodology]: [description] | NONE
- [Process gap]: [description] | NONE

Queue Updates:
- Advance phase: {vocabulary.revisit} -> {vocabulary.verify}
=== END HANDOFF ===
```

### Task File Update (when invoked via ralph loop)

When running in handoff mode via /ralph, the prompt includes the task file path. After completing the workflow, update the `## {vocabulary.revisit}` section of that task file with:
- Older {vocabulary.note_plural} updated and why
- Claim status (unchanged/sharpened/challenged/split)
- Network effect summary

**Critical:** The handoff block is OUTPUT, not a replacement for the workflow. Do the full revisit workflow first, update task file, then format results as handoff.

### Queue Update (interactive execution)

When running interactively (NOT via /ralph), YOU must advance the phase in the queue. /ralph handles this automatically, but interactive sessions do not.

**After completing the workflow, advance the phase:**

```bash
# get timestamp
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# advance phase (current_phase -> next, append to completed_phases)
# NEXT_PHASE is the phase after revisit in phase_order (i.e., verify)
jq '(.tasks[] | select(.id=="TASK_ID")).current_phase = "{vocabulary.verify}" |
    (.tasks[] | select(.id=="TASK_ID")).completed_phases += ["{vocabulary.revisit}"]' \
    ops/queue/queue.json > tmp.json && mv tmp.json ops/queue/queue.json
```

The handoff block's "Queue Updates" section is not just output — it is your own todo list when running interactively.

## Pipeline Chaining

After revisiting completes, output the next step based on `ops/config.yaml` pipeline.chaining mode:

- **manual:** Output "Next: {vocabulary.cmd_verify} [note]" — user decides when to proceed
- **suggested:** Output next step AND advance task queue entry to `current_phase: "{vocabulary.verify}"`
- **automatic:** Queue entry advanced and verification proceeds immediately

The chaining output uses domain-native command names from the derivation manifest.
