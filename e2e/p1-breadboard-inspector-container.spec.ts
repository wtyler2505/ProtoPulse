import { test, expect, type Page } from '@playwright/test';
import { getSetupProjectPath } from './e2e-project';

test.use({
  storageState: 'e2e/.auth-state.json',
  viewport: { width: 1366, height: 720 },
});
test.setTimeout(60_000);

async function seedBreadboardInstance(page: Page): Promise<{ instanceId: number }> {
  return page.evaluate(async () => {
    const sessionId = window.localStorage.getItem('protopulse-session-id');
    const projectId = Number(window.localStorage.getItem('protopulse-e2e-project-id'));
    if (!sessionId || !Number.isFinite(projectId)) {
      throw new Error('Missing Playwright auth project/session state');
    }

    const headers = {
      'Content-Type': 'application/json',
      'X-Session-Id': sessionId,
    };
    const existingCircuitsResponse = await window.fetch(`/api/projects/${String(projectId)}/circuits`, { headers });
    if (!existingCircuitsResponse.ok) {
      throw new Error(`Could not load circuits: ${String(existingCircuitsResponse.status)}`);
    }
    const existingCircuits = await existingCircuitsResponse.json() as { data: Array<{ id: number }> };
    let circuit = existingCircuits.data[0];

    if (!circuit) {
      const circuitResponse = await window.fetch(`/api/projects/${String(projectId)}/circuits`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          projectId,
          name: `Inspector container ${Date.now()}`,
          description: 'Seeded by p1-breadboard-inspector-container.spec.ts',
        }),
      });
      if (!circuitResponse.ok) {
        throw new Error(`Could not seed circuit: ${String(circuitResponse.status)}`);
      }
      circuit = await circuitResponse.json() as { id: number };
    }

    const instanceResponse = await window.fetch(`/api/circuits/${String(circuit.id)}/instances`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        partId: null,
        referenceDesignator: 'U1',
        breadboardX: 70,
        breadboardY: 150,
        breadboardRotation: 0,
        properties: {
          componentTitle: 'ATmega328P DIP',
          label: 'ATmega328P DIP',
          type: 'ic',
        },
      }),
    });
    if (!instanceResponse.ok) {
      throw new Error(`Could not seed instance: ${String(instanceResponse.status)}`);
    }
    const instance = await instanceResponse.json() as { id: number };
    return { instanceId: instance.id };
  });
}

type LayoutBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function expectBoxWithinViewport(
  box: LayoutBox | null,
  viewport: { width: number; height: number } | null,
  label: string,
): asserts box is LayoutBox {
  expect(box, `${label} should have a browser layout box`).not.toBeNull();
  expect(viewport, 'test should run with a real viewport').not.toBeNull();
  if (!box || !viewport) {
    return;
  }

  expect(box.x, `${label} left edge should be visible`).toBeGreaterThanOrEqual(0);
  expect(box.y, `${label} top edge should be visible`).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width, `${label} right edge should be visible`).toBeLessThanOrEqual(viewport.width + 1);
  expect(box.y + box.height, `${label} bottom edge should be visible`).toBeLessThanOrEqual(viewport.height + 1);
}

function boxesOverlap(a: LayoutBox, b: LayoutBox): boolean {
  return a.x < b.x + b.width
    && a.x + a.width > b.x
    && a.y < b.y + b.height
    && a.y + a.height > b.y;
}

test('breadboard selected-part inspector is reachable, collapsible, and keeps 3D action on laptop height', async ({ page }) => {
  const consoleProblems: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      consoleProblems.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => {
    consoleProblems.push(`pageerror: ${error.message}`);
  });

  await page.goto(getSetupProjectPath());
  const { instanceId } = await seedBreadboardInstance(page);

  await page.getByRole('button', { name: /^Breadboard$/ }).first().click();
  await page.getByTestId('breadboard-canvas').waitFor({ state: 'visible', timeout: 15_000 });

  const instance = page.getByTestId(`bb-instance-${String(instanceId)}`);
  await instance.waitFor({ state: 'visible', timeout: 15_000 });
  await instance.locator('rect').first().click({ force: true });
  const inspector = page.getByTestId('breadboard-part-inspector');
  await expect(inspector).toBeVisible({ timeout: 10_000 });

  const workSurfaceStatus = page.getByTestId('breadboard-work-surface-status');
  await expect(workSurfaceStatus).toBeVisible();
  await expect(workSurfaceStatus).toHaveAttribute('data-resizable', 'true');
  await expect(workSurfaceStatus).toHaveAttribute('data-resize-axis', 'both');
  await expect(page.getByTestId('button-breadboard-surface-status-toggle')).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByTestId('breadboard-work-surface-coach')).toContainText(/U1/);
  const provenance = page.getByTestId('breadboard-work-surface-provenance');
  await expect(provenance).toBeVisible();
  await expect(provenance).toContainText('Part provenance');
  await expect(provenance).toContainText(/VERIFIED EXACT|CONNECTOR DEFINED|HEURISTIC|STASH ABSENT/);
  await expect(page.getByTestId('breadboard-work-surface-pin-map')).toContainText(/pin /);
  await expect(page.getByTestId('breadboard-work-surface-verification')).toBeVisible();
  await page.getByTestId('button-breadboard-surface-audit').click();
  await expect(page.getByTestId('breadboard-work-surface-health')).toContainText(/score|critical|warning|Healthy/);
  await page.getByTestId('button-breadboard-surface-status-toggle').click();
  await expect(workSurfaceStatus).toHaveAttribute('data-collapsed', 'true');
  await expect(page.getByTestId('button-breadboard-surface-status-toggle')).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByTestId('breadboard-work-surface-status-body')).toHaveCount(0);
  const collapsedSurface3DButton = page.getByTestId('button-breadboard-surface-view-in-3d');
  await expect(collapsedSurface3DButton).toBeVisible();
  await expect(collapsedSurface3DButton).toBeInViewport();
  await page.getByTestId('button-breadboard-surface-status-toggle').click();
  await expect(page.getByTestId('breadboard-work-surface-status-body')).toBeVisible();
  await expect(page.getByTestId('button-breadboard-surface-status-toggle')).toHaveAttribute('aria-expanded', 'true');

  await expect(inspector).toBeVisible({ timeout: 10_000 });
  await expect(inspector).toHaveAttribute('data-resizable', 'true');
  await expect(inspector).toHaveAttribute('data-resize-axis', 'both');
  await expect(page.getByTestId('breadboard-part-inspector-body')).toBeVisible();
  await expect(workSurfaceStatus).toBeInViewport({ ratio: 1 });
  await expect(inspector).toBeInViewport({ ratio: 1 });

  const box = await inspector.boundingBox();
  const statusBox = await workSurfaceStatus.boundingBox();
  const viewport = page.viewportSize();
  expectBoxWithinViewport(box, viewport, 'selected-part inspector');
  expectBoxWithinViewport(statusBox, viewport, 'work-surface status');
  expect(boxesOverlap(box, statusBox), 'status dock should not cover the selected-part inspector').toBe(false);

  await page.getByTestId('breadboard-part-inspector-toggle').click();
  await expect(inspector).toHaveAttribute('data-collapsed', 'true');
  await expect(page.getByTestId('breadboard-part-inspector-body')).toHaveCount(0);
  await expect(page.getByTestId('breadboard-part-inspector-toggle')).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByRole('button', { name: /view in 3d/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /view in 3d/i })).toBeInViewport();
  await page.screenshot({ path: 'e2e-results/r25-breadboard-work-surface-status.png', fullPage: true });
  await page.screenshot({ path: 'e2e-results/r19-breadboard-inspector-laptop.png', fullPage: true });

  await page.getByTestId('button-breadboard-surface-status-toggle').click();
  await expect(workSurfaceStatus).toHaveAttribute('data-collapsed', 'true');
  await expect(collapsedSurface3DButton).toBeVisible();
  await expect(collapsedSurface3DButton).toBeInViewport();
  await collapsedSurface3DButton.click();

  await expect(page.getByTestId('board-viewer-3d-view')).toBeVisible({ timeout: 10_000 });
  const bridgeCard = page.getByTestId('viewer-breadboard-bridge-card');
  await expect(bridgeCard).toBeVisible();
  await expect(bridgeCard).toContainText('Breadboard selection');
  await expect(bridgeCard).toContainText('U1');
  await expect(bridgeCard).toContainText('pin map');
  await expect(bridgeCard).toContainText(/health clean|health warning|health critical/);

  expect(consoleProblems).toEqual([]);
});
