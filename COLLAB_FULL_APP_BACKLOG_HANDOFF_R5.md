## Lane Reservation

- Active channels: COLLAB_FULL_APP_BACKLOG_HANDOFF_R5.md, COLLAB_FULL_APP_BACKLOG_RESPONSE_R5_CODEX.md
- Claimed files: client/src/lib/export-precheck.ts, client/src/lib/__tests__/export-precheck.test.ts, client/src/components/views/ProcurementView.tsx, client/src/components/views/procurement/BomToolbar.tsx, client/src/components/views/procurement/SupplierPricingPanel.tsx, client/src/components/views/__tests__/ProcurementView.test.tsx, client/src/components/views/__tests__/ProcurementView.a11y.test.tsx, client/src/components/views/__tests__/procurement-sub-components.test.tsx, client/src/__tests__/a11y.test.tsx, COLLAB_FULL_APP_BACKLOG_HANDOFF_R5.md, COLLAB_FULL_APP_BACKLOG_RESPONSE_R5_CODEX.md
- Forbidden files: CODEX_HANDOFF.md, CODEX_DONE.md, existing unrelated COLLAB_*, .env, knowledge/**, data/pp-nlm/**
- Background sessions: none
- Round type: implement
- Target file edits permitted this round: listed-only
- Agent cap status: 1/6 active implementation agent counted from current Codex turn; no background workers dispatched

# Full App Views Backlog Campaign R5

## Source Material

- Prior response: COLLAB_FULL_APP_BACKLOG_RESPONSE_R4_CODEX.md
- Procurement skill: .agents/skills/pp-view-procurement/SKILL.md
- Context checked earlier in this campaign: Context7 React `/reactjs/react.dev`

## Scope For This Round

Codex lands the next money/action gate after Order PCB:

- Feed Validation/export trust output into Procurement.
- Add a `procurement-package` precheck profile for BOM handoff and supplier quote readiness.
- Surface a visible Procurement Safety Gate in the BOM management view.
- Block CSV handoff and whole-BOM quoting when hard upstream trust blockers exist.
- Keep warnings visible but non-blocking.
- Preserve the compact, scrollable Procurement layout work already present in the dirty tree.

## Verification Expectations

- Focused Procurement tests must pass.
- Focused Procurement a11y must pass.
- `npm run check` must pass.
- `npm run build` must pass or only emit already-accepted large-chunk/perf debt.
- Full `npm run test` must be recorded honestly; do not claim global green while the broad suite still has localStorage/singleton, worker, a11y, and server drift failures.

---
ROUND_STATUS: proposed
OPEN_CRITIQUES: full suite still has known broad infrastructure debt; this round targets a narrow Procurement money gate
SIGNOFF: Codex
OWNERSHIP: Codex
NEXT_ROUND: Implement Procurement safety gate and document verification evidence.
---
