---
health_date: 2026-04-11
generated_by: /architect
supersedes: none
---

# Full System Health Snapshot — 2026-04-11

Baseline snapshot captured during the /architect pass on 2026-04-11 (pre-remediation). This is the first entry in `ops/health/` — future /architect passes should compare their findings against this file.

## Schema Compliance

| Check | Result | Status |
|---|---|---|
| Missing `description:` | 0 / 146 | PASS |
| Missing `type:` | 0 / 146 | PASS |
| Missing `topics:` | 4 / 146 | PASS (all 4 are MOCs; MOC template only requires `description`) |
| Orphan notes | 0 | PASS |
| Stale notes (30d + <2 links) | 0 / 146 | PASS |
| Dangling wiki-links (per ops/queries/dangling-links.sh) | 13 (all bash-snippet and prose-example false positives) | PASS (no real dangling links) |
| Three-space boundary violations | 1 cluster: knowledge/methodology.md → ops/methodology/*.md (5 links) | WARN — addressed by R1 in this /architect pass |

## MOC Sizing (threshold 40 per queue.json.moc_oversize)

| MOC | Entries | Status |
|---|---|---|
| architecture-decisions | 54 | OVER (target of /architect R2) |
| gaps-and-opportunities | 48 | OVER (target of /architect R4) |
| dev-infrastructure | 43 | OVER (target of /architect R3) |
| claude-code-skills | 40 | AT THRESHOLD (no action — defer until 45+) |
| competitive-landscape | 21 | OK |
| maker-ux | 20 | OK |
| eda-fundamentals | 16 | OK |
| index | 13 | OK |
| ai-system-debt | 13 | OK |
| breadboard-intelligence | 12 | OK |
| performance-debt | 10 | OK |
| goals | 10 | OK |
| security-debt | 8 | OK |
| methodology | 7 | UNDER 10 (target of /architect R5 — collapse to stub) |
| identity | 5 | UNDER 10 (intentional stub — keep) |

## Operational State

| Signal | Observed | Expected per spec |
|---|---|---|
| Unmined sessions | 231 | queue says 3 (77× stale — target of R6a) |
| Observations pending | 0 | empty directory — target of R6b |
| Tensions open | 0 | empty directory |
| Inbox depth | 0 | empty directory |
| Queue tasks | 1 pending + 1 done | accurate except for maint-001 target count |
| ops/health/ directory | did not exist | should exist per v1.6 — target of R6c |

## Dimension Coherence (derivation.md vs config.yaml)

Zero drift. All 8 configuration dimensions still match the 2026-04-05 derivation:

- Granularity: atomic
- Organization: flat
- Linking: explicit+implicit
- Processing: heavy
- Navigation: 3-tier
- Maintenance: condition-based
- Schema: dense
- Automation: full

## Failure Modes Active

1. **MOC Sprawl (#5)** — 4 MOCs at or over the 40-entry threshold (architecture-decisions, gaps-and-opportunities, dev-infrastructure, claude-code-skills)
2. **Over-Automation (#8)** — session capture hooks run but mining pipeline does not follow up; 231 unprocessed stubs accumulating silently
3. **Productivity Porn (#9) — MITIGATED** — the 25% meta-work budget rule constrained this /architect pass to symptom + root cause only; no pre-emptive restructuring

## Link Density

- Total notes: 146
- Total topic maps: 15
- Approximate link density: ~4 incoming links per note (qualitative — no exact count without running graph analysis)

## Previous Architect Passes

- 2026-04-06: first full /architect pass after comprehensive audit ingestion. Split gaps-and-opportunities 62→47, archived source note, deferred architecture-decisions split at 50.

## Remediation Applied During This /architect Pass

See `ops/derivation.md` Evolution Log entry dated 2026-04-11 for the full change record (written in Phase 4 of this plan). The 6 recommendations from the /architect pass are tracked in `docs/plans/2026-04-11-knowledge-vault-health-restoration.md`.

---

**Next health snapshot:** suggested on next /architect pass, or after the 231-session mining batch runs (whichever comes first).
