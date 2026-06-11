import { expect, test, type Locator, type Page } from '@playwright/test';
import fs from 'node:fs';
import { getSetupProjectPath } from './e2e-project';

test.use({
  storageState: 'e2e/.auth-state.json',
  viewport: { width: 1366, height: 768 },
});
test.describe.configure({ mode: 'serial' });
test.setTimeout(180_000);

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
  await page.goto(getSetupProjectPath('architecture'), { waitUntil: 'commit', timeout: 60_000 });
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
  await page.reload({ waitUntil: 'commit', timeout: 60_000 });
}

async function waitForArchitectureCanvas(page: Page): Promise<Locator> {
  const canvas = page.getByTestId('react-flow');
  await expect(canvas).toBeVisible({ timeout: 90_000 });
  return canvas;
}

async function rightClickCenter(locator: Locator): Promise<void> {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  await locator.click({
    button: 'right',
    position: { x: (box?.width ?? 0) / 2, y: (box?.height ?? 0) / 2 },
  });
}

function screenshotPath(name: string): string {
  fs.mkdirSync('logs', { recursive: true });
  return `logs/${name}`;
}

test('radial command layer opens quickly and runs Architecture commands', async ({ page }) => {
  await resetArchitectureGraph(page);
  const consoleIssues = collectConsoleIssues(page);
  const canvas = await waitForArchitectureCanvas(page);
  const radialMenu = page.getByTestId('radial-menu');
  await page.evaluate(() => {
    const testWindow = window as typeof window & {
      __protopulseRadialTelemetry?: { events: Array<Record<string, unknown>> };
      __protopulseRadialCommands?: Array<Record<string, unknown>>;
    };
    testWindow.__protopulseRadialTelemetry = { events: [] };
    testWindow.__protopulseRadialCommands = [];
    window.addEventListener('protopulse:radial-command', (event) => {
      const detail = (event as CustomEvent).detail as {
        commandId?: string;
        context?: { view?: string; target?: string; targetId?: string; targetLabel?: string };
        handled?: boolean;
        undo?: { label?: string };
      };
      queueMicrotask(() => {
        testWindow.__protopulseRadialCommands?.push({
          commandId: detail.commandId,
          view: detail.context?.view,
          target: detail.context?.target,
          targetId: detail.context?.targetId,
          targetLabel: detail.context?.targetLabel,
          handled: detail.handled === true,
          undo: Boolean(detail.undo),
          undoLabel: detail.undo?.label,
        });
      });
    });
  });
  await expect(page.getByTestId('tool-select')).toBeVisible();
  const v3GateToggle = page.getByTestId('tool-v3-architecture-gate');
  if (
    await page
      .getByTestId('v3-architecture-readiness-panel')
      .isVisible()
      .catch(() => false)
  ) {
    await v3GateToggle.click();
    await expect(page.getByTestId('v3-architecture-readiness-panel')).toBeHidden();
  }
  const assetLibraryHeading = page.getByRole('heading', { name: 'Asset Library' });
  if (await assetLibraryHeading.isVisible().catch(() => false)) {
    await page.getByTestId('toggle-asset-manager').click();
    await expect(assetLibraryHeading).toBeHidden();
  }

  const startCount = Number(await canvas.getAttribute('data-node-count'));
  const canvasBox = await canvas.boundingBox();
  expect(canvasBox).not.toBeNull();
  const gestureX = (canvasBox?.x ?? 0) + 140;
  const gestureY = (canvasBox?.y ?? 0) + 180;
  const canvasClickX = (canvasBox?.x ?? 0) + Math.min(520, Math.max(24, (canvasBox?.width ?? 0) - 24));
  const canvasClickY = (canvasBox?.y ?? 0) + Math.min(300, Math.max(24, (canvasBox?.height ?? 0) - 24));

  await page.keyboard.press('Shift+F10');
  await expect(radialMenu).toBeVisible({ timeout: 2_500 });
  await expect(page.getByTestId('radial-center-title')).toHaveText('Canvas');
  await expect(radialMenu).toHaveAttribute('aria-keyshortcuts', /C/);
  const keyboardOpenTelemetry = await page.evaluate(() => {
    const testWindow = window as typeof window & {
      __protopulseRadialTelemetry?: { events: Array<Record<string, unknown>> };
    };
    return testWindow.__protopulseRadialTelemetry?.events ?? [];
  });
  expect(keyboardOpenTelemetry).toContainEqual(
    expect.objectContaining({
      name: 'keyboard-open',
      view: 'architecture',
      target: 'canvas',
    }),
  );
  await page.keyboard.press('Escape');
  await expect(radialMenu).toBeHidden();

  await page.mouse.move(gestureX, gestureY);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(gestureX, gestureY - 72, { steps: 4 });
  await expect(page.getByTestId('radial-marking-preview')).toBeVisible();
  await expect(page.getByTestId('radial-marking-label')).toHaveText('Add Node');
  await page.mouse.up({ button: 'right' });
  await expect(page.getByTestId('radial-marking-preview')).toBeHidden({ timeout: 500 });
  await expect(page.getByTestId('radial-menu')).toBeHidden({ timeout: 500 });
  await expect.poll(async () => Number(await canvas.getAttribute('data-node-count'))).toBeGreaterThan(startCount);
  const countAfterMarkingGesture = Number(await canvas.getAttribute('data-node-count'));
  const gestureTelemetry = await page.evaluate(() => {
    const testWindow = window as typeof window & {
      __protopulseRadialTelemetry?: { events: Array<Record<string, unknown>> };
    };
    return testWindow.__protopulseRadialTelemetry?.events ?? [];
  });
  expect(gestureTelemetry).toContainEqual(
    expect.objectContaining({
      name: 'mark-select',
      commandId: 'add_node',
      slot: 0,
      view: 'architecture',
      target: 'canvas',
    }),
  );

  await page.evaluate(() => {
    const testWindow = window as typeof window & {
      __radialOpenPerf?: { startedAt: number; openedAt?: number };
    };
    testWindow.__radialOpenPerf = { startedAt: 0 };
    document.addEventListener(
      'contextmenu',
      () => {
        testWindow.__radialOpenPerf = { startedAt: performance.now() };
      },
      { capture: true, once: true },
    );
    const observer = new MutationObserver(() => {
      if (document.querySelector('[data-testid="radial-menu"]')) {
        testWindow.__radialOpenPerf = {
          startedAt: testWindow.__radialOpenPerf?.startedAt ?? performance.now(),
          openedAt: performance.now(),
        };
        observer.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  });
  await page.mouse.click(canvasClickX, canvasClickY, { button: 'right' });
  await expect(radialMenu).toBeVisible({ timeout: 2_500 });
  const browserOpenLatency = await page.evaluate(() => {
    const testWindow = window as typeof window & {
      __radialOpenPerf?: { startedAt: number; openedAt?: number };
    };
    const perf = testWindow.__radialOpenPerf;
    return perf?.openedAt && perf.startedAt ? perf.openedAt - perf.startedAt : Number.POSITIVE_INFINITY;
  });
  expect(browserOpenLatency).toBeLessThan(500);
  const openTelemetry = await page.evaluate(() => {
    const testWindow = window as typeof window & {
      __protopulseRadialTelemetry?: { events: Array<Record<string, unknown>> };
    };
    return testWindow.__protopulseRadialTelemetry?.events ?? [];
  });
  expect(openTelemetry).toContainEqual(
    expect.objectContaining({
      name: 'visible-open',
      view: 'architecture',
      target: 'canvas',
    }),
  );
  const readMountedLatency = () =>
    page.evaluate(() => {
      const testWindow = window as typeof window & {
        __protopulseRadialTelemetry?: { events: Array<Record<string, unknown>> };
      };
      const mountedEvents = (testWindow.__protopulseRadialTelemetry?.events ?? []).filter(
        (event) =>
          event.name === 'visible-mounted' &&
          event.view === 'architecture' &&
          event.target === 'canvas' &&
          typeof event.durationMs === 'number',
      );
      return (mountedEvents.at(-1)?.durationMs as number | undefined) ?? null;
    });
  await expect.poll(readMountedLatency).not.toBeNull();
  const mountedLatency = await readMountedLatency();
  expect(mountedLatency).not.toBeNull();
  expect(mountedLatency as number).toBeLessThan(120);

  await expect(page.getByTestId('radial-label-add_node')).toContainText('Add Node');
  await expect(page.getByTestId('radial-shortcut-add_node')).toHaveText('1 / N');
  await expect(page.getByTestId('radial-item-add_node')).toHaveAttribute('aria-keyshortcuts', '1');
  await expect(page.getByTestId('radial-item-add_node').locator('title')).toHaveText('Add Node: press 1 or flick N');
  await expect(page.getByTestId('radial-label-generate_architecture')).toContainText('Generate');
  await expect(page.getByTestId('radial-label-ai_propose_connection')).toContainText('AI Connect');
  await expect(page.getByTestId('radial-label-analyze_architecture')).toContainText('Analyze');
  await radialMenu.screenshot({
    path: screenshotPath('radial-accelerator-memory-cues-pass62.png'),
  });
  await expect.poll(async () => (await radialMenu.boundingBox())?.width ?? 0).toBeGreaterThan(400);

  const beforeHoverBox = await radialMenu.boundingBox();
  await page.getByTestId('radial-item-analyze_architecture').hover();
  await expect(page.getByTestId('radial-center-title')).toHaveText('Analyze');
  await expect(page.getByTestId('radial-command-preview')).toBeVisible();
  await expect(page.getByTestId('radial-command-preview-label')).toHaveText('Analyze');
  const afterHoverBox = await radialMenu.boundingBox();
  expect(beforeHoverBox).not.toBeNull();
  expect(afterHoverBox).not.toBeNull();
  expect(Math.abs((afterHoverBox?.width ?? 0) - (beforeHoverBox?.width ?? 0))).toBeLessThan(1);
  expect(Math.abs((afterHoverBox?.height ?? 0) - (beforeHoverBox?.height ?? 0))).toBeLessThan(1);

  await page.keyboard.press('c');
  await expect(radialMenu).toBeHidden();
  await expect(page.getByTestId('radial-command-preview')).toBeHidden();
  const customizer = page.getByTestId('radial-customizer');
  await expect(customizer).toBeVisible();
  await expect(page.getByTestId('radial-customizer-preview-wheel')).toBeVisible();
  const commandSearch = page.getByTestId('radial-customizer-command-search');
  await expect(commandSearch).toBeFocused();
  const recentCommands = page.getByTestId('radial-customizer-recent-commands');
  await expect(recentCommands).toBeVisible();
  await expect(page.getByTestId('radial-customizer-recent-command-add_node')).toHaveAttribute(
    'data-command-id',
    'add_node',
  );
  await expect(page.getByTestId('radial-customizer-recent-command-add_node')).toHaveAttribute('data-count', '1');
  await expect(page.getByTestId('radial-customizer-recent-command-add_node')).toHaveAttribute('data-direction', 'N');
  await page.getByTestId('radial-customizer-recent-command-add_node').click();
  await expect(page.getByTestId('radial-customizer-preview-title')).toHaveText('Add Node');
  await recentCommands.screenshot({
    path: screenshotPath('radial-recent-commands-pass88.png'),
  });
  await commandSearch.click();
  await expect(commandSearch).toBeFocused();
  await page.keyboard.type('Analyze');
  await expect(page.getByTestId('radial-customizer-command-count')).toHaveText(/1\/\d+/);
  await expect(page.getByTestId('radial-customizer-row-analyze_architecture')).toBeVisible();
  await expect(page.getByTestId('radial-customizer-row-add_node')).toBeHidden();
  await expect(page.getByTestId('radial-customizer-preview-title')).toHaveText('Analyze');
  await page.keyboard.down('Alt');
  await page.keyboard.press('4');
  await page.keyboard.up('Alt');
  await expect(page.getByTestId('radial-customizer-preview-item-analyze_architecture')).toHaveAttribute(
    'data-slot',
    '3',
  );
  await page.keyboard.press('Escape');
  await expect(commandSearch).toHaveValue('');
  await expect(page.getByTestId('radial-customizer-row-add_node')).toBeVisible();
  await page.getByTestId('radial-customizer-slot-add_node-2').click();
  await expect(page.getByTestId('radial-customizer-slot-add_node-2')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('radial-customizer-preview-item-add_node')).toHaveAttribute('data-slot', '2');
  await expect(page.getByTestId('radial-customizer-draft-status')).toContainText('unsaved');
  await page.getByTestId('radial-customizer-preset-toggle').click();
  await page.getByTestId('radial-customizer-preset-name').fill('Fast build');
  await page.getByTestId('radial-customizer-preset-save').click();
  await expect(page.getByTestId('radial-customizer-preset-status')).toHaveText('Fast build saved');
  await expect(page.getByTestId('radial-customizer-pinned-preset')).toHaveAttribute('data-pinned', 'false');
  await expect(page.getByTestId('radial-customizer-preset-recommendation')).toContainText(
    'Suggested: Fast build for Architecture / Canvas.',
  );
  await page.getByTestId('radial-customizer-preset-recommendation').click();
  await expect(page.getByTestId('radial-customizer-preset-status')).toHaveText('Fast build pinned to this context');
  await expect(page.getByTestId('radial-customizer-pinned-preset')).toHaveAttribute('data-pinned', 'true');
  await expect(page.getByTestId('radial-customizer-pinned-preset')).toContainText(
    'Fast build pinned to Architecture / Canvas.',
  );
  await expect(page.getByTestId('radial-customizer-preset-recommendation')).toBeHidden();
  await customizer.screenshot({
    path: screenshotPath('radial-pinned-preset-pass86.png'),
  });
  await page.getByTestId('radial-customizer-collapse').click();
  await expect(customizer).toHaveAttribute('data-collapsed', 'true');
  await expect(page.getByTestId('radial-customizer-collapsed-pinned-preset')).toHaveText('Fast build');
  await expect(page.getByTestId('radial-customizer-collapsed-pinned-preset')).toHaveAttribute('data-pinned', 'true');
  await expect(page.getByTestId('radial-customizer-collapsed-pinned-preset')).toHaveAttribute(
    'aria-label',
    'Open pinned preset: Fast build',
  );
  await customizer.screenshot({
    path: screenshotPath('radial-collapsed-pinned-preset-pass87.png'),
  });
  await page.getByTestId('radial-customizer-collapsed-pinned-preset').press('Enter');
  await expect(customizer).toHaveAttribute('data-collapsed', 'false');
  await expect(page.getByTestId('radial-customizer-preset-panel')).toBeVisible();
  await page.getByTestId('radial-customizer-close').click();
  await expect(customizer).toBeHidden();

  await page.mouse.click(canvasClickX, canvasClickY, { button: 'right' });
  await expect(radialMenu).toBeVisible({ timeout: 2_500 });
  await expect(page.getByTestId('radial-item-add_node')).toHaveAttribute('data-slot', '2');
  await expect(page.getByTestId('radial-shortcut-add_node')).toHaveText('3 / E');
  await expect(page.getByTestId('radial-item-add_node')).toHaveAttribute('aria-keyshortcuts', '3');

  await page.getByTestId('radial-customize').click();
  await expect(customizer).toBeVisible();
  await page.getByTestId('radial-customizer-preset-toggle').click();
  await expect(page.getByTestId('radial-customizer-pinned-preset')).toHaveAttribute('data-pinned', 'true');
  await page.getByTestId('radial-customizer-slot-add_node-4').click();
  await expect(page.getByTestId('radial-customizer-preview-item-add_node')).toHaveAttribute('data-slot', '4');
  await page.getByTestId('radial-customizer-apply').click();
  await expect(page.getByTestId('radial-customizer-pinned-preset')).toHaveAttribute('data-pinned', 'false');
  await page.getByTestId('radial-customizer-close').click();
  await expect(customizer).toBeHidden();

  await page.mouse.click(canvasClickX, canvasClickY, { button: 'right' });
  await expect(radialMenu).toBeVisible({ timeout: 2_500 });
  await expect(page.getByTestId('radial-item-add_node')).toHaveAttribute('data-slot', '4');
  await expect(page.getByTestId('radial-shortcut-add_node')).toHaveText('5 / S');
  await page.getByTestId('radial-customize').click();
  await page.getByTestId('radial-customizer-reset').click();
  await page.getByTestId('radial-customizer-close').click();
  await expect(customizer).toBeHidden();

  await page.mouse.click(canvasClickX, canvasClickY, { button: 'right' });
  await expect(radialMenu).toBeVisible({ timeout: 2_500 });
  await expect(page.getByTestId('radial-item-add_node')).toHaveAttribute('data-slot', '0');
  await expect(page.getByTestId('radial-shortcut-add_node')).toHaveText('1 / N');
  await page.getByTestId('radial-item-add_node').click({ force: true });
  await expect(radialMenu).toBeHidden();
  await expect
    .poll(async () => Number(await canvas.getAttribute('data-node-count')))
    .toBeGreaterThan(countAfterMarkingGesture);
  const newNode = canvas.locator('button[data-node-label="New Component"]').last();
  await expect(newNode).toBeVisible();
  const newNodeId = await newNode.getAttribute('data-id');
  expect(newNodeId).not.toBeNull();
  const targetNode = canvas.locator(`button[data-id="${newNodeId ?? ''}"]`);
  await expect(targetNode).toBeVisible();

  const nodeCountBeforeKeyboardDuplicate = Number(await canvas.getAttribute('data-node-count'));
  await targetNode.focus();
  await expect(targetNode).toBeFocused();
  await page.keyboard.press('Shift+F10');
  await expect(radialMenu).toBeVisible({ timeout: 2_500 });
  await expect(page.getByTestId('radial-center-title')).toHaveText('New Component');
  await expect(page.getByTestId('radial-label-ai_explain_architecture')).toContainText('Explain');
  await page.keyboard.press('8');
  await expect(radialMenu).toBeHidden();
  await expect
    .poll(async () => Number(await canvas.getAttribute('data-node-count')))
    .toBe(nodeCountBeforeKeyboardDuplicate + 1);
  const keyboardDuplicateTelemetry = await page.evaluate(() => {
    const testWindow = window as typeof window & {
      __protopulseRadialCommands?: Array<Record<string, unknown>>;
    };
    return testWindow.__protopulseRadialCommands?.filter((event) => event.commandId === 'duplicate').at(-1) ?? null;
  });
  expect(keyboardDuplicateTelemetry).toMatchObject({
    commandId: 'duplicate',
    view: 'architecture',
    target: 'node',
    targetLabel: 'New Component',
    handled: true,
  });
  await page.getByTestId('node-inspector-close').click();
  await expect(page.getByTestId('node-inspector-panel')).toBeHidden();

  await v3GateToggle.click();
  const v3Panel = page.getByTestId('v3-architecture-readiness-panel');
  await expect(v3Panel).toBeVisible();
  const expandedGateHeight = (await v3Panel.boundingBox())?.height ?? 0;
  const v3CollapseButton = page.getByTestId('v3-architecture-gate-collapse');
  await expect(v3CollapseButton).toHaveAttribute('aria-expanded', 'true');
  await v3CollapseButton.click();
  await expect(v3Panel).toHaveAttribute('data-collapsed', 'true');
  await expect(v3CollapseButton).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByTestId('v3-architecture-gate-summary')).toContainText('nodes');
  const collapsedGateHeight = (await v3Panel.boundingBox())?.height ?? Number.POSITIVE_INFINITY;
  expect(collapsedGateHeight).toBeLessThan(expandedGateHeight);

  await rightClickCenter(targetNode);
  await expect(radialMenu).toBeVisible({ timeout: 2_500 });
  await expect(page.getByTestId('radial-center-title')).toHaveText('New Component');
  await page.keyboard.press('Escape');
  await expect(radialMenu).toBeHidden();
  await v3GateToggle.click();
  await expect(v3Panel).toBeHidden();

  const newNodeBox = await targetNode.boundingBox();
  expect(newNodeBox).not.toBeNull();
  const nodeGestureX = (newNodeBox?.x ?? 0) + (newNodeBox?.width ?? 0) / 2;
  const nodeGestureY = (newNodeBox?.y ?? 0) + (newNodeBox?.height ?? 0) / 2;
  await page.mouse.move(nodeGestureX, nodeGestureY);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(nodeGestureX - 72, nodeGestureY + 72, { steps: 4 });
  await expect(page.getByTestId('radial-marking-preview')).toBeVisible();
  await expect(page.getByTestId('radial-marking-label')).toHaveText('Delete');
  await page.mouse.up({ button: 'right' });
  await expect(radialMenu).toBeVisible({ timeout: 2_500 });
  await expect(page.getByTestId('radial-center-title')).toHaveText('Confirm Delete');
  await expect(page.getByTestId('radial-confirm-state')).toHaveText('Confirm');
  await expect(targetNode).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(radialMenu).toBeHidden();

  await rightClickCenter(targetNode);
  await expect(radialMenu).toBeVisible({ timeout: 2_500 });
  await expect(page.getByTestId('radial-center-title')).toHaveText('New Component');
  await expect(page.getByTestId('radial-label-add_to_bom')).toContainText('Add BOM');

  await page.getByTestId('radial-item-delete').click({ force: true });
  await expect(radialMenu).toBeVisible();
  await expect(page.getByTestId('radial-center-title')).toHaveText('Confirm Delete');
  await expect(page.getByTestId('radial-confirm-state')).toHaveText('Confirm');
  await expect(targetNode).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(radialMenu).toBeHidden();

  await rightClickCenter(targetNode);
  await expect(radialMenu).toBeVisible({ timeout: 2_500 });
  await expect(page.getByTestId('radial-center-title')).toHaveText('New Component');

  const addBomResponse = page.waitForResponse(
    (response) => response.url().includes('/api/parts/ingress') && response.request().method() === 'POST',
  );
  await page.getByTestId('radial-item-add_to_bom').click({ force: true });
  await expect(radialMenu).toBeHidden();
  expect((await addBomResponse).ok()).toBeTruthy();
  const inspectorPanel = page.getByTestId('node-inspector-panel');
  await expect(inspectorPanel).toBeVisible();
  await expect(inspectorPanel).toHaveAttribute('data-nodeid', newNodeId ?? '');
  await expect(inspectorPanel).toHaveAttribute('data-node-label', 'New Component');

  const nodeCountBeforeUndoDelete = Number(await canvas.getAttribute('data-node-count'));
  await rightClickCenter(page.getByTestId('node-inspector-title'));
  await expect(radialMenu).toBeVisible({ timeout: 2_500 });
  await expect(page.getByTestId('radial-center-title')).toHaveText('New Component');
  await page.getByTestId('radial-item-delete').click({ force: true });
  await expect(page.getByTestId('radial-center-title')).toHaveText('Confirm Delete');
  await page.getByTestId('radial-item-delete').click({ force: true });
  await expect(radialMenu).toBeHidden();
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const testWindow = window as typeof window & {
          __protopulseRadialCommands?: Array<Record<string, unknown>>;
        };
        return testWindow.__protopulseRadialCommands?.filter((event) => event.commandId === 'delete').at(-1) ?? null;
      }),
    )
    .toMatchObject({
      commandId: 'delete',
      view: 'architecture',
      target: 'node',
      targetLabel: 'New Component',
      handled: true,
      undo: true,
    });
  await expect(targetNode).toBeHidden();
  await expect(inspectorPanel).toBeHidden();
  await expect
    .poll(async () => Number(await canvas.getAttribute('data-node-count')))
    .toBe(nodeCountBeforeUndoDelete - 1);
  await expect(page.getByText('Delete complete', { exact: true })).toBeVisible();
  const undoToastAction = page.getByRole('button', { name: 'Undo', exact: true });
  await expect(undoToastAction).toBeVisible();
  await undoToastAction.click();
  await expect(targetNode).toBeVisible();
  await expect.poll(async () => Number(await canvas.getAttribute('data-node-count'))).toBe(nodeCountBeforeUndoDelete);
  await expect(consoleIssues).toEqual([]);
});

test('radial practice clean milestone stays session-only', async ({ page }) => {
  await resetArchitectureGraph(page);
  const consoleIssues = collectConsoleIssues(page);
  const canvas = await waitForArchitectureCanvas(page);
  const radialMenu = page.getByTestId('radial-menu');
  await expect(page.getByTestId('tool-select')).toBeVisible();
  const v3GateToggle = page.getByTestId('tool-v3-architecture-gate');
  if (
    await page
      .getByTestId('v3-architecture-readiness-panel')
      .isVisible()
      .catch(() => false)
  ) {
    await v3GateToggle.click();
    await expect(page.getByTestId('v3-architecture-readiness-panel')).toBeHidden();
  }
  const assetLibraryHeading = page.getByRole('heading', { name: 'Asset Library' });
  if (await assetLibraryHeading.isVisible().catch(() => false)) {
    await page.getByTestId('toggle-asset-manager').click();
    await expect(assetLibraryHeading).toBeHidden();
  }

  await page.evaluate(() => {
    const testWindow = window as typeof window & {
      __protopulseRadialTelemetry?: { events: Array<Record<string, unknown>> };
    };
    const trainedCommands = [
      ['add_node', 0],
      ['generate_architecture', 1],
      ['ai_propose_connection', 2],
      ['analyze_architecture', 4],
      ['select_all', 6],
    ] as const;
    testWindow.__protopulseRadialTelemetry = {
      events: trainedCommands.flatMap(([commandId, slot]) =>
        Array.from({ length: 3 }, (_, index) => ({
          name: 'mark-select' as const,
          timestamp: performance.now() + index,
          view: 'architecture' as const,
          target: 'canvas' as const,
          commandId,
          slot,
          durationMs: 34 + index,
        })),
      ),
    };
    window.dispatchEvent(new CustomEvent('protopulse:radial-telemetry'));
  });

  const nodeCountBeforePractice = Number(await canvas.getAttribute('data-node-count'));
  await page.keyboard.press('Shift+F10');
  await expect(radialMenu).toBeVisible({ timeout: 2_500 });
  await page.getByTestId('radial-customize').click();
  const practiceLane = page.getByTestId('radial-customizer-practice-lane');
  await expect(practiceLane).toBeVisible({ timeout: 2_500 });
  await expect(page.getByTestId('radial-customizer-mastery-filter-count-trained')).toHaveText('5');
  await expect(page.getByTestId('radial-customizer-mastery-filter-count-cold')).toHaveText('3');
  const practiceQueue = page.getByTestId('radial-customizer-practice-queue');
  const practicePad = page.getByTestId('radial-customizer-practice-pad');
  const customizer = page.getByTestId('radial-customizer');
  await page.getByTestId('radial-customizer-collapse').click();
  await expect(customizer).toHaveAttribute('data-collapsed', 'true');
  await expect(page.getByTestId('radial-customizer-collapsed-practice')).toHaveAttribute('data-state', 'idle');
  await expect(page.getByTestId('radial-customizer-collapsed-practice')).toHaveAttribute('data-progress', '0/3');
  await expect(page.getByTestId('radial-customizer-collapsed-practice')).toHaveAttribute('data-progress-percent', '0');
  await expect(page.getByTestId('radial-customizer-collapsed-practice')).toHaveAttribute('data-cue', 'practice');
  await expect(page.getByTestId('radial-customizer-collapsed-practice')).toHaveAttribute(
    'data-reset-available',
    'false',
  );
  await expect(page.getByTestId('radial-customizer-collapsed-practice')).toHaveAttribute('data-reset-hint', '');
  await expect(page.getByTestId('radial-customizer-collapsed-practice-status')).toHaveAttribute('role', 'status');
  await expect(page.getByTestId('radial-customizer-collapsed-practice-status')).toHaveAttribute('aria-live', 'polite');
  await expect(page.getByTestId('radial-customizer-collapsed-practice-status')).toHaveText(
    'Practice status: 0/3 local practice coverage.',
  );
  await expect(page.getByTestId('radial-customizer-collapsed-idle')).toHaveText('Practice 0/3');
  await expect(page.getByTestId('radial-customizer-collapsed-idle')).toHaveAttribute('data-progress-percent', '0');
  await expect(page.getByTestId('radial-customizer-collapsed-idle')).toHaveAttribute('data-cue', 'practice');
  await expect(page.getByTestId('radial-customizer-collapsed-idle')).toHaveAttribute('role', 'button');
  await expect(page.getByTestId('radial-customizer-collapsed-idle')).toHaveAttribute('data-quick-open', 'practice-pad');
  await expect(page.getByTestId('radial-customizer-collapsed-idle')).toHaveAttribute('data-quick-open-mode', 'focus');
  await expect(page.getByTestId('radial-customizer-collapsed-idle')).toHaveAttribute(
    'data-action-hint',
    'Enter/Space opens practice.',
  );
  await expect(page.getByTestId('radial-customizer-collapsed-idle')).toHaveAttribute(
    'aria-keyshortcuts',
    'Enter Space',
  );
  await expect(page.getByTestId('radial-customizer-collapsed-idle')).toHaveAttribute(
    'style',
    /--collapsed-practice-progress:\s*0%/,
  );
  await expect(page.getByTestId('radial-customizer-collapsed-idle')).toHaveAccessibleDescription(
    'Practice status: 0/3 local practice coverage.',
  );
  await customizer.screenshot({
    path: screenshotPath('radial-collapsed-practice-idle-pass75.png'),
  });
  await page.getByTestId('radial-customizer-collapsed-idle').focus();
  await expect(page.getByTestId('radial-customizer-collapsed-practice-help').first()).toBeVisible();
  await expect(page.getByTestId('radial-customizer-collapsed-practice-help').first()).toContainText(
    '0/3 practice coverage. Expand practice to drill the remaining cold gestures.',
  );
  await expect(page.getByTestId('radial-customizer-collapsed-practice-hint').first()).toHaveText(
    'Enter/Space opens practice.',
  );
  await page.getByTestId('radial-customizer-collapsed-idle').press('Enter');
  await expect(customizer).toHaveAttribute('data-collapsed', 'false');
  await expect(practiceLane).toBeVisible();
  await expect(practicePad).toBeFocused();
  const telemetryCountBeforePractice = await page.evaluate(() => {
    const testWindow = window as typeof window & {
      __protopulseRadialTelemetry?: { events: Array<Record<string, unknown>> };
    };
    return testWindow.__protopulseRadialTelemetry?.events.length ?? 0;
  });
  await practiceQueue.click();
  await expect(practiceQueue).toHaveAttribute('data-active', 'true');
  await expect(page.getByTestId('radial-customizer-practice-label')).toHaveText('Fit');
  await expect(page.getByTestId('radial-customizer-practice-target')).toHaveText('SE');
  await expect(practicePad).toBeFocused();
  await page.keyboard.press('4');
  await expect(page.getByTestId('radial-customizer-practice-label')).toHaveText('Validate');
  await expect(page.getByTestId('radial-customizer-practice-target')).toHaveText('SW');
  await expect(page.getByTestId('radial-customizer-practice-queue-status')).toHaveText('Queue 1/3 - Next SW');
  await page.keyboard.press('6');
  await expect(page.getByTestId('radial-customizer-practice-label')).toHaveText('Paste');
  await expect(page.getByTestId('radial-customizer-practice-target')).toHaveText('NW');
  await expect(page.getByTestId('radial-customizer-practice-queue-status')).toHaveText('Queue 2/3 - Next NW');
  await page.keyboard.press('8');
  await expect(practiceQueue).toHaveAttribute('data-progress', '3/3');
  await expect(page.getByTestId('radial-customizer-practice-queue-status')).toHaveText('Queue 3/3 - Queue done');
  await expect(page.getByTestId('radial-customizer-practice-recap')).toHaveAttribute('data-hits', '3');
  await expect(page.getByTestId('radial-customizer-practice-recap')).toHaveAttribute('data-attempts', '3');
  await expect(page.getByTestId('radial-customizer-practice-recap')).toHaveAttribute('data-weak', '0');
  await expect(page.getByTestId('radial-customizer-practice-milestone')).toHaveAttribute('data-clean', 'true');
  await expect(page.getByTestId('radial-customizer-practice-milestone')).toHaveAttribute('data-attempts', '3');
  await expect(page.getByTestId('radial-customizer-practice-milestone')).toHaveText('Clean run');
  await expect(page.getByTestId('radial-customizer-practice-recap-hits')).toHaveText('3/3 hits');
  await expect.poll(async () => Number(await canvas.getAttribute('data-node-count'))).toBe(nodeCountBeforePractice);
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const testWindow = window as typeof window & {
          __protopulseRadialTelemetry?: { events: Array<Record<string, unknown>> };
        };
        return testWindow.__protopulseRadialTelemetry?.events.length ?? 0;
      }),
    )
    .toBe(telemetryCountBeforePractice);
  await practiceLane.screenshot({
    path: screenshotPath('radial-practice-clean-milestone-pass73.png'),
  });
  await page.getByTestId('radial-customizer-collapse').click();
  await expect(page.getByTestId('radial-customizer')).toHaveAttribute('data-collapsed', 'true');
  await expect(page.getByTestId('radial-customizer-collapsed-practice')).toHaveAttribute('data-state', 'clean');
  await expect(page.getByTestId('radial-customizer-collapsed-practice')).toHaveAttribute(
    'data-priority',
    'clean replay idle',
  );
  await expect(page.getByTestId('radial-customizer-collapsed-practice')).toHaveAttribute('data-progress', '3/3');
  await expect(page.getByTestId('radial-customizer-collapsed-practice')).toHaveAttribute(
    'data-progress-percent',
    '100',
  );
  await expect(page.getByTestId('radial-customizer-collapsed-practice')).toHaveAttribute('data-cue', 'complete');
  await expect(page.getByTestId('radial-customizer-collapsed-practice')).toHaveAttribute('data-replay-count', '0');
  await expect(page.getByTestId('radial-customizer-collapsed-practice')).toHaveAttribute(
    'data-reset-available',
    'true',
  );
  await expect(page.getByTestId('radial-customizer-collapsed-practice')).toHaveAttribute(
    'data-reset-hint',
    'Shift+Backspace clears local practice.',
  );
  await expect(page.getByTestId('radial-customizer-collapsed-practice-status')).toHaveText(
    'Practice status: clean local run, 3/3 hits.',
  );
  await expect(page.getByTestId('radial-customizer-collapsed-clean')).toHaveText('Clean run');
  await expect(page.getByTestId('radial-customizer-collapsed-clean')).toHaveAttribute('data-clean', 'true');
  await expect(page.getByTestId('radial-customizer-collapsed-clean')).toHaveAttribute('data-attempts', '3');
  await expect(page.getByTestId('radial-customizer-collapsed-clean')).toHaveAttribute('data-progress-percent', '100');
  await expect(page.getByTestId('radial-customizer-collapsed-clean')).toHaveAttribute('data-cue', 'complete');
  await expect(page.getByTestId('radial-customizer-collapsed-clean')).toHaveAttribute(
    'style',
    /--collapsed-practice-progress:\s*100%/,
  );
  await expect(page.getByTestId('radial-customizer-collapsed-clean')).toHaveAccessibleDescription(
    'Practice status: clean local run, 3/3 hits.',
  );
  await page.getByTestId('radial-customizer').screenshot({
    path: screenshotPath('radial-collapsed-practice-clean-pass75.png'),
  });
  await page.getByTestId('radial-customizer').screenshot({
    path: screenshotPath('radial-collapsed-practice-a11y-pass76.png'),
  });
  await page.getByTestId('radial-customizer').screenshot({
    path: screenshotPath('radial-collapsed-practice-cue-pass78.png'),
  });
  await page.getByTestId('radial-customizer-collapsed-clean').focus();
  await expect(page.getByTestId('radial-customizer-collapsed-clean')).toHaveAttribute('role', 'button');
  await expect(page.getByTestId('radial-customizer-collapsed-clean')).toHaveAttribute(
    'data-quick-open',
    'practice-pad',
  );
  await expect(page.getByTestId('radial-customizer-collapsed-clean')).toHaveAttribute('data-quick-open-mode', 'focus');
  await expect(page.getByTestId('radial-customizer-collapsed-clean')).toHaveAttribute('data-reset-available', 'true');
  await expect(page.getByTestId('radial-customizer-collapsed-clean')).toHaveAttribute(
    'data-reset-hint',
    'Shift+Backspace clears local practice.',
  );
  await expect(page.getByTestId('radial-customizer-collapsed-clean')).toHaveAttribute(
    'aria-keyshortcuts',
    'Enter Space Shift+Backspace',
  );
  await expect(page.getByTestId('radial-customizer-collapsed-clean')).toHaveAttribute(
    'data-action-hint',
    'Enter/Space opens practice.',
  );
  await expect(page.getByTestId('radial-customizer-collapsed-practice-help').first()).toBeVisible();
  await expect(page.getByTestId('radial-customizer-collapsed-practice-help').first()).toContainText(
    'Clean practice run. Every local target was hit, so replay is clear.',
  );
  await expect(page.getByTestId('radial-customizer-collapsed-practice-reset-hint').first()).toHaveText(
    'Shift+Backspace clears local practice.',
  );
  await expect(page.getByTestId('radial-customizer-collapsed-practice-hint').first()).toHaveText(
    'Enter/Space opens practice.',
  );
  await page.screenshot({
    path: screenshotPath('radial-collapsed-practice-help-pass77.png'),
  });
  await page.getByTestId('radial-customizer-collapsed-clean').press('Shift+Backspace');
  await expect(page.getByTestId('radial-customizer-collapsed-practice')).toHaveAttribute('data-state', 'idle');
  await expect(page.getByTestId('radial-customizer-collapsed-practice')).toHaveAttribute('data-progress', '0/3');
  await expect(page.getByTestId('radial-customizer-collapsed-practice')).toHaveAttribute(
    'data-reset-available',
    'false',
  );
  await expect(page.getByTestId('radial-customizer-collapsed-practice')).toHaveAttribute('data-reset-hint', '');
  await expect(page.getByTestId('radial-customizer-collapsed-practice-status')).toHaveText(
    'Practice status: 0/3 local practice coverage.',
  );
  await expect(page.getByTestId('radial-customizer-collapsed-idle')).toHaveText('Practice 0/3');
  await expect(page.getByTestId('radial-customizer-collapsed-idle')).toHaveAttribute(
    'aria-keyshortcuts',
    'Enter Space',
  );
  await expect(page.getByTestId('radial-customizer-collapsed-idle')).toHaveAccessibleDescription(
    'Practice status: 0/3 local practice coverage.',
  );
  await expect.poll(async () => Number(await canvas.getAttribute('data-node-count'))).toBe(nodeCountBeforePractice);
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const testWindow = window as typeof window & {
          __protopulseRadialTelemetry?: { events: Array<Record<string, unknown>> };
        };
        return testWindow.__protopulseRadialTelemetry?.events.length ?? 0;
      }),
    )
    .toBe(telemetryCountBeforePractice);
  await page.getByTestId('radial-customizer').screenshot({
    path: screenshotPath('radial-collapsed-practice-reset-pass85.png'),
  });
  await page.getByTestId('radial-customizer-collapsed-idle').press('Enter');
  await expect(customizer).toHaveAttribute('data-collapsed', 'false');
  await expect(practiceLane).toBeVisible();
  await expect(practicePad).toBeFocused();
  await expect(consoleIssues).toEqual([]);
});

test('radial AI architecture command drafts, sends, and reports telemetry', async ({ page }) => {
  await resetArchitectureGraph(page);
  const consoleIssues = collectConsoleIssues(page);
  await page.route(/\/api\/chat\/ai(?:\/openai)?\/stream$/, async (route) => {
    await route.fulfill({
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
      body: [
        'data: {"type":"text","text":"Radial AI proof reply."}',
        '',
        'data: {"type":"done","message":"Radial AI proof reply.","actions":[],"toolCalls":[]}',
        '',
      ].join('\n'),
    });
  });
  await page.evaluate(() => {
    const testWindow = window as typeof window & {
      __protopulseChatProof?: Array<{
        type: 'open' | 'draft' | 'send';
        message?: string;
        designAgent?: boolean;
        delivery?: string;
      }>;
      __protopulseRadialTelemetry?: { events: Array<Record<string, unknown>> };
    };
    testWindow.__protopulseChatProof = [];
    testWindow.__protopulseRadialTelemetry = { events: [] };
    window.addEventListener('protopulse:open-chat-panel', (event) => {
      const detail = (event as CustomEvent<{ designAgent?: boolean }>).detail;
      testWindow.__protopulseChatProof?.push({ type: 'open', designAgent: detail?.designAgent });
    });
    window.addEventListener('protopulse:chat-draft', (event) => {
      const detail = (event as CustomEvent<{ message?: string; delivery?: string }>).detail;
      testWindow.__protopulseChatProof?.push({
        type: 'draft',
        message: detail?.message,
        delivery: detail?.delivery,
      });
    });
    window.addEventListener('protopulse:chat-send', (event) => {
      const detail = (event as CustomEvent<{ message?: string; delivery?: string }>).detail;
      testWindow.__protopulseChatProof?.push({
        type: 'send',
        message: detail?.message,
        delivery: detail?.delivery,
      });
    });
  });

  const canvas = await waitForArchitectureCanvas(page);
  const v3GateToggle = page.getByTestId('tool-v3-architecture-gate');
  if (
    await page
      .getByTestId('v3-architecture-readiness-panel')
      .isVisible()
      .catch(() => false)
  ) {
    await v3GateToggle.click();
    await expect(page.getByTestId('v3-architecture-readiness-panel')).toBeHidden();
  }
  const assetLibraryHeading = page.getByRole('heading', { name: 'Asset Library' });
  if (await assetLibraryHeading.isVisible().catch(() => false)) {
    await page.getByTestId('toggle-asset-manager').click();
    await expect(assetLibraryHeading).toBeHidden();
  }
  const canvasBox = await canvas.boundingBox();
  expect(canvasBox).not.toBeNull();
  const canvasClickX = (canvasBox?.x ?? 0) + Math.min(520, Math.max(24, (canvasBox?.width ?? 0) - 24));
  const canvasClickY = (canvasBox?.y ?? 0) + Math.min(300, Math.max(24, (canvasBox?.height ?? 0) - 24));
  await page.mouse.click(canvasClickX, canvasClickY, { button: 'right' });
  const radialMenu = page.getByTestId('radial-menu');
  await expect(radialMenu).toBeVisible({ timeout: 2_500 });
  await page.keyboard.press('1');
  await expect(radialMenu).toBeHidden();
  await expect.poll(async () => Number(await canvas.getAttribute('data-node-count'))).toBeGreaterThan(0);

  const targetNode = canvas.locator('button[data-node-label="New Component"]').last();
  await expect(targetNode).toBeVisible();
  await rightClickCenter(targetNode);

  await expect(radialMenu).toBeVisible({ timeout: 2_500 });
  await expect(page.getByTestId('radial-center-title')).toHaveText('New Component');
  await expect(page.getByTestId('radial-label-ai_explain_architecture')).toContainText('Explain');
  await page.getByTestId('radial-item-ai_explain_architecture').hover();
  await expect(page.getByTestId('radial-command-preview-ai-badge')).toHaveText('AI');
  await expect(page.getByTestId('radial-command-preview-detail')).toHaveText(
    'Explains architecture intent, tradeoffs, and missing links.',
  );
  await expect(page.getByTestId('radial-command-preview-ai-scope')).toHaveText('Architecture / New Component');
  await expect(page.getByTestId('radial-command-preview-ai-bound')).toHaveText('Architecture explanation prompt');
  await expect(page.getByTestId('radial-command-preview-ai-hint')).toHaveText('Click drafts / Shift-click sends');
  await page.getByTestId('radial-command-preview-chip').screenshot({
    path: screenshotPath('radial-ai-preview-chip-pass50.png'),
  });
  await page.keyboard.press('4');
  await expect(radialMenu).toBeHidden();
  await expect(page.getByTestId('chat-tab-chat')).toBeVisible({ timeout: 2_500 });
  const apiKeySetupDialog = page.getByTestId('api-key-setup-dialog');
  if (await apiKeySetupDialog.isVisible().catch(() => false)) {
    await page.keyboard.press('Escape');
    if (await apiKeySetupDialog.isVisible().catch(() => false)) {
      await apiKeySetupDialog.getByRole('button', { name: 'Close' }).click();
    }
    await expect(apiKeySetupDialog).toBeHidden({ timeout: 2_500 });
  }

  const initialChatProofEvents = await page.evaluate(() => {
    const testWindow = window as typeof window & {
      __protopulseChatProof?: Array<{
        type: 'open' | 'draft' | 'send';
        message?: string;
        designAgent?: boolean;
        delivery?: string;
      }>;
    };
    return testWindow.__protopulseChatProof ?? [];
  });
  expect(initialChatProofEvents).toContainEqual(expect.objectContaining({ type: 'open', designAgent: false }));
  expect(initialChatProofEvents).toContainEqual(
    expect.objectContaining({
      type: 'draft',
      delivery: 'draft',
      message: expect.stringContaining('AI intent: explain.'),
    }),
  );
  expect(initialChatProofEvents.filter((event) => event.type === 'send')).toHaveLength(0);
  await expect(page.getByTestId('chat-input')).toHaveValue(/AI intent: explain\./);
  await expect(page.getByTestId('chat-input')).toHaveValue(/Target: node "New Component"/);

  const canvasBoxAfterAi = await canvas.boundingBox();
  expect(canvasBoxAfterAi).not.toBeNull();
  const repeatClickX = (canvasBoxAfterAi?.x ?? 0) + Math.min(180, Math.max(24, (canvasBoxAfterAi?.width ?? 0) - 24));
  const repeatClickY = (canvasBoxAfterAi?.y ?? 0) + Math.min(220, Math.max(24, (canvasBoxAfterAi?.height ?? 0) - 24));
  await page.mouse.click(repeatClickX, repeatClickY, { button: 'right' });
  await expect(radialMenu).toBeVisible({ timeout: 2_500 });
  const repeatAiButton = page.getByTestId('radial-repeat-ai');
  await expect(repeatAiButton).toBeVisible();
  const repeatAiLabel = await repeatAiButton.getAttribute('aria-label');
  expect(repeatAiLabel).toContain('Explain architecture');
  expect(repeatAiLabel).toContain('New Component');
  await repeatAiButton.click();
  await expect(radialMenu).toBeHidden();
  await expect
    .poll(async () => {
      const events = await page.evaluate(() => {
        const testWindow = window as typeof window & {
          __protopulseChatProof?: Array<{
            type: 'open' | 'draft' | 'send';
            message?: string;
            designAgent?: boolean;
            delivery?: string;
          }>;
        };
        return testWindow.__protopulseChatProof ?? [];
      });
      return events.filter((event) => event.type === 'draft').length;
    })
    .toBeGreaterThanOrEqual(2);

  const inspectorPanel = page.getByTestId('node-inspector-panel');
  if (await inspectorPanel.isVisible().catch(() => false)) {
    await page.getByTestId('node-inspector-close').click();
    await expect(inspectorPanel).toBeHidden({ timeout: 2_500 });
  }
  await rightClickCenter(targetNode);
  await expect(radialMenu).toBeVisible({ timeout: 2_500 });
  await page.getByTestId('radial-item-ai_explain_architecture').hover();
  await expect(radialMenu).toHaveAttribute('aria-activedescendant', 'radial-menuitem-ai_explain_architecture');
  await radialMenu.focus();
  await page.keyboard.down('Shift');
  try {
    await page.keyboard.press('Enter');
  } finally {
    await page.keyboard.up('Shift');
  }
  await expect(radialMenu).toBeHidden();
  await expect
    .poll(async () => {
      const events = await page.evaluate(() => {
        const testWindow = window as typeof window & {
          __protopulseChatProof?: Array<{
            type: 'open' | 'draft' | 'send';
            message?: string;
            designAgent?: boolean;
            delivery?: string;
          }>;
        };
        return testWindow.__protopulseChatProof ?? [];
      });
      return events.filter((event) => event.type === 'send').length;
    })
    .toBe(1);

  const chatProofEvents = await page.evaluate(() => {
    const testWindow = window as typeof window & {
      __protopulseChatProof?: Array<{
        type: 'open' | 'draft' | 'send';
        message?: string;
        designAgent?: boolean;
        delivery?: string;
      }>;
    };
    return testWindow.__protopulseChatProof ?? [];
  });
  const draftEvents = chatProofEvents.filter((event) => event.type === 'draft');
  const sendEvents = chatProofEvents.filter((event) => event.type === 'send');
  expect(draftEvents.length).toBeGreaterThanOrEqual(2);
  expect(sendEvents).toHaveLength(1);
  expect(chatProofEvents).toContainEqual(expect.objectContaining({ type: 'open', designAgent: false }));
  expect(chatProofEvents).toContainEqual(
    expect.objectContaining({
      type: 'draft',
      delivery: 'draft',
      message: expect.stringContaining('AI intent: explain.'),
    }),
  );
  expect(chatProofEvents).toContainEqual(
    expect.objectContaining({
      type: 'send',
      delivery: 'send-now',
      message: expect.stringContaining('AI intent: explain.'),
    }),
  );
  expect(chatProofEvents).toContainEqual(
    expect.objectContaining({
      type: 'send',
      message: expect.stringContaining('Target: node "New Component"'),
    }),
  );
  expect(chatProofEvents).toContainEqual(
    expect.objectContaining({
      type: 'send',
      message: expect.stringContaining('Canvas summary: 1 node(s), 0 connection(s).'),
    }),
  );
  expect(sendEvents.at(-1)?.message).toContain('AI intent: explain.');
  expect(sendEvents.at(-1)?.message).toContain('Target: node "New Component"');
  await page.waitForTimeout(250);

  const chatClose = page.getByTestId('chat-close');
  if (await chatClose.isVisible().catch(() => false)) {
    await chatClose.click();
    await expect(page.getByTestId('chat-tab-chat')).toBeHidden({ timeout: 2_500 });
  }
  await page.evaluate(() => {
    const testWindow = window as typeof window & {
      __protopulseRadialTelemetry?: { events: Array<Record<string, unknown>> };
    };
    testWindow.__protopulseRadialTelemetry = {
      events: [
        ...(testWindow.__protopulseRadialTelemetry?.events ?? []),
        {
          name: 'mark-cancel',
          timestamp: performance.now(),
          view: 'pcb',
          target: 'canvas',
          commandId: 'add_node',
          slot: 2,
          reason: 'wrong-context',
        },
        {
          name: 'mark-cancel',
          timestamp: performance.now(),
          view: 'pcb',
          target: 'canvas',
          commandId: 'add_node',
          slot: 2,
          reason: 'wrong-context',
        },
        {
          name: 'mark-cancel',
          timestamp: performance.now(),
          view: 'pcb',
          target: 'canvas',
          commandId: 'add_node',
          slot: 2,
          reason: 'wrong-context',
        },
        {
          name: 'mark-select',
          timestamp: performance.now(),
          view: 'architecture',
          target: 'canvas',
          commandId: 'add_node',
          slot: 0,
          durationMs: 42,
        },
        {
          name: 'mark-cancel',
          timestamp: performance.now(),
          view: 'architecture',
          target: 'canvas',
          commandId: 'add_node',
          slot: 5,
          reason: 'wrong-direction',
        },
        {
          name: 'mark-cancel',
          timestamp: performance.now(),
          view: 'architecture',
          target: 'canvas',
          commandId: 'add_node',
          slot: 5,
          reason: 'wrong-direction',
        },
      ],
    };
    window.dispatchEvent(new CustomEvent('protopulse:radial-telemetry'));
  });
  await page.keyboard.press('Shift+F10');
  await expect(radialMenu).toBeVisible({ timeout: 2_500 });
  await page.getByTestId('radial-customize').click();
  const desktopGestureCoach = page.getByTestId('radial-customizer-gesture-coach');
  await expect(desktopGestureCoach).toBeVisible({ timeout: 2_500 });
  await expect(page.getByTestId('radial-customizer-gesture-fastest')).toHaveText('Fast N 42ms');
  await expect(page.getByTestId('radial-customizer-gesture-watch')).toHaveText(/Watch SW [2-9]\d* misses/);
  await expect(page.getByTestId('radial-customizer-gesture-suggestion')).toHaveText(/Try Add Node in SW/);
  await expect(page.getByTestId('radial-customizer-gesture-suggestion')).toHaveAttribute('data-source', 'command');
  await expect(page.getByTestId('radial-customizer-gesture-suggestion-impact')).toHaveText('Swap Validate');
  const dismissSuggestion = page.getByTestId('radial-customizer-gesture-suggestion-dismiss');
  const neverSuggestion = page.getByTestId('radial-customizer-gesture-suggestion-never');
  await expect(dismissSuggestion).toBeVisible();
  await expect(dismissSuggestion).toHaveAttribute(
    'title',
    'Hide this Add Node suggestion for now. It can return when new gesture misses appear.',
  );
  await expect(neverSuggestion).toBeVisible();
  await expect(neverSuggestion).toHaveAttribute('title', 'Never suggest moving Add Node to SW on this wheel.');
  await expect(page.getByTestId('radial-customizer-gesture-slot-usage-0')).toHaveText('1 mark');
  await expect(page.getByTestId('radial-customizer-gesture-slot-usage-5')).toHaveText(/0 marks \/ [2-9]\d* misses/);
  await page.getByTestId('radial-customizer-body').evaluate((element) => {
    element.scrollTop = 0;
  });
  await page.getByTestId('radial-customizer').screenshot({
    path: screenshotPath('radial-persistent-suggestion-controls-pass59.png'),
  });
  await neverSuggestion.hover();
  await expect(page.getByRole('tooltip', { name: 'Never suggest moving Add Node to SW on this wheel.' })).toBeVisible();
  await page.screenshot({
    path: screenshotPath('radial-suggestion-never-tooltip-pass60.png'),
  });
  const telemetryInspector = page.getByTestId('radial-telemetry-inspector');
  await telemetryInspector.scrollIntoViewIfNeeded();
  await expect(telemetryInspector).toBeVisible({ timeout: 2_500 });
  await expect(page.getByTestId('radial-telemetry-ai-total-count')).toHaveText('3');
  await expect(page.getByTestId('radial-telemetry-ai-draft-count')).toHaveText('2');
  await expect(page.getByTestId('radial-telemetry-ai-send-count')).toHaveText('1');
  await telemetryInspector.screenshot({
    path: screenshotPath('radial-telemetry-ai-summary-pass50.png'),
  });
  await page.evaluate(() => {
    const testWindow = window as typeof window & {
      __protopulseRadialTelemetry?: { events: Array<Record<string, unknown>> };
    };
    testWindow.__protopulseRadialTelemetry = {
      events: [
        ...(testWindow.__protopulseRadialTelemetry?.events ?? []),
        {
          name: 'mark-select',
          timestamp: performance.now(),
          view: 'architecture',
          target: 'canvas',
          commandId: 'add_node',
          slot: 0,
          durationMs: 38,
        },
        {
          name: 'mark-select',
          timestamp: performance.now(),
          view: 'architecture',
          target: 'canvas',
          commandId: 'add_node',
          slot: 0,
          durationMs: 36,
        },
        {
          name: 'mark-select',
          timestamp: performance.now(),
          view: 'architecture',
          target: 'canvas',
          commandId: 'add_node',
          slot: 0,
          durationMs: 34,
        },
      ],
    };
    window.dispatchEvent(new CustomEvent('protopulse:radial-telemetry'));
  });
  await expect(page.getByTestId('radial-telemetry-mastery')).toHaveAttribute('data-status', 'locked');
  await expect(page.getByTestId('radial-telemetry-mastery-value')).toHaveText('3x Add Node');
  await expect(page.getByTestId('radial-telemetry-mastery-detail')).toHaveText('N gesture trained');
  await expect(page.getByTestId('radial-telemetry-mastery-status')).toHaveText('Locked');
  await expect(page.getByTestId('radial-customizer-mastery-filter-count-trained')).toHaveText('1');
  await expect(page.getByTestId('radial-customizer-mastery-add_node')).toHaveAttribute('data-status', 'trained');
  await page.getByTestId('radial-customizer-mastery-filter-trained').click();
  await expect(page.getByTestId('radial-customizer-command-count')).toHaveText(/1\/\d+/);
  await expect(page.getByTestId('radial-customizer-row-add_node')).toBeVisible();
  await expect(page.getByTestId('radial-customizer-row-generate_architecture')).toBeHidden();
  await page.getByTestId('radial-customizer-command-filter').screenshot({
    path: screenshotPath('radial-mastery-filter-pass64.png'),
  });
  await page.getByTestId('radial-customizer-row-add_node').screenshot({
    path: screenshotPath('radial-mastery-trained-row-pass64.png'),
  });
  const telemetryCountBeforePractice = await page.evaluate(() => {
    const testWindow = window as typeof window & {
      __protopulseRadialTelemetry?: { events: Array<Record<string, unknown>> };
    };
    return testWindow.__protopulseRadialTelemetry?.events.length ?? 0;
  });
  const nodeCountBeforePractice = Number(await canvas.getAttribute('data-node-count'));
  const practiceLane = page.getByTestId('radial-customizer-practice-lane');
  await practiceLane.scrollIntoViewIfNeeded();
  await expect(page.getByTestId('radial-customizer-practice-target')).toHaveText('N');
  await expect(page.getByTestId('radial-customizer-practice-status')).toHaveText('Aim N');
  const practicePad = page.getByTestId('radial-customizer-practice-pad');
  const practiceBox = await practicePad.boundingBox();
  expect(practiceBox).not.toBeNull();
  const practiceCenterX = (practiceBox?.x ?? 0) + (practiceBox?.width ?? 0) / 2;
  const practiceCenterY = (practiceBox?.y ?? 0) + (practiceBox?.height ?? 0) / 2;
  await page.mouse.move(practiceCenterX, practiceCenterY);
  await page.mouse.down();
  await page.mouse.move(practiceCenterX, practiceCenterY - 36, { steps: 4 });
  await page.mouse.up();
  await expect(page.getByTestId('radial-customizer-practice-status')).toHaveText('Hit N');
  await expect(page.getByTestId('radial-customizer-practice-score')).toHaveText('1/1 hits / streak 1');
  await expect.poll(async () => Number(await canvas.getAttribute('data-node-count'))).toBe(nodeCountBeforePractice);
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const testWindow = window as typeof window & {
          __protopulseRadialTelemetry?: { events: Array<Record<string, unknown>> };
        };
        return testWindow.__protopulseRadialTelemetry?.events.length ?? 0;
      }),
    )
    .toBe(telemetryCountBeforePractice);
  await practiceLane.screenshot({
    path: screenshotPath('radial-practice-lane-pass66.png'),
  });
  await page.mouse.move(practiceCenterX, practiceCenterY);
  await page.mouse.down();
  await page.mouse.move(practiceCenterX, practiceCenterY - 36, { steps: 4 });
  await page.mouse.up();
  await expect(page.getByTestId('radial-customizer-practice-status')).toHaveText('Hit N');
  await expect(page.getByTestId('radial-customizer-practice-score')).toHaveText('2/2 hits / streak 2');
  await expect.poll(async () => Number(await canvas.getAttribute('data-node-count'))).toBe(nodeCountBeforePractice);
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const testWindow = window as typeof window & {
          __protopulseRadialTelemetry?: { events: Array<Record<string, unknown>> };
        };
        return testWindow.__protopulseRadialTelemetry?.events.length ?? 0;
      }),
    )
    .toBe(telemetryCountBeforePractice);
  await page.getByTestId('radial-customizer-collapse').click();
  await expect(page.getByTestId('radial-customizer')).toHaveAttribute('data-collapsed', 'true');
  await expect(page.getByTestId('radial-customizer-collapsed-practice')).toHaveAttribute('data-state', 'idle');
  await expect(page.getByTestId('radial-customizer-collapsed-practice')).toHaveAttribute('data-progress', '0/7');
  await expect(page.getByTestId('radial-customizer-collapsed-practice')).toHaveAttribute('data-streak', '2');
  await expect(page.getByTestId('radial-customizer-collapsed-practice')).toHaveAttribute('data-streak-active', 'true');
  await expect(page.getByTestId('radial-customizer-collapsed-practice')).toHaveAttribute('data-streak-label', '2x');
  await expect(page.getByTestId('radial-customizer-collapsed-practice')).toHaveAttribute(
    'data-streak-source-command-id',
    'add_node',
  );
  await expect(page.getByTestId('radial-customizer-collapsed-practice')).toHaveAttribute(
    'data-streak-source-label',
    'Add Node N',
  );
  await expect(page.getByTestId('radial-customizer-collapsed-practice')).toHaveAttribute(
    'data-streak-source-direction',
    'N',
  );
  await expect(page.getByTestId('radial-customizer-collapsed-practice-status')).toHaveText(
    'Practice status: 0/7 local practice coverage. Best local streak: 2x.',
  );
  await expect(page.getByTestId('radial-customizer-collapsed-idle')).toContainText('Practice 0/7');
  await expect(page.getByTestId('radial-customizer-collapsed-idle')).toHaveAttribute('data-streak-active', 'true');
  await expect(page.getByTestId('radial-customizer-collapsed-idle')).toHaveAttribute(
    'data-streak-source-command-id',
    'add_node',
  );
  await expect(page.getByTestId('radial-customizer-collapsed-idle')).toHaveAttribute(
    'data-streak-source-label',
    'Add Node N',
  );
  await expect(page.getByTestId('radial-customizer-collapsed-practice-streak')).toHaveText('2x');
  await expect(page.getByTestId('radial-customizer-collapsed-practice-streak')).toHaveAttribute(
    'data-streak-source-label',
    'Add Node N',
  );
  await page.getByTestId('radial-customizer').screenshot({
    path: screenshotPath('radial-collapsed-practice-streak-pass83.png'),
  });
  await page.getByTestId('radial-customizer-collapsed-idle').focus();
  await expect(page.getByTestId('radial-customizer-collapsed-practice-streak-source').first()).toBeVisible();
  await expect(page.getByTestId('radial-customizer-collapsed-practice-streak-source').first()).toHaveText(
    'Best streak: Add Node N at 2x.',
  );
  await page.screenshot({
    path: screenshotPath('radial-collapsed-practice-streak-source-pass84.png'),
  });
  await page.getByTestId('radial-customizer-collapsed-idle').press('Enter');
  await expect(page.getByTestId('radial-customizer')).toHaveAttribute('data-collapsed', 'false');
  await expect(practiceLane).toBeVisible();
  await expect(practicePad).toBeFocused();
  const coldPractice = page.getByTestId('radial-customizer-practice-cold');
  await expect(coldPractice).toHaveAttribute('data-command-id', 'generate_architecture');
  await coldPractice.click();
  await expect(page.getByTestId('radial-customizer-mastery-filter-cold')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('radial-customizer-practice-label')).toHaveText('Generate');
  await expect(page.getByTestId('radial-customizer-practice-target')).toHaveText('NE');
  await expect(page.getByTestId('radial-customizer-practice-status')).toHaveText('Aim NE');
  await expect(practicePad).toBeFocused();
  await page.keyboard.press('2');
  await expect(page.getByTestId('radial-customizer-practice-status')).toHaveText('Hit NE');
  await expect(page.getByTestId('radial-customizer-practice-score')).toHaveText('1/1 hits / streak 1');
  await expect.poll(async () => Number(await canvas.getAttribute('data-node-count'))).toBe(nodeCountBeforePractice);
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const testWindow = window as typeof window & {
          __protopulseRadialTelemetry?: { events: Array<Record<string, unknown>> };
        };
        return testWindow.__protopulseRadialTelemetry?.events.length ?? 0;
      }),
    )
    .toBe(telemetryCountBeforePractice);
  await practiceLane.screenshot({
    path: screenshotPath('radial-practice-cold-pass67.png'),
  });
  const practiceQueue = page.getByTestId('radial-customizer-practice-queue');
  await expect(practiceQueue).toHaveAttribute('data-progress', '1/7');
  await practiceQueue.click();
  await expect(practiceQueue).toHaveAttribute('data-active', 'true');
  await expect(page.getByTestId('radial-customizer-practice-label')).toHaveText('AI Connect');
  await expect(page.getByTestId('radial-customizer-practice-target')).toHaveText('E');
  await expect(page.getByTestId('radial-customizer-practice-queue-status')).toHaveText('Queue 1/7 - Drill E');
  await expect(practicePad).toBeFocused();
  await page.keyboard.press('3');
  await expect(page.getByTestId('radial-customizer-practice-label')).toHaveText('Fit');
  await expect(page.getByTestId('radial-customizer-practice-target')).toHaveText('SE');
  await expect(page.getByTestId('radial-customizer-practice-status')).toHaveText('Aim SE');
  await expect(practiceQueue).toHaveAttribute('data-progress', '2/7');
  await expect(page.getByTestId('radial-customizer-practice-queue-status')).toHaveText('Queue 2/7 - Next SE');
  await expect.poll(async () => Number(await canvas.getAttribute('data-node-count'))).toBe(nodeCountBeforePractice);
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const testWindow = window as typeof window & {
          __protopulseRadialTelemetry?: { events: Array<Record<string, unknown>> };
        };
        return testWindow.__protopulseRadialTelemetry?.events.length ?? 0;
      }),
    )
    .toBe(telemetryCountBeforePractice);
  await practiceLane.screenshot({
    path: screenshotPath('radial-practice-queue-pass68.png'),
  });
  const replayPractice = page.getByTestId('radial-customizer-practice-replay');
  await page.keyboard.press('5');
  await expect(page.getByTestId('radial-customizer-practice-status')).toHaveText('Miss S');
  await expect(page.getByTestId('radial-customizer-practice-score')).toHaveText('0/1 hits / streak 0');
  await expect(replayPractice).toHaveAttribute('data-count', '1');
  await expect(page.getByTestId('radial-customizer-practice-queue-status')).toHaveText('Queue 2/7 - Retry SE');
  const practiceHeat = page.getByTestId('radial-customizer-practice-heat');
  await expect(practiceHeat).toHaveAttribute('data-total', '7');
  await expect(practiceHeat).toHaveAttribute('data-tried', '3');
  await expect(practiceHeat).toHaveAttribute('data-idle', '4');
  await expect(page.getByTestId('radial-customizer-practice-heat-summary')).toHaveText('3 tried / 4 idle');
  await expect(page.getByTestId('radial-customizer-practice-heat-fit_view')).toHaveAttribute('data-rank', '1');
  await expect(page.getByTestId('radial-customizer-practice-heat-fit_view')).toHaveAttribute('data-attempts', '1');
  await expect(page.getByTestId('radial-customizer-practice-heat-fit_view')).toHaveAttribute('data-status', 'weak');
  await expect(page.getByTestId('radial-customizer-practice-heat-fit_view')).toContainText('Fit');
  await expect(page.getByTestId('radial-customizer-practice-heat-fit_view')).toContainText('1x');
  await practiceLane.screenshot({
    path: screenshotPath('radial-practice-heat-pass71.png'),
  });
  await page.getByTestId('radial-customizer-collapse').click();
  await expect(page.getByTestId('radial-customizer')).toHaveAttribute('data-collapsed', 'true');
  await expect(page.getByTestId('radial-customizer-collapsed-practice')).toHaveAttribute('data-state', 'replay');
  await expect(page.getByTestId('radial-customizer-collapsed-practice')).toHaveAttribute(
    'data-priority',
    'clean replay idle',
  );
  await expect(page.getByTestId('radial-customizer-collapsed-practice')).toHaveAttribute('data-progress', '2/7');
  await expect(page.getByTestId('radial-customizer-collapsed-practice')).toHaveAttribute('data-progress-percent', '29');
  await expect(page.getByTestId('radial-customizer-collapsed-practice')).toHaveAttribute('data-cue', 'replay');
  await expect(page.getByTestId('radial-customizer-collapsed-practice')).toHaveAttribute('data-replay-count', '1');
  await expect(page.getByTestId('radial-customizer-collapsed-practice')).toHaveAttribute('data-streak', '2');
  await expect(page.getByTestId('radial-customizer-collapsed-practice')).toHaveAttribute('data-streak-active', 'true');
  await expect(page.getByTestId('radial-customizer-collapsed-practice')).toHaveAttribute('data-streak-label', '2x');
  await expect(page.getByTestId('radial-customizer-collapsed-practice')).toHaveAttribute(
    'data-streak-source-command-id',
    'add_node',
  );
  await expect(page.getByTestId('radial-customizer-collapsed-practice')).toHaveAttribute(
    'data-streak-source-label',
    'Add Node N',
  );
  await expect(page.getByTestId('radial-customizer-collapsed-practice-status')).toHaveText(
    'Practice status: 1 replay ready for replay, 2/7 coverage. Best local streak: 2x.',
  );
  await expect(page.getByTestId('radial-customizer-collapsed-replay')).toContainText('1 replay');
  await expect(page.getByTestId('radial-customizer-collapsed-replay')).toHaveAttribute('data-count', '1');
  await expect(page.getByTestId('radial-customizer-collapsed-replay')).toHaveAttribute('data-progress-percent', '29');
  await expect(page.getByTestId('radial-customizer-collapsed-replay')).toHaveAttribute('data-cue', 'replay');
  await expect(page.getByTestId('radial-customizer-collapsed-replay')).toHaveAttribute('data-streak', '2');
  await expect(page.getByTestId('radial-customizer-collapsed-replay')).toHaveAttribute('data-streak-active', 'true');
  await expect(page.getByTestId('radial-customizer-collapsed-replay')).toHaveAttribute(
    'data-streak-source-label',
    'Add Node N',
  );
  await expect(page.getByTestId('radial-customizer-collapsed-practice-streak')).toHaveText('2x');
  await expect(page.getByTestId('radial-customizer-collapsed-practice-streak')).toHaveAttribute(
    'data-streak-source-label',
    'Add Node N',
  );
  await expect(page.getByTestId('radial-customizer-collapsed-replay')).toHaveAttribute('role', 'button');
  await expect(page.getByTestId('radial-customizer-collapsed-replay')).toHaveAttribute(
    'data-quick-open',
    'practice-pad',
  );
  await expect(page.getByTestId('radial-customizer-collapsed-replay')).toHaveAttribute(
    'data-quick-open-mode',
    'replay',
  );
  await expect(page.getByTestId('radial-customizer-collapsed-replay')).toHaveAttribute(
    'data-action-hint',
    'Enter/Space opens replay practice.',
  );
  await expect(page.getByTestId('radial-customizer-collapsed-replay')).toHaveAttribute(
    'aria-label',
    'Open replay practice: 1 replay',
  );
  await expect(page.getByTestId('radial-customizer-collapsed-replay')).toHaveAttribute(
    'aria-keyshortcuts',
    'Enter Space Shift+Backspace',
  );
  await expect(page.getByTestId('radial-customizer-collapsed-replay')).toHaveAttribute(
    'style',
    /--collapsed-practice-progress:\s*29%/,
  );
  await expect(page.getByTestId('radial-customizer-collapsed-replay')).toHaveAccessibleDescription(
    'Practice status: 1 replay ready for replay, 2/7 coverage. Best local streak: 2x.',
  );
  await page.getByTestId('radial-customizer').screenshot({
    path: screenshotPath('radial-collapsed-replay-pass70.png'),
  });
  await page.getByTestId('radial-customizer-collapsed-replay').focus();
  await expect(page.getByTestId('radial-customizer-collapsed-practice-help').first()).toBeVisible();
  await expect(page.getByTestId('radial-customizer-collapsed-practice-help').first()).toContainText(
    '1 replay queued for replay. Expand practice to retry weak gestures safely.',
  );
  await expect(page.getByTestId('radial-customizer-collapsed-practice-streak-source').first()).toHaveText(
    'Best streak: Add Node N at 2x.',
  );
  await expect(page.getByTestId('radial-customizer-collapsed-practice-hint').first()).toHaveText(
    'Enter/Space opens replay practice.',
  );
  await page.getByTestId('radial-customizer-collapsed-replay').press('Space');
  await expect(page.getByTestId('radial-customizer')).toHaveAttribute('data-collapsed', 'false');
  await expect(practiceLane).toBeVisible();
  await expect(practicePad).toBeFocused();
  await expect(replayPractice).toHaveAttribute('data-active', 'true');
  await expect(page.getByTestId('radial-customizer-practice-label')).toHaveText('Fit');
  await expect(page.getByTestId('radial-customizer-practice-target')).toHaveText('SE');
  await expect(page.getByTestId('radial-customizer-practice-status')).toHaveText('Aim SE');
  await expect(page.getByTestId('radial-customizer-practice-queue-status')).toHaveText('Queue 2/7 - Replay SE');
  await expect(practicePad).toBeFocused();
  await page.keyboard.press('4');
  await expect(page.getByTestId('radial-customizer-practice-status')).toHaveText('Hit SE');
  await expect(page.getByTestId('radial-customizer-practice-score')).toHaveText('1/2 hits / streak 1');
  await expect(replayPractice).toHaveAttribute('data-count', '0');
  await expect(page.getByTestId('radial-customizer-practice-queue-status')).toHaveText('Queue 3/7 - Replay clear');
  await expect.poll(async () => Number(await canvas.getAttribute('data-node-count'))).toBe(nodeCountBeforePractice);
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const testWindow = window as typeof window & {
          __protopulseRadialTelemetry?: { events: Array<Record<string, unknown>> };
        };
        return testWindow.__protopulseRadialTelemetry?.events.length ?? 0;
      }),
    )
    .toBe(telemetryCountBeforePractice);
  await practiceLane.screenshot({
    path: screenshotPath('radial-practice-replay-pass69.png'),
  });
  await page.getByTestId('radial-customizer-collapse').click();
  await expect(page.getByTestId('radial-customizer')).toHaveAttribute('data-collapsed', 'true');
  await expect(page.getByTestId('radial-customizer-collapsed-practice')).toHaveAttribute('data-state', 'idle');
  await expect(page.getByTestId('radial-customizer-collapsed-practice')).toHaveAttribute('data-progress', '3/7');
  await expect(page.getByTestId('radial-customizer-collapsed-practice')).toHaveAttribute('data-progress-percent', '43');
  await expect(page.getByTestId('radial-customizer-collapsed-practice')).toHaveAttribute('data-replay-cleared', 'true');
  await expect(page.getByTestId('radial-customizer-collapsed-practice')).toHaveAttribute('data-flash', 'replay-clear');
  await expect(page.getByTestId('radial-customizer-collapsed-practice')).toHaveAttribute('data-streak', '2');
  await expect(page.getByTestId('radial-customizer-collapsed-practice')).toHaveAttribute('data-streak-active', 'true');
  await expect(page.getByTestId('radial-customizer-collapsed-practice')).toHaveAttribute('data-streak-label', '2x');
  await expect(page.getByTestId('radial-customizer-collapsed-practice')).toHaveAttribute(
    'data-streak-source-label',
    'Add Node N',
  );
  await expect(page.getByTestId('radial-customizer-collapsed-practice-status')).toHaveText(
    'Practice status: replay cleared, 3/7 local practice coverage. Best local streak: 2x.',
  );
  await expect(page.getByTestId('radial-customizer-collapsed-idle')).toContainText('Practice 3/7');
  await expect(page.getByTestId('radial-customizer-collapsed-idle')).toHaveAttribute('data-replay-cleared', 'true');
  await expect(page.getByTestId('radial-customizer-collapsed-idle')).toHaveAttribute('data-flash', 'replay-clear');
  await expect(page.getByTestId('radial-customizer-collapsed-idle')).toHaveAttribute('data-streak', '2');
  await expect(page.getByTestId('radial-customizer-collapsed-idle')).toHaveAttribute('data-streak-active', 'true');
  await expect(page.getByTestId('radial-customizer-collapsed-idle')).toHaveAttribute(
    'data-streak-source-label',
    'Add Node N',
  );
  await expect(page.getByTestId('radial-customizer-collapsed-practice-streak')).toHaveText('2x');
  await expect(page.getByTestId('radial-customizer-collapsed-idle')).toHaveClass(/after:opacity-100/);
  await expect(page.getByTestId('radial-customizer-collapsed-idle')).toHaveClass(/before:bg-emerald-300\/80/);
  await page.getByTestId('radial-customizer').screenshot({
    path: screenshotPath('radial-collapsed-replay-clear-pass82.png'),
  });
  await page.getByTestId('radial-customizer-collapsed-idle').press('Enter');
  await expect(page.getByTestId('radial-customizer')).toHaveAttribute('data-collapsed', 'false');
  await expect(practiceLane).toBeVisible();
  await expect(practicePad).toBeFocused();
  await practiceQueue.click();
  await expect(practiceQueue).toHaveAttribute('data-active', 'false');
  await practiceQueue.click();
  await expect(practiceQueue).toHaveAttribute('data-active', 'true');
  await expect(page.getByTestId('radial-customizer-practice-label')).toHaveText('Analyze');
  await expect(page.getByTestId('radial-customizer-practice-target')).toHaveText('S');
  await expect(page.getByTestId('radial-customizer-practice-queue-status')).toHaveText('Queue 3/7 - Drill S');
  await expect(practicePad).toBeFocused();
  await page.keyboard.press('5');
  await expect(page.getByTestId('radial-customizer-practice-label')).toHaveText('Validate');
  await expect(page.getByTestId('radial-customizer-practice-target')).toHaveText('SW');
  await expect(page.getByTestId('radial-customizer-practice-queue-status')).toHaveText('Queue 4/7 - Next SW');
  await page.keyboard.press('6');
  await expect(page.getByTestId('radial-customizer-practice-label')).toHaveText('Select All');
  await expect(page.getByTestId('radial-customizer-practice-target')).toHaveText('W');
  await expect(page.getByTestId('radial-customizer-practice-queue-status')).toHaveText('Queue 5/7 - Next W');
  await page.keyboard.press('7');
  await expect(page.getByTestId('radial-customizer-practice-label')).toHaveText('Paste');
  await expect(page.getByTestId('radial-customizer-practice-target')).toHaveText('NW');
  await expect(page.getByTestId('radial-customizer-practice-queue-status')).toHaveText('Queue 6/7 - Next NW');
  await page.keyboard.press('8');
  await expect(practiceQueue).toHaveAttribute('data-progress', '7/7');
  await expect(page.getByTestId('radial-customizer-practice-queue-status')).toHaveText('Queue 7/7 - Queue done');
  const practiceRecap = page.getByTestId('radial-customizer-practice-recap');
  await expect(practiceRecap).toHaveAttribute('data-hits', '7');
  await expect(practiceRecap).toHaveAttribute('data-attempts', '8');
  await expect(practiceRecap).toHaveAttribute('data-weak', '0');
  await expect(practiceRecap).toHaveAttribute('data-next-command-id', '');
  await expect(page.getByTestId('radial-customizer-practice-recap-hits')).toHaveText('7/8 hits');
  await expect(page.getByTestId('radial-customizer-practice-recap-weak')).toHaveText('0 weak');
  await expect(page.getByTestId('radial-customizer-practice-recap-next')).toHaveText('Replay clear');
  await expect(page.getByTestId('radial-customizer-practice-recap-replay')).toBeDisabled();
  await expect.poll(async () => Number(await canvas.getAttribute('data-node-count'))).toBe(nodeCountBeforePractice);
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const testWindow = window as typeof window & {
          __protopulseRadialTelemetry?: { events: Array<Record<string, unknown>> };
        };
        return testWindow.__protopulseRadialTelemetry?.events.length ?? 0;
      }),
    )
    .toBe(telemetryCountBeforePractice);
  await practiceLane.screenshot({
    path: screenshotPath('radial-practice-recap-pass72.png'),
  });
  await page.getByTestId('radial-customizer-mastery-filter-all').click();
  await telemetryInspector.screenshot({
    path: screenshotPath('radial-gesture-mastery-pass63.png'),
  });
  await page.getByTestId('radial-customizer-collapse').click();
  await expect(page.getByTestId('radial-customizer')).toHaveAttribute('data-collapsed', 'true');
  await expect(page.getByTestId('radial-customizer-collapsed-summary')).toHaveText('Layout saved');
  await expect(page.getByTestId('radial-customizer-collapsed-mastery-trained')).toHaveText('1 trained');
  await expect(page.getByTestId('radial-customizer-collapsed-mastery-building')).toHaveText('0 building');
  await expect(page.getByTestId('radial-customizer-collapsed-mastery-cold')).toHaveText('7 cold');
  await page.getByTestId('radial-customizer').screenshot({
    path: screenshotPath('radial-collapsed-mastery-pass65.png'),
  });
  await expect(consoleIssues).toEqual([]);
});

test('radial menu scales to stay reachable on compact viewports', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 520 });
  await resetArchitectureGraph(page);
  const consoleIssues = collectConsoleIssues(page);
  const canvas = await waitForArchitectureCanvas(page);

  const assetLibraryHeading = page.getByRole('heading', { name: 'Asset Library' });
  if (await assetLibraryHeading.isVisible().catch(() => false)) {
    await page.getByRole('button', { name: 'Close asset library' }).click();
    await expect(assetLibraryHeading).toBeHidden();
  }

  const canvasBox = await canvas.boundingBox();
  expect(canvasBox).not.toBeNull();
  const clickX = Math.min(348, (canvasBox?.x ?? 0) + (canvasBox?.width ?? 0) - 8);
  const clickY = Math.min(508, (canvasBox?.y ?? 0) + (canvasBox?.height ?? 0) - 8);
  await page.mouse.click(clickX, clickY, { button: 'right' });

  const radialMenu = page.getByTestId('radial-menu');
  await expect(radialMenu).toBeVisible({ timeout: 2_500 });
  const radialScale = Number(await radialMenu.getAttribute('data-radial-scale'));
  expect(radialScale).toBeGreaterThan(0);
  expect(radialScale).toBeLessThan(1);
  await expect(page.getByTestId('radial-center-title')).toBeVisible();

  const rect = await radialMenu.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return {
      left: bounds.left,
      top: bounds.top,
      right: bounds.right,
      bottom: bounds.bottom,
      width: bounds.width,
      height: bounds.height,
    };
  });
  expect(rect.left).toBeGreaterThanOrEqual(-0.5);
  expect(rect.top).toBeGreaterThanOrEqual(-0.5);
  expect(rect.right).toBeLessThanOrEqual(360.5);
  expect(rect.bottom).toBeLessThanOrEqual(520.5);
  expect(rect.width).toBeLessThan(404);
  expect(rect.height).toBeLessThan(404);

  await page.evaluate(() => {
    const testWindow = window as typeof window & {
      __protopulseRadialTelemetry?: { events: Array<Record<string, unknown>> };
    };
    testWindow.__protopulseRadialTelemetry = {
      events: [
        ...(testWindow.__protopulseRadialTelemetry?.events ?? []),
        {
          name: 'mark-cancel',
          timestamp: performance.now(),
          view: 'pcb',
          target: 'canvas',
          commandId: 'add_node',
          slot: 2,
          reason: 'wrong-context',
        },
        {
          name: 'mark-cancel',
          timestamp: performance.now(),
          view: 'pcb',
          target: 'canvas',
          commandId: 'add_node',
          slot: 2,
          reason: 'wrong-context',
        },
        {
          name: 'mark-cancel',
          timestamp: performance.now(),
          view: 'pcb',
          target: 'canvas',
          commandId: 'add_node',
          slot: 2,
          reason: 'wrong-context',
        },
        {
          name: 'mark-select',
          timestamp: performance.now(),
          view: 'architecture',
          target: 'canvas',
          commandId: 'add_node',
          slot: 0,
          durationMs: 42,
        },
        {
          name: 'mark-cancel',
          timestamp: performance.now(),
          view: 'architecture',
          target: 'canvas',
          commandId: 'add_node',
          slot: 5,
          reason: 'wrong-direction',
        },
        {
          name: 'mark-cancel',
          timestamp: performance.now(),
          view: 'architecture',
          target: 'canvas',
          commandId: 'add_node',
          slot: 5,
          reason: 'wrong-direction',
        },
      ],
    };
    window.dispatchEvent(new CustomEvent('protopulse:radial-telemetry'));
  });
  await page.getByTestId('radial-customize').click();
  const customizer = page.getByTestId('radial-customizer');
  await expect(customizer).toBeVisible({ timeout: 2_500 });
  await expect(customizer).toHaveAttribute('data-layout', 'compact-sheet');
  await expect(page.getByTestId('radial-customizer-body')).toBeVisible();
  await expect(page.getByTestId('radial-customizer-footer')).toBeVisible();
  await expect(page.getByTestId('radial-customizer-apply')).toBeVisible();
  const gestureCoach = page.getByTestId('radial-customizer-gesture-coach');
  await gestureCoach.scrollIntoViewIfNeeded();
  await expect(gestureCoach).toBeVisible();
  await expect(page.getByTestId('radial-customizer-gesture-selected-direction')).toBeVisible();
  await expect(page.getByTestId('radial-customizer-gesture-slot-label-0')).not.toHaveText('Empty');
  await expect(page.getByTestId('radial-customizer-gesture-fastest')).toHaveText('Fast N 42ms');
  await expect(page.getByTestId('radial-customizer-gesture-watch')).toHaveText(/Watch SW [2-9]\d* misses/);
  await expect(page.getByTestId('radial-customizer-gesture-suggestion')).toHaveText(/Try Add Node in SW/);
  await expect(page.getByTestId('radial-customizer-gesture-suggestion')).toHaveAttribute('data-source', 'command');
  await expect(page.getByTestId('radial-customizer-gesture-suggestion-impact')).toHaveText('Swap Validate');
  await expect(page.getByTestId('radial-customizer-gesture-suggestion-dismiss')).toHaveAttribute(
    'title',
    'Hide this Add Node suggestion for now. It can return when new gesture misses appear.',
  );
  await expect(page.getByTestId('radial-customizer-gesture-suggestion-never')).toHaveAttribute(
    'title',
    'Never suggest moving Add Node to SW on this wheel.',
  );
  await expect(page.getByTestId('radial-customizer-gesture-slot-usage-0')).toHaveText('1 mark');
  await expect(page.getByTestId('radial-customizer-gesture-slot-usage-5')).toHaveText(/0 marks \/ [2-9]\d* misses/);
  await gestureCoach.screenshot({
    path: screenshotPath('radial-persistent-suggestion-controls-compact-pass59.png'),
  });
  const smartLayout = page.getByTestId('radial-customizer-smart-layout');
  const smartSuggestion = page.getByTestId('radial-customizer-smart-layout-suggestion');
  await smartSuggestion.scrollIntoViewIfNeeded();
  await expect(smartLayout).toBeVisible();
  await expect(page.getByTestId('radial-customizer-smart-layout-count')).toHaveText(/staged move/);
  await expect(smartSuggestion).toHaveAttribute('data-primary-command-id', 'add_node');
  await expect(smartSuggestion).toHaveAttribute('data-recent-count', '1');
  await expect(smartSuggestion).toHaveAttribute('data-friction-misses', /[2-9]\d*/);
  await expect(smartSuggestion).toContainText('Tune wheel');
  await expect(page.getByTestId('radial-customizer-smart-layout-moves')).toHaveAttribute('data-count', /[1-9]\d*/);
  await expect(page.getByTestId('radial-customizer-smart-layout-move-add_node')).toHaveAttribute(
    'data-reasons',
    /gesture-miss/,
  );
  await expect(page.getByTestId('radial-customizer-smart-layout-move-add_node')).toHaveAttribute(
    'data-from-direction',
    'N',
  );
  await expect(page.getByTestId('radial-customizer-smart-layout-move-add_node')).toHaveAttribute(
    'data-to-direction',
    'SW',
  );
  await expect(page.getByTestId('radial-customizer-smart-layout-move-add_node')).toContainText('N -> SW');
  await expect(page.getByTestId('radial-customizer-smart-layout-move-add_node')).toContainText('Gesture miss');
  await expect(page.getByTestId('radial-customizer-smart-layout-preview')).toHaveAttribute('data-slot-count', '8');
  await expect(page.getByTestId('radial-customizer-smart-layout-preview')).toHaveAttribute(
    'data-change-count',
    /[1-9]\d*/,
  );
  await expect(page.getByTestId('radial-customizer-smart-layout-preview-slot-5')).toHaveAttribute(
    'data-command-id',
    'add_node',
  );
  await expect(page.getByTestId('radial-customizer-smart-layout-preview-slot-5')).toHaveAttribute(
    'data-direction',
    'SW',
  );
  await expect(page.getByTestId('radial-customizer-smart-layout-preview-slot-5')).toHaveAttribute(
    'data-changed',
    'true',
  );
  await expect(page.getByTestId('radial-customizer-smart-layout-preview-slot-5')).toHaveAttribute(
    'data-reasons',
    /gesture-miss/,
  );
  await expect(page.getByTestId('radial-customizer-smart-layout-preview-slot-5')).toContainText('Add Node');
  await smartLayout.screenshot({
    path: screenshotPath('radial-smart-wheel-preview-pass91.png'),
  });
  const coverageMap = page.getByTestId('radial-customizer-coverage-map');
  await coverageMap.scrollIntoViewIfNeeded();
  await expect(coverageMap).toBeVisible();
  await expect(coverageMap).toHaveAttribute('data-current-key', 'architecture-canvas');
  await expect(coverageMap).toHaveAttribute('data-context-count', /[1-9]\d*/);
  await expect(coverageMap).toHaveAttribute('data-ready-count', /[1-9]\d*/);
  await expect(page.getByTestId('radial-customizer-coverage-current-summary')).toHaveAttribute(
    'data-command-count',
    '8',
  );
  await expect(page.getByTestId('radial-customizer-coverage-current-summary')).toHaveAttribute(
    'data-empty-slot-count',
    '0',
  );
  await expect(page.getByTestId('radial-customizer-coverage-architecture-canvas')).toHaveAttribute(
    'data-current',
    'true',
  );
  await expect(page.getByTestId('radial-customizer-coverage-architecture-canvas')).toHaveAttribute(
    'data-coverage',
    'full',
  );
  await expect(page.getByTestId('radial-customizer-coverage-architecture-canvas')).toHaveAttribute(
    'data-empty-slots',
    'none',
  );
  await expect(page.getByTestId('radial-customizer-coverage-architecture-canvas')).toHaveAttribute(
    'data-ai-count',
    '2',
  );
  await expect(page.getByTestId('radial-customizer-coverage-bom-canvas')).toHaveAttribute('data-coverage', 'full');
  await expect(page.getByTestId('radial-customizer-coverage-bom-canvas')).toHaveAttribute('data-command-count', '8');
  await expect(page.getByTestId('radial-customizer-coverage-bom-canvas')).toHaveAttribute('data-empty-slot-count', '0');
  await expect(page.getByTestId('radial-customizer-coverage-bom-canvas')).toHaveAttribute('data-ai-count', '1');
  await expect(page.getByTestId('radial-customizer-coverage-starter_circuits-canvas')).toHaveAttribute(
    'data-coverage',
    'full',
  );
  await expect(page.getByTestId('radial-customizer-coverage-starter_circuits-canvas')).toHaveAttribute(
    'data-command-count',
    '8',
  );
  await expect(page.getByTestId('radial-customizer-coverage-starter_circuits-canvas')).toHaveAttribute(
    'data-empty-slot-count',
    '0',
  );
  await expect(page.getByTestId('radial-customizer-coverage-starter_circuits-canvas')).toHaveAttribute(
    'data-ai-count',
    '1',
  );
  await coverageMap.screenshot({
    path: screenshotPath('radial-coverage-map-pass93.png'),
  });
  await smartSuggestion.scrollIntoViewIfNeeded();
  await smartSuggestion.click();
  await expect(page.getByTestId('radial-customizer-draft-status')).toContainText('unsaved');
  await expect(page.getByTestId('radial-customizer-smart-layout-suggestion')).toBeHidden();

  const customizerRect = await customizer.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return {
      left: bounds.left,
      top: bounds.top,
      right: bounds.right,
      bottom: bounds.bottom,
    };
  });
  expect(customizerRect.left).toBeGreaterThanOrEqual(7.5);
  expect(customizerRect.top).toBeGreaterThanOrEqual(7.5);
  expect(customizerRect.right).toBeLessThanOrEqual(352.5);
  expect(customizerRect.bottom).toBeLessThanOrEqual(512.5);
  const expandedCustomizerHeight = customizerRect.bottom - customizerRect.top;

  const bodyScrolls = await page
    .getByTestId('radial-customizer-body')
    .evaluate((element) => element.scrollHeight > element.clientHeight);
  expect(bodyScrolls).toBeTruthy();

  const collapseButton = page.getByTestId('radial-customizer-collapse');
  await expect(collapseButton).toHaveAttribute('aria-expanded', 'true');
  await collapseButton.click();
  await expect(customizer).toHaveAttribute('data-collapsed', 'true');
  await expect(collapseButton).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByTestId('radial-customizer-collapsed-summary')).toBeVisible();
  await expect(page.getByTestId('radial-customizer-body')).toBeHidden();
  await expect(page.getByTestId('radial-customizer-footer')).toBeHidden();

  const collapsedCustomizerHeight = await customizer.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return bounds.height;
  });
  expect(collapsedCustomizerHeight).toBeLessThan(expandedCustomizerHeight);

  await collapseButton.click();
  await expect(customizer).toHaveAttribute('data-collapsed', 'false');
  await expect(page.getByTestId('radial-customizer-body')).toBeVisible();
  await expect(page.getByTestId('radial-customizer-footer')).toBeVisible();
  await expect(consoleIssues).toEqual([]);
});
