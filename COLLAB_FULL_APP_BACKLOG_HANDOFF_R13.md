## Lane Reservation

- Active channels: COLLAB_FULL_APP_BACKLOG_HANDOFF_R13.md, COLLAB_FULL_APP_BACKLOG_RESPONSE_R13_CODEX.md
- Claimed files: DESIGN.md, client/src/index.css, package.json, scripts/design/check-token-drift.mjs, scripts/__tests__/design-token-drift.test.ts, .agents/skills/pp-view-uiux-design/SKILL.md, .agents/skills/pp-view-uiux-design/references/testing.md, .agents/skills/pp-view-uiux-design/references/gotchas.md, .agents/skills/pp-view-uiux-design/references/self-improvement-log.md, .agents/skills/pp-view-uiux-design/scripts/inspect-uiux-design.mjs, COLLAB_FULL_APP_BACKLOG_HANDOFF_R13.md, COLLAB_FULL_APP_BACKLOG_RESPONSE_R13_CODEX.md
- Forbidden files: CODEX_HANDOFF.md, CODEX_DONE.md, existing unrelated COLLAB_*, .env, knowledge/**, data/pp-nlm/**
- Background sessions: none
- Round type: implement
- Target file edits permitted this round: listed-only
- Agent cap status: 1/6 active implementation agent counted from current Codex turn; no background workers dispatched

# Full App Views Backlog Campaign R13

## Scope For This Round

Codex starts the UI/UX + DESIGN capstone implementation with the first enforceable design-system guardrail:

- Add a token drift checker that treats `DESIGN.md` as the source of truth for global color tokens.
- Wire that checker into the repo's normal `npm run check` path.
- Add focused Vitest coverage for the token checker.
- Sync existing CSS token drift so the new guardrail starts green.
- Update the UI/UX page skill pack so future agents know the token gate exists.

## Evidence Before Edits

- `docs/FULL-APP-VIEWS-AND-PAGES-BACKLOG-REPORT.md` section 39 calls out missing automated token drift detection as a P0 design-system enforcement gap.
- `DESIGN.md` currently declares `primary-foreground: "#000000"` and `foreground: "#ffffff"`.
- `client/src/index.css` still uses `--color-primary-foreground: #060709` and `--color-foreground: #E0E6EB`, so drift exists now.
- `node .agents/skills/pp-view-uiux-design/scripts/inspect-uiux-design.mjs` passed before edits.
- Context7 checked `/vitest-dev/vitest` for current Vitest test shape before adding script-focused coverage.

---
ROUND_STATUS: proposed
OPEN_CRITIQUES: Design tokens are still advisory; current DESIGN.md and index.css color variables can drift without a failing check.
SIGNOFF: Codex
OWNERSHIP: Codex
NEXT_ROUND: Implement token drift checker, focused tests, package check integration, and skill-pack documentation.
---
