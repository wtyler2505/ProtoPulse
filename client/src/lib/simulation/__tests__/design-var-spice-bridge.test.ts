import { describe, it, expect } from 'vitest';
import {
  exportDesignVarsToSpice,
  importSpiceParamsToDesignVars,
  mergeDesignVarsIntoNetlist,
  formatSpiceValue,
  parseSpiceValue,
} from '../design-var-spice-bridge';
import type { DesignVariable } from '@shared/design-variables';

// ---------------------------------------------------------------------------
// formatSpiceValue
// ---------------------------------------------------------------------------

describe('formatSpiceValue', () => {
  it('formats zero as "0"', () => {
    expect(formatSpiceValue(0)).toBe('0');
  });

  it('formats values in the pico range', () => {
    expect(formatSpiceValue(4.7e-12)).toBe('4.7P');
  });

  it('formats values in the nano range', () => {
    expect(formatSpiceValue(100e-9)).toBe('100N');
  });

  it('formats values in the micro range', () => {
    expect(formatSpiceValue(4.7e-6)).toBe('4.7U');
  });

  it('formats values in the milli range', () => {
    expect(formatSpiceValue(2.2e-3)).toBe('2.2M');
  });

  it('formats unit values without suffix', () => {
    expect(formatSpiceValue(3.3)).toBe('3.3');
  });

  it('formats kilo values', () => {
    expect(formatSpiceValue(10e3)).toBe('10K');
  });

  it('formats mega values with MEG suffix', () => {
    expect(formatSpiceValue(1e6)).toBe('1MEG');
  });

  it('formats giga values', () => {
    expect(formatSpiceValue(2.5e9)).toBe('2.5G');
  });

  it('formats tera values', () => {
    expect(formatSpiceValue(1e12)).toBe('1T');
  });

  it('formats negative values with sign', () => {
    expect(formatSpiceValue(-5)).toBe('-5');
    expect(formatSpiceValue(-10e3)).toBe('-10K');
  });

  it('uses scientific notation for extremely small values', () => {
    const result = formatSpiceValue(1e-18);
    expect(result).toMatch(/e/i);
  });
});

// ---------------------------------------------------------------------------
// parseSpiceValue
// ---------------------------------------------------------------------------

describe('parseSpiceValue', () => {
  it('parses plain numbers', () => {
    expect(parseSpiceValue('3.3')).toBe(3.3);
    expect(parseSpiceValue('100')).toBe(100);
  });

  it('parses SPICE K suffix', () => {
    expect(parseSpiceValue('10K')).toBe(10e3);
    expect(parseSpiceValue('10k')).toBe(10e3);
  });

  it('parses SPICE MEG suffix', () => {
    expect(parseSpiceValue('1MEG')).toBe(1e6);
    expect(parseSpiceValue('4.7meg')).toBeCloseTo(4.7e6);
  });

  it('parses SPICE M (milli) suffix', () => {
    expect(parseSpiceValue('2.2M')).toBeCloseTo(2.2e-3);
  });

  it('parses SPICE U (micro) suffix', () => {
    expect(parseSpiceValue('100U')).toBeCloseTo(100e-6);
    expect(parseSpiceValue('4.7u')).toBeCloseTo(4.7e-6);
  });

  it('parses SPICE N (nano) suffix', () => {
    expect(parseSpiceValue('100N')).toBeCloseTo(100e-9);
  });

  it('parses SPICE P (pico) suffix', () => {
    expect(parseSpiceValue('22P')).toBeCloseTo(22e-12);
  });

  it('parses SPICE F (femto) suffix', () => {
    expect(parseSpiceValue('1F')).toBeCloseTo(1e-15);
  });

  it('parses SPICE T (tera) suffix', () => {
    expect(parseSpiceValue('1T')).toBeCloseTo(1e12);
  });

  it('parses SPICE G (giga) suffix', () => {
    expect(parseSpiceValue('2.2G')).toBeCloseTo(2.2e9);
  });

  it('parses negative numbers with suffix', () => {
    expect(parseSpiceValue('-5K')).toBe(-5e3);
  });

  it('parses scientific notation', () => {
    expect(parseSpiceValue('1e3')).toBe(1e3);
    expect(parseSpiceValue('4.7e-6')).toBeCloseTo(4.7e-6);
  });

  it('returns NaN for unparseable strings', () => {
    expect(parseSpiceValue('abc')).toBeNaN();
  });

  it('handles whitespace', () => {
    expect(parseSpiceValue('  10K  ')).toBe(10e3);
  });
});

// ---------------------------------------------------------------------------
// exportDesignVarsToSpice
// ---------------------------------------------------------------------------

describe('exportDesignVarsToSpice', () => {
  it('returns empty string for empty array', () => {
    expect(exportDesignVarsToSpice([])).toBe('');
  });

  it('exports simple numeric variables as .param directives', () => {
    const vars: DesignVariable[] = [
      { name: 'VCC', value: '3.3' },
      { name: 'R_LOAD', value: '10k' },
    ];
    const result = exportDesignVarsToSpice(vars);
    expect(result).toContain('.param VCC =');
    expect(result).toContain('.param R_LOAD =');
    expect(result).toContain('3.3');
    expect(result).toContain('10K');
  });

  it('exports variables with dependencies as SPICE expressions', () => {
    const vars: DesignVariable[] = [
      { name: 'VCC', value: '5' },
      { name: 'HALF_VCC', value: 'VCC / 2' },
    ];
    const result = exportDesignVarsToSpice(vars);
    expect(result).toContain('.param VCC =');
    expect(result).toContain('.param HALF_VCC = {VCC / 2}');
  });

  it('includes header comment', () => {
    const vars: DesignVariable[] = [{ name: 'X', value: '1' }];
    const result = exportDesignVarsToSpice(vars);
    expect(result).toContain('* ProtoPulse Design Variables');
  });

  it('emits error variables as comments', () => {
    const vars: DesignVariable[] = [
      { name: 'BAD', value: 'UNDEFINED_VAR + 1' },
    ];
    const result = exportDesignVarsToSpice(vars);
    expect(result).toContain('* BAD');
    expect(result).toContain('ERROR');
  });

  it('preserves variable order', () => {
    const vars: DesignVariable[] = [
      { name: 'A', value: '1' },
      { name: 'B', value: '2' },
      { name: 'C', value: '3' },
    ];
    const result = exportDesignVarsToSpice(vars);
    const lines = result.split('\n');
    const paramLines = lines.filter((l) => l.startsWith('.param'));
    expect(paramLines[0]).toContain('A');
    expect(paramLines[1]).toContain('B');
    expect(paramLines[2]).toContain('C');
  });

  it('handles variables with SI prefix values', () => {
    const vars: DesignVariable[] = [
      { name: 'CAP', value: '100n' },
      { name: 'IND', value: '4.7u' },
    ];
    const result = exportDesignVarsToSpice(vars);
    expect(result).toContain('.param CAP =');
    expect(result).toContain('.param IND =');
  });
});

// ---------------------------------------------------------------------------
// importSpiceParamsToDesignVars
// ---------------------------------------------------------------------------

describe('importSpiceParamsToDesignVars', () => {
  it('parses simple .param directives', () => {
    const spice = `.param VCC = 3.3\n.param R_LOAD = 10K`;
    const vars = importSpiceParamsToDesignVars(spice);
    expect(vars).toHaveLength(2);
    expect(vars[0]).toEqual({ name: 'VCC', value: '3.3' });
    expect(vars[1]).toEqual({ name: 'R_LOAD', value: '10K' });
  });

  it('parses expression params wrapped in braces', () => {
    const spice = `.param VOUT = {VCC * R2 / (R1 + R2)}`;
    const vars = importSpiceParamsToDesignVars(spice);
    expect(vars).toHaveLength(1);
    expect(vars[0].name).toBe('VOUT');
    expect(vars[0].value).toBe('VCC * R2 / (R1 + R2)');
  });

  it('skips comment lines', () => {
    const spice = `* This is a comment\n; Another comment\n.param X = 5`;
    const vars = importSpiceParamsToDesignVars(spice);
    expect(vars).toHaveLength(1);
    expect(vars[0].name).toBe('X');
  });

  it('skips non-param lines', () => {
    const spice = `* Title\nR1 in out 10k\nV1 vcc 0 5\n.param BIAS = 2.5\n.OP\n.END`;
    const vars = importSpiceParamsToDesignVars(spice);
    expect(vars).toHaveLength(1);
    expect(vars[0].name).toBe('BIAS');
  });

  it('strips inline comments', () => {
    const spice = `.param VCC = 3.3 ; supply voltage`;
    const vars = importSpiceParamsToDesignVars(spice);
    expect(vars).toHaveLength(1);
    expect(vars[0].value).toBe('3.3');
  });

  it('handles empty input', () => {
    expect(importSpiceParamsToDesignVars('')).toHaveLength(0);
  });

  it('handles case-insensitive .PARAM directive', () => {
    const spice = `.PARAM VCC = 5\n.Param R1 = 10K`;
    const vars = importSpiceParamsToDesignVars(spice);
    expect(vars).toHaveLength(2);
  });

  it('returns empty array when no .param directives found', () => {
    const spice = `* Title\nR1 in out 10k\n.OP\n.END`;
    const vars = importSpiceParamsToDesignVars(spice);
    expect(vars).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// mergeDesignVarsIntoNetlist
// ---------------------------------------------------------------------------

describe('mergeDesignVarsIntoNetlist', () => {
  const baseNetlist = [
    '* Test Circuit',
    'V1 vcc 0 DC 5',
    'R1 vcc out 10k',
    'R2 out 0 10k',
    '.OP',
    '.END',
  ].join('\n');

  it('returns original netlist when vars is empty', () => {
    expect(mergeDesignVarsIntoNetlist(baseNetlist, [])).toBe(baseNetlist);
  });

  it('inserts .param after title when no existing params', () => {
    const vars: DesignVariable[] = [{ name: 'VCC', value: '5' }];
    const result = mergeDesignVarsIntoNetlist(baseNetlist, vars);
    const lines = result.split('\n');
    // Title should still be first
    expect(lines[0]).toBe('* Test Circuit');
    // .param should be after title
    expect(lines[1]).toContain('.param VCC');
    // Rest of netlist preserved
    expect(result).toContain('V1 vcc 0 DC 5');
    expect(result).toContain('.END');
  });

  it('inserts after existing .param lines', () => {
    const netlistWithParam = [
      '* Test Circuit',
      '.param EXISTING = 1',
      'V1 vcc 0 DC 5',
      '.OP',
      '.END',
    ].join('\n');

    const vars: DesignVariable[] = [{ name: 'NEW_VAR', value: '42' }];
    const result = mergeDesignVarsIntoNetlist(netlistWithParam, vars);
    const lines = result.split('\n');
    // Find the .param lines
    const paramIndices = lines
      .map((l, i) => (l.trim().startsWith('.param') ? i : -1))
      .filter((i) => i >= 0);
    expect(paramIndices.length).toBe(2);
    // New param should come after existing param
    expect(paramIndices[1]).toBeGreaterThan(paramIndices[0]);
  });

  it('replaces existing .param lines with same name', () => {
    const netlistWithParam = [
      '* Test Circuit',
      '.param VCC = 3.3',
      'V1 vcc 0 DC 5',
      '.OP',
      '.END',
    ].join('\n');

    const vars: DesignVariable[] = [{ name: 'VCC', value: '5' }];
    const result = mergeDesignVarsIntoNetlist(netlistWithParam, vars);

    // Should only have one .param VCC line
    const paramLines = result.split('\n').filter((l) => l.trim().toLowerCase().startsWith('.param'));
    expect(paramLines).toHaveLength(1);
    expect(paramLines[0]).toContain('VCC');
  });

  it('handles multiple variables', () => {
    const vars: DesignVariable[] = [
      { name: 'VCC', value: '5' },
      { name: 'R_LOAD', value: '10k' },
      { name: 'GAIN', value: '2' },
    ];
    const result = mergeDesignVarsIntoNetlist(baseNetlist, vars);
    expect(result).toContain('.param VCC');
    expect(result).toContain('.param R_LOAD');
    expect(result).toContain('.param GAIN');
  });

  it('preserves non-param content', () => {
    const vars: DesignVariable[] = [{ name: 'X', value: '1' }];
    const result = mergeDesignVarsIntoNetlist(baseNetlist, vars);
    expect(result).toContain('V1 vcc 0 DC 5');
    expect(result).toContain('R1 vcc out 10k');
    expect(result).toContain('R2 out 0 10k');
    expect(result).toContain('.OP');
    expect(result).toContain('.END');
  });

  it('handles empty netlist', () => {
    const vars: DesignVariable[] = [{ name: 'X', value: '1' }];
    const result = mergeDesignVarsIntoNetlist('', vars);
    expect(result).toContain('.param X');
  });

  it('handles netlist with only a title', () => {
    const vars: DesignVariable[] = [{ name: 'X', value: '1' }];
    const result = mergeDesignVarsIntoNetlist('* My Circuit', vars);
    expect(result).toContain('* My Circuit');
    expect(result).toContain('.param X');
  });
});

// ---------------------------------------------------------------------------
// Round-trip: export → import
// ---------------------------------------------------------------------------

describe('round-trip export → import', () => {
  it('preserves simple variables through export and re-import', () => {
    const original: DesignVariable[] = [
      { name: 'VCC', value: '5' },
      { name: 'R_TOTAL', value: '10k' },
    ];
    const spice = exportDesignVarsToSpice(original);
    const imported = importSpiceParamsToDesignVars(spice);
    expect(imported).toHaveLength(2);
    expect(imported[0].name).toBe('VCC');
    expect(imported[1].name).toBe('R_TOTAL');
  });

  it('preserves expression variables through export and re-import', () => {
    const original: DesignVariable[] = [
      { name: 'VCC', value: '5' },
      { name: 'HALF_VCC', value: 'VCC / 2' },
    ];
    const spice = exportDesignVarsToSpice(original);
    const imported = importSpiceParamsToDesignVars(spice);
    expect(imported).toHaveLength(2);
    expect(imported[1].name).toBe('HALF_VCC');
    expect(imported[1].value).toBe('VCC / 2');
  });
});
