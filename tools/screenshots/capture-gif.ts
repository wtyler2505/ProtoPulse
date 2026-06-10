/**
 * The animated demo — docs/screenshots/cosim-demo.gif.
 *
 *     npx tsx tools/screenshots/capture-gif.ts
 *
 * Same machinery as the stills rig (rig.ts: golden-fixture bundles,
 * real UI over headless Chrome), but recorded as a frame sequence and
 * encoded to a looping GIF (gif.ts, pure JS — no ffmpeg on the box).
 *
 * The story is the co-sim thesis in ~20 seconds: a schematic, REAL AVR
 * firmware (the blink, hand-assembled from @protopulse/emu's own
 * assembler) running live in the emulator with its logic-analyzer
 * traces streaming, then the firmware's pin bound to a net and the
 * SPICE-solved response plotted under the square wave — one axis,
 * digital over analog.
 *
 * A caption pill (injected, cosmetic-only) narrates the stages so the
 * GIF reads without sound or surrounding prose.
 */

import { mkdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { chromium } from 'playwright-core';

import { encodeGif } from './gif';
import {
  blinkFirmware,
  bytesToIntelHex,
  CHROME,
  closeEditor,
  ensureServer,
  log,
  openEditor,
  OUT_DIR,
  scrollPanelTo,
  selectField,
  stopServer,
  tab,
  waitForResultOrError,
  zoomFit,
} from './rig';

import type { GifFrame } from './gif';
import type { Page } from 'playwright-core';

const GIF_NAME = 'cosim-demo.gif';
/** Smaller than the stills (1600×900) — GIF bytes scale with area, and
 *  GitHub renders README media at ~830 px wide anyway. */
const GIF_VIEWPORT = { width: 1280, height: 720 };
const COSIM_WAIT_MS = 150_000;

/** Frames captured while the emulator runs live (logic traces moving). */
const LIVE_FRAMES = 10;

class Recorder {
  readonly frames: GifFrame[] = [];
  constructor(private readonly page: Page) {}
  /** Screenshot now; the frame holds for `delayMs` in the final GIF. */
  async snap(delayMs: number): Promise<void> {
    const png = await this.page.screenshot();
    this.frames.push({ png, delayMs });
  }
}

/** Cosmetic narration overlay — exists only in the recording session. */
async function caption(page: Page, text: string): Promise<void> {
  await page.evaluate((t: string) => {
    let el = document.getElementById('pp-gif-caption');
    if (!el) {
      el = document.createElement('div');
      el.id = 'pp-gif-caption';
      el.style.cssText = [
        'position:fixed',
        'left:50%',
        'bottom:18px',
        'transform:translateX(-50%)',
        'background:rgba(10,14,20,0.92)',
        'border:1px solid rgba(120,160,255,0.45)',
        'border-radius:999px',
        'padding:8px 18px',
        'color:#dbe6ff',
        'font:600 15px/1.3 system-ui,sans-serif',
        'letter-spacing:0.2px',
        'z-index:99999',
        'pointer-events:none',
        'box-shadow:0 4px 18px rgba(0,0,0,0.5)',
      ].join(';');
      document.body.appendChild(el);
    }
    el.textContent = t;
  }, text);
}

async function recordCosimStory(): Promise<GifFrame[]> {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  try {
    const page = await openEditor(browser, 'led-resistor', { viewport: GIF_VIEWPORT });
    const rec = new Recorder(page);

    // 1 — the design.
    await zoomFit(page);
    await caption(page, 'A real design: battery → resistor → LED (golden fixture)');
    await rec.snap(1800);

    // 2 — load the blink firmware into the AVR emulator.
    await tab(page, 'Firmware').click();
    await caption(page, 'Load REAL AVR firmware — blink, assembled from raw opcodes');
    await page.getByLabel('Intel HEX firmware').fill(bytesToIntelHex(blinkFirmware()));
    await rec.snap(1100);
    await page.locator('.firmware-controls button', { hasText: /^Load$/ }).click();
    await page.locator('.firmware-panel .muted', { hasText: 'Firmware loaded' }).waitFor({
      timeout: 30_000,
    });
    await rec.snap(900);

    // 3 — run it live: the logic-analyzer traces stream while we film.
    await caption(page, 'Run it — the emulator executes it cycle by cycle');
    await page.locator('.firmware-controls button', { hasText: /^Run$/ }).click();
    await page
      .locator('.firmware-panel .trace-name', { hasText: /^B5$/ })
      .waitFor({ timeout: 15_000 });
    for (let i = 0; i < LIVE_FRAMES; i++) {
      await rec.snap(180);
      await page.waitForTimeout(120);
    }
    await page.locator('.firmware-controls button', { hasText: /^Pause$/ }).click();
    await rec.snap(800);

    // 4 — bind the pin to the analog world.
    await tab(page, 'Co-sim').click();
    await caption(page, 'Bind pin B5 to net LED_A — firmware meets SPICE');
    await rec.snap(1000);
    await selectField(page, 'pin').selectOption('B5');
    await selectField(page, 'net').selectOption({ label: 'LED_A' });
    await page.getByRole('button', { name: 'Add binding' }).click();
    await rec.snap(1200);

    // 5 — run the co-sim and land on the money plot.
    await caption(page, 'Co-simulate: ngspice solves the circuit the firmware drives');
    await page.locator('button.sim-run', { hasText: 'Run co-sim' }).click();
    await rec.snap(900);
    const status = await waitForResultOrError(page, '.cosim-panel .fidelity-bar', COSIM_WAIT_MS);
    if (status === 'error') {
      throw new Error(
        `co-sim errored: ${(await page.locator('.sim-error').first().textContent()) ?? '?'}`,
      );
    }
    await page.waitForTimeout(500); // plot paint
    await scrollPanelTo(page, '.panel-body.cosim-panel', '.firmware-readout');
    await caption(page, 'The square wave and the analog response — one plot, one axis');
    await rec.snap(4200);

    await closeEditor(page);
    return rec.frames;
  } finally {
    await browser.close();
  }
}

async function main(): Promise<void> {
  mkdirSync(OUT_DIR, { recursive: true });
  const server = await ensureServer();
  try {
    log(`recording ${GIF_NAME} story (${String(GIF_VIEWPORT.width)}×${String(GIF_VIEWPORT.height)}) …`);
    const frames = await recordCosimStory();
    log(`captured ${String(frames.length)} frames — encoding (global palette + frame diff) …`);
    const gif = encodeGif(frames);
    const out = path.join(OUT_DIR, GIF_NAME);
    writeFileSync(out, gif);
    log(`saved ${GIF_NAME} (${String(Math.round(statSync(out).size / 1024))} KB)`);
  } finally {
    stopServer(server);
  }
}

await main();
