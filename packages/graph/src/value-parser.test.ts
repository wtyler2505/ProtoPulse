import { describe, expect, it } from 'vitest';

import { parseValue  } from './value-parser.js';

import type {ComponentClass} from './value-parser.js';

function val(raw: string, cls?: ComponentClass): { value: number; unit: string } {
  const r = parseValue(raw, cls);
  if ('error' in r) throw new Error(`unexpected parse error for "${raw}": ${r.error}`);
  return { value: r.value, unit: r.unit };
}

/** Float-tolerant check: SI math like 100×1e-9 carries IEEE-754 noise. */
function expectVal(raw: string, cls: ComponentClass, value: number, unit: string): void {
  const r = val(raw, cls);
  expect(r.unit).toBe(unit);
  expect(r.value).toBeCloseTo(value, Math.abs(value) > 0 ? 15 - Math.ceil(Math.log10(Math.abs(value))) : 12);
}

function err(raw: string, cls?: ComponentClass): string {
  const r = parseValue(raw, cls);
  if (!('error' in r)) throw new Error(`expected error for "${raw}", got ${String(r.value)}`);
  return r.error;
}

describe('parseValue', () => {
  it('parses plain numbers with class-inferred units', () => {
    expect(val('10', 'resistor')).toEqual({ value: 10, unit: 'ohm' });
    expect(val('330', 'resistor')).toEqual({ value: 330, unit: 'ohm' });
    expect(val('5', 'voltage')).toEqual({ value: 5, unit: 'volt' });
    expect(val('42')).toEqual({ value: 42, unit: 'none' });
  });

  it('a bare number on a capacitor is ambiguous — error, ask', () => {
    expect(err('10', 'capacitor')).toContain('ambiguous');
    expect(err('10', 'inductor')).toContain('ambiguous');
  });

  it('parses SI multipliers', () => {
    expectVal('10k', 'resistor', 10_000, 'ohm');
    expectVal('10K', 'resistor', 10_000, 'ohm');
    expectVal('1M', 'resistor', 1_000_000, 'ohm');
    expectVal('1G', 'resistor', 1e9, 'ohm');
    expectVal('100nF', 'capacitor', 1e-7, 'farad');
    expectVal('10uF', 'capacitor', 1e-5, 'farad');
    expectVal('10µF', 'capacitor', 1e-5, 'farad');
    expectVal('22pF', 'capacitor', 2.2e-11, 'farad');
    expectVal('3m', 'resistor', 0.003, 'ohm');
  });

  it('parses the 4k7 infix convention', () => {
    expectVal('4k7', 'resistor', 4_700, 'ohm');
    expectVal('1M2', 'resistor', 1_200_000, 'ohm');
    expectVal('4R7', 'resistor', 4.7, 'ohm');
    expectVal('2n2', 'capacitor', 2.2e-9, 'farad');
    expectVal('4u7', 'capacitor', 4.7e-6, 'farad');
  });

  it('infix takes the class unit; classless infix is unitless', () => {
    expect(val('4k7', 'other').unit).toBe('none');
    expect(val('1m5', 'inductor')).toEqual({ value: 0.0015, unit: 'henry' });
  });

  it('parses explicit units, including multiplier glued to unit', () => {
    expectVal('100 nF', 'capacitor', 1e-7, 'farad');
    expectVal('3.3V', 'voltage', 3.3, 'volt');
    expectVal('2A', 'current', 2, 'amp');
    expectVal('16MHz', 'frequency', 16e6, 'hertz');
    expectVal('10mH', 'inductor', 0.01, 'henry');
    expectVal('1k ohm', 'resistor', 1000, 'ohm');
    expectVal('220R', 'resistor', 220, 'ohm');
  });

  it('preserves raw text verbatim', () => {
    const r = parseValue('  4k7 ', 'resistor');
    if ('error' in r) throw new Error('parse failed');
    expect(r.raw).toBe('  4k7 ');
  });

  it('rejects unit/class mismatches — a farad resistor is a typo', () => {
    expect(err('100nF', 'resistor')).toContain('does not match');
    expect(err('10k', 'capacitor')).toBeTruthy();
  });

  it('rejects garbage, empty, and unknown units', () => {
    expect(err('')).toBe('empty value');
    expect(err('   ')).toBe('empty value');
    expect(err('abc')).toContain('cannot parse');
    expect(err('10 wat')).toContain('unknown unit');
    expect(err('--5')).toContain('cannot parse');
  });

  it('handles negatives and decimals', () => {
    expect(val('-5V', 'voltage')).toEqual({ value: -5, unit: 'volt' });
    expect(val('0.1', 'resistor')).toEqual({ value: 0.1, unit: 'ohm' });
    expect(val('1.5k', 'resistor')).toEqual({ value: 1500, unit: 'ohm' });
  });
});
