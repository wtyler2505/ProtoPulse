# Connection Patterns (Reference for /connect)

> Read before evaluating or adding connections. Contains the full philosophy, phase-by-phase methodology (Phases 1, 3-6), edge cases, and success criteria. Phase 0 (index freshness) and Phase 2 (dual discovery + qmd three-tier fallback) live in `../../shared-references/dual-discovery.md`. The Reweave Task Filtering table, quality gates, output format, and handoff contract stay in SKILL.md.

## Philosophy

**The network IS the knowledge.**

Individual {vocabulary.note_plural} are less valuable than their relationships. A {vocabulary.note} with fifteen incoming links is an intersection of fifteen lines of thought. Connections create compound value as the vault grows.

This is not keyword matching. This is semantic judgment — understanding what {vocabulary.note_plural} MEAN to determine how they relate. A {vocabulary.note} about "friction in systems" might deeply connect to "verification approaches" even though they share no words. You are building a traversable knowledge graph, not tagging documents.

**Quality over speed. Explicit over vague.**

Every connection must pass the articulation test: can you say WHY these {vocabulary.note_plural} connect? "Related" is not a relationship. "Extends X by adding Y" or "contradicts X because Z" is a relationship.

Bad connections pollute the graph. They create noise that makes real connections harder to find. When uncertain, do not connect.

## Phase 1: Understand What You Are Connecting

Before searching for connections, deeply understand the source material.

For each {vocabulary.note} you are connecting:
1. Read the full {vocabulary.note}, not just title and description
2. Identify the core claim and supporting reasoning
3. Note key concepts, mechanisms, implications
4. Ask: what questions does this answer? What questions does it raise?

**What you are looking for:**
- The central argument (what is being claimed?)
- The mechanism (why/how does this work?)
- The implications (what follows from this?)
- The scope (when does this apply? When not?)
- The tensions (what might contradict this?)

**If a task file exists** (pipeline execution): read the task file to see what the extraction phase discovered. The reduce notes, semantic neighbor field, and classification provide critical context about why this {vocabulary.note} was extracted and what it relates to.

## Phase 3: Evaluate Connections

For each candidate connection, apply the articulation test.

**The Articulation Test:**

Complete this sentence:
> [[note A]] connects to [[note B]] because [specific reason]

If you cannot fill in [specific reason] with something substantive, the connection fails.

**Valid Relationship Types:**

| Relationship | Signal | Example |
|-------------|--------|---------|
| extends | adds dimension | "extends [[X]] by adding temporal aspect" |
| grounds | provides foundation | "this works because [[Y]] establishes..." |
| contradicts | creates tension | "conflicts with [[Z]] because..." |
| exemplifies | concrete instance | "demonstrates [[W]] in practice" |
| synthesizes | combines insights | "emerges from combining [[A]] and [[B]]" |
| enables | unlocks possibility | "makes [[C]] actionable by providing..." |

**Reject if:**
- The connection is "related" without specifics
- You found it through keyword matching alone with no semantic depth
- Linking would confuse more than clarify
- The relationship is too obvious to be useful

**Agent Traversal Check:**

Ask: **"If an agent follows this link, what do they gain?"**

| Agent Benefit | Keep Link |
|---------------|-----------|
| Provides reasoning foundation (why something works) | YES |
| Offers implementation pattern (how to do it) | YES |
| Surfaces tension to consider (trade-off awareness) | YES |
| Gives concrete example (grounds abstraction) | YES |
| Just "related topic" with no decision value | NO |

The vault is built for agent traversal. Every connection should help an agent DECIDE or UNDERSTAND something. Connections that exist only because they feel "interesting" without operational value are noise.

**Synthesis Opportunity Detection:**

While evaluating connections, watch for synthesis opportunities — two or more {vocabulary.note_plural} that together imply a higher-order claim not yet captured.

Signs of a synthesis opportunity:
- Two {vocabulary.note_plural} make complementary arguments that combine into something neither says alone
- A pattern appears across three or more {vocabulary.note_plural} that has not been named
- A tension between two {vocabulary.note_plural} suggests a resolution claim

When you detect a synthesis opportunity:
1. Note it in the output report
2. Do NOT create the synthesis {vocabulary.note} during reflect — flag it for future work
3. Describe what the synthesis would argue and which {vocabulary.note_plural} contribute

## Phase 4: Add Inline Connections

Connections live in the prose, not just footers.

**Inline Links as Prose:**

The wiki link IS the argument. The title works as prose when linked.

Good patterns:
```markdown
Since [[other note]], the question becomes how to structure that memory for retrieval.

The insight that [[throughput matters more than accumulation]] suggests curation, not creation, is the real work.

This works because [[good systems learn from friction]] — each iteration improves the next.
```

Bad patterns:
```markdown
This relates to [[other note]].

See also [[throughput matters more than accumulation]].

As discussed in [[good systems learn from friction]], systems improve.
```

If you catch yourself writing "this relates to" or "see also", STOP. Restructure so the claim does the work.

**Where to add links:**

1. Inline in the body where the connection naturally fits the argument
2. In the relevant_notes YAML field with context phrase
3. BOTH when the connection is strong enough

**Relevant Notes Format:**

```yaml
relevant_notes:
  - "[[note title]] — extends this by adding the temporal dimension"
  - "[[another note]] — provides the mechanism this claim depends on"
```

Context phrases use standard relationship vocabulary: extends, grounds, contradicts, exemplifies, synthesizes, enables.

**Bidirectional Consideration:**

When adding [[A]] to [[B]], ask: should [[B]] also link to [[A]]?

Not always. Relationships are not always symmetric:
- "extends" often is not bidirectional
- "exemplifies" usually goes one direction
- "contradicts" is often bidirectional
- "synthesizes" might reference both sources

Add the reverse link only if following that path would be useful for agent traversal.

**Reweave Task Filtering:** when adding bidirectional links to older notes, apply the skip-filter table in SKILL.md (hub >5 incoming links, tension type, just-reweaved, topic map) before flagging for reweave — that table is a queue contract and lives in SKILL.md.

## Phase 5: Update {vocabulary.topic_map_plural}

{vocabulary.topic_map_plural} are synthesis hubs, not just indexes.

**When to update a {vocabulary.topic_map}:**

- New {vocabulary.note} belongs in Core Ideas
- New tension discovered
- Gap has been filled
- Synthesis insight emerged
- Navigation path worth documenting

**{vocabulary.topic_map} Size Check:**

After updating Core Ideas, count the links:

```bash
grep -c '^\- \[\[' "{vocabulary.notes}/[moc-name].md"
```

If approaching the split threshold (configurable, default ~40): note in output "{vocabulary.topic_map} approaching split threshold (N links)"
If exceeding: warn "{vocabulary.topic_map} exceeds recommended size — consider splitting"

Splitting is a human decision (architectural judgment required), but /connect should surface the signal.

**{vocabulary.topic_map} Structure:**

```markdown
# [Topic Name]

[Opening synthesis: Claims about the topic. Not "this {vocabulary.topic_map} collects {vocabulary.note_plural}" but "the core insight is Y because Z." This IS thinking, not meta-description.]

## Core Ideas

- [[claim note]] — what it contributes to understanding
- [[another claim]] — how it fits or challenges existing ideas

## Tensions

- [[claim A]] and [[claim B]] conflict because... [genuine unresolved tension]

## Gaps

- nothing about X aspect yet
- need concrete examples of Y
- missing: comparison with Z approach

---

Agent Notes:
- YYYY-MM-DD: [what was explored]. [the insight or dead end].
```

**Updating Core Ideas:**

Add new {vocabulary.note_plural} with context phrase explaining contribution:
```markdown
- [[new note]] — extends the quality argument by showing how friction teaches you what to check
```

Order matters. Place {vocabulary.note_plural} where they fit the logical flow, not alphabetically.

**Updating Tensions:**

If the new {vocabulary.note} creates or resolves tension:
```markdown
## Tensions

- [[composability]] demands small notes, but [[context limits]] means traversal has overhead. [[new note]] suggests the tradeoff depends on expected traversal depth.
```

Document genuine conflicts. Tensions are valuable, not bugs.

**Updating Gaps:**

Remove gaps that are now filled. Add new gaps discovered during reflection.

## Phase 6: Add Agent Notes

Agent notes are breadcrumbs for future navigation.

**Add agent notes when:**
- Non-obvious navigation path discovered
- Dead end worth documenting
- Productive {vocabulary.note} combination found
- Insight about topic cluster emerged

**Format:**
```markdown
Agent Notes:
- YYYY-MM-DD: [what was explored]. [the insight or finding].
```

**Good agent notes:**
```markdown
- 2026-02-15: tried connecting via "learning" — too generic. better path: friction -> verification -> quality. the mechanism chain is tighter.
- 2026-02-15: [[claim A]] and [[claim B]] form a tight pair. A sets the standard, B teaches the method.
```

**Bad agent notes:**
```markdown
- 2026-02-15: read the {vocabulary.topic_map} and added some links.
- 2026-02-15: connected [[note A]] to [[note B]].
```

The test: would this help a future agent navigate more effectively?

## Handling Edge Cases

### No Connections Found

Sometimes a {vocabulary.note} genuinely does not connect yet. That is fine.

1. Ensure it is linked to at least one {vocabulary.topic_map} via Topics footer
2. Note in {vocabulary.topic_map} Gaps that this area needs development
3. Do not force connections that are not there

### Too Many Connections (Split Detection)

If a {vocabulary.note} connects to 5+ {vocabulary.note_plural} across different domains, it might be too broad.

**Split detection criteria:**

1. **Domain spread:** Connections span 3+ distinct {vocabulary.topic_map_plural}/topic areas
2. **Multiple claims:** The {vocabulary.note} makes more than one assertion that could stand alone
3. **Linking drag:** You would want to link to part of the {vocabulary.note} but not all of it

**How to evaluate:**

Ask: "If I link to this {vocabulary.note} from context X, does irrelevant content Y come along?"

If yes, the {vocabulary.note} bundles multiple ideas that should be separate.

**Split detection output:**

```markdown
### Split Candidate: [[broad note]]

**Indicators:**
- Connects to 7 {vocabulary.note_plural} across 3 domains
- Makes distinct claims about: (1) capture workflows, (2) synthesis patterns, (3) tool selection
- Linking from [[note A]] would drag in unrelated content about tool selection

**Proposed split:**
- [[capture workflows matter less than synthesis]] — the first claim
- [[tool selection follows from workflow needs]] — the third claim
- Keep original {vocabulary.note} focused on synthesis patterns

**Action:** Flag for human decision, do not auto-split
```

**When NOT to split:**
- {vocabulary.note} is genuinely about one thing that touches many areas
- Connections are all variations of the same relationship
- Splitting would create {vocabulary.note_plural} too thin to stand alone

### Conflicting Notes

When new content contradicts existing {vocabulary.note_plural}:

1. Document the tension in both {vocabulary.note_plural}
2. Add to {vocabulary.topic_map} Tensions section
3. Do not auto-resolve — flag for judgment

### Orphan Discovery

If you find {vocabulary.note_plural} with no connections:

1. Flag them in your output
2. Attempt to connect them
3. If genuinely orphaned, note in relevant {vocabulary.topic_map} Gaps

## What Success Looks Like

Successful reflection:
- Every connection passes the articulation test
- Inline links read as natural prose
- {vocabulary.topic_map_plural} gain synthesis, not just entries
- Agent notes reveal non-obvious paths
- The knowledge graph becomes more traversable
- Future agents will navigate more effectively

The test: if someone follows the links you added, do they find genuinely useful context? Does the path illuminate understanding?

## The Network Grows Through Judgment

This skill is about building a knowledge graph that compounds in value. Every connection you add is a traversal path that future thinking can follow. Every connection you do not add keeps the graph clean.

Quality beats quantity. One genuine connection is worth more than ten vague ones.

The graph is not just storage. It is an external thinking structure. Build it with care.
