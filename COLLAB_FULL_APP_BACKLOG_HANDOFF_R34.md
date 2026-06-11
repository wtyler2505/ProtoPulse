## Lane Reservation

- Active channels: COLLAB_FULL_APP_BACKLOG_HANDOFF_R34.md, COLLAB_FULL_APP_BACKLOG_RESPONSE_R34_CODEX.md
- Claimed files: client/src/components/circuit-editor/BreadboardPartInspector.tsx; client/src/components/circuit-editor/breadboard-canvas/BreadboardWorkSurfaceStatus.tsx; client/src/components/circuit-editor/__tests__/BreadboardPartInspector.trustTier.test.tsx; client/src/components/circuit-editor/__tests__/BreadboardView.test.tsx; e2e/p1-breadboard-inspector-container.spec.ts; .agents/skills/breadboard-lab/references/testing-and-browser-verification.md; .agents/skills/pp-view-breadboard/references/testing.md; .agents/skills/pp-view-breadboard/references/self-improvement-log.md; COLLAB_FULL_APP_BACKLOG_HANDOFF_R34.md; COLLAB_FULL_APP_BACKLOG_RESPONSE_R34_CODEX.md
- Forbidden files: CODEX_HANDOFF.md; CODEX_DONE.md; unrelated existing COLLAB_*; .env; knowledge/**; data/pp-nlm/**
- Background sessions: focused test/browser checks only, none intended to remain active
- Round type: implement
- Target file edits permitted this round: listed-only
- Agent cap status: 2/6 active (source: inherited campaign context plus current Codex lane)

# ProtoPulse Full App Views Backlog R34 - Breadboard Overlay Container Proof

## Context

Breadboard now has the selected-part inspector, work-surface board health/coach/provenance dock, and `View in 3D` bridge. This round hardens the overlay container contract and browser proof so the new Breadboard UI follows the capstone UI Container Rule under laptop-height pressure.

## Scope

- Align the selected-part inspector and work-surface status dock around explicit scroll, resize, and collapse metadata.
- Keep selected-part trust/provenance and `View in 3D` reachable while collapsed.
- Strengthen focused component and browser tests for expanded state, viewport containment, and no console/page errors.
- Update Breadboard skill notes with the new R34 evidence.

## Verification Required

- `npm run test -- client/src/components/circuit-editor/__tests__/BreadboardPartInspector.trustTier.test.tsx client/src/components/circuit-editor/__tests__/BreadboardView.test.tsx`
- `node .agents/skills/pp-view-breadboard/scripts/inspect-breadboard-view.mjs`
- `env -u NO_COLOR -u FORCE_COLOR PLAYWRIGHT_HTML_OPEN=never npm run test:e2e -- e2e/p1-breadboard-inspector-container.spec.ts --reporter=dot --workers=1`
- `npm run check`
- `npm run page-skills:check`
- `npm run page-skills:audit-packs`
- `npm run build`

---
ROUND_STATUS: proposed
OPEN_CRITIQUES: none
SIGNOFF: Codex
OWNERSHIP: Codex
NEXT_ROUND: Harden Breadboard overlay container proof and verify it.
---
