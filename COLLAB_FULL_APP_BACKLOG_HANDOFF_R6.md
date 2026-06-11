## Lane Reservation

- Active channels: COLLAB_FULL_APP_BACKLOG_HANDOFF_R6.md, COLLAB_FULL_APP_BACKLOG_RESPONSE_R6_CODEX.md
- Claimed files: client/src/lib/export-precheck.ts, client/src/lib/__tests__/export-precheck.test.ts, client/src/components/views/BomTemplatesPanel.tsx, client/src/components/views/__tests__/BomTemplatesPanel.test.tsx, .agents/skills/pp-view-bom-templates/references/self-improvement-log.md, COLLAB_FULL_APP_BACKLOG_HANDOFF_R6.md, COLLAB_FULL_APP_BACKLOG_RESPONSE_R6_CODEX.md
- Forbidden files: CODEX_HANDOFF.md, CODEX_DONE.md, existing unrelated COLLAB_*, .env, knowledge/**, data/pp-nlm/**
- Background sessions: none
- Round type: implement
- Target file edits permitted this round: listed-only
- Agent cap status: 1/6 active implementation agent counted from current Codex turn; no background workers dispatched

# Full App Views Backlog Campaign R6

## Source Material

- Prior responses: COLLAB_FULL_APP_BACKLOG_RESPONSE_R1_CODEX.md through COLLAB_FULL_APP_BACKLOG_RESPONSE_R5_CODEX.md
- BOM Templates skill: .agents/skills/pp-view-bom-templates/SKILL.md
- Validation safety helper: client/src/lib/validation-safety-gates.ts
- Context checked this round: Context7 React `/reactjs/react.dev`

## Scope For This Round

Codex lands the next remaining money/action gate:

- Feed Validation trust output into BOM Templates.
- Add a `bom-template-apply` precheck profile that does not require an existing BOM or PCB layout.
- Surface hard blockers and warnings in the BOM Templates panel.
- Block template save/apply when hard upstream trust blockers exist.
- Add a preview/confirmation step before applying a template to project stock.
- Cover the blocked and warning/preview paths with focused tests.

## Verification Expectations

- Focused BOM Templates tests must pass.
- Focused export-precheck tests must pass.
- `npm run check` must pass.
- Record any broader suite debt honestly if encountered.

---
ROUND_STATUS: proposed
OPEN_CRITIQUES: full suite still has known broad infrastructure debt; this round targets a narrow BOM Templates money/action gate
SIGNOFF: Codex
OWNERSHIP: Codex
NEXT_ROUND: Implement BOM Templates trust gate and apply preview, then document verification evidence.
---
