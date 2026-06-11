## Lane Reservation

- Active channels: COLLAB_FULL_APP_BACKLOG_HANDOFF_R4.md, COLLAB_FULL_APP_BACKLOG_RESPONSE_R4_CODEX.md
- Claimed files: client/src/components/views/PcbOrderingView.tsx, client/src/components/views/__tests__/PcbOrderingView.test.tsx, COLLAB_FULL_APP_BACKLOG_HANDOFF_R4.md, COLLAB_FULL_APP_BACKLOG_RESPONSE_R4_CODEX.md
- Forbidden files: CODEX_HANDOFF.md, CODEX_DONE.md, existing unrelated COLLAB_*, .env, knowledge/**, data/pp-nlm/**
- Background sessions: none
- Round type: implement
- Target file edits permitted this round: listed-only
- Agent cap status: 1/6 active implementation agent counted from current Codex turn; no background workers dispatched

# Full App Views Backlog Campaign R4

## Source Material

- Prior response: COLLAB_FULL_APP_BACKLOG_RESPONSE_R3_CODEX.md
- Order PCB skill: .agents/skills/pp-view-order-pcb/SKILL.md
- Context checked earlier in this campaign: Context7 React `/reactjs/react.dev`

## Scope For This Round

Codex lands the first money/action gate after Validation and Exports:

- Feed Validation/export trust output into Order PCB.
- Show a visible fabrication safety gate before final order mutation.
- Block `Place Order` when fab-package trust checks have hard failures.
- Keep the existing DFM, quote, and ordering engines intact.
- Add focused tests proving the blocked and allowed mutation paths.

## Verification Expectations

- Focused Order PCB view test must pass.
- Safety-gate regression tests must pass with the Order PCB test.
- Keep the previously observed build warning as accepted perf debt unless a new warning appears.
- Record the full-suite state honestly; R3 already had full a11y suite debt, and R4 must not claim full-suite green unless it is actually green.

---
ROUND_STATUS: proposed
OPEN_CRITIQUES: full suite still has known infrastructure debt from R3 and earlier localStorage/worker/server drift failures
SIGNOFF: Codex
OWNERSHIP: Codex
NEXT_ROUND: Implement Order PCB money gate and document verification evidence.
---
