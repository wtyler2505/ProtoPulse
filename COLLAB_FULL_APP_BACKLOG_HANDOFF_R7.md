## Lane Reservation

- Active channels: COLLAB_FULL_APP_BACKLOG_HANDOFF_R7.md, COLLAB_FULL_APP_BACKLOG_RESPONSE_R7_CODEX.md
- Claimed files: server/index.ts, playwright.config.ts, e2e/tab-route-matrix.spec.ts, e2e/p1-a11y-scan.spec.ts, server/__tests__/auth-regression.test.ts, client/src/components/views/PcbOrderingView.tsx, client/src/components/panels/SerialMonitorPanel.tsx, client/src/components/arduino/DeviceCommandSandbox.tsx, COLLAB_FULL_APP_BACKLOG_HANDOFF_R7.md, COLLAB_FULL_APP_BACKLOG_RESPONSE_R7_CODEX.md
- Forbidden files: CODEX_HANDOFF.md, CODEX_DONE.md, existing unrelated COLLAB_*, .env, knowledge/**, data/pp-nlm/**
- Background sessions: none
- Round type: implement
- Target file edits permitted this round: listed-only
- Agent cap status: 1/6 active implementation agent counted from current Codex turn; no background workers dispatched

# Full App Views Backlog Campaign R7

## Source Material

- R6 response: COLLAB_FULL_APP_BACKLOG_RESPONSE_R6_CODEX.md
- Playwright config: playwright.config.ts
- Server API limiter: server/index.ts
- Auth/rate-limit regression notes: server/__tests__/auth-regression.test.ts
- Context checked this round: Context7 Playwright `/microsoft/playwright.dev`

## Scope For This Round

Codex lands the verification-infrastructure fix uncovered by R6:

- Root cause route-matrix login fallthrough after many direct workspace route loads.
- Make the global API rate limit configurable for Playwright/dev verification without changing production defaults silently.
- Run the tab route matrix again cleanly enough to prove the auth fixture and direct workspace route checks survive the full route list.
- Record remaining a11y/browser debt separately if it is unrelated to the rate-limit/auth fixture failure.

## Evidence So Far

- Single failed route passed in isolation:
  - `PLAYWRIGHT_HTML_OPEN=never npm run test:e2e -- e2e/tab-route-matrix.spec.ts -g "Knowledge & Learning Views.*knowledge" --workers=1 --reporter=dot`
  - 2 passed.
- Output/Ordering + first Knowledge route passed in isolation:
  - `PLAYWRIGHT_HTML_OPEN=never npm run test:e2e -- e2e/tab-route-matrix.spec.ts -g "Output & Export Views|Knowledge & Learning Views.*knowledge" --workers=1 --reporter=dot`
  - 4 passed.
- Full route matrix fails after the first 16 direct workspace routes; failure screenshots show AuthPage, not a specific view crash.
- `server/index.ts` currently hardcodes global `/api` limiter at 300 requests per 15 minutes.

---
ROUND_STATUS: proposed
OPEN_CRITIQUES: full route matrix is red because the shared E2E session falls to AuthPage after accumulated API requests; a11y still has separate known axe issues
SIGNOFF: Codex
OWNERSHIP: Codex
NEXT_ROUND: Make API rate limit configurable for Playwright, rerun route matrix, then update response evidence.
---
