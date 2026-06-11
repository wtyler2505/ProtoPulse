## Lane Reservation

- Active channels: COLLAB_FULL_APP_BACKLOG_HANDOFF_R50.md, COLLAB_FULL_APP_BACKLOG_RESPONSE_R50_CODEX.md
- Claimed files: client/src/lib/board-viewer-3d.ts; client/src/lib/__tests__/board-viewer-3d.test.ts; client/src/components/views/BoardViewer3DView.tsx; e2e/p1-viewer-3d-bridge.spec.ts; COLLAB_FULL_APP_BACKLOG_HANDOFF_R50.md; COLLAB_FULL_APP_BACKLOG_RESPONSE_R50_CODEX.md
- Forbidden files: CODEX_HANDOFF.md; CODEX_DONE.md; unrelated existing COLLAB_*; .env; knowledge/**; data/pp-nlm/**
- Background sessions: focused test/build checks only, none intended to remain active
- Round type: implement
- Target file edits permitted this round: listed-only
- Agent cap status: 2/6 active (source: visible process list: current Codex plus Playwright MCP)

# ProtoPulse Full App Views Backlog R50 - Digital Twin Pin Identity Fidelity

## Context

Digital Twin and 3D View now carry live channel, pin, and net state through the shared 3D bridge. Current-state inspection found a deeper fidelity bug: `BoardViewer3D.addComponent()` accepts generated pin geometry, but replaces every input pin id with a random UUID. That breaks real browser matching between Digital Twin `pinLabel` values and actual 3D component pins, even though unit tests with mocked components can still pass.

Skills checked: `executing-plans`, `pp-view-digital-twin`, `pp-view-3d`, and `pp-view-uiux-design`.

Docs checked earlier in the active lane: Context7 React `/reactjs/react.dev`; Context7 Playwright `/microsoft/playwright`; Context7 React Three Fiber `/pmndrs/react-three-fiber`; Context7 Three.js `/mrdoob/three.js`.

## Scope

- Preserve caller-provided 3D pin ids when adding a component to `BoardViewer3D`.
- Keep generated IDs for callers that do not provide pin ids.
- Add focused engine coverage so Digital Twin / 3D pin labels cannot silently drift back to random ids.
- If browser proof can be strengthened without broad new scaffolding, extend the existing 3D bridge e2e around live Digital Twin pin/net overlays.

## Pre-Edit Dirty State

- `client/src/lib/board-viewer-3d.ts` is currently clean and claimed for this round.
- `client/src/lib/__tests__/board-viewer-3d.test.ts` is currently clean and claimed for this round.
- `client/src/components/views/BoardViewer3DView.tsx` is dirty from prior 3D/Digital Twin bridge work and claimed here only for the real-scene render loop defect exposed by browser verification.
- `e2e/p1-viewer-3d-bridge.spec.ts` is already untracked from prior bridge work and claimed only if browser proof needs extension.
- R48/R49 files remain dirty/untracked and are not claimed here.
- Broad unrelated dirty tree state remains untouched.

## Verification Required

- `npm run test -- client/src/lib/__tests__/board-viewer-3d.test.ts`
- `npm run test -- client/src/components/views/__tests__/BoardViewer3DView.test.tsx client/src/components/views/__tests__/DigitalTwinView.test.tsx`
- `node .agents/skills/pp-view-digital-twin/scripts/inspect-digital-twin.mjs`
- `node .agents/skills/pp-view-3d/scripts/inspect-3d.mjs`
- `npm run check`
- `env -u FORCE_COLOR -u NO_COLOR PLAYWRIGHT_HTML_OPEN=never npm run test:e2e -- e2e/p1-viewer-3d-bridge.spec.ts --reporter=dot --workers=1`
- `git diff --check -- client/src/lib/board-viewer-3d.ts client/src/lib/__tests__/board-viewer-3d.test.ts client/src/components/views/BoardViewer3DView.tsx e2e/p1-viewer-3d-bridge.spec.ts COLLAB_FULL_APP_BACKLOG_HANDOFF_R50.md COLLAB_FULL_APP_BACKLOG_RESPONSE_R50_CODEX.md`

---
ROUND_STATUS: proposed
OPEN_CRITIQUES: none
SIGNOFF: Codex
OWNERSHIP: Codex
NEXT_ROUND: Preserve 3D pin identity so Digital Twin live pin/net overlays bind to real geometry.
---
