---
summary: Post-wave completion steps must be an explicit checklist because behavioral rules like "always update docs" fail silently across context compactions and new sessions
type: methodology
category: maintenance
source: rethink
created: 2026-03-13
status: active
evidence: ["wave-velocity-vs-integration-debt", "comprehensive-backlog-accuracy-vs-maintenance-overhead", "quality-first-development-vs-documentation-overhead"]
---

# wave completion requires a checklist not a behavioral rule

## What to Do

After completing a wave of work, execute this checklist before committing:

1. **MASTER_BACKLOG.md** — Update every touched BL-XXXX item status to DONE with wave number. Then update Quick Stats counts to match.
2. **CHANGELOG.md** — Add wave entry with items completed, files changed, test count delta.
3. **AGENTS.md** — Verify file counts, table counts, test counts, and route counts match the codebase reality.
4. **`npm run check`** — Must exit 0. No exceptions.
5. **`npm test`** — Must pass. No new failures.
6. **Knowledge vault** — If the wave produced non-obvious insights, create or update insight notes.

## What to Avoid

- Relying on "agents will remember to update docs" — they won't after context compaction.
- Treating docs updates as optional cleanup — they are part of the wave, not after it.
- Splitting the checklist across multiple commits — do it atomically so the commit is self-consistent.

## Why This Matters

Three tensions converge on the same root cause: manual operational overhead scales linearly with wave velocity while feature work is parallelized via agent teams.

- **Backlog stats drift** — agents mark items DONE but forget Quick Stats. The summary lies about its own contents. (See [[backlog-should-be-generated-from-structured-data]])
- **Documentation tax** — docs updates are sequential and manual despite parallel feature delivery. When under momentum, they get skipped.
- **Integration debt** — features ship vertically but horizontal wiring is deferred. The gap between "feature exists" and "feature is accessible" grows with each wave.

A behavioral rule ("ALWAYS update ALL docs before committing") is the current enforcement. It fails because:
- Context compaction loses the rule mid-session
- New sessions don't inherit behavioral habits from prior sessions
- The rule has no verification step — compliance is invisible

A checklist converts the discipline problem into a structural problem. Each step is concrete, verifiable, and survives session boundaries.

## When This Applies

- End of every numbered wave
- After any bulk operation that changes 5+ files
- Before any commit that modifies MASTER_BACKLOG.md item statuses

## Relationship to Other Methodology

This mirrors [[backlog-should-be-generated-from-structured-data]] — both address the same failure mode (manual multi-step updates diverge from reality) through different lenses. The backlog note addresses the data representation problem. This note addresses the process enforcement problem. A future automation could solve both simultaneously by generating docs from structured data as a post-wave hook.

---

Related: [[methodology]]
