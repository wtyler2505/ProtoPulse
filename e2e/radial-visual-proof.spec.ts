import { expect, test, type Locator, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { getSetupProjectPath } from './e2e-project';

const VISUAL_PROOF_ENABLED = process.env.RADIAL_VISUAL_PROOF === '1';
const PROOF_DIR = path.resolve('docs/audit-screenshots/radial-command-layer-pass-33');

test.use({
  storageState: 'e2e/.auth-state.json',
  viewport: { width: 1366, height: 768 },
});
test.describe.configure({ mode: 'serial' });
test.skip(!VISUAL_PROOF_ENABLED, 'Set RADIAL_VISUAL_PROOF=1 to write durable radial screenshot proof.');
test.setTimeout(120_000);

const STABLE_SCREENSHOT_STYLE = `
  *, *::before, *::after {
    caret-color: transparent !important;
    transition-duration: 0s !important;
    animation-duration: 0s !important;
  }
  .animate-pulse,
  .animate-spin {
    animation: none !important;
  }
`;

const SCREENSHOT_OPTIONS = {
  animations: 'disabled' as const,
  caret: 'hide' as const,
  scale: 'css' as const,
};

type CaptureRow = {
  name: string;
  file: string;
  kind: 'page' | 'element';
  viewport: string;
  bytes: number;
  width?: number;
  height?: number;
  note: string;
};

function collectConsoleIssues(page: Page): string[] {
  const consoleIssues: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      consoleIssues.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => {
    consoleIssues.push(`pageerror: ${error.message}`);
  });
  return consoleIssues;
}

async function resetArchitectureGraph(page: Page): Promise<void> {
  await page.goto(getSetupProjectPath('architecture'));
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
    const [nodesResponse, edgesResponse] = await Promise.all([
      window.fetch(`/api/projects/${String(projectId)}/nodes`, { method: 'PUT', headers, body: '[]' }),
      window.fetch(`/api/projects/${String(projectId)}/edges`, { method: 'PUT', headers, body: '[]' }),
    ]);
    if (!nodesResponse.ok || !edgesResponse.ok) {
      throw new Error(
        `Could not reset architecture graph: nodes=${String(nodesResponse.status)} edges=${String(edgesResponse.status)}`,
      );
    }
    window.localStorage.removeItem('protopulse-radial-preferences-v1');
  });
  await page.reload();
  await page.addStyleTag({ content: STABLE_SCREENSHOT_STYLE });
}

async function hideOptionalPanels(page: Page): Promise<void> {
  const v3GateToggle = page.getByTestId('tool-v3-architecture-gate');
  if (
    await page
      .getByTestId('v3-architecture-readiness-panel')
      .isVisible()
      .catch(() => false)
  ) {
    await v3GateToggle.click({ force: true });
    await expect(page.getByTestId('v3-architecture-readiness-panel')).toBeHidden();
  }

  const assetLibraryHeading = page.getByRole('heading', { name: 'Asset Library' });
  if (await assetLibraryHeading.isVisible().catch(() => false)) {
    const desktopToggle = page.getByTestId('toggle-asset-manager');
    const mobileClose = page.getByRole('button', { name: 'Close asset library' });
    if (await desktopToggle.isVisible().catch(() => false)) {
      await desktopToggle.click();
    } else if (await mobileClose.isVisible().catch(() => false)) {
      await mobileClose.click();
    }
    await expect(assetLibraryHeading).toBeHidden();
  }
}

async function rightClickCenter(locator: Locator): Promise<void> {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  await locator.click({
    button: 'right',
    position: { x: (box?.width ?? 0) / 2, y: (box?.height ?? 0) / 2 },
  });
}

async function capturePage(
  page: Page,
  rows: CaptureRow[],
  name: string,
  viewport: string,
  note: string,
): Promise<void> {
  const file = `${name}.png`;
  const outputPath = path.join(PROOF_DIR, file);
  await page.screenshot({ ...SCREENSHOT_OPTIONS, path: outputPath });
  const stats = fs.statSync(outputPath);
  expect(stats.size, `${file} should not be empty`).toBeGreaterThan(2_000);
  rows.push({ name, file, kind: 'page', viewport, bytes: stats.size, note });
}

async function captureLocator(
  locator: Locator,
  rows: CaptureRow[],
  name: string,
  viewport: string,
  note: string,
): Promise<void> {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  const file = `${name}.png`;
  const outputPath = path.join(PROOF_DIR, file);
  await locator.screenshot({ ...SCREENSHOT_OPTIONS, path: outputPath });
  const stats = fs.statSync(outputPath);
  expect(stats.size, `${file} should not be empty`).toBeGreaterThan(1_000);
  rows.push({
    name,
    file,
    kind: 'element',
    viewport,
    bytes: stats.size,
    width: Math.round(box?.width ?? 0),
    height: Math.round(box?.height ?? 0),
    note,
  });
}

function writeManifest(rows: CaptureRow[]): void {
  const createdAt = new Date().toISOString();
  fs.writeFileSync(
    path.join(PROOF_DIR, 'SUMMARY.json'),
    JSON.stringify(
      {
        createdAt,
        status: 'ok',
        captureCount: rows.length,
        bytes: rows.reduce((sum, row) => sum + row.bytes, 0),
        rows,
      },
      null,
      2,
    ),
  );
  fs.writeFileSync(
    path.join(PROOF_DIR, 'MANIFEST.md'),
    [
      '# Radial Command Layer Visual Proof',
      '',
      `- created_at: ${createdAt}`,
      '- scope: radial-command-layer',
      '- status: ok',
      '',
      '| # | Viewport | Kind | Name | File | Bytes | Size | Note |',
      '|---:|---|---|---|---|---:|---|---|',
      ...rows.map((row, index) => {
        const size = row.width && row.height ? `${String(row.width)}x${String(row.height)}` : 'viewport';
        return `| ${String(index + 1)} | ${row.viewport} | ${row.kind} | ${row.name} | ${row.file} | ${String(row.bytes)} | ${size} | ${row.note} |`;
      }),
      '',
    ].join('\n'),
  );
}

test('captures radial menu visual proof states', async ({ page }) => {
  fs.rmSync(PROOF_DIR, { recursive: true, force: true });
  fs.mkdirSync(PROOF_DIR, { recursive: true });
  const rows: CaptureRow[] = [];
  const consoleIssues = collectConsoleIssues(page);

  await resetArchitectureGraph(page);
  const v3Panel = page.getByTestId('v3-architecture-readiness-panel');
  await expect(v3Panel).toBeVisible({ timeout: 30_000 });
  const v3CollapseButton = page.getByTestId('v3-architecture-gate-collapse');
  if ((await v3CollapseButton.getAttribute('aria-expanded')) === 'true') {
    await v3CollapseButton.click();
  }
  await expect(v3Panel).toHaveAttribute('data-collapsed', 'true');
  await captureLocator(
    v3Panel,
    rows,
    '01-desktop-v3-gate-collapsed',
    'desktop',
    'Collapsed v3 gate leaves the canvas reachable.',
  );

  await hideOptionalPanels(page);
  const canvas = page.getByTestId('react-flow');
  await expect(canvas).toBeVisible({ timeout: 30_000 });

  const canvasBox = await canvas.boundingBox();
  expect(canvasBox).not.toBeNull();
  const canvasClickX = (canvasBox?.x ?? 0) + Math.min(520, Math.max(24, (canvasBox?.width ?? 0) - 24));
  const canvasClickY = (canvasBox?.y ?? 0) + Math.min(300, Math.max(24, (canvasBox?.height ?? 0) - 24));

  await capturePage(page, rows, '02-desktop-architecture-canvas', 'desktop', 'Architecture canvas before radial open.');
  const radialMenu = page.getByTestId('radial-menu');
  await page.keyboard.press('Shift+F10');
  await expect(radialMenu).toBeVisible({ timeout: 2_500 });
  await captureLocator(
    radialMenu,
    rows,
    '03-desktop-keyboard-radial-menu',
    'desktop',
    'Canvas wheel opened from Shift+F10.',
  );
  await page.keyboard.press('Escape');
  await expect(radialMenu).toBeHidden();

  await page.mouse.click(canvasClickX, canvasClickY, { button: 'right' });
  await expect(radialMenu).toBeVisible({ timeout: 2_500 });
  await page.getByTestId('radial-item-ai_propose_connection').hover();
  await expect(page.getByTestId('radial-center-title')).toHaveText('AI Connect');
  await captureLocator(
    radialMenu,
    rows,
    '04-desktop-canvas-radial-menu',
    'desktop',
    'Canvas wheel with AI Connect hover preview.',
  );
  await capturePage(
    page,
    rows,
    '05-desktop-canvas-radial-context',
    'desktop',
    'Full workspace with radial wheel open.',
  );

  await page.keyboard.press('c');
  const customizer = page.getByTestId('radial-customizer');
  await expect(customizer).toBeVisible();
  await captureLocator(customizer, rows, '06-desktop-customizer-expanded', 'desktop', 'Desktop customizer expanded.');
  await expect(page.getByTestId('radial-customizer-command-search')).toBeFocused();
  await page.keyboard.type('Analyze');
  await expect(page.getByTestId('radial-customizer-command-count')).toHaveText(/1\/\d+/);
  await page.keyboard.down('Alt');
  await page.keyboard.press('4');
  await page.keyboard.up('Alt');
  await expect(page.getByTestId('radial-customizer-preview-item-analyze_architecture')).toHaveAttribute(
    'data-slot',
    '3',
  );
  await captureLocator(
    customizer,
    rows,
    '07-desktop-customizer-keyboard-filtered',
    'desktop',
    'Desktop customizer filtered and slot-assigned from keyboard.',
  );
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('radial-customizer-command-search')).toHaveValue('');
  await page.getByTestId('radial-customizer-close').click();
  await expect(customizer).toBeHidden();

  await page.mouse.click(canvasClickX, canvasClickY, { button: 'right' });
  await expect(radialMenu).toBeVisible({ timeout: 2_500 });
  await page.getByTestId('radial-item-add_node').click({ force: true });
  await expect(radialMenu).toBeHidden();
  const targetNode = canvas.locator('button[data-node-label="New Component"]').last();
  await expect(targetNode).toBeVisible();

  await hideOptionalPanels(page);
  await targetNode.focus();
  await expect(targetNode).toBeFocused();
  await page.keyboard.press('Shift+F10');
  await expect(radialMenu).toBeVisible({ timeout: 2_500 });
  await expect(page.getByTestId('radial-center-title')).toHaveText('New Component');
  await page.getByTestId('radial-item-ai_explain_architecture').hover();
  await expect(page.getByTestId('radial-center-title')).toHaveText('Explain');
  await captureLocator(
    radialMenu,
    rows,
    '08-desktop-focused-node-keyboard-radial-menu',
    'desktop',
    'Focused node wheel opened from Shift+F10 with AI Explain preview.',
  );
  await page.keyboard.press('8');
  await expect(radialMenu).toBeHidden();
  await expect(canvas.locator('button[data-node-label="New Component"]')).toHaveCount(2);
  await page.getByTestId('node-inspector-close').click();
  await expect(page.getByTestId('node-inspector-panel')).toBeHidden();

  await hideOptionalPanels(page);
  await rightClickCenter(targetNode);
  await expect(radialMenu).toBeVisible({ timeout: 2_500 });
  await page.getByTestId('radial-item-delete').click({ force: true });
  await expect(page.getByTestId('radial-center-title')).toHaveText('Confirm Delete');
  await captureLocator(radialMenu, rows, '09-desktop-delete-confirm', 'desktop', 'Destructive command confirm state.');
  await page.keyboard.press('Escape');
  await expect(radialMenu).toBeHidden();

  await hideOptionalPanels(page);
  await rightClickCenter(targetNode);
  await expect(radialMenu).toBeVisible({ timeout: 2_500 });
  const addBomResponse = page.waitForResponse(
    (response) => response.url().includes('/api/parts/ingress') && response.request().method() === 'POST',
  );
  await page.getByTestId('radial-item-add_to_bom').click({ force: true });
  await expect(radialMenu).toBeHidden();
  expect((await addBomResponse).ok()).toBeTruthy();

  const inspectorPanel = page.getByTestId('node-inspector-panel');
  await expect(inspectorPanel).toBeVisible();
  await rightClickCenter(page.getByTestId('node-inspector-title'));
  await expect(radialMenu).toBeVisible({ timeout: 2_500 });
  await capturePage(
    page,
    rows,
    '10-desktop-inspector-radial-launch',
    'desktop',
    'Inspector-targeted radial wheel while inspector remains open.',
  );

  await page.getByTestId('radial-item-delete').click({ force: true });
  await expect(page.getByTestId('radial-center-title')).toHaveText('Confirm Delete');
  await page.getByTestId('radial-item-delete').click({ force: true });
  await expect(radialMenu).toBeHidden();
  await expect(page.getByText('Delete complete', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Undo' })).toBeVisible();
  await capturePage(page, rows, '11-desktop-undo-toast', 'desktop', 'Undo toast after destructive radial delete.');
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(targetNode).toBeVisible();
  await capturePage(page, rows, '12-desktop-node-restored-after-undo', 'desktop', 'Deleted node restored from Undo.');

  await page.setViewportSize({ width: 360, height: 520 });
  await resetArchitectureGraph(page);
  await hideOptionalPanels(page);
  await expect(canvas).toBeVisible({ timeout: 30_000 });
  const compactCanvasBox = await canvas.boundingBox();
  expect(compactCanvasBox).not.toBeNull();
  const compactClickX = Math.min(348, (compactCanvasBox?.x ?? 0) + (compactCanvasBox?.width ?? 0) - 8);
  const compactClickY = Math.min(508, (compactCanvasBox?.y ?? 0) + (compactCanvasBox?.height ?? 0) - 8);
  await page.mouse.click(compactClickX, compactClickY, { button: 'right' });
  await expect(radialMenu).toBeVisible({ timeout: 2_500 });
  await captureLocator(
    radialMenu,
    rows,
    '13-compact-scaled-radial-menu',
    'compact',
    'Scaled wheel on compact viewport.',
  );
  await page.getByTestId('radial-customize').click();
  await expect(customizer).toBeVisible();
  await captureLocator(
    customizer,
    rows,
    '14-compact-customizer-expanded',
    'compact',
    'Compact customizer sheet expanded.',
  );
  await page.getByTestId('radial-customizer-collapse').click();
  await expect(customizer).toHaveAttribute('data-collapsed', 'true');
  await captureLocator(
    customizer,
    rows,
    '15-compact-customizer-collapsed',
    'compact',
    'Compact customizer collapsed strip.',
  );

  writeManifest(rows);
  expect(rows).toHaveLength(15);
  expect(consoleIssues).toEqual([]);
});
