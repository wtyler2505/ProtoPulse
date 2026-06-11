## Lane Reservation

- Active channels: COLLAB_FULL_APP_BACKLOG_HANDOFF_R40.md, COLLAB_FULL_APP_BACKLOG_RESPONSE_R40_CODEX.md
- Claimed files: client/src/components/circuit-editor/breadboard-canvas/index.tsx; client/src/components/circuit-editor/breadboard-canvas/canvas-helpers.ts; client/src/components/circuit-editor/breadboard-canvas/__tests__/canvas-helpers.test.ts; COLLAB_FULL_APP_BACKLOG_HANDOFF_R40.md; COLLAB_FULL_APP_BACKLOG_RESPONSE_R40_CODEX.md
- Forbidden files: CODEX_HANDOFF.md; CODEX_DONE.md; unrelated existing COLLAB_*; .env; knowledge/**; data/pp-nlm/**
- Background sessions: focused test/build checks only, none intended to remain active
- Round type: implement
- Target file edits permitted this round: listed-only
- Agent cap status: 2/6 active (source: inherited campaign context plus current process list)

# ProtoPulse Full App Views Backlog R40 - Breadboard Canvas Drop Payload Extraction

## Context

R39 added real Breadboard Lab contract guards and explicit `breadboardProvenance` values for exact, coach, project, and starter instance creation paths. The next Breadboard work should start canvas cleanup without touching fragile pointer behavior, wiring, pan/zoom, or drop target math.

Context7 checked React current docs for pure render/update expectations and immutable object/array state updates before this implementation slice. No external API behavior changes are planned.

## Scope

- Extract only the project/starter drop mutation payload construction from `breadboard-canvas/index.tsx` into pure helpers in `canvas-helpers.ts`.
- Keep drag-over, drop target, collision, snap, toast, and mutation timing behavior unchanged.
- Add focused helper tests that prove project bench drops, project board drops, and starter board drops keep their coordinate slots and provenance stamps.

## Pre-Edit Dirty State

- `client/src/components/circuit-editor/breadboard-canvas/index.tsx` is already dirty from earlier R39/R38 work.
- `canvas-helpers.ts` and `canvas-helpers.test.ts` have no current diff.
- `breadboard-lab-contracts.test.ts` and `breadboard-instance-provenance.ts` are untracked R39 files and are out of scope for direct edits in this round.

## Verification Required

- `npm run test -- client/src/components/circuit-editor/breadboard-canvas/__tests__/canvas-helpers.test.ts client/src/components/circuit-editor/__tests__/breadboard-lab-contracts.test.ts client/src/components/circuit-editor/__tests__/BreadboardView.test.tsx`
- `node .agents/skills/pp-view-breadboard/scripts/inspect-breadboard-view.mjs`
- `npm run check`
- `npm run build`
- `git diff --check -- <claimed R40 files>`

---
ROUND_STATUS: proposed
OPEN_CRITIQUES: none
SIGNOFF: Codex
OWNERSHIP: Codex
NEXT_ROUND: Extract the lowest-risk canvas drop payload helpers and verify focused Breadboard behavior before continuing larger Breadboard/Digital Twin/UI debt.
---
