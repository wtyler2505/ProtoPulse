import { describe, it, expect } from 'vitest';

import {
  PACKAGE_HEIGHTS_MM,
  CATEGORY_HEIGHT_FALLBACK_MM,
  DEFAULT_PACKAGE_HEIGHT_MM,
  canonicalisePackageName,
  getPackageHeight,
} from '../package-heights';

describe('canonicalisePackageName', () => {
  it('upper-cases and normalises separators', () => {
    expect(canonicalisePackageName('soic_8')).toBe('SOIC-8');
    expect(canonicalisePackageName('  SOIC 8 ')).toBe('SOIC-8');
    expect(canonicalisePackageName('SOIC--8')).toBe('SOIC-8');
    expect(canonicalisePackageName('0603')).toBe('0603');
  });
});

describe('getPackageHeight — exact table hits', () => {
  it('returns the consolidated DIP-8 height (datasheet 3.3, resolving the 5.0 vs 3.3 conflict)', () => {
    expect(getPackageHeight('DIP-8')).toBe(3.3);
  });

  it('returns chip-passive heights', () => {
    expect(getPackageHeight('0402')).toBe(0.5);
    expect(getPackageHeight('0603')).toBe(0.6);
    expect(getPackageHeight('0805')).toBe(0.7);
    expect(getPackageHeight('1206')).toBe(0.8);
  });

  it('normalises TO-220 to its upright seated height (4.5, not 15.0)', () => {
    expect(getPackageHeight('TO-220')).toBe(4.5);
  });

  it('resolves casing/separator variants to the same entry', () => {
    expect(getPackageHeight('soic_8')).toBe(PACKAGE_HEIGHTS_MM['SOIC-8']);
    expect(getPackageHeight('Sot-23')).toBe(PACKAGE_HEIGHTS_MM['SOT-23']);
  });
});

describe('getPackageHeight — override', () => {
  it('honours a finite positive override verbatim', () => {
    expect(getPackageHeight('DIP-8', 9.9)).toBe(9.9);
  });

  it('ignores non-positive / non-finite overrides', () => {
    expect(getPackageHeight('DIP-8', 0)).toBe(3.3);
    expect(getPackageHeight('DIP-8', -1)).toBe(3.3);
    expect(getPackageHeight('DIP-8', Number.NaN)).toBe(3.3);
  });

  it('uses override even for unknown packages', () => {
    expect(getPackageHeight('WEIRD-PKG', 1.23)).toBe(1.23);
  });
});

describe('getPackageHeight — category fallback for unknown packages', () => {
  it('treats 4-digit imperial codes as passives', () => {
    expect(getPackageHeight('0201')).toBe(CATEGORY_HEIGHT_FALLBACK_MM.passive);
    expect(getPackageHeight('2512')).toBe(CATEGORY_HEIGHT_FALLBACK_MM.passive);
  });

  it('treats DIP-N / TO-N families as through-hole', () => {
    expect(getPackageHeight('DIP-64')).toBe(CATEGORY_HEIGHT_FALLBACK_MM.throughHole);
    expect(getPackageHeight('TO-247')).toBe(CATEGORY_HEIGHT_FALLBACK_MM.throughHole);
  });

  it('treats SOIC/QFP/QFN-style names as generic SMD', () => {
    expect(getPackageHeight('SOIC-20')).toBe(CATEGORY_HEIGHT_FALLBACK_MM.smd);
    expect(getPackageHeight('QFN-64')).toBe(CATEGORY_HEIGHT_FALLBACK_MM.smd);
  });

  it('falls back to the default for truly unknown names', () => {
    expect(getPackageHeight('MYSTERY')).toBe(DEFAULT_PACKAGE_HEIGHT_MM);
  });

  it('returns the default for null/undefined/empty', () => {
    expect(getPackageHeight(null)).toBe(DEFAULT_PACKAGE_HEIGHT_MM);
    expect(getPackageHeight(undefined)).toBe(DEFAULT_PACKAGE_HEIGHT_MM);
  });
});
