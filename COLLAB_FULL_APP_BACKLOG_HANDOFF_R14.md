## Lane Reservation

- Active channels: COLLAB_FULL_APP_BACKLOG_HANDOFF_R14.md, COLLAB_FULL_APP_BACKLOG_RESPONSE_R14_CODEX.md
- Claimed files: client/src/components/circuit-editor/BreadboardView.tsx, client/src/components/circuit-editor/breadboard-canvas/index.tsx, client/src/components/circuit-editor/__tests__/BreadboardView.test.tsx, client/src/components/views/BoardViewer3DView.tsx, .agents/skills/pp-view-breadboard/references/testing.md, .agents/skills/pp-view-breadboard/references/gotchas.md, .agents/skills/pp-view-breadboard/references/self-improvement-log.md, .agents/skills/breadboard-lab/references/testing-and-browser-verification.md, COLLAB_FULL_APP_BACKLOG_HANDOFF_R14.md, COLLAB_FULL_APP_BACKLOG_RESPONSE_R14_CODEX.md
- Forbidden files: CODEX_HANDOFF.md, CODEX_DONE.md, existing unrelated COLLAB_*, .env, knowledge/**, data/pp-nlm/**
- Background sessions: none
- Round type: implement
- Target file edits permitted this round: listed-only
- Agent cap status: 1/6 active implementation agent counted from current Codex turn; no background workers dispatched

# Full App Views Backlog Campaign R14

## Scope For This Round

Codex starts the Breadboard Lab wave with the highest-ROI report item:

- Wire the selected-part inspector's `View in 3D` button so it no longer renders as dead UI.
- Carry selected-part identity/trust context out of the canvas via a browser event for the follow-on 3D bridge consumer pass.
- Switch the workspace to `viewer_3d` when the action is invoked.
- Add focused Breadboard tests around the selected-part button.
- Update Breadboard skill notes so future agents keep the bridge contract visible.
- If the proof route exposes an existing 3D-view console warning on entry, allow only a narrow cleanup in `BoardViewer3DView.tsx` needed to keep this bridge warning-clean.

## Evidence Before Edits

- `docs/FULL-APP-VIEWS-AND-PAGES-BACKLOG-REPORT.md` section 9 flags `View in 3D` as P0 because `BreadboardPartInspector` has the button prop but the parent path does not pass a handler.
- `BreadboardPartInspector.tsx` currently renders the button only when `onViewIn3D` is present.
- `breadboard-canvas/index.tsx` creates the selected-part model but does not pass a handler into the inspector.
- `BreadboardView.tsx` already has `setActiveView` available from `useProjectMeta`.
- `node .agents/skills/pp-view-breadboard/scripts/inspect-breadboard-view.mjs` passed before edits.
- Browser proof exposed the existing dev-only `THREE.Clock` warning filter in `BoardViewer3DView.tsx` as too narrow for the current Three.js warning text; that file was already dirty, so any edit there must be limited to the warning-filter condition.

---
ROUND_STATUS: proposed
OPEN_CRITIQUES: Selected-part View in 3D button exists as UI surface but is unwired from BreadboardView and cannot navigate to the 3D viewer.
SIGNOFF: Codex
OWNERSHIP: Codex
NEXT_ROUND: Implement Breadboard selected-part View in 3D wiring, tests, skill notes, and verification.
---
