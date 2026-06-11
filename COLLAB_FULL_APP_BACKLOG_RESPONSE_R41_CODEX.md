## Lane Reservation

- Active channels: COLLAB_FULL_APP_BACKLOG_HANDOFF_R41.md, COLLAB_FULL_APP_BACKLOG_RESPONSE_R41_CODEX.md
- Claimed files: client/src/components/circuit-editor/breadboard-canvas/index.tsx; client/src/components/circuit-editor/breadboard-canvas/canvas-helpers.ts; client/src/components/circuit-editor/breadboard-canvas/__tests__/canvas-helpers.test.ts; COLLAB_FULL_APP_BACKLOG_HANDOFF_R41.md; COLLAB_FULL_APP_BACKLOG_RESPONSE_R41_CODEX.md
- Forbidden files: CODEX_HANDOFF.md; CODEX_DONE.md; unrelated existing COLLAB_*; .env; knowledge/**; data/pp-nlm/**
- Background sessions: none
- Round type: implement
- Target file edits permitted this round: listed-only
- Agent cap status: 2/6 active (source: inherited campaign context plus current goal/cap state)

# ProtoPulse Full App Views Backlog R41 - Codex Response

## Docs And Skill Checks

- Used `breadboard-lab`, `pp-view-breadboard`, and `pp-view-3d`.
- Context7 checked current Vitest docs for explicit `describe`, `it`, and `expect` imports before adding helper tests.
- Breadboard and 3D View skill inspectors passed before/after the slice.

## Implemented

- Added `getCanvasBenchInstances`, a pure canvas helper that delegates bench-vs-board classification to the shared Breadboard placement contract helper. See `client/src/components/circuit-editor/breadboard-canvas/canvas-helpers.ts:84`.
- Replaced the inline `benchInstances` filter in `BreadboardCanvas` with the helper, keeping bench connector rendering wired through the same memoized flow. See `client/src/components/circuit-editor/breadboard-canvas/index.tsx:217`.
- Added tests proving the canvas bench list includes bench-only instances and excludes board, staged, and conflicting instances. See `client/src/components/circuit-editor/breadboard-canvas/__tests__/canvas-helpers.test.ts:72`.

## Verification

- `npm run test -- client/src/components/circuit-editor/breadboard-canvas/__tests__/canvas-helpers.test.ts` - passed, 23 tests.
- `npm run test -- client/src/components/circuit-editor/breadboard-canvas/__tests__/canvas-helpers.test.ts client/src/components/circuit-editor/__tests__/breadboard-lab-contracts.test.ts client/src/components/circuit-editor/__tests__/BreadboardView.test.tsx` - passed, 3 files and 75 tests.
- `node .agents/skills/pp-view-breadboard/scripts/inspect-breadboard-view.mjs` - passed, 71 tracked test cases and no missing required files.
- `node .agents/skills/pp-view-3d/scripts/inspect-3d.mjs` - passed, 52 tracked test cases and no missing required files.
- `git diff --check -- <claimed R41 files>` - passed before response write.
- `npm run check` - passed; token drift passed and TypeScript completed cleanly.
- `npm run build` - passed; Vite built the client in 2m 17s and server build exited 0. It emitted the existing informational `[meta-images] no Replit deployment domain found` line.

## Notes

- This was another non-visual helper extraction, so I did not rerun browser screenshots.
- This moves the canvas one step closer to the requested guarded cleanup state: bench rendering now uses the same placement vocabulary as the Breadboard Lab contract guard instead of an ad hoc coordinate predicate.

---
ROUND_STATUS: ratified
OPEN_CRITIQUES: none
SIGNOFF: Codex
OWNERSHIP: Codex
NEXT_ROUND: Continue guarded Breadboard canvas extraction around board placement/collision helpers, then advance the Digital Twin and cross-view 3D bridge debt once Breadboard remains protected.
---
