import { describe, expect, it } from 'vitest';
import { formatMeasurementDistance, getMeasurementDistanceMm, getMeasurementMidpoint } from '../measurement';

describe('WebGL measurement helpers', () => {
  it('calculates 3D distances in millimeters', () => {
    expect(getMeasurementDistanceMm([0, 0, 0], [3, 4, 12])).toBe(13);
  });

  it('formats millimeter labels with two decimals', () => {
    expect(formatMeasurementDistance(12.345)).toBe('12.35 mm');
  });

  it('places the label at the segment midpoint', () => {
    expect(getMeasurementMidpoint([-2, 1, 4], [8, 5, -2])).toEqual([3, 3, 1]);
  });
});
