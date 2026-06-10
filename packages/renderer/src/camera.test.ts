import { MM } from '@protopulse/graph';
import { describe, expect, it } from 'vitest';

import {
  Camera,
  GRID_LOD_PX_PER_MM,
  MAX_PX_PER_NM,
  MIN_PX_PER_NM,
  TEXT_LOD_PX_PER_MM,
} from './camera.js';

const SIZE = { width: 800, height: 600 };

describe('Camera transforms', () => {
  it('world center maps to screen center', () => {
    const cam = new Camera();
    cam.center = { x: 5 * MM, y: 3 * MM };
    expect(cam.worldToScreen({ x: 5 * MM, y: 3 * MM }, SIZE)).toEqual({ x: 400, y: 300 });
  });

  it('Y is flipped: +Y world is up (smaller screen y)', () => {
    const cam = new Camera(); // 1e-4 px/nm = 100 px/mm
    const p = cam.worldToScreen({ x: 0, y: MM }, SIZE);
    expect(p.y).toBe(300 - 100);
    expect(p.x).toBe(400);
  });

  it('screenToWorld is the inverse of worldToScreen', () => {
    const cam = new Camera();
    cam.center = { x: 12 * MM, y: -7 * MM };
    cam.pxPerNm = 3e-5;
    const world = { x: 9 * MM, y: -2 * MM };
    const back = cam.screenToWorld(cam.worldToScreen(world, SIZE), SIZE);
    expect(back.x).toBeCloseTo(world.x, 3);
    expect(back.y).toBeCloseTo(world.y, 3);
  });

  it('zoomAt keeps the world point under the cursor fixed', () => {
    const cam = new Camera();
    cam.center = { x: 2 * MM, y: 2 * MM };
    const cursor = { x: 600, y: 150 };
    const anchorBefore = cam.screenToWorld(cursor, SIZE);
    cam.zoomAt(cursor, 1.5, SIZE);
    const anchorAfter = cam.screenToWorld(cursor, SIZE);
    expect(anchorAfter.x).toBeCloseTo(anchorBefore.x, 3);
    expect(anchorAfter.y).toBeCloseTo(anchorBefore.y, 3);
    expect(cam.pxPerNm).toBeCloseTo(1.5e-4);
  });

  it('zoomAt clamps to MIN/MAX and bumps version only on change', () => {
    const cam = new Camera();
    cam.pxPerNm = MAX_PX_PER_NM;
    const v = cam.version;
    cam.zoomAt({ x: 400, y: 300 }, 2, SIZE);
    expect(cam.pxPerNm).toBe(MAX_PX_PER_NM);
    expect(cam.version).toBe(v); // clamped — no change, no dirty
    cam.pxPerNm = MIN_PX_PER_NM;
    cam.zoomAt({ x: 400, y: 300 }, 0.5, SIZE);
    expect(cam.pxPerNm).toBe(MIN_PX_PER_NM);
  });

  it('pan follows the pointer (drag right = world center moves left)', () => {
    const cam = new Camera();
    cam.pan(100, 0);
    expect(cam.center.x).toBeCloseTo(-100 / cam.pxPerNm);
    cam.center = { x: 0, y: 0 };
    cam.pan(0, 50); // drag down → content down → center moves up (+Y)
    expect(cam.center.y).toBeCloseTo(50 / cam.pxPerNm);
  });

  it('fitBounds centers and fits with margin', () => {
    const cam = new Camera();
    const bounds = { minX: 0, minY: 0, maxX: 10 * MM, maxY: 5 * MM };
    cam.fitBounds(bounds, SIZE, 40);
    expect(cam.center).toEqual({ x: 5 * MM, y: 2.5 * MM });
    // width-limited: (800-80)px / 10mm = 72 px/mm
    expect(cam.pxPerMm()).toBeCloseTo(72, 5);
    // everything visible:
    const tl = cam.worldToScreen({ x: 0, y: 5 * MM }, SIZE);
    const br = cam.worldToScreen({ x: 10 * MM, y: 0 }, SIZE);
    expect(tl.x).toBeGreaterThanOrEqual(0);
    expect(br.x).toBeLessThanOrEqual(SIZE.width);
    expect(tl.y).toBeGreaterThanOrEqual(0);
    expect(br.y).toBeLessThanOrEqual(SIZE.height);
  });

  it('fitBounds on a degenerate (point) bounds keeps a sane zoom', () => {
    const cam = new Camera();
    const before = cam.pxPerNm;
    cam.fitBounds({ minX: MM, minY: MM, maxX: MM, maxY: MM }, SIZE);
    expect(cam.center).toEqual({ x: MM, y: MM });
    expect(cam.pxPerNm).toBe(before);
  });
});

describe('LOD thresholds', () => {
  it('exports the documented constants', () => {
    expect(TEXT_LOD_PX_PER_MM).toBe(8);
    expect(GRID_LOD_PX_PER_MM).toBe(3);
  });

  it('showText flips above TEXT_LOD_PX_PER_MM', () => {
    const cam = new Camera();
    cam.pxPerNm = (TEXT_LOD_PX_PER_MM - 1) / MM;
    expect(cam.showText()).toBe(false);
    cam.pxPerNm = (TEXT_LOD_PX_PER_MM + 1) / MM;
    expect(cam.showText()).toBe(true);
  });

  it('showGrid flips above GRID_LOD_PX_PER_MM', () => {
    const cam = new Camera();
    cam.pxPerNm = (GRID_LOD_PX_PER_MM - 1) / MM;
    expect(cam.showGrid()).toBe(false);
    cam.pxPerNm = (GRID_LOD_PX_PER_MM + 1) / MM;
    expect(cam.showGrid()).toBe(true);
  });
});
