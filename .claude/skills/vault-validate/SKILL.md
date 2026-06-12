---
name: vault-validate
description: Validate Ars Contexta vault notes against the v2 frontmatter schema. Checks required fields (name, description ≤140 chars, topics, audience, provenance, claims, reviewed date), confirms cross-links resolve, flags orphan notes with no MOC membership, and reports schema drift. Emits machine-readable JSON + human-readable summary. Triggers on "/vault-validate", "/vault-validate [file-or-glob]", "check vault schema", "validate knowledge notes", "schema drift report".
version: "1.0"
user-invocable: true
context: fork
allowed-tools: Read, Grep, Glob, Bash, mcp__qmd__qmd_search, mcp__qmd__qmd_collections, mcp__qmd__qmd_status
argument-hint: "[file|glob] [--fix] [--json] [--strict] [--fail-on severity]"
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

**Target: $ARGUMENTS**

If no target provided, validate all notes under `knowledge/`.

Parse flags from `$ARGUMENTS`:
- `--fix` — auto-remediate what can be safely fixed (add missing `reviewed` date, lowercase tag casing, strip trailing whitespace). Never rewrites content. Never changes `name` or `description`.
- `--json` — emit JSON report to stdout instead of human-readable summary.
- `--strict` — also fail on warnings (advisory becomes blocking).
- `--fail-on <severity>` — set the exit-code threshold (`error` default; `warning` or `info` tighter).

Strip flags from target before globbing.

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
10. **Apply `--fix`** — for each auto-fixable violation, rewrite the note's frontmatter ATOMICALLY (write tmp file, then rename). Document the fix in the report.
11. **Emit report** — if `--json`, dump JSON to stdout. Otherwise print a human summary + file paths of violations grouped by severity.
12. **Exit code** — `0` if no violations at/above `--fail-on`; `1` otherwise.

**Never rewrite note bodies.** `--fix` only touches frontmatter, and only safe auto-fixable fields. Note content is sacrosanct — that goes through `/extract` or manual edit.

**Pipeline discipline** — this skill reads `knowledge/` and (with `--fix`) modifies frontmatter only. It does NOT create new notes. New notes always route through `inbox/ → /extract → knowledge/`.

**START NOW.** Reference below explains the schema fields, severity semantics, auto-fix catalog, and integration points.

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

## Severity semantics

| Severity | Meaning | `--fail-on` effect |
|----------|---------|---------------------|
| `error` | Schema violation or broken cross-link | Fail by default |
| `warning` | Missing recommended field; stale-by-policy | Fail with `--strict` |
| `info` | Advisory (e.g. overlong description still under 140 but >130) | Only with `--fail-on info` |

## Auto-fix catalog (`--fix`)

Safe rewrites the validator may perform:

- Lowercase + trim whitespace on all `topics` entries.
- Normalize `audience` values to lowercase.
- Convert ISO datetime (`2026-04-18T12:00:00Z`) to date-only (`2026-04-18`) for `reviewed` and `captured_date`.
- Add `reviewed: <today>` when missing AND `type` is not `moc | meta` AND note has at least one `provenance` URL (otherwise the fix lacks grounding and is skipped).
- Collapse duplicate entries in `topics`, `related`, `supersedes`, `superseded-by`.
- Sort arrays alphabetically (idempotent).
- Never edit `name`, `description`, `type`, `confidence`, `claims`, note body.

## Integration points

- **T1 `/vault-gap`** — creates inbox stubs. `vault-validate` only inspects `knowledge/`, not `inbox/`. Use `--target inbox/` explicitly if you want to lint stubs.
- **T3 backlink index** — the validator's `used-by-surface` scan contributes to `ops/index/plan-vault-backlinks.json` (T3 consumes).
- **T5 `/vault-suggest-for-plan`** — runs `vault-validate` on a note before citing it; won't cite notes with `severity: error`.
- **T6 `/vault-source`** — reads the `provenance` block; this skill enforces its presence.
- **T10 `/extract` quality gate** — runs validator on newly-extracted notes; blocks commit if `--strict` fails.
- **T11 `<VaultExplainer>`** — consumes `audience` metadata this skill validates.

## Migration guidance

Existing 683 notes likely have v1 frontmatter (minimal). Migration strategy:

1. Run `vault-validate --json` on all notes to produce a violation catalog.
2. For notes missing required fields, create an inbox remediation stub: `inbox/YYYY-MM-DD-migration-<slug>.md` with instructions for `/extract` to re-run with v2 schema. DO NOT hand-edit 683 notes.
3. For auto-fixable violations, run `vault-validate --fix` in batches of 50-100 notes. Verify each batch passes.
4. Strongly recommended fields (`audience`, `reviewed`, `confidence`) are added per-note as the `/revisit` skill processes them for connection updates. Don't bulk-backfill guesses.
5. Track migration progress via `/vault-health` (T7) — it reads violation counts over time.

## Anti-patterns

| Anti-Pattern | Why It Fails | Instead |
|--------------|--------------|---------|
| Bulk-edit all 683 notes to pass the validator | Destroys existing context; guesses audience/confidence | Fix schema violations via `/extract` re-processing |
| Write to `knowledge/` without `/extract` | Bypasses pipeline + this validator | Always route new knowledge through `inbox/` |
| Run `--fix` without reviewing diff | Frontmatter corruption silently lands in git | Always `git diff knowledge/` after `--fix` before commit |
| Treat `description: "A note about X"` as acceptable | Description must serve as a tooltip; "A note about X" is not a tooltip | Fail the cold-read test → rewrite the description |
| Cite `related:` entries without verifying they exist | Broken links erode vault integrity | Validator checks; fix broken refs |
| Set `confidence: verified` without `provenance[]` | Unverifiable claim masquerading as verified | Validator errors; downgrade confidence or add citation |

## Version history

- **1.0 (2026-04-18)** — initial ship with v2 frontmatter schema. ProtoPulse qmd tool names. Leveled severity (error/warning/info). Auto-fix catalog. Safe atomic frontmatter rewrites. Migration guidance for 683 existing notes.
