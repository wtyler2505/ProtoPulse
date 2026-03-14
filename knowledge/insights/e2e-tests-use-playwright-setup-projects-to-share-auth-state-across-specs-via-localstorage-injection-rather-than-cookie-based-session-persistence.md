---
summary: Playwright E2E tests create a real user via API registration, inject the session ID into localStorage (matching the app's X-Session-Id auth pattern), and share this state across specs via storageState files
category: testing
areas:
  - testing-patterns
---

# E2E tests use Playwright setup projects to share auth state across specs via localStorage injection rather than cookie-based session persistence

The Playwright E2E test suite (`e2e/`) uses a two-phase auth pattern that mirrors ProtoPulse's unconventional auth model:

**Phase 1 — Setup project (`auth.setup.ts`):**
1. Registers a fresh user with random suffix via `POST /api/auth/register`
2. Logs in via `POST /api/auth/login` to get a session ID
3. Navigates to `/` and injects the session ID into localStorage: `localStorage.setItem('protopulse-session-id', sid)`
4. Saves the browser storage state to `e2e/.auth-state.json`

**Phase 2 — Spec files:**
Every spec file declares `test.use({ storageState: 'e2e/.auth-state.json' })`, which pre-loads the saved localStorage into each test browser context.

**Why this matters:** ProtoPulse uses `X-Session-Id` header auth (not cookies). The React `AuthProvider` reads the session ID from localStorage and sends it as a header. Cookie-based Playwright auth patterns (the typical `storageState` approach) would not work because the auth credential lives in localStorage, not in HTTP cookies. The setup project bridges this gap by injecting the session ID where the React app expects to find it.

**The Playwright config enforces ordering:** The `setup` project is listed as a `dependency` of the `chromium` project, ensuring auth runs once before any specs execute. The config also uses `reuseExistingServer: true` with a `webServer` block that starts `npm run dev` — this means specs run against the real dev server, not a mock.

**Test isolation trade-off:** All specs share one authenticated user (via the `.auth-state.json` file). This is fast (one API call for all tests) but means tests can interfere with each other's project data. The `project-workspace.spec.ts` mitigates this by creating a fresh project in `beforeEach`, but shared user state remains a coupling point.

**E2E test categories covered:**
- Navigation (URL routing, sidebar clicks, 404 handling)
- Project picker (CRUD flow, dialog interactions, empty state)
- Workspace layout (default view, chat panel, nav switching)
- Accessibility (heading structure, aria labels, keyboard access, alt text)

Areas: [[testing-patterns]]
