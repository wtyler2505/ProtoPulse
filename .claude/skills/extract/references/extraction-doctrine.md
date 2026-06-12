# Extraction Doctrine (Reference for /extract)

> Read before EXECUTE NOW steps 3-7. This is the full extraction methodology: categories, selectivity gate, workflow, note schema, chunking, enrichment, quality gates, note design, composability, provenance, and worked examples. The mission/calibration contract, handoff format, and queue/batch contracts live in SKILL.md.

# Reduce

Extract composable {vocabulary.note_plural} from source material into {vocabulary.notes}/.

## Philosophy

**Extract the REASONING behind what works, not just observations about what works.**

This is the extraction phase of the pipeline. You receive raw content and extract insights that serve the vault's domain. The mission is building **externalized, retrievable reasoning** — a graph of atomic propositions that can be traversed, connected, and built upon.

**THE CORE DISTINCTION:**

| Concept | Example | What to Extract |
|---------|---------|-----------------|
| **We DO this** | "We tag notes with topics" | — (not sufficient) |
| **We explain WHY** | "topic tagging enables cross-domain navigation because..." | This |

The vault is not just an implementation. It is **the articulated argument for WHY the implementation works.**

**THE EXTRACTION QUESTION:**

- BASIC thinking: "Is this a standalone composable claim?"
- BETTER thinking: "Does this serve {vocabulary.domain}?"
- BEST thinking: **"Would a future session benefit from this reasoning being a retrievable {vocabulary.note}?"**

If YES -> extract to appropriate category (even if "we already know this")
If NO -> skip (RARE for domain-relevant sources — verify it is truly off-topic)

**THE RULE:** Implementation without articulation is incomplete. If we DO something but lack a {vocabulary.note} explaining WHY it works, that articulation needs extraction.

---

## Extraction Categories

### What To Extract

| Category | What to Find | Output Type |
|----------|-------------|-------------|
| architectural-decision | Design choices, trade-offs, reasoning behind structural decisions | insight |
| bug-pattern | Bugs encountered, root causes, fix patterns, prevention strategies | insight |
| implementation-detail | How features were built, edge cases, non-obvious approaches | insight |
| dependency-knowledge | Library gotchas, version constraints, integration patterns | insight |
| convention | Code patterns, naming, style decisions specific to ProtoPulse | insight |
| gotcha | Non-obvious behaviors, traps, things that will bite you later | insight |
| optimization | Performance findings, bottleneck resolutions | insight |
| testing-pattern | Test strategies, mock patterns, coverage approaches | insight |

**The structural invariant:** Every domain's extraction has these universal categories regardless of domain:

| Category | What to Find | Output Type | Gate Required? |
|----------|--------------|-------------|----------------|
| Core domain {vocabulary.note_plural} | Direct assertions about {vocabulary.domain} | {vocabulary.note} | NO |
| Patterns | Recurring structures across sources | {vocabulary.note} | NO |
| Comparisons | How different approaches compare, X vs Y, trade-offs | {vocabulary.note} | NO |
| Tensions | Contradictions, conflicts, unresolved trade-offs | tension note | NO |
| Anti-patterns | What breaks, what to avoid, failure modes | problem note | NO |
| Enrichments | Content that adds detail to existing {vocabulary.note_plural} | enrichment task | NO |
| Open questions | Unresolved questions worth tracking | {vocabulary.note} (open) | NO |
| Implementation ideas | Techniques, workflows, features to build | methodology note | NO |
| Validations | Evidence confirming an approach works | {vocabulary.note} | NO |
| Off-topic general content | Insight unrelated to {vocabulary.domain} | apply selectivity gate | YES |

**IMPORTANT:** Categories 1-9 bypass the selectivity gate. They extract directly to the appropriate output type. The selectivity gate exists ONLY for filtering off-topic content from general sources.

### Category Detection Signals

Hunt for these signals in every source:

**Core domain signals:**
- Direct assertions: "the key insight is...", "this means that...", "the pattern is..."
- Evidence: "research shows...", "data indicates...", "studies confirm..."
- Named methods: any named system, technique, or framework relevant to {vocabulary.domain}

**Comparison signals:**
- "X vs Y", "trade-off between...", "prefer X when...", "unlike Y, this..."
- "choose X when...", "depends on whether..."

**Tension signals:**
- "contrary to...", "however...", "the problem with...", "fails when..."
- "on the other hand...", "but this conflicts with..."

**Anti-pattern signals:**
- "systems fail when...", "the anti-pattern is...", "avoid this because..."
- Warnings, cautionary examples, failure postmortems

**Enrichment signals:**
- Content covering ground similar to an existing {vocabulary.note}
- New examples, evidence, or framing for an established claim
- Deeper explanation of something already captured shallowly

**Implementation signals:**
- "we could build...", "would enable...", "a tool that...", "pattern for..."
- Actionable techniques, concrete workflows

**Validation signals:**
- "this supports...", "evidence shows...", "validates...", "confirms..."
- Research that grounds existing practice in theory

### The Mission Lens (REQUIRED)

For EVERY candidate, ask: **"Does this serve {vocabulary.domain}?"**

- YES -> **extract to appropriate category** (gate does NOT apply)
- NO -> apply selectivity gate (for off-topic filtering only)

**For domain-relevant sources:** almost everything is YES. The gate barely applies. Skip rate < 10%.

---

## The Selectivity Gate (for OFF-TOPIC content filtering)

**CRITICAL:** This gate exists to filter OUT content that does not serve {vocabulary.domain}. It applies ONLY to standard claims from GENERAL (off-topic) sources.

**Do NOT use gate to reject:**
- Implementation ideas ("not a claim" is WRONG — it is roadmap)
- Tensions ("not a claim" is WRONG — it is wisdom)
- Enrichments ("duplicate" is WRONG — it adds detail)
- Validations ("already known" is WRONG — it is evidence)
- Open questions ("not testable" is WRONG — it is direction)

For STANDARD claims from general sources, verify all four criteria pass:

### 1. Standalone

The claim is understandable without source context. Someone reading this {vocabulary.note} cold can grasp what it argues without needing to know where it came from.

Fail: "the author's third point about methodology"
Pass: "explicit structure beats implicit convention"

### 2. Composable

This {vocabulary.note} would be linked FROM elsewhere. {vocabulary.note_plural} function as APIs. If you cannot imagine writing `since [[this claim]]...` in another {vocabulary.note}, it is not composable.

Fail: a summary of someone's argument
Pass: a claim you could invoke while building your own argument

### 3. Novel

Not already captured in the vault. Semantic duplicate check AND existing {vocabulary.note_plural} scan both clear.

Fail: semantically equivalent to an existing {vocabulary.note}
Pass: genuinely new angle not yet articulated

### 4. Connected

Relates to existing thinking in the vault. Isolated insights that do not connect to anything are orphans. They rot.

Fail: interesting observation about unrelated domain
Pass: extends, contradicts, or deepens existing {vocabulary.note_plural}

**If ANY criterion fails: do not extract.**

---

## Workflow

### 1. Orient

Before reading the source, understand what already exists:

```bash
# Get descriptions from existing notes
for f in {vocabulary.notes}/*.md; do
  [[ -f "$f" ]] && echo "=== $(basename "$f" .md) ===" && rg "^description:" "$f" -A 0
done
```

Scan descriptions to understand current {vocabulary.note_plural}. This prevents duplicate extraction and helps identify connection points and enrichment opportunities.

### 2. Read Source Fully

Read the ENTIRE source. Understand what it contains, what it argues, what domain it serves.

**Planning the extraction:**
- How many {vocabulary.note_plural} do you expect from this source?
- What categories will be represented?
- Is this domain-relevant (comprehensive extraction) or general (gate applies)?

**Explicit signal phrases to hunt:**
- "the key insight is..."
- "this means that..."
- "the pattern is..."
- "contrary to..."
- "the implication..."
- "what matters here is..."
- "the real issue is..."
- "this suggests..."

**Implicit signals (the best insights often hide in):**
- Problems that imply solutions
- Constraints that reveal what works
- Failures that suggest approaches
- Asides that contain principles
- Tangents that reveal mental models

**What you are hunting:**
- Assertions that could be argued for or against
- Patterns that apply beyond this specific source
- Insights that change how you think about something
- Claims that would be useful to invoke elsewhere

### 3. Categorize FIRST, Then Route (MANDATORY)

**STOP. Before ANY filtering, determine the category of each candidate.**

This is the critical step that prevents over-rejection. Categorize FIRST, then route to the appropriate extraction path.

| Category | How to Identify | Route To |
|----------|-----------------|----------|
| Core domain {vocabulary.note} | Direct assertion about {vocabulary.domain} | -> {vocabulary.note} (SKIP selectivity gate) |
| Implementation idea | Describes a feature, tool, system, or workflow to build | -> methodology note (SKIP selectivity gate) |
| Tension/challenge | Describes a conflict, risk, or trade-off | -> tension note (SKIP selectivity gate) |
| Validation | Evidence confirming an approach works | -> {vocabulary.note} (SKIP selectivity gate) |
| Near-duplicate | Semantic search finds related vault {vocabulary.note} | -> evaluate for enrichment task |
| Off-topic claim | General insight not about {vocabulary.domain} | -> apply selectivity gate |

**CRITICAL:** Implementation ideas, tensions, validations, and domain {vocabulary.note_plural} do NOT need to pass the 4-criterion selectivity gate. The gate is for off-topic filtering ONLY.

**Why this matters:** The selectivity gate was designed for filtering general insights. But implementation ideas ("build a trails feature"), tensions ("optimization vs readability trade-off"), and validations ("research confirms our approach") are DIFFERENT output types that serve different purposes. Applying the selectivity gate to them is a category error.

### 4. Semantic Search for Duplicates and Enrichment

For each candidate, run duplicate detection:

```
mcp__qmd__qmd_vector_search  query="[proposed claim as sentence]"  collection="protopulse-vault"  limit=5
```
If MCP is unavailable, run:
```bash
qmd query --collection protopulse-vault "[proposed claim as sentence]" -n 5
```
If qmd CLI is unavailable, fall back to keyword grep duplicate checks.

**Why `qmd_vector_search` (vector semantic) instead of keyword search:** Duplicate detection is where keyword search fails hardest. A claim about "friction in systems" will not find "resistance to change" via keyword matching even though they may be semantic duplicates. Vector search (~5s) catches same-concept-different-words duplicates that keyword search misses entirely. For a batch of 30-50 candidates, this adds ~3 minutes total — worth it to catch duplicates early rather than discovering them during {vocabulary.cmd_reflect}.

**Scores are signals, not decisions.** For ANY result with a relevant title or snippet:

1. **READ the full {vocabulary.note}**
2. Compare: is this the SAME claim in different words?
3. Ask: **"What does source add that existing {vocabulary.note} lacks?"**

**The Enrichment Judgment (DEFAULT TO ENRICHMENT):**

| Situation | Action |
|-----------|--------|
| Exact text already exists | SKIP (truly identical — RARE) |
| Same claim, different words, source adds nothing | SKIP (verify by re-reading existing {vocabulary.note}) |
| Same claim, source has MORE detail/examples/framing | -> ENRICHMENT TASK (update existing {vocabulary.note}) |
| Same topic, DIFFERENT claim | -> EXTRACT as new {vocabulary.note}, flag for cross-linking |
| Related mechanism, different scope | -> EXTRACT as new {vocabulary.note}, flag for cross-linking |

**DEFAULT TO ENRICHMENT.** If source mentions the same topic, it almost certainly adds something. Truly identical content is RARE.

**MANDATORY protocol when semantic search finds overlap:**

1. **READ the existing {vocabulary.note} fully** (not just title/description)
2. Ask: "What does source ADD that existing {vocabulary.note} LACKS?"
   - New examples -> ENRICHMENT
   - Deeper framing -> ENRICHMENT
   - Citations/evidence -> ENRICHMENT
   - Different angle -> ENRICHMENT
   - Concrete implementation -> ENRICHMENT
   - Literally identical -> skip (RARE)
3. If source adds ANYTHING: **CREATE ENRICHMENT TASK**
4. Only skip if source adds literally NOTHING new (verify this claim)

**Near-duplicates are opportunities, not rejections.** Creating enrichment tasks is CORRECT behavior. If you are skipping near-duplicates without enrichment tasks, you are probably wrong.

### 5. Classify Each Extraction

Every extracted candidate gets classified:

- **CLOSED** — standalone claim, design decision, ready for processing as-is
- **OPEN** — needs more investigation, testable hypothesis, requires evidence

Classification affects downstream handling but does NOT affect whether to extract. Both open and closed candidates get extracted.

### 6. Present Findings

Report what you found by category. **Include counts:**

```
Extraction scan complete.

SUMMARY:
- {vocabulary.note_plural}: N
- implementation ideas: N
- tensions: N
- enrichment tasks: N
- validations: N
- open questions: N
- skipped: N
- TOTAL OUTPUTS: N

---

CLAIMS ({vocabulary.note_plural}):
1. [claim as sentence] — connects to [[existing note]]
2. [claim as sentence] — extends [[existing note]]
...

IMPLEMENTATION IDEAS (methodology notes):
1. [feature/pattern] — what it enables, why it matters
...

TENSIONS (tension notes):
1. [X vs Y] — the conflict, why it matters
...

ENRICHMENT TASKS (update existing {vocabulary.note_plural}):
1. [[existing note]] — source adds [what is missing]
...

SKIPPED (truly nothing to add):
- [description] — why nothing extractable
```

**Wait for user approval before creating files.** Never auto-extract.

### 7. Extract (With User Approval)

For each approved {vocabulary.note}:

**a. Craft the title**

The title IS the claim. Express the concept in exactly the words that capture it.

Test: "this {vocabulary.note} argues that [title]"
- Must make grammatical sense
- Must be something you could agree or disagree with
- Composability over brevity — a full sentence is fine if the concept requires it
- Lowercase with spaces
- No punctuation that breaks filesystems: . * ? + [ ] ( ) { } | \ ^

Good: "explicit structure beats implicit convention for agent navigation"
Good: "small differences compound through repeated selection"
Bad: "context management strategies" (topic label, not a claim)

**b. Write the {vocabulary.note}**

> **Frontmatter schema (canonical): the `_schema` block in `ops/config.yaml`** — the union of v2-preferred and legacy-accepted values, enforced by `/vault-validate --mode gate` (formerly `/vault-quality-gate`, now merged into vault-validate). JSON mirror: `.claude/skills/vault-validate/assets/frontmatter-v2.schema.json`.
>
> Extract always writes v2-preferred values. Legacy values in older notes WARN at the gates rather than FAIL — never write them for new notes.
>
> Hard rules:
> - `description` MUST be ≤140 characters (tooltip-grade — it powers `<VaultHoverCard>`)
> - `type` MUST be one of `{claim, pattern, reference, moc, meta}`. Map nuanced categories:
>   - methodology / implementation-pattern / architecture-decision / convention / gotcha / ux-pattern → `pattern`
>   - concept / definition / taxonomy / open-question → `reference`
>   - tension → `claim`
>   - topic-map → `moc`
> - `topics` MUST be an array of bare slugs (NOT wiki-linked). At least one topic MUST resolve to an existing `knowledge/<slug>.md` MOC file.
> - `confidence: verified` MUST be accompanied by a `provenance` array with at least one source. Use `supported` if you cannot cite.

```markdown
---
name: [file-stem slug — must match filename]
description: [≤140 chars elaborating the claim, adds info beyond title — tooltip-grade]
type: claim | pattern | reference | moc | meta
topics:
  - [bare-slug-of-existing-moc]       # at least one MUST resolve to knowledge/<slug>.md
  - [additional-bare-slug]             # no [[brackets]], lowercase-kebab-case
audience:                               # optional; powers progressive disclosure
  - beginner | intermediate | expert
confidence: speculative | emerging | supported | verified | established
provenance:                             # REQUIRED when confidence == verified
  - source: datasheet | standard | community | vendor-doc | textbook | paper | experiment | code | other
    url: https://...                    # optional but preferred
    page: [integer or section id]       # optional
related:                                # optional; mirrors wiki-links in body
  - [bare-slug]
created: YYYY-MM-DD
---

# [prose-as-title proposition]

[Body: 150-400 words showing reasoning]

Use connective words: because, but, therefore, which means, however.
Acknowledge uncertainty where appropriate.
Consider the strongest counterargument.
Show the path to the conclusion, not just the conclusion.

## Evidence

[Cite primary sources inline or via URL links. If you listed provenance in frontmatter, cross-reference here.]

## Application

[When to use this claim / how it applies in practice. Pedagogy lives here.]

---

Source: [[source-file-stem]]

Relevant Notes:
- [[related-claim-bare-slug]] — [why it relates: extends, contradicts, builds on]
```

**c. Verify before writing (v2-compliance checklist)**

- [ ] Title passes the claim test ("this note argues that [title]")
- [ ] `name` matches the file stem exactly (no extension, no brackets)
- [ ] `description` is ≤140 chars AND adds information beyond the title (not a restatement)
- [ ] `type` is one of `{claim, pattern, reference, moc, meta}` (map per table above)
- [ ] `topics` is an array of bare slugs (no `[[...]]` wrapping)
- [ ] At least one topic resolves to an existing `knowledge/<topic>.md` file (run `ls knowledge/ | grep -F "<topic>"` to verify)
- [ ] If `confidence: verified`, `provenance` has ≥1 entry with `source` + ideally `url`
- [ ] Body has ≥2 cross-links (`[[wiki]]` or `knowledge/<slug>.md`)
- [ ] Body has either `## Evidence` / `## Why` section OR at least one URL citation OR a provenance entry
- [ ] Source attribution present

**Fallback if uncertain:** use `type: reference` and `confidence: supported` — these are the safest defaults and won't block the gate.

**d. Create the file**

Write to: `{vocabulary.notes}/[title].md`

---

## Large Source Handling

**For sources exceeding 2500 lines: chunk processing is MANDATORY.**

Context degrades as it fills. A single-pass extraction of a 3000-line source will miss insights in the later sections because your attention has degraded by the time you reach them. Chunking ensures each section gets fresh attention.

### Chunking Strategy

| Source Size | Chunk Count | Chunk Size | Rationale |
|-------------|------------|------------|-----------|
| 2500-4000 lines | 3-4 chunks | 700-1200 lines | Standard chunking |
| 4000-6000 lines | 4-5 chunks | 800-1200 lines | Balanced attention |
| 6000+ lines | 5+ chunks | 1000-1500 lines | Prevent context overflow |

**Chunk boundaries:** Split at natural section breaks (headings, topic transitions). Never split mid-paragraph or mid-argument. A chunk should be a coherent unit of content.

### Processing Depth Adaptation

| Depth (from config) | Chunking Behavior |
|---------------------|-------------------|
| deep | Fresh context per chunk (spawn subagent per chunk if platform supports). Maximum quality. |
| standard | Process chunks sequentially in current session. Reset orientation between chunks. |
| quick | Larger chunks (1500-2000 lines). Fewer, faster passes. |

### Cross-Chunk Coordination

When processing in chunks:
1. Keep a running list of extracted {vocabulary.note_plural} across chunks
2. Later chunks check against earlier chunks' extractions (not just existing vault {vocabulary.note_plural})
3. Cross-chunk connections get flagged for {vocabulary.cmd_reflect}
4. The final extraction report covers ALL chunks combined

**The anti-pattern:** Processing chunk 3 and extracting a duplicate of something already extracted in chunk 1 because you lost track. Maintain the running list.

---

## Enrichment Detection

When source content adds value to an EXISTING {vocabulary.note} rather than creating a new one, create an enrichment task instead.

### When to Create Enrichment Tasks

| Signal | Action |
|--------|--------|
| Source has better examples for an existing {vocabulary.note} | Enrichment: add examples |
| Source has deeper framing or context | Enrichment: strengthen reasoning |
| Source has citations or evidence | Enrichment: add evidence base |
| Source has a different angle on the same claim | Enrichment: add perspective |
| Source has concrete implementation details | Enrichment: add actionable specifics |

### Enrichment Task Format

Each enrichment task specifies:
- **Target:** Which existing {vocabulary.note} to enrich (by title)
- **What to add:** Specific content from the source
- **Why:** What the existing {vocabulary.note} lacks that this adds
- **Source lines:** Where in the source the enrichment content is found

**The enrichment default:** When in doubt between "new {vocabulary.note}" and "enrichment to existing {vocabulary.note}", lean toward enrichment. The existing {vocabulary.note} already has connections, {vocabulary.topic_map} placement, and integration. Adding to it compounds existing value.

---

## Quality Gates

### Red Flags: Extraction Too Tight (THE COMMON FAILURE MODE)

**If you catch yourself doing ANY of these, STOP IMMEDIATELY and recalibrate:**

#### The Cardinal Sins (NEVER do these)

1. **"validates existing approach" as skip reason**
   - WRONG: "This just confirms what we do, skip"
   - RIGHT: Validations ARE valuable. Extract as {vocabulary.note} with evidence framing.
   - WHY: Future sessions need to see WHY an approach is validated, not just that it works.

2. **"already captured in system config" as skip reason**
   - WRONG: "We already have this in our config, skip"
   - RIGHT: Extract "session handoff creates continuity without persistent memory"
   - WHY: Config is implementation. {vocabulary.note_plural} explain WHY it works.

3. **"we already do this" as skip reason**
   - WRONG: "We use wiki links, this is obvious, skip"
   - RIGHT: Extract the reasoning that explains WHY it works
   - WHY: DOING is not EXPLAINING. The reasoning needs externalization.

4. **"obvious" or "well known" as skip reason**
   - WRONG: "Everyone knows structure helps, skip"
   - RIGHT: Extract the specific, named, referenceable claim
   - WHY: Named patterns are referenceable. Unnamed intuitions are not.

5. **Treating near-duplicates as skips instead of enrichments**
   - WRONG: "Similar to existing note, skip"
   - RIGHT: Create enrichment task to add source's details to existing {vocabulary.note}
   - WHY: Near-duplicates almost always add framing, examples, or evidence.

#### Other Red Flags

- Rejecting implementation ideas as "not claims" (they ARE extractable as methodology notes)
- Rejecting tensions as "not claims" (they become tension notes)
- Zero extraction from a domain-relevant source (the source IS about your domain)
- Rejecting open questions as "not testable" (directions guide future work)
- Applying the 4-criterion gate to non-standard-claim categories (gate is for off-topic filtering)
- Skip rate > 10% on domain-relevant sources (most domain content should extract to SOME category)

#### The Test

Before skipping ANYTHING, ask: **"Would a future session benefit from this being a retrievable {vocabulary.note}?"**

If YES -> extract (even if "we already know this")
If NO -> verify it is truly off-topic or literally identical to existing content

### Red Flags: Extraction Too Loose

- Extracting vague observations with no actionable content
- Creating {vocabulary.note_plural} without articulating vault connection
- Titles that are topics, not claims ("knowledge management" instead of "knowledge management fails without active maintenance")
- Body text that is pure summary without reasoning

### Calibration Check (REQUIRED Before Finishing)

**STOP before outputting results.** Count your outputs by category:

```
{vocabulary.note_plural} extracted: ?
implementation ideas: ?
tensions: ?
enrichment tasks: ?
validations: ?
open questions: ?
truly skipped: ?
TOTAL: ?
```

**Expected yields by source size:**

| Source Size | Expected Outputs | Skip Rate |
|-------------|------------------|-----------|
| ~100 lines | 5-10 outputs | varies by relevance |
| ~350 lines | 15-30 outputs | < 10% for domain-relevant |
| ~500+ lines | 25-50+ outputs | < 10% for domain-relevant |
| ~1000+ lines | 40-70 outputs | < 5% for domain-relevant |

**Zero extraction from a domain-relevant source is a BUG.**

**If your total outputs are significantly below these ranges, you are over-filtering.**

### Selectivity Adaptation

Processing selectivity adapts based on `ops/config.yaml`:

| Selectivity (config) | Gate Behavior | Skip Rate Target |
|----------------------|---------------|-----------------|
| strict | 4-criterion gate applies to ALL claims including domain-relevant | Higher skip rate acceptable |
| moderate (default) | Gate applies only to off-topic content. Domain-relevant bypasses gate | < 10% for domain sources |
| permissive | Gate barely applies. Extract nearly everything, heavy enrichment | < 5% overall |

**Strict mode** is for mature vaults where noise reduction matters more than coverage.
**Permissive mode** is for new vaults building initial density.
**Moderate** is the default — comprehensive extraction for domain content, selective for off-topic.

### Mandatory Review If Low Yield

Go back through candidates you marked as "duplicate" or "rejected":

1. **Did any "duplicates" have source content that enriches existing {vocabulary.note_plural}?**
   - YES -> convert to enrichment task (DEFAULT TO ENRICHMENT)
   - NO -> verify by re-reading existing {vocabulary.note} FULLY

2. **Did any "rejected" items describe features to build?**
   - YES -> extract as implementation idea
   - NO -> verify it is truly unactionable

3. **Did any "rejected" items describe conflicts or challenges?**
   - YES -> extract as tension note
   - NO -> verify it is truly vague

4. **Did any "rejected" items provide evidence for existing approaches?**
   - YES -> extract as validation claim
   - NO -> verify it does not support existing methodology

5. **Did any "rejected" items suggest questions worth investigating?**
   - YES -> extract as open question {vocabulary.note}
   - NO -> verify it is not worth tracking

**Do not proceed with handoff until low yield is investigated.**

---

## Note Design Reference

### Titles

Titles are claims that work as prose when linked:

```
since [[explicit structure beats implicit convention]], the question becomes...
the insight is that [[small differences compound through repeated selection]]
because [[capture speed beats filing precision]], we separate the two...
```

The claim test: "this {vocabulary.note} argues that [title]"

| Example | Passes? |
|---------|---------|
| quality requires active judgment | yes: "argues that quality requires active judgment" |
| knowledge management | no: "argues that knowledge management" (incomplete) |
| small differences compound through selection | yes: "argues that small differences compound through selection" |
| tools for thought | no: "argues that tools for thought" (incomplete) |

### Description

One field. ~150 characters. Must add NEW information beyond the title — scope, mechanism, or implication.

Bad (restates title): "quality is important in knowledge work"
Good (adds mechanism + implication): "when creation becomes trivial, maintaining signal-to-noise becomes the primary challenge — selection IS the work"

The description is progressive disclosure: title says WHAT the claim is, description says WHY it matters or HOW it works. If the description just rephrases the title, it wastes context and provides no filter value.

### Body

Show reasoning. Use connective words. Acknowledge uncertainty.

Bad:
> Quality matters. When creation is easy, curation becomes the work.

Good:
> The easy part is capture. We bookmark things, save screenshots, clip articles we never open again. The hard part is doing something with it all. Automation makes this worse because generation is now trivial — anyone can produce endless content. So the constraint shifts from production to selection. Since [[structure without processing provides no value]], the question becomes: who does the selecting?

Characteristics:
- Conversational flow (because, but, therefore)
- Shows path to conclusion
- Acknowledges where thinking might be wrong
- Considers strongest objection
- Invokes other {vocabulary.note_plural} as prose

### Section Headings

Headings serve navigation, not decoration. Use when agents would benefit from grepping the outline.

**Always use headings for:**
- Tension notes (sections: Quick Test, When Each Pole Wins, Dissolution Attempts, Practical Applications)
- {vocabulary.topic_map} notes (sections: Synthesis, Core Ideas, Tensions, Explorations Needed, Agent Notes)
- Implementation patterns with discrete steps
- Notes exploring multiple facets of a concept (>1000 words AND distinct sub-topics)

**Use prose without headings for:**
- Single flowing arguments under ~1000 words
- Notes where transitions like "since [[X]]..." already carry structure

### Footer

```markdown
---

Source: [[source filename]]

Relevant Notes:
- [[related claim]] — extends this by adding the temporal dimension

Topics:
- [[relevant {vocabulary.topic_map}]]
```

The relationship context explains WHY to follow the link:
- Bad: "-- related"
- Good: "-- contradicts by arguing for explicit structure"
- Good: "-- provides the foundation this challenges"

---

## The Composability Test

Before finalizing ANY {vocabulary.note}, verify:

**1. Standalone Sense**
If you link to this {vocabulary.note} from another context, will it make sense without reading three other {vocabulary.note_plural} first?

**2. Specificity**
Could someone disagree with this claim? Vague {vocabulary.note_plural} cannot be built on.

**3. Clean Linking**
Would linking to this {vocabulary.note} drag unrelated content along? If yes, the {vocabulary.note} covers too much.

**When to skip:** content does not pass all four selectivity criteria (off-topic content only)
**When to split:** multiple distinct claims in one extraction
**When to sharpen:** claim too vague, title is label not statement

---

## Research Provenance

When the source file contains provenance metadata (source_type, research_prompt, research_server, generated), preserve the chain:

- Each created {vocabulary.note}'s Source footer links to the source file
- The source file's YAML contains the research prompt
- The chain: research query -> inbox file -> /{vocabulary.reduce} -> {vocabulary.notes}

If source has `source_type` in frontmatter, this is research-generated content — handle with extra care for attribution.

**Provenance fields to preserve:**

| Field | Purpose |
|-------|---------|
| source_type | How this content was generated |
| research_prompt | The query or directive that produced this content |
| research_server | Which research tool was used |
| generated | When the research was produced |

The research_prompt is the most critical field — it captures the intellectual context that shaped what was returned. Knowing "I searched for X because I was exploring Y" is part of the knowledge graph.

---

## Example: What Good Extraction Looks Like

### Example 1: 300-line domain-relevant source

**Source:** 300-line research document directly relevant to {vocabulary.domain}

**Scan found:** ~45 items across sections

**Extraction results:**
- 12 core {vocabulary.note_plural}
- 6 implementation ideas -> methodology notes
- 4 tensions -> tension notes
- 5 enrichment tasks -> update existing {vocabulary.note_plural}
- 3 validations -> {vocabulary.note_plural}
- 3 skipped (too vague to act on)

**Total: 30 outputs, 3 skipped (~9% skip rate)**

### Example 2: 100-line general article

**Source:** 100-line article with partial relevance to {vocabulary.domain}

**Extraction results:**
- 4 core {vocabulary.note_plural}
- 1 enrichment task
- 2 skipped (off-topic)
- 3 skipped (too vague)

**Total: 5 outputs, 5 skipped (50% skip rate — acceptable for general source)**

### Contrast: WRONG Behavior

- 45 candidates -> 0 outputs (everything "rejected as duplicate or not a claim")
- Treating implementation ideas as "not claims" and skipping
- Treating tensions as "not claims" and skipping
- Treating near-duplicates as skips instead of enrichment tasks
- Skip rate > 10% on a domain-relevant source
