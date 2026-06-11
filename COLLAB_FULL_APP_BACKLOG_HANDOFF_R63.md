## Lane Reservation

- Active channels: COLLAB_FULL_APP_BACKLOG_HANDOFF_R63.md, COLLAB_FULL_APP_BACKLOG_RESPONSE_R63_CODEX.md
- Claimed files: client/src/components/views/StorageManagerPanel.tsx, client/src/components/views/__tests__/storage-manager.test.tsx, client/src/lib/export-precheck.ts, client/src/lib/__tests__/export-precheck.test.ts, .agents/skills/pp-view-inventory/references/self-improvement-log.md, COLLAB_FULL_APP_BACKLOG_HANDOFF_R63.md, COLLAB_FULL_APP_BACKLOG_RESPONSE_R63_CODEX.md
- Forbidden files: CODEX_HANDOFF.md, CODEX_DONE.md, unrelated existing COLLAB_*, .env, knowledge/**, data/pp-nlm/**
- Background sessions: none
- Round type: implement
- Target file edits permitted this round: listed-only
- Agent cap status: 1/6 active (source: current Codex session; existing playwright-mcp process is long-lived outside this lane)

# R63 Inventory Money Gate

## Objective

Harden Inventory as the local-truth stock layer after BOM Templates and Procurement: keep the existing confidence gate, then make saved-part provenance and physical readiness visible on each inventory row before label/recovery workflows rely on it.

## Scope

- Preserve the existing dirty Inventory Confidence Gate work after inspecting it.
- Add per-row trust/provenance markers for exact/verified, generated/AI, estimated or unknown inventory confidence, and 3D/mechanical readiness when metadata is present.
- Keep label printing blocked only on hard blockers; warning-only review states stay actionable.
- Add focused tests for the per-row provenance markers.
- Update the Inventory page skill log with the R63 lesson.

## Verification

- `npm run test -- client/src/components/views/__tests__/storage-manager.test.tsx client/src/lib/__tests__/export-precheck.test.ts`
- `npm run check`
- `node .agents/skills/pp-view-inventory/scripts/inspect-inventory.mjs`
- `npm run check:api-types`
- `npm run page-skills:check`
- `npm run page-skills:audit-packs`
- `npm run build`
- Targeted browser/a11y/keyboard Inventory route check or direct browser check if shared specs do not cover the standalone route.

---
ROUND_STATUS: ratified
OPEN_CRITIQUES: none
SIGNOFF: Codex
OWNERSHIP: Codex
NEXT_ROUND: R64 Lifecycle money-gate hardening.
---
