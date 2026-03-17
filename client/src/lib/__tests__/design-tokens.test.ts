import { describe, it, expect } from 'vitest';
import {
  SPACING_SCALE,
  TYPOGRAPHY_TOKENS,
  getSpacing,
  getTypography,
  toCSSVariables,
} from '../design-tokens';
import type { SpacingScale, TypographyToken } from '../design-tokens';

// ---------------------------------------------------------------------------
// SPACING_SCALE constant
// ---------------------------------------------------------------------------

describe('SPACING_SCALE', () => {
  it('contains exactly 13 entries', () => {
    expect(Object.keys(SPACING_SCALE)).toHaveLength(13);
  });

  it('maps scale 0 to 0px', () => {
    expect(SPACING_SCALE[0]).toBe(0);
  });

  it('maps scale 1 to 4px', () => {
    expect(SPACING_SCALE[1]).toBe(4);
  });

  it('maps scale 2 to 8px', () => {
    expect(SPACING_SCALE[2]).toBe(8);
  });

  it('maps scale 3 to 12px', () => {
    expect(SPACING_SCALE[3]).toBe(12);
  });

  it('maps scale 4 to 16px', () => {
    expect(SPACING_SCALE[4]).toBe(16);
  });

  it('maps scale 5 to 20px', () => {
    expect(SPACING_SCALE[5]).toBe(20);
  });

  it('maps scale 6 to 24px', () => {
    expect(SPACING_SCALE[6]).toBe(24);
  });

  it('maps scale 8 to 32px', () => {
    expect(SPACING_SCALE[8]).toBe(32);
  });

  it('maps scale 10 to 40px', () => {
    expect(SPACING_SCALE[10]).toBe(40);
  });

  it('maps scale 12 to 48px', () => {
    expect(SPACING_SCALE[12]).toBe(48);
  });

  it('maps scale 16 to 64px', () => {
    expect(SPACING_SCALE[16]).toBe(64);
  });

  it('maps scale 20 to 80px', () => {
    expect(SPACING_SCALE[20]).toBe(80);
  });

  it('maps scale 24 to 96px', () => {
    expect(SPACING_SCALE[24]).toBe(96);
  });

  it('follows a 4px base grid', () => {
    for (const [key, value] of Object.entries(SPACING_SCALE)) {
      expect(value % 4).toBe(0);
      // value should equal key * 4
      expect(value).toBe(Number(key) * 4);
    }
  });

  it('has monotonically increasing values', () => {
    const keys = Object.keys(SPACING_SCALE).map(Number).sort((a, b) => a - b);
    for (let i = 1; i < keys.length; i++) {
      const prev = SPACING_SCALE[keys[i - 1] as SpacingScale];
      const curr = SPACING_SCALE[keys[i] as SpacingScale];
      expect(curr).toBeGreaterThan(prev);
    }
  });
});

// ---------------------------------------------------------------------------
// TYPOGRAPHY_TOKENS constant
// ---------------------------------------------------------------------------

describe('TYPOGRAPHY_TOKENS', () => {
  const expectedNames = ['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', 'display'];

  it('contains exactly 8 tokens', () => {
    expect(Object.keys(TYPOGRAPHY_TOKENS)).toHaveLength(8);
  });

  it.each(expectedNames)('contains the "%s" token', (name) => {
    expect(TYPOGRAPHY_TOKENS[name]).toBeDefined();
  });

  it('each token has all required fields', () => {
    for (const [name, token] of Object.entries(TYPOGRAPHY_TOKENS)) {
      expect(token.fontSize, `${name}.fontSize`).toEqual(expect.any(String));
      expect(token.lineHeight, `${name}.lineHeight`).toEqual(expect.any(String));
      expect(token.fontWeight, `${name}.fontWeight`).toEqual(expect.any(Number));
      expect(token.letterSpacing, `${name}.letterSpacing`).toEqual(expect.any(String));
    }
  });

  it('font sizes use rem units', () => {
    for (const token of Object.values(TYPOGRAPHY_TOKENS)) {
      expect(token.fontSize).toMatch(/^\d+(\.\d+)?rem$/);
    }
  });

  it('line heights use rem units', () => {
    for (const token of Object.values(TYPOGRAPHY_TOKENS)) {
      expect(token.lineHeight).toMatch(/^\d+(\.\d+)?rem$/);
    }
  });

  it('font weights are between 100 and 900', () => {
    for (const token of Object.values(TYPOGRAPHY_TOKENS)) {
      expect(token.fontWeight).toBeGreaterThanOrEqual(100);
      expect(token.fontWeight).toBeLessThanOrEqual(900);
    }
  });

  it('font sizes increase from xs to display', () => {
    const ordered = expectedNames;
    for (let i = 1; i < ordered.length; i++) {
      const prev = parseFloat(TYPOGRAPHY_TOKENS[ordered[i - 1]].fontSize);
      const curr = parseFloat(TYPOGRAPHY_TOKENS[ordered[i]].fontSize);
      expect(curr).toBeGreaterThanOrEqual(prev);
    }
  });

  it('display token has bold weight (700)', () => {
    expect(TYPOGRAPHY_TOKENS['display'].fontWeight).toBe(700);
  });

  it('xs token has normal weight (400)', () => {
    expect(TYPOGRAPHY_TOKENS['xs'].fontWeight).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// getSpacing()
// ---------------------------------------------------------------------------

describe('getSpacing', () => {
  it('returns "0px" for scale 0', () => {
    expect(getSpacing(0)).toBe('0px');
  });

  it('returns "16px" for scale 4', () => {
    expect(getSpacing(4)).toBe('16px');
  });

  it('returns "96px" for scale 24', () => {
    expect(getSpacing(24)).toBe('96px');
  });

  it('returns correct px string for every valid scale', () => {
    const expected: [SpacingScale, string][] = [
      [0, '0px'],
      [1, '4px'],
      [2, '8px'],
      [3, '12px'],
      [4, '16px'],
      [5, '20px'],
      [6, '24px'],
      [8, '32px'],
      [10, '40px'],
      [12, '48px'],
      [16, '64px'],
      [20, '80px'],
      [24, '96px'],
    ];
    for (const [scale, px] of expected) {
      expect(getSpacing(scale)).toBe(px);
    }
  });

  it('throws for an invalid scale value', () => {
    // @ts-expect-error — intentionally testing runtime guard
    expect(() => getSpacing(7)).toThrow(/Invalid spacing scale/);
  });

  it('throws with a message listing valid keys', () => {
    // @ts-expect-error — intentionally testing runtime guard
    expect(() => getSpacing(99)).toThrow(/Valid keys/);
  });

  it('always returns a string ending with "px"', () => {
    for (const key of Object.keys(SPACING_SCALE).map(Number) as SpacingScale[]) {
      expect(getSpacing(key)).toMatch(/^\d+px$/);
    }
  });
});

// ---------------------------------------------------------------------------
// getTypography()
// ---------------------------------------------------------------------------

describe('getTypography', () => {
  it('returns CSSProperties for the "base" token', () => {
    const css = getTypography('base');
    expect(css).toEqual({
      fontSize: '1rem',
      lineHeight: '1.5rem',
      fontWeight: 400,
      letterSpacing: 'normal',
    });
  });

  it('returns CSSProperties for the "display" token', () => {
    const css = getTypography('display');
    expect(css.fontSize).toBe('2.25rem');
    expect(css.fontWeight).toBe(700);
  });

  it('returns CSSProperties for the "xs" token', () => {
    const css = getTypography('xs');
    expect(css.fontSize).toBe('0.75rem');
    expect(css.letterSpacing).toBe('0.025em');
  });

  it('throws for an unknown token name', () => {
    expect(() => getTypography('nonexistent')).toThrow(/Unknown typography token/);
  });

  it('throws with a message listing valid tokens', () => {
    expect(() => getTypography('huge')).toThrow(/Valid tokens/);
  });

  it('returns an object with exactly 4 properties', () => {
    for (const name of Object.keys(TYPOGRAPHY_TOKENS)) {
      const css = getTypography(name);
      expect(Object.keys(css)).toHaveLength(4);
    }
  });

  it('does not include extra properties beyond the token fields', () => {
    const css = getTypography('lg');
    const keys = Object.keys(css).sort();
    expect(keys).toEqual(['fontSize', 'fontWeight', 'letterSpacing', 'lineHeight']);
  });
});

// ---------------------------------------------------------------------------
// toCSSVariables()
// ---------------------------------------------------------------------------

describe('toCSSVariables', () => {
  it('returns CSS variable entries for every token', () => {
    const vars = toCSSVariables(TYPOGRAPHY_TOKENS);
    // 8 tokens * 4 properties = 32 variables
    expect(Object.keys(vars)).toHaveLength(32);
  });

  it('uses the --typography-{name}-{property} naming convention', () => {
    const vars = toCSSVariables(TYPOGRAPHY_TOKENS);
    expect(vars['--typography-base-font-size']).toBe('1rem');
    expect(vars['--typography-base-line-height']).toBe('1.5rem');
    expect(vars['--typography-base-font-weight']).toBe('400');
    expect(vars['--typography-base-letter-spacing']).toBe('normal');
  });

  it('converts fontWeight number to string', () => {
    const vars = toCSSVariables(TYPOGRAPHY_TOKENS);
    expect(vars['--typography-display-font-weight']).toBe('700');
    expect(typeof vars['--typography-display-font-weight']).toBe('string');
  });

  it('handles an empty token record', () => {
    const vars = toCSSVariables({});
    expect(Object.keys(vars)).toHaveLength(0);
  });

  it('handles a single custom token', () => {
    const custom: Record<string, TypographyToken> = {
      hero: {
        fontSize: '4rem',
        lineHeight: '4.5rem',
        fontWeight: 800,
        letterSpacing: '-0.03em',
      },
    };
    const vars = toCSSVariables(custom);
    expect(Object.keys(vars)).toHaveLength(4);
    expect(vars['--typography-hero-font-size']).toBe('4rem');
    expect(vars['--typography-hero-line-height']).toBe('4.5rem');
    expect(vars['--typography-hero-font-weight']).toBe('800');
    expect(vars['--typography-hero-letter-spacing']).toBe('-0.03em');
  });

  it('all keys start with "--typography-"', () => {
    const vars = toCSSVariables(TYPOGRAPHY_TOKENS);
    for (const key of Object.keys(vars)) {
      expect(key).toMatch(/^--typography-/);
    }
  });

  it('all values are strings', () => {
    const vars = toCSSVariables(TYPOGRAPHY_TOKENS);
    for (const value of Object.values(vars)) {
      expect(typeof value).toBe('string');
    }
  });

  it('produces correct variables for xs token', () => {
    const vars = toCSSVariables(TYPOGRAPHY_TOKENS);
    expect(vars['--typography-xs-font-size']).toBe('0.75rem');
    expect(vars['--typography-xs-line-height']).toBe('1rem');
    expect(vars['--typography-xs-font-weight']).toBe('400');
    expect(vars['--typography-xs-letter-spacing']).toBe('0.025em');
  });
});
