## Lane Reservation

- Active channels: COLLAB_FULL_APP_BACKLOG_HANDOFF_R46.md, COLLAB_FULL_APP_BACKLOG_RESPONSE_R46_CODEX.md
- Claimed files: client/src/components/views/BoardViewer3DView.tsx; client/src/components/views/__tests__/BoardViewer3DView.test.tsx; COLLAB_FULL_APP_BACKLOG_HANDOFF_R46.md; COLLAB_FULL_APP_BACKLOG_RESPONSE_R46_CODEX.md
- Forbidden files: CODEX_HANDOFF.md; CODEX_DONE.md; unrelated existing COLLAB_*; .env; knowledge/**; data/pp-nlm/**
- Background sessions: focused test/build checks only, none intended to remain active
- Round type: implement
- Target file edits permitted this round: listed-only
- Agent cap status: 2/6 active (source: visible process list: current Codex plus Playwright MCP)

# ProtoPulse Full App Views Backlog R46 - Digital Twin Pin Hot Spots In 3D

## Context

R45 carried Digital Twin channel scene mapping into the 3D viewer and highlighted matching components by reference designator. The next backlog-aligned step is to show exact pin-level live-state markers on the 3D component body when the bridge payload provides `pinLabel` or `pin` metadata.

Skills checked: `executing-plans`, `pp-view-digital-twin`, `pp-view-3d`, and `pp-view-uiux-design`.

Docs checked: Context7 React `/reactjs/react.dev` for `useMemo` and `useCallback` dependency guidance.

## Scope

- Build a pin-highlight map from Digital Twin live channel rows grouped by component reference designator.
- Render live/stale/waiting pin hot spots inside CSS 3D `ComponentBox` when component pins match the channel `pinLabel` or numeric `pin`.
- Keep component-level highlighting intact for the same channel rows.
- Add focused tests proving Digital Twin channel pin metadata creates a visible, accessible pin hot spot in the 3D scene.

## Pre-Edit Dirty State

- `BoardViewer3DView.tsx` and `BoardViewer3DView.test.tsx` are already dirty from prior 3D bridge and Digital Twin work; diffs were inspected before this slice.
- `DigitalTwinView.tsx` and `client/src/lib/viewer-3d-bridge.ts` are dirty/untracked from prior work but are not claimed for R46 unless a verification failure proves they must change.
- `client/src/components/circuit-editor/ComponentPlacer.tsx` and `client/src/lib/drag-mime.ts` remain unrelated dirty/untracked files and are not claimed or edited.

## Verification Required

- `npm run test -- client/src/components/views/__tests__/BoardViewer3DView.test.tsx`
- `node .agents/skills/pp-view-digital-twin/scripts/inspect-digital-twin.mjs`
- `node .agents/skills/pp-view-3d/scripts/inspect-3d.mjs`
- `node .agents/skills/pp-view-uiux-design/scripts/inspect-uiux-design.mjs`
- `npm run check`
- `npm run build`
- `env -u FORCE_COLOR -u NO_COLOR PLAYWRIGHT_HTML_OPEN=never npm run test:e2e -- e2e/p1-viewer-3d-bridge.spec.ts --reporter=dot --workers=1`
- `git diff --check -- client/src/components/views/BoardViewer3DView.tsx client/src/components/views/__tests__/BoardViewer3DView.test.tsx COLLAB_FULL_APP_BACKLOG_HANDOFF_R46.md COLLAB_FULL_APP_BACKLOG_RESPONSE_R46_CODEX.md`

---
ROUND_STATUS: proposed
OPEN_CRITIQUES: none
SIGNOFF: Codex
OWNERSHIP: Codex
NEXT_ROUND: Render and verify Digital Twin channel pin hot spots in the 3D viewer.
---
