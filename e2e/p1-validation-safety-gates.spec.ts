import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import { getSetupProjectPath } from './e2e-project';

test.use({ storageState: 'e2e/.auth-state.json' });
test.setTimeout(60_000);

type ViewportCase = {
  name: string;
  viewport: { width: number; height: number };
};

const VIEWPORTS: ViewportCase[] = [
  { name: 'desktop', viewport: { width: 1440, height: 900 } },
  { name: 'laptop', viewport: { width: 1366, height: 720 } },
  { name: 'mobile', viewport: { width: 390, height: 740 } },
];

function screenshotPath(name: string): string {
  fs.mkdirSync('logs', { recursive: true });
  return `logs/${name}`;
}

async function expectReachable(page: Page, testId: string, label: string): Promise<void> {
  const locator = page.getByTestId(testId);
  await locator.waitFor({ state: 'visible', timeout: 15_000 });
  await locator.scrollIntoViewIfNeeded();
  await expect(locator, `${label} should be visible`).toBeVisible();
  await expect(locator, `${label} should intersect the viewport`).toBeInViewport();
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

    const nodeId = `validation-safety-gate-node-${Date.now()}`;
    const createResponse = await window.fetch(`/api/projects/${String(projectId)}/nodes`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        nodeId,
        nodeType: 'mcu',
        label: 'Validation Safety Gate MCU',
        positionX: 320,
        positionY: 220,
        data: {
          description: 'Seeded by p1-validation-safety-gates.spec.ts so Validation route is reachable.',
        },
      }),
    });
    if (!createResponse.ok) {
      throw new Error(`Could not seed architecture node: ${String(createResponse.status)}`);
    }
  });
}

test.describe('validation safety gates', () => {
  test.describe.configure({ mode: 'serial' });

  for (const { name, viewport } of VIEWPORTS) {
    test(`provenance safety gate layout is reachable on ${name}`, async ({ page }) => {
      const consoleIssues: string[] = [];
      page.on('console', (message) => {
        if (message.type() === 'error' || message.type() === 'warning') {
          consoleIssues.push(`${message.type()}: ${message.text()}`);
        }
      });

      await page.setViewportSize(viewport);
      await page.goto(getSetupProjectPath());
      await page.getByTestId('workspace-main').waitFor({ state: 'visible', timeout: 15_000 });
      await ensureArchitectureNode(page);

      await page.goto(getSetupProjectPath('validation'));
      await page.getByTestId('workspace-main').waitFor({ state: 'visible', timeout: 15_000 });

      await expectReachable(page, 'run-drc-checks', 'Run DRC checks button');
      await expectReachable(page, 'open-custom-rules', 'Custom rules button');
      await expectReachable(page, 'drc-preset-bar', 'DRC preset bar');
      await expectReachable(page, 'validation-safety-gates', 'Validation safety gates');
      await expect(page.getByTestId('validation-safety-gate-summary')).toBeVisible();
      await expect(page.getByTestId('validation-safety-gate-ai-generated-circuit-provenance')).toBeVisible();
      await expect(page.getByTestId('validation-safety-gate-exact-part-verification')).toBeVisible();
      await expect(page.getByTestId('validation-safety-gate-verified-mechanical-models')).toBeVisible();
      await expect(page.getByTestId('validation-safety-gate-breadboard-health')).toBeVisible();
      await expect(page.getByTestId('validation-safety-gate-lifecycle-risk')).toBeVisible();
      await expect(page.getByTestId('validation-safety-gate-inventory-confidence')).toBeVisible();
      await expectReachable(page, 'severity-filter-bar', 'Severity filter bar');
      await expectReachable(page, 'design-gateway-section', 'Design gateway section');
      await expectReachable(page, 'dfm-check-section', 'DFM check section');

      await page.screenshot({
        path: screenshotPath(`r55-validation-safety-gates-${name}.png`),
        fullPage: true,
      });

      expect(consoleIssues, 'Validation should not emit console warnings or errors').toEqual([]);
    });
  }
});
