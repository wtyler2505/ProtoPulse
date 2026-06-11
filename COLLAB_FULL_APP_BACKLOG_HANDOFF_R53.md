## Lane Reservation

- Active channels: COLLAB_FULL_APP_BACKLOG_HANDOFF_R53.md / COLLAB_FULL_APP_BACKLOG_RESPONSE_R53_CODEX.md
- Claimed files: client/src/lib/viewer-3d-bridge.ts; client/src/lib/__tests__/viewer-3d-bridge.test.ts; client/src/components/circuit-editor/BreadboardView.tsx; client/src/components/circuit-editor/breadboard-canvas/index.tsx; client/src/components/circuit-editor/__tests__/BreadboardView.test.tsx; client/src/components/views/ComponentEditorView.tsx; client/src/components/views/component-editor/ExactPartDraftModal.tsx; client/src/components/views/component-editor/__tests__/ExactPartDraftModal.test.tsx; client/src/components/views/__tests__/BoardViewer3DView.test.tsx; client/src/components/views/__tests__/DigitalTwinView.test.tsx; e2e/p1-viewer-3d-bridge.spec.ts; COLLAB_FULL_APP_BACKLOG_HANDOFF_R53.md; COLLAB_FULL_APP_BACKLOG_RESPONSE_R53_CODEX.md
- Forbidden files: CODEX_HANDOFF.md; CODEX_DONE.md; unrelated existing COLLAB_*; .env; knowledge/**; data/pp-nlm/**
- Background sessions: none
- Round type: implement
- Target file edits permitted this round: listed-only
- Agent cap status: 1/6 active (source: this lane header; no background sessions started)

## R53 Scope

Upgrade the R52 Digital Twin repair handoff from route-level context to target-level action:

- Breadboard receives the Digital Twin repair target inside the canvas and renders a pin/net callout on the selected/affected part.
- Component Editor opens the exact-part draft modal with a seeded request derived from the Digital Twin repair target.
- Browser proof verifies the live telemetry path reaches Breadboard geometry and Component Editor exact-draft seed fields.

## Docs Checked

- Context7: `/reactjs/react.dev` for effect dependency guidance, avoiding unstable object dependencies, and event listener state updates.
- Context7: `/microsoft/playwright` for `getByTestId` locators and web-first visibility/text/attribute assertions.

## Guardrails

- Preserve the dirty worktree; do not revert unrelated files.
- Keep this round narrow. No broad layout rewrite, no new router work, no payment/fabrication gate work.
- Treat warnings as defects during this slice.

---
ROUND_STATUS: proposed
OPEN_CRITIQUES: none
SIGNOFF: Codex
OWNERSHIP: Codex
NEXT_ROUND: Land R53 narrow implementation and verification.
---
