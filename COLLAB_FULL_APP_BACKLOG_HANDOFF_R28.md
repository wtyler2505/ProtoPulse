## Lane Reservation

- Active channels: COLLAB_FULL_APP_BACKLOG_HANDOFF_R28.md, COLLAB_FULL_APP_BACKLOG_RESPONSE_R28_CODEX.md
- Claimed files: client/src/components/circuit-editor/breadboard-canvas/BreadboardWorkSurfaceStatus.tsx, client/src/components/circuit-editor/breadboard-canvas/index.tsx, client/src/components/circuit-editor/BreadboardQuickIntake.tsx, client/src/components/circuit-editor/BreadboardWorkbenchSidebar.tsx, client/src/components/circuit-editor/__tests__/BreadboardView.test.tsx, client/src/components/circuit-editor/__tests__/BreadboardQuickIntake.test.tsx, client/src/components/circuit-editor/__tests__/BreadboardWorkbenchSidebar.test.tsx, e2e/p1-breadboard-inspector-container.spec.ts, .agents/skills/pp-view-breadboard/references/testing.md, .agents/skills/pp-view-breadboard/references/self-improvement-log.md, .agents/skills/breadboard-lab/references/testing-and-browser-verification.md, COLLAB_FULL_APP_BACKLOG_HANDOFF_R28.md, COLLAB_FULL_APP_BACKLOG_RESPONSE_R28_CODEX.md
- Forbidden files: CODEX_HANDOFF.md, CODEX_DONE.md, existing unrelated COLLAB_*, .env, knowledge/**, data/pp-nlm/**
- Background sessions: none
- Round type: implement
- Target file edits permitted this round: listed-only
- Agent cap status: 1/6 active implementation agent counted from current Codex turn; no background implementation workers dispatched

# Full App Views Backlog Campaign R28

## Scope For This Round

Continue the Breadboard Lab/UI-container portion of the full-app backlog after R27 completed the Digital Twin live-state overlay.

- Keep the existing Breadboard `View in 3D` bridge intact.
- Add selected-part trust/provenance visibility directly to the breadboard canvas work-surface status dock.
- Preserve the dock's current scroll/collapse/resize behavior.
- Cover the canvas provenance row in focused Breadboard unit and laptop-height browser checks.
- Update the nearest Breadboard skill references so future work treats canvas-level provenance as part of the work-surface contract.
- Do not start broad canvas extraction or rewrite pointer/drag/wire behavior in this round.

## Evidence Before Edits

- `docs/FULL-APP-VIEWS-AND-PAGES-BACKLOG-REPORT.md` lists Breadboard P1 gaps for board-health/coach visibility and trust/provenance badges that are instantly scannable on the main surface.
- Current Breadboard work already includes a `BreadboardWorkSurfaceStatus` dock with board health and coach controls, but it does not yet surface selected-part trust/provenance inside that canvas-level dock.
- `BreadboardPartInspector` already contains richer trust badges, but the backlog calls out provenance directly on canvas/work surfaces, not only in side inspectors.
- Context7 checked current React docs for event handlers, derived render data, and pure rendering.
- Context7 checked current Playwright docs for locators, web-first assertions, accessible checks, and screenshot capture.
- Dirty diffs for claimed Breadboard files were inspected before this R28 implementation.

---
ROUND_STATUS: proposed
OPEN_CRITIQUES: R28 should only add canvas-level selected-part provenance visibility and tests; canvas extraction belongs in a later guarded round.
SIGNOFF: Codex
OWNERSHIP: Codex
NEXT_ROUND: Implement the Breadboard work-surface provenance row, then rerun focused Breadboard checks and page-skill gates.
---
