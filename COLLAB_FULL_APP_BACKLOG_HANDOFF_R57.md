## Lane Reservation

- Active channels: COLLAB_FULL_APP_BACKLOG_HANDOFF_R57.md, COLLAB_FULL_APP_BACKLOG_RESPONSE_R57_CODEX.md
- Claimed files: COLLAB_FULL_APP_BACKLOG_HANDOFF_R57.md, COLLAB_FULL_APP_BACKLOG_RESPONSE_R57_CODEX.md, client/src/components/ui/SurfaceStatusDock.tsx, client/src/components/ui/__tests__/SurfaceStatusDock.test.tsx, client/src/lib/pcb/pcb-surface-status.ts, client/src/lib/pcb/__tests__/pcb-surface-status.test.ts, client/src/components/views/SchematicView.tsx, client/src/components/views/__tests__/SchematicView.test.tsx, client/src/components/circuit-editor/PCBLayoutView.tsx, e2e/p1-surface-status-docks.spec.ts
- Forbidden files: CODEX_HANDOFF.md, CODEX_DONE.md, unrelated COLLAB_* files, .env, knowledge/**, data/pp-nlm/**
- Background sessions: none
- Round type: verify/implement
- Target file edits permitted this round: listed-only
- Agent cap status: 1/6 active (source: visible process list and this lane header)

## R57 Target

Close the next UI Container Rule and provenance-on-canvas slice for Schematic and PCB:

- Verify the shared `SurfaceStatusDock` primitive is reusable, scrollable, resizable, and collapsible.
- Verify Schematic shows direct work-surface provenance/trust, exact-part workflow state, ERC state, and TSCircuit mode without hiding the canvas.
- Verify PCB shows direct fabrication-surface provenance, placement/routing/board state, and a DRC/fabrication safety gate.
- Keep the scope to the already-dirty surface-status slice unless focused tests expose a defect.

## Docs And Skills Checked

- Context7 React: derived display values should be calculated during render; state changes should stay in event handlers when possible.
- Context7 Playwright: use locators and web-first assertions such as `toBeVisible` and `toBeInViewport` for UI proof.
- Skills inspected: `pp-view-schematic`, `pp-view-pcb`, `pp-view-component-editor`, `pp-view-uiux-design`.

## Initial Evidence

Unit/focused checks already green:

```text
npm run test -- client/src/components/ui/__tests__/SurfaceStatusDock.test.tsx client/src/lib/pcb/__tests__/pcb-surface-status.test.ts client/src/components/views/__tests__/SchematicView.test.tsx
3 files passed, 13 tests passed

npm run page-skills:check
Coverage check passed.
```

## Remaining Work

1. Run the targeted browser proof for `e2e/p1-surface-status-docks.spec.ts`.
2. Run static/build gates appropriate to the touched surface.
3. Patch any warning, failure, or viewport/container defect.
4. Write `COLLAB_FULL_APP_BACKLOG_RESPONSE_R57_CODEX.md` with exact verification output and next step.

---
ROUND_STATUS: discovery-complete
OPEN_CRITIQUES: browser proof and static/build gates still pending
SIGNOFF: Codex
OWNERSHIP: Codex - finish R57 verification and patch only defects
NEXT_ROUND: R57 response after browser/static proof
---
