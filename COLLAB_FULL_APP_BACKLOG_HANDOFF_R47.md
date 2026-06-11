## Lane Reservation

- Active channels: COLLAB_FULL_APP_BACKLOG_HANDOFF_R47.md, COLLAB_FULL_APP_BACKLOG_RESPONSE_R47_CODEX.md
- Claimed files: client/src/components/views/BoardViewer3DView.tsx; client/src/components/views/__tests__/BoardViewer3DView.test.tsx; COLLAB_FULL_APP_BACKLOG_HANDOFF_R47.md; COLLAB_FULL_APP_BACKLOG_RESPONSE_R47_CODEX.md
- Forbidden files: CODEX_HANDOFF.md; CODEX_DONE.md; unrelated existing COLLAB_*; .env; knowledge/**; data/pp-nlm/**
- Background sessions: focused test/build checks only, none intended to remain active
- Round type: implement
- Target file edits permitted this round: listed-only
- Agent cap status: 2/6 active (source: visible process list: current Codex plus Playwright MCP)

# ProtoPulse Full App Views Backlog R47 - Digital Twin Net State Badges In 3D

## Context

R45 put Digital Twin channel rows into the 3D viewer and highlighted matching components. R46 added exact pin hot spots for mapped `refDes` + `pinLabel`/`pin` channels. The remaining part of the Digital Twin 3D overlay requirement is net state directly on the 3D scene, not only in the side/live overlay text.

Skills checked: `executing-plans`, `pp-view-digital-twin`, `pp-view-3d`, `pp-view-breadboard`, and `pp-view-uiux-design`.

Docs checked: Context7 React `/reactjs/react.dev` for `useMemo` dependency guidance. The relevant rule is complete dependency arrays for derived values.

## Scope

- Derive net-state overlays from Digital Twin live channel rows that include `netName`, `refDes`, and optional pin metadata.
- Anchor each net badge near the matched component pin when possible, otherwise near the matched component body.
- Render the badge directly inside the CSS 3D board scene with state, component, pin, value, and net identity.
- Cover the behavior in the existing Digital Twin 3D viewer focused test.

## Pre-Edit Dirty State

- `BoardViewer3DView.tsx` and `BoardViewer3DView.test.tsx` are already dirty from prior 3D bridge and Digital Twin work; diffs were inspected before this slice.
- `DigitalTwinView.tsx` and `client/src/lib/viewer-3d-bridge.ts` are dirty/untracked from prior work but are not claimed for R47.
- `client/src/components/circuit-editor/ComponentPlacer.tsx` and `client/src/lib/drag-mime.ts` remain unrelated dirty/untracked files and are not claimed or edited.

## Verification Required

- `npm run test -- client/src/components/views/__tests__/BoardViewer3DView.test.tsx`
- `node .agents/skills/pp-view-digital-twin/scripts/inspect-digital-twin.mjs`
- `node .agents/skills/pp-view-3d/scripts/inspect-3d.mjs`
- `node .agents/skills/pp-view-uiux-design/scripts/inspect-uiux-design.mjs`
- `npm run check`
- `npm run build`
- `env -u FORCE_COLOR -u NO_COLOR PLAYWRIGHT_HTML_OPEN=never npm run test:e2e -- e2e/p1-viewer-3d-bridge.spec.ts --reporter=dot --workers=1`
- `git diff --check -- client/src/components/views/BoardViewer3DView.tsx client/src/components/views/__tests__/BoardViewer3DView.test.tsx COLLAB_FULL_APP_BACKLOG_HANDOFF_R47.md COLLAB_FULL_APP_BACKLOG_RESPONSE_R47_CODEX.md`

---
ROUND_STATUS: proposed
OPEN_CRITIQUES: none
SIGNOFF: Codex
OWNERSHIP: Codex
NEXT_ROUND: Render and verify Digital Twin net-state badges in the 3D scene.
---
