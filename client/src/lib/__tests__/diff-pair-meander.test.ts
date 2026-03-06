import { describe, it, expect } from 'vitest';
import {
  calculateMeanderParams,
  generateMeander,
  fitMeander,
} from '../pcb/diff-pair-meander';
import type {
  MeanderCalcConfig,
  MeanderConfig,
  FitMeanderConfig,
  Point2D,
} from '../pcb/diff-pair-meander';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Compute total euclidean path length from a point array. */
function pathLength(pts: Point2D[]): number {
  let len = 0;
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i].x - pts[i - 1].x;
    const dy = pts[i].y - pts[i - 1].y;
    len += Math.sqrt(dx * dx + dy * dy);
  }
  return len;
}

// ---------------------------------------------------------------------------
// calculateMeanderParams
// ---------------------------------------------------------------------------

describe('DiffPairMeander', () => {
  describe('calculateMeanderParams', () => {
    it('should compute number of U-turns needed for target additional length', () => {
      const params = calculateMeanderParams({
        additionalLength: 2.0,
        amplitude: 0.5,
        spacing: 0.3,
        style: 'trombone',
      });

      expect(params.turnCount).toBeGreaterThan(0);
      expect(params.totalAdded).toBeGreaterThanOrEqual(2.0);
      // Should not overshoot by more than one full turn
      expect(params.totalAdded).toBeLessThan(2.0 + 2 * 0.5);
    });

    it('should return zero turns for zero additional length', () => {
      const params = calculateMeanderParams({
        additionalLength: 0,
        amplitude: 0.5,
        spacing: 0.3,
        style: 'trombone',
      });
      expect(params.turnCount).toBe(0);
      expect(params.totalAdded).toBe(0);
    });

    it('should reject negative additional length', () => {
      expect(() =>
        calculateMeanderParams({
          additionalLength: -1,
          amplitude: 0.5,
          spacing: 0.3,
          style: 'trombone',
        }),
      ).toThrow(/negative/i);
    });

    it('should reject zero amplitude', () => {
      expect(() =>
        calculateMeanderParams({
          additionalLength: 2,
          amplitude: 0,
          spacing: 0.3,
          style: 'trombone',
        }),
      ).toThrow(/amplitude/i);
    });

    it('should reject negative amplitude', () => {
      expect(() =>
        calculateMeanderParams({
          additionalLength: 2,
          amplitude: -0.5,
          spacing: 0.3,
          style: 'trombone',
        }),
      ).toThrow(/amplitude/i);
    });

    it('should compute sawtooth parameters', () => {
      const params = calculateMeanderParams({
        additionalLength: 2.0,
        amplitude: 0.5,
        spacing: 0.3,
        style: 'sawtooth',
      });
      expect(params.turnCount).toBeGreaterThan(0);
      expect(params.totalAdded).toBeGreaterThanOrEqual(2.0);
    });

    it('should produce consistent segmentLength for trombone', () => {
      const params = calculateMeanderParams({
        additionalLength: 4.0,
        amplitude: 1.0,
        spacing: 0.5,
        style: 'trombone',
      });
      // Each trombone turn adds 2 * amplitude
      expect(params.totalAdded).toBeCloseTo(params.turnCount * 2 * 1.0);
    });
  });

  // ---------------------------------------------------------------------------
  // generateMeander
  // ---------------------------------------------------------------------------

  describe('generateMeander', () => {
    const baseTrombone: MeanderConfig = {
      start: { x: 0, y: 0 },
      end: { x: 10, y: 0 },
      additionalLength: 2.0,
      amplitude: 0.5,
      spacing: 0.3,
      style: 'trombone',
      side: 'left',
    };

    it('should generate trombone meander points along X axis', () => {
      const result = generateMeander(baseTrombone);

      expect(result.points.length).toBeGreaterThan(2);
      // First point at start
      expect(result.points[0].x).toBeCloseTo(0);
      expect(result.points[0].y).toBeCloseTo(0);
      // Last point at end
      expect(result.points[result.points.length - 1].x).toBeCloseTo(10);
      expect(result.points[result.points.length - 1].y).toBeCloseTo(0);
      // Added length meets target
      expect(result.addedLength).toBeGreaterThanOrEqual(2.0 - 0.01);
    });

    it('should preserve start and end points exactly', () => {
      const result = generateMeander({
        ...baseTrombone,
        start: { x: 3.7, y: -2.1 },
        end: { x: 15.2, y: -2.1 },
      });

      expect(result.points[0].x).toBeCloseTo(3.7);
      expect(result.points[0].y).toBeCloseTo(-2.1);
      const last = result.points[result.points.length - 1];
      expect(last.x).toBeCloseTo(15.2);
      expect(last.y).toBeCloseTo(-2.1);
    });

    it('should generate meander on the left side (positive Y for rightward travel)', () => {
      const result = generateMeander(baseTrombone);

      // Left of rightward travel = positive perpendicular = positive Y
      const maxY = Math.max(...result.points.map((p) => p.y));
      expect(maxY).toBeGreaterThan(0);
    });

    it('should generate meander on the right side (negative Y for rightward travel)', () => {
      const result = generateMeander({ ...baseTrombone, side: 'right' });

      const minY = Math.min(...result.points.map((p) => p.y));
      expect(minY).toBeLessThan(0);
    });

    it('should generate sawtooth meander points', () => {
      const result = generateMeander({ ...baseTrombone, style: 'sawtooth' });

      expect(result.points.length).toBeGreaterThan(2);
      expect(result.addedLength).toBeGreaterThanOrEqual(2.0 - 0.01);
      // Start and end preserved
      expect(result.points[0].x).toBeCloseTo(0);
      expect(result.points[0].y).toBeCloseTo(0);
      expect(result.points[result.points.length - 1].x).toBeCloseTo(10);
      expect(result.points[result.points.length - 1].y).toBeCloseTo(0);
    });

    it('should work along Y axis', () => {
      const result = generateMeander({
        ...baseTrombone,
        start: { x: 0, y: 0 },
        end: { x: 0, y: 10 },
      });

      expect(result.points[0].x).toBeCloseTo(0);
      expect(result.points[0].y).toBeCloseTo(0);
      const last = result.points[result.points.length - 1];
      expect(last.x).toBeCloseTo(0);
      expect(last.y).toBeCloseTo(10);
      expect(result.addedLength).toBeGreaterThanOrEqual(2.0 - 0.01);
    });

    it('should work along 45-degree path', () => {
      const result = generateMeander({
        ...baseTrombone,
        start: { x: 0, y: 0 },
        end: { x: 10, y: 10 },
      });

      expect(result.points.length).toBeGreaterThan(2);
      expect(result.addedLength).toBeGreaterThanOrEqual(1.9);
      // Start and end
      expect(result.points[0].x).toBeCloseTo(0);
      expect(result.points[0].y).toBeCloseTo(0);
      const last = result.points[result.points.length - 1];
      expect(last.x).toBeCloseTo(10);
      expect(last.y).toBeCloseTo(10);
    });

    it('should return straight path when additionalLength is 0', () => {
      const result = generateMeander({ ...baseTrombone, additionalLength: 0 });

      expect(result.points).toHaveLength(2);
      expect(result.addedLength).toBeCloseTo(0);
      expect(result.points[0].x).toBeCloseTo(0);
      expect(result.points[0].y).toBeCloseTo(0);
      expect(result.points[1].x).toBeCloseTo(10);
      expect(result.points[1].y).toBeCloseTo(0);
    });

    it('should produce path whose measured length matches the expected total', () => {
      const result = generateMeander(baseTrombone);

      const straightDist = 10; // start to end distance
      const measuredLen = pathLength(result.points);
      // Measured path length should be approximately straightDist + addedLength
      expect(measuredLen).toBeCloseTo(straightDist + result.addedLength, 0);
    });

    it('should handle very small additional length', () => {
      const result = generateMeander({ ...baseTrombone, additionalLength: 0.1 });

      expect(result.points.length).toBeGreaterThanOrEqual(2);
      expect(result.addedLength).toBeGreaterThanOrEqual(0.1 - 0.01);
    });

    it('should handle large additional length', () => {
      const result = generateMeander({
        ...baseTrombone,
        additionalLength: 20.0,
        amplitude: 2.0,
        spacing: 0.5,
      });

      expect(result.addedLength).toBeGreaterThanOrEqual(20.0 - 0.01);
      expect(result.points[0].x).toBeCloseTo(0);
      expect(result.points[0].y).toBeCloseTo(0);
      const last = result.points[result.points.length - 1];
      expect(last.x).toBeCloseTo(10);
      expect(last.y).toBeCloseTo(0);
    });
  });

  // ---------------------------------------------------------------------------
  // fitMeander
  // ---------------------------------------------------------------------------

  describe('fitMeander', () => {
    const baseConfig: FitMeanderConfig = {
      additionalLength: 2.0,
      amplitude: 0.5,
      spacing: 0.3,
      style: 'trombone',
      side: 'left',
    };

    it('should insert meander into the longest straight segment of a path', () => {
      const path: Point2D[] = [
        { x: 0, y: 0 },
        { x: 5, y: 0 }, // 5mm segment
        { x: 5, y: 20 }, // 20mm segment — longest, meander goes here
        { x: 15, y: 20 }, // 10mm segment
      ];

      const result = fitMeander(path, baseConfig);

      expect(result.points.length).toBeGreaterThan(4);
      // Starts at same start
      expect(result.points[0].x).toBeCloseTo(0);
      expect(result.points[0].y).toBeCloseTo(0);
      // Ends at same end
      const last = result.points[result.points.length - 1];
      expect(last.x).toBeCloseTo(15);
      expect(last.y).toBeCloseTo(20);
      // Added length met
      expect(result.addedLength).toBeGreaterThanOrEqual(2.0 - 0.01);
    });

    it('should return original path when additionalLength is 0', () => {
      const path: Point2D[] = [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ];
      const result = fitMeander(path, { ...baseConfig, additionalLength: 0 });
      expect(result.points).toHaveLength(2);
      expect(result.addedLength).toBeCloseTo(0);
    });

    it('should throw when meander does not fit (segment too short)', () => {
      const path: Point2D[] = [
        { x: 0, y: 0 },
        { x: 0.5, y: 0 },
      ];
      expect(() =>
        fitMeander(path, {
          ...baseConfig,
          additionalLength: 50,
          amplitude: 5,
          spacing: 2,
        }),
      ).toThrow(/fit/i);
    });

    it('should preserve non-meander segments unchanged', () => {
      const path: Point2D[] = [
        { x: 0, y: 0 },
        { x: 2, y: 0 }, // 2mm — short segment
        { x: 2, y: 30 }, // 30mm — longest → meander here
        { x: 12, y: 30 }, // 10mm — short
      ];

      const result = fitMeander(path, baseConfig);

      // First segment endpoints should be preserved (before meander)
      expect(result.points[0].x).toBeCloseTo(0);
      expect(result.points[0].y).toBeCloseTo(0);
      expect(result.points[1].x).toBeCloseTo(2);
      expect(result.points[1].y).toBeCloseTo(0);

      // Last point should be the original end
      const last = result.points[result.points.length - 1];
      expect(last.x).toBeCloseTo(12);
      expect(last.y).toBeCloseTo(30);
    });

    it('should handle two-point path (single segment)', () => {
      const path: Point2D[] = [
        { x: 0, y: 0 },
        { x: 20, y: 0 },
      ];
      const result = fitMeander(path, baseConfig);

      expect(result.points.length).toBeGreaterThan(2);
      expect(result.points[0].x).toBeCloseTo(0);
      expect(result.points[0].y).toBeCloseTo(0);
      const last = result.points[result.points.length - 1];
      expect(last.x).toBeCloseTo(20);
      expect(last.y).toBeCloseTo(0);
    });

    it('should work with sawtooth style', () => {
      const path: Point2D[] = [
        { x: 0, y: 0 },
        { x: 20, y: 0 },
      ];
      const result = fitMeander(path, { ...baseConfig, style: 'sawtooth' });

      expect(result.points.length).toBeGreaterThan(2);
      expect(result.addedLength).toBeGreaterThanOrEqual(2.0 - 0.01);
    });
  });
});
