/**
 * Rotation Utilities Tests
 *
 * Tests for normalizeAngle, snapToAngle, rotatePoint, getRotationTransform,
 * degreesToRadians, radiansToDegrees, isRightAngle, and COMMON_ANGLES.
 */

import { describe, it, expect } from 'vitest';
import {
  normalizeAngle,
  snapToAngle,
  rotatePoint,
  getRotationTransform,
  degreesToRadians,
  radiansToDegrees,
  isRightAngle,
  COMMON_ANGLES,
} from '../rotation-utils';

// ---------------------------------------------------------------------------
// COMMON_ANGLES
// ---------------------------------------------------------------------------

describe('COMMON_ANGLES', () => {
  it('contains 16 preset angles', () => {
    expect(COMMON_ANGLES).toHaveLength(16);
  });

  it('starts at 0 and includes every 30/45 degree stop', () => {
    expect(COMMON_ANGLES[0]).toBe(0);
    expect(COMMON_ANGLES).toContain(45);
    expect(COMMON_ANGLES).toContain(90);
    expect(COMMON_ANGLES).toContain(180);
    expect(COMMON_ANGLES).toContain(270);
  });

  it('is sorted ascending', () => {
    for (let i = 1; i < COMMON_ANGLES.length; i++) {
      expect(COMMON_ANGLES[i]).toBeGreaterThan(COMMON_ANGLES[i - 1]!);
    }
  });

  it('all values are in [0, 360)', () => {
    for (const a of COMMON_ANGLES) {
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThan(360);
    }
  });
});

// ---------------------------------------------------------------------------
// degreesToRadians / radiansToDegrees
// ---------------------------------------------------------------------------

describe('degreesToRadians', () => {
  it('converts 0 degrees to 0 radians', () => {
    expect(degreesToRadians(0)).toBe(0);
  });

  it('converts 90 degrees to PI/2', () => {
    expect(degreesToRadians(90)).toBeCloseTo(Math.PI / 2);
  });

  it('converts 180 degrees to PI', () => {
    expect(degreesToRadians(180)).toBeCloseTo(Math.PI);
  });

  it('converts 360 degrees to 2*PI', () => {
    expect(degreesToRadians(360)).toBeCloseTo(2 * Math.PI);
  });

  it('converts negative degrees correctly', () => {
    expect(degreesToRadians(-90)).toBeCloseTo(-Math.PI / 2);
  });

  it('converts 45 degrees to PI/4', () => {
    expect(degreesToRadians(45)).toBeCloseTo(Math.PI / 4);
  });
});

describe('radiansToDegrees', () => {
  it('converts 0 radians to 0 degrees', () => {
    expect(radiansToDegrees(0)).toBe(0);
  });

  it('converts PI/2 to 90 degrees', () => {
    expect(radiansToDegrees(Math.PI / 2)).toBeCloseTo(90);
  });

  it('converts PI to 180 degrees', () => {
    expect(radiansToDegrees(Math.PI)).toBeCloseTo(180);
  });

  it('converts 2*PI to 360 degrees', () => {
    expect(radiansToDegrees(2 * Math.PI)).toBeCloseTo(360);
  });

  it('round-trips with degreesToRadians', () => {
    for (const deg of [0, 30, 45, 60, 90, 123.456, 270, 359]) {
      expect(radiansToDegrees(degreesToRadians(deg))).toBeCloseTo(deg);
    }
  });
});

// ---------------------------------------------------------------------------
// normalizeAngle
// ---------------------------------------------------------------------------

describe('normalizeAngle', () => {
  it('returns 0 for 0', () => {
    expect(normalizeAngle(0)).toBe(0);
  });

  it('returns 90 for 90', () => {
    expect(normalizeAngle(90)).toBe(90);
  });

  it('returns 0 for 360 (wraps exact multiple)', () => {
    expect(normalizeAngle(360)).toBe(0);
  });

  it('returns 0 for 720', () => {
    expect(normalizeAngle(720)).toBe(0);
  });

  it('handles positive angles > 360', () => {
    expect(normalizeAngle(450)).toBe(90);
    expect(normalizeAngle(810)).toBe(90);
  });

  it('handles negative angles', () => {
    expect(normalizeAngle(-90)).toBe(270);
    expect(normalizeAngle(-180)).toBe(180);
    expect(normalizeAngle(-1)).toBe(359);
  });

  it('handles large negative angles', () => {
    expect(normalizeAngle(-720)).toBe(0);
    expect(normalizeAngle(-810)).toBe(270);
  });

  it('preserves fractional degrees', () => {
    expect(normalizeAngle(45.5)).toBeCloseTo(45.5);
    expect(normalizeAngle(-0.5)).toBeCloseTo(359.5);
  });

  it('normalizes 359 to 359', () => {
    expect(normalizeAngle(359)).toBe(359);
  });
});

// ---------------------------------------------------------------------------
// snapToAngle
// ---------------------------------------------------------------------------

describe('snapToAngle', () => {
  it('snaps 14 to 15 with increment 15', () => {
    expect(snapToAngle(14, 15)).toBe(15);
  });

  it('snaps 7 to 0 with increment 15', () => {
    expect(snapToAngle(7, 15)).toBe(0);
  });

  it('snaps 8 to 15 with increment 15 (midpoint rounds up)', () => {
    // Math.round(8/15) = Math.round(0.533) = 1 → 15
    expect(snapToAngle(8, 15)).toBe(15);
  });

  it('snaps 22 to 0 with increment 45', () => {
    expect(snapToAngle(22, 45)).toBe(0);
  });

  it('snaps 23 to 45 with increment 45', () => {
    // Math.round(23/45) = Math.round(0.511) = 1 → 45
    expect(snapToAngle(23, 45)).toBe(45);
  });

  it('snaps exact multiples to themselves', () => {
    expect(snapToAngle(90, 45)).toBe(90);
    expect(snapToAngle(180, 15)).toBe(180);
    expect(snapToAngle(0, 90)).toBe(0);
  });

  it('snaps 350 to 345 with increment 15', () => {
    // Math.round(350/15) = Math.round(23.33) = 23 → 345
    expect(snapToAngle(350, 15)).toBe(345);
  });

  it('snaps 355 to 0 with increment 15', () => {
    // Math.round(355/15) = Math.round(23.67) = 24 → 360 → normalized 0
    expect(snapToAngle(355, 15)).toBe(0);
  });

  it('handles negative input angles', () => {
    // -10 → normalized 350 → snap to 345 with increment 15
    expect(snapToAngle(-10, 15)).toBe(345);
  });

  it('returns normalized angle when snapIncrement is 0', () => {
    expect(snapToAngle(45, 0)).toBe(45);
    expect(snapToAngle(-90, 0)).toBe(270);
  });

  it('returns normalized angle when snapIncrement is negative', () => {
    expect(snapToAngle(45, -15)).toBe(45);
  });

  it('snaps to 90 with increment 90', () => {
    expect(snapToAngle(44, 90)).toBe(0);
    expect(snapToAngle(46, 90)).toBe(90);
    expect(snapToAngle(135, 90)).toBe(180);
  });
});

// ---------------------------------------------------------------------------
// rotatePoint
// ---------------------------------------------------------------------------

describe('rotatePoint', () => {
  const EPSILON = 1e-10;

  it('rotating by 0 degrees returns the same point', () => {
    const result = rotatePoint(5, 3, 0, 0, 0);
    expect(result.x).toBeCloseTo(5);
    expect(result.y).toBeCloseTo(3);
  });

  it('rotates (1, 0) by 90 degrees around origin to (0, 1)', () => {
    const result = rotatePoint(1, 0, 0, 0, 90);
    expect(result.x).toBeCloseTo(0, 10);
    expect(result.y).toBeCloseTo(1, 10);
  });

  it('rotates (1, 0) by 180 degrees around origin to (-1, 0)', () => {
    const result = rotatePoint(1, 0, 0, 0, 180);
    expect(result.x).toBeCloseTo(-1, 10);
    expect(result.y).toBeCloseTo(0, 10);
  });

  it('rotates (1, 0) by 270 degrees around origin to (0, -1)', () => {
    const result = rotatePoint(1, 0, 0, 0, 270);
    expect(result.x).toBeCloseTo(0, 10);
    expect(result.y).toBeCloseTo(-1, 10);
  });

  it('rotates (1, 0) by 360 degrees back to (1, 0)', () => {
    const result = rotatePoint(1, 0, 0, 0, 360);
    expect(result.x).toBeCloseTo(1, 10);
    expect(result.y).toBeCloseTo(0, 10);
  });

  it('rotates (1, 0) by 45 degrees around origin', () => {
    const result = rotatePoint(1, 0, 0, 0, 45);
    const expected = Math.SQRT2 / 2;
    expect(result.x).toBeCloseTo(expected, 10);
    expect(result.y).toBeCloseTo(expected, 10);
  });

  it('rotates around a non-origin center', () => {
    // Point (3, 2), center (2, 2), 90 degrees
    // dx=1, dy=0 → rotated to (0, 1) → (2+0, 2+1) = (2, 3)
    const result = rotatePoint(3, 2, 2, 2, 90);
    expect(result.x).toBeCloseTo(2, 10);
    expect(result.y).toBeCloseTo(3, 10);
  });

  it('rotating a point on the center returns the center', () => {
    const result = rotatePoint(5, 5, 5, 5, 123);
    expect(result.x).toBeCloseTo(5, 10);
    expect(result.y).toBeCloseTo(5, 10);
  });

  it('handles negative rotation angles', () => {
    // (0, 1) rotated -90 degrees around origin → (1, 0)
    const result = rotatePoint(0, 1, 0, 0, -90);
    expect(result.x).toBeCloseTo(1, 10);
    expect(result.y).toBeCloseTo(0, 10);
  });

  it('handles arbitrary angle (30 degrees)', () => {
    // (2, 0) rotated 30 degrees: x = 2*cos30, y = 2*sin30
    const result = rotatePoint(2, 0, 0, 0, 30);
    expect(result.x).toBeCloseTo(2 * Math.cos(Math.PI / 6), 10);
    expect(result.y).toBeCloseTo(2 * Math.sin(Math.PI / 6), 10);
  });

  it('full rotation (720 degrees) returns the same point', () => {
    const result = rotatePoint(3, 4, 1, 2, 720);
    expect(result.x).toBeCloseTo(3, 8);
    expect(result.y).toBeCloseTo(4, 8);
  });
});

// ---------------------------------------------------------------------------
// getRotationTransform
// ---------------------------------------------------------------------------

describe('getRotationTransform', () => {
  it('returns rotate(0deg) for 0', () => {
    expect(getRotationTransform(0)).toBe('rotate(0deg)');
  });

  it('returns rotate(90deg) for 90', () => {
    expect(getRotationTransform(90)).toBe('rotate(90deg)');
  });

  it('returns rotate(45deg) for 45', () => {
    expect(getRotationTransform(45)).toBe('rotate(45deg)');
  });

  it('includes negative values', () => {
    expect(getRotationTransform(-30)).toBe('rotate(-30deg)');
  });

  it('includes decimal values', () => {
    expect(getRotationTransform(12.5)).toBe('rotate(12.5deg)');
  });
});

// ---------------------------------------------------------------------------
// isRightAngle
// ---------------------------------------------------------------------------

describe('isRightAngle', () => {
  it('returns true for 0', () => {
    expect(isRightAngle(0)).toBe(true);
  });

  it('returns true for 90', () => {
    expect(isRightAngle(90)).toBe(true);
  });

  it('returns true for 180', () => {
    expect(isRightAngle(180)).toBe(true);
  });

  it('returns true for 270', () => {
    expect(isRightAngle(270)).toBe(true);
  });

  it('returns true for 360 (normalizes to 0)', () => {
    expect(isRightAngle(360)).toBe(true);
  });

  it('returns true for -90 (normalizes to 270)', () => {
    expect(isRightAngle(-90)).toBe(true);
  });

  it('returns false for 45', () => {
    expect(isRightAngle(45)).toBe(false);
  });

  it('returns false for 30', () => {
    expect(isRightAngle(30)).toBe(false);
  });

  it('returns false for 135', () => {
    expect(isRightAngle(135)).toBe(false);
  });

  it('returns false for 1', () => {
    expect(isRightAngle(1)).toBe(false);
  });

  it('returns false for 89', () => {
    expect(isRightAngle(89)).toBe(false);
  });

  it('returns true for 540 (normalizes to 180)', () => {
    expect(isRightAngle(540)).toBe(true);
  });
});
