## Lane Reservation

- Active channels: COLLAB_FULL_APP_BACKLOG_HANDOFF_R52.md, COLLAB_FULL_APP_BACKLOG_RESPONSE_R52_CODEX.md
- Claimed files: client/src/lib/viewer-3d-bridge.ts; client/src/components/views/DigitalTwinView.tsx; client/src/components/views/__tests__/DigitalTwinView.test.tsx; client/src/components/views/BoardViewer3DView.tsx; client/src/components/views/__tests__/BoardViewer3DView.test.tsx; client/src/components/circuit-editor/BreadboardView.tsx; client/src/components/circuit-editor/__tests__/BreadboardView.test.tsx; client/src/components/views/ComponentEditorView.tsx; e2e/p1-viewer-3d-bridge.spec.ts; COLLAB_FULL_APP_BACKLOG_HANDOFF_R52.md; COLLAB_FULL_APP_BACKLOG_RESPONSE_R52_CODEX.md
- Forbidden files: CODEX_HANDOFF.md; CODEX_DONE.md; unrelated existing COLLAB_*; .env; knowledge/**; data/pp-nlm/**
- Background sessions: focused test/build checks only, none intended to remain active
- Round type: implement
- Target file edits permitted this round: listed-only
- Agent cap status: 2/6 active (source: visible current Codex session plus prior Playwright/browser tooling lane)

# ProtoPulse Full App Views Backlog R52 - Digital Twin Repair Context Payloads

## Context

R51 proved that Digital Twin and 3D View repair buttons navigate to Breadboard and Component Editor. The next safety gap is payload fidelity: navigation should carry the channel/pin/net/refdes context that explains what needs repair.

Docs checked in this implementation campaign: Context7 React `/reactjs/react.dev` for stable hook dependencies and Context7 Playwright `/microsoft/playwright` for web-first locator assertions.

## Scope

- Add a narrow repair-context bridge alongside the existing 3D bridge payloads.
- Publish repair context when Digital Twin sends the user to Breadboard or Component Editor.
- Publish the same repair context when 3D View's Digital Twin bridge sends the user to Breadboard or Component Editor.
- Surface the pending Digital Twin repair context in Breadboard and Component Editor with stable test IDs.
- Extend focused unit/browser coverage without broad refactors.

## Pre-Edit Dirty State

- `client/src/lib/viewer-3d-bridge.ts` is already untracked from the prior 3D bridge work.
- `client/src/components/views/DigitalTwinView.tsx`, `client/src/components/views/BoardViewer3DView.tsx`, `client/src/components/circuit-editor/BreadboardView.tsx`, `client/src/components/views/ComponentEditorView.tsx`, and their related tests are already dirty from earlier backlog slices.
- `e2e/p1-viewer-3d-bridge.spec.ts` is already untracked from the 3D/Digital Twin bridge proof.
- Broad unrelated dirty tree state remains untouched.

## Verification Required

- `npm run test -- client/src/components/views/__tests__/DigitalTwinView.test.tsx client/src/components/views/__tests__/BoardViewer3DView.test.tsx client/src/components/circuit-editor/__tests__/BreadboardView.test.tsx`
- `node .agents/skills/pp-view-digital-twin/scripts/inspect-digital-twin.mjs`
- `node .agents/skills/pp-view-3d/scripts/inspect-3d.mjs`
- `node .agents/skills/pp-view-breadboard/scripts/inspect-breadboard-view.mjs`
- `node .agents/skills/pp-view-uiux-design/scripts/inspect-uiux-design.mjs`
- `env -u FORCE_COLOR -u NO_COLOR PLAYWRIGHT_HTML_OPEN=never npm run test:e2e -- e2e/p1-viewer-3d-bridge.spec.ts --reporter=dot --workers=1`
- `npm run check`
- `npm run build`
- `git diff --check -- client/src/lib/viewer-3d-bridge.ts client/src/components/views/DigitalTwinView.tsx client/src/components/views/__tests__/DigitalTwinView.test.tsx client/src/components/views/BoardViewer3DView.tsx client/src/components/views/__tests__/BoardViewer3DView.test.tsx client/src/components/circuit-editor/BreadboardView.tsx client/src/components/circuit-editor/__tests__/BreadboardView.test.tsx client/src/components/views/ComponentEditorView.tsx e2e/p1-viewer-3d-bridge.spec.ts COLLAB_FULL_APP_BACKLOG_HANDOFF_R52.md COLLAB_FULL_APP_BACKLOG_RESPONSE_R52_CODEX.md`

---
ROUND_STATUS: proposed
OPEN_CRITIQUES: none
SIGNOFF: Codex
OWNERSHIP: Codex
NEXT_ROUND: Implement Digital Twin repair-context payloads into Breadboard and Component Editor.
---
