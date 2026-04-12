/**
 * Tests for `shared/parts/part-slug.ts` — deterministic slug generator.
 *
 * Determinism is load-bearing: the slug is used as a dedup key during ingress.
 * Same input → same slug, always. Collision handling is handled separately in
 * the ingress pipeline (Phase 2).
 */

import { describe, it, expect } from 'vitest';
import { generateSlug, slugify, appendCollisionSuffix } from '../parts/part-slug';

describe('slugify', () => {
  it('lowercases and replaces spaces with hyphens', () => {
    expect(slugify('Hello World')).toBe('hello-world');
  });

  it('replaces % with pct', () => {
    expect(slugify('1%')).toBe('1pct');
    expect(slugify('0.1%')).toBe('01pct');
  });

  it('replaces + with p', () => {
    expect(slugify('BC5+')).toBe('bc5p');
  });

  it('strips dots from decimal numbers', () => {
    expect(slugify('3.3V')).toBe('33v');
    expect(slugify('1.5K')).toBe('15k');
  });

  it('collapses multiple non-alphanumerics into a single hyphen', () => {
    expect(slugify('foo!!!bar')).toBe('foo-bar');
    expect(slugify('foo___bar')).toBe('foo-bar');
    expect(slugify('foo   bar')).toBe('foo-bar');
  });

  it('strips leading and trailing hyphens', () => {
    expect(slugify('!!!foo!!!')).toBe('foo');
    expect(slugify('---bar---')).toBe('bar');
  });

  it('returns empty string when input has no alphanumerics', () => {
    expect(slugify('!!!')).toBe('');
    expect(slugify('---')).toBe('');
  });

  it('preserves alphanumeric characters as-is', () => {
    expect(slugify('abc123')).toBe('abc123');
  });
});

describe('generateSlug', () => {
  it('uses category abbreviations for known categories', () => {
    expect(generateSlug({ canonicalCategory: 'resistor' })).toBe('res');
    expect(generateSlug({ canonicalCategory: 'capacitor' })).toBe('cap');
    expect(generateSlug({ canonicalCategory: 'inductor' })).toBe('ind');
    expect(generateSlug({ canonicalCategory: 'mcu' })).toBe('mcu');
    expect(generateSlug({ canonicalCategory: 'crystal' })).toBe('xtal');
  });

  it('handles singular and plural category forms identically', () => {
    expect(generateSlug({ canonicalCategory: 'resistor' })).toBe('res');
    expect(generateSlug({ canonicalCategory: 'resistors' })).toBe('res');
    expect(generateSlug({ canonicalCategory: 'capacitor' })).toBe('cap');
    expect(generateSlug({ canonicalCategory: 'capacitors' })).toBe('cap');
  });

  it('is case-insensitive for category lookup', () => {
    expect(generateSlug({ canonicalCategory: 'RESISTOR' })).toBe('res');
    expect(generateSlug({ canonicalCategory: 'Resistor' })).toBe('res');
    expect(generateSlug({ canonicalCategory: 'reSISTor' })).toBe('res');
  });

  it('falls through to slugify(category) for unknown categories', () => {
    expect(generateSlug({ canonicalCategory: 'antenna' })).toBe('antenna');
    expect(generateSlug({ canonicalCategory: 'RF Filter' })).toBe('rf-filter');
  });

  it('produces the documented 10kΩ resistor slug', () => {
    expect(generateSlug({
      canonicalCategory: 'resistor',
      value: '10k',
      packageType: '0402',
      tolerance: '1%',
    })).toBe('res-10k-0402-1pct');
  });

  it('produces the documented 100nF capacitor slug', () => {
    expect(generateSlug({
      canonicalCategory: 'capacitor',
      value: '100nF',
      packageType: '0603',
      tolerance: '10%',
    })).toBe('cap-100nf-0603-10pct');
  });

  it('falls back to category+mpn for parts without value/package/tolerance', () => {
    expect(generateSlug({
      canonicalCategory: 'mcu',
      manufacturer: 'Espressif',
      mpn: 'ESP32-WROOM-32',
    })).toBe('mcu-esp32-wroom-32');
  });

  it('is deterministic — same input yields same slug', () => {
    const input = {
      canonicalCategory: 'resistor',
      value: '4.7k',
      packageType: '0805',
      tolerance: '5%',
    };
    const a = generateSlug(input);
    const b = generateSlug(input);
    const c = generateSlug({ ...input });
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it('skips falsy optional fields', () => {
    expect(generateSlug({
      canonicalCategory: 'resistor',
      value: '10k',
      packageType: null,
      tolerance: undefined,
    })).toBe('res-10k');
  });

  it('skips empty-string optional fields without producing empty segments', () => {
    expect(generateSlug({
      canonicalCategory: 'resistor',
      value: '10k',
      packageType: '',
      tolerance: '',
    })).toBe('res-10k');
  });

  it('returns "unknown-part" as absolute fallback when no meaningful input', () => {
    expect(generateSlug({
      canonicalCategory: '!!!',
    })).toBe('unknown-part');
  });

  it('handles decimal values correctly (3.3V → 33v)', () => {
    expect(generateSlug({
      canonicalCategory: 'regulator',
      value: '3.3V',
      packageType: 'SOT-223',
    })).toBe('reg-33v-sot-223');
  });

  it('does not append mpn when value is already present', () => {
    const slug = generateSlug({
      canonicalCategory: 'resistor',
      value: '10k',
      mpn: 'RC0402FR-0710KL',
    });
    expect(slug).toBe('res-10k');
    expect(slug).not.toContain('rc0402');
  });

  it('does not append mpn when category only produces one segment but no other data', () => {
    // Edge case: category → 1 segment, no value/package/tolerance, BUT mpn present.
    // Should append mpn for uniqueness.
    const slug = generateSlug({
      canonicalCategory: 'connector',
      mpn: 'XH-2P',
    });
    expect(slug).toBe('con-xh-2p');
  });

  it('produces different slugs for different manufacturers when only mpn differs', () => {
    const a = generateSlug({ canonicalCategory: 'mcu', mpn: 'ESP32' });
    const b = generateSlug({ canonicalCategory: 'mcu', mpn: 'STM32F103' });
    expect(a).not.toBe(b);
  });
});

describe('appendCollisionSuffix', () => {
  it('appends a numeric suffix with a hyphen separator', () => {
    expect(appendCollisionSuffix('res-10k-0402-1pct', 2)).toBe('res-10k-0402-1pct-2');
    expect(appendCollisionSuffix('res-10k-0402-1pct', 3)).toBe('res-10k-0402-1pct-3');
  });

  it('handles n=1 without collapsing (though n=1 should not normally be used)', () => {
    expect(appendCollisionSuffix('cap-100nf', 1)).toBe('cap-100nf-1');
  });

  it('preserves the base slug unchanged', () => {
    const base = 'mcu-esp32-wroom-32';
    const suffixed = appendCollisionSuffix(base, 5);
    expect(suffixed.startsWith(base)).toBe(true);
    expect(suffixed).toBe('mcu-esp32-wroom-32-5');
  });
});
