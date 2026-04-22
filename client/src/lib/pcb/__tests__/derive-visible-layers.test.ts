/**
 * deriveVisibleLayers — Tests (E2E-233, Plan 02 Phase 6)
 *
 * Regression coverage for the bug where the PCB layer-visibility panel on a
 * 4+ layer stack only rendered top/bottom toggles (inner layers were never
 * rendered). The panel now derives its visible layer list from
 * `board.layers` (Plan 02 Phase 4 source of truth). This function is that
 * derivation, extracted as a pure helper so it can be unit-tested and reused
 * by any consumer (PCBLayoutView, BoardViewer3DView, reporting, etc.).
 */

import { describe, it, expect } from 'vitest';
import { deriveVisibleLayers } from '../layer-utils';

describe('deriveVisibleLayers (E2E-233)', () => {
  it('returns 2 layers when layerCount=2 (F.Cu, B.Cu)', () => {
    const v = deriveVisibleLayers(2);
    expect(v).toHaveLength(2);
    expect(v[0].id).toBe('F.Cu');
    expect(v[1].id).toBe('B.Cu');
  });

  it('returns 4 layers when layerCount=4', () => {
    expect(deriveVisibleLayers(4)).toHaveLength(4);
  });

  it('includes inner layers alongside outer on a 4-layer board', () => {
    const v = deriveVisibleLayers(4);
    expect(v).toContainEqual(expect.objectContaining({ id: 'F.Cu' }));
    expect(v).toContainEqual(expect.objectContaining({ id: 'In1.Cu' }));
    expect(v).toContainEqual(expect.objectContaining({ id: 'In2.Cu' }));
    expect(v).toContainEqual(expect.objectContaining({ id: 'B.Cu' }));
  });

  it('returns 6 ordered layers when layerCount=6', () => {
    const v = deriveVisibleLayers(6);
    expect(v.map((l: { id: string }) => l.id)).toEqual([
      'F.Cu',
      'In1.Cu',
      'In2.Cu',
      'In3.Cu',
      'In4.Cu',
      'B.Cu',
    ]);
  });

  it('returns 8 ordered layers when layerCount=8', () => {
    expect(deriveVisibleLayers(8).map((l: { id: string }) => l.id)).toEqual([
      'F.Cu',
      'In1.Cu',
      'In2.Cu',
      'In3.Cu',
      'In4.Cu',
      'In5.Cu',
      'In6.Cu',
      'B.Cu',
    ]);
  });

  it('assigns a human-readable label to each entry', () => {
    const v = deriveVisibleLayers(4);
    expect(v[0].label).toMatch(/top|front/i);
    expect(v[v.length - 1].label).toMatch(/bottom|back/i);
    expect(v[1].label).toMatch(/inner/i);
  });

  it('defaults each layer to visible', () => {
    const v = deriveVisibleLayers(4);
    for (const entry of v) {
      expect(entry.visible).toBe(true);
    }
  });

  it('coerces layerCount below 2 up to 2 (a board must have at least 2 copper layers)', () => {
    expect(deriveVisibleLayers(0)).toHaveLength(2);
    expect(deriveVisibleLayers(1)).toHaveLength(2);
  });

  it('clamps layerCount above the max', () => {
    const v = deriveVisibleLayers(999);
    expect(v.length).toBeLessThanOrEqual(32);
    expect(v.length).toBeGreaterThan(0);
  });
});
