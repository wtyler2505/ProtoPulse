/**
 * anchors.test.ts
 *
 * Colocated unit tests for diagram/anchors.ts — the critical ratified getNodeAnchor.
 *
 * Covers:
 * - All 9 AnchorKind values
 * - 150×70 default (Architecture legacy)
 * - Variable measuredSize override (future variable-height nodes)
 * - GraphNode / plain position input (no size on node = Arch persisted data)
 * - DiagramNode with embedded size
 * - Fallback precedence (arg > node.size > default)
 * - Zero mutation of input
 * - Round / grid-friendly numbers (20px Architecture grid examples)
 * - Edge cases: zero size, negative coords (math only)
 */

import { describe, it, expect } from 'vitest';
import { getNodeAnchor } from './anchors';
import type { MeasuredSize, AnchorKind } from './types';
import { snapValue, ARCHITECTURE_DEFAULTS } from './coordinate';

describe('diagram/anchors', () => {
  const DEFAULT_W = 150;
  const DEFAULT_H = 70;

  function archNode(x: number, y: number) {
    // Persisted GraphNode shape (no size, no mutation risk)
    return { id: 'arch-' + x, position: { x, y }, data: { label: 'Component', type: 'mcu' } };
  }

  function sizedNode(x: number, y: number, size: MeasuredSize) {
    return { id: 'sized', position: { x, y }, size };
  }

  // ---------------------------------------------------------------------------
  // Default 150x70 + center (the exact legacy math being replaced)
  // ---------------------------------------------------------------------------

  it('defaults to center of 150×70 for Architecture GraphNode with no size', () => {
    const n = archNode(100, 200);
    const a = getNodeAnchor(n);
    expect(a.x).toBe(100 + 75);
    expect(a.y).toBe(200 + 35);
    expect(a.kind).toBe('center');
  });

  it('center is exactly half extents', () => {
    const a = getNodeAnchor(archNode(0, 0));
    expect(a.x).toBe(DEFAULT_W / 2);
    expect(a.y).toBe(DEFAULT_H / 2);
  });

  // ---------------------------------------------------------------------------
  // All AnchorKind values
  // ---------------------------------------------------------------------------

  const kinds: AnchorKind[] = [
    'center',
    'left',
    'right',
    'top',
    'bottom',
    'top-left',
    'top-right',
    'bottom-left',
    'bottom-right',
  ];

  it('supports every AnchorKind without throwing', () => {
    const n = archNode(200, 300);
    for (const k of kinds) {
      const a = getNodeAnchor(n, null, k);
      expect(a.kind).toBe(k);
      expect(typeof a.x).toBe('number');
      expect(typeof a.y).toBe('number');
      expect(isFinite(a.x)).toBe(true);
      expect(isFinite(a.y)).toBe(true);
    }
  });

  it('computes correct coordinates for each kind (default size)', () => {
    const n = archNode(0, 0);
    expect(getNodeAnchor(n, null, 'left')).toEqual({ x: 0, y: 35, kind: 'left' });
    expect(getNodeAnchor(n, null, 'right')).toEqual({ x: 150, y: 35, kind: 'right' });
    expect(getNodeAnchor(n, null, 'top')).toEqual({ x: 75, y: 0, kind: 'top' });
    expect(getNodeAnchor(n, null, 'bottom')).toEqual({ x: 75, y: 70, kind: 'bottom' });
    expect(getNodeAnchor(n, null, 'top-left')).toEqual({ x: 0, y: 0, kind: 'top-left' });
    expect(getNodeAnchor(n, null, 'top-right')).toEqual({ x: 150, y: 0, kind: 'top-right' });
    expect(getNodeAnchor(n, null, 'bottom-left')).toEqual({ x: 0, y: 70, kind: 'bottom-left' });
    expect(getNodeAnchor(n, null, 'bottom-right')).toEqual({ x: 150, y: 70, kind: 'bottom-right' });
    expect(getNodeAnchor(n, null, 'center')).toEqual({ x: 75, y: 35, kind: 'center' });
  });

  // ---------------------------------------------------------------------------
  // Variable size + measuredSize override
  // ---------------------------------------------------------------------------

  it('uses caller-supplied measuredSize over everything (variable height nodes)', () => {
    const n = archNode(10, 20);
    const measured: MeasuredSize = { width: 220, height: 95 };
    const a = getNodeAnchor(n, measured, 'bottom-right');
    expect(a.x).toBe(10 + 220);
    expect(a.y).toBe(20 + 95);
    expect(a.kind).toBe('bottom-right');
  });

  it('falls back to node-embedded size when no measured arg', () => {
    const n = sizedNode(5, 5, { width: 80, height: 40 });
    const a = getNodeAnchor(n, null, 'center');
    expect(a.x).toBe(5 + 40);
    expect(a.y).toBe(5 + 20);
  });

  it('measuredSize arg wins even if node has size', () => {
    const n = sizedNode(0, 0, { width: 10, height: 10 });
    const a = getNodeAnchor(n, { width: 300, height: 100 }, 'right');
    expect(a.x).toBe(300);
  });

  // ---------------------------------------------------------------------------
  // Architecture 20px grid + round numbers
  // ---------------------------------------------------------------------------

  it('anchor results are exact and compatible with 20px grid snap (Architecture)', () => {
    const grid = ARCHITECTURE_DEFAULTS.gridStep ?? 20;
    const n = archNode(140, 60); // on-grid start
    const center = getNodeAnchor(n, { width: 160, height: 80 }); // 160/2=80, 80/2=40 -> 220,100
    expect(snapValue(center.x, grid)).toBe(220);
    expect(snapValue(center.y, grid)).toBe(100);
  });

  // ---------------------------------------------------------------------------
  // No mutation (critical for persisted GraphNode)
  // ---------------------------------------------------------------------------

  it('never mutates the input node (especially GraphNode position/data)', () => {
    const n: any = { id: 'm1', position: { x: 999, y: 888 }, data: { foo: 'bar' } };
    const origX = n.position.x;
    const origY = n.position.y;
    const origData = JSON.stringify(n.data);

    getNodeAnchor(n, { width: 400, height: 120 }, 'bottom-left');

    expect(n.position.x).toBe(origX);
    expect(n.position.y).toBe(origY);
    expect(JSON.stringify(n.data)).toBe(origData);
    // also ensure we did not add size or anything
    expect(n.size).toBeUndefined();
  });

  // ---------------------------------------------------------------------------
  // Edge numeric cases
  // ---------------------------------------------------------------------------

  it('handles zero-size gracefully (degenerate but stable)', () => {
    const a = getNodeAnchor(archNode(50, 50), { width: 0, height: 0 }, 'center');
    expect(a.x).toBe(50);
    expect(a.y).toBe(50);
  });

  it('handles negative coordinates without NaN', () => {
    const a = getNodeAnchor(archNode(-200, -100), null, 'top-right');
    expect(a.x).toBe(-50);
    expect(a.y).toBe(-100);
  });
});
