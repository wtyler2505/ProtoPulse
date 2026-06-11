import { expect, test, type Page } from '@playwright/test';
import { getSetupProjectPath } from './e2e-project';

test.use({
  storageState: 'e2e/.auth-state.json',
  viewport: { width: 1366, height: 720 },
});
test.setTimeout(60_000);

async function delayArchitectureChunk(page: Page): Promise<void> {
  let delayed = false;
  await page.route('**/*', async (route) => {
    if (!delayed && route.request().url().includes('ArchitectureView')) {
      delayed = true;
      await new Promise((resolve) => setTimeout(resolve, 800));
    }
    await route.continue();
  });
}

async function ensureArchitectureNode(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const sessionId = window.localStorage.getItem('protopulse-session-id');
    const projectId = Number(window.localStorage.getItem('protopulse-e2e-project-id'));
    if (!sessionId || !Number.isFinite(projectId)) {
      throw new Error('Missing Playwright auth project/session state');
    }

    const headers = {
      'Content-Type': 'application/json',
      'X-Session-Id': sessionId,
    };
    const response = await window.fetch(`/api/projects/${String(projectId)}/nodes`, { headers });
    if (!response.ok) {
      throw new Error(`Could not load architecture nodes: ${String(response.status)}`);
    }

    const nodes = await response.json() as { data: Array<{ nodeId: string }> };
    if (nodes.data.length > 0) {
      return;
    }

    const nodeId = `bl-0778-analyze-node-${Date.now()}`;
    const createResponse = await window.fetch(`/api/projects/${String(projectId)}/nodes`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        nodeId,
        nodeType: 'mcu',
        label: 'Analyze Tool MCU',
        positionX: 320,
        positionY: 220,
        data: {
          description: 'Seeded by bl-0777-0778-architecture-loading-analyze.spec.ts.',
        },
      }),
    });
    if (!createResponse.ok) {
      throw new Error(`Could not seed architecture node: ${String(createResponse.status)}`);
    }
  });
}

test('BL-0777/BL-0778: Architecture loading is named and Analyze opens the panel', async ({ page }) => {
  const consoleIssues: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      consoleIssues.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => {
    consoleIssues.push(`pageerror: ${error.message}`);
  });

  await delayArchitectureChunk(page);
  await page.goto(getSetupProjectPath('architecture'));

  const loadingLabel = page.getByTestId('panel-skeleton-label');
  await expect(loadingLabel).toHaveText('Loading Architecture...');
  await expect(page.getByTestId('panel-skeleton-spinner')).toBeVisible();
  await expect(page.getByTestId('tool-analyze')).toBeVisible({ timeout: 20_000 });

  await ensureArchitectureNode(page);
  await page.reload();

  const analyzeButton = page.getByTestId('tool-analyze');
  await expect(analyzeButton).toBeVisible({ timeout: 20_000 });
  await analyzeButton.click();

  await expect(page.getByTestId('analysis-panel')).toBeVisible();
  await expect(page.getByTestId('analysis-panel-title')).toHaveText('Design Analysis');
  await expect(page.getByTestId('analysis-loading').or(page.getByTestId('analysis-summary'))).toBeVisible();
  await expect(consoleIssues).toEqual([]);
});
