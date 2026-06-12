/**
 * PP3D-2 — non-blank WebGL canvas gate for the 3D board viewer.
 *
 * Closes the verification hole from the upgrade plan (§3/§10): the prior 3D
 * e2e coverage asserted only DOM/text and would pass against a blank canvas.
 * This spec mounts the WebGL engine (via the `?viewer3dEngine=webgl` flag) and
 * asserts the rendered `<canvas>` actually has pixel variance above threshold —
 * i.e. the board really rendered, not just a uniform clear color.
 *
 * It has two parts:
 *   1. Helper discrimination (no browser): proves {@link pixelVariance} fails on
 *      a uniform buffer and passes on a varied one — so the gate provably
 *      "fails on a blank canvas and passes on a rendered one".
 *   2. Live gate: navigates to the WebGL viewer and asserts non-blank render.
 */

import { readFileSync } from 'node:fs';

import { expect, test } from '@playwright/test';

import {
  DEFAULT_VARIANCE_THRESHOLD,
  measureNonBlankCanvas,
  pixelVariance,
} from './canvas-variance';

// ---------------------------------------------------------------------------
// 1. Pure-helper discrimination — the deterministic core of the gate.
// ---------------------------------------------------------------------------

test.describe('non-blank-canvas helper @unit', () => {
  test('uniform buffer (blank canvas) is below threshold', () => {
    // 16 identical mid-gray RGBA pixels — a uniform clear color.
    const uniform = new Uint8Array(16 * 4).fill(128);
    const variance = pixelVariance(uniform);
    expect(variance).toBe(0);
    expect(variance).toBeLessThanOrEqual(DEFAULT_VARIANCE_THRESHOLD);
  });

  test('varied buffer (rendered scene) is above threshold', () => {
    // Half black, half white pixels → maximal per-channel variance.
    const n = 16;
    const varied = new Uint8Array(n * 4);
    for (let i = 0; i < n; i += 1) {
      const v = i < n / 2 ? 0 : 255;
      const o = i * 4;
      varied[o] = v;
      varied[o + 1] = v;
      varied[o + 2] = v;
      varied[o + 3] = 255;
    }
    const variance = pixelVariance(varied);
    expect(variance).toBeGreaterThan(DEFAULT_VARIANCE_THRESHOLD);
  });

  test('empty buffer is treated as blank (variance 0)', () => {
    expect(pixelVariance(new Uint8Array(0))).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 2. Live WebGL render gate.
// ---------------------------------------------------------------------------

/** Read the persisted e2e session id out of the saved auth storage state. */
function sessionIdFromStorageState(): string {
  const state = JSON.parse(readFileSync('e2e/.auth-state.json', 'utf8')) as {
    origins?: { localStorage?: { name: string; value: string }[] }[];
  };
  for (const origin of state.origins ?? []) {
    const entry = origin.localStorage?.find((e) => /session/i.test(e.name));
    if (entry?.value) {
      return entry.value;
    }
  }
  throw new Error('No session id found in e2e/.auth-state.json');
}

test.describe('WebGL board viewer renders a non-blank canvas', () => {
  test.use({ storageState: 'e2e/.auth-state.json' });

  test('canvas pixel variance exceeds the blank-render threshold', async ({ page, request }) => {
    // Generous budget: this is the only spec that mounts the real WebGL chunk
    // (three.js + R3F + drei), which a cold dev server compiles on first hit.
    test.setTimeout(120_000);

    // Create a project via the API — far more stable than driving the picker UI,
    // and gives us a known /projects/:id to deep-link into.
    const createRes = await request.post('/api/projects', {
      headers: { 'X-Session-Id': sessionIdFromStorageState() },
      data: { name: 'E2E WebGL Viewer Project', description: 'PP3D-2 non-blank gate' },
    });
    expect(createRes.ok(), `project create failed: ${createRes.status()}`).toBeTruthy();
    const projectId = ((await createRes.json()) as { id: number }).id;

    // Give the project a real board profile — the workspace gates non-default
    // views (including the 3D viewer) behind a configured board.
    await request.put(`/api/projects/${projectId}/board`, {
      headers: { 'X-Session-Id': sessionIdFromStorageState() },
      data: { widthMm: 100, heightMm: 80, thicknessMm: 1.6 },
    });

    // Select the WebGL engine via localStorage *before* the app boots. We avoid
    // the `?viewer3dEngine=` query param on purpose: the workspace router parses
    // the view from the path and a query string contaminates that parse on a
    // cold load, redirecting away from `viewer_3d`. A clean URL + persisted
    // preference sidesteps that entirely.
    await page.addInitScript(() => {
      window.localStorage.setItem('viewer3dEngine', 'webgl');
    });

    await page.goto(`/projects/${projectId}/viewer_3d`, { timeout: 60_000 });

    await page.waitForSelector('[data-testid="workspace-main"]', { timeout: 30_000 });

    // The 3D viewer must actually activate (the workspace can redirect boardless
    // or onboarding-gated projects to a default view). If it didn't, fail with a
    // pointed message rather than letting the canvas check silently pass blank.
    const onViewer = await page
      .getByTestId('viewer-title')
      .isVisible({ timeout: 30_000 })
      .catch(() => false);
    expect(
      onViewer,
      `The 3D viewer did not mount — workspace redirected to ${new URL(page.url()).pathname}. ` +
        'The view may be gated behind onboarding/mode state in this environment.',
    ).toBe(true);

    // The WebGL viewer mounts a real <canvas> inside the viewport.
    const canvas = page.locator('[data-testid="board-3d-viewport"] canvas');
    await expect(canvas).toBeVisible({ timeout: 30_000 });

    // Give R3F a beat to render the first demand frame + Bounds fit animation.
    await page.waitForTimeout(2_000);

    const result = await measureNonBlankCanvas(canvas);
    expect(
      result.rendered,
      `Canvas appears blank: variance ${result.variance.toFixed(2)} ` +
        `did not exceed threshold ${result.threshold}. The WebGL board did not render.`,
    ).toBe(true);
  });
});
