---
name: vault-quality-gate
description: Pre-commit quality gate for new or updated vault notes. Runs a deterministic checklist (claim clarity, evidence presence, application guidance, MOC cross-links, description≤140 chars) + an optional AI review pass. Notes that fail land in inbox/review/ with flagged concerns; they do NOT reach knowledge/ until fixed. This skill is /extract's final step before commit and the ship-gate for the vault. Triggers on "/vault-quality-gate", "/vault-quality-gate [note-path]", "run extract quality gate", "check note readiness", "can this note ship".
version: "1.0"
user-invocable: true
context: fork
allowed-tools: Read, Write, Grep, Glob, Bash
argument-hint: "[note-path] [--ai-review] [--fail-on deterministic|all] [--dry-run] [--json]"
---

## EXECUTE NOW

**Target: $ARGUMENTS**

Parse flags:
- `--ai-review` — run the optional AI semantic review pass (costs a model call; recommended but off by default).
- `--fail-on <mode>` — `deterministic` fails only on mechanical checks (default); `all` treats AI concerns as blocking.
- `--dry-run` — print the verdict without moving the note.
- `--json` — structured output.

**Execute these steps:**

1. **Resolve target** — path to a candidate note. Typically called by `/extract` with a just-produced `knowledge/<slug>.md`. Can also audit existing notes.
2. **Run deterministic checks** (see §Checklist below). Collect pass/fail per rule.
3. **If `--ai-review`, run semantic pass** — prompt asks the model to flag: vague claims, missing application guidance, unsubstantiated confidence, tone drift.
4. **Compute verdict**:
   - All deterministic pass + AI clean → `ship`.
   - Deterministic fail OR (AI fail AND `--fail-on all`) → `review`.
5. **Action**:
   - `ship` → leave in place (note stays at `knowledge/<slug>.md`).
   - `review` → move note to `inbox/review/<slug>.md` and write an adjacent `<slug>.review.md` with flagged concerns.
   - `--dry-run` → skip move; print verdict only.
6. **Emit verdict + concerns** — human or JSON.

**Pipeline discipline** — the ship-gate. A note only stays in `knowledge/` if it passes. Moves to `inbox/review/` happen atomically.

**START NOW.** Reference below defines checklist, AI rubric, review-stub format, and `/extract` integration.

---

## Deterministic checklist

Each rule is pass/fail. Rules fire against frontmatter (via T2's `parse-frontmatter.py`) and body content.

| Rule | Check | Severity |
|------|-------|----------|
| `description-present` | `description` field exists, non-empty | error |
| `description-length` | `description` ≤ 140 chars | error |
| `description-not-placeholder` | description is not "TODO", "TBD", "(placeholder)", nor rehash of `name` | error |
| `topics-present` | `topics` array has ≥1 entry | error |
| `topics-moc-membership` | at least one topic slug exists as `knowledge/<topic>.md` (unless `type: moc | meta`) | error |
| `type-valid` | `type` ∈ {claim, pattern, reference, moc, meta} | error |
| `body-min-length` | body (post-frontmatter) ≥ 200 chars | warning |
| `body-has-claim-section` | body contains a `## Claim` OR `## Summary` heading OR opens with a declarative sentence | warning |
| `body-has-evidence-section` | body contains `## Evidence` OR `## Why` OR a Provenance block OR an inline citation (url) | warning |
| `body-has-application-section` | body contains `## Application` OR `## When to use` OR `## Usage` | info |
| `body-cross-links` | body contains ≥2 `[[wiki-link]]` OR `knowledge/<slug>.md` references | warning |
| `confidence-provenance-consistency` | `confidence: verified` iff `provenance[]` non-empty (T2 rule; re-checked here) | error |
| `related-resolves` | every `related:` entry points to existing `knowledge/<slug>.md` | error |
| `no-todo-markers` | body does not contain `TODO`, `FIXME`, `_TBD_`, `XXX` (except inside stub audience sections) | warning |

Deterministic verdict:
- Any **error** fails → `review`.
- Only **warnings/info** → `ship` (passes) but reported.

## AI semantic pass (optional)

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

Call via `claude-code` CLI or direct API. Budget: ≤2000 output tokens per note.

## Review stub format

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
3. Re-run `/vault-quality-gate inbox/review/{{slug}}.md`.
4. On PASS, move back: `mv inbox/review/{{slug}}.md knowledge/{{slug}}.md && rm inbox/review/{{slug}}.review.md`.
5. Append the quality-gate pass message to the commit.

## Anti-patterns

- Do NOT force-commit a bounced note by moving it back manually. Re-run the gate first.
- Do NOT silence individual rules without a documented reason in the note's frontmatter (`gate-overrides:`).
```

## /extract integration

Modify the existing `/extract` skill's Step N (final commit) to call this gate:

```
Step N (final): run /vault-quality-gate on every newly-produced knowledge/ file.
  - if gate passes: commit as normal.
  - if gate fails: note is already moved to inbox/review/ by the gate. Update the extract
    queue entry with status `bounced-to-review`. Log the review stub path for follow-up.
```

## Rule overrides (escape hatch)

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

- **T2 `/vault-validate`** — schema-level check; this gate goes beyond to semantic + structural.
- **T3 `/vault-index`** — cross-link resolution relies on the same backlink model.
- **T6 `/vault-source`** — `confidence-provenance-consistency` rule consumes provenance taxonomy.
- **T7 `/vault-health`** — weekly report includes gate pass-rate + top-5 failing rules.
- **extract skill** — calls this gate at commit time.

## Anti-patterns

| Anti-Pattern | Why It Fails | Instead |
|---|---|---|
| Bypass gate via direct write | Corrupt vault; CI drift | Always go through /extract or re-run gate |
| Silence rules without reasons | Invisible technical debt | Document every `gate-overrides[]` reason |
| Treat warnings as noise | Warnings become errors eventually | Fix warnings in batches (weekly) |
| Run gate on pre-extract inbox stubs | Stubs are not meant to be ship-ready | Only gate notes coming out of /extract → knowledge/ |
| Auto-fix via `--fix` without human review | Quality regressions at scale | Require human confirmation before re-commit |

## Version history

- **1.0 (2026-04-18)** — initial ship. Deterministic 13-rule checklist + optional AI pass. Review-bounce workflow via inbox/review/.
