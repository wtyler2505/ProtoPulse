## Lane Reservation

- Active channels: COLLAB_FULL_APP_BACKLOG_HANDOFF_R38.md, COLLAB_FULL_APP_BACKLOG_RESPONSE_R38_CODEX.md
- Claimed files: client/src/components/views/ValidationView.tsx; client/src/components/views/validation/VirtualizedIssueList.tsx; client/src/components/views/validation/validation-helpers.ts; client/src/components/views/__tests__/ValidationView.test.tsx; client/index.html; client/src/pages/ProjectWorkspace.tsx; .agents/skills/pp-view-validation/references/testing.md; .agents/skills/pp-view-validation/references/self-improvement-log.md; COLLAB_FULL_APP_BACKLOG_HANDOFF_R38.md; COLLAB_FULL_APP_BACKLOG_RESPONSE_R38_CODEX.md
- Forbidden files: CODEX_HANDOFF.md; CODEX_DONE.md; unrelated existing COLLAB_*; .env; knowledge/**; data/pp-nlm/**
- Background sessions: focused test/browser checks only, none intended to remain active
- Round type: implement
- Target file edits permitted this round: listed-only
- Agent cap status: 2/6 active (source: inherited campaign context plus current Codex lane)

# ProtoPulse Full App Views Backlog R38 - Validation Safety Gates As Issues

## Context

The dirty tree already contains a promising Validation safety-gate summary. It builds gate data from circuit instances, exact-part metadata, breadboard health, lifecycle risk, and inventory confidence, then shows a compact Safety Gates section. However, the main virtualized issue list can still render the normal empty state when provenance gates are the only blockers. That weakens the safety story: release blockers should not live only in a summary card.

## Scope

- Feed warn/fail safety gates into `VirtualizedIssueList` as first-class rows.
- Include safety gate rows in header issue counts and severity filters.
- Keep the existing Safety Gates summary as the release overview.
- Use trust/provenance UI on each row so the same pattern appears in summaries and issues.
- Extend Validation tests to prove safety gates appear as issue rows and prevent the all-clear empty state.
- Clear the Validation a11y scan warnings discovered during browser verification with narrow shared-shell fixes.
- Update Validation skill references.

## Verification Required

- `npm run test -- client/src/components/views/__tests__/ValidationView.test.tsx client/src/lib/__tests__/validation-safety-gates.test.ts client/src/lib/__tests__/export-precheck.test.ts`
- `node .agents/skills/pp-view-validation/scripts/inspect-validation.mjs`
- `npm run check`
- `npm run page-skills:check`
- `npm run page-skills:audit-packs`
- `npm run build`
- `env -u NO_COLOR PLAYWRIGHT_HTML_OPEN=never npm run test:e2e -- e2e/tab-route-matrix.spec.ts:90 --reporter=dot --workers=1`
- `env -u NO_COLOR PLAYWRIGHT_HTML_OPEN=never npm run test:e2e -- e2e/p1-a11y-scan.spec.ts:134 --reporter=dot --workers=1`
- `env -u NO_COLOR PLAYWRIGHT_HTML_OPEN=never npm run test:e2e -- e2e/p1-keyboard-nav.spec.ts:157 --reporter=dot --workers=1`
- `git diff --check -- <claimed R38 files>`

---
ROUND_STATUS: proposed
OPEN_CRITIQUES: none
SIGNOFF: Codex
OWNERSHIP: Codex
NEXT_ROUND: Render Validation safety gate blockers as real issue-list rows and verify the gate behavior.
---
