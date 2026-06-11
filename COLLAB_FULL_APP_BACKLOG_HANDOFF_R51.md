## Lane Reservation

- Active channels: COLLAB_FULL_APP_BACKLOG_HANDOFF_R51.md, COLLAB_FULL_APP_BACKLOG_RESPONSE_R51_CODEX.md
- Claimed files: client/src/components/views/DigitalTwinView.tsx; client/src/components/views/__tests__/DigitalTwinView.test.tsx; client/src/components/views/BoardViewer3DView.tsx; client/src/components/views/__tests__/BoardViewer3DView.test.tsx; e2e/p1-viewer-3d-bridge.spec.ts; COLLAB_FULL_APP_BACKLOG_HANDOFF_R51.md; COLLAB_FULL_APP_BACKLOG_RESPONSE_R51_CODEX.md
- Forbidden files: CODEX_HANDOFF.md; CODEX_DONE.md; unrelated existing COLLAB_*; .env; knowledge/**; data/pp-nlm/**
- Background sessions: focused test/build checks only, none intended to remain active
- Round type: implement
- Target file edits permitted this round: listed-only
- Agent cap status: 2/6 active (source: visible current Codex session plus prior Playwright/browser tooling lane)

# ProtoPulse Full App Views Backlog R51 - Digital Twin Go-Fix Browser Gate

## Context

R50 proved that Digital Twin live pin/channel/net state can bind to real 3D geometry. The next gap in the user objective is the "go fix this" loop: Digital Twin and 3D View need reliable return paths to Breadboard, Component Editor, and 3D View. Unit tests cover much of this, but the browser route currently only checks that 3D repair buttons are visible.

Skills checked: `executing-plans`, `pp-view-digital-twin`, `pp-view-3d`, `pp-view-breadboard`, and `pp-view-uiux-design`.

Docs checked this round: Context7 React `/reactjs/react.dev` for stable hook dependencies; Context7 Playwright `/microsoft/playwright` for web-first locator assertions.

## Scope

- Add browser coverage that proves Digital Twin fix actions navigate to Breadboard, Component Editor, and 3D View.
- Add browser coverage that proves 3D View's Digital Twin repair buttons navigate back to Digital Twin, Breadboard, and Component Editor.
- If the browser proof exposes a real runtime/navigation defect, fix it in the narrow claimed files.
- Keep R50 Digital Twin live pin/net binding proof intact.

## Pre-Edit Dirty State

- `client/src/components/views/DigitalTwinView.tsx` is dirty from prior Digital Twin preview/bridge work.
- `client/src/components/views/__tests__/DigitalTwinView.test.tsx` is dirty from prior Digital Twin preview/bridge tests.
- `client/src/components/views/BoardViewer3DView.tsx` is dirty from prior 3D bridge and R50 render-loop work.
- `client/src/components/views/__tests__/BoardViewer3DView.test.tsx` is dirty from prior 3D bridge tests.
- `e2e/p1-viewer-3d-bridge.spec.ts` is untracked from prior bridge work and claimed for this browser gate.
- Broad unrelated dirty tree state remains untouched.

## Verification Required

- `npm run test -- client/src/components/views/__tests__/DigitalTwinView.test.tsx client/src/components/views/__tests__/BoardViewer3DView.test.tsx`
- `node .agents/skills/pp-view-digital-twin/scripts/inspect-digital-twin.mjs`
- `node .agents/skills/pp-view-3d/scripts/inspect-3d.mjs`
- `node .agents/skills/pp-view-breadboard/scripts/inspect-breadboard-view.mjs`
- `node .agents/skills/pp-view-uiux-design/scripts/inspect-uiux-design.mjs`
- `env -u FORCE_COLOR -u NO_COLOR PLAYWRIGHT_HTML_OPEN=never npm run test:e2e -- e2e/p1-viewer-3d-bridge.spec.ts --reporter=dot --workers=1`
- `npm run check`
- `npm run build`
- `git diff --check -- client/src/components/views/DigitalTwinView.tsx client/src/components/views/__tests__/DigitalTwinView.test.tsx client/src/components/views/BoardViewer3DView.tsx client/src/components/views/__tests__/BoardViewer3DView.test.tsx e2e/p1-viewer-3d-bridge.spec.ts COLLAB_FULL_APP_BACKLOG_HANDOFF_R51.md COLLAB_FULL_APP_BACKLOG_RESPONSE_R51_CODEX.md`

---
ROUND_STATUS: proposed
OPEN_CRITIQUES: none
SIGNOFF: Codex
OWNERSHIP: Codex
NEXT_ROUND: Enforce the Digital Twin go-fix loop with browser coverage and fix any exposed navigation defect.
---
