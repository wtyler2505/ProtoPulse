## Lane Reservation

- Active channels: COLLAB_FULL_APP_BACKLOG_HANDOFF_R24.md, COLLAB_FULL_APP_BACKLOG_RESPONSE_R24_CODEX.md
- Claimed files: client/src/components/circuit-editor/BreadboardPartInspector.tsx, client/src/components/circuit-editor/BreadboardView.tsx, client/src/components/circuit-editor/__tests__/BreadboardView.test.tsx, e2e/p1-viewer-3d-bridge.spec.ts, e2e/keyboard-helpers.ts, e2e/p1-keyboard-nav.spec.ts, playwright.config.ts, .agents/skills/breadboard-lab/references/testing-and-browser-verification.md, .agents/skills/pp-view-breadboard/references/testing.md, .agents/skills/pp-view-breadboard/references/self-improvement-log.md, .agents/skills/pp-view-3d/references/testing.md, .agents/skills/pp-view-3d/references/self-improvement-log.md, COLLAB_FULL_APP_BACKLOG_HANDOFF_R24.md, COLLAB_FULL_APP_BACKLOG_RESPONSE_R24_CODEX.md
- Forbidden files: CODEX_HANDOFF.md, CODEX_DONE.md, existing unrelated COLLAB_*, .env, knowledge/**, data/pp-nlm/**
- Background sessions: none
- Round type: implement
- Target file edits permitted this round: listed-only
- Agent cap status: 1/6 active implementation agent counted from current Codex turn; no background implementation workers dispatched

# Full App Views Backlog Campaign R24

## Scope For This Round

Harden the Breadboard Lab `View in 3D` bridge as the first R24 step:

- Preserve the already-dirty Breadboard parent wiring that publishes selected-part trust/provenance context and switches to `viewer_3d`.
- Add a stable selected-part inspector test id for the `View in 3D` action.
- Add browser proof that a real seeded Breadboard instance opens 3D View and surfaces Breadboard provenance in the bridge card.
- Keep verification scoped but strong enough to make this the regression baseline for later Breadboard/3D work.

## Evidence Before Edits

- `docs/FULL-APP-VIEWS-AND-PAGES-BACKLOG-REPORT.md` identifies Breadboard `View in 3D` as the highest-ROI P0 because the child button existed but the parent handler was previously missing.
- Current dirty work already includes:
  - `BreadboardPartInspector.onViewIn3D`
  - `BreadboardView.handleViewSelectedPartIn3D`
  - `publishBreadboard3DBridgeTarget`
  - BoardViewer bridge card support
  - a BreadboardView unit test for the bridge event.
- Existing dirty diffs were inspected before this R24 claim.
- Context7 React docs checked for event-handler/state shape; Context7 Playwright docs checked for web-first assertions, test-id driven browser proof, spec-level timeout handling, and `reportSlowTests`.
- Breadboard, 3D, and UI/UX page-skill inspectors passed before edits.

---
ROUND_STATUS: proposed
OPEN_CRITIQUES: R24 is intentionally limited to hardening the Breadboard selected-part -> 3D handoff; broader canvas cleanup, board-health coach visibility, and bidirectional 3D selection remain next.
SIGNOFF: Codex
OWNERSHIP: Codex
NEXT_ROUND: Add the browser regression and focused verification for Breadboard -> 3D, then continue Breadboard Lab cleanup.
---
