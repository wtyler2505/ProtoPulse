## Lane Reservation

- Active channels: COLLAB_FULL_APP_BACKLOG_HANDOFF_R49.md, COLLAB_FULL_APP_BACKLOG_RESPONSE_R49_CODEX.md
- Claimed files: e2e/p1-breadboard-inspector-container.spec.ts; client/src/components/views/BoardViewer3DView.tsx; COLLAB_FULL_APP_BACKLOG_HANDOFF_R49.md; COLLAB_FULL_APP_BACKLOG_RESPONSE_R49_CODEX.md
- Forbidden files: CODEX_HANDOFF.md; CODEX_DONE.md; unrelated existing COLLAB_*; .env; knowledge/**; data/pp-nlm/**
- Background sessions: focused Playwright/check/build verification only, none intended to remain active
- Round type: implement
- Target file edits permitted this round: listed-only
- Agent cap status: 2/6 active (source: visible process list: current Codex plus Playwright MCP)

# ProtoPulse Full App Views Backlog R49 - Breadboard Laptop 3D Container Proof

## Context

R48 made the selected-part `View in 3D` action reachable from the Breadboard work-surface status dock, including the collapsed header. The existing laptop-height e2e already proves inspector reachability, status-dock collapse/expand, provenance visibility, and overlap safety. This round tightens that browser proof so the new canvas-level 3D action is covered in the same constrained viewport.

Skills checked: `executing-plans`, `pp-view-breadboard`, `breadboard-lab`, `pp-view-3d`, and `pp-view-uiux-design`.

Docs checked: Context7 Playwright `/microsoft/playwright` for locator clicks and web-first assertions (`toBeVisible`, `toHaveURL` examples, auto-wait behavior).

## Scope

- Extend `e2e/p1-breadboard-inspector-container.spec.ts` to assert the work-surface 3D action is visible and in viewport while the work-surface status dock is collapsed.
- Click the collapsed work-surface 3D action and verify the 3D viewer receives Breadboard provenance context.
- Remove the 3D viewer's unnecessary preserved WebGL drawing buffer if the browser proof exposes the Chromium `ReadPixels` warning.

## Pre-Edit Dirty State

- `e2e/p1-breadboard-inspector-container.spec.ts` is already untracked from prior Breadboard UI container work. Its full current contents were inspected before this round.
- `client/src/components/views/BoardViewer3DView.tsx` is already dirty from prior 3D/Digital Twin bridge work. Its current diff and the R3F canvas area were inspected before the WebGL warning fix.
- R48 files remain dirty/untracked and are not claimed here.
- Broad unrelated dirty tree state remains untouched.

## Verification Required

- `env -u FORCE_COLOR -u NO_COLOR PLAYWRIGHT_HTML_OPEN=never npm run test:e2e -- e2e/p1-breadboard-inspector-container.spec.ts --reporter=dot --workers=1`
- `npm run test -- client/src/components/views/__tests__/BoardViewer3DView.test.tsx`
- `npm run check`
- `npm run build`
- `env -u FORCE_COLOR -u NO_COLOR PLAYWRIGHT_HTML_OPEN=never npm run test:e2e -- e2e/p1-viewer-3d-bridge.spec.ts --reporter=dot --workers=1`
- `git diff --check -- e2e/p1-breadboard-inspector-container.spec.ts client/src/components/views/BoardViewer3DView.tsx COLLAB_FULL_APP_BACKLOG_HANDOFF_R49.md COLLAB_FULL_APP_BACKLOG_RESPONSE_R49_CODEX.md`

---
ROUND_STATUS: proposed
OPEN_CRITIQUES: none
SIGNOFF: Codex
OWNERSHIP: Codex
NEXT_ROUND: Extend the Breadboard laptop-height proof to include the collapsed work-surface 3D route and remove the WebGL warning it exposes.
---
