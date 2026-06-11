/**
 * coordinate.test.ts
 *
 * Colocated unit tests for the unified diagram coordinate layer (Phase 0).
 * Covers the minimum required: round-trips, snap, zoom-to-fit on sample node sets.
 *
 * Run: npm run test -- client/src/lib/diagram/coordinate.test.ts
 */

import { describe, it, expect } from 'vitest';
import {
  screenToWorld,
  worldToScreen,
  snapValue,
  snapToGrid,
  clampZoom,
  computeWheelZoom,
  computeZoomToFit,
  computeZoomToFitNodes,
  DEFAULT_COORDINATE_CONFIG,
  ARCHITECTURE_DEFAULTS,
} from './coordinate';
import type { Point, Bounds, MeasuredSize } from './types';

// Small epsilon for floating point comparisons in transforms
const EPS = 1e-6;

function almostEqual(a: number, b: number, eps = EPS): boolean {
  return Math.abs(a - b) < eps;
}

describe('diagram/coordinate', () => {
  const sampleRect: DOMRect = {
    left: 100,
    top: 80,
    right: 1100,
    bottom: 680,
    width: 1000,
    height: 600,
    x: 100,
    y: 80,
    toJSON: () => ({}),
  } as DOMRect;

  describe('screenToWorld / worldToScreen round-trips', () => {
    it('round-trips an arbitrary screen point for given pan+zoom', () => {
      const pan: Point = { x: 120, y: 45 };
      const zoom = 1.75;
      const screenPt = { x: 437, y: 291 };

      const world = screenToWorld(screenPt.x, screenPt.y, sampleRect, pan, zoom);
      const back = worldToScreen(world.x, world.y, sampleRect, pan, zoom);

      expect(almostEqual(back.x, screenPt.x)).toBe(true);
      expect(almostEqual(back.y, screenPt.y)).toBe(true);
    });

    it('handles zoom=1, pan=0 (identity case)', () => {
      const pan: Point = { x: 0, y: 0 };
      const zoom = 1;
      const screenPt = { x: 550, y: 320 };

      const world = screenToWorld(screenPt.x, screenPt.y, sampleRect, pan, zoom);
      const back = worldToScreen(world.x, world.y, sampleRect, pan, zoom);

      expect(almostEqual(world.x, screenPt.x - sampleRect.left)).toBe(true);
      expect(almostEqual(back.x, screenPt.x)).toBe(true);
    });
  });

  describe('snapValue / snapToGrid', () => {
    it('snaps to default grid (10)', () => {
      expect(snapValue(12.3)).toBe(10);
      expect(snapValue(17.8)).toBe(20);
      expect(snapValue(-7.4)).toBe(-10);
    });

    it('respects custom gridStep (Architecture 20, PCB 12.7)', () => {
      expect(snapValue(23, 20)).toBe(20);
      expect(snapValue(27, 20)).toBe(20);
      expect(snapValue(31, 12.7)).toBeCloseTo(25.4, 1);
    });

    it('snapToGrid works on Point', () => {
      const p = snapToGrid({ x: 14.9, y: 33.1 }, 5);
      expect(p).toEqual({ x: 15, y: 35 });
    });
  });

  describe('clampZoom', () => {
    it('clamps within configured or passed bounds', () => {
      expect(clampZoom(0.05)).toBe(DEFAULT_COORDINATE_CONFIG.minZoom);
      expect(clampZoom(99)).toBe(DEFAULT_COORDINATE_CONFIG.maxZoom);
      expect(clampZoom(0.8, 0.5, 4)).toBe(0.8);
      expect(clampZoom(0.1, 0.3, 6)).toBe(0.3);
    });
  });

  describe('computeWheelZoom (pointer-preserving)', () => {
    it('returns a different zoom and adjusted pan that keeps pointer fixed in world', () => {
      const input = {
        deltaY: -120, // zoom in
        mouseX: 500,
        mouseY: 300,
        containerRect: sampleRect,
        currentZoom: 1.0,
        currentPan: { x: 50, y: 30 },
      };
      const result = computeWheelZoom(input);

      expect(result.zoom).toBeGreaterThan(1.0);
      expect(result.zoom).toBeLessThanOrEqual(DEFAULT_COORDINATE_CONFIG.maxZoom);

      // The pan must have shifted so the world point under the mouse stays the same
      const worldBefore = screenToWorld(500, 300, sampleRect, { x: 50, y: 30 }, 1.0);
      const worldAfter = screenToWorld(500, 300, sampleRect, result.pan, result.zoom);

      expect(almostEqual(worldBefore.x, worldAfter.x, 0.01)).toBe(true);
      expect(almostEqual(worldBefore.y, worldAfter.y, 0.01)).toBe(true);
    });

    it('respects min/max via options', () => {
      const input = {
        deltaY: 120, // zoom out hard
        mouseX: 200,
        mouseY: 200,
        containerRect: sampleRect,
        currentZoom: 0.15,
        currentPan: { x: 0, y: 0 },
        minZoom: 0.2,
        maxZoom: 3,
      };
      const r = computeWheelZoom(input);
      expect(r.zoom).toBe(0.2); // clamped
    });
  });

  describe('computeZoomToFit (on sample node sets)', () => {
    const viewportW = 800;
    const viewportH = 600;

    it('returns identity for empty set', () => {
      const r = computeZoomToFit([], viewportW, viewportH);
      expect(r).toEqual({ zoom: 1, pan: { x: 0, y: 0 } });
    });

    it('fits a single 150x70 node and centers it', () => {
      const nodes: Bounds[] = [{ x: 200, y: 100, width: 150, height: 70 }];
      const r = computeZoomToFit(nodes, viewportW, viewportH, { padding: 20 });

      // Small content in large viewport → zoom > 1 to enlarge to fill padded area (valid and expected)
      expect(r.zoom).toBeGreaterThan(4);
      expect(r.zoom).toBeLessThanOrEqual(6);

      // Center of node should map near viewport center
      const centerX = 200 + 75;
      const centerY = 100 + 35;
      const screenCenterX = viewportW / 2;
      const screenCenterY = viewportH / 2;

      // After transform, world center * zoom + pan ≈ screen center
      const expectedPanX = screenCenterX - centerX * r.zoom;
      const expectedPanY = screenCenterY - centerY * r.zoom;

      expect(almostEqual(r.pan.x, expectedPanX, 0.5)).toBe(true);
      expect(almostEqual(r.pan.y, expectedPanY, 0.5)).toBe(true);
    });

    it('fits multiple nodes and respects max zoom clamp', () => {
      const items: Bounds[] = [
        { x: 0, y: 0, width: 50, height: 50 },
        { x: 10000, y: 8000, width: 20, height: 20 },
      ];
      const r = computeZoomToFit(items, 1000, 800, { minZoom: 0.01, maxZoom: 2 });

      expect(r.zoom).toBeLessThan(0.1); // very small to fit huge extent
      expect(r.zoom).toBeGreaterThanOrEqual(0.01);
    });

    it('uses ARCHITECTURE_DEFAULTS when supplied', () => {
      const nodes: Bounds[] = [{ x: 0, y: 0, width: 200, height: 100 }];
      const r = computeZoomToFit(nodes, 400, 300, {
        minZoom: ARCHITECTURE_DEFAULTS.minZoom,
        maxZoom: ARCHITECTURE_DEFAULTS.maxZoom,
      });
      expect(r.zoom).toBeLessThanOrEqual(ARCHITECTURE_DEFAULTS.maxZoom!);
    });
  });

  describe('computeZoomToFitNodes (with MeasuredSize fallback)', () => {
    it('falls back to 150x70 when size absent (Architecture legacy compat)', () => {
      const nodes = [
        { position: { x: 0, y: 0 } }, // no size
        { position: { x: 300, y: 200 }, size: { width: 120, height: 80 } as MeasuredSize },
      ];
      const r = computeZoomToFitNodes(nodes, 600, 400);

      // Should not throw and produce reasonable zoom
      expect(r.zoom).toBeGreaterThan(0);
      expect(Number.isFinite(r.zoom)).toBe(true);
    });

    it('uses provided sizes when present', () => {
      const nodes = [
        { position: { x: 0, y: 0 }, size: { width: 800, height: 400 } as MeasuredSize },
      ];
      const r = computeZoomToFitNodes(nodes, 500, 300, { padding: 10 });
      // Large node forces small zoom (exactly 0.6 with these numbers)
      expect(r.zoom).toBeLessThanOrEqual(0.6);
    });
  });
});
