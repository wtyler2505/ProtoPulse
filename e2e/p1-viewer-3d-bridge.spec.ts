import { inflateSync } from 'node:zlib';
import { test, expect, type Locator, type Page } from '@playwright/test';
import { getSetupProjectPath } from './e2e-project';

test.use({
  storageState: 'e2e/.auth-state.json',
  viewport: { width: 1366, height: 720 },
});
test.setTimeout(90_000);

function isExternalBrowserDriverWarning(text: string): boolean {
  return text.includes('GL Driver Message') && text.includes('GPU stall due to ReadPixels');
}

function captureConsoleProblems(page: Page): string[] {
  const consoleProblems: string[] = [];
  page.on('console', (message) => {
    const text = message.text();
    if (isExternalBrowserDriverWarning(text)) {
      return;
    }
    if (message.type() === 'error' || message.type() === 'warning') {
      consoleProblems.push(`${message.type()}: ${text}`);
    }
  });
  return consoleProblems;
}

function visibleTestId(page: Page, testId: string): Locator {
  return page.locator(`[data-testid="${testId}"]:visible`).first();
}

function boardViewer3D(page: Page): Locator {
  return visibleTestId(page, 'board-viewer-3d-view');
}

function boardViewerTestId(page: Page, testId: string): Locator {
  return boardViewer3D(page).getByTestId(testId);
}

function webGLEngine(page: Page): Locator {
  return boardViewerTestId(page, 'viewer-3d-webgl-engine');
}

function webGLCanvas(page: Page): Locator {
  return boardViewerTestId(page, 'viewer-3d-webgl-canvas').locator('canvas').first();
}

function paethPredictor(left: number, up: number, upLeft: number): number {
  const estimate = left + up - upLeft;
  const leftDistance = Math.abs(estimate - left);
  const upDistance = Math.abs(estimate - up);
  const upLeftDistance = Math.abs(estimate - upLeft);
  if (leftDistance <= upDistance && leftDistance <= upLeftDistance) {
    return left;
  }
  return upDistance <= upLeftDistance ? up : upLeft;
}

function decodePngLumas(png: Buffer): { width: number; height: number; lumas: Uint8Array } {
  if (png.length < 8 || png.toString('hex', 0, 8) !== '89504e470d0a1a0a') {
    throw new Error('Expected a PNG screenshot buffer');
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idatChunks: Buffer[] = [];

  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.toString('ascii', offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;

    if (type === 'IHDR') {
      width = png.readUInt32BE(dataStart);
      height = png.readUInt32BE(dataStart + 4);
      bitDepth = png[dataStart + 8];
      colorType = png[dataStart + 9];
    } else if (type === 'IDAT') {
      idatChunks.push(png.subarray(dataStart, dataEnd));
    } else if (type === 'IEND') {
      break;
    }

    offset = dataEnd + 4;
  }

  if (width <= 0 || height <= 0 || bitDepth !== 8 || (colorType !== 2 && colorType !== 6)) {
    throw new Error(`Unsupported PNG screenshot format: ${width}x${height}, depth ${bitDepth}, color ${colorType}`);
  }

  const bytesPerPixel = colorType === 6 ? 4 : 3;
  const stride = width * bytesPerPixel;
  const inflated = inflateSync(Buffer.concat(idatChunks));
  const pixels = Buffer.alloc(height * stride);
  let inputOffset = 0;

  for (let y = 0; y < height; y += 1) {
    const filter = inflated[inputOffset];
    inputOffset += 1;
    const rowStart = y * stride;
    const priorRowStart = rowStart - stride;

    for (let x = 0; x < stride; x += 1) {
      const raw = inflated[inputOffset];
      inputOffset += 1;
      const left = x >= bytesPerPixel ? pixels[rowStart + x - bytesPerPixel] : 0;
      const up = y > 0 ? pixels[priorRowStart + x] : 0;
      const upLeft = y > 0 && x >= bytesPerPixel ? pixels[priorRowStart + x - bytesPerPixel] : 0;

      let value = raw;
      if (filter === 1) {
        value = raw + left;
      } else if (filter === 2) {
        value = raw + up;
      } else if (filter === 3) {
        value = raw + Math.floor((left + up) / 2);
      } else if (filter === 4) {
        value = raw + paethPredictor(left, up, upLeft);
      } else if (filter !== 0) {
        throw new Error(`Unsupported PNG filter type: ${filter}`);
      }

      pixels[rowStart + x] = value & 0xff;
    }
  }

  const pixelCount = width * height;
  const lumas = new Uint8Array(pixelCount);
  for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex += 1) {
    const index = pixelIndex * bytesPerPixel;
    lumas[pixelIndex] = Math.round(pixels[index] * 0.2126 + pixels[index + 1] * 0.7152 + pixels[index + 2] * 0.0722);
  }

  return { width, height, lumas };
}

function getPngLumaVariance(png: Buffer): number {
  const { lumas } = decodePngLumas(png);
  let minLuma = 255;
  let maxLuma = 0;
  const step = Math.max(1, Math.floor(lumas.length / 4096));
  for (let pixelIndex = 0; pixelIndex < lumas.length; pixelIndex += step) {
    const luma = lumas[pixelIndex];
    minLuma = Math.min(minLuma, luma);
    maxLuma = Math.max(maxLuma, luma);
  }

  return maxLuma - minLuma;
}

function getPngMeanLumaDelta(before: Buffer, after: Buffer): number {
  const a = decodePngLumas(before);
  const b = decodePngLumas(after);
  if (a.width !== b.width || a.height !== b.height || a.lumas.length !== b.lumas.length) {
    throw new Error(`Cannot diff PNGs of different sizes: ${a.width}x${a.height} vs ${b.width}x${b.height}`);
  }

  const step = Math.max(1, Math.floor(a.lumas.length / 8192));
  let total = 0;
  let count = 0;
  for (let index = 0; index < a.lumas.length; index += step) {
    total += Math.abs(a.lumas[index] - b.lumas[index]);
    count += 1;
  }
  return total / Math.max(1, count);
}

async function seedBreadboardInstance(page: Page): Promise<{ instanceId: number; refDes: string }> {
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
    const circuitsResponse = await window.fetch(`/api/projects/${String(projectId)}/circuits`, { headers });
    if (!circuitsResponse.ok) {
      throw new Error(`Could not load circuits: ${String(circuitsResponse.status)}`);
    }
    const circuits = (await circuitsResponse.json()) as { data: Array<{ id: number; name: string }> };
    let circuit = circuits.data[0];

    if (!circuit) {
      const createCircuitResponse = await window.fetch(`/api/projects/${String(projectId)}/circuits`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          projectId,
          name: `Breadboard 3D bridge ${Date.now()}`,
          description: 'Seeded by p1-viewer-3d-bridge.spec.ts',
        }),
      });
      if (!createCircuitResponse.ok) {
        throw new Error(`Could not seed circuit: ${String(createCircuitResponse.status)}`);
      }
      circuit = (await createCircuitResponse.json()) as { id: number; name: string };
    }

    const refDes = `U${String(Date.now()).slice(-4)}`;
    const instanceResponse = await window.fetch(`/api/circuits/${String(circuit.id)}/instances`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        partId: null,
        referenceDesignator: refDes,
        breadboardX: 70,
        breadboardY: 150,
        breadboardRotation: 0,
        pcbX: 24,
        pcbY: 28,
        pcbRotation: 0,
        pcbSide: 'front',
        properties: {
          componentTitle: 'ATmega328P DIP',
          label: 'ATmega328P DIP',
          type: 'ic',
        },
      }),
    });
    if (!instanceResponse.ok) {
      throw new Error(`Could not seed breadboard instance: ${String(instanceResponse.status)}`);
    }
    const instance = (await instanceResponse.json()) as { id: number };
    return { instanceId: instance.id, refDes };
  });
}

async function seedWebGLSceneGeometry(
  page: Page,
): Promise<{ circuitId: number; refDes: string; expectedMinPadCount: number }> {
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
    const circuitName = `WebGL 3D geometry ${Date.now()}`;
    const createCircuitResponse = await window.fetch(`/api/projects/${String(projectId)}/circuits`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        projectId,
        name: circuitName,
        description: 'Seeded by p1-viewer-3d-bridge.spec.ts',
      }),
    });
    if (!createCircuitResponse.ok) {
      throw new Error(`Could not seed circuit: ${String(createCircuitResponse.status)}`);
    }
    const circuit = (await createCircuitResponse.json()) as { id: number; name?: string };

    const suffix = String(Date.now()).slice(-5);
    const netResponse = await window.fetch(`/api/circuits/${String(circuit.id)}/nets`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: `WEBGL_${suffix}`,
        netType: 'signal',
      }),
    });
    if (!netResponse.ok) {
      throw new Error(`Could not seed WebGL net: ${String(netResponse.status)}`);
    }
    const net = (await netResponse.json()) as { id: number };

    const refDes = `U${suffix}`;
    const instanceResponse = await window.fetch(`/api/circuits/${String(circuit.id)}/instances`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        partId: null,
        referenceDesignator: refDes,
        breadboardX: null,
        breadboardY: null,
        breadboardRotation: 0,
        pcbX: 34,
        pcbY: 32,
        pcbRotation: 90,
        pcbSide: 'front',
        properties: {
          componentTitle: 'WebGL SOIC-8 proof component',
          label: 'WebGL SOIC-8 proof component',
          packageType: 'SOIC-8',
          type: 'ic',
        },
      }),
    });
    if (!instanceResponse.ok) {
      throw new Error(`Could not seed WebGL component: ${String(instanceResponse.status)}`);
    }

    const wireResponse = await window.fetch(`/api/circuits/${String(circuit.id)}/wires`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        netId: net.id,
        view: 'pcb',
        points: [
          { x: 25, y: 28 },
          { x: 42, y: 38 },
          { x: 55, y: 40 },
        ],
        layer: 'front',
        width: 0.3,
        wireType: 'trace',
        provenance: 'manual',
      }),
    });
    if (!wireResponse.ok) {
      throw new Error(`Could not seed WebGL trace: ${String(wireResponse.status)}`);
    }

    const viaResponse = await window.fetch(`/api/circuits/${String(circuit.id)}/vias`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        netId: net.id,
        x: 55,
        y: 40,
        outerDiameter: 0.8,
        drillDiameter: 0.35,
        viaType: 'through',
        layerStart: 'front',
        layerEnd: 'back',
        tented: true,
      }),
    });
    if (!viaResponse.ok) {
      throw new Error(`Could not seed WebGL via: ${String(viaResponse.status)}`);
    }

    const rawSelections = window.localStorage.getItem('protopulse-circuit-selection');
    let selections: Record<string, unknown> = {};
    if (rawSelections) {
      try {
        const parsed = JSON.parse(rawSelections) as unknown;
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          selections = parsed as Record<string, unknown>;
        }
      } catch {
        selections = {};
      }
    }
    selections[String(projectId)] = {
      circuitId: circuit.id,
      circuitName: typeof circuit.name === 'string' ? circuit.name : circuitName,
      selectedAt: Date.now(),
    };
    window.localStorage.setItem('protopulse-circuit-selection', JSON.stringify(selections));

    const [instancesReady, wiresReady, viasReady] = await Promise.all([
      window.fetch(`/api/circuits/${String(circuit.id)}/instances`, { headers }),
      window.fetch(`/api/circuits/${String(circuit.id)}/wires`, { headers }),
      window.fetch(`/api/circuits/${String(circuit.id)}/vias`, { headers }),
    ]);
    if (!instancesReady.ok || !wiresReady.ok || !viasReady.ok) {
      throw new Error('Could not verify seeded WebGL scene API readiness');
    }
    const [instancesBody, wiresBody, viasBody] = (await Promise.all([
      instancesReady.json(),
      wiresReady.json(),
      viasReady.json(),
    ])) as Array<{ total: number }>;
    if ((instancesBody.total ?? 0) < 1 || (wiresBody.total ?? 0) < 1 || (viasBody.total ?? 0) < 1) {
      throw new Error('Seeded WebGL scene API did not expose component, trace, and via data');
    }

    return { circuitId: circuit.id, refDes, expectedMinPadCount: 4 };
  });
}

async function seedComponentEditorPart(page: Page): Promise<{ partId: number; title: string }> {
  return page.evaluate(async () => {
    const sessionId = window.localStorage.getItem('protopulse-session-id');
    const projectId = Number(window.localStorage.getItem('protopulse-e2e-project-id'));
    if (!sessionId || !Number.isFinite(projectId)) {
      throw new Error('Missing Playwright auth project/session state');
    }

    const title = `R26 ATmega328P exact part ${String(Date.now()).slice(-5)}`;
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
          description: 'Seeded Component Editor part for the R26 3D bridge proof.',
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
          verificationNotes: ['Seeded by p1-viewer-3d-bridge.spec.ts for browser bridge proof.'],
          pinAccuracyReport: {
            connectorNames: 'exact',
            electricalRoles: 'exact',
            breadboardAnchors: 'exact',
            unresolved: [],
          },
          breadboardModelQuality: 'verified',
        },
        connectors: [
          { id: 'pin-1', name: 'VCC', kind: 'pin', electricalType: 'power', x: 0, y: 0 },
          { id: 'pin-2', name: 'GND', kind: 'pin', electricalType: 'ground', x: 10, y: 0 },
        ],
        buses: [],
        views: {
          breadboard: { shapes: [] },
          schematic: { shapes: [] },
          pcb: { shapes: [] },
        },
        constraints: [],
      }),
    });
    if (!response.ok) {
      throw new Error(`Could not seed component editor part: ${String(response.status)}`);
    }
    const part = (await response.json()) as { id: number };
    return { partId: part.id, title };
  });
}

async function openDigitalTwinBridgeIn3D(page: Page): Promise<void> {
  await page.goto(getSetupProjectPath('digital_twin'));
  await page.evaluate(() => {
    sessionStorage.removeItem('protopulse:pending-view-in-3d');
  });
  await expectDigitalTwinLoaded(page);
  await page.getByTestId('digital-twin-open-3d').click();
  await expectBoardViewer3DLoaded(page);
  await expect(page.getByTestId('viewer-breadboard-bridge-card')).toContainText('Digital Twin state');
}

async function expectDigitalTwinLoaded(page: Page): Promise<void> {
  await expect(page.getByTestId('digital-twin-view')).toBeVisible({ timeout: 45_000 });
  await expect(page.getByTestId('digital-twin-3d-preview')).toBeVisible({ timeout: 15_000 });
}

async function expectBreadboardViewLoaded(page: Page): Promise<void> {
  await expect(page.getByTestId('breadboard-view')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('breadboard-canvas').or(page.getByTestId('breadboard-empty'))).toBeVisible({
    timeout: 15_000,
  });
}

async function expectBoardViewer3DLoaded(page: Page): Promise<void> {
  await expect(boardViewer3D(page)).toBeVisible({ timeout: 45_000 });
}

async function expectWebGLCanvasHasPixelVariance(page: Page): Promise<void> {
  const viewport = boardViewerTestId(page, 'board-3d-viewport');
  const canvas = webGLCanvas(page);

  await expect
    .poll(
      async () =>
        canvas.evaluate((node) => {
          return node instanceof HTMLCanvasElement ? node.width * node.height : 0;
        }),
      { timeout: 15_000 },
    )
    .toBeGreaterThan(0);

  await page.waitForTimeout(500);
  const screenshot = await viewport.screenshot({ path: 'e2e-results/pp3d-webgl-nonblank-canvas.png' });
  expect(getPngLumaVariance(screenshot)).toBeGreaterThan(5);
}

async function expectWebGLSceneStats(
  page: Page,
  expected: { minComponents: number; minPads: number; minTraces: number; minVias: number },
): Promise<void> {
  const view = boardViewer3D(page);
  const engine = webGLEngine(page);
  const readViewNumberAttribute = async (name: string) => Number((await view.getAttribute(name)) ?? '0');
  const readEngineNumberAttribute = async (name: string) => Number((await engine.getAttribute(name)) ?? '0');
  const sceneDataTimeout = 45_000;
  const engineDataTimeout = 30_000;

  await expect
    .poll(() => readViewNumberAttribute('data-project-scene-component-count'), { timeout: sceneDataTimeout })
    .toBeGreaterThanOrEqual(expected.minComponents);
  await expect
    .poll(() => readViewNumberAttribute('data-project-scene-trace-count'), { timeout: sceneDataTimeout })
    .toBeGreaterThanOrEqual(expected.minTraces);
  await expect
    .poll(() => readViewNumberAttribute('data-project-scene-via-count'), { timeout: sceneDataTimeout })
    .toBeGreaterThanOrEqual(expected.minVias);

  await expect
    .poll(() => readEngineNumberAttribute('data-component-count'), { timeout: engineDataTimeout })
    .toBeGreaterThanOrEqual(expected.minComponents);
  await expect
    .poll(() => readEngineNumberAttribute('data-pad-count'), { timeout: engineDataTimeout })
    .toBeGreaterThanOrEqual(expected.minPads);
  await expect
    .poll(() => readEngineNumberAttribute('data-trace-count'), { timeout: engineDataTimeout })
    .toBeGreaterThanOrEqual(expected.minTraces);
  await expect
    .poll(() => readEngineNumberAttribute('data-via-count'), { timeout: engineDataTimeout })
    .toBeGreaterThanOrEqual(expected.minVias);
}

async function expectWebGLRenderCallsWithinBudget(page: Page): Promise<void> {
  const engine = webGLEngine(page);
  const readEngineNumberAttribute = async (name: string) => Number((await engine.getAttribute(name)) ?? '0');

  await expect
    .poll(
      async () => {
        const calls = await readEngineNumberAttribute('data-render-calls');
        const budget = await readEngineNumberAttribute('data-render-call-budget');
        return calls > 0 && budget > 0 && calls <= budget;
      },
      { timeout: 15_000 },
    )
    .toBe(true);
}

async function expectWebGLLayerToggleChangesCanvas(page: Page): Promise<void> {
  const engine = webGLEngine(page);
  const canvas = webGLCanvas(page);

  await expect(engine).toHaveAttribute('data-layer-substrate-visible', 'true');
  const before = await canvas.screenshot();
  await boardViewerTestId(page, 'viewer-3d-webgl-layer-toggle-substrate').click();
  await expect(engine).toHaveAttribute('data-layer-substrate-visible', 'false');
  await page.waitForTimeout(300);
  const after = await canvas.screenshot();
  expect(getPngMeanLumaDelta(before, after)).toBeGreaterThan(2);

  await boardViewerTestId(page, 'viewer-3d-webgl-layer-toggle-substrate').click();
  await expect(engine).toHaveAttribute('data-layer-substrate-visible', 'true');
  await boardViewerTestId(page, 'viewer-3d-webgl-layer-panel-collapse').click();
  await expect(boardViewerTestId(page, 'viewer-3d-webgl-layer-row-substrate')).toBeHidden();
}

async function expectWebGLComponentTooltipCanBeShown(page: Page): Promise<void> {
  const engine = webGLEngine(page);
  const canvas = webGLCanvas(page);
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();

  const xStops = [0.18, 0.26, 0.34, 0.42, 0.5, 0.58, 0.66, 0.74];
  const yStops = [0.38, 0.46, 0.54, 0.62, 0.7];
  for (const y of yStops) {
    for (const x of xStops) {
      await canvas.hover({
        position: {
          x: Math.round((box?.width ?? 0) * x),
          y: Math.round((box?.height ?? 0) * y),
        },
      });
      const hoveredRefDes = (await engine.getAttribute('data-hovered-refdes')) ?? '';
      if (hoveredRefDes.length > 0) {
        const tooltip = boardViewerTestId(page, 'viewer-3d-webgl-tooltip');
        await expect(tooltip).toBeVisible({ timeout: 10_000 });
        await expect(tooltip).toHaveAttribute('data-refdes', hoveredRefDes);
        return;
      }
    }
  }

  throw new Error('Could not show a rendered WebGL component tooltip from canvas hover');
}

async function expectWebGLMeasureToolDrawsMmLabel(page: Page): Promise<void> {
  const engine = webGLEngine(page);
  const canvas = webGLCanvas(page);
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();

  await boardViewerTestId(page, 'viewer-3d-webgl-measure-toggle').click();
  await expect(engine).toHaveAttribute('data-measure-active', 'true');
  await boardViewerTestId(page, 'viewer-3d-webgl-tools-panel-collapse').click();
  await expect(boardViewerTestId(page, 'viewer-3d-webgl-measure-toggle')).toBeHidden();
  await canvas.click({
    position: {
      x: Math.round((box?.width ?? 0) * 0.42),
      y: Math.round((box?.height ?? 0) * 0.56),
    },
  });
  await expect(engine).toHaveAttribute('data-measure-pending', 'true');
  await canvas.click({
    position: {
      x: Math.round((box?.width ?? 0) * 0.58),
      y: Math.round((box?.height ?? 0) * 0.56),
    },
  });
  await expect(engine).toHaveAttribute('data-measure-segment-count', '1');

  const distance = (await engine.getAttribute('data-latest-measure-distance-mm')) ?? '';
  expect(distance).toMatch(/^\d+\.\d{2}$/);
  const label = boardViewerTestId(page, 'viewer-3d-webgl-measure-label').first();
  await expect(label).toBeVisible({ timeout: 10_000 });
  await expect(label).toHaveText(`${distance} mm`);

  await boardViewerTestId(page, 'viewer-3d-webgl-tools-panel-collapse').click();
  await expect(boardViewerTestId(page, 'viewer-3d-webgl-measure-toggle')).toBeVisible();
  await boardViewerTestId(page, 'viewer-3d-webgl-measure-toggle').click();
  await expect(engine).toHaveAttribute('data-measure-active', 'false');
  await boardViewerTestId(page, 'viewer-3d-webgl-measure-clear').click();
  await expect(engine).toHaveAttribute('data-measure-segment-count', '0');
}

async function expectWebGLSectionPlaneChangesCanvas(page: Page): Promise<void> {
  const engine = webGLEngine(page);
  const canvas = webGLCanvas(page);

  await expect(engine).toHaveAttribute('data-section-enabled', 'false');
  const before = await canvas.screenshot();
  await boardViewerTestId(page, 'viewer-3d-webgl-section-toggle').click();
  await expect(engine).toHaveAttribute('data-section-enabled', 'true');
  await page.waitForTimeout(300);
  const after = await canvas.screenshot();
  expect(getPngMeanLumaDelta(before, after)).toBeGreaterThan(1);

  await boardViewerTestId(page, 'viewer-3d-webgl-section-slider').fill('8');
  await expect(engine).toHaveAttribute('data-section-constant', '8.00');

  await boardViewerTestId(page, 'viewer-3d-webgl-section-toggle').click();
  await expect(engine).toHaveAttribute('data-section-enabled', 'false');
  await boardViewerTestId(page, 'viewer-3d-webgl-tools-panel-collapse').click();
  await expect(boardViewerTestId(page, 'viewer-3d-webgl-section-row')).toBeHidden();
}

async function expectWebGLExplodeCameraAndKeyboardControls(page: Page): Promise<void> {
  const engine = webGLEngine(page);
  const canvas = webGLCanvas(page);

  await expect(engine).toHaveAttribute('data-exploded', 'false');
  const before = await canvas.screenshot();
  await boardViewerTestId(page, 'viewer-3d-webgl-explode-toggle').click();
  await expect(engine).toHaveAttribute('data-exploded', 'true');
  await expect
    .poll(async () => Number((await engine.getAttribute('data-explode-progress')) ?? '0'), { timeout: 10_000 })
    .toBeGreaterThan(0.95);
  const after = await canvas.screenshot();
  expect(getPngMeanLumaDelta(before, after)).toBeGreaterThan(0.5);

  await boardViewerTestId(page, 'viewer-3d-webgl-camera-iso').click();
  await expect(engine).toHaveAttribute('data-camera-preset', 'iso');
  await expect(boardViewerTestId(page, 'viewer-3d-webgl-camera-status')).toContainText('Iso view');

  await boardViewerTestId(page, 'viewer-3d-webgl-camera-flip').click();
  await expect(engine).toHaveAttribute('data-camera-preset', 'bottom');

  await engine.focus();
  await page.keyboard.press('ArrowRight');
  await expect(engine).toHaveAttribute('data-camera-command', 'Orbit right');
  await page.keyboard.press('1');
  await expect(engine).toHaveAttribute('data-camera-preset', 'iso');
  await page.keyboard.press('r');
  await expect(engine).toHaveAttribute('data-camera-preset', 'home');
}

async function expectWebGLComponentCanBeSelected(page: Page): Promise<void> {
  const engine = webGLEngine(page);
  const inspector = boardViewerTestId(page, 'viewer-3d-webgl-inspector');
  const canvas = webGLCanvas(page);
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();

  const xStops = [0.18, 0.26, 0.34, 0.42, 0.5, 0.58, 0.66, 0.74];
  const yStops = [0.38, 0.46, 0.54, 0.62, 0.7];
  for (const y of yStops) {
    for (const x of xStops) {
      await canvas.click({
        position: {
          x: Math.round((box?.width ?? 0) * x),
          y: Math.round((box?.height ?? 0) * y),
        },
      });
      const selectedComponentId = (await engine.getAttribute('data-selected-component-id')) ?? '';
      if (selectedComponentId.length > 0) {
        await expect(inspector).toBeVisible({ timeout: 10_000 });
        await expect(inspector).toHaveAttribute('data-selected-component-id', selectedComponentId);
        await expect(boardViewerTestId(page, 'viewer-3d-webgl-inspector-package')).not.toHaveText('');
        await boardViewerTestId(page, 'viewer-3d-webgl-inspector-clear').click();
        await expect(engine).toHaveAttribute('data-selected-component-id', '');
        return;
      }
    }
  }

  throw new Error('Could not select a rendered WebGL component from canvas clicks');
}

async function expectComponentEditorLoaded(page: Page): Promise<void> {
  await expect(page.getByTestId('component-editor')).toBeVisible({ timeout: 45_000 });
}

async function expectGenerativeDesignLoaded(page: Page): Promise<void> {
  await expect(page.getByTestId('generative-design-view')).toBeAttached({ timeout: 45_000 });
  await expect(page.getByTestId('spec-description-input')).toBeVisible({ timeout: 15_000 });
}

test('WebGL engine renders a nonblank board canvas when the feature flag is enabled', async ({ page }) => {
  test.setTimeout(150_000);
  const consoleProblems = captureConsoleProblems(page);

  await page.goto(getSetupProjectPath());
  await page.evaluate(() => {
    localStorage.setItem('protopulse-viewer3d-engine', 'webgl');
    sessionStorage.removeItem('protopulse:pending-view-in-3d');
  });
  const seeded = await seedWebGLSceneGeometry(page);
  await page.goto('about:blank');
  await page.goto(getSetupProjectPath('viewer_3d'));

  await expectBoardViewer3DLoaded(page);
  await expect(boardViewerTestId(page, 'viewer-3d-engine-webgl')).toHaveAttribute('data-active', 'true');
  await expectWebGLSceneStats(page, {
    minComponents: 1,
    minPads: seeded.expectedMinPadCount,
    minTraces: 1,
    minVias: 1,
  });
  await expectWebGLCanvasHasPixelVariance(page);
  await expectWebGLRenderCallsWithinBudget(page);
  await expectWebGLLayerToggleChangesCanvas(page);
  await expectWebGLMeasureToolDrawsMmLabel(page);
  await expectWebGLExplodeCameraAndKeyboardControls(page);
  await expectWebGLSectionPlaneChangesCanvas(page);
  await expectWebGLComponentTooltipCanBeShown(page);
  await expectWebGLComponentCanBeSelected(page);

  await page.evaluate(() => {
    localStorage.removeItem('protopulse-viewer3d-engine');
  });
  expect(consoleProblems).toEqual([]);
});

test('community 3D model opens the 3D viewer with provenance context', async ({ page }) => {
  await page.goto(getSetupProjectPath());
  await page.evaluate(() => {
    sessionStorage.removeItem('protopulse:pending-view-in-3d');
  });

  await page.waitForSelector('[data-testid="sidebar-nav"], [data-testid="workspace-main"]', {
    timeout: 15_000,
  });

  await page.getByRole('button', { name: /Community/ }).click();
  await page.getByTestId('community-view').waitFor({ state: 'visible', timeout: 10_000 });
  await page.getByTestId('community-card-seed-dip8').click();

  const dialog = page.getByTestId('community-detail-dialog');
  await expect(dialog).toBeVisible({ timeout: 5_000 });
  await dialog.getByTestId('detail-view-3d-btn').click();

  await expectBoardViewer3DLoaded(page);
  const bridgeCard = page.getByTestId('viewer-breadboard-bridge-card');
  await expect(bridgeCard).toBeVisible();
  await expect(bridgeCard).toContainText('Community 3D model');
  await expect(bridgeCard).toContainText('DIP-8 3D Package');
  await expect(bridgeCard).toContainText('3DModelPro');
  await expect(bridgeCard).toContainText('reputation 78');
  await expect(bridgeCard).toContainText('community-only');
  await expect(bridgeCard).toContainText('STEP');
  await page.screenshot({ path: 'e2e-results/r36-community-3d-provenance.png', fullPage: true });
});

test('component editor selected exact part opens the 3D viewer with verification context', async ({ page }) => {
  const consoleProblems = captureConsoleProblems(page);

  await page.goto(getSetupProjectPath());
  await page.evaluate(() => {
    sessionStorage.removeItem('protopulse:pending-view-in-3d');
  });
  const { partId, title } = await seedComponentEditorPart(page);

  await page.goto(getSetupProjectPath('component_editor'));
  await expectComponentEditorLoaded(page);
  await page.getByTestId(`part-item-${String(partId)}`).click();
  await expect(page.getByTestId('input-meta-title')).toHaveValue(title, { timeout: 10_000 });
  await expect(page.getByTestId('button-view-3d')).toBeEnabled();
  await page.getByTestId('button-view-3d').click();

  await expectBoardViewer3DLoaded(page);
  const bridgeCard = page.getByTestId('viewer-breadboard-bridge-card');
  await expect(bridgeCard).toBeVisible();
  await expect(bridgeCard).toContainText('Component Editor selection');
  await expect(bridgeCard).toContainText(title);
  await expect(bridgeCard).toContainText('board module');
  await expect(bridgeCard).toContainText('official-backed');
  await expect(bridgeCard).toContainText('pin map exact');
  await expect(bridgeCard).toContainText('DIP-8');
  await expect(bridgeCard).toContainText('ready now');
  await page.screenshot({ path: 'e2e-results/r26-component-editor-3d-bridge.png', fullPage: true });

  expect(consoleProblems).toEqual([]);
});

test('breadboard selected part opens the 3D viewer with trust provenance context', async ({ page }) => {
  await page.goto(getSetupProjectPath());
  await page.evaluate(() => {
    sessionStorage.removeItem('protopulse:pending-view-in-3d');
  });
  const { instanceId, refDes } = await seedBreadboardInstance(page);

  await page
    .getByRole('button', { name: /^Breadboard$/ })
    .first()
    .click();
  await expect(page.getByTestId('breadboard-view')).toBeVisible({ timeout: 45_000 });
  await expect(page.getByTestId('breadboard-canvas')).toBeVisible({ timeout: 45_000 });

  const instance = page.getByTestId(`bb-instance-${String(instanceId)}`);
  await instance.waitFor({ state: 'visible', timeout: 45_000 });
  await instance.locator('rect').first().dispatchEvent('click');

  await expect(page.getByTestId('breadboard-part-inspector')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId('breadboard-part-inspector')).toContainText(refDes);
  await page.getByTestId('breadboard-view-in-3d').click();

  await expectBoardViewer3DLoaded(page);
  const bridgeCard = page.getByTestId('viewer-breadboard-bridge-card');
  await expect(bridgeCard).toBeVisible();
  await expect(bridgeCard).toContainText('Breadboard selection');
  await expect(bridgeCard).toContainText(refDes);
  await expect(bridgeCard).toContainText('pin map');
  await expect(bridgeCard).toContainText(/community-only|verified|unknown/);
  await expect(bridgeCard).toContainText(/health clean|health warning|health critical/);
  await expect(bridgeCard).toContainText(/ready now|needs review/);
  await page.screenshot({ path: 'e2e-results/r24-breadboard-view-in-3d.png', fullPage: true });
});

test('generative candidate opens the 3D viewer with AI provenance context', async ({ page }) => {
  const consoleProblems = captureConsoleProblems(page);

  await page.goto(getSetupProjectPath('generative_design'));
  await page.evaluate(() => {
    sessionStorage.removeItem('protopulse:pending-view-in-3d');
  });
  await expectGenerativeDesignLoaded(page);

  await page.getByTestId('spec-description-input').fill('R26 low-noise LED driver for 12V bench testing');
  await page.getByTestId('population-size-input').fill('2');
  await page.getByTestId('generations-input').fill('1');
  await page.getByTestId('generate-button').click();

  const candidateCard = page.locator('[data-testid^="candidate-card-"]').first();
  await expect(candidateCard).toBeVisible({ timeout: 20_000 });
  await page.locator('[data-testid^="view-3d-button-"]').first().click();

  await expectBoardViewer3DLoaded(page);
  const bridgeCard = page.getByTestId('viewer-breadboard-bridge-card');
  await expect(bridgeCard).toBeVisible();
  await expect(bridgeCard).toContainText('Generative candidate');
  await expect(bridgeCard).toContainText('Generative design engine');
  await expect(bridgeCard).toContainText('ai generated');
  await expect(bridgeCard).toContainText('generated');
  await expect(bridgeCard).toContainText(/Fitness \d/);
  await expect(bridgeCard).toContainText(/fitness \d/);
  await expect(bridgeCard).toContainText(/\d+ component/);
  await expect(bridgeCard).toContainText('needs review');
  await page.screenshot({ path: 'e2e-results/r26-generative-3d-bridge.png', fullPage: true });

  expect(consoleProblems).toEqual([]);
});

test('digital twin opens the 3D viewer with telemetry provenance context', async ({ page }) => {
  const consoleProblems = captureConsoleProblems(page);

  await page.goto(getSetupProjectPath());
  await page.evaluate(() => {
    sessionStorage.removeItem('protopulse:pending-view-in-3d');
  });

  await page.waitForSelector('[data-testid="sidebar-nav"], [data-testid="workspace-main"]', {
    timeout: 15_000,
  });

  await page.getByRole('button', { name: /Digital Twin/ }).click();
  await expectDigitalTwinLoaded(page);
  await expect(page.getByTestId('digital-twin-next-actions')).toContainText('Generate firmware manifest');
  await expect(page.getByTestId('digital-twin-live-channel-count')).toContainText('0');
  await expect(page.getByTestId('digital-twin-pin-count')).toContainText('0');
  await expect(page.getByTestId('digital-twin-net-count')).toContainText('0');
  await page.screenshot({ path: 'e2e-results/r22-digital-twin-3d-preview.png', fullPage: true });

  await page.getByTestId('digital-twin-open-3d').click();

  await expectBoardViewer3DLoaded(page);
  const bridgeCard = page.getByTestId('viewer-breadboard-bridge-card');
  await expect(bridgeCard).toBeVisible();
  await expect(bridgeCard).toContainText('Digital Twin state');
  await expect(bridgeCard).toContainText('Digital Twin telemetry');
  await expect(bridgeCard).toContainText('0 live of 0 channels');
  await expect(bridgeCard).toContainText('telemetry preview');
  await expect(bridgeCard).toContainText('unconfigured');
  await expect(bridgeCard).toContainText('0/0 live channels');
  await expect(bridgeCard).toContainText('health no-comparison');
  const overlay = page.getByTestId('viewer-3d-digital-twin-overlay');
  await expect(overlay).toBeVisible();
  await expect(overlay).toContainText('Digital Twin live-state');
  await expect(page.getByTestId('viewer-3d-live-overlay-channels')).toContainText('0/0');
  await expect(page.getByTestId('viewer-3d-live-overlay-pins')).toContainText('0');
  await expect(page.getByTestId('viewer-3d-live-overlay-nets')).toContainText('0');
  await expect(page.getByTestId('viewer-3d-live-overlay-confidence')).toContainText('unconfigured');
  await expect(page.getByTestId('viewer-3d-live-overlay-model')).toContainText('behavior preview');
  await expect(page.getByTestId('viewer-3d-open-digital-twin')).toBeVisible();
  await expect(page.getByTestId('viewer-3d-fix-breadboard')).toBeVisible();
  await expect(page.getByTestId('viewer-3d-fix-component-editor')).toBeVisible();
  await page.screenshot({ path: 'e2e-results/r22-digital-twin-3d-bridge.png', fullPage: true });
  await page.screenshot({ path: 'e2e-results/r27-digital-twin-3d-live-state-overlay.png', fullPage: true });

  expect(consoleProblems).toEqual([]);
});

test('digital twin direct repair links navigate to Breadboard and Component Editor', async ({ page }) => {
  const consoleProblems = captureConsoleProblems(page);

  await page.goto(getSetupProjectPath('digital_twin'));
  await page.evaluate(() => {
    sessionStorage.removeItem('protopulse:pending-view-in-3d');
  });
  await expectDigitalTwinLoaded(page);

  await page.getByTestId('digital-twin-fix-breadboard').click();
  await expectBreadboardViewLoaded(page);
  await expect(page.getByTestId('breadboard-digital-twin-repair-context')).toBeVisible();
  await expect(page.getByTestId('breadboard-digital-twin-repair-summary')).toContainText('0/0 live channels');

  await page.goto(getSetupProjectPath('digital_twin'));
  await expectDigitalTwinLoaded(page);
  await page.getByTestId('digital-twin-fix-component-editor').click();
  await expectComponentEditorLoaded(page);
  await expect(page.getByTestId('component-editor-digital-twin-repair-context')).toBeVisible();
  await expect(page.getByTestId('component-editor-open-repair-exact-draft')).toBeVisible();

  expect(consoleProblems).toEqual([]);
});

test('3D Digital Twin bridge returns to Digital Twin', async ({ page }) => {
  const consoleProblems = captureConsoleProblems(page);

  await openDigitalTwinBridgeIn3D(page);
  await page.getByTestId('viewer-3d-open-digital-twin').click();
  await expectDigitalTwinLoaded(page);

  expect(consoleProblems).toEqual([]);
});

test('3D Digital Twin bridge repair link navigates to Breadboard', async ({ page }) => {
  const consoleProblems = captureConsoleProblems(page);

  await openDigitalTwinBridgeIn3D(page);
  await page.getByTestId('viewer-3d-fix-breadboard').click();
  await expectBreadboardViewLoaded(page);
  await expect(page.getByTestId('breadboard-digital-twin-repair-context')).toBeVisible();

  expect(consoleProblems).toEqual([]);
});

test('3D Digital Twin bridge repair link navigates to Component Editor', async ({ page }) => {
  const consoleProblems = captureConsoleProblems(page);

  await openDigitalTwinBridgeIn3D(page);
  await page.getByTestId('viewer-3d-fix-component-editor').click();
  await expectComponentEditorLoaded(page);
  await expect(page.getByTestId('component-editor-digital-twin-repair-context')).toBeVisible();

  expect(consoleProblems).toEqual([]);
});

test('digital twin live telemetry binds to real 3D pins and nets', async ({ page }) => {
  const consoleProblems = captureConsoleProblems(page);

  await page.goto(getSetupProjectPath());
  await page.evaluate(() => {
    sessionStorage.removeItem('protopulse:pending-view-in-3d');
  });
  const { refDes } = await seedBreadboardInstance(page);

  await page.evaluate(
    ({ liveRefDes }) => {
      const projectId = Number(localStorage.getItem('protopulse-e2e-project-id'));
      sessionStorage.setItem(
        'protopulse:pending-view-in-3d',
        JSON.stringify({
          sourceView: 'digital-twin',
          projectId,
          title: `${liveRefDes} telemetry`,
          subtitle: '1 live of 1 channel',
          trustTier: 'live-telemetry',
          verificationLevel: 'live',
          verificationStatus: 'warn',
          readyNow: true,
          channelCount: 1,
          liveChannelCount: 1,
          pinCount: 1,
          netCount: 1,
          healthStatus: 'warn',
          stateConfidence: 'live',
          modelKind: 'behavior-preview',
          liveChannels: [
            {
              id: 'pin-0',
              name: 'Button',
              value: 'HIGH',
              state: 'live',
              pin: 0,
              refDes: liveRefDes,
              pinLabel: 'pin-0',
              netName: 'BUTTON',
            },
          ],
          createdAt: Date.now(),
        }),
      );
    },
    { liveRefDes: refDes },
  );

  await page.goto(getSetupProjectPath('viewer_3d'));

  await expectBoardViewer3DLoaded(page);
  const bridgeCard = page.getByTestId('viewer-breadboard-bridge-card');
  await expect(bridgeCard).toBeVisible();
  await expect(bridgeCard).toContainText('Digital Twin state');
  await expect(bridgeCard).toContainText(`${refDes} telemetry`);
  await expect(bridgeCard).toContainText('1 live of 1 channel');
  await expect(bridgeCard).toContainText('live');
  await expect(bridgeCard).toContainText('health warn');

  const overlay = page.getByTestId('viewer-3d-digital-twin-overlay');
  await expect(overlay).toBeVisible();
  await expect(page.getByTestId('viewer-3d-live-overlay-channels')).toContainText('1/1');
  await expect(page.getByTestId('viewer-3d-live-overlay-pins')).toContainText('1');
  await expect(page.getByTestId('viewer-3d-live-overlay-nets')).toContainText('1');
  await expect(page.getByTestId('viewer-3d-live-overlay-confidence')).toContainText('live');

  const netBadge = page.getByTestId('viewer-3d-net-state-BUTTON-pin-0');
  await expect(netBadge).toBeVisible({ timeout: 15_000 });
  await expect(netBadge).toContainText('BUTTON');
  await expect(netBadge).toContainText(`${refDes}:pin-0 HIGH`);
  await expect(netBadge).toHaveAttribute('data-state', 'live');

  const pinHotspot = page.locator('[data-testid^="component-3d-pin-hotspot-"]').first();
  await expect(pinHotspot).toBeVisible();
  await expect(pinHotspot).toHaveAttribute('data-state', 'live');
  await expect(pinHotspot).toHaveAttribute('aria-label', new RegExp(`${refDes} pin-0 live telemetry: Button HIGH`));
  await page.screenshot({ path: 'e2e-results/r50-digital-twin-3d-live-pin-binding.png', fullPage: true });

  await page.getByTestId('viewer-3d-fix-component-editor').click();
  await expectComponentEditorLoaded(page);
  const componentRepairContext = page.getByTestId('component-editor-digital-twin-repair-context');
  await expect(componentRepairContext).toBeVisible();
  await expect(componentRepairContext).toContainText(refDes);
  await expect(componentRepairContext).toContainText('pin-0');
  await expect(componentRepairContext).toContainText('BUTTON');
  await page.getByTestId('component-editor-open-repair-exact-draft').click();
  await expect(page.getByTestId('exact-part-draft-modal')).toBeVisible();
  await expect(page.getByTestId('input-exact-part-description')).toHaveValue(
    /Digital Twin repair context for .+pin pin-0[\s\S]+net BUTTON[\s\S]+value HIGH/,
  );
  await page.screenshot({ path: 'e2e-results/r53-digital-twin-component-exact-draft-seed.png', fullPage: true });
  await page.getByTestId('button-cancel-exact-part').click();

  await page.goto(getSetupProjectPath('viewer_3d'));
  await expectBoardViewer3DLoaded(page);
  await page.getByTestId('viewer-3d-fix-breadboard').click();
  await expectBreadboardViewLoaded(page);
  const repairContext = page.getByTestId('breadboard-digital-twin-repair-context');
  await expect(repairContext).toBeVisible();
  await expect(repairContext).toContainText(refDes);
  await expect(repairContext).toContainText('pin-0');
  await expect(repairContext).toContainText('BUTTON');
  await expect(page.getByTestId('breadboard-part-inspector')).toContainText(refDes, { timeout: 15_000 });
  const breadboardRepairOverlay = page.getByTestId('breadboard-digital-twin-pin-net-overlay');
  await expect(breadboardRepairOverlay).toBeVisible({ timeout: 15_000 });
  await expect(breadboardRepairOverlay).toHaveAttribute('data-ref-des', refDes);
  await expect(breadboardRepairOverlay).toHaveAttribute('data-pin', 'pin-0');
  await expect(breadboardRepairOverlay).toHaveAttribute('data-net', 'BUTTON');
  await expect(breadboardRepairOverlay).toHaveAttribute('data-state', 'live');
  await expect(breadboardRepairOverlay).toContainText(refDes);
  await expect(breadboardRepairOverlay).toContainText('pin-0');
  await expect(breadboardRepairOverlay).toContainText('BUTTON');
  await page.screenshot({ path: 'e2e-results/r52-digital-twin-breadboard-repair-context.png', fullPage: true });

  expect(consoleProblems).toEqual([]);
});
