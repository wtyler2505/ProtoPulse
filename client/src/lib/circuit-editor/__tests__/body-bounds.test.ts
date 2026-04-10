/**
 * Body Bounds Tests — physical body-volume collision detection for breadboard components.
 *
 * Tests for client/src/lib/circuit-editor/body-bounds.ts.
 * Runs in client project config (happy-dom environment).
 */

import { describe, it, expect } from 'vitest';
import {
  getBodyBounds,
  checkBodyOverlap,
  FLAT_THRESHOLD,
  type BodyBounds,
} from '../body-bounds';

// ---------------------------------------------------------------------------
// getBodyBounds
// ---------------------------------------------------------------------------

describe('getBodyBounds', () => {
  it('returns tall bounds for electrolytic capacitor', () => {
    const bounds = getBodyBounds('capacitor', 2, { subType: 'electrolytic' });
    expect(bounds.height).toBeGreaterThan(bounds.width); // tall profile
  });

  it('returns flat bounds for axial resistor', () => {
    const bounds = getBodyBounds('resistor', 2);
    expect(bounds.height).toBeLessThan(FLAT_THRESHOLD); // flat profile — below body-collision threshold
  });

  it('returns wide bounds for DIP IC based on pin count', () => {
    const bounds8 = getBodyBounds('ic', 8);
    const bounds16 = getBodyBounds('ic', 16);
    expect(bounds16.width).toBeGreaterThan(bounds8.width);
  });

  it('returns consistent x/y at zero for unpositioned bounds', () => {
    const bounds = getBodyBounds('resistor', 2);
    expect(bounds.x).toBe(0);
    expect(bounds.y).toBe(0);
  });

  it('returns positive width and height for every known type', () => {
    const types = [
      'resistor', 'capacitor', 'led', 'ic', 'diode',
      'transistor', 'relay', 'potentiometer', 'button',
      'crystal', 'buzzer', 'regulator',
    ];
    for (const t of types) {
      const bounds = getBodyBounds(t, 2);
      expect(bounds.width).toBeGreaterThan(0);
      expect(bounds.height).toBeGreaterThan(0);
    }
  });

  it('returns default bounds for unknown component type', () => {
    const bounds = getBodyBounds('unknown_widget', 4);
    expect(bounds.width).toBeGreaterThan(0);
    expect(bounds.height).toBeGreaterThan(0);
  });

  it('is case-insensitive for component type', () => {
    const lower = getBodyBounds('resistor', 2);
    const upper = getBodyBounds('Resistor', 2);
    expect(lower.width).toBe(upper.width);
    expect(lower.height).toBe(upper.height);
  });

  it('IC width scales with pin count', () => {
    const ic8 = getBodyBounds('ic', 8);
    const ic14 = getBodyBounds('ic', 14);
    const ic28 = getBodyBounds('ic', 28);
    expect(ic14.width).toBeGreaterThan(ic8.width);
    expect(ic28.width).toBeGreaterThan(ic14.width);
  });

  it('relay has tall profile', () => {
    const bounds = getBodyBounds('relay', 4);
    expect(bounds.height).toBeGreaterThan(30); // relay is ~12mm tall, scaled
  });

  it('button has moderate height', () => {
    const bounds = getBodyBounds('button', 4);
    expect(bounds.height).toBeGreaterThan(10);
    expect(bounds.height).toBeLessThan(50);
  });
});

// ---------------------------------------------------------------------------
// checkBodyOverlap
// ---------------------------------------------------------------------------

describe('checkBodyOverlap', () => {
  it('detects overlap between two tall components sharing X space', () => {
    const a: BodyBounds = { x: 100, y: 50, width: 20, height: 30 };
    const b: BodyBounds = { x: 110, y: 50, width: 20, height: 30 };
    expect(checkBodyOverlap(a, b)).toBe(true);
  });

  it('allows adjacent flat components even when footprints overlap in X', () => {
    // Flat components (height < threshold) should not trigger body collision
    // even if their footprint rectangles overlap — they are flush with the board
    const a: BodyBounds = { x: 100, y: 50, width: 20, height: 4 };
    const b: BodyBounds = { x: 110, y: 50, width: 20, height: 4 };
    expect(checkBodyOverlap(a, b)).toBe(false);
  });

  it('detects overlap when one tall component overlaps a flat one', () => {
    // One tall, one flat — the tall one's body physically blocks the space
    const tall: BodyBounds = { x: 100, y: 50, width: 20, height: 30 };
    const flat: BodyBounds = { x: 110, y: 50, width: 20, height: 4 };
    expect(checkBodyOverlap(tall, flat)).toBe(true);
  });

  it('returns false for non-overlapping bounds', () => {
    const a: BodyBounds = { x: 10, y: 10, width: 15, height: 20 };
    const b: BodyBounds = { x: 100, y: 100, width: 15, height: 20 };
    expect(checkBodyOverlap(a, b)).toBe(false);
  });

  it('returns false for bounds touching at edges (no overlap)', () => {
    const a: BodyBounds = { x: 10, y: 10, width: 20, height: 20 };
    const b: BodyBounds = { x: 30, y: 10, width: 20, height: 20 };
    expect(checkBodyOverlap(a, b)).toBe(false);
  });

  it('detects overlap for fully contained bounds', () => {
    const outer: BodyBounds = { x: 0, y: 0, width: 100, height: 100 };
    const inner: BodyBounds = { x: 20, y: 20, width: 10, height: 50 };
    expect(checkBodyOverlap(outer, inner)).toBe(true);
  });

  it('returns false when both components are flat (below threshold)', () => {
    const a: BodyBounds = { x: 50, y: 50, width: 30, height: 3 };
    const b: BodyBounds = { x: 60, y: 50, width: 30, height: 3 };
    expect(checkBodyOverlap(a, b)).toBe(false);
  });

  it('is symmetric — order of arguments does not matter', () => {
    const a: BodyBounds = { x: 100, y: 50, width: 20, height: 30 };
    const b: BodyBounds = { x: 110, y: 50, width: 20, height: 30 };
    expect(checkBodyOverlap(a, b)).toBe(checkBodyOverlap(b, a));
  });
});
