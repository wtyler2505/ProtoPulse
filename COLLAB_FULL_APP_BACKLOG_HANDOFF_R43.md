## Lane Reservation

- Active channels: COLLAB_FULL_APP_BACKLOG_HANDOFF_R43.md, COLLAB_FULL_APP_BACKLOG_RESPONSE_R43_CODEX.md
- Claimed files: client/src/components/circuit-editor/breadboard-canvas/index.tsx; client/src/components/circuit-editor/breadboard-canvas/canvas-helpers.ts; client/src/components/circuit-editor/breadboard-canvas/__tests__/canvas-helpers.test.ts; COLLAB_FULL_APP_BACKLOG_HANDOFF_R43.md; COLLAB_FULL_APP_BACKLOG_RESPONSE_R43_CODEX.md
- Forbidden files: CODEX_HANDOFF.md; CODEX_DONE.md; unrelated existing COLLAB_*; .env; knowledge/**; data/pp-nlm/**
- Background sessions: focused test/build checks only, none intended to remain active
- Round type: implement
- Target file edits permitted this round: listed-only
- Agent cap status: 2/6 active (source: inherited campaign context plus current visible process list)

# ProtoPulse Full App Views Backlog R43 - Breadboard Drop Payload Parsing Helpers

## Context

R40-R42 moved Breadboard canvas drop payload creation, bench instance classification, and board placement resolution into pure helpers. The next small canvas cleanup is the DataTransfer payload parsing that still lives inline in `breadboard-canvas/index.tsx`.

Context7 checked React `useCallback` dependency guidance, and MDN checked `DataTransfer.getData()` / `types` behavior before this slice. MDN notes drag data is safe to read during `drop`, while `dragover` should rely on available type metadata.

## Scope

- Add pure helper functions for:
  - detecting whether a drag payload is supported by Breadboard
  - reading a validated project-part payload from `DataTransfer.getData`
  - reading starter node type/label payloads from `DataTransfer.getData`
- Replace inline parsing in `BreadboardCanvas` with those helpers.
- Add focused tests for valid, missing, invalid JSON, and invalid part-id payloads.

## Pre-Edit Dirty State

- `breadboard-canvas/index.tsx`, `canvas-helpers.ts`, and `canvas-helpers.test.ts` are already dirty from R40-R42.
- `ComponentPlacer.tsx` is already dirty from unrelated UI density work and is not claimed or edited in this round.
- `client/src/lib/drag-mime.ts` is untracked and not claimed in this round.

## Verification Required

- `npm run test -- client/src/components/circuit-editor/breadboard-canvas/__tests__/canvas-helpers.test.ts client/src/components/circuit-editor/__tests__/breadboard-lab-contracts.test.ts client/src/components/circuit-editor/__tests__/BreadboardView.test.tsx`
- `node .agents/skills/pp-view-breadboard/scripts/inspect-breadboard-view.mjs`
- `node .agents/skills/pp-view-3d/scripts/inspect-3d.mjs`
- `npm run check`
- `npm run build`
- `git diff --check -- <claimed R43 files>`

---
ROUND_STATUS: proposed
OPEN_CRITIQUES: none
SIGNOFF: Codex
OWNERSHIP: Codex
NEXT_ROUND: Extract drop payload parsing and verify focused Breadboard behavior before shifting toward Digital Twin and cross-view 3D bridge debt.
---
