/**
 * Shared helpers for e2e specs that need the shared test project auth.setup.ts
 * creates for the ephemeral e2e user.
 *
 * Ownership enforcement (`server/routes/auth-middleware.ts::requireProjectOwnership`)
 * returns 404 "Project not found" for any project the authenticated user does not
 * own, and every e2e run registers a brand-new random user — so a hardcoded id
 * like `/projects/1` only ever works by accident (whatever a developer happened
 * to create locally). Specs that just need *a* project owned by the test user
 * (view-load smoke tests, a11y scans, keyboard-nav sweeps) should read the real
 * id from here instead.
 */
import { readFileSync } from 'node:fs';

const AUTH_STATE_PATH = 'e2e/.auth-state.json';
const TEST_PROJECT_PATH = 'e2e/.test-project-id.json';

/** Read the persisted e2e session id out of the saved auth storage state. */
export function sessionIdFromStorageState(): string {
  const state = JSON.parse(readFileSync(AUTH_STATE_PATH, 'utf8')) as {
    origins?: { localStorage?: { name: string; value: string }[] }[];
  };
  for (const origin of state.origins ?? []) {
    const entry = origin.localStorage?.find((e) => /session/i.test(e.name));
    if (entry?.value) {
      return entry.value;
    }
  }
  throw new Error(`No session id found in ${AUTH_STATE_PATH}`);
}

/**
 * Read the id of the shared project `auth.setup.ts` creates for the e2e test
 * user. Specs that create their own dedicated project (e.g. because they need
 * a specific board profile) should keep doing that instead of using this.
 */
export function getTestProjectId(): number {
  const parsed = JSON.parse(readFileSync(TEST_PROJECT_PATH, 'utf8')) as { projectId: number };
  if (!Number.isFinite(parsed.projectId)) {
    throw new Error(`Invalid projectId in ${TEST_PROJECT_PATH}`);
  }
  return parsed.projectId;
}
