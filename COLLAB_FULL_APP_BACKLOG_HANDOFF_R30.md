## Lane Reservation

- Active channels: COLLAB_FULL_APP_BACKLOG_HANDOFF_R30.md, COLLAB_FULL_APP_BACKLOG_RESPONSE_R30_CODEX.md
- Claimed files: client/src/components/circuit-editor/PCBLayoutView.tsx; client/src/components/circuit-editor/__tests__/PCBLayoutView.status.test.tsx; .agents/skills/pp-view-pcb/references/testing.md; .agents/skills/pp-view-pcb/references/self-improvement-log.md; COLLAB_FULL_APP_BACKLOG_HANDOFF_R30.md; COLLAB_FULL_APP_BACKLOG_RESPONSE_R30_CODEX.md
- Forbidden files: CODEX_HANDOFF.md; CODEX_DONE.md; unrelated existing COLLAB_*; .env; knowledge/**; data/pp-nlm/**
- Background sessions: none started for this round
- Round type: implement
- Target file edits permitted this round: listed-only
- Agent cap status: 2/6 active (source: visible process list: current Codex plus unrelated Claude SDK job; MCP servers not counted)

# ProtoPulse Full App Views Backlog R30 — PCB Surface Provenance Dock

## Context

R29 landed a Schematic canvas provenance/status dock and verified it across focused tests, build, page-skill checks, a11y, keyboard, tab-route, and screenshots. The next high-value canvas surface is PCB because it is the fabrication geometry source.

## Scope

Add a compact, collapsible, scrollable/resizable PCB work-surface status dock directly over the PCB canvas. The dock should summarize footprint/placement/routing state and expose provenance risk using the shared `TrustBadge` primitive.

Keep this round narrow:

- Surface unverified or generated/provisional footprint signals from `CircuitInstanceRow.properties`.
- Show placed/unplaced component counts.
- Show routed/total net status.
- Show board dimensions.
- Do not change routing/DRC mutation behavior yet.
- Do not touch the already dirty `PCBBoardRenderer.tsx` unless absolutely required.

## Verification Required

- `npm run test -- client/src/components/circuit-editor/__tests__/PCBLayoutView.status.test.tsx`
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

- Preserve existing dirty toolbar compaction in `PCBLayoutView.tsx`.
- Treat warnings as defects.
- Context7 was checked before implementation for React render-derived state and Playwright locator/screenshot assertions.

---
ROUND_STATUS: proposed
OPEN_CRITIQUES: none
SIGNOFF: Codex
OWNERSHIP: Codex
NEXT_ROUND: Implement R30 scoped PCB canvas provenance/status dock and verify it.
---
