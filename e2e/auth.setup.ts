/**
 * Shared auth helper for E2E tests.
 *
 * The app uses session-based auth via X-Session-Id header. On the browser side
 * the AuthProvider fetches /api/auth/me on mount — if there is no session it
 * renders the AuthPage login form. We create a real session via the API and
 * inject the session id into localStorage so the React auth context picks it up.
 */
import { test as setup, expect } from '@playwright/test';

const AUTH_STATE_PATH = 'e2e/.auth-state.json';

setup('authenticate', async ({ request, page }) => {
  // 1. Register a test user (ignore conflict if already exists)
  const registerRes = await request.post('/api/auth/register', {
    data: { username: 'e2e-test-user', password: 'E2eTestPass123!' },
  });
  // 201 = created, 409 = already exists — both are fine
  expect([201, 409]).toContain(registerRes.status());

  // 2. Log in to get a session id
  const loginRes = await request.post('/api/auth/login', {
    data: { username: 'e2e-test-user', password: 'E2eTestPass123!' },
  });
  expect(loginRes.ok()).toBeTruthy();
  const loginBody = (await loginRes.json()) as { sessionId: string };
  const sessionId = loginBody.sessionId;
  expect(sessionId).toBeTruthy();

  // 3. Seed the session into the browser so AuthProvider sees it
  await page.goto('/');
  await page.evaluate((sid: string) => {
    localStorage.setItem('session_id', sid);
  }, sessionId);

  // 4. Save storage state for other tests to reuse
  await page.context().storageState({ path: AUTH_STATE_PATH });
});
