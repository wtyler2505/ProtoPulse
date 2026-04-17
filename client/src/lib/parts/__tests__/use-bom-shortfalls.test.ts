import { describe, it, expect } from 'vitest';
import { indexShortfallsByPartNumber, bomShortfallsQueryKey } from '../use-bom-shortfalls';
import type { BomShortfall } from '@shared/parts/shortfall';

const row = (partial: Partial<BomShortfall>): BomShortfall => ({
  partId: 'p',
  partNumber: 'X',
  manufacturer: 'M',
  description: 'D',
  quantityNeeded: 10,
  quantityOnHand: 0,
  shortfall: 10,
  storageLocation: null,
  ...partial,
});

describe('bomShortfallsQueryKey', () => {
  it('is stable for the same project id', () => {
    expect(bomShortfallsQueryKey(42)).toEqual(bomShortfallsQueryKey(42));
  });

  it('encodes the project id in the URL segment (invalidation target)', () => {
    const [url] = bomShortfallsQueryKey(7) as string[];
    expect(url).toBe('/api/projects/7/bom/shortfalls');
  });
});

describe('indexShortfallsByPartNumber', () => {
  it('returns an empty map when data is undefined', () => {
    expect(indexShortfallsByPartNumber(undefined).size).toBe(0);
  });

  it('indexes by partNumber field for fast BomTable lookup', () => {
    const rows = [
      row({ partId: 'a', partNumber: 'RC0603FR-0710KL', shortfall: 7 }),
      row({ partId: 'b', partNumber: 'CC0603KRX7R9BB104', shortfall: 3 }),
    ];
    const idx = indexShortfallsByPartNumber(rows);
    expect(idx.size).toBe(2);
    expect(idx.get('RC0603FR-0710KL')?.shortfall).toBe(7);
    expect(idx.get('CC0603KRX7R9BB104')?.shortfall).toBe(3);
    expect(idx.get('missing')).toBeUndefined();
  });
});
