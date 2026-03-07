import { describe, it, expect } from 'vitest';
import { sanitizeSpiceDirective } from '../spice-import';

// =============================================================================
// Valid SPICE directives — should pass sanitization
// =============================================================================

describe('sanitizeSpiceDirective — valid directives', () => {
  it('accepts a simple .MODEL directive', () => {
    const input = '.MODEL 2N2222 NPN(IS=14.34E-15 BF=255.9)';
    expect(sanitizeSpiceDirective(input)).toBe(input);
  });

  it('accepts a .SUBCKT/.ENDS block', () => {
    const input = [
      '.SUBCKT LM741 IN+ IN- VCC VEE OUT',
      'RI IN+ IN- 2E6',
      'E1 1 0 IN+ IN- 200000',
      'RO 1 OUT 75',
      '.ENDS LM741',
    ].join('\n');
    expect(sanitizeSpiceDirective(input)).toBe(input);
  });

  it('accepts .PARAM directives', () => {
    const input = '.PARAM R1=10K R2=20K';
    expect(sanitizeSpiceDirective(input)).toBe(input);
  });

  it('accepts .LIB directives', () => {
    const input = '.LIB standard.lib';
    expect(sanitizeSpiceDirective(input)).toBe(input);
  });

  it('accepts .INCLUDE directives', () => {
    const input = '.INCLUDE models/custom.mod';
    expect(sanitizeSpiceDirective(input)).toBe(input);
  });

  it('accepts .FUNC directives', () => {
    const input = '.FUNC LIMIT(x,a,b) {min(max(x,a),b)}';
    expect(sanitizeSpiceDirective(input)).toBe(input);
  });

  it('accepts .GLOBAL directives', () => {
    const input = '.GLOBAL VCC GND';
    expect(sanitizeSpiceDirective(input)).toBe(input);
  });

  it('accepts .OPTIONS directives', () => {
    const input = '.OPTIONS RELTOL=0.001 ABSTOL=1E-12';
    expect(sanitizeSpiceDirective(input)).toBe(input);
  });

  it('accepts .TEMP directives', () => {
    const input = '.TEMP 27';
    expect(sanitizeSpiceDirective(input)).toBe(input);
  });

  it('accepts comment lines starting with *', () => {
    const input = [
      '* This is a SPICE model comment',
      '* Author: test user $variable',
      '.MODEL R1 R(TC1=0.01)',
    ].join('\n');
    expect(sanitizeSpiceDirective(input)).toBe(input);
  });

  it('accepts element instance lines (R, C, L, etc.)', () => {
    const input = [
      '.SUBCKT TEST A B',
      'R1 A B 10K',
      'C1 A B 100N',
      'L1 A B 1M',
      '.ENDS TEST',
    ].join('\n');
    expect(sanitizeSpiceDirective(input)).toBe(input);
  });

  it('trims whitespace', () => {
    const input = '  .MODEL TEST NPN(BF=100)  ';
    expect(sanitizeSpiceDirective(input)).toBe('.MODEL TEST NPN(BF=100)');
  });

  it('accepts blank lines between directives', () => {
    const input = '.SUBCKT X A B\n\nR1 A B 10\n\n.ENDS X';
    expect(sanitizeSpiceDirective(input)).toBe(input);
  });
});

// =============================================================================
// Dangerous directives — should be rejected
// =============================================================================

describe('sanitizeSpiceDirective — injection attacks', () => {
  it('rejects .SYSTEM directive', () => {
    expect(() => sanitizeSpiceDirective('.SYSTEM rm -rf /')).toThrow('forbidden keyword');
  });

  it('rejects .SHELL directive', () => {
    expect(() => sanitizeSpiceDirective('.SHELL echo pwned')).toThrow('forbidden keyword');
  });

  it('rejects .SYSTEM embedded in a subcircuit', () => {
    const input = [
      '.SUBCKT EVIL A B',
      '.SYSTEM cat /etc/passwd',
      '.ENDS EVIL',
    ].join('\n');
    expect(() => sanitizeSpiceDirective(input)).toThrow('forbidden keyword');
  });

  it('rejects backtick command substitution', () => {
    expect(() => sanitizeSpiceDirective('.MODEL X NPN(BF=`whoami`)')).toThrow('shell metacharacter');
  });

  it('rejects $() command substitution', () => {
    expect(() => sanitizeSpiceDirective('.MODEL X NPN(BF=$(id))')).toThrow('command substitution');
  });

  it('rejects ${} command substitution', () => {
    expect(() => sanitizeSpiceDirective('.MODEL X NPN(BF=${PATH})')).toThrow('command substitution');
  });

  it('rejects pipe characters in non-comment lines', () => {
    expect(() => sanitizeSpiceDirective('.MODEL X NPN | cat /etc/passwd')).toThrow('shell metacharacter');
  });

  it('allows $ in comment lines (common in SPICE comments)', () => {
    // Comments starting with * are allowed to contain $
    const input = '* $Rev: 1234 $\n.MODEL X NPN(BF=100)';
    expect(sanitizeSpiceDirective(input)).toBe(input);
  });

  it('rejects unknown directive keywords', () => {
    expect(() => sanitizeSpiceDirective('.EXEC something dangerous')).toThrow('unknown/forbidden directive');
  });

  it('rejects .PLOT directive (not in allowlist)', () => {
    expect(() => sanitizeSpiceDirective('.PLOT V(1) V(2)')).toThrow('unknown/forbidden directive');
  });

  it('rejects .TRAN directive (simulation commands not allowed in stored directives)', () => {
    expect(() => sanitizeSpiceDirective('.TRAN 1n 100n')).toThrow('unknown/forbidden directive');
  });

  it('rejects .AC directive', () => {
    expect(() => sanitizeSpiceDirective('.AC DEC 10 1 100MEG')).toThrow('unknown/forbidden directive');
  });
});

// =============================================================================
// Length limit
// =============================================================================

describe('sanitizeSpiceDirective — length limit', () => {
  it('accepts a directive at exactly 10000 characters', () => {
    const input = '.MODEL X NPN(BF=' + '0'.repeat(10000 - 17) + ')';
    expect(input.length).toBe(10000);
    expect(() => sanitizeSpiceDirective(input)).not.toThrow();
  });

  it('rejects a directive exceeding 10000 characters', () => {
    const input = '.MODEL X NPN(BF=' + '0'.repeat(10001) + ')';
    expect(() => sanitizeSpiceDirective(input)).toThrow('exceeds maximum length');
  });
});

// =============================================================================
// Integration with parseSpiceFile
// =============================================================================

describe('sanitizeSpiceDirective — integration with parser', () => {
  it('parseSpiceFile rejects models with dangerous directives', async () => {
    const { parseSpiceFile } = await import('../spice-import');
    const content = '.MODEL EVIL NPN(IS=1E-15 BF=100)\n.MODEL HACK NPN | cat /etc/passwd';
    const result = parseSpiceFile(content, 'test.lib');
    // First model should parse fine
    expect(result.models.length).toBe(1);
    expect(result.models[0].name).toBe('EVIL');
    // Second model should produce an error due to pipe character
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some(e => e.includes('HACK'))).toBe(true);
  });

  it('parseSpiceFile rejects subcircuits with dangerous directives', async () => {
    const { parseSpiceFile } = await import('../spice-import');
    const content = [
      '.SUBCKT EVIL A B',
      '.SYSTEM rm -rf /',
      '.ENDS EVIL',
    ].join('\n');
    const result = parseSpiceFile(content, 'test.lib');
    expect(result.models.length).toBe(0);
    expect(result.errors.some(e => e.includes('forbidden keyword'))).toBe(true);
  });
});
