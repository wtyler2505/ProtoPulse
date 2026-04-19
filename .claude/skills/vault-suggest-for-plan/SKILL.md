---
name: vault-suggest-for-plan
description: Scan a plan file, extract each Task description + Goal sentence, batch-query the Ars Contexta vault (qmd_deep_search) per task, and emit a structured suggestion report mapping plan tasks to existing knowledge slugs OR flagging gaps that need /vault-gap stubs. Automates 80% of the manual "enhance plan with vault citations" work. Triggers on "/vault-suggest-for-plan", "/vault-suggest-for-plan [plan-path]", "suggest vault citations for this plan", "map plan to knowledge", "find vault notes for my plan".
version: "1.0"
user-invocable: true
context: fork
allowed-tools: Read, Grep, Glob, Bash, mcp__qmd__qmd_deep_search, mcp__qmd__qmd_search, mcp__qmd__qmd_vector_search, mcp__qmd__qmd_collections, mcp__qmd__qmd_status
argument-hint: "[plan-file-path] [--limit-tasks N] [--min-score 0.5] [--json] [--auto-seed-gaps]"
---

## EXECUTE NOW

**Target plan: $ARGUMENTS**

If no plan path provided, ask the user which plan file to scan.

Parse flags:
- `--limit-tasks N` — only process first N tasks (for sampling; default: all).
- `--min-score X` — minimum qmd_deep_search score to count as a "hit" (default 0.5; matches T1 scoring rubric).
- `--json` — emit JSON instead of human-readable report.
- `--auto-seed-gaps` — for tasks with zero strong hits, invoke `/vault-gap` to seed inbox stubs. Off by default (the report just flags gaps).

Strip flags from target before reading the plan.

**Execute these steps in order:**

1. **Read the plan file** — entire markdown body via `Read` tool.
2. **Extract scannable units** — parse the plan's Goal, Coverage table, and Task descriptions. See §Extraction rules below.
3. **For each unit, formulate a search query** — compress Task descriptions to 4-10 concept keywords (remove file paths, IDs, markdown noise). Preserve domain vocabulary (MCU names, protocol names, WCAG SCs, EDA terms).
4. **Batch-query qmd** — run `mcp__qmd__qmd_deep_search` per unit with `limit=5`. Respect rate limits: sleep 100ms between calls when scanning >20 units.
5. **Score each task's coverage** — apply T1 scoring rubric: `sufficient` (≥3 strong hits) / `thin` (1-2) / `missing` (0).
6. **For `missing` or `thin` tasks**, optionally invoke `/vault-gap` (when `--auto-seed-gaps`) OR just include the gap in the report for the plan author to decide.
7. **Emit the report** — human-readable by default (Markdown block the plan author pastes into the plan's Research log). JSON when `--json`.

**Pipeline discipline** — this skill only READS the vault and plan. It does NOT modify notes or plans. Gap-seeding (if enabled) goes through `/vault-gap` which respects the inbox pipeline.

**START NOW.** Reference below explains extraction rules, report format, and integration points.

---

## Extraction rules (what counts as a scannable unit)

A plan file is not well-structured enough to blindly tokenize. The skill MUST recognize these patterns:

1. **Goal line** — look for `**Goal:** ...` or `Goal: ...` in the plan header. One unit.
2. **Architecture line** — `**Architecture:** ...` — one unit.
3. **Coverage table rows** — for each row with an `E2E-XXX` ID, the row's "Finding" column is one unit. Skip rows that point to other plans (`*via 02*` etc.).
4. **Task headers** — `- [ ] **Task N.M**` or `### Task N.M` with the trailing description on the same line or next. One unit per task.
5. **Wave/Phase goal sentences** — `## Wave N — <name>` and the immediately-following description line.

Ignore:
- Code blocks (```...```)
- File paths as standalone items
- Commit message templates
- `/agent-teams` prompt blocks
- Research log sections (those are what we're producing)
- Anti-patterns tables

## Query compression rules

Task description → concept-keyword query:
- Remove `E2E-XXXX` IDs
- Remove file paths + line numbers
- Remove `(...)` parentheticals that are test/cmd invocations
- Keep domain nouns (component names, protocol names, WCAG SCs)
- Keep verbs that denote intent (validate, fix, migrate, add, replace)
- Trim to ≤12 words

Example:
- Input: `Task 5.9 — Pin alternate-function dialog (E2E-963) — click pin name (PB0, PB1) → opens MCU pin-detail dialog with alternate functions ("PB0 also serves as: AIN0, MOSI, OC0A, PCINT0") — file: client/src/components/schematic/PinDialog.tsx`
- Query: `MCU pin alternate functions dialog PB0 AIN0 MOSI PCINT0`

## Report format (human-readable, Markdown)

The agent pastes the report verbatim into the plan's Research log section.

```markdown
## /vault-suggest-for-plan report — <plan-file>

Scanned: <N> task(s)
Coverage: <X>/<N> sufficient, <Y>/<N> thin, <Z>/<N> missing

### Task-by-task suggestions

#### Task 1.1 — <short task name>
Query: `<compressed query>`
Coverage: **sufficient** (4 strong hits)
Consume via `<VaultHoverCard slug="...">`:
- `knowledge/esp32-gpio12-must-be-low-at-boot-or-module-crashes.md` (0.91)
- `knowledge/esp32-strapping-pins-summary.md` (0.84)
- `knowledge/avoid-strapping-pins-for-sensor-inputs.md` (0.72)

#### Task 2.7 — Live ERC squiggles
Query: `electrical rule check floating input pin multi-driver net`
Coverage: **thin** (2 strong hits)
Closest existing:
- `knowledge/floating-inputs-act-as-antennas-for-noise.md` (0.79)
- `knowledge/erc-multi-driver-detection.md` (0.64)
**Pedagogical gap:** no note covers the "live as-you-wire" UX pattern.
Suggestion: seed `inbox/2026-04-18-live-erc-squiggle-ux-pattern.md` via `/vault-gap`.

#### Task 5.9 — Pin alternate-function dialog
Query: `MCU pin alternate functions dialog PB0 AIN0 MOSI PCINT0`
Coverage: **missing** (0 strong hits)
Closest (all <0.5):
- `knowledge/attiny85-pin-map.md` (0.42)
- `knowledge/arduino-uno-alternate-functions-table.md` (0.38)
Suggestion: seed stub; consumer will need vault content.

### Summary

**Immediate consumption (sufficient):** N tasks. Wire `<VaultHoverCard>` / `<VaultExplainer>` with the cited slugs.
**Gap-seed recommended (thin/missing):** M tasks. Run `/vault-gap --auto-seed-gaps` or file stubs manually.
**Action:** paste this report into the plan's Research log. Mark sufficient tasks with their slugs. Queue gap-seeding for the rest.
```

## JSON format (when `--json`)

```json
{
  "plan": "docs/superpowers/plans/.../06-schematic.md",
  "scanned_tasks": 41,
  "coverage": { "sufficient": 18, "thin": 12, "missing": 11 },
  "tasks": [
    {
      "id": "5.9",
      "name": "Pin alternate-function dialog",
      "query": "MCU pin alternate functions dialog PB0 AIN0 MOSI PCINT0",
      "coverage": "missing",
      "hits": [
        { "slug": "attiny85-pin-map", "score": 0.42, "strong": false },
        { "slug": "arduino-uno-alternate-functions-table", "score": 0.38, "strong": false }
      ],
      "suggestion": "seed-stub"
    }
  ]
}
```

## Integration points

- **T1 `/vault-gap`** — this skill invokes `/vault-gap` (when `--auto-seed-gaps`) for missing/thin tasks. Each invocation passes `--origin-plan <plan-file> --origin-task <task-id>`.
- **T2 `/vault-validate`** — before citing a slug in the report, optionally validate it (skipped by default to keep scans fast).
- **T15 `/vault-extract-priority`** — gap-seeds written by auto-seed-gaps land in `ops/queue/gap-stubs.md`, which T15 will priority-rank for `/extract`.
- **Plan research logs** — the report is designed to paste directly.

## Rate limits + performance

qmd rate limit is typically low (hundreds of req/min). For a plan with ~100 tasks:
- Default: serial calls, 100ms sleep between, ~30 seconds total.
- For very large plans (300+ tasks), prefer `--limit-tasks 50` to sample first, then decide if full scan is worth the time.

If qmd fails mid-scan, the report includes partial results + an error marker. Re-run to retry failed tasks.

## Anti-patterns

| Anti-Pattern | Why It Fails | Instead |
|--------------|--------------|---------|
| Pass full task description to qmd | Scores degrade on long queries | Compress to ≤12 concept keywords |
| Auto-seed every thin task | Queue pollution; existing thin hit might be enough | Default `--auto-seed-gaps` to OFF; let user decide |
| Scan a plan > 500 tasks without `--limit-tasks` | Long wait; rate-limit risk | Sample first, then full-scan if value clear |
| Cite slugs below `--min-score` threshold | Weak recommendations erode plan quality | Respect threshold; flag as `missing` |
| Treat missing as failure | Gaps are normal — that's the POINT of /vault-gap | Report calmly; let plan author queue seeds |

## Version history

- **1.0 (2026-04-18)** — initial ship. Depends on T1 + T2. Markdown + JSON output. Auto-seed-gaps opt-in.
