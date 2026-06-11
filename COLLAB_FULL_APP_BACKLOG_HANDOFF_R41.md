## Lane Reservation

- Active channels: COLLAB_FULL_APP_BACKLOG_HANDOFF_R41.md, COLLAB_FULL_APP_BACKLOG_RESPONSE_R41_CODEX.md
- Claimed files: client/src/components/circuit-editor/breadboard-canvas/index.tsx; client/src/components/circuit-editor/breadboard-canvas/canvas-helpers.ts; client/src/components/circuit-editor/breadboard-canvas/__tests__/canvas-helpers.test.ts; COLLAB_FULL_APP_BACKLOG_HANDOFF_R41.md; COLLAB_FULL_APP_BACKLOG_RESPONSE_R41_CODEX.md
- Forbidden files: CODEX_HANDOFF.md; CODEX_DONE.md; unrelated existing COLLAB_*; .env; knowledge/**; data/pp-nlm/**
- Background sessions: focused test/build checks only, none intended to remain active
- Round type: implement
- Target file edits permitted this round: listed-only
- Agent cap status: 2/6 active (source: inherited campaign context plus current goal/cap state)

# ProtoPulse Full App Views Backlog R41 - Breadboard Bench Instance Helper

## Context

R39 added explicit Breadboard instance provenance and placement contract guards. R40 started guarded canvas cleanup by extracting project/starter drop mutation payloads. The next low-risk canvas cleanup should keep moving instance classification out of `breadboard-canvas/index.tsx` while preserving the pointer-heavy canvas behavior.

Context7 checked Vitest current docs for explicit `describe`, `it`, and `expect` imports. The page skills for Breadboard and 3D View were inspected cleanly before this slice.

## Scope

- Add a pure canvas helper that returns only bench-renderable Breadboard instances using the shared `getBreadboardInstancePlacement` classifier.
- Replace the inline `benchInstances` filter in `breadboard-canvas/index.tsx` with that helper.
- Add focused helper tests covering bench, board, staged, and conflicting instance states so the canvas does not accidentally render board/conflicting instances as bench stash parts.

## Pre-Edit Dirty State

- `breadboard-canvas/index.tsx`, `canvas-helpers.ts`, and `canvas-helpers.test.ts` are already dirty from R40.
- `client/src/lib/breadboard-instance-provenance.ts` is an untracked R39 file and is used as the shared classifier source but not claimed for edits in this round.

## Verification Required

- `npm run test -- client/src/components/circuit-editor/breadboard-canvas/__tests__/canvas-helpers.test.ts client/src/components/circuit-editor/__tests__/breadboard-lab-contracts.test.ts client/src/components/circuit-editor/__tests__/BreadboardView.test.tsx`
- `node .agents/skills/pp-view-breadboard/scripts/inspect-breadboard-view.mjs`
- `node .agents/skills/pp-view-3d/scripts/inspect-3d.mjs`
- `npm run check`
- `npm run build`
- `git diff --check -- <claimed R41 files>`

---
ROUND_STATUS: proposed
OPEN_CRITIQUES: none
SIGNOFF: Codex
OWNERSHIP: Codex
NEXT_ROUND: Extract the bench instance classification helper and verify focused Breadboard behavior before continuing broader Breadboard/Digital Twin/UI debt.
---
