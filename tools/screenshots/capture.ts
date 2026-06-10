/**
 * Reproducible screenshot rig — same philosophy as tools/golden: the
 * images embedded in the docs are ARTIFACTS OF THIS SCRIPT, never hand
 * crops. UI changes that alter these views regenerate the whole set in
 * the same PR.
 *
 *     npx tsx tools/screenshots/capture.ts
 *
 * The rig boots the new editor's dev server (reusing one already on
 * :5174), drives the real UI through Playwright over the system Chrome,
 * and writes PNGs to docs/screenshots/. Shared plumbing (fixture
 * bundles, server lifecycle, locator helpers) lives in rig.ts — the
 * animated capture (capture-gif.ts) drives the same machinery.
 *
 * Each shot is an independent step: a failure logs and the rig moves on,
 * so one flaky panel never costs the whole set.
 */

import { mkdirSync } from 'node:fs';

import { chromium } from 'playwright-core';

import {
  blinkFirmware,
  bytesToIntelHex,
  checkOnlyTraces,
  CHROME,
  closeEditor,
  ensureServer,
  log,
  openEditor,
  OUT_DIR,
  resultRegionFits,
  save,
  scrollPanelTo,
  selectField,
  stopServer,
  tab,
  waitForResultOrError,
  zoomFit,
} from './rig';

import type { Browser, Page } from 'playwright-core';

/** Generous ceilings — first runs boot the ngspice WASM engine. */
const SIM_WAIT_MS = 120_000;
const COSIM_WAIT_MS = 150_000;

// ── Shots ────────────────────────────────────────────────────────────

/** 1. The 555 astable with three LED branches, fitted. */
async function shotSchematic(browser: Browser): Promise<void> {
  const page = await openEditor(browser, 'traffic-light-555');
  await zoomFit(page);
  await save(page, 'schematic.png');
  await closeEditor(page);
}

/** 2. The Lab: default transient — fidelity bar, trace toggles, plot,
 *  all in frame. traffic-light-555 first; led-resistor is the fallback
 *  when the 555 errors OR when its macromodel's ~25 internal vectors
 *  make the trace list too tall to show the bar and the plot together. */
async function shotSimPanel(browser: Browser): Promise<void> {
  const runOn = async (fixture: string, force: boolean): Promise<'ok' | 'error' | 'tall'> => {
    const page = await openEditor(browser, fixture);
    await zoomFit(page);
    await tab(page, 'Sim').click();
    await page.locator('button.sim-run').click();
    const status = await waitForResultOrError(page, '.fidelity-bar', SIM_WAIT_MS);
    if (status === 'error') {
      log(`sim on ${fixture} errored: ${(await page.locator('.sim-error').first().textContent()) ?? '?'}`);
      await closeEditor(page);
      return 'error';
    }
    // Plot node voltages (the design's story) instead of whatever two
    // vectors the runner auto-picked — prefer output/timing nodes.
    const names = (await page.locator('.trace-list .trace-name').allTextContents()).map((n) =>
      n.trim(),
    );
    const preferred = names.filter((n) => /^v\((out|timing|led)/i.test(n));
    const voltages = names.filter((n) => /^v\(/i.test(n));
    const wanted = [...new Set([...preferred, ...voltages])].slice(0, 2);
    if (wanted.length > 0) await checkOnlyTraces(page, wanted);
    await page.waitForTimeout(500); // plot paint
    if (!force && !(await resultRegionFits(page, '.panel-body.sim-panel'))) {
      log(`sim panel on ${fixture} is too tall for one frame (fidelity bar + plot)`);
      await closeEditor(page);
      return 'tall';
    }
    await scrollPanelTo(page, '.panel-body.sim-panel', '.fidelity-bar');
    await save(page, 'sim-panel.png');
    await closeEditor(page);
    return 'ok';
  };
  if ((await runOn('traffic-light-555', false)) !== 'ok') {
    log('falling back to led-resistor for sim-panel.png');
    await runOn('led-resistor', true);
  }
}

/** 3. The board canvas: routed-led's pads, F.Cu trace, and via. */
async function shotPcbMode(browser: Browser): Promise<void> {
  const page = await openEditor(browser, 'routed-led');
  await page.getByRole('button', { name: 'PCB', exact: true }).click();
  await page.waitForTimeout(500);
  await zoomFit(page);
  await save(page, 'pcb-mode.png');
  await closeEditor(page);
}

/** Click around the canvas centre until the Inspector shows `ref`.
 *  Returns false if the grid search never lands on it. */
async function selectByRef(page: Page, ref: string): Promise<boolean> {
  const canvas = page.locator('.canvas-wrap canvas');
  const box = await canvas.boundingBox();
  if (!box) return false;
  // led-resistor is three symbols in a row; after Zoom fit the middle
  // one (R1) sits near the canvas centre. Sweep outward from there.
  const fractions: [number, number][] = [
    [0.5, 0.5], [0.5, 0.45], [0.5, 0.55], [0.47, 0.5], [0.53, 0.5],
    [0.5, 0.4], [0.5, 0.6], [0.45, 0.5], [0.55, 0.5], [0.5, 0.35],
    [0.5, 0.65], [0.42, 0.5], [0.58, 0.5],
  ];
  for (const [fx, fy] of fractions) {
    await canvas.click({ position: { x: box.width * fx, y: box.height * fy } });
    await page.waitForTimeout(150);
    const text = (await page.locator('.inspector-grid').textContent().catch(() => null)) ?? '';
    if (text.includes(ref)) return true;
  }
  return false;
}

/** 4. Branches panel with the diff overlay on: fork try-alt from main,
 *  bump R1's value through the Inspector, diff against main. The edit is
 *  best-effort — the panel + overlay toggle is the shot either way. */
async function shotBranchDiff(browser: Browser): Promise<void> {
  const page = await openEditor(browser, 'led-resistor');
  await zoomFit(page);

  await tab(page, 'Branches').click();
  await page.locator('button.primary-button', { hasText: '+ New branch from' }).click();
  await page.waitForTimeout(300); // now on try-alt

  // Best-effort edit so the diff has something amber to show.
  await tab(page, 'Inspector').click();
  if (await selectByRef(page, 'R1')) {
    const value = page.locator('.value-input');
    await value.fill('1k');
    await value.press('Enter');
    await page.waitForTimeout(300);
    log('changed R1 value to 1k on try-alt');
  } else {
    log('could not select R1 on canvas — showing the diff panel without an edit');
  }

  await tab(page, 'Branches').click();
  await page.locator('button.diff-toggle').first().click(); // diff vs main
  await page.waitForTimeout(500);
  await save(page, 'branch-diff.png');
  await closeEditor(page);
}

/** 5. Co-sim (best effort): load blink via the Firmware tab, run it
 *  long enough to register B5, bind B5 → LED_A, run the default 500 µs
 *  window, screenshot the square-wave-over-analog plot. */
async function shotCosim(browser: Browser): Promise<void> {
  const page = await openEditor(browser, 'led-resistor');
  await zoomFit(page);

  // Firmware tab: paste the HEX, Load, Run briefly so B5 shows up in
  // the seen-pin list, then Pause.
  await tab(page, 'Firmware').click();
  await page.getByLabel('Intel HEX firmware').fill(bytesToIntelHex(blinkFirmware()));
  await page.locator('.firmware-controls button', { hasText: /^Load$/ }).click();
  await page.locator('.firmware-panel .muted', { hasText: 'Firmware loaded' }).waitFor({
    timeout: 30_000,
  });
  await page.locator('.firmware-controls button', { hasText: /^Run$/ }).click();
  await page
    .locator('.firmware-panel .trace-name', { hasText: /^B5$/ })
    .waitFor({ timeout: 15_000 });
  await page.locator('.firmware-controls button', { hasText: /^Pause$/ }).click();

  // Co-sim tab: bind B5 → LED_A, run the default 500 µs / 1 µs window.
  await tab(page, 'Co-sim').click();
  await selectField(page, 'pin').selectOption('B5');
  await selectField(page, 'net').selectOption({ label: 'LED_A' });
  await page.getByRole('button', { name: 'Add binding' }).click();
  await page.locator('button.sim-run', { hasText: 'Run co-sim' }).click();

  const status = await waitForResultOrError(page, '.cosim-panel .fidelity-bar', COSIM_WAIT_MS);
  if (status === 'error') {
    throw new Error(
      `co-sim errored: ${(await page.locator('.sim-error').first().textContent()) ?? '?'}`,
    );
  }
  await page.waitForTimeout(500); // plot paint
  // The money plot sits at the bottom of a long panel — pin the result
  // block (honesty readout → fidelity bar → traces → plot) into frame.
  await scrollPanelTo(page, '.panel-body.cosim-panel', '.firmware-readout');
  await save(page, 'cosim.png');
  await closeEditor(page);
}

// ── Main ─────────────────────────────────────────────────────────────

const SHOTS: [string, (browser: Browser) => Promise<void>][] = [
  ['schematic.png', shotSchematic],
  ['sim-panel.png', shotSimPanel],
  ['pcb-mode.png', shotPcbMode],
  ['branch-diff.png', shotBranchDiff],
  ['cosim.png', shotCosim],
];

async function main(): Promise<void> {
  mkdirSync(OUT_DIR, { recursive: true });
  const server = await ensureServer();
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const failed: string[] = [];
  // PP_SHOTS=cosim,pcb-mode — capture a subset while iterating on the rig.
  const only = process.env.PP_SHOTS?.split(',').map((s) => s.trim()).filter((s) => s !== '');
  const shots = only ? SHOTS.filter(([name]) => only.some((o) => name.startsWith(o))) : SHOTS;
  try {
    for (const [name, run] of shots) {
      log(`capturing ${name} …`);
      try {
        await run(browser);
      } catch (err) {
        failed.push(name);
        log(`FAILED ${name}: ${err instanceof Error ? err.message.split('\n')[0] ?? '' : String(err)}`);
      }
    }
  } finally {
    await browser.close();
    stopServer(server);
  }
  if (failed.length > 0) {
    log(`done with failures: ${failed.join(', ')}`);
    process.exitCode = 1;
  } else {
    log('done — all shots captured');
  }
}

await main();
