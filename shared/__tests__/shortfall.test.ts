import { describe, it, expect } from 'vitest';
import {
  computeShortfall,
  hasShortfall,
  totalShortfallUnits,
  shortfallOf,
} from '../parts/shortfall';

describe('computeShortfall (BL-0150)', () => {
  it('returns 0 when on-hand covers demand exactly', () => {
    expect(computeShortfall({ quantityNeeded: 10, quantityOnHand: 10 })).toBe(0);
  });

  it('returns 0 when on-hand exceeds demand', () => {
    expect(computeShortfall({ quantityNeeded: 5, quantityOnHand: 20 })).toBe(0);
  });

  it('returns positive shortfall when demand exceeds supply', () => {
    expect(computeShortfall({ quantityNeeded: 10, quantityOnHand: 3 })).toBe(7);
  });

  it('treats null on-hand as zero (nothing on shelf)', () => {
    expect(computeShortfall({ quantityNeeded: 4, quantityOnHand: null })).toBe(4);
  });

  it('clamps negative on-hand to zero', () => {
    expect(computeShortfall({ quantityNeeded: 5, quantityOnHand: -3 })).toBe(5);
  });

  it('clamps negative demand to zero', () => {
    expect(computeShortfall({ quantityNeeded: -2, quantityOnHand: 5 })).toBe(0);
  });

  it('returns 0 when both demand and supply are zero', () => {
    expect(computeShortfall({ quantityNeeded: 0, quantityOnHand: 0 })).toBe(0);
  });

  it('handles non-finite values without NaN leakage', () => {
    expect(computeShortfall({ quantityNeeded: Number.NaN, quantityOnHand: 5 })).toBe(0);
    expect(computeShortfall({ quantityNeeded: 5, quantityOnHand: Number.NaN })).toBe(5);
  });

  it('hasShortfall flips with the integer result', () => {
    expect(hasShortfall({ quantityNeeded: 1, quantityOnHand: 0 })).toBe(true);
    expect(hasShortfall({ quantityNeeded: 0, quantityOnHand: 0 })).toBe(false);
    expect(hasShortfall({ quantityNeeded: 10, quantityOnHand: 10 })).toBe(false);
  });

  it('shortfallOf reads PartStockRow fields', () => {
    expect(shortfallOf({ quantityNeeded: 12, quantityOnHand: 5 })).toBe(7);
  });
});

describe('totalShortfallUnits', () => {
  it('sums shortfall across rows', () => {
    expect(totalShortfallUnits([
      { shortfall: 3 },
      { shortfall: 0 },
      { shortfall: 4 },
    ])).toBe(7);
  });

  it('returns 0 for an empty list', () => {
    expect(totalShortfallUnits([])).toBe(0);
  });
});
