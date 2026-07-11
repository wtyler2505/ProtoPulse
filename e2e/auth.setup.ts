/**
 * Shared auth helper for E2E tests.
 *
 * The app uses session-based auth via X-Session-Id header. On the browser side
 * the AuthProvider fetches /api/auth/me on mount — if there is no session it
 * renders the AuthPage login form. We create a real session via the API and
 * inject the session id into localStorage so the React auth context picks it up.
 */
import { writeFile } from 'node:fs/promises';

import { test as setup, expect } from '@playwright/test';

const AUTH_STATE_PATH = 'e2e/.auth-state.json';
const TEST_PROJECT_PATH = 'e2e/.test-project-id.json';

setup('authenticate', async ({ request, page }) => {
  const randomSuffix = Math.floor(Math.random() * 1000000).toString();
  const username = `e2e-user-${randomSuffix}`;
  const password = 'E2eTestPass123!';

  // 1. Register a test user
  const registerRes = await request.post('/api/auth/register', {
    data: { username, password },
  });
  expect(registerRes.status()).toBe(201);

  // 2. Log in to get a session id
  const loginRes = await request.post('/api/auth/login', {
    data: { username, password },
  });
  expect(loginRes.ok()).toBeTruthy();
  const loginBody = (await loginRes.json()) as { sessionId: string };
  const sessionId = loginBody.sessionId;
  expect(sessionId).toBeTruthy();

  // 3. Create a shared project owned by this test user. Ownership enforcement
  // (server/routes/auth-middleware.ts::requireProjectOwnership) returns 404 for
  // any project the caller doesn't own, and this user is brand-new every run —
  // so specs that navigate to a project must use an id this user actually owns,
  // never a hardcoded one. Specs read the id back via e2e/test-project.ts.
  const createProjectRes = await request.post('/api/projects', {
    headers: { 'X-Session-Id': sessionId },
    data: {
      name: 'E2E Shared Test Project',
      description: 'Auto-created by auth.setup.ts for specs that just need a project the test user owns.',
    },
  });
  expect(createProjectRes.ok(), `project create failed: ${createProjectRes.status()}`).toBeTruthy();
  const projectId = ((await createProjectRes.json()) as { id: number }).id;
  await writeFile(TEST_PROJECT_PATH, JSON.stringify({ projectId }));

  // 4. Seed the session into the browser so AuthProvider sees it
  await page.goto('/');
  await page.evaluate((sid: string) => {
    localStorage.setItem('protopulse-session-id', sid);
  }, sessionId);

  // 5. Save storage state for other tests to reuse
  await page.context().storageState({ path: AUTH_STATE_PATH });
});
