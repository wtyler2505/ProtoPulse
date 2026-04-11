---
observed_date: 2026-04-11
category: system-drift
severity: high
resolved: false
resolution: ""
---

# Session mining pipeline stopped running after 2026-04-06 leaving 231 unprocessed sessions

## Context

Detected during /architect full-system analysis on 2026-04-11. The vault health scan revealed 231 session stubs in `ops/sessions/` with `"mined": false`, while `ops/queue/queue.json` still claimed the maintenance task was for "3 session files." No observation notes had been captured since the vault was initialized on 2026-04-05 (observations directory was empty). No tensions recorded. No health reports generated.

## Signal

The condition-based maintenance loop — detect → surface → act — has silently stopped working. Specifically:

1. **Capture works:** the SessionEnd hook writes a JSON stub for every session, correctly.
2. **Mining does not run:** `/remember --mine-sessions` has not fired since 2026-04-06, even though the queue had a pending task for it.
3. **Observations space is empty:** the mechanism that converts mined transcripts into `ops/observations/*.md` never runs.
4. **Queue staleness:** the maint-001 counter was 77× stale (3 vs 231).
5. **No health history:** `ops/health/` directory does not exist, so the previous /architect pass left no baseline to compare against.

All five symptoms point to the same root cause: the recursive improvement loop is severed. The system is producing telemetry (session capture) that nothing downstream reads.

This is the Over-Automation failure mode from `reference/failure-modes.md` #8: "Automation should fail loudly, not fix silently." It is also Drift Detection Type 1 Staleness from `reference/evolution-lifecycle.md`: "The system evolved but the specification did not keep pace."

## Potential Response

Immediate (this /architect pass):
- Update queue.json to reflect real unmined count
- Populate ops/observations/ with this note (first observation — mere existence restores the detection half of the loop)
- Create ops/health/ with a baseline snapshot so future /architect passes have priors to compare against

Deferred (next work item, separate session):
- Run `/remember --mine-sessions` on a sample of ~20 sessions to prove the mining pipeline still works end-to-end
- If mining works: scale to the full 231
- If mining is broken: diagnose the break (hook? skill? transcript format?)

Promotion target: if this pattern repeats after /remember is re-wired — i.e., observations accumulate but do not surface during /next or /architect — promote to `knowledge/dev-infrastructure.md` as a methodology note about "feedback loop monitoring."

---

Topics:
- [[methodology]]
