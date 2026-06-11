## Lane Reservation

- Active channels: COLLAB_FULL_APP_BACKLOG_HANDOFF_R10.md, COLLAB_FULL_APP_BACKLOG_RESPONSE_R10_CODEX.md
- Claimed files: client/src/components/views/StorageManagerPanel.tsx, client/src/components/views/__tests__/storage-manager.test.tsx, client/src/lib/export-precheck.ts, client/src/lib/__tests__/export-precheck.test.ts, .agents/skills/pp-view-inventory/SKILL.md, .agents/skills/pp-view-inventory/references/page-map.md, .agents/skills/pp-view-inventory/references/testing.md, .agents/skills/pp-view-inventory/references/gotchas.md, .agents/skills/pp-view-inventory/references/self-improvement-log.md, docs/audit-screenshots/2026-05-24-r10-inventory/**, COLLAB_FULL_APP_BACKLOG_HANDOFF_R10.md, COLLAB_FULL_APP_BACKLOG_RESPONSE_R10_CODEX.md
- Forbidden files: CODEX_HANDOFF.md, CODEX_DONE.md, existing unrelated COLLAB_*, .env, knowledge/**, data/pp-nlm/**
- Background sessions: none
- Round type: implement
- Target file edits permitted this round: listed-only
- Agent cap status: 1/6 active implementation agent counted from current Codex turn; no background workers dispatched

# Full App Views Backlog Campaign R10

## Scope For This Round

Codex lands a narrow Inventory money/action-gate slice:

- Surface an Inventory Confidence Gate directly inside the Storage Manager.
- Reuse the shared export precheck engine with an Inventory-specific profile.
- Warn when inventory quantities are estimated, unknown, or short against BOM demand.
- Block label printing when hard Inventory gate blockers exist, while keeping warning-only review flows available.
- Add focused Storage Manager and precheck tests.
- Update the Inventory page skill pack with the new gate behavior.

## Evidence Before Edits

- R9 closed the Lifecycle release gate and left Inventory as the next money/action-gate target.
- Existing dirty Inventory source diff is layout/density and dialog accessibility work; this round preserves it.
- Existing dirty Inventory test diff adds dialog/collapsible mocks needed by the current component.
- Shared `export-precheck.ts` already contains inventory-confidence and shortfall checks for export/procurement profiles, but no dedicated `inventory-review` profile.
- Context checked this round: Context7 React `/reactjs/react.dev` for pure derived render data and `useMemo` dependency behavior.

---
ROUND_STATUS: proposed
OPEN_CRITIQUES: Inventory has no visible confidence gate before label/stock handling actions
SIGNOFF: Codex
OWNERSHIP: Codex
NEXT_ROUND: Add Inventory confidence gate, focused tests, skill-pack updates, and verification evidence.
---
