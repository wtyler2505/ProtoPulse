## Lane Reservation

- Active channels: COLLAB_FULL_APP_BACKLOG_HANDOFF_R61.md, COLLAB_FULL_APP_BACKLOG_RESPONSE_R61_CODEX.md
- Claimed files: client/src/components/views/ProcurementView.tsx, client/src/components/views/procurement/BomToolbar.tsx, client/src/components/views/procurement/SupplierPricingPanel.tsx, client/src/components/views/procurement/BomTable.tsx, client/src/components/views/procurement/CostOptimizerPanel.tsx, client/src/components/views/procurement/SupplierDrawer.tsx, client/src/components/views/__tests__/ProcurementView.test.tsx, client/src/components/views/__tests__/procurement-sub-components.test.tsx, client/src/lib/__tests__/supplier-api.test.ts, .agents/skills/pp-view-procurement/references/self-improvement-log.md, COLLAB_FULL_APP_BACKLOG_HANDOFF_R61.md, COLLAB_FULL_APP_BACKLOG_RESPONSE_R61_CODEX.md
- Forbidden files: CODEX_HANDOFF.md, CODEX_DONE.md, unrelated existing COLLAB_*, .env, knowledge/**, data/pp-nlm/**
- Background sessions: none
- Round type: implement
- Target file edits permitted this round: listed-only
- Agent cap status: 1/6 active (source: current Codex session; no R61 background sessions)

# R61 Procurement Money Gate

## Objective

Carry the Validation and Export trust output into Procurement so blind quoting/exporting is stopped when upstream trust is incomplete, and make mock or estimated supplier data visible in the Procurement UI.

## Scope

- Add Procurement-level fabrication/procurement precheck data from the current project state.
- Block quote/export actions when hard trust blockers exist.
- Surface blocker/warning counts near Procurement controls.
- Mark simulated/estimated pricing data as untrusted or estimated.
- Add focused tests for action blocking, trust badges, and supplier mock-data propagation.
- Keep the UI container work narrow and avoid broad Procurement redesign.

## Verification

- `npm run test -- client/src/components/views/__tests__/ProcurementView.test.tsx client/src/components/views/__tests__/procurement-sub-components.test.tsx client/src/lib/__tests__/supplier-api.test.ts`
- `npm run check`
- `node .agents/skills/pp-view-procurement/scripts/inspect-procurement.mjs`
- `npm run page-skills:check`
- `npm run page-skills:audit-packs`
- `npm run build`
- Targeted Procurement route/a11y/keyboard checks with `PLAYWRIGHT_HTML_OPEN=never`.

---
ROUND_STATUS: ratified
OPEN_CRITIQUES: none
SIGNOFF: Codex
OWNERSHIP: Codex
NEXT_ROUND: Continue money-gate rollout into BOM Templates, Inventory, Lifecycle, and Supply Chain, then return to canvas/container surfaces.
---
