/**
 * BL-0150 — BOM inventory shortfalls endpoint tests.
 *
 * Verifies the pure-mapping layer on top of `BomStorage.getShortfalls` plus
 * the `totalShortfallUnits` aggregate. The SQL filter itself is exercised in
 * integration tests that run against a real pg instance; here we focus on
 * the transform shape because that's what the client depends on.
 */
import { describe, it, expect } from 'vitest';
import { computeShortfall, totalShortfallUnits, type BomShortfall } from '@shared/parts/shortfall';

const mkShortfall = (partial: Partial<BomShortfall>): BomShortfall => ({
  partId: 'part-1',
  partNumber: 'RC0603FR-0710KL',
  manufacturer: 'Yageo',
  description: '10k 1% 0603',
  quantityNeeded: 10,
  quantityOnHand: 3,
  shortfall: 7,
  storageLocation: null,
  ...partial,
});

describe('BomShortfall endpoint shape', () => {
  it('computes per-row shortfall consistently with server transform', () => {
    const row = mkShortfall({ quantityNeeded: 20, quantityOnHand: 5, shortfall: 15 });
    expect(row.shortfall).toBe(15);
    expect(computeShortfall(row)).toBe(15);
  });

  it('aggregates totalShortfallUnits for a multi-row BOM', () => {
    const rows = [
      mkShortfall({ partId: 'a', shortfall: 7 }),
      mkShortfall({ partId: 'b', shortfall: 0 }),
      mkShortfall({ partId: 'c', shortfall: 12 }),
    ];
    expect(totalShortfallUnits(rows)).toBe(19);
  });

  it('treats on-hand: 0 as a shortfall when there is demand', () => {
    const row: BomShortfall = mkShortfall({ quantityNeeded: 4, quantityOnHand: 0, shortfall: 4 });
    expect(computeShortfall(row)).toBe(4);
  });
});
