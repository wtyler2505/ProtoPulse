import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import { getSetupProjectPath } from './e2e-project';

test.use({
  storageState: 'e2e/.auth-state.json',
  viewport: { width: 1366, height: 720 },
});
test.setTimeout(60_000);

type LayoutBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function screenshotPath(name: string): string {
  fs.mkdirSync('logs', { recursive: true });
  return `logs/${name}`;
}

async function expectWithinViewport(page: Page, selector: string, label: string) {
  const locator = page.getByTestId(selector);
  await expect(locator, `${label} should be visible`).toBeVisible();
  await expect(locator, `${label} should intersect the laptop viewport`).toBeInViewport({ ratio: 1 });

  const box = await locator.boundingBox();
  const viewport = page.viewportSize();
  expect(box, `${label} should have a layout box`).not.toBeNull();
  expect(viewport, 'test should run with a real viewport').not.toBeNull();
  if (!box || !viewport) {
    return;
  }

  const layoutBox = box as LayoutBox;
  expect(layoutBox.x, `${label} left edge should be visible`).toBeGreaterThanOrEqual(0);
  expect(layoutBox.y, `${label} top edge should be visible`).toBeGreaterThanOrEqual(0);
  expect(layoutBox.x + layoutBox.width, `${label} right edge should be visible`).toBeLessThanOrEqual(viewport.width + 1);
  expect(layoutBox.y + layoutBox.height, `${label} bottom edge should be visible`).toBeLessThanOrEqual(viewport.height + 1);
}

async function ensureCircuit(page: Page): Promise<void> {
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
    const response = await window.fetch(`/api/projects/${String(projectId)}/circuits`, { headers });
    if (!response.ok) {
      throw new Error(`Could not load circuits: ${String(response.status)}`);
    }
    const circuits = await response.json() as { data: Array<{ id: number }> };
    if (circuits.data.length > 0) {
      return;
    }

    const createResponse = await window.fetch(`/api/projects/${String(projectId)}/circuits`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        projectId,
        name: `Surface status ${Date.now()}`,
        description: 'Seeded by p1-surface-status-docks.spec.ts',
      }),
    });
    if (!createResponse.ok) {
      throw new Error(`Could not seed circuit: ${String(createResponse.status)}`);
    }
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

    const nodeId = `surface-status-node-${Date.now()}`;
    const createResponse = await window.fetch(`/api/projects/${String(projectId)}/nodes`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        nodeId,
        nodeType: 'mcu',
        label: 'Surface Status MCU',
        positionX: 320,
        positionY: 220,
        data: {
          description: 'Seeded by p1-surface-status-docks.spec.ts so PCB route is reachable.',
        },
      }),
    });
    if (!createResponse.ok) {
      throw new Error(`Could not seed architecture node: ${String(createResponse.status)}`);
    }
  });
}

async function seedComponentEditorPart(page: Page): Promise<{ partId: number; title: string }> {
  return page.evaluate(async () => {
    const sessionId = window.localStorage.getItem('protopulse-session-id');
    const projectId = Number(window.localStorage.getItem('protopulse-e2e-project-id'));
    if (!sessionId || !Number.isFinite(projectId)) {
      throw new Error('Missing Playwright auth project/session state');
    }

    const title = `R58 surface exact part ${String(Date.now()).slice(-5)}`;
    const response = await window.fetch(`/api/projects/${String(projectId)}/component-parts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Id': sessionId,
      },
      body: JSON.stringify({
        meta: {
          title,
          family: 'AVR MCU',
          manufacturer: 'Microchip',
          mpn: 'ATMEGA328P-PU',
          description: 'Seeded by p1-surface-status-docks.spec.ts for Component Editor container proof.',
          tags: ['mcu', 'dip', 'verified'],
          mountingType: 'tht',
          packageType: 'DIP-8',
          properties: [],
          partFamily: 'board-module',
          verificationStatus: 'verified',
          verificationLevel: 'official-backed',
          sourceEvidence: [
            {
              type: 'datasheet',
              label: 'Microchip ATmega328P datasheet',
              href: 'https://www.microchip.com/',
              supports: ['pins', 'dimensions', 'breadboard-fit'],
              confidence: 'high',
              reviewStatus: 'accepted',
            },
          ],
          pinAccuracyReport: {
            connectorNames: 'exact',
            electricalRoles: 'exact',
            breadboardAnchors: 'exact',
            unresolved: [],
          },
          breadboardModelQuality: 'verified',
        },
        connectors: [
          {
            id: 'pin-1',
            name: 'VCC',
            connectorType: 'male',
            shapeIds: { breadboard: ['body'], schematic: [], pcb: [] },
            terminalPositions: { breadboard: { x: 20, y: 20 }, schematic: { x: 0, y: 0 }, pcb: { x: 0, y: 0 } },
          },
          {
            id: 'pin-2',
            name: 'GND',
            connectorType: 'male',
            shapeIds: { breadboard: ['body'], schematic: [], pcb: [] },
            terminalPositions: { breadboard: { x: 80, y: 20 }, schematic: { x: 10, y: 0 }, pcb: { x: 10, y: 0 } },
          },
        ],
        buses: [],
        views: {
          breadboard: {
            shapes: [
              {
                id: 'body',
                type: 'rect',
                x: 10,
                y: 10,
                width: 120,
                height: 60,
                rotation: 0,
                style: { fill: '#222', stroke: '#888', strokeWidth: 1 },
              },
            ],
          },
          schematic: { shapes: [] },
          pcb: { shapes: [] },
        },
        constraints: [],
      }),
    });
    if (!response.ok) {
      throw new Error(`Could not seed component editor part: ${String(response.status)}`);
    }
    const part = await response.json() as { id: number };
    return { partId: part.id, title };
  });
}

test.describe('surface status docks', () => {
  test.describe.configure({ mode: 'serial' });

  test('schematic provenance dock is reachable and collapsible on laptop height', async ({ page }) => {
    await page.goto(getSetupProjectPath());
    await page.getByTestId('workspace-main').waitFor({ state: 'visible', timeout: 15_000 });
    await ensureCircuit(page);
    await ensureArchitectureNode(page);

    await page.goto(getSetupProjectPath('schematic'));
    await page.getByTestId('workspace-main').waitFor({ state: 'visible', timeout: 15_000 });

    const dock = page.getByTestId('schematic-surface-status');
    await expect(dock).toBeVisible({ timeout: 45_000 });
    await expect(dock).toHaveAttribute('data-resizable', 'true');
    await expect(dock).toHaveAttribute('data-resize-axis', 'horizontal');
    await expect(dock).toContainText(/LOCAL_MODEL|AI_PROVISIONAL|AI_VERIFIED_EXACT/);
    await expect(page.getByTestId('schematic-surface-detail')).toBeVisible();
    await expect(page.getByTestId('schematic-surface-canvas-mode')).toContainText('TSCircuit');
    await expectWithinViewport(page, 'schematic-surface-status', 'schematic surface status dock');

    await page.getByTestId('button-toggle-schematic-surface-status').click();
    await expect(dock).toHaveAttribute('data-collapsed', 'true');
    await expect(page.getByTestId('button-toggle-schematic-surface-status')).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByTestId('schematic-surface-detail')).toHaveCount(0);
    await expectWithinViewport(page, 'schematic-surface-status', 'collapsed schematic surface status dock');

    await page.screenshot({ path: screenshotPath('r54-schematic-surface-status-laptop.png'), fullPage: true });
  });

  test('pcb provenance dock carries DRC gate context on laptop height', async ({ page }) => {
    await page.goto(getSetupProjectPath());
    await page.getByTestId('workspace-main').waitFor({ state: 'visible', timeout: 15_000 });
    await ensureCircuit(page);
    await ensureArchitectureNode(page);

    await page.goto(getSetupProjectPath('pcb'));
    await page.getByTestId('workspace-main').waitFor({ state: 'visible', timeout: 15_000 });

    const dock = page.getByTestId('pcb-surface-status');
    await expect(dock).toBeVisible({ timeout: 45_000 });
    await expect(dock).toHaveAttribute('data-resizable', 'true');
    await expect(dock).toHaveAttribute('data-resize-axis', 'horizontal');
    await expect(dock).toContainText(/PCB_EMPTY|PCB_REVIEW|PCB_UNVERIFIED|PCB_LOCAL/);
    await expect(page.getByTestId('pcb-surface-drc-gate')).toBeVisible();
    await expect(page.getByTestId('button-pcb-surface-run-drc')).toBeVisible();
    await expectWithinViewport(page, 'pcb-surface-status', 'pcb surface status dock');

    await page.getByTestId('button-pcb-surface-run-drc').click();
    await expect(page.getByTestId('pcb-surface-drc-gate')).toHaveAttribute('data-blocks-fabrication', /true|false/);

    await page.getByTestId('button-toggle-pcb-surface-status').click();
    await expect(dock).toHaveAttribute('data-collapsed', 'true');
    await expect(page.getByTestId('button-toggle-pcb-surface-status')).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByTestId('pcb-surface-detail')).toHaveCount(0);
    await expectWithinViewport(page, 'pcb-surface-status', 'collapsed pcb surface status dock');

    await page.screenshot({ path: screenshotPath('r54-pcb-surface-status-laptop.png'), fullPage: true });
  });

  test('component editor provenance dock and inspector guardrails are reachable on laptop height', async ({ page }) => {
    await page.goto(getSetupProjectPath());
    await page.getByTestId('workspace-main').waitFor({ state: 'visible', timeout: 15_000 });
    const seededPart = await seedComponentEditorPart(page);

    await page.goto(getSetupProjectPath('component_editor'));
    await page.getByTestId('workspace-main').waitFor({ state: 'visible', timeout: 15_000 });
    await expect(page.getByTestId('component-editor')).toBeVisible({ timeout: 45_000 });

    const partItem = page.getByTestId(`part-item-${String(seededPart.partId)}`);
    await expect(partItem).toBeVisible({ timeout: 45_000 });
    await partItem.click();
    await page.getByTestId('component-editor').getByTestId('tab-breadboard').click();
    await expect(page.getByTestId('shape-canvas-container')).toBeVisible({ timeout: 15_000 });

    const dock = page.getByTestId('component-editor-surface-status');
    await expect(dock).toBeVisible({ timeout: 15_000 });
    await expect(dock).toHaveAttribute('data-resizable', 'true');
    await expect(dock).toHaveAttribute('data-resize-axis', 'horizontal');
    await expect(dock).toContainText('COMPONENT_VERIFIED');
    await expect(dock).toContainText(seededPart.title);
    await expect(page.getByTestId('component-editor-surface-view')).toContainText('breadboard');
    await expect(page.getByTestId('component-editor-surface-shape-count')).toContainText('1');
    await expect(page.getByTestId('component-editor-surface-pin-count')).toContainText('2');
    await expect(page.getByTestId('component-editor-surface-provenance')).toContainText('pin map exact');
    await expectWithinViewport(page, 'component-editor-surface-status', 'component editor surface status dock');

    const inspector = page.getByTestId('inspector-panel');
    await expect(inspector).toBeVisible();
    await expect(inspector).toHaveAttribute('data-resizable', 'true');
    await expect(inspector).toHaveAttribute('data-resize-axis', 'horizontal');
    await expectWithinViewport(page, 'inspector-panel', 'component editor inspector');

    await page.getByTestId('button-toggle-component-inspector').click();
    await expect(inspector).toHaveAttribute('data-collapsed', 'true');
    await expect(page.getByTestId('button-toggle-component-inspector')).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByTestId('inspector-panel-body')).toHaveCount(0);
    await expectWithinViewport(page, 'inspector-panel', 'collapsed component editor inspector');

    await page.getByTestId('button-toggle-component-editor-surface-status').click();
    await expect(dock).toHaveAttribute('data-collapsed', 'true');
    await expect(page.getByTestId('button-toggle-component-editor-surface-status')).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByTestId('component-editor-surface-detail')).toHaveCount(0);
    await expectWithinViewport(page, 'component-editor-surface-status', 'collapsed component editor surface status dock');

    await page.getByTestId('button-drc').click();
    const drcPanel = page.getByTestId('drc-panel');
    await expect(drcPanel).toBeVisible();
    await expect(drcPanel).toHaveAttribute('data-resizable', 'true');
    await expect(drcPanel).toHaveAttribute('data-resize-axis', 'horizontal');

    await page.getByTestId('button-history').click();
    const historyPanel = page.getByTestId('history-panel');
    await expect(historyPanel).toBeVisible();
    await expect(historyPanel).toHaveAttribute('data-resizable', 'true');
    await expect(historyPanel).toHaveAttribute('data-resize-axis', 'horizontal');

    await page.screenshot({ path: screenshotPath('r58-component-editor-surface-status-laptop.png'), fullPage: true });
  });
});
