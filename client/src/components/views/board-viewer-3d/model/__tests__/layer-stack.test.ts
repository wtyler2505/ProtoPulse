import { describe, it, expect } from 'vitest';

import {
  buildLayerStack,
  copperLayerCount,
  COPPER_THICKNESS_MM,
  MAX_LAYERS
  
} from '../layer-stack';

import type {LayerStack} from '../layer-stack';

function copperLayers(stack: LayerStack) {
  return stack.layers.filter((l) => l.role === 'copper');
}

describe('buildLayerStack — copper layer count (fixes TD-3D-07 7-entry cap)', () => {
  it('2-layer board has exactly 2 copper layers (top + bottom, no inner)', () => {
    const stack = buildLayerStack(2, 1.6);
    expect(copperLayerCount(stack)).toBe(2);
    expect(copperLayers(stack).filter((l) => l.side === 'inner')).toHaveLength(0);
  });

  it('4-layer board has 4 copper layers with 2 inner planes', () => {
    const stack = buildLayerStack(4, 1.6);
    expect(copperLayerCount(stack)).toBe(4);
    const inner = copperLayers(stack).filter((l) => l.side === 'inner');
    expect(inner).toHaveLength(2);
  });

  it('generates N copper layers for arbitrary N (e.g. 8, 12)', () => {
    expect(copperLayerCount(buildLayerStack(8))).toBe(8);
    expect(copperLayerCount(buildLayerStack(12))).toBe(12);
  });

  it('single-sided (1-layer) board has only one copper layer and no top films', () => {
    const stack = buildLayerStack(1, 1.6);
    expect(copperLayerCount(stack)).toBe(1);
    expect(stack.layers.some((l) => l.side === 'top')).toBe(false);
  });

  it('clamps out-of-range layer counts to [1, 32]', () => {
    expect(copperLayerCount(buildLayerStack(0))).toBe(1);
    expect(copperLayerCount(buildLayerStack(99))).toBe(MAX_LAYERS);
  });

  it('rounds and defaults non-finite counts to 2', () => {
    expect(copperLayerCount(buildLayerStack(Number.NaN))).toBe(2);
  });
});

describe('buildLayerStack — geometry & ordering', () => {
  it('orders layers bottom→top by zBottom', () => {
    const { layers } = buildLayerStack(4, 1.6);
    for (let i = 1; i < layers.length; i += 1) {
      expect(layers[i].zBottom).toBeGreaterThanOrEqual(layers[i - 1].zBottom);
    }
  });

  it('substrate spans the full board thickness', () => {
    const stack = buildLayerStack(2, 1.6);
    const sub = stack.layers.find((l) => l.role === 'substrate');
    expect(sub).toBeDefined();
    expect(sub?.zBottom).toBe(0);
    expect(sub?.zTop).toBe(1.6);
  });

  it('inner copper planes are strictly inside the substrate and evenly spaced', () => {
    const stack = buildLayerStack(4, 1.6);
    const inner = stack.layers.filter((l) => l.role === 'copper' && l.side === 'inner');
    expect(inner).toHaveLength(2);
    for (const l of inner) {
      expect(l.zBottom).toBeGreaterThan(0);
      expect(l.zTop).toBeLessThan(1.6);
      expect(l.thickness).toBeCloseTo(COPPER_THICKNESS_MM, 6);
    }
    // Two inner planes at 1/3 and 2/3 of thickness.
    const centers = inner.map((l) => (l.zBottom + l.zTop) / 2).sort((a, b) => a - b);
    expect(centers[0]).toBeCloseTo(1.6 / 3, 5);
    expect(centers[1]).toBeCloseTo((2 * 1.6) / 3, 5);
  });

  it('all layer ids are unique', () => {
    const ids = buildLayerStack(8).layers.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('inner copper hidden by default; outer copper visible', () => {
    const stack = buildLayerStack(4);
    const inner = stack.layers.filter((l) => l.role === 'copper' && l.side === 'inner');
    const outer = stack.layers.filter((l) => l.role === 'copper' && l.side !== 'inner');
    expect(inner.every((l) => !l.visibleByDefault)).toBe(true);
    expect(outer.every((l) => l.visibleByDefault)).toBe(true);
  });

  it('applies the requested solder-mask colour to mask layers', () => {
    const stack = buildLayerStack(2, 1.6, '#7a1f1f');
    const masks = stack.layers.filter((l) => l.role === 'soldermask');
    expect(masks.length).toBeGreaterThan(0);
    expect(masks.every((l) => l.color === '#7a1f1f')).toBe(true);
  });
});
