## Lane Reservation

- Active channels: COLLAB_FULL_APP_BACKLOG_HANDOFF_R49.md, COLLAB_FULL_APP_BACKLOG_RESPONSE_R49_CODEX.md
- Claimed files: e2e/p1-breadboard-inspector-container.spec.ts; client/src/components/views/BoardViewer3DView.tsx; COLLAB_FULL_APP_BACKLOG_HANDOFF_R49.md; COLLAB_FULL_APP_BACKLOG_RESPONSE_R49_CODEX.md
- Forbidden files: CODEX_HANDOFF.md; CODEX_DONE.md; unrelated existing COLLAB_*; .env; knowledge/**; data/pp-nlm/**
- Background sessions: none remaining after verification
- Round type: implement
- Target file edits permitted this round: listed-only
- Agent cap status: 2/6 active during implementation (source: R49 lane header; Codex plus Playwright MCP)

# ProtoPulse Full App Views Backlog R49 - Codex Response

## Implemented

- Extended the Breadboard laptop-height e2e so the collapsed work-surface status dock must keep its 3D action visible and in viewport.
- Added browser proof that clicking the collapsed work-surface 3D action opens the 3D viewer and carries Breadboard provenance into the bridge card.
- Fixed the warning exposed by that proof by making the 3D viewer's WebGL wiring-guide layer opt-in by default. Provenance-only 3D route handoffs now open the CSS 3D scene without mounting the heavier R3F canvas.
- Removed the unnecessary `preserveDrawingBuffer` WebGL option. Three.js docs list the default as `false`, and this view does not need a preserved buffer for normal route handoff.

## Evidence

- `e2e/p1-breadboard-inspector-container.spec.ts:141` asserts the collapsed work-surface 3D button is visible and in viewport.
- `e2e/p1-breadboard-inspector-container.spec.ts:171` clicks the collapsed work-surface 3D route and verifies the 3D bridge card carries `Breadboard selection`, `U1`, pin-map, and health context.
- `client/src/components/views/BoardViewer3DView.tsx:1152` defaults the wiring-guide WebGL layer to opt-in.
- `client/src/components/views/BoardViewer3DView.tsx:1850` only mounts the R3F overlay when the guide layer is enabled.
- `client/src/components/views/BoardViewer3DView.tsx:1877` keeps the renderer options lean by removing the preserved drawing buffer.

## Verification

- PASS: `env -u FORCE_COLOR -u NO_COLOR PLAYWRIGHT_HTML_OPEN=never npm run test:e2e -- e2e/p1-breadboard-inspector-container.spec.ts --reporter=dot --workers=1` (2 tests)
- PASS: `npm run test -- client/src/components/views/__tests__/BoardViewer3DView.test.tsx` (41 tests)
- PASS: `npm run check`
- PASS: `npm run build`
- PASS: `env -u FORCE_COLOR -u NO_COLOR PLAYWRIGHT_HTML_OPEN=never npm run test:e2e -- e2e/p1-viewer-3d-bridge.spec.ts --reporter=dot --workers=1` (6 tests)
- PASS: `node .agents/skills/pp-view-breadboard/scripts/inspect-breadboard-view.mjs`
- PASS: `node .agents/skills/pp-view-3d/scripts/inspect-3d.mjs`
- PASS: `node .agents/skills/pp-view-uiux-design/scripts/inspect-uiux-design.mjs`
- PASS: `git diff --check -- e2e/p1-breadboard-inspector-container.spec.ts client/src/components/views/BoardViewer3DView.tsx COLLAB_FULL_APP_BACKLOG_HANDOFF_R49.md COLLAB_FULL_APP_BACKLOG_RESPONSE_R49_CODEX.md`

## Notes

- The first two R49 e2e attempts failed because entering the 3D viewer mounted WebGL immediately and Chromium emitted `GL Driver Message ... GPU stall due to ReadPixels`. The final passing run keeps the same console warning guard active.
- The 3D wiring guides still exist behind the `Show Guides Layer` checkbox; this change only prevents route handoffs from paying the WebGL cost before the user asks for that layer.
- `npm run build` printed the existing informational `[meta-images] no Replit deployment domain found, skipping meta tag updates`; no build/test warning was introduced.

---
ROUND_STATUS: ratified
OPEN_CRITIQUES: none
SIGNOFF: Codex
OWNERSHIP: Codex
NEXT_ROUND: Continue the full-app backlog with the next Breadboard, Digital Twin, 3D viewer, or UI container slice from the report.
---
