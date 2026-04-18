/**
 * Breadboard drag-to-move tests.
 *
 * Tests for the computeMoveResult utility that determines whether a component
 * can be moved to a new position on the breadboard.
 *
 * Runs in client project config (happy-dom environment).
 */

import { describe, it, expect } from 'vitest';
import { computeMoveResult } from '../breadboard-drag-move';
import type { ComponentPlacement } from '../breadboard-model';
import { BB } from '../breadboard-model';

describe('computeMoveResult', () => {
  it('returns valid move when target position has no collision', () => {
    const existing: ComponentPlacement[] = [];
    const result = computeMoveResult(
      { type: 'terminal', col: 'a', row: 10 },
      'resistor',
      2,
      existing,
      1, // instanceId being moved — excluded from collision check
    );
    expect(result.valid).toBe(true);
    expect(result.placement).toBeTruthy();
    expect(result.placement?.startRow).toBe(10);
  });

  it('returns invalid when target collides with existing placement', () => {
    const existing: ComponentPlacement[] = [
      { refDes: 'R1', startCol: 'a', startRow: 10, rowSpan: 2, crossesChannel: false },
    ];
    const result = computeMoveResult(
      { type: 'terminal', col: 'a', row: 10 },
      'resistor',
      2,
      existing,
      999, // different instanceId — won't be excluded
    );
    expect(result.valid).toBe(false);
  });

  it('excludes the component being moved from collision check', () => {
    const existing: ComponentPlacement[] = [
      { refDes: 'R1', startCol: 'a', startRow: 10, rowSpan: 2, crossesChannel: false },
    ];
    // Moving R1 to its own position — should be valid since it's excluded
    const result = computeMoveResult(
      { type: 'terminal', col: 'a', row: 10 },
      'resistor',
      2,
      existing,
      1, // exclude instanceId 1
      [1], // instanceIds parallel to existing placements
    );
    expect(result.valid).toBe(true);
  });

  it('returns invalid for rail coordinates', () => {
    const result = computeMoveResult(
      { type: 'rail', rail: 'left_pos', index: 5 },
      'resistor',
      2,
      [],
      1,
    );
    expect(result.valid).toBe(false);
  });

  it('clamps row span to board bounds', () => {
    const result = computeMoveResult(
      { type: 'terminal', col: 'a', row: BB.ROWS },
      'ic',
      8,
      [],
      1,
    );
    expect(result.valid).toBe(true);
    if (result.placement) {
      expect(result.placement.startRow + result.placement.rowSpan - 1).toBeLessThanOrEqual(BB.ROWS);
    }
  });

  it('returns pixel position for valid moves', () => {
    const result = computeMoveResult(
      { type: 'terminal', col: 'a', row: 5 },
      'resistor',
      2,
      [],
      1,
    );
    expect(result.valid).toBe(true);
    expect(result.snapPixel).toBeTruthy();
    expect(result.snapPixel?.x).toBeGreaterThan(0);
    expect(result.snapPixel?.y).toBeGreaterThan(0);
  });
});
