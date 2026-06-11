import { test, expect, type Page } from '@playwright/test';
import { getSetupProjectPath } from './e2e-project';

test.use({
  storageState: 'e2e/.auth-state.json',
  viewport: { width: 1366, height: 720 },
});
test.setTimeout(60_000);

async function seedPcbSpatialComment(page: Page): Promise<{ id: number }> {
  return page.evaluate(async () => {
    const sessionId = window.localStorage.getItem('protopulse-session-id');
    const projectId = Number(window.localStorage.getItem('protopulse-e2e-project-id'));
    if (!sessionId || !Number.isFinite(projectId)) {
      throw new Error('Missing Playwright auth project/session state');
    }

    const response = await window.fetch(`/api/projects/${String(projectId)}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Id': sessionId,
      },
      body: JSON.stringify({
        content: `PCB anchor proof ${String(Date.now())}`,
        targetType: 'spatial',
        spatialView: 'pcb',
        spatialX: 42.25,
        spatialY: 128.5,
      }),
    });
    if (!response.ok) {
      throw new Error(`Could not seed spatial comment: ${String(response.status)}`);
    }
    return await response.json() as { id: number };
  });
}

test('comments panel surfaces PCB spatial anchors and anchor filter', async ({ page }) => {
  const consoleProblems: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      consoleProblems.push(`${message.type()}: ${message.text()}`);
    }
  });

  await page.goto(getSetupProjectPath());
  const { id } = await seedPcbSpatialComment(page);

  await page.getByRole('button', { name: /^Comments$/ }).click();
  await expect(page.getByTestId('comments-panel')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId(`comment-spatial-anchor-${String(id)}`)).toContainText('PCB canvas (42.3, 128.5)');
  await expect(page.getByTestId(`comment-target-badge-${String(id)}`)).toContainText('Anchor');

  await page.getByTestId('comments-filter-toggle').click();
  await expect(page.getByTestId('comments-filter-target-spatial')).toContainText('Anchors');
  await page.screenshot({ path: 'e2e-results/r21-comments-spatial-anchor.png', fullPage: true });

  expect(consoleProblems).toEqual([]);
});
