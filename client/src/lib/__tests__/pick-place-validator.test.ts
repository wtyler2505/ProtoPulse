/**
 * Tests for pick-place-validator.ts (BL-0469)
 *
 * Pick-and-place validation rules + statistics engine.
 */
import { describe, it, expect } from 'vitest';
import {
  validatePickAndPlace,
  getPnPStats,
} from '../pick-place-validator';
import type {
  PnPPlacement,
  PnPValidationResult,
} from '../pick-place-validator';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePlacement(overrides: Partial<PnPPlacement> = {}): PnPPlacement {
  return {
    refdes: 'R1',
    x: 10,
    y: 20,
    rotation: 0,
    side: 'top',
    package: '0402',
    value: '10k',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Valid placements
// ---------------------------------------------------------------------------

describe('validatePickAndPlace', () => {
  it('returns valid result for well-formed placements', () => {
    const placements: PnPPlacement[] = [
      makePlacement({ refdes: 'R1', x: 5, y: 5, value: '10k', package: '0402' }),
      makePlacement({ refdes: 'C1', x: 15, y: 10, value: '100nF', package: '0603' }),
      makePlacement({ refdes: 'U1', x: 25, y: 20, value: 'ATmega328P', package: 'TQFP-32' }),
    ];
    const result = validatePickAndPlace(placements);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  it('returns valid for a single well-formed placement', () => {
    const result = validatePickAndPlace([makePlacement()]);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // ERROR: Missing refdes
  // -------------------------------------------------------------------------

  describe('missing refdes', () => {
    it('errors when refdes is empty string', () => {
      const result = validatePickAndPlace([makePlacement({ refdes: '' })]);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ field: 'refdes', severity: 'error' }),
      );
    });

    it('errors when refdes is whitespace only', () => {
      const result = validatePickAndPlace([makePlacement({ refdes: '   ' })]);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ field: 'refdes', severity: 'error' }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // ERROR: Missing / NaN coordinates
  // -------------------------------------------------------------------------

  describe('missing or NaN coordinates', () => {
    it('errors when x is NaN', () => {
      const result = validatePickAndPlace([makePlacement({ x: NaN })]);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ field: 'x', severity: 'error' }),
      );
    });

    it('errors when y is NaN', () => {
      const result = validatePickAndPlace([makePlacement({ y: NaN })]);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ field: 'y', severity: 'error' }),
      );
    });

    it('errors when x is Infinity', () => {
      const result = validatePickAndPlace([makePlacement({ x: Infinity })]);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ field: 'x', severity: 'error' }),
      );
    });

    it('errors when y is -Infinity', () => {
      const result = validatePickAndPlace([makePlacement({ y: -Infinity })]);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ field: 'y', severity: 'error' }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // ERROR: Duplicate refdes
  // -------------------------------------------------------------------------

  describe('duplicate refdes', () => {
    it('errors when same refdes appears twice', () => {
      const placements = [
        makePlacement({ refdes: 'R1', x: 5, y: 5 }),
        makePlacement({ refdes: 'R1', x: 15, y: 15 }),
      ];
      const result = validatePickAndPlace(placements);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ field: 'refdes', severity: 'error', refdes: 'R1' }),
      );
    });

    it('errors for each duplicated refdes group', () => {
      const placements = [
        makePlacement({ refdes: 'R1', x: 5, y: 5 }),
        makePlacement({ refdes: 'R1', x: 15, y: 15 }),
        makePlacement({ refdes: 'C1', x: 25, y: 25 }),
        makePlacement({ refdes: 'C1', x: 35, y: 35 }),
      ];
      const result = validatePickAndPlace(placements);
      const dupErrors = result.errors.filter(
        (e) => e.message.toLowerCase().includes('duplicate'),
      );
      expect(dupErrors.length).toBeGreaterThanOrEqual(2);
    });

    it('does not flag unique refdes values', () => {
      const placements = [
        makePlacement({ refdes: 'R1', x: 5, y: 5 }),
        makePlacement({ refdes: 'R2', x: 15, y: 15 }),
      ];
      const result = validatePickAndPlace(placements);
      expect(result.errors.filter((e) => e.message.toLowerCase().includes('duplicate'))).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // WARNING: Rotation not multiple of 90
  // -------------------------------------------------------------------------

  describe('unusual rotation', () => {
    it('warns when rotation is not a multiple of 90', () => {
      const result = validatePickAndPlace([makePlacement({ rotation: 45 })]);
      expect(result.warnings).toContainEqual(
        expect.objectContaining({ field: 'rotation', severity: 'warning' }),
      );
    });

    it('does not warn for 0 rotation', () => {
      const result = validatePickAndPlace([makePlacement({ rotation: 0 })]);
      expect(result.warnings.filter((w) => w.field === 'rotation')).toHaveLength(0);
    });

    it('does not warn for 90 rotation', () => {
      const result = validatePickAndPlace([makePlacement({ rotation: 90 })]);
      expect(result.warnings.filter((w) => w.field === 'rotation')).toHaveLength(0);
    });

    it('does not warn for 180 rotation', () => {
      const result = validatePickAndPlace([makePlacement({ rotation: 180 })]);
      expect(result.warnings.filter((w) => w.field === 'rotation')).toHaveLength(0);
    });

    it('does not warn for 270 rotation', () => {
      const result = validatePickAndPlace([makePlacement({ rotation: 270 })]);
      expect(result.warnings.filter((w) => w.field === 'rotation')).toHaveLength(0);
    });

    it('does not warn for 360 rotation (treated as 0)', () => {
      const result = validatePickAndPlace([makePlacement({ rotation: 360 })]);
      expect(result.warnings.filter((w) => w.field === 'rotation')).toHaveLength(0);
    });

    it('warns for 30 degrees', () => {
      const result = validatePickAndPlace([makePlacement({ rotation: 30 })]);
      expect(result.warnings).toContainEqual(
        expect.objectContaining({ field: 'rotation', severity: 'warning' }),
      );
    });

    it('warns for 135 degrees', () => {
      const result = validatePickAndPlace([makePlacement({ rotation: 135 })]);
      expect(result.warnings).toContainEqual(
        expect.objectContaining({ field: 'rotation', severity: 'warning' }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // WARNING: Coordinates outside board bounds
  // -------------------------------------------------------------------------

  describe('board bounds checking', () => {
    const dims = { width: 100, height: 80 };

    it('warns when x exceeds board width', () => {
      const result = validatePickAndPlace(
        [makePlacement({ x: 110, y: 40 })],
        dims,
      );
      expect(result.warnings).toContainEqual(
        expect.objectContaining({ field: 'x', severity: 'warning' }),
      );
    });

    it('warns when y exceeds board height', () => {
      const result = validatePickAndPlace(
        [makePlacement({ x: 50, y: 90 })],
        dims,
      );
      expect(result.warnings).toContainEqual(
        expect.objectContaining({ field: 'y', severity: 'warning' }),
      );
    });

    it('warns when x is negative', () => {
      const result = validatePickAndPlace(
        [makePlacement({ x: -5, y: 40 })],
        dims,
      );
      expect(result.warnings).toContainEqual(
        expect.objectContaining({ field: 'x', severity: 'warning' }),
      );
    });

    it('warns when y is negative', () => {
      const result = validatePickAndPlace(
        [makePlacement({ x: 50, y: -10 })],
        dims,
      );
      expect(result.warnings).toContainEqual(
        expect.objectContaining({ field: 'y', severity: 'warning' }),
      );
    });

    it('does not warn when coordinates are within bounds', () => {
      const result = validatePickAndPlace(
        [makePlacement({ x: 50, y: 40 })],
        dims,
      );
      expect(result.warnings.filter((w) => w.field === 'x' || w.field === 'y')).toHaveLength(0);
    });

    it('does not warn at exact boundary edges', () => {
      const result = validatePickAndPlace(
        [makePlacement({ x: 100, y: 80 })],
        dims,
      );
      expect(result.warnings.filter((w) => w.field === 'x' || w.field === 'y')).toHaveLength(0);
    });

    it('does not check bounds when no dimensions provided', () => {
      const result = validatePickAndPlace(
        [makePlacement({ x: 9999, y: 9999 })],
      );
      expect(result.warnings.filter((w) => w.field === 'x' || w.field === 'y')).toHaveLength(0);
    });

    it('warns for negative coords even without board dimensions', () => {
      const result = validatePickAndPlace(
        [makePlacement({ x: -5, y: -10 })],
      );
      expect(result.warnings.filter((w) => w.field === 'x' || w.field === 'y').length).toBeGreaterThanOrEqual(1);
    });
  });

  // -------------------------------------------------------------------------
  // WARNING: Missing package type
  // -------------------------------------------------------------------------

  describe('missing package', () => {
    it('warns when package is empty string', () => {
      const result = validatePickAndPlace([makePlacement({ package: '' })]);
      expect(result.warnings).toContainEqual(
        expect.objectContaining({ field: 'package', severity: 'warning' }),
      );
    });

    it('warns when package is whitespace only', () => {
      const result = validatePickAndPlace([makePlacement({ package: '   ' })]);
      expect(result.warnings).toContainEqual(
        expect.objectContaining({ field: 'package', severity: 'warning' }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // WARNING: Missing value for passives (R, C, L prefixed refdes)
  // -------------------------------------------------------------------------

  describe('missing value for passives', () => {
    it('warns when R-prefixed part has empty value', () => {
      const result = validatePickAndPlace([makePlacement({ refdes: 'R1', value: '' })]);
      expect(result.warnings).toContainEqual(
        expect.objectContaining({ field: 'value', severity: 'warning', refdes: 'R1' }),
      );
    });

    it('warns when C-prefixed part has empty value', () => {
      const result = validatePickAndPlace([makePlacement({ refdes: 'C5', value: '' })]);
      expect(result.warnings).toContainEqual(
        expect.objectContaining({ field: 'value', severity: 'warning', refdes: 'C5' }),
      );
    });

    it('warns when L-prefixed part has empty value', () => {
      const result = validatePickAndPlace([makePlacement({ refdes: 'L3', value: '' })]);
      expect(result.warnings).toContainEqual(
        expect.objectContaining({ field: 'value', severity: 'warning', refdes: 'L3' }),
      );
    });

    it('does not warn for non-passive with empty value', () => {
      const result = validatePickAndPlace([makePlacement({ refdes: 'U1', value: '' })]);
      expect(result.warnings.filter((w) => w.field === 'value')).toHaveLength(0);
    });

    it('does not warn for passive with a value', () => {
      const result = validatePickAndPlace([makePlacement({ refdes: 'R1', value: '10k' })]);
      expect(result.warnings.filter((w) => w.field === 'value')).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // Multiple issues on same component
  // -------------------------------------------------------------------------

  describe('multiple issues on same component', () => {
    it('reports both error and warning on the same placement', () => {
      const result = validatePickAndPlace([
        makePlacement({ refdes: 'R1', x: NaN, y: 5, rotation: 45, value: '', package: '' }),
      ]);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(1);
      expect(result.warnings.length).toBeGreaterThanOrEqual(1);
    });

    it('reports all relevant issues for a badly-formed placement', () => {
      const result = validatePickAndPlace([
        makePlacement({ refdes: '', x: NaN, y: Infinity, rotation: 33, package: '', value: '' }),
      ]);
      // Should have at least: missing refdes, NaN x, Infinity y
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
    });
  });

  // -------------------------------------------------------------------------
  // Empty placements array
  // -------------------------------------------------------------------------

  describe('empty input', () => {
    it('returns valid for empty placements array', () => {
      const result = validatePickAndPlace([]);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
      expect(result.stats.total).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------

  describe('edge cases', () => {
    it('handles very large coordinate values without error', () => {
      const result = validatePickAndPlace([
        makePlacement({ x: 1_000_000, y: 1_000_000 }),
      ]);
      // Valid as long as no board dimensions provided
      expect(result.valid).toBe(true);
    });

    it('handles zero coordinates without issues', () => {
      const result = validatePickAndPlace([
        makePlacement({ x: 0, y: 0 }),
      ]);
      expect(result.valid).toBe(true);
    });

    it('includes suggestion field on issues where applicable', () => {
      const result = validatePickAndPlace([
        makePlacement({ refdes: '', x: NaN }),
      ]);
      const withSuggestion = [...result.errors, ...result.warnings].filter(
        (i) => i.suggestion !== undefined,
      );
      expect(withSuggestion.length).toBeGreaterThanOrEqual(1);
    });

    it('valid flag is false when there are errors, true when only warnings', () => {
      // Only warnings (rotation)
      const warningOnly = validatePickAndPlace([makePlacement({ rotation: 45 })]);
      expect(warningOnly.valid).toBe(true);
      expect(warningOnly.warnings.length).toBeGreaterThanOrEqual(1);

      // Errors (NaN x)
      const withError = validatePickAndPlace([makePlacement({ x: NaN })]);
      expect(withError.valid).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

describe('getPnPStats', () => {
  it('computes total count', () => {
    const placements = [
      makePlacement({ refdes: 'R1' }),
      makePlacement({ refdes: 'C1' }),
      makePlacement({ refdes: 'U1' }),
    ];
    const stats = getPnPStats(placements);
    expect(stats.total).toBe(3);
  });

  it('counts top and bottom side placements', () => {
    const placements = [
      makePlacement({ refdes: 'R1', side: 'top' }),
      makePlacement({ refdes: 'R2', side: 'top' }),
      makePlacement({ refdes: 'C1', side: 'bottom' }),
    ];
    const stats = getPnPStats(placements);
    expect(stats.topSide).toBe(2);
    expect(stats.bottomSide).toBe(1);
  });

  it('counts unique packages', () => {
    const placements = [
      makePlacement({ refdes: 'R1', package: '0402' }),
      makePlacement({ refdes: 'R2', package: '0402' }),
      makePlacement({ refdes: 'C1', package: '0603' }),
      makePlacement({ refdes: 'U1', package: 'TQFP-32' }),
    ];
    const stats = getPnPStats(placements);
    expect(stats.uniquePackages).toBe(3);
  });

  it('returns zero for all stats on empty array', () => {
    const stats = getPnPStats([]);
    expect(stats.total).toBe(0);
    expect(stats.topSide).toBe(0);
    expect(stats.bottomSide).toBe(0);
    expect(stats.uniquePackages).toBe(0);
  });

  it('does not count empty package strings as unique packages', () => {
    const placements = [
      makePlacement({ refdes: 'R1', package: '' }),
      makePlacement({ refdes: 'R2', package: '0402' }),
    ];
    const stats = getPnPStats(placements);
    expect(stats.uniquePackages).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Result shape conformance
// ---------------------------------------------------------------------------

describe('result shape', () => {
  it('validatePickAndPlace returns all required fields', () => {
    const result: PnPValidationResult = validatePickAndPlace([makePlacement()]);
    expect(typeof result.valid).toBe('boolean');
    expect(Array.isArray(result.errors)).toBe(true);
    expect(Array.isArray(result.warnings)).toBe(true);
    expect(typeof result.stats.total).toBe('number');
    expect(typeof result.stats.topSide).toBe('number');
    expect(typeof result.stats.bottomSide).toBe('number');
    expect(typeof result.stats.uniquePackages).toBe('number');
  });
});
