## Lane Reservation

- Active channels: COLLAB_FULL_APP_BACKLOG_HANDOFF_R21.md, COLLAB_FULL_APP_BACKLOG_RESPONSE_R21_CODEX.md
- Claimed files: client/src/components/panels/CommentsPanel.tsx, client/src/components/panels/__tests__/CommentsPanel.test.tsx, e2e/p1-comments-spatial-anchor.spec.ts, .agents/skills/pp-view-comments/references/testing.md, .agents/skills/pp-view-comments/references/self-improvement-log.md, COLLAB_FULL_APP_BACKLOG_HANDOFF_R21.md, COLLAB_FULL_APP_BACKLOG_RESPONSE_R21_CODEX.md
- Forbidden files: CODEX_HANDOFF.md, CODEX_DONE.md, existing unrelated COLLAB_*, .env, knowledge/**, data/pp-nlm/**
- Background sessions: none
- Round type: implement
- Target file edits permitted this round: listed-only
- Agent cap status: 1/6 active implementation agent counted from current Codex turn; no background workers dispatched

# Full App Views Backlog Campaign R21

## Scope For This Round

Make PCB/Schematic/Breadboard spatial review anchors visible in the central Comments surface:

- Expose `spatial` as a first-class target filter.
- Render spatial view and coordinate context on spatial comments so PCB-pinned notes are not contextless in the review panel.
- Add focused CommentsPanel coverage for spatial filtering/rendering.
- Keep R20 a11y fixes intact.

## Evidence Before Edits

- `docs/FULL-APP-VIEWS-AND-PAGES-BACKLOG-REPORT.md` flags Comments P1 anchor visibility as incomplete: spatial comments from PCB have backend support but no central-panel filter or clear `spatialView`/coordinate rendering.
- `shared/schema.ts` supports `targetType: 'spatial'`, `spatialX`, `spatialY`, and `spatialView: 'architecture' | 'schematic' | 'pcb' | 'breadboard'`.
- `client/src/components/circuit-editor/PCBLayoutView.tsx` already creates PCB spatial comments with `targetType: 'spatial'` and `spatialView: 'pcb'`.
- Current dirty diffs for `CommentsPanel.tsx` and its new focused test were inspected and are active R20/R21 work.
- Context7 React docs checked: derived labels should be calculated during render/useMemo instead of stored in redundant state.

---
ROUND_STATUS: proposed
OPEN_CRITIQUES: PCB spatial comments are creatable but still weakly discoverable in the central Comments panel.
SIGNOFF: Codex
OWNERSHIP: Codex
NEXT_ROUND: Implement spatial filter/context rendering, focused tests, and browser/a11y proof.
---
