/**
 * Tests for shared/parts/mpn.ts — MPN normalization + dedup key helpers.
 *
 * Covers: BL-0473 "MPN normalization and dedup in BOM" — ensures that
 * every BOM ingestion path collapses whitespace/case/packaging-suffix
 * variants of the same manufacturer part number to a single canonical
 * comparison form.
 */

import { describe, it, expect } from 'vitest';
import {
  normalizeMpn,
  normalizeManufacturer,
  mpnComparisonKey,
  mpnEquals,
  manufacturerEquals,
  mpnIdentityEquals,
} from '../parts/mpn';

describe('normalizeMpn — basics', () => {
  it('returns empty string for null / undefined / empty inputs', () => {
    expect(normalizeMpn(null)).toBe('');
    expect(normalizeMpn(undefined)).toBe('');
    expect(normalizeMpn('')).toBe('');
    expect(normalizeMpn('   ')).toBe('');
  });

  it('trims leading and trailing whitespace', () => {
    expect(normalizeMpn('  STM32F103C8T6  ')).toBe('STM32F103C8T6');
    expect(normalizeMpn('\tLM317T\n')).toBe('LM317T');
  });

  it('replaces non-breaking spaces with regular spaces then collapses', () => {
    expect(normalizeMpn('STM32\u00A0F103')).toBe('STM32 F103');
  });

  it('collapses internal multi-whitespace to a single space', () => {
    expect(normalizeMpn('STM32   F103  C8T6')).toBe('STM32 F103 C8T6');
  });

  it('preserves original case (does not uppercase or lowercase)', () => {
    expect(normalizeMpn('stm32F103c8T6')).toBe('stm32F103c8T6');
    expect(normalizeMpn('rC0402fr-0710kL')).toBe('rC0402fr-0710kL');
  });

  it('strips surrounding double quotes', () => {
    expect(normalizeMpn('"RC0402FR-0710KL"')).toBe('RC0402FR-0710KL');
  });

  it('strips surrounding single quotes', () => {
    expect(normalizeMpn("'RC0402FR-0710KL'")).toBe('RC0402FR-0710KL');
  });

  it('strips surrounding backticks', () => {
    expect(normalizeMpn('`LM317T`')).toBe('LM317T');
  });

  it('does NOT strip unmatched quotes', () => {
    expect(normalizeMpn('"LM317T')).toBe('"LM317T');
    expect(normalizeMpn("LM317T'")).toBe("LM317T'");
  });
});

describe('normalizeMpn — packaging / lead-finish suffixes', () => {
  it('strips trailing /NOPB (TI no-lead marker)', () => {
    expect(normalizeMpn('LM317T/NOPB')).toBe('LM317T');
    expect(normalizeMpn('lm317t/nopb')).toBe('lm317t');
  });

  it('strips trailing #PBF (lead-free marker)', () => {
    expect(normalizeMpn('ATMEGA328P-PU#PBF')).toBe('ATMEGA328P-PU');
    expect(normalizeMpn('atmega328p-pu#pbf')).toBe('atmega328p-pu');
  });

  it('strips trailing + separator', () => {
    expect(normalizeMpn('ATMEGA328P-PU+')).toBe('ATMEGA328P-PU');
  });

  it('strips -TR / -TR13 / -TR7 tape-and-reel suffixes', () => {
    expect(normalizeMpn('CL10A105KB8NNNC-TR')).toBe('CL10A105KB8NNNC');
    expect(normalizeMpn('CL10A105KB8NNNC-TR13')).toBe('CL10A105KB8NNNC');
    expect(normalizeMpn('CL10A105KB8NNNC-TR7')).toBe('CL10A105KB8NNNC');
  });

  it('strips trailing -7 reel suffix', () => {
    expect(normalizeMpn('SN74HC595N-7')).toBe('SN74HC595N');
  });

  it('handles chained suffixes like /NOPB+', () => {
    expect(normalizeMpn('LM317T/NOPB+')).toBe('LM317T');
  });

  it('does NOT strip -7 in the middle of the MPN', () => {
    expect(normalizeMpn('SN7-HC595N')).toBe('SN7-HC595N');
  });

  it('does NOT strip suffix-looking substrings that are not trailing', () => {
    // /NOPB only at the very end
    expect(normalizeMpn('LM/NOPBX')).toBe('LM/NOPBX');
  });
});

describe('normalizeManufacturer', () => {
  it('trims and collapses whitespace', () => {
    expect(normalizeManufacturer('  Texas   Instruments  ')).toBe('Texas Instruments');
  });

  it('preserves casing', () => {
    expect(normalizeManufacturer('texas instruments')).toBe('texas instruments');
    expect(normalizeManufacturer('TEXAS INSTRUMENTS')).toBe('TEXAS INSTRUMENTS');
  });

  it('strips surrounding quotes', () => {
    expect(normalizeManufacturer('"Yageo"')).toBe('Yageo');
  });

  it('returns empty for null / undefined / empty', () => {
    expect(normalizeManufacturer(null)).toBe('');
    expect(normalizeManufacturer(undefined)).toBe('');
    expect(normalizeManufacturer('')).toBe('');
  });

  it('does NOT strip packaging suffixes (manufacturer names can legitimately end in /TR etc.)', () => {
    // Edge: unusual, but we don't strip suffixes from manufacturers.
    expect(normalizeManufacturer('Acme/NOPB')).toBe('Acme/NOPB');
  });
});

describe('mpnComparisonKey', () => {
  it('normalizes then lowercases', () => {
    expect(mpnComparisonKey('  STM32F103C8T6  ')).toBe('stm32f103c8t6');
    expect(mpnComparisonKey('LM317T/NOPB')).toBe('lm317t');
  });

  it('case variants produce the same key', () => {
    const a = mpnComparisonKey('RC0402FR-0710KL');
    const b = mpnComparisonKey('rc0402fr-0710kl');
    const c = mpnComparisonKey('Rc0402Fr-0710Kl');
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it('returns empty string for empty inputs', () => {
    expect(mpnComparisonKey(null)).toBe('');
    expect(mpnComparisonKey('   ')).toBe('');
  });
});

describe('mpnEquals', () => {
  it('returns true for case variants', () => {
    expect(mpnEquals('STM32F103C8T6', 'stm32f103c8t6')).toBe(true);
  });

  it('returns true for whitespace variants', () => {
    expect(mpnEquals(' STM32F103C8T6 ', 'STM32F103C8T6')).toBe(true);
  });

  it('returns true for suffix variants', () => {
    expect(mpnEquals('LM317T/NOPB', 'LM317T')).toBe(true);
    expect(mpnEquals('ATMEGA328P-PU#PBF', 'atmega328p-pu')).toBe(true);
  });

  it('returns false for genuinely different MPNs', () => {
    expect(mpnEquals('STM32F103C8T6', 'STM32F103RBT6')).toBe(false);
  });

  it('returns false when either side is empty', () => {
    expect(mpnEquals('', 'STM32F103C8T6')).toBe(false);
    expect(mpnEquals('STM32F103C8T6', '')).toBe(false);
    expect(mpnEquals(null, 'STM32F103C8T6')).toBe(false);
    expect(mpnEquals('STM32F103C8T6', null)).toBe(false);
  });
});

describe('manufacturerEquals', () => {
  it('returns true for case variants', () => {
    expect(manufacturerEquals('Yageo', 'yageo')).toBe(true);
    expect(manufacturerEquals('Texas Instruments', 'TEXAS INSTRUMENTS')).toBe(true);
  });

  it('returns false for empty values', () => {
    expect(manufacturerEquals('', '')).toBe(false);
    expect(manufacturerEquals(null, 'Yageo')).toBe(false);
  });
});

describe('mpnIdentityEquals', () => {
  it('is true when both manufacturer and MPN match (case/whitespace-insensitive)', () => {
    expect(
      mpnIdentityEquals(
        { manufacturer: 'Yageo', mpn: 'RC0402FR-0710KL' },
        { manufacturer: 'yageo', mpn: 'rc0402fr-0710kl' },
      ),
    ).toBe(true);
  });

  it('is false when manufacturer differs', () => {
    expect(
      mpnIdentityEquals(
        { manufacturer: 'Yageo', mpn: 'RC0402FR-0710KL' },
        { manufacturer: 'Panasonic', mpn: 'RC0402FR-0710KL' },
      ),
    ).toBe(false);
  });

  it('is false when MPN differs', () => {
    expect(
      mpnIdentityEquals(
        { manufacturer: 'Yageo', mpn: 'RC0402FR-0710KL' },
        { manufacturer: 'Yageo', mpn: 'RC0402FR-0722KL' },
      ),
    ).toBe(false);
  });

  it('is false when either side is missing', () => {
    expect(
      mpnIdentityEquals(
        { mpn: 'RC0402FR-0710KL' },
        { manufacturer: 'Yageo', mpn: 'RC0402FR-0710KL' },
      ),
    ).toBe(false);
  });

  it('respects packaging-suffix equivalence for MPN only', () => {
    expect(
      mpnIdentityEquals(
        { manufacturer: 'TI', mpn: 'LM317T/NOPB' },
        { manufacturer: 'TI', mpn: 'LM317T' },
      ),
    ).toBe(true);
  });
});
