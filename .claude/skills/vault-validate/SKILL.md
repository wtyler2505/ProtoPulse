---
name: vault-validate
description: Validate Ars Contexta vault notes against the v2 frontmatter schema, in two modes. `lint` (default) is report-only — checks required fields (name, description ≤140 chars, topics, audience, provenance, claims, reviewed date), confirms cross-links resolve, flags orphan notes, reports schema drift. `gate` is /extract's ship-gate — runs the deterministic quality checklist (claim clarity, evidence presence, MOC cross-links) plus an optional AI review pass, and bounces failing notes to inbox/review/ so they never land in knowledge/ unreviewed. Absorbs the former /vault-quality-gate skill. Triggers on "/vault-validate", "/vault-validate [file-or-glob]", "/vault-validate --mode gate [note]", "check vault schema", "validate knowledge notes", "schema drift report", "run extract quality gate", "can this note ship".
version: "2.0"
user-invocable: true
context: fork
allowed-tools: Read, Write, Grep, Glob, Bash, mcp__qmd__qmd_search, mcp__qmd__qmd_collections, mcp__qmd__qmd_status
argument-hint: "[file|glob] [--mode lint|gate] [--fix] [--json] [--strict] [--fail-on severity] [--ai-review] [--dry-run]"
---

## EXECUTE NOW

> **⚠️ VAULT IS PRE-MIGRATION — READ THIS FIRST**
> The canonical enum + topics-format policy lives in `ops/config.yaml` under the
> `_schema:` block — that block is the single source of truth, NOT this skill's
> JSON schema asset. The live vault (~743 notes) predates the v2 schema: legacy
> values (`domain-knowledge`, `decision`, `insight`, `proven`, `high`, quoted
> wiki-link topics, …) are **accepted-legacy** and must **WARN, never FAIL**.
> Do **NOT** run bulk `--fix` across `knowledge/` — legacy frontmatter is valid
> as-is until the migration completes. Single-note or small-batch fixes only.

> **⚠️ GATE MODE IS FOR NEW NOTES ONLY — do NOT run `--mode gate` as a vault-wide
> audit until migration completes.** Gate mode is `/extract`'s ship-gate for NEW
> notes, which use the preferred v2 values. Run wholesale against the pre-migration
> vault, it would bounce essentially every pre-T-series note. Accepted-legacy enum
> values WARN, never FAIL/bounce.

**Target: $ARGUMENTS**

If no target provided, lint all notes under `knowledge/`.

Parse flags from `$ARGUMENTS`:

- `--mode <lint|gate>` — `lint` (default): report-only schema validation. `gate`: quality ship-gate — failing notes are MOVED to `inbox/review/` (the old `/vault-quality-gate` behavior; used by `/extract` at commit time).
- `--fix` — (lint mode) auto-remediate what can be safely fixed (add missing `reviewed` date, lowercase tag casing, strip trailing whitespace). Never rewrites content. Never changes `name` or `description`.
- `--json` — emit JSON report to stdout instead of human-readable summary.
- `--strict` — also fail on warnings (advisory becomes blocking).
- `--fail-on <severity|mode>` — lint mode: exit-code threshold (`error` default; `warning` or `info` tighter). Gate mode: `deterministic` fails only on mechanical checks (default); `all` treats AI concerns as blocking.
- `--ai-review` — (gate mode) run the optional AI semantic review pass (costs a model call; recommended but off by default).
- `--dry-run` — (gate mode) print the verdict without moving the note.

Strip flags from target before globbing.

### Mode: lint (default — report-only)

**Execute these steps in order:**

1. **Load the schema** — read `${CLAUDE_SKILL_DIR}/assets/frontmatter-v2.schema.json` AND the `_schema:` block in `ops/config.yaml`. The config block is canonical: its `preferred` enums match the JSON schema; its `accepted_legacy` enums (and the wiki-link topics format) demote what would be schema errors to warnings.
2. **Enumerate targets** — glob `target` (default `knowledge/**/*.md`). Exclude `knowledge/index.md` and files under `knowledge/archive/`.
3. **For each note, parse frontmatter** — extract the YAML block between leading `---` lines. Use `${CLAUDE_SKILL_DIR}/scripts/parse-frontmatter.py` to get a dict.
4. **Validate against schema** — for each field, check required presence, type, constraint compliance. Collect violations as `{file, field, rule, severity, message}` objects.
5. **Cross-link integrity** — for each `related:` entry, confirm `knowledge/<slug>.md` exists. Same for `supersedes`, `superseded-by`. Report broken links as `severity: error`.
6. **MOC membership** — for each note, confirm at least one `topics:` entry is itself a MOC slug. Orphans → `severity: warning` (unless `type: moc` or `type: meta`).
7. **Description quality gate** — `description` ≤140 chars (T1 `<VaultHoverCard>` contract), not empty, not just the title rehashed. Emit `severity: warning` if it fails the "cold-read" heuristic (too generic).
8. **Freshness check** — `reviewed` within the last 365 days for `confidence: verified`; within 730 days otherwise. Stale → `severity: info`.
9. **Provenance presence** — for `confidence: verified`, require at least one `provenance[]` entry with a URL or citation. Missing → `severity: error`.
10. **Audience-tier coverage** — if frontmatter declares `audience:` tiers, check the body has matching `### [tier]` section markers (the `/vault-audience` marker protocol). Declared-but-unfulfilled tiers → `severity: warning`.
11. **Apply `--fix`** — for each auto-fixable violation, rewrite the note's frontmatter ATOMICALLY (write tmp file, then rename). Document the fix in the report.
12. **Emit report** — if `--json`, dump JSON to stdout. Otherwise print a human summary + file paths of violations grouped by severity.
13. **Exit code** — `0` if no violations at/above `--fail-on`; `1` otherwise.

### Mode: gate (ship-gate — bounces failures to inbox/review/)

**Execute these steps:**

1. **Resolve target** — path to a candidate note. Typically called by `/extract` with a just-produced `knowledge/<slug>.md`. Can also audit individual existing notes.
2. **Run deterministic checks** — `python3 ${CLAUDE_SKILL_DIR}/scripts/gate.py <note-path>` (see §Gate checklist below). Collect pass/fail per rule.
3. **If `--ai-review`, run semantic pass** — prompt asks the model to flag: vague claims, missing application guidance, unsubstantiated confidence, tone drift.
4. **Compute verdict**:
   - All deterministic pass + AI clean → `ship`.
   - Deterministic fail OR (AI fail AND `--fail-on all`) → `review`.
5. **Action**:
   - `ship` → leave in place (note stays at `knowledge/<slug>.md`).
   - `review` → move note to `inbox/review/<slug>.md` and write an adjacent `<slug>.review.md` with flagged concerns.
   - `--dry-run` → skip move; print verdict only.
6. **Emit verdict + concerns** — human or JSON.

**Never rewrite note bodies.** `--fix` only touches frontmatter, and only safe auto-fixable fields. Note content is sacrosanct — that goes through `/extract` or manual edit.

**Pipeline discipline** — lint mode reads `knowledge/` and (with `--fix`) modifies frontmatter only. Gate mode is the ship-gate: a note only stays in `knowledge/` if it passes; moves to `inbox/review/` happen atomically. Neither mode creates new notes. New notes always route through `inbox/ → /extract → knowledge/`.

**START NOW.** Reference below explains the schema fields, severity semantics, auto-fix catalog, gate checklist, AI rubric, review-stub format, and integration points.

---

## Schema fields (v2 — upgraded from v1)

Full schema: `${CLAUDE_SKILL_DIR}/assets/frontmatter-v2.schema.json`.
Canonical enum policy: `ops/config.yaml` `_schema:` block (preferred vs accepted-legacy). Accepted-legacy `type` values: `decision | concept | insight | debt-note | need | domain-knowledge | knowledge-note | knowledge`. Accepted-legacy `confidence` values: `proven | likely | experimental | outdated | high | medium`. Wiki-link topics (`- "[[power-systems]]"`) are accepted-legacy; bare slugs preferred. All accepted-legacy hits are `severity: warning`, never `error`.

### Required (every note)

- **`name`** (string, ≥1 char) — descriptive slug, matches filename stem.
- **`description`** (string, ≤140 chars) — tooltip-grade summary. Powers `<VaultHoverCard>`.
- **`type`** (enum: `claim | pattern | reference | moc | meta`) — controls validator behavior.
- **`topics`** (array of strings, ≥1) — MOC membership. At least one must be a MOC slug unless `type: moc | meta`.

### Strongly recommended (warnings if missing)

- **`audience`** (array, subset of `[beginner, intermediate, expert]`) — powers T11 progressive disclosure.
- **`reviewed`** (ISO date YYYY-MM-DD) — freshness anchor.
- **`confidence`** (enum: `speculative | emerging | supported | verified | established`) — epistemic weight.

### Optional (errors only if malformed)

- **`claims`** (array of `{subject, predicate, confidence?}` objects) — structured assertions.
- **`related`** (array of note-slug strings) — outgoing wiki-link mirror.
- **`supersedes`** (array of slugs) — notes this one replaces.
- **`superseded-by`** (array of slugs) — notes that replace this one.
- **`provenance`** (array of `{source, url?, page?, verified?, verified-by?, reliability?}` objects) — citation trail. Required when `confidence: verified`.
- **`used-by-surface`** (array: `[breadboard, schematic, pcb, arduino, dashboard, learn, ...]`) — which UI surfaces consume this note (feeds T3 backlink index).

### Legacy v1 fields (tolerated, slated for migration)

- `captured_date`, `extraction_status`, `triage_status`, `parent_source`, `source_type`, `severity_counts`, `e2e_ids` — kept on extraction-pipeline stubs; validator does NOT error on them.

## Severity semantics (lint mode)

| Severity | Meaning | `--fail-on` effect |
|----------|---------|---------------------|
| `error` | Schema violation or broken cross-link | Fail by default |
| `warning` | Missing recommended field; stale-by-policy; accepted-legacy value | Fail with `--strict` |
| `info` | Advisory (e.g. overlong description still under 140 but >130) | Only with `--fail-on info` |

## Auto-fix catalog (`--fix`, lint mode)

Safe rewrites the validator may perform:

- Lowercase + trim whitespace on all `topics` entries.
- Normalize `audience` values to lowercase.
- Convert ISO datetime (`2026-04-18T12:00:00Z`) to date-only (`2026-04-18`) for `reviewed` and `captured_date`.
- Add `reviewed: <today>` when missing AND `type` is not `moc | meta` AND note has at least one `provenance` URL (otherwise the fix lacks grounding and is skipped).
- Collapse duplicate entries in `topics`, `related`, `supersedes`, `superseded-by`.
- Sort arrays alphabetically (idempotent).
- Never edit `name`, `description`, `type`, `confidence`, `claims`, note body.

## Gate checklist (gate mode — `scripts/gate.py`)

Each rule is pass/fail. Rules fire against frontmatter (via `scripts/parse-frontmatter.py`) and body content.

| Rule | Check | Severity |
|------|-------|----------|
| `description-present` | `description` field exists, non-empty | error |
| `description-length` | `description` ≤ 140 chars | error |
| `description-not-placeholder` | description is not "TODO", "TBD", "(placeholder)", nor rehash of `name` | error |
| `topics-present` | `topics` array has ≥1 entry | error |
| `topics-moc-membership` | at least one topic slug exists as `knowledge/<topic>.md` (unless `type: moc | meta`) | error |
| `type-valid` | `type` ∈ preferred {claim, pattern, reference, moc, meta} (error if unknown); accepted-legacy values per `ops/config.yaml` `_schema` → warning only | error / warning |
| `body-min-length` | body (post-frontmatter) ≥ 200 chars | warning |
| `body-has-claim-section` | body contains a `## Claim` OR `## Summary` heading OR opens with a declarative sentence | warning |
| `body-has-evidence-section` | body contains `## Evidence` OR `## Why` OR a Provenance block OR an inline citation (url) | warning |
| `body-has-application-section` | body contains `## Application` OR `## When to use` OR `## Usage` | info |
| `body-cross-links` | body contains ≥2 `[[wiki-link]]` OR `knowledge/<slug>.md` references | warning |
| `confidence-provenance-consistency` | `confidence: verified` iff `provenance[]` non-empty (lint rule; re-checked here) | error |
| `related-resolves` | every `related:` entry points to existing `knowledge/<slug>.md` | error |
| `no-todo-markers` | body does not contain `TODO`, `FIXME`, `_TBD_`, `XXX` (except inside stub audience sections) | warning |

Deterministic verdict:
- Any **error** fails → `review`.
- Only **warnings/info** → `ship` (passes) but reported.

## AI semantic pass (gate mode, optional)

When `--ai-review`, construct a prompt like:

```
You are reviewing a knowledge note for the Ars Contexta vault. Read the note below and
flag any of: (a) claim is vague or a non-claim ("X is interesting"), (b) claim lacks
supporting evidence or derivation, (c) no guidance on when/how to apply, (d) confidence
label overstates the support, (e) tone drifts from declarative into speculative waffle.

Return JSON:
{
  "verdict": "clean" | "concerns",
  "concerns": [
    { "kind": "<kind>", "excerpt": "<≤80 chars from the note>", "fix": "<actionable suggestion>" }
  ]
}

Note:
<FULL_NOTE>
```

Call via the `claude` CLI in headless mode (`claude -p "<prompt>"`) or direct API. Budget: ≤2000 output tokens per note.

## Review stub format (gate mode)

When a note fails, write `inbox/review/<slug>.review.md` alongside the moved note:

```markdown
---
name: "Review: {{slug}}"
description: "Quality gate flagged on {{DATE}}. {{N}} concern(s). Fix and move back to knowledge/."
captured_date: {{DATE}}
extraction_status: needs-revision
triage_status: quality-gate-fail
source_type: review-bounce
origin_note: inbox/review/{{slug}}.md
topics:
  - quality-gate
---

## Why this note bounced

### Deterministic failures (blocking)
{{DETERMINISTIC_FAILS}}

### AI concerns (advisory{{IF_STRICT}})
{{AI_CONCERNS}}

## Fix protocol

1. Read both this review file and `inbox/review/{{slug}}.md` (the note itself).
2. Address every deterministic error. Address AI concerns where legitimate.
3. Re-run `/vault-validate --mode gate inbox/review/{{slug}}.md`.
4. On PASS, move back: `mv inbox/review/{{slug}}.md knowledge/{{slug}}.md && rm inbox/review/{{slug}}.review.md`.
5. Append the quality-gate pass message to the commit.

## Anti-patterns

- Do NOT force-commit a bounced note by moving it back manually. Re-run the gate first.
- Do NOT silence individual rules without a documented reason in the note's frontmatter (`gate-overrides:`).
```

## /extract integration (gate mode)

`/extract`'s final pre-commit step calls this gate:

```
Step N (final): run /vault-validate --mode gate on every newly-produced knowledge/ file.
  - if gate passes: commit as normal.
  - if gate fails: note is already moved to inbox/review/ by the gate. Update the extract
    queue entry with status `bounced-to-review`. Log the review stub path for follow-up.
```

## Rule overrides (gate mode escape hatch)

Notes may declare `gate-overrides:` frontmatter to silence specific rules — but each override needs a reason:

```yaml
gate-overrides:
  - rule: body-cross-links
    reason: "This is a foundational MOC; it is linked TO rather than FROM."
  - rule: body-min-length
    reason: "Definitional note — brevity is a feature."
```

The gate reads `gate-overrides[]`, logs the override with its reason, and does not fail the note. `/vault-health` tracks override usage to surface abuse.

## Integration points

- **T1 `/vault-gap`** — creates inbox stubs. Lint mode only inspects `knowledge/`, not `inbox/`. Pass an explicit `inbox/` target if you want to lint stubs.
- **T3 `/vault-index`** — the validator's `used-by-surface` scan contributes to `ops/index/plan-vault-backlinks.json`; gate-mode cross-link resolution relies on the same backlink model.
- **T5 `/vault-suggest-for-plan`** — runs lint mode on a note before citing it; won't cite notes with `severity: error`.
- **T6 `/vault-source`** — reads the `provenance` block; this skill enforces its presence (both modes).
- **T7 `/vault-health`** — weekly report includes schema-drift counts (lint `--json`) + gate pass-rate.
- **T10 `/extract`** — calls `--mode gate` on newly-extracted notes at commit time (see §/extract integration).
- **T11 `<VaultExplainer>`** — consumes `audience` metadata this skill validates (tier-coverage warning in lint step 10).

## Migration guidance

The live vault (~743 notes) carries v1/legacy frontmatter. Migration strategy:

1. Run `vault-validate --json` (lint) on all notes to produce a violation catalog.
2. For notes missing required fields, create an inbox remediation stub: `inbox/YYYY-MM-DD-migration-<slug>.md` with instructions for `/extract` to re-run with v2 schema. DO NOT hand-edit hundreds of notes.
3. For auto-fixable violations, run `vault-validate --fix` in batches of 50-100 notes. Verify each batch passes.
4. Strongly recommended fields (`audience`, `reviewed`, `confidence`) are added per-note as the `/revisit` skill processes them for connection updates. Don't bulk-backfill guesses.
5. Track migration progress via `/vault-health` (T7) — it reads violation counts over time.

## Anti-patterns

| Anti-Pattern | Why It Fails | Instead |
|--------------|--------------|---------|
| Bulk-edit all pre-migration notes to pass the validator | Destroys existing context; guesses audience/confidence | Fix schema violations via `/extract` re-processing |
| Run `--mode gate` vault-wide pre-migration | Bounces essentially every legacy note | Gate is for NEW notes out of /extract only |
| Write to `knowledge/` without `/extract` | Bypasses pipeline + this validator | Always route new knowledge through `inbox/` |
| Run `--fix` without reviewing diff | Frontmatter corruption silently lands in git | Always `git diff knowledge/` after `--fix` before commit |
| Treat `description: "A note about X"` as acceptable | Description must serve as a tooltip; "A note about X" is not a tooltip | Fail the cold-read test → rewrite the description |
| Cite `related:` entries without verifying they exist | Broken links erode vault integrity | Validator checks; fix broken refs |
| Set `confidence: verified` without `provenance[]` | Unverifiable claim masquerading as verified | Validator errors; downgrade confidence or add citation |
| Bypass gate via direct write | Corrupt vault; CI drift | Always go through /extract or re-run gate |
| Silence gate rules without reasons | Invisible technical debt | Document every `gate-overrides[]` reason |
| Force-commit a bounced note | Quality regressions at scale | Fix, re-run gate, then move back |

## Version history

- **2.0 (2026-06-11)** — merged `/vault-quality-gate` in as `--mode gate` (gate.py now lives in this skill's scripts/). Single skill, two modes: lint (report-only) + gate (bounce-to-review, used by /extract). Added audience-tier coverage check to lint (absorbed from /vault-audience). Kept pre-migration banners + `ops/config.yaml` `_schema` single-source policy.
- **1.0 (2026-04-18)** — initial ship with v2 frontmatter schema. ProtoPulse qmd tool names. Leveled severity (error/warning/info). Auto-fix catalog. Safe atomic frontmatter rewrites. Migration guidance for 683 existing notes.
