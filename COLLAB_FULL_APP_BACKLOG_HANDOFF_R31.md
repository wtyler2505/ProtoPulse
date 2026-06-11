## Lane Reservation

- Active channels: COLLAB_FULL_APP_BACKLOG_HANDOFF_R31.md, COLLAB_FULL_APP_BACKLOG_RESPONSE_R31_CODEX.md
- Claimed files: client/src/lib/pcb/pcb-surface-status.ts; client/src/lib/pcb/__tests__/pcb-surface-status.test.ts; client/src/components/circuit-editor/PCBLayoutView.tsx; client/src/components/circuit-editor/__tests__/PCBLayoutView.status.test.tsx; client/src/pages/ProjectWorkspace.tsx; .agents/skills/pp-view-pcb/references/testing.md; .agents/skills/pp-view-pcb/references/self-improvement-log.md; COLLAB_FULL_APP_BACKLOG_HANDOFF_R31.md; COLLAB_FULL_APP_BACKLOG_RESPONSE_R31_CODEX.md
- Forbidden files: CODEX_HANDOFF.md; CODEX_DONE.md; unrelated existing COLLAB_*; .env; knowledge/**; data/pp-nlm/**
- Background sessions: none started for this round
- Round type: implement
- Target file edits permitted this round: listed-only
- Agent cap status: 2/6 active (source: visible process list: current Codex plus unrelated Claude SDK job; Playwright MCP process is tool infrastructure)

# ProtoPulse Full App Views Backlog R31 — PCB DRC Provenance Gate

## Context

R30 added a PCB canvas provenance/status dock. The next narrow safety step is to feed that same status into the DRC-facing workflow so the canvas does not merely display trust state while actions ignore it.

## Scope

- Extract PCB surface status into a reusable `client/src/lib/pcb/pcb-surface-status.ts` helper.
- Add a derived PCB safety gate for DRC/fabrication readiness.
- Show the gate in the PCB surface dock.
- Include the status and gate detail when the PCB context menu dispatches `protopulse:run-drc`.
- Have the workspace consume that event, warn on incomplete trust, and run validation.
- Keep DRC runnable; this round should warn/block fabrication readiness, not prevent users from running checks that help them fix the board.

## Verification Required

- `npm run test -- client/src/lib/pcb/__tests__/pcb-surface-status.test.ts client/src/components/circuit-editor/__tests__/PCBLayoutView.status.test.tsx`
- `node .agents/skills/pp-view-pcb/scripts/inspect-pcb.mjs`
- `npm run check`
- `npm run build`
- `npm run check:api-types`
- `npm run page-skills:check`
- `npm run page-skills:audit-packs`
- Browser/layout checks for PCB where feasible:
  - a11y filtered to PCB
  - keyboard-nav filtered to PCB
  - tab-route PCB coverage
  - desktop, laptop-height, and mobile-ish screenshots or equivalent bounding-box checks

## Notes

- Preserve existing dirty toolbar compaction and R30 dock behavior in `PCBLayoutView.tsx`.
- Do not touch the already dirty `PCBBoardRenderer.tsx`.
- Treat warnings as defects.
- Context7 was checked before implementation for React render-derived state and Playwright locator/screenshot assertions.

---
ROUND_STATUS: proposed
OPEN_CRITIQUES: none
SIGNOFF: Codex
OWNERSHIP: Codex
NEXT_ROUND: Implement R31 scoped PCB DRC provenance gate and verify it.
---
