## Lane Reservation

- Active channels: COLLAB_FULL_APP_BACKLOG_HANDOFF_R1.md, COLLAB_FULL_APP_BACKLOG_RESPONSE_R1_CODEX.md
- Claimed files: client/src/components/views/PartAlternatesBrowserView.tsx, client/src/components/views/PartAlternatesPanel.tsx, client/src/components/views/__tests__/PartAlternatesBrowserView.test.tsx, client/src/components/views/__tests__/part-alternates-panel.test.tsx, client/src/lib/parts/use-part-alternates.ts, client/src/lib/parts/alternate-trust.ts, client/src/lib/parts/__tests__/alternate-trust.test.ts, client/src/lib/parts/index.ts, server/storage/parts.ts, e2e/auth.setup.ts, e2e/p0-alternates-part-usage-render.spec.ts, .agents/skills/pp-view-alternates/references/self-improvement-log.md, COLLAB_FULL_APP_BACKLOG_HANDOFF_R1.md, COLLAB_FULL_APP_BACKLOG_RESPONSE_R1_CODEX.md
- Forbidden files: CODEX_HANDOFF.md, CODEX_DONE.md, existing unrelated COLLAB_*, .env, knowledge/**, data/pp-nlm/**
- Background sessions: current Codex turn; one unrelated Claude SDK process observed; Playwright MCP helper processes attached to Codex tooling
- Round type: implement
- Target file edits permitted this round: listed-only
- Agent cap status: 2/6 active implementation agents counted from visible process list; Playwright MCP helper processes are tool servers, not implementation workers

# Full App Views Backlog Campaign R1

## Source Material

- Backlog report: docs/FULL-APP-VIEWS-AND-PAGES-BACKLOG-REPORT.md
- First implementation slice: Part Alternates pilot
- Current docs checked: Context7 React `/reactjs/react.dev`, Vitest `/vitest-dev/vitest`, Playwright `/microsoft/playwright`

## Scope For This Round

Codex will land the narrow Part Alternates pilot from the larger backlog plan:

- Surface trust level and match score on alternates.
- Show reason and tradeoff text beside each candidate.
- Add a replacement preview step before the substitute mutation fires.
- Add focused tests for the standalone browser and replacement mutation path.
- Extract the shared Alternates trust/match copy into a reusable utility once the pilot proves the pattern.

The broader design-system and validation/money-gate waves stay out of this round.

## Dirty Tree Handling

The worktree is heavily dirty. Before editing, Codex checked targeted diffs for the claimed files and will avoid unrelated edits.

---
ROUND_STATUS: proposed
OPEN_CRITIQUES: none
SIGNOFF: Codex
OWNERSHIP: Codex
NEXT_ROUND: Implement the listed Part Alternates pilot and verify with focused tests plus type check where practical.
---
