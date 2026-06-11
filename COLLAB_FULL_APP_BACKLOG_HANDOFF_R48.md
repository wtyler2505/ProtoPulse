## Lane Reservation

- Active channels: COLLAB_FULL_APP_BACKLOG_HANDOFF_R48.md, COLLAB_FULL_APP_BACKLOG_RESPONSE_R48_CODEX.md
- Claimed files: client/src/components/circuit-editor/breadboard-canvas/BreadboardWorkSurfaceStatus.tsx; client/src/components/circuit-editor/breadboard-canvas/index.tsx; client/src/components/circuit-editor/__tests__/BreadboardView.test.tsx; COLLAB_FULL_APP_BACKLOG_HANDOFF_R48.md; COLLAB_FULL_APP_BACKLOG_RESPONSE_R48_CODEX.md
- Forbidden files: CODEX_HANDOFF.md; CODEX_DONE.md; unrelated existing COLLAB_*; .env; knowledge/**; data/pp-nlm/**
- Background sessions: focused test/build checks only, none intended to remain active
- Round type: implement
- Target file edits permitted this round: listed-only
- Agent cap status: 2/6 active (source: visible process list: current Codex plus Playwright MCP)

# ProtoPulse Full App Views Backlog R48 - Breadboard Work-Surface View In 3D

## Context

Prior Breadboard rounds wired the selected-part inspector's `View in 3D` action and surfaced board health, provenance, and coach state on the canvas work surface. The next backlog-aligned Breadboard step is to make the 3D handoff reachable from that canvas work surface, not only from the sidebar inspector.

Skills checked: `executing-plans`, `pp-view-breadboard`, `breadboard-lab`, `pp-view-3d`, and `pp-view-uiux-design`.

Docs checked: Context7 React `/reactjs/react.dev` for `useMemo` / `useCallback` dependency guidance.

## Scope

- Add a selected-part `View in 3D` action to `BreadboardWorkSurfaceStatus`.
- Keep the action reachable while the status dock is collapsed.
- Reuse the existing `handleViewSelectedPartIn3D` bridge path so the same trust, board-health, and selected-part context is preserved.
- Cover the canvas-level action in the existing Breadboard focused test.

## Pre-Edit Dirty State

- `BreadboardView.test.tsx` and `breadboard-canvas/index.tsx` are already dirty from prior Breadboard work; diffs were inspected before this slice.
- `BreadboardWorkSurfaceStatus.tsx` is untracked from prior Breadboard work and is claimed for this round.
- `BreadboardPartInspector.tsx`, `BreadboardWorkbenchSidebar.tsx`, `BreadboardView.tsx`, `ComponentPlacer.tsx`, `drag-mime.ts`, and prior 3D/Digital Twin bridge files remain dirty/untracked from earlier slices and are not claimed for R48 unless a verification failure proves they must change.

## Verification Required

- `npm run test -- client/src/components/circuit-editor/__tests__/BreadboardView.test.tsx`
- `node .agents/skills/pp-view-breadboard/scripts/inspect-breadboard-view.mjs`
- `node .agents/skills/pp-view-3d/scripts/inspect-3d.mjs`
- `node .agents/skills/pp-view-uiux-design/scripts/inspect-uiux-design.mjs`
- `npm run check`
- `npm run build`
- `env -u FORCE_COLOR -u NO_COLOR PLAYWRIGHT_HTML_OPEN=never npm run test:e2e -- e2e/p1-viewer-3d-bridge.spec.ts --reporter=dot --workers=1`
- `env -u FORCE_COLOR -u NO_COLOR PLAYWRIGHT_HTML_OPEN=never npm run test:e2e -- e2e/p1-breadboard-inspector-container.spec.ts --reporter=dot --workers=1`
- `git diff --check -- client/src/components/circuit-editor/breadboard-canvas/BreadboardWorkSurfaceStatus.tsx client/src/components/circuit-editor/breadboard-canvas/index.tsx client/src/components/circuit-editor/__tests__/BreadboardView.test.tsx COLLAB_FULL_APP_BACKLOG_HANDOFF_R48.md COLLAB_FULL_APP_BACKLOG_RESPONSE_R48_CODEX.md`

---
ROUND_STATUS: proposed
OPEN_CRITIQUES: none
SIGNOFF: Codex
OWNERSHIP: Codex
NEXT_ROUND: Add and verify the canvas-level Breadboard `View in 3D` action.
---
