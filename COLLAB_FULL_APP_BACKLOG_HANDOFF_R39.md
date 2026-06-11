## Lane Reservation

- Active channels: COLLAB_FULL_APP_BACKLOG_HANDOFF_R39.md, COLLAB_FULL_APP_BACKLOG_RESPONSE_R39_CODEX.md
- Claimed files: client/src/lib/breadboard-instance-provenance.ts; client/src/components/circuit-editor/BreadboardView.tsx; client/src/components/circuit-editor/breadboard-canvas/index.tsx; client/src/components/circuit-editor/__tests__/breadboard-lab-contracts.test.ts; .agents/skills/pp-view-breadboard/references/testing.md; .agents/skills/pp-view-breadboard/references/self-improvement-log.md; .agents/skills/breadboard-lab/references/testing-and-browser-verification.md; COLLAB_FULL_APP_BACKLOG_HANDOFF_R39.md; COLLAB_FULL_APP_BACKLOG_RESPONSE_R39_CODEX.md
- Forbidden files: CODEX_HANDOFF.md; CODEX_DONE.md; unrelated existing COLLAB_*; .env; knowledge/**; data/pp-nlm/**
- Background sessions: focused test/browser checks only, none intended to remain active
- Round type: implement
- Target file edits permitted this round: listed-only
- Agent cap status: 2/6 active (source: inherited campaign context plus current Codex lane)

# ProtoPulse Full App Views Backlog R39 - Breadboard Contract Guard Hardening

## Context

R24/R25/R28/R34 already moved Breadboard forward: the selected-part `View in 3D` bridge exists, the work-surface status dock exposes board health and coach state, provenance appears on the work surface, and the inspector/status containers have laptop-height UI Container Rule coverage. The remaining first-wave foundation gap is that `breadboard-lab-contracts.test.ts` is still placeholder documentation instead of a real guard.

## Scope

- Add a small provenance helper for Breadboard instance provenance and bench-vs-board placement classification.
- Stamp new Breadboard instance creation paths with explicit `breadboardProvenance` values for exact, project, starter, and coach-created parts.
- Replace placeholder Breadboard Lab contract tests with real assertions for provenance, placement, coach trust ordering, and sync-created wire provenance.
- Update Breadboard skill references with the new guard.

## Verification Required

- `npm run test -- client/src/components/circuit-editor/__tests__/breadboard-lab-contracts.test.ts client/src/components/circuit-editor/__tests__/BreadboardView.test.tsx client/src/lib/circuit-editor/__tests__/view-sync-provenance.test.ts`
- `node .agents/skills/pp-view-breadboard/scripts/inspect-breadboard-view.mjs`
- `node .agents/skills/pp-view-3d/scripts/inspect-3d.mjs`
- `npm run page-skills:check`
- `npm run check`
- `git diff --check -- <claimed R39 files>`

---
ROUND_STATUS: proposed
OPEN_CRITIQUES: none
SIGNOFF: Codex
OWNERSHIP: Codex
NEXT_ROUND: Harden Breadboard contract tests and explicit instance provenance before deeper canvas extraction.
---
