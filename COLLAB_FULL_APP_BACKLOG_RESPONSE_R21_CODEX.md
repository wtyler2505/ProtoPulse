## Lane Reservation

- Active channels: COLLAB_FULL_APP_BACKLOG_HANDOFF_R21.md, COLLAB_FULL_APP_BACKLOG_RESPONSE_R21_CODEX.md
- Claimed files: client/src/components/panels/CommentsPanel.tsx, client/src/components/panels/__tests__/CommentsPanel.test.tsx, e2e/p1-comments-spatial-anchor.spec.ts, .agents/skills/pp-view-comments/references/testing.md, .agents/skills/pp-view-comments/references/self-improvement-log.md, COLLAB_FULL_APP_BACKLOG_HANDOFF_R21.md, COLLAB_FULL_APP_BACKLOG_RESPONSE_R21_CODEX.md
- Forbidden files: CODEX_HANDOFF.md, CODEX_DONE.md, existing unrelated COLLAB_*, .env, knowledge/**, data/pp-nlm/**
- Background sessions: none
- Round type: implement
- Target file edits permitted this round: listed-only
- Agent cap status: 1/6 active implementation agent counted from current Codex turn; no background workers dispatched

# Full App Views Backlog Campaign R21 Codex Response

## Implemented

- Made `spatial` comments first-class in `CommentsPanel` target filtering.
- Rendered spatial review anchors with view and coordinate context, for example `PCB canvas (42.3, 128.5)`, so PCB-pinned comments keep their location when read from the central review panel.
- Kept anchor labels derived during render rather than storing duplicate UI state, matching the React docs check noted in the handoff.
- Added focused unit coverage for spatial anchor rendering and the `Anchors` target filter.
- Added a focused Playwright proof that seeds a real PCB spatial comment through the API, opens Comments, verifies the anchor badge/filter, captures `e2e-results/r21-comments-spatial-anchor.png`, and asserts no page console warnings/errors.
- Updated the Comments page-skill testing and self-improvement references for this slice.

## Verification

- PASS: `npm_config_update_notifier=false npm run test -- client/src/components/panels/__tests__/CommentsPanel.test.tsx`
  - 1 file, 2 tests passed.
- PASS: `node .agents/skills/pp-view-comments/scripts/inspect-comments.mjs`
- PASS: `env -u NO_COLOR -u FORCE_COLOR PLAYWRIGHT_HTML_OPEN=never npm_config_update_notifier=false npm run test:e2e -- e2e/p1-comments-spatial-anchor.spec.ts --reporter=dot --workers=1`
  - 2 tests passed in 1.2m.
- PASS: `npm_config_update_notifier=false npm run check`
  - Token drift check passed; TypeScript passed.
- PASS: `npm_config_update_notifier=false npm run page-skills:check`
- PASS: `npm_config_update_notifier=false npm run page-skills:audit-packs`
- PASS: `git diff --check -- <R21 claimed paths>`
- PASS: `npm_config_update_notifier=false npm run build`
  - Client and server build completed.
- PASS: `env -u NO_COLOR -u FORCE_COLOR PLAYWRIGHT_HTML_OPEN=never npm_config_update_notifier=false npm run test:a11y -- --reporter=dot`
  - 33 tests passed in 8.5m.
  - The suite still reports existing low-severity axe counts on many routes, including Comments, but all were `0 critical/serious`.
  - A first a11y attempt inherited `NO_COLOR`/`FORCE_COLOR` and emitted Node color-env warnings; it was stopped and rerun cleanly with both vars unset.

## Notes

- This does not create new spatial comments from Schematic/Breadboard. It makes existing `spatialView`/coordinate data visible and filterable in the central Comments panel.
- The low-severity axe baseline remains broader app debt, not new R21 behavior.

---
ROUND_STATUS: ratified
OPEN_CRITIQUES: none
SIGNOFF: Codex
OWNERSHIP: Codex
NEXT_ROUND: Continue the full-app backlog campaign with the next UI/UX or canvas-container slice.
---
