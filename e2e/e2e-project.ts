import { expect, type Page } from '@playwright/test';
import fs from 'node:fs';

export const AUTH_STATE_PATH = 'e2e/.auth-state.json';
export const E2E_PROJECT_ID_KEY = 'protopulse-e2e-project-id';
export const E2E_PROJECT_NAME_KEY = 'protopulse-e2e-project-name';

export function getSetupProjectId(): string {
  const authState = JSON.parse(fs.readFileSync(AUTH_STATE_PATH, 'utf8')) as {
    origins?: Array<{
      localStorage?: Array<{ name: string; value: string }>;
    }>;
  };
  const projectId = authState.origins
    ?.flatMap((origin) => origin.localStorage ?? [])
    .find((entry) => entry.name === E2E_PROJECT_ID_KEY)
    ?.value;

  expect(projectId, 'auth.setup.ts should seed a project id in storageState').toBeTruthy();
  return projectId!;
}

export function getSetupProjectPath(viewName?: string): string {
  const projectPath = `/projects/${getSetupProjectId()}`;
  return viewName ? `${projectPath}/${viewName}` : projectPath;
}

export function getSetupProjectName(): string {
  const authState = JSON.parse(fs.readFileSync(AUTH_STATE_PATH, 'utf8')) as {
    origins?: Array<{
      localStorage?: Array<{ name: string; value: string }>;
    }>;
  };
  const projectName = authState.origins
    ?.flatMap((origin) => origin.localStorage ?? [])
    .find((entry) => entry.name === E2E_PROJECT_NAME_KEY)
    ?.value;

  expect(projectName, 'auth.setup.ts should seed a project name in storageState').toBeTruthy();
  return projectName!;
}

export async function clearLastProjectSelection(page: Page): Promise<void> {
  await page.evaluate(() => {
    const keysToRemove: string[] = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key === 'protopulse-last-project' || key?.startsWith('protopulse-last-project:')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => {
      localStorage.removeItem(key);
    });
  });
}
