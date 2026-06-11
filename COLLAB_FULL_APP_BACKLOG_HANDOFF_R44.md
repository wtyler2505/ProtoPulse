## Lane Reservation

- Active channels: COLLAB_FULL_APP_BACKLOG_HANDOFF_R44.md, COLLAB_FULL_APP_BACKLOG_RESPONSE_R44_CODEX.md
- Claimed files: client/src/lib/viewer-3d-bridge.ts; client/src/lib/__tests__/viewer-3d-bridge.test.ts; client/src/components/views/DigitalTwinView.tsx; client/src/components/views/__tests__/DigitalTwinView.test.tsx; client/src/components/views/BoardViewer3DView.tsx; client/src/components/views/__tests__/BoardViewer3DView.test.tsx; COLLAB_FULL_APP_BACKLOG_HANDOFF_R44.md; COLLAB_FULL_APP_BACKLOG_RESPONSE_R44_CODEX.md
- Forbidden files: CODEX_HANDOFF.md; CODEX_DONE.md; unrelated existing COLLAB_*; .env; knowledge/**; data/pp-nlm/**
- Background sessions: focused test/build checks only, none intended to remain active
- Round type: implement
- Target file edits permitted this round: listed-only
- Agent cap status: 2/6 active (source: inherited campaign context plus current visible process list)

# ProtoPulse Full App Views Backlog R44 - Digital Twin Live Channel Payload

## Context

The current dirty tree already contains the first Digital Twin 3D preview and basic 3D bridge. The backlog still calls for live pin/channel/net state overlaid into the 3D scene, not only summary counts.

Skills checked: `executing-plans`, `pp-view-digital-twin`, `pp-view-3d`, and `pp-view-uiux-design`.

Docs checked: Context7 React `/reactjs/react.dev` for `useMemo` and `useCallback` dependency guidance.

## Scope

- Extend the 3D bridge payload with a bounded list of Digital Twin live-channel rows.
- Publish channel id/name/pin/value/live-vs-stale state from `DigitalTwinView`.
- Render those rows in the 3D viewer's Digital Twin overlay.
- Cover normalization, Digital Twin publishing, and 3D overlay rendering with focused tests.

## Pre-Edit Dirty State

- `DigitalTwinView.tsx`, `DigitalTwinView.test.tsx`, `BoardViewer3DView.tsx`, and `BoardViewer3DView.test.tsx` are already dirty from prior Digital Twin / 3D bridge work.
- `client/src/lib/viewer-3d-bridge.ts` and `client/src/lib/__tests__/viewer-3d-bridge.test.ts` are untracked from prior bridge work and are claimed for this round.
- No unrelated dirty files are claimed.

## Verification Required

- `npm run test -- client/src/lib/__tests__/viewer-3d-bridge.test.ts client/src/components/views/__tests__/DigitalTwinView.test.tsx client/src/components/views/__tests__/BoardViewer3DView.test.tsx`
- `node .agents/skills/pp-view-digital-twin/scripts/inspect-digital-twin.mjs`
- `node .agents/skills/pp-view-3d/scripts/inspect-3d.mjs`
- `node .agents/skills/pp-view-uiux-design/scripts/inspect-uiux-design.mjs`
- `npm run check`
- `npm run build`
- `git diff --check -- <claimed R44 files>`

---
ROUND_STATUS: proposed
OPEN_CRITIQUES: none
SIGNOFF: Codex
OWNERSHIP: Codex
NEXT_ROUND: Carry Digital Twin channel-level live state into the 3D overlay, then verify focused bridge behavior.
---
