## Lane Reservation

- Active channels: COLLAB_FULL_APP_BACKLOG_HANDOFF_R11.md, COLLAB_FULL_APP_BACKLOG_RESPONSE_R11_CODEX.md
- Claimed files: client/src/components/views/BomTemplatesPanel.tsx, client/src/components/views/__tests__/BomTemplatesPanel.test.tsx, client/src/components/ui/toast.tsx, client/src/pages/ProjectWorkspace.tsx, client/src/components/panels/chat/MessageInput.tsx, .agents/skills/pp-view-bom-templates/SKILL.md, .agents/skills/pp-view-bom-templates/references/page-map.md, .agents/skills/pp-view-bom-templates/references/testing.md, .agents/skills/pp-view-bom-templates/references/gotchas.md, .agents/skills/pp-view-bom-templates/references/self-improvement-log.md, docs/audit-screenshots/2026-05-24-r11-bom-templates/**, COLLAB_FULL_APP_BACKLOG_HANDOFF_R11.md, COLLAB_FULL_APP_BACKLOG_RESPONSE_R11_CODEX.md
- Forbidden files: CODEX_HANDOFF.md, CODEX_DONE.md, existing unrelated COLLAB_*, .env, knowledge/**, data/pp-nlm/**
- Background sessions: none
- Round type: implement
- Target file edits permitted this round: listed-only
- Agent cap status: 1/6 active implementation agent counted from current Codex turn; no background workers dispatched

# Full App Views Backlog Campaign R11

## Scope For This Round

Codex lands the next narrow preview/diff slice:

- Replace BOM Templates' confirmation-only apply preview with an item-level dry-run diff.
- Use the existing template detail endpoint before mutation.
- Show which template rows will create new project stock lines and which will be skipped as already present.
- Keep the R6 trust gate intact: hard blockers still block, warning-only states still require review.
- Add focused tests and update the BOM Templates page skill pack.
- Fix any critical/serious a11y issues found by the BOM Templates route proof when the issue is a shared primitive defect surfaced by this route.

## Evidence Before Edits

- The backlog report flags BOM Templates as a blind apply flow with no dry-run or diff.
- R6 added the safety gate and confirmation step, but the R6 response explicitly left item-level created/skipped diff as future work.
- `useBomTemplateDetail(templateId)` and `GET /api/bom-templates/:id` already exist and return template items.
- Context checked this round: Context7 React `/reactjs/react.dev` for pure derived render data, `useMemo`, and event-handler state updates.

---
ROUND_STATUS: proposed
OPEN_CRITIQUES: BOM Templates apply preview confirms intent but still lacks item-level created/skipped diff before mutation
SIGNOFF: Codex
OWNERSHIP: Codex
NEXT_ROUND: Implement item-level BOM template apply dry-run preview, tests, screenshots, and verification evidence.
---
