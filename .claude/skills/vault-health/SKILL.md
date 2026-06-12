---
name: vault-health
description: Emit a weekly health report for the Ars Contexta vault. Reads the T3 backlink index + T1 gap-stubs queue + knowledge/ freshness. Produces a heatmap of consumed vs orphaned notes, a demand-gap table (topics plans want but vault lacks), and a trend comparison against the previous report. Output lands in ops/health/YYYY-MM-DD-report.md. Triggers on "/vault-health", "/vault-health report", "weekly vault report", "vault consumption stats", "who is my vault helping".
version: "1.0"
user-invocable: true
context: fork
allowed-tools: Read, Grep, Glob, Bash
argument-hint: "[--top N] [--json] [--compare <previous-report-path>] [--dry-run]"
---

## EXECUTE NOW

**Mode: $ARGUMENTS**

Parse flags:
- `--top N` — cap heatmap to top-N consumed + bottom-N orphan (default 20).
- `--json` — emit JSON to stdout; do NOT write a report file.
- `--compare <path>` — diff stats against a previous report.
- `--dry-run` — print report body to stdout, don't write.

**Execute these steps:**

1. **Rebuild T3 index** — run `python3 .claude/skills/vault-index/scripts/build-index.py` OR read `ops/index/plan-vault-backlinks.json` if fresh (<1h old). T3 output is the source of truth.
2. **Read T1 queue** — parse `ops/queue/gap-stubs.md` for demand signals.
3. **Compute sections**:
   - **Top-consumed** — notes with highest `referenced_by_plans + consumed_by_code` count.
   - **Top-orphaned** — notes with zero backlinks. Highlight candidates for archival / MOC promotion / consumption.
   - **Demand gaps** — topics in gap-stubs queue that are still `pending` (not yet extracted). Groups by origin plan.
   - **Freshness** — notes with `reviewed` > 365d (verified) / 730d (else) OR missing `reviewed` altogether (per T2 schema).
   - **Provenance coverage** — run `python3 .claude/skills/vault-source/scripts/source.py --coverage --json` (vault-source owns the per-note renderer; this report owns the vault-wide view). Reports % of notes with `provenance[]`, breakdown by source kind + reliability tier, and confidence-verified-without-provenance violations. Coverage math is only meaningful post-migration — pre-migration it mostly measures migration progress (~15 notes had provenance at the 2026-06-11 audit).
   - **Schema drift** — **POST-MIGRATION ONLY.** Skip this section (emit "schema-drift: skipped — vault pre-migration") until the v2 frontmatter migration completes. Pre-migration, the `_schema:` block in `ops/config.yaml` deliberately accepts legacy enums as WARN-only; running drift counts now produces ~700 lines of accepted-legacy noise, not signal. Once migration lands, count `/vault-validate` (lint) `error` / `warning` / `info` violations by severity.
   - **Trend** — if `--compare`: delta vs previous report (`Δ orphan_count`, `Δ total_backlinks`, etc.).
4. **Emit report** — write to `ops/health/YYYY-MM-DD-report.md` unless `--dry-run`.
5. **Append to history index** — update `ops/health/index.md` with a one-line summary.

**Pipeline discipline** — reads all inputs; writes only to `ops/health/`.

**START NOW.** Reference below explains report anatomy, trend analysis, and how other skills should consume.

---

## Report anatomy

```markdown
# Vault Health Report — 2026-04-18

## Summary
- Total notes: 683 (Δ +0 since last week)
- Total backlinks: 90 (Δ +23 since last week) ← trending up
- Orphan count: 669 (97.9% of vault) ← unhealthy; target <40%
- Schema drift: 412 warnings, 28 errors (Δ -11 since last week)
- Pending gap-stubs: 14 (oldest: 2026-04-10)

## Top-consumed notes (backlinks)
| Rank | Slug | Plans | Code | Related-in | Total |
|------|------|-------|------|-----------|-------|
| 1 | esp32-gpio12-must-be-low-at-boot-... | 6 | 2 | 3 | 11 |
| ... |

## Top-orphaned notes (zero backlinks)
_(Showing 20 of 669; full list in JSON output)_
- **Candidates for MOC promotion** (high semantic value, just undiscovered):
  - <slug-list>
- **Candidates for archival** (legacy, superseded, stale):
  - <slug-list>

## Demand-gap queue (pending T1 stubs)
| Stub | Origin plan | Task | Unblocks | Age |
|------|-------------|------|----------|-----|
| wcag-focus-ring-contrast | 03-a11y-systemic.md | Wave 10.1 | 03, 16 | 3d |
| ... |

## Schema drift (T2 violations) — POST-MIGRATION ONLY; emit "skipped — pre-migration" until then
- Error (28): <breakdown by rule>
- Warning (412): most common: missing `audience`, missing `reviewed`, missing `confidence`
- Info (87): <breakdown>

## Provenance coverage (via vault-source scripts/source.py --coverage)
- With provenance: <N> (<pct>%) | by kind: datasheet <n>, standard <n>, ...
- confidence=verified without provenance[]: <N>

## Freshness
- Never-reviewed (0 `reviewed` field): 641
- Stale >365d (verified): 2
- Stale >730d (supported): 8

## Trend (vs 2026-04-11 report)
- Orphan count: 692 → 669 (Δ -23; 3.3% improvement)
- Backlinks: 67 → 90 (Δ +23)
- Schema drift errors: 39 → 28 (Δ -11)

## Recommended actions (ranked)
1. Process top-5 pending gap-stubs via `/extract` → closes 14 demand-gaps.
2. Run `/vault-validate --fix` → auto-remediate ~60 schema warnings.
3. Review top-20 orphans for MOC promotion (expected to shift 20+ into "consumed" next week).
4. Trigger `/extract` to process migration-v2 stubs (T2 migration) — 641 notes need `reviewed` field.

## How to read this report
- **Healthy vault** = orphan count trending down, backlinks trending up, demand-gap age stable or decreasing.
- **Unhealthy signals** = orphan count stable-high, errors increasing, gap-stubs older than 30d.
- **Baseline**: 2026-04-18 ship of T3 index was first measurement. Target steady-state: ≤40% orphans.
```

## JSON output (when `--json`)

Same data, machine-readable. Keys: `generated_at`, `stats` (summary numbers), `top_consumed[]`, `top_orphaned[]`, `demand_gaps[]`, `schema_drift{}`, `freshness{}`, `trend{}`, `recommended_actions[]`.

## Cadence

Intended weekly, but **no cron is installed** — don't assume reports self-generate
(the gap between April reports and now is exactly this). Run weekly via `/vault-health`,
or add a cron yourself — see the cadence note in `docs/skills-sync.md`. If you do add
one, the entry point is `python3 .claude/skills/vault-health/scripts/report.py`,
output `ops/health/YYYY-MM-DD-report.md`. The `--compare` flag automatically finds
the previous report in `ops/health/` for trend computation.

## Integration points

- **T3 `/vault-index`** — primary data source. Must be fresh (<1h).
- **T1 `/vault-gap` queue** — for demand-gap rows.
- **T2 `/vault-validate`** — for schema drift counts (lint `--json`), post-migration only per the `ops/config.yaml` `_schema` accepted-legacy policy.
- **T6 `/vault-source`** — `scripts/source.py --coverage --json` supplies the provenance-coverage section (moved here from /vault-source's surface).
- **T4 MOC expansion** — weekly health feeds the roadmap; orphan clusters signal MOC expansion candidates.
- **T12 traceability panel (UI)** — may render the latest report inline.

## Anti-patterns

| Anti-Pattern | Why It Fails | Instead |
|--------------|--------------|---------|
| Run without T3 index | Metrics stale by definition | Always rebuild index first |
| Treat orphan count alone as unhealthy | Many notes need time to accrue consumers | Look at TREND — decreasing is healthy |
| Delete orphans on impulse | Valuable notes may be awaiting consumption | Always review top-20 orphans before archival |
| Skip `--compare` | Miss trend signals; can't tell improving vs degrading | Always include previous report when a prior exists |
| Write to `knowledge/` from this skill | Violates pipeline discipline | Only `ops/health/` writes allowed |

## Version history

- **1.1 (2026-06-11)** — fixed index-rebuild step (nonexistent `scripts/rebuild-index.sh` → `vault-index/scripts/build-index.py`); removed dead cron promise (manual weekly cadence; see docs/skills-sync.md); schema-drift section gated post-migration per `ops/config.yaml` `_schema` policy; absorbed vault-source's provenance-coverage report.
- **1.0 (2026-04-18)** — initial ship. Depends on T3 + T1 + T2.
