## Lane Reservation

- Active channels: COLLAB_FULL_APP_BACKLOG_HANDOFF_R54.md, COLLAB_FULL_APP_BACKLOG_RESPONSE_R54_CODEX.md
- Claimed files: client/src/components/views/SchematicView.tsx; client/src/components/views/__tests__/SchematicView.test.tsx; client/src/components/circuit-editor/PCBLayoutView.tsx; client/src/components/circuit-editor/__tests__/PCBLayoutView.status.test.tsx; client/src/lib/pcb/pcb-surface-status.ts; client/src/lib/pcb/__tests__/pcb-surface-status.test.ts; client/src/components/ui/SurfaceStatusDock.tsx; client/src/components/ui/__tests__/SurfaceStatusDock.test.tsx; e2e/p1-surface-status-docks.spec.ts
- Forbidden files: CODEX_HANDOFF.md; CODEX_DONE.md; unrelated existing COLLAB_*; .env; knowledge/**; data/pp-nlm/**
- Background sessions: none
- Round type: implement
- Target file edits permitted this round: listed-only
- Agent cap status: 1/6 active (source: visible local process list from R53 plus current single Codex lane)

## R54 Target

Land the already-started PCB/Schematic canvas provenance/status dock slice as the next UI/UX backlog step.

This round is intentionally narrow:

- Keep canvas provenance visible directly on Schematic and PCB work surfaces.
- Make the status docks scrollable, collapsible, and resizable for laptop-height viewports.
- Feed PCB provenance and fabrication-gate context into the existing DRC trigger path without blocking DRC itself.
- Cover the status logic and visible UI with focused tests.

## Required Checks

- Inspect dirty diffs before editing all claimed paths.
- Run focused tests for the claimed files before/after edits.
- Run page-skill inspectors for Schematic, PCB, and UIUX.
- Run at least `npm run check` before closeout.

---
ROUND_STATUS: proposed
OPEN_CRITIQUES: none
SIGNOFF: Codex
OWNERSHIP: Codex
NEXT_ROUND: tighten and verify R54 status-dock implementation, then write response
---
