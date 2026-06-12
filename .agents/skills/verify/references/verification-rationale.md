# Verification Rationale (Reference for /verify)

> Read when diagnosing failures or questioning the method. The executable steps, scoring tables, schema checks, report format, and handoff contract live in SKILL.md — this file holds the WHY behind each check plus common failure patterns.

## philosophy

**verification is one concern, not three.**

recite tests whether the description enables retrieval. validate checks schema compliance. review checks graph health. all three operate on the same note, read the same frontmatter, and together answer one question: is this insight ready?

running them separately meant three context windows, three subagent spawns, three rounds of reading the same file. the checks are lightweight enough (combined context ~15-25% of window) that they fit comfortably in one session while staying in the smart zone.

> "the unit of verification is the insight, not the check type."

## execution order matters

**Recite MUST run first.** The cold-read prediction test requires forming an honest prediction from title + description BEFORE reading the full note. If validate or review ran first (both read the full note), the prediction would be contaminated. Recite's constraint: predict first, read second.

**Index freshness runs before everything.** The retrieval test in recite depends on semantic search having current data. Without a freshness check, recently created notes produce false retrieval failures that obscure actual description quality issues.

After recite reads the full note, validate and review can run in any order since they both need the full content.

## recite: description quality

the testing effect applied to vault quality. read only title + description, predict what the note argues, then check. if your prediction fails, the description fails.

**why this matters:** descriptions are the API of the vault. agents decide whether to load a note based on title + description. a misleading description causes two failure modes:
- **false positive:** agent reads the note expecting X, wastes context on Y
- **false negative:** agent skips the note because description doesn't signal relevance

both degrade the vault's value as a knowledge tool.

**retrieval test rationale:** agents find notes via semantic search during connect and revisit. testing with BM25 keyword matching tests the wrong retrieval method. full hybrid search with LLM reranking compensates for weak descriptions — too lenient. qmd_vector_search tests real semantic findability without hiding bad descriptions.

## validate: schema compliance

checks against the relevant template schema:

| Check | Requirement | Severity |
|-------|-------------|----------|
| `description` | Must exist, non-empty | FAIL |
| `topics` | Must exist; bare slugs preferred, wiki links accepted-legacy (WARN, never FAIL) per `ops/config.yaml` `_schema` | FAIL if missing |
| description length | < 200 chars | WARN |
| description content | Adds info beyond title | WARN |
| description format | No trailing period | WARN |
| domain enum fields | Valid values per `ops/config.yaml` `_schema` (type/confidence) or template `_schema.enums` | WARN |
| `relevant_notes` format | Array with context phrases | WARN |
| YAML integrity | Well-formed, `---` delimiters | FAIL |
| Composability | Title passes "This note argues that [title]" test | WARN |

**FAIL means fix needed. WARN is informational but worth addressing.**

**template discovery:** The skill reads the template for the note type to get its `_schema` block. If no template exists or no `_schema` block is found, fall back to the default checks above.

## review: per-note health

5 focused checks per note (not a full vault-wide audit):

1. **YAML frontmatter** — well-formed, has `---` delimiters, valid parsing
2. **Description quality** — present, adds info beyond title, not a restatement
3. **topic map connection** — appears in at least one topic map
4. **Wiki link count** — >= 2 outgoing links (graph participation threshold)
5. **Link resolution** — all wiki links point to existing files (full body scan, excluding backtick-wrapped examples)

plus 3 deep-only checks for comprehensive audits:
6. **Orphan risk** — incoming link count (is anything pointing here?)
7. **Content staleness** — does the content still seem accurate?
8. **Bundling** — does the note make multiple distinct claims?

## common failure patterns

| Pattern | Symptom | Fix |
|---------|---------|-----|
| Title restated as description | Recite score 1-2, prediction trivially correct but content is richer | Rewrite description to add mechanism/scope |
| Missing topic map | Review fails topic map check | Add to appropriate topic map or create Topics footer |
| Dangling links | Review fails link resolution | Remove link, create the target note, or fix the spelling |
| Sparse note | < 2 outgoing links | Route to /connect for connection finding |
| Schema drift | Enum values not in template | Update note to use valid values, or propose enum addition |
