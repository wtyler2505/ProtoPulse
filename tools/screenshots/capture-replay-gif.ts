/**
 * The time-lapse replay demo — docs/screenshots/replay-demo.gif.
 *
 *     npx tsx tools/screenshots/capture-replay-gif.ts
 *
 * The design IS its op-log, and the History panel scrubs it — so this
 * GIF is the traffic-light-555 fixture building itself op by op:
 * components appear, nets connect, wires draw, names land. The rig
 * drives the real History panel's scrubber deterministically (one
 * frame every K ops via the range input), which is exactly what the
 * inbox idea promised: the replay feature IS the GIF generator.
 */

import { mkdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { chromium } from 'playwright-core';

import { encodeGif } from './gif';
import {
  caption,
  CHROME,
  closeEditor,
  ensureServer,
  fixtureBundle,
  log,
  openEditor,
  OUT_DIR,
  stopServer,
  tab,
  zoomFit,
} from './rig';

import type { GifFrame } from './gif';
import type { RigBundle, RigOpEnvelope } from './rig';
import type { Page } from 'playwright-core';

const GIF_NAME = 'replay-demo.gif';
const GIF_VIEWPORT = { width: 1280, height: 720 };
/** Target step count for the build-up — keeps the GIF tight regardless
 *  of how many ops the fixture (plus rig layout ops) carries. */
const TARGET_STEPS = 36;
const STEP_DELAY_MS = 170;

const SCRUB_SELECTOR = 'input[aria-label="replay position"]';

/**
 * Reorder the fixture's ops into HUMAN-DRAWING order so the replay
 * reads as a build-up instead of 56 invisible electrical ops followed
 * by a burst of placements: each component's add is immediately
 * followed by its place_symbol, then each net's connects + wire
 * geometry + rename land together in first-connect order. Same ops,
 * same final graph — only the authoring order differs, and ops stay
 * valid (components all exist before the first connect references
 * them). Lamports are renumbered sequentially.
 */
function storyOrderBundle(fixture: string): string {
  const bundle = JSON.parse(fixtureBundle(fixture)) as RigBundle;
  const main = bundle.branches.find((b) => b.name === bundle.head) ?? bundle.branches[0];
  if (!main) throw new Error(`fixture ${fixture}: no head branch`);

  const adds: RigOpEnvelope[] = [];
  const placeByComponent = new Map<string, RigOpEnvelope>();
  const netOrder: string[] = [];
  const connectsByNet = new Map<string, RigOpEnvelope[]>();
  const wireByNet = new Map<string, RigOpEnvelope>();
  const renameByNet = new Map<string, RigOpEnvelope>();
  const rest: RigOpEnvelope[] = [];

  for (const env of main.ops) {
    const op = env.op;
    const kind = op.kind as string;
    if (kind === 'add_component') {
      adds.push(env);
    } else if (kind === 'place_symbol') {
      placeByComponent.set(op.componentId as string, env);
    } else if (kind === 'connect') {
      const netId = (op.netId ?? op.newNetId) as string;
      if (!connectsByNet.has(netId)) {
        connectsByNet.set(netId, []);
        netOrder.push(netId);
      }
      connectsByNet.get(netId)?.push(env);
    } else if (kind === 'set_wire_geometry') {
      wireByNet.set(op.netId as string, env);
    } else if (kind === 'rename_net') {
      renameByNet.set(op.netId as string, env);
    } else {
      rest.push(env);
    }
  }

  const story: RigOpEnvelope[] = [];
  for (const add of adds) {
    story.push(add);
    const place = placeByComponent.get(add.op.id as string);
    if (place) story.push(place);
  }
  for (const netId of netOrder) {
    story.push(...(connectsByNet.get(netId) ?? []));
    const wire = wireByNet.get(netId);
    if (wire) story.push(wire);
    const rename = renameByNet.get(netId);
    if (rename) story.push(rename);
  }
  story.push(...rest);

  if (story.length !== main.ops.length) {
    throw new Error(
      `story ordering dropped ops: ${String(story.length)} vs ${String(main.ops.length)}`,
    );
  }
  main.ops = story.map((env, i) => ({ ...env, lamport: i + 1 }));
  return JSON.stringify(bundle);
}

/** Drive the History panel's range input the way React hears it: set
 *  the value through the native setter, then bubble an 'input' event. */
async function scrubTo(page: Page, value: number): Promise<void> {
  await page.evaluate(
    ({ sel, value }: { sel: string; value: number }) => {
      const input = document.querySelector(sel);
      if (!(input instanceof HTMLInputElement)) throw new Error(`no scrubber at ${sel}`);
      // eslint-disable-next-line @typescript-eslint/unbound-method -- invoked via .call with the input as receiver
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      if (!setter) throw new Error('no native value setter');
      setter.call(input, String(value));
      input.dispatchEvent(new Event('input', { bubbles: true }));
    },
    { sel: SCRUB_SELECTOR, value },
  );
}

async function recordReplayStory(): Promise<GifFrame[]> {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  try {
    const page = await openEditor(browser, 'traffic-light-555', {
      viewport: GIF_VIEWPORT,
      bundle: storyOrderBundle('traffic-light-555'),
    });
    const frames: GifFrame[] = [];
    const snap = async (delayMs: number): Promise<void> => {
      frames.push({ png: await page.screenshot(), delayMs });
    };

    // The finished design, fitted — the camera stays put for the whole
    // story so the design grows into this exact frame.
    await zoomFit(page);
    await caption(page, 'Every ProtoPulse design IS its op-log — watch this one replay itself');
    await snap(2000);

    await tab(page, 'History').click();
    await page.locator(SCRUB_SELECTOR).waitFor({ timeout: 10_000 });
    const total = Number(await page.locator(SCRUB_SELECTOR).getAttribute('max'));
    if (!Number.isFinite(total) || total <= 0) throw new Error(`bad op count: ${String(total)}`);
    log(`replaying ${String(total)} ops in ~${String(TARGET_STEPS)} steps`);

    // Rewind to the empty sheet.
    await scrubTo(page, 0);
    await caption(page, `Rewind to op 0 — then replay all ${String(total)} operations`);
    await page.waitForTimeout(400);
    await snap(1300);

    // The build-up: a frame every `stride` ops through the real scrubber.
    const stride = Math.max(1, Math.ceil(total / TARGET_STEPS));
    await caption(page, 'Components land, nets connect, wires draw — history as a film');
    for (let i = stride; i < total; i += stride) {
      await scrubTo(page, i);
      await page.waitForTimeout(70); // rAF: let the canvas sync the prefix graph
      await snap(STEP_DELAY_MS);
    }
    await scrubTo(page, total);
    await page.waitForTimeout(200);
    await caption(page, 'Back at the head — every step of this film is a real, replayable op');
    await snap(1600);

    // Exit replay: the session goes live again.
    await page.getByRole('button', { name: 'Back to live' }).click();
    await page.waitForTimeout(300);
    await caption(page, 'History tab in the editor — scrub any design, any branch, any time');
    await snap(3200);

    await closeEditor(page);
    return frames;
  } finally {
    await browser.close();
  }
}

async function main(): Promise<void> {
  mkdirSync(OUT_DIR, { recursive: true });
  const server = await ensureServer();
  try {
    log(`recording ${GIF_NAME} story (${String(GIF_VIEWPORT.width)}×${String(GIF_VIEWPORT.height)}) …`);
    const frames = await recordReplayStory();
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
