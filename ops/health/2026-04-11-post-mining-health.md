---
health_date: 2026-04-11
generated_by: session-mining-rebuild
supersedes: ops/health/2026-04-11-full-system-health.md
---

# Post-Mining System Health Snapshot — 2026-04-11

Captured at the completion of the session-mining pipeline rebuild (`docs/plans/2026-04-11-session-mining-pipeline-rebuild.md`). Supersedes the pre-remediation baseline from earlier the same day (`ops/health/2026-04-11-full-system-health.md`). Future /architect passes should compare their findings against this file.

## Schema Compliance

| Check | Result | Status |
|---|---|---|
| Missing `description:` | 0 / 148 | PASS |
| Missing `type:` | 0 / 148 | PASS |
| Missing `topics:` | 4 / 148 | PASS (all 4 are MOCs; MOC template only requires `description`) |
| Orphan notes | 0 | PASS |
| Stale notes (30d + <2 links) | 0 / 148 | PASS |
| Dangling wiki-links | unchanged from prior snapshot (13 bash/prose false positives) | PASS (no real dangling) |
| Three-space boundary violations | 0 | PASS — was 1 cluster of 5 links, fixed in prior plan's Phase 1 |

## MOC Sizing (threshold 40 per queue.json.moc_oversize)

Unchanged from prior snapshot — Phase 1-3 of the prior plan already addressed MOC sprawl. This plan did not modify any MOC directly.

| MOC | Entries | Status |
|---|---|---|
| claude-code-skills | 40 | AT THRESHOLD (unchanged — deferred until 45+) |
| architecture-decisions | 31 | OK (was 54, reduced in prior plan's Phase 2) |
| gaps-and-opportunities | 30 | OK (was 48, reduced in prior plan's Phase 3) |
| competitive-landscape | 21 | OK |
| maker-ux | 20 | OK |
| eda-fundamentals | 16 | OK |
| dev-infrastructure | 15 | OK (was 43, reduced in prior plan's Phase 2) |
| index | 13 | OK |
| ai-system-debt | 13 | OK |
| breadboard-intelligence | 12 | OK |
| performance-debt | 10 | OK |
| goals | 10 | OK |
| security-debt | 8 | OK |
| resource-leaks-debt | 3 | OK (new in prior plan's Phase 2) |
| desktop-pivot-debt | 3 | OK (new in prior plan's Phase 2) |
| infrastructure-hooks | 7 | OK (new in prior plan's Phase 2) |
| infrastructure-agents | 6 | OK (new in prior plan's Phase 2) |
| infrastructure-mcp | 7 | OK (new in prior plan's Phase 2) |
| methodology | 2 | UNDER 10 (intentional stub — collapsed in prior plan's Phase 3) |
| identity | 5 | UNDER 10 (intentional stub — keep) |

## Operational State

| Signal | Observed | Expected per spec |
|---|---|---|
| Session stubs total | 233 | variable |
| Stubs `mined:true` (pre-existing) | 71 | stable — mix of compact-checkpoints + hand-cleanups |
| Stubs `mined:"transcript-unavailable"` | 163 | terminal — all reconciled orphans |
| Stubs `mined:null/false` | ~0 | none after Phase 4; will grow slowly as the fixed capture hook writes new stubs with `mined:false` awaiting routine mining |
| Real transcripts available | 10 | variable per Claude Code retention |
| Observations pending | 3 | up from 1 — added `capture-hook-session-id-bug.md` (Phase 1) and `taskcompleted-hook-misfires-on-read-only-sessions.md` (Phase 4) |
| Methodology notes | 7 | up from 6 — added `use-desktop-commander-when-bash-permission-denied-on-destructive-ops.md` (Phase 4) |
| Tensions open | 0 | empty directory |
| Inbox depth | 0 | empty directory |
| Queue tasks pending | 0 | maint-001 marked done |
| Queue tasks done | 2 | knowledge-index + maint-001 |
| ops/health/ directory | 2 snapshots | populated with pre- and post-remediation |

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

1. **MOC Sprawl (#5) — MITIGATED** (prior plan). All MOCs under 40-entry threshold except `claude-code-skills` which is exactly at 40 and intentionally deferred until 45+.
2. **Over-Automation (#8) — RESOLVED** (this plan). Capture hook fixed (Phase 2), mining runner built (Phase 3), backlog processed (Phase 4). The feedback loop is operational end-to-end: capture hook reads stdin → stub includes `transcript_path` → mining runner reads the transcript → friction candidates → agent classifies → observation/methodology notes in the correct spaces.
3. **Productivity Porn (#9) — MITIGATED**. Both the prior plan and this one stayed within scope boundaries. The 25% meta-work budget rule did not apply because this was execution work on a known backlog, not pre-emptive restructuring.
4. **Link Rot (#3) — CLEAR**. Zero orphan notes, zero real dangling links.

## Link Density

Unchanged overall shape:
- Total notes: 148 (146 + 2 new from this plan)
- Total topic maps: 20 (unchanged — this plan created no new topic maps, only observation and methodology notes in the operational space)
- Approximate link density: ~4 incoming links per note

## Previous Architect Passes and Related Plans

- 2026-04-06: first full /architect pass after comprehensive audit ingestion.
- 2026-04-11 (earlier): /architect full run → 6 recommendations, implemented in `docs/plans/2026-04-11-knowledge-vault-health-restoration.md`. 4 commits: `1632908f` (Phase 1), `bc139d0a` (Phase 2), `868e6713` (Phase 3), `9f3b6544` (Phase 4).
- 2026-04-11 (later — this plan): session-mining pipeline rebuild, implemented in `docs/plans/2026-04-11-session-mining-pipeline-rebuild.md`. 5 commits: `0796390d` (Phase 1), `7593c468` (Phase 2), `f73a6643` (Phase 3), `d2e5de1a` (Phase 4), Phase 5 commit after this file.

## Remediation Applied

See `ops/derivation.md` Evolution Log entries for 2026-04-11 (both the /architect entry from the earlier plan and the session-mining-rebuild entry from this one).

## Infrastructure Now In Place (was missing before this plan)

- `.claude/hooks/session-capture.sh` reads stdin JSON from Claude Code Stop-hook payload, extracts `session_id` (transcript UUID) and `transcript_path` (absolute path), and writes both into stub JSON.
- `ops/queries/mine-session.sh` — ProtoPulse-local mining runner. Reads a `.jsonl` transcript, emits markdown friction-candidate report per `/remember` skill taxonomy. Invoked per-transcript; does not write notes directly.
- `ops/queries/reconcile-orphan-stubs.sh` — bulk-marks stubs with no matching transcript as `mined:"transcript-unavailable"`. Has `--dry-run` mode.
- `ops/queue/queue.json` `maint-001` marked done with runbook notes pointing to the two scripts above for future ongoing mining.

---

**Next health snapshot:** suggested on next `/architect` pass. Routine mining can proceed by running `ops/queries/mine-session.sh <transcript-path>` against any future transcript and reviewing the report; if friction patterns accumulate, re-run `/remember` or the ProtoPulse-local runner can also be extended to write notes directly once confident patterns stabilize.
