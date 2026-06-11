/**
 * Shared auth helper for E2E tests.
 *
 * The app uses session-based auth via X-Session-Id header. On the browser side
 * the AuthProvider fetches /api/auth/me on mount — if there is no session it
 * renders the AuthPage login form. We create a real session via the API and
 * inject the session id into localStorage so the React auth context picks it up.
 */
import { test as setup, expect, type APIRequestContext, type Page } from '@playwright/test';
import fs from 'node:fs';

const AUTH_STATE_PATH = 'e2e/.auth-state.json';
const E2E_PROJECT_ID_KEY = 'protopulse-e2e-project-id';
const E2E_PROJECT_NAME_KEY = 'protopulse-e2e-project-name';
const DISABLE_REMOTE_FONTS_KEY = 'pp:disable-remote-fonts';
const SESSION_ID_KEY = 'protopulse-session-id';

type StoredAuthState = {
  sessionId: string;
  projectId: string;
  projectName: string;
};

type PlaywrightStorageState = {
  origins?: Array<{
    localStorage?: Array<{ name: string; value: string }>;
  }>;
};

function findStoredValue(state: PlaywrightStorageState, key: string): string | null {
  return (
    state.origins
      ?.flatMap((origin) => origin.localStorage ?? [])
      .find((entry) => entry.name === key)
      ?.value ?? null
  );
}

function readStoredAuthState(): StoredAuthState | null {
  if (!fs.existsSync(AUTH_STATE_PATH)) {
    return null;
  }

  try {
    const state = JSON.parse(fs.readFileSync(AUTH_STATE_PATH, 'utf8')) as PlaywrightStorageState;
    const sessionId = findStoredValue(state, SESSION_ID_KEY);
    const projectId = findStoredValue(state, E2E_PROJECT_ID_KEY);
    const projectName = findStoredValue(state, E2E_PROJECT_NAME_KEY);
    return sessionId && projectId && projectName ? { sessionId, projectId, projectName } : null;
  } catch {
    return null;
  }
}

async function validateStoredAuthState(request: APIRequestContext, state: StoredAuthState): Promise<boolean> {
  const headers = { 'X-Session-Id': state.sessionId };
  const meRes = await request.get('/api/auth/me', { headers });
  if (!meRes.ok()) {
    return false;
  }

  const projectRes = await request.get(`/api/projects/${state.projectId}`, { headers });
  return projectRes.ok();
}

async function seedBrowserState(page: Page, state: StoredAuthState): Promise<void> {
  // Only the origin is needed for localStorage. Waiting for full app load makes
  // first-run Vite transforms a false source of auth setup timeouts.
  await page.goto('/?disableRemoteFonts=1', { waitUntil: 'commit', timeout: 60_000 });
  await page.evaluate(({ sid, projectId, projectKey, projectNameKey, disableRemoteFontsKey, name }) => {
    localStorage.setItem('protopulse-session-id', sid);
    localStorage.setItem(projectKey, String(projectId));
    localStorage.setItem(projectNameKey, name);
    localStorage.setItem('protopulse-last-project', String(projectId));
    localStorage.setItem(disableRemoteFontsKey, '1');
  }, {
    sid: state.sessionId,
    projectId: state.projectId,
    projectKey: E2E_PROJECT_ID_KEY,
    projectNameKey: E2E_PROJECT_NAME_KEY,
    disableRemoteFontsKey: DISABLE_REMOTE_FONTS_KEY,
    name: state.projectName,
  });
}

setup('authenticate', async ({ request, page }) => {
  const storedAuthState = readStoredAuthState();
  if (storedAuthState && (await validateStoredAuthState(request, storedAuthState))) {
    await seedBrowserState(page, storedAuthState);
    await page.context().storageState({ path: AUTH_STATE_PATH });
    return;
  }

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

  // 3. Create a real project owned by this fresh user so direct workspace
  // route tests do not depend on a persistent local project with id 1.
  const projectName = `E2E Workspace ${randomSuffix}`;
  const projectRes = await request.post('/api/projects', {
    headers: { 'X-Session-Id': sessionId },
    data: {
      name: projectName,
      description: 'Seeded by Playwright auth setup for direct workspace route smoke tests.',
    },
  });
  expect(projectRes.status()).toBe(201);
  const project = (await projectRes.json()) as { id: number };
  expect(project.id).toBeGreaterThan(0);

  // 4. Seed the session into the browser so AuthProvider sees it
  await seedBrowserState(page, {
    sessionId,
    projectId: String(project.id),
    projectName,
  });

  // 5. Save storage state for other tests to reuse
  await page.context().storageState({ path: AUTH_STATE_PATH });
});
