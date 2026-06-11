## Lane Reservation

- Active channels: COLLAB_FULL_APP_BACKLOG_HANDOFF_R42.md, COLLAB_FULL_APP_BACKLOG_RESPONSE_R42_CODEX.md
- Claimed files: client/src/components/circuit-editor/breadboard-canvas/index.tsx; client/src/components/circuit-editor/breadboard-canvas/canvas-helpers.ts; client/src/components/circuit-editor/breadboard-canvas/__tests__/canvas-helpers.test.ts; COLLAB_FULL_APP_BACKLOG_HANDOFF_R42.md; COLLAB_FULL_APP_BACKLOG_RESPONSE_R42_CODEX.md
- Forbidden files: CODEX_HANDOFF.md; CODEX_DONE.md; unrelated existing COLLAB_*; .env; knowledge/**; data/pp-nlm/**
- Background sessions: focused test/build checks only, none intended to remain active
- Round type: implement
- Target file edits permitted this round: listed-only
- Agent cap status: 2/6 active (source: inherited campaign context plus current visible process list)

# ProtoPulse Full App Views Backlog R42 - Board Drop Placement Resolution Helper

## Context

R40 extracted Breadboard canvas project/starter mutation drafts. R41 moved bench instance classification onto the shared Breadboard placement contract helper. The next safe canvas cleanup is the repeated board-drop placement/collision/snap sequence that both project drops and starter drops run inline.

Context7 checked React current docs for pure calculation helpers and complete `useMemo` dependency arrays before this slice.

## Scope

- Add a pure `resolveBoardDropPlacement` helper that:
  - requires a terminal drop coordinate
  - builds the type-aware placement
  - checks the same placement collision predicate the canvas already used
  - returns the snapped board pixel on success
- Use it in project board drops and starter drops without changing drag, toast, collision, or mutation timing behavior.
- Add focused helper tests for success, non-terminal rejection, and collision rejection.

## Pre-Edit Dirty State

- `breadboard-canvas/index.tsx`, `canvas-helpers.ts`, and `canvas-helpers.test.ts` are already dirty from R40/R41.
- `client/src/lib/breadboard-instance-provenance.ts` remains an untracked R39 helper dependency and is not claimed for edits in this round.

## Verification Required

- `npm run test -- client/src/components/circuit-editor/breadboard-canvas/__tests__/canvas-helpers.test.ts client/src/components/circuit-editor/__tests__/breadboard-lab-contracts.test.ts client/src/components/circuit-editor/__tests__/BreadboardView.test.tsx`
- `node .agents/skills/pp-view-breadboard/scripts/inspect-breadboard-view.mjs`
- `node .agents/skills/pp-view-3d/scripts/inspect-3d.mjs`
- `npm run check`
- `npm run build`
- `git diff --check -- <claimed R42 files>`

---
ROUND_STATUS: proposed
OPEN_CRITIQUES: none
SIGNOFF: Codex
OWNERSHIP: Codex
NEXT_ROUND: Extract board placement/collision resolution and verify focused Breadboard behavior before advancing Digital Twin and cross-view 3D bridge debt.
---
