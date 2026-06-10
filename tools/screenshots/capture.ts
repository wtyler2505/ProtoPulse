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
 * and writes PNGs to docs/screenshots/. Designs come from the golden
 * fixtures (tools/golden/fixtures/<name>/design.ppx.json) injected via
 * localStorage 'pp-design' BEFORE the app boots — the same bundles the
 * export contracts freeze, so the pictures and the goldens can never
 * disagree about what the design is.
 *
 * The golden bundles freeze netlists, not pretty pictures — some carry
 * no schematic placements or wire geometry. The design IS its op-log,
 * so the rig appends deterministic place_symbol / set_wire_geometry
 * ops (actor 'screenshot-rig', layout data below) in memory before
 * injection. The fixture files on disk are never touched.
 *
 * Each shot is an independent step: a failure logs and the rig moves on,
 * so one flaky panel never costs the whole set.
 */

import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright-core';

import { assemble, BRNE, CBI, DEC, IO, LDI, OUT, RJMP, SBI } from '@protopulse/emu';

import type { ChildProcess } from 'node:child_process';
import type { Browser, Page } from 'playwright-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT_DIR = path.join(ROOT, 'docs', 'screenshots');
const FIXTURES = path.join(ROOT, 'tools', 'golden', 'fixtures');

const BASE_URL = 'http://localhost:5174/';
const CHROME = process.env.PP_CHROME ?? '/opt/google/chrome/chrome';
const VIEWPORT = { width: 1600, height: 900 };

/** Branch name the stubbed window.prompt hands the Branches panel. */
const BRANCH_NAME = 'try-alt';

/** Generous ceilings — first runs boot the ngspice WASM engine. */
const SIM_WAIT_MS = 120_000;
const COSIM_WAIT_MS = 150_000;

const log = (msg: string): void => {
  console.log(`[screenshots] ${msg}`);
};

// ── Fixture layout data ──────────────────────────────────────────────
// Coordinates in schematic grid units (G = 1.27 mm = 1_270_000 nm),
// Y-up, matching the seed symbol geometry in @protopulse/parts.

const G = 1_270_000;

type PlaceSpec = [componentId: string, xG: number, yG: number, rot: 0 | 90 | 180 | 270];
type WireSpec = [netId: string, segments: [number, number, number, number][]];

interface LayoutSpec {
  places?: PlaceSpec[];
  wires?: WireSpec[];
}

/** Classic astable drawing: VCC rail up top, the RA/RB/CT chain to the
 *  right of the 555, OUT fanning into three R+LED branches, one GND bus. */
const TRAFFIC_LIGHT_LAYOUT: LayoutSpec = {
  places: [
    ['u1', 0, 0, 0],
    ['vcc', 0, 10, 0],
    ['gnd', 0, -12, 0],
    ['ra', 10, 8, 270],
    ['rb', 10, -1, 270],
    ['ct', 10, -8, 270],
    ['rg', 18, 4, 0],
    ['ry', 18, 0, 0],
    ['rr', 18, -4, 0],
    ['dg', 24, 4, 0],
    ['dy', 24, 0, 0],
    ['dr', 24, -4, 0],
  ],
  wires: [
    ['net-vcc', [[0, 5, 0, 10], [0, 10, 10, 10], [-4, -3, -6, -3], [-6, -3, -6, 10], [-6, 10, 0, 10]]],
    ['net-disch', [[10, 6, 10, 1], [4, -2, 7, -2], [7, -2, 7, 4], [7, 4, 10, 4]]],
    ['net-timing', [[10, -3, 10, -6], [-4, 3, -5, 3], [-5, 3, -5, 1], [-5, 1, -4, 1], [-5, 1, -5, -6], [-5, -6, 10, -6]]],
    ['net-out', [[4, 2, 13, 2], [13, 4, 13, -4], [13, 4, 16, 4], [13, 0, 16, 0], [13, -4, 16, -4]]],
    ['net-ag', [[20, 4, 22, 4]]],
    ['net-ay', [[20, 0, 22, 0]]],
    ['net-ar', [[20, -4, 22, -4]]],
    ['net-gnd', [[0, -5, 0, -12], [10, -10, 10, -12], [10, -12, 0, -12], [26, 4, 27, 4], [27, 4, 27, -12], [27, -12, 0, -12], [26, 0, 27, 0], [26, -4, 27, -4]]],
  ],
};

/** led-resistor already places its three symbols in a row (golden data);
 *  the rig only adds the loop's wires: over the top, back underneath. */
const LED_RESISTOR_LAYOUT: LayoutSpec = {
  wires: [
    ['net-vbat', [[-2, 0, -3, 0], [-3, 0, -3, 3], [-3, 3, 8, 3], [8, 3, 8, 0]]],
    ['net-led', [[12, 0, 18, 0]]],
    ['net-gnd', [[22, 0, 23, 0], [23, 0, 23, -4], [23, -4, 2, -4], [2, -4, 2, 0]]],
  ],
};

const LAYOUTS: Record<string, LayoutSpec> = {
  'traffic-light-555': TRAFFIC_LIGHT_LAYOUT,
  'led-resistor': LED_RESISTOR_LAYOUT,
};

interface OpEnvelope {
  actor: string;
  lamport: number;
  ts: number;
  op: Record<string, unknown>;
}

interface BundleShape {
  head: string;
  branches: { name: string; ops: OpEnvelope[] }[];
}

/** Load a golden fixture bundle and append the rig's layout ops to its
 *  main branch — pure data transform, deterministic by construction. */
function fixtureBundle(name: string): string {
  const raw = readFileSync(path.join(FIXTURES, name, 'design.ppx.json'), 'utf8');
  const layout = LAYOUTS[name];
  if (!layout) return raw;

  const bundle = JSON.parse(raw) as BundleShape;
  const main = bundle.branches.find((b) => b.name === bundle.head) ?? bundle.branches[0];
  if (!main) return raw;
  let lamport = Math.max(0, ...bundle.branches.flatMap((b) => b.ops.map((e) => e.lamport)));
  const append = (op: Record<string, unknown>): void => {
    lamport += 1;
    main.ops.push({ actor: 'screenshot-rig', lamport, ts: 0, op });
  };

  for (const [componentId, x, y, rot] of layout.places ?? []) {
    append({
      kind: 'place_symbol',
      componentId,
      at: { x: x * G, y: y * G },
      rot,
      mirror: false,
    });
  }
  for (const [netId, segments] of layout.wires ?? []) {
    append({
      kind: 'set_wire_geometry',
      netId,
      segments: segments.map(([ax, ay, bx, by]) => ({
        a: { x: ax * G, y: ay * G },
        b: { x: bx * G, y: by * G },
      })),
    });
  }
  return JSON.stringify(bundle);
}

// ── Dev server ───────────────────────────────────────────────────────

async function isUp(): Promise<boolean> {
  try {
    const res = await fetch(BASE_URL, { signal: AbortSignal.timeout(2_000) });
    return res.ok;
  } catch {
    return false;
  }
}

/** Start `npm run -w @protopulse/app dev` unless :5174 already answers.
 *  Returns the child to kill at the end, or null when reusing. */
async function ensureServer(): Promise<ChildProcess | null> {
  if (await isUp()) {
    log('dev server already up on :5174 — reusing it (and leaving it running)');
    return null;
  }
  log('starting dev server: npm run -w @protopulse/app dev');
  const child = spawn('npm', ['run', '-w', '@protopulse/app', 'dev'], {
    cwd: ROOT,
    stdio: 'ignore',
    detached: true,
  });
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (await isUp()) {
      log('dev server is up');
      return child;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('dev server did not answer on :5174 within 60s');
}

function stopServer(child: ChildProcess | null): void {
  if (child === null) return;
  log('stopping the dev server the rig started');
  try {
    if (typeof child.pid === 'number') process.kill(-child.pid, 'SIGTERM');
  } catch {
    child.kill('SIGTERM');
  }
}

// ── Page bootstrap ───────────────────────────────────────────────────

/** Fresh context + page with the design bundle seeded into localStorage
 *  (and window.prompt stubbed) BEFORE the app's boot script runs. */
async function openEditor(browser: Browser, fixture: string): Promise<Page> {
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.addInitScript(
    ({ bundle, branchName }: { bundle: string; branchName: string }) => {
      window.localStorage.setItem('pp-design', bundle);
      // The Branches panel names new branches via window.prompt (M1 cut).
      window.prompt = () => branchName;
    },
    { bundle: fixtureBundle(fixture), branchName: BRANCH_NAME },
  );
  await page.goto(BASE_URL, { waitUntil: 'load' });
  await page.waitForSelector('.canvas-wrap canvas', { timeout: 20_000 });
  // Let the first rAF render land before anyone screenshots.
  await page.waitForTimeout(750);
  return page;
}

async function closeEditor(page: Page): Promise<void> {
  await page.context().close();
}

function tab(page: Page, label: string) {
  return page.locator('.tab-bar .tab', { hasText: new RegExp(`^${label}$`) });
}

async function zoomFit(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Zoom fit' }).click();
  await page.waitForTimeout(500);
}

async function save(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: path.join(OUT_DIR, name) });
  const size = statSync(path.join(OUT_DIR, name)).size;
  log(`saved ${name} (${String(Math.round(size / 1024))} KB)`);
}

/** Resolve when either locator appears; the panels surface solver
 *  failures as .sim-error text instead of throwing. */
async function waitForResultOrError(
  page: Page,
  resultSel: string,
  timeout: number,
): Promise<'result' | 'error'> {
  const either = page.locator(resultSel).or(page.locator('.sim-error')).first();
  await either.waitFor({ timeout });
  return (await page.locator(resultSel).count()) > 0 ? 'result' : 'error';
}

/** In a Sim/Co-sim style trace list, leave exactly `names` checked. */
async function checkOnlyTraces(page: Page, names: string[]): Promise<void> {
  const rows = page.locator('.trace-list .trace-row');
  const count = await rows.count();
  for (let i = 0; i < count; i++) {
    const row = rows.nth(i);
    const checkbox = row.locator('input[type=checkbox]');
    if ((await checkbox.count()) === 0) continue;
    const name = ((await row.locator('.trace-name').textContent()) ?? '').trim();
    const want = names.includes(name);
    if ((await checkbox.isChecked()) !== want) await checkbox.click();
  }
}

/** Scroll a side-panel body so `anchorSel` sits at the top — pinning the
 *  interesting result region (fidelity bar → plot) into the viewport. */
async function scrollPanelTo(page: Page, panelSel: string, anchorSel: string): Promise<void> {
  await page.evaluate(
    ({ panelSel, anchorSel }: { panelSel: string; anchorSel: string }) => {
      const panel = document.querySelector(panelSel);
      const anchor = panel?.querySelector(anchorSel);
      if (!(panel instanceof HTMLElement) || !(anchor instanceof HTMLElement)) return;
      panel.scrollTop =
        anchor.getBoundingClientRect().top - panel.getBoundingClientRect().top + panel.scrollTop;
    },
    { panelSel, anchorSel },
  );
  await page.waitForTimeout(300);
}

/** True when everything from the fidelity bar to the plot bottom fits
 *  the panel viewport at once. */
async function resultRegionFits(page: Page, panelSel: string): Promise<boolean> {
  return page.evaluate((sel: string) => {
    const panel = document.querySelector(sel);
    const fid = panel?.querySelector('.fidelity-bar');
    const plot = panel?.querySelector('.plot-wrap');
    if (!(panel instanceof HTMLElement) || !fid || !plot) return false;
    return (
      plot.getBoundingClientRect().bottom - fid.getBoundingClientRect().top <=
      panel.clientHeight
    );
  }, panelSel);
}

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

// ── Firmware: the classic blink, hand-assembled (see packages/emu) ──

/** B5 output, SBI/CBI around two 200-count busy-wait loops (~1206
 *  cycles per period at 16 MHz — ~75 µs, several periods per window). */
function blinkFirmware(): Uint8Array {
  return assemble([
    LDI(16, 0x20), //  0: r16 = 1<<5
    OUT(IO.DDRB, 16), //  1: B5 → output (low)
    SBI(IO.PORTB, 5), //  2: loop — B5 high
    LDI(17, 200), //  3
    DEC(17), //  4: d1
    BRNE(-2), //  5: → 4
    CBI(IO.PORTB, 5), //  6: B5 low
    LDI(17, 200), //  7
    DEC(17), //  8: d2
    BRNE(-2), //  9: → 8
    RJMP(2 - 11), // 10: → 2 (loop)
  ]);
}

/** Encode a flat byte image as Intel-HEX text (16-byte data records). */
export function bytesToIntelHex(bytes: Uint8Array): string {
  const lines: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += 16) {
    const chunk = bytes.subarray(offset, Math.min(offset + 16, bytes.length));
    const fields = [chunk.length, (offset >> 8) & 0xff, offset & 0xff, 0x00, ...chunk];
    const sum = fields.reduce((a, b) => a + b, 0);
    fields.push((0x100 - (sum & 0xff)) & 0xff);
    lines.push(`:${fields.map((b) => b.toString(16).padStart(2, '0').toUpperCase()).join('')}`);
  }
  lines.push(':00000001FF');
  return lines.join('\n');
}

/** A labelled select in the Sim/Co-sim house style. */
function selectField(page: Page, label: string) {
  return page
    .locator('label.sim-field', {
      has: page.locator('.sim-field-label', { hasText: new RegExp(`^${label}$`) }),
    })
    .locator('select');
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
