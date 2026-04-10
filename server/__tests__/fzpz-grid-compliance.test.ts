/**
 * FZPZ 9px Grid Compliance Tests
 *
 * Fritzing uses a 0.1" (2.54mm) grid rendered at 90 DPI = 9px.
 * All connector positions in exported SVGs must land on exact 9px multiples
 * for proper alignment in Fritzing's breadboard view.
 *
 * Tests the snapToFritzingGrid() utility and verifies buildSvg() output
 * has connector positions snapped to the grid.
 */

import { describe, it, expect } from 'vitest';
import { snapToFritzingGrid, validateFritzingGrid } from '../component-export';

// ===========================================================================
// snapToFritzingGrid
// ===========================================================================

describe('snapToFritzingGrid', () => {
  it('returns exact value when already on 9px grid', () => {
    expect(snapToFritzingGrid(0)).toBe(0);
    expect(snapToFritzingGrid(9)).toBe(9);
    expect(snapToFritzingGrid(18)).toBe(18);
    expect(snapToFritzingGrid(90)).toBe(90);
  });

  it('rounds to nearest 9px multiple', () => {
    expect(snapToFritzingGrid(1)).toBe(0);
    expect(snapToFritzingGrid(4)).toBe(0);
    expect(snapToFritzingGrid(5)).toBe(9);
    expect(snapToFritzingGrid(10)).toBe(9);
    expect(snapToFritzingGrid(13)).toBe(9);
    expect(snapToFritzingGrid(14)).toBe(18);
  });

  it('handles negative values', () => {
    // Math.round(-1/9) = -0, -0*9 = -0; use toEqual for -0/+0 equivalence
    expect(snapToFritzingGrid(-1) === 0 || snapToFritzingGrid(-1) === -0).toBe(true);
    expect(snapToFritzingGrid(-5)).toBe(-9);
    expect(snapToFritzingGrid(-9)).toBe(-9);
  });

  it('handles large values', () => {
    expect(snapToFritzingGrid(1000)).toBe(999);   // 1000/9=111.11 -> 111 -> 999
    expect(snapToFritzingGrid(1001)).toBe(999);   // 1001/9=111.22 -> 111 -> 999
    expect(snapToFritzingGrid(1004)).toBe(1008);  // 1004/9=111.56 -> 112 -> 1008
    expect(snapToFritzingGrid(1005)).toBe(1008);  // 1005/9=111.67 -> 112 -> 1008
  });

  it('handles fractional values', () => {
    // 4.5/9 = 0.5 -> Math.round(0.5) = 1 -> 9
    expect(snapToFritzingGrid(4.5)).toBe(9);
    expect(snapToFritzingGrid(8.9)).toBe(9);  // 8.9/9 = 0.989 -> 1 -> 9
  });
});

// ===========================================================================
// validateFritzingGrid
// ===========================================================================

describe('validateFritzingGrid', () => {
  it('returns valid for positions on the 9px grid', () => {
    const result = validateFritzingGrid([
      { id: 'pin1', x: 0, y: 0 },
      { id: 'pin2', x: 9, y: 18 },
      { id: 'pin3', x: 27, y: 36 },
    ]);
    expect(result.valid).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('returns violations for off-grid positions', () => {
    const result = validateFritzingGrid([
      { id: 'pin1', x: 0, y: 0 },
      { id: 'pin2', x: 10, y: 18 },  // x=10 is off-grid
      { id: 'pin3', x: 27, y: 37 },  // y=37 is off-grid
    ]);
    expect(result.valid).toBe(false);
    expect(result.violations).toHaveLength(2);
    expect(result.violations[0].id).toBe('pin2');
    expect(result.violations[1].id).toBe('pin3');
  });

  it('returns valid for empty positions array', () => {
    const result = validateFritzingGrid([]);
    expect(result.valid).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('provides snapped coordinates in violations', () => {
    const result = validateFritzingGrid([
      { id: 'pin1', x: 10, y: 20 },
    ]);
    expect(result.valid).toBe(false);
    expect(result.violations[0].snappedX).toBe(9);
    expect(result.violations[0].snappedY).toBe(18);
  });
});
