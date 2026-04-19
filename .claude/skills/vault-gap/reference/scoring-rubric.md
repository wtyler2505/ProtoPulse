# Scoring Rubric — `/vault-gap` Coverage Classification

## Definition of a "strong" hit

A qmd_deep_search result is considered **strong** when:
1. `score >= 0.5` (qmd's hybrid BM25 + embedding + LLM-reranker output), AND
2. The note's `topics` frontmatter includes at least one MOC that's topic-relevant to the search term.

MOC topic-relevance heuristic:
- Hardware/EDA topics ↔ `eda-fundamentals`, `microcontrollers`, `actuators`, `power-systems`, `passives`, `displays`, `sensors`, `communication`, `breadboard-intelligence`
- UI/UX topics ↔ `maker-ux`, `architecture-decisions`
- A11y topics ↔ `maker-ux` (rare direct; often indirect via `focus-outline-none-…`)
- Arduino/firmware ↔ `microcontrollers`, `breadboard-intelligence`

If the top results are all in a MOC that doesn't fit the query domain, **downgrade** the match count even if scores are high. Signal: "close-terminology, wrong-domain" false positive.

## Coverage levels

| Strong hits | Classification | Action |
|-------------|----------------|--------|
| ≥ 3 | `sufficient` | Cite slugs; no stub needed |
| 1-2 | `thin` | Cite existing + seed stub (pedagogical gap may remain) |
| 0 | `missing` | Seed stub; cite 0-hits explicitly |

## Why the threshold is 3

Historical data from the 2026-04-14 ArsContexta campaign showed that:
- Plans citing 1 note often have gaps the note doesn't cover (pedagogical ≠ comprehensive).
- Plans citing 2 notes typically still need a synthesis note tying them together.
- Plans citing 3+ notes tend to have robust coverage for `<VaultHoverCard>` consumption without additional seeding.

The `--min-notes` flag lets power users override (e.g., `--min-notes=5` for high-stakes topics like DRC rules; `--min-notes=1` for small, well-scoped concepts).

## False positives to watch

- **Semantic drift** — qmd's embedding search can return "related but off-topic" hits. Example: searching "net naming convention" may return notes about network protocols rather than electrical net naming. Sanity-check top hits before calling them strong.
- **Score inflation on short notes** — a 1-paragraph note scoring 0.7 carries less information than a paragraph of a 20-paragraph note. Consider note length when weighting.
- **Stale notes** — notes without `reviewed` frontmatter (T6 provenance) may be 2+ years old. `/vault-gap` can still cite them, but flag confidence: `confidence: stale-unverified` in the payload.

## Override mechanisms

- `--min-notes=N` — user sets the strong-hit threshold.
- `--require-moc=<moc-slug>` — require at least one hit in a specific MOC (prevents wrong-domain false positives).
- `--include-archived` — include notes with `status: archived` in the count (default: exclude).
- `--verbose` — dump all qmd hits (not just top-10) with full scores for debugging.
