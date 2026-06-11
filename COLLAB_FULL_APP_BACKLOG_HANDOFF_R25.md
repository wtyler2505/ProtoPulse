## Lane Reservation

- Active channels: COLLAB_FULL_APP_BACKLOG_HANDOFF_R25.md, COLLAB_FULL_APP_BACKLOG_RESPONSE_R25_CODEX.md
- Claimed files: client/src/components/circuit-editor/breadboard-canvas/BreadboardWorkSurfaceStatus.tsx, client/src/components/circuit-editor/breadboard-canvas/index.tsx, client/src/components/circuit-editor/__tests__/BreadboardView.test.tsx, e2e/p1-breadboard-inspector-container.spec.ts, .agents/skills/breadboard-lab/references/testing-and-browser-verification.md, .agents/skills/pp-view-breadboard/references/testing.md, .agents/skills/pp-view-breadboard/references/self-improvement-log.md, COLLAB_FULL_APP_BACKLOG_HANDOFF_R25.md, COLLAB_FULL_APP_BACKLOG_RESPONSE_R25_CODEX.md
- Forbidden files: CODEX_HANDOFF.md, CODEX_DONE.md, existing unrelated COLLAB_*, .env, knowledge/**, data/pp-nlm/**
- Background sessions: none
- Round type: implement
- Target file edits permitted this round: listed-only
- Agent cap status: 1/6 active implementation agent counted from current Codex turn; no background implementation workers dispatched

# Full App Views Backlog Campaign R25

## Scope For This Round

Move the next Breadboard Lab backlog item after R24:

- Surface board-health and selected-part coach status directly on the Breadboard work surface, not only in the sidebar or selected-part inspector.
- Keep the new affordance small, collapsible, scroll-safe, and natively resizable so it follows the UI Container Rule.
- Add focused component/browser coverage for laptop-height reachability.
- Do not start broad canvas extraction in this round.

## Evidence Before Edits

- `docs/FULL-APP-VIEWS-AND-PAGES-BACKLOG-REPORT.md` calls Breadboard board health, coach actionability, provenance/trust visibility, and container discipline out as the next high-value items after `View in 3D`.
- Current code already has board audit logic, coach plan logic, an inline toolbar audit button, and a sidebar board-health panel.
- Current gap: the actual canvas/work surface does not make health + coach state glanceable when the sidebar is collapsed or the inspector is not the user's focus.
- Dirty diffs for claimed files were inspected before edits. Existing R24 work is preserved.
- Context7 React docs checked for event handlers and derived render data; Context7 Playwright docs checked for test IDs, web-first assertions, and screenshots.
- Breadboard, 3D, and UI/UX page-skill inspectors passed before edits.

---
ROUND_STATUS: proposed
OPEN_CRITIQUES: R25 intentionally limits itself to work-surface health/coach visibility; canvas extraction, bidirectional 3D selection, and deeper board-health rule work remain later rounds.
SIGNOFF: Codex
OWNERSHIP: Codex
NEXT_ROUND: Add the Breadboard work-surface status dock and focused verification.
---
