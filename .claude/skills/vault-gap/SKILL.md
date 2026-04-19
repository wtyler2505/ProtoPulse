---
name: vault-gap
description: Check whether the Ars Contexta vault has sufficient coverage on a topic. Auto-drafts an inbox/ stub and queues ops/queue/gap-stubs.md when coverage is thin. Returns a structured payload for plan Research logs. Honors the inbox/ → /extract → knowledge/ pipeline discipline — never writes to knowledge/ directly. Triggers on "/vault-gap", "/vault-gap [topic]", "is there a vault note on X", "check vault coverage for Y", "do we have knowledge on Z".
version: "1.1"
user-invocable: true
context: fork
allowed-tools: Read, Write, Grep, Glob, Bash, mcp__qmd__qmd_search, mcp__qmd__qmd_vector_search, mcp__qmd__qmd_deep_search, mcp__qmd__qmd_collections, mcp__qmd__qmd_status
argument-hint: "[topic to check for vault coverage] [--origin-plan path/to/plan.md] [--origin-task 1.2] [--min-notes 3]"
---

## EXECUTE NOW

**Topic: $ARGUMENTS**

If no topic provided, ask the user what concept they want vault coverage on (1 sentence).

Parse flags from `$ARGUMENTS`:
- `--origin-plan <path>` — plan file the gap was discovered in (for backlink)
- `--origin-task <id>` — task ID within that plan (e.g. "5.9")
- `--min-notes <N>` — threshold below which to auto-seed stub (default 3)

Strip flags from topic before searching.

**Execute these steps in order:**

1. **Search the vault** — run `mcp__qmd__qmd_deep_search` with the topic, limit=10. If zero results, run `mcp__qmd__qmd_vector_search` as a fallback (different index may hit).
2. **Score the coverage** — count results whose relevance score ≥ 0.5 (a "strong" hit). Classify:
   - **≥3 strong hits** → `coverage: sufficient`
   - **1-2 strong hits** → `coverage: thin`
   - **0 strong hits** → `coverage: missing`
3. **Emit structured payload** — print to stdout a machine-readable block the calling agent can paste into a plan's Research log.
4. **Seed inbox stub if coverage is thin or missing** — write `inbox/YYYY-MM-DD-<slug-of-topic>.md` with the research-question template (see §Inbox Stub Template). Slug = lowercase-dashed version of topic. Refuse to overwrite an existing stub with the same slug (append `-v2`, `-v3`, etc.).
5. **Append to queue log** — append a line to `ops/queue/gap-stubs.md` (create if missing) with timestamp + slug + origin-plan + origin-task so `/extract` can prioritize (per T15).
6. **Never write directly to `knowledge/`.** Honor the pipeline. Only `/extract` writes to `knowledge/`.

**START NOW.** Reference below explains scoring, stub template, and payload format.

---

## Coverage scoring

The vault has ~683 atomic notes across 54 MOCs as of 2026-04-18. A "strong" match means `mcp__qmd__qmd_deep_search` returned a relevance score ≥ 0.5 AND the note's topics include a plausibly relevant MOC (e.g. `eda-fundamentals`, `microcontrollers`, `maker-ux`, `a11y`).

Score the top-10 hits:
- **Sufficient** (≥3 strong) — cite slugs in the payload; no stub needed; remind the agent to consume via `<VaultHoverCard>` / `<VaultExplainer>` if UI-facing.
- **Thin** (1-2 strong) — cite the hits AND seed a stub (the existing notes may still leave pedagogical gaps the plan author needs filled).
- **Missing** (0 strong) — seed a stub; cite the 0 strong hits explicitly ("qmd_deep_search returned 0 results ≥0.5 for '<topic>'").

Never claim coverage exists just because qmd returned low-confidence matches. False positives here cascade into plan citations that don't actually support the claim.

## Inbox stub template

When creating `inbox/YYYY-MM-DD-<slug>.md`:

```markdown
---
name: "<topic> — vault-gap stub"
description: "Gap flagged by /vault-gap on YYYY-MM-DD. Origin: <plan-path>#<task-id>. Seed for /extract."
captured_date: YYYY-MM-DD
extraction_status: pending
triage_status: gap-stub
source_type: vault-gap-seed
origin:
  plan: <plan-path>
  task: <task-id>
research_questions:
  - What is the canonical answer to the concept "<topic>"?
  - Which existing MOC does this belong to (eda-fundamentals / maker-ux / a11y / components / ...)?
  - Is there an authoritative source (datasheet, WCAG SC, Wokwi pattern, etc.) to cite?
  - What 3-line summary would serve as a `<VaultHoverCard>` tooltip?
topics:
  - vault-gap-seed
---

## Gap context

A plan-authoring agent ran `/vault-gap "<topic>"` on YYYY-MM-DD and found <N> strong hits in the vault (threshold: 3). This stub queues research so `/extract` can produce atomic notes under `knowledge/`.

## Origin reference

- Plan: `<plan-path>`
- Task: `<task-id>`
- Excerpt (if supplied by caller): <excerpt>

## Suggested extraction categories

(Filled by `/extract` based on `ops/config.yaml` extraction_categories.)

## Primary sources to consult

- `qmd_deep_search` result snippets (top 3, even if score < 0.5, for orientation):
  - <slug> (score)
  - <slug> (score)
  - <slug> (score)
- (Add URLs / page numbers / PDF pointers here when known.)

## Instructions for /extract

1. Read the primary sources above.
2. Produce atomic note(s) under `knowledge/` following the exemplar pattern (`drc-should-flag-direct-gpio-to-inductive-load-...md`): named-as-claim, structured evidence, MOC crosslinks.
3. Cross-link to at least 2 existing MOCs from `knowledge/`.
4. After extraction, update `ops/queue/gap-stubs.md` with `EXTRACTED: <knowledge-slug>` next to this stub's entry.
```

## Payload format (for calling agent to paste into plan Research log)

```
### /vault-gap result — <topic>

Coverage: <sufficient | thin | missing> (<N> strong hits, threshold 3)

Existing notes (top 5 by score):
- knowledge/<slug-1>.md — <1-line excerpt> (score)
- knowledge/<slug-2>.md — <1-line excerpt> (score)
- ...

<if thin or missing:>
Stub seeded: inbox/YYYY-MM-DD-<slug>.md
Queue entry: ops/queue/gap-stubs.md

/extract will process this during execution. After extraction, cite the resulting
knowledge/<slug>.md in this task's implementation.
</if>
```

## ops/queue/gap-stubs.md format

Append-only markdown table. Create with header row if file doesn't exist.

```markdown
# Vault Gap Stubs Queue

Ordered append-only log of vault gaps flagged by /vault-gap. /extract processes these
in priority order (most-referenced-by-pending-plans first per T15; FIFO otherwise).

| timestamp | topic | slug | origin plan | task | coverage | status |
|-----------|-------|------|-------------|------|----------|--------|
| 2026-04-18T22:15:00Z | "WCAG focus ring contrast" | wcag-focus-ring-3to1-contrast | plans/2026-04-18-e2e-walkthrough/03-a11y-systemic.md | Wave 10 Task 10.1 | missing | pending |
```

## Slug derivation

Lowercase → replace non-alphanumeric with `-` → collapse consecutive dashes → trim leading/trailing dashes. Cap at 80 chars (truncate at last word boundary).

Examples:
- "WCAG focus ring contrast" → `wcag-focus-ring-contrast`
- "ESP32 GPIO12 must be low at boot" → `esp32-gpio12-must-be-low-at-boot`
- "DC Operating Point analysis (SPICE)" → `dc-operating-point-analysis-spice`

## Error handling

If `mcp__qmd__qmd_deep_search` errors (MCP server down, index stale):
1. Report the error explicitly in the payload.
2. Fall back to `grep -rli "<topic keywords>" knowledge/` for a keyword-only scan.
3. Still seed the stub if keyword scan returns <3 files.

If `Write` fails on the stub (permission, disk space):
1. Report the exact error.
2. Do NOT silently skip — the calling agent needs to know the stub didn't land.

## Anti-patterns

| Anti-Pattern | Why It Fails | Instead |
|-------------|--------------|---------|
| Write directly to `knowledge/` | Bypasses pipeline; no extract quality gate; breaks audit trail | ALWAYS write stubs to `inbox/`; `/extract` handles `knowledge/` |
| Claim coverage on low-confidence hits | Plans cite notes that don't actually support the claim | Use score ≥0.5 threshold rigorously |
| Skip the queue log | Gap lost; /extract doesn't know to process | Always append to `ops/queue/gap-stubs.md` |
| Overwrite existing inbox stub | Destroys prior research context | Append `-v2` to slug when a stub already exists |
| Guess slugs / topics | Unstable identifiers; duplicates | Run the slug derivation function deterministically |
| Skip running qmd entirely | The skill's value is the search | Always run `qmd_deep_search` even if user just says "stub topic X" |

## Integration points (downstream)

- **T5 `/vault-suggest-for-plan`** — calls `/vault-gap` in a loop over plan tasks.
- **T8 `<VaultInbox>` UI** — invokes the stub-creation logic server-side when a user clicks "Suggest a note".
- **T15 extract-queue priority** — reads `ops/queue/gap-stubs.md` to prioritize /extract processing.
- **Plan research logs** — paste the payload directly.

## Version history

- **1.0 (2026-04-18)** — initial ship. ProtoPulse qmd tool names (`mcp__qmd__qmd_*`). Stub format aligned with existing `inbox/` convention.
