## Lane Reservation

- Active channels: COLLAB_FULL_APP_BACKLOG_HANDOFF_R45.md, COLLAB_FULL_APP_BACKLOG_RESPONSE_R45_CODEX.md
- Claimed files: client/src/lib/viewer-3d-bridge.ts; client/src/lib/__tests__/viewer-3d-bridge.test.ts; client/src/lib/digital-twin/telemetry-protocol.ts; client/src/lib/digital-twin/__tests__/telemetry-protocol.test.ts; client/src/components/views/DigitalTwinView.tsx; client/src/components/views/__tests__/DigitalTwinView.test.tsx; client/src/components/views/BoardViewer3DView.tsx; client/src/components/views/__tests__/BoardViewer3DView.test.tsx; COLLAB_FULL_APP_BACKLOG_HANDOFF_R45.md; COLLAB_FULL_APP_BACKLOG_RESPONSE_R45_CODEX.md
- Forbidden files: CODEX_HANDOFF.md; CODEX_DONE.md; unrelated existing COLLAB_*; .env; knowledge/**; data/pp-nlm/**
- Background sessions: focused test/build checks only, none intended to remain active
- Round type: implement
- Target file edits permitted this round: listed-only
- Agent cap status: 2/6 active (source: inherited campaign context plus current visible process list)

# ProtoPulse Full App Views Backlog R45 - Digital Twin Channel Scene Highlights

## Context

R44 carried Digital Twin live channel rows through the 3D bridge and rendered them in the 3D overlay. The next backlog-aligned step is to let those channel rows identify concrete 3D scene targets when telemetry metadata supplies or implies a component reference designator.

Skills checked: `executing-plans`, `pp-view-digital-twin`, `pp-view-3d`, and `pp-view-uiux-design`.

Docs checked: Context7 React `/reactjs/react.dev` for `useMemo` and `useCallback` dependency guidance.

## Scope

- Extend Digital Twin telemetry channel metadata and 3D bridge payload rows with optional scene mapping fields:
  - `refDes`
  - `pinLabel`
  - `netName`
- Derive scene mapping from explicit manifest metadata, with conservative fallback inference from channel id/name strings.
- Use mapped channel `refDes` values to highlight matching 3D components.
- Surface the mapped component/pin/net context in the 3D live-state overlay.
- Cover protocol parsing, bridge normalization, Digital Twin publishing, and 3D component highlighting with focused tests.

## Pre-Edit Dirty State

- `DigitalTwinView.tsx`, `DigitalTwinView.test.tsx`, `BoardViewer3DView.tsx`, and `BoardViewer3DView.test.tsx` are already dirty from prior Digital Twin / 3D bridge work.
- `client/src/lib/viewer-3d-bridge.ts`, `client/src/lib/__tests__/viewer-3d-bridge.test.ts`, and `e2e/p1-viewer-3d-bridge.spec.ts` are untracked from prior bridge work. Only the first two are claimed in this round.
- `client/src/components/circuit-editor/ComponentPlacer.tsx` and `client/src/lib/drag-mime.ts` remain unrelated dirty/untracked files and are not claimed or edited.

## Verification Required

- `npm run test -- client/src/lib/digital-twin/__tests__/telemetry-protocol.test.ts client/src/lib/__tests__/viewer-3d-bridge.test.ts client/src/components/views/__tests__/DigitalTwinView.test.tsx client/src/components/views/__tests__/BoardViewer3DView.test.tsx`
- `node .agents/skills/pp-view-digital-twin/scripts/inspect-digital-twin.mjs`
- `node .agents/skills/pp-view-3d/scripts/inspect-3d.mjs`
- `node .agents/skills/pp-view-uiux-design/scripts/inspect-uiux-design.mjs`
- `npm run check`
- `npm run build`
- `env -u FORCE_COLOR -u NO_COLOR PLAYWRIGHT_HTML_OPEN=never npm run test:e2e -- e2e/p1-viewer-3d-bridge.spec.ts --reporter=dot --workers=1`
- `git diff --check -- <claimed R45 files>`

---
ROUND_STATUS: proposed
OPEN_CRITIQUES: none
SIGNOFF: Codex
OWNERSHIP: Codex
NEXT_ROUND: Map Digital Twin channel rows to concrete 3D component highlights and verify the bridge remains clean.
---
