import { describe, it, expect } from 'vitest';
import {
  parseHsl,
  parseHex,
  parseColor,
  relativeLuminance,
  checkContrast,
  contrastResult,
  meetsWcagAA,
  meetsWcagAALarge,
  meetsWcagAAA,
  auditThemeContrast,
  CONTRAST_FIXES,
  THEME_MUTED_FIXES,
} from '../contrast-checker';
import type { RgbColor } from '../contrast-checker';

// ---------------------------------------------------------------------------
// parseHsl
// ---------------------------------------------------------------------------

describe('parseHsl', () => {
  it('parses hsl with space-separated values', () => {
    const rgb = parseHsl('hsl(0 100% 50%)');
    expect(rgb).toEqual({ r: 255, g: 0, b: 0 });
  });

  it('parses hsl with comma-separated values', () => {
    const rgb = parseHsl('hsl(120, 100%, 50%)');
    expect(rgb).toEqual({ r: 0, g: 255, b: 0 });
  });

  it('parses hsl with alpha channel', () => {
    const rgb = parseHsl('hsl(240 100% 50% / 0.5)');
    expect(rgb).toEqual({ r: 0, g: 0, b: 255 });
  });

  it('parses pure white', () => {
    const rgb = parseHsl('hsl(0 0% 100%)');
    expect(rgb).toEqual({ r: 255, g: 255, b: 255 });
  });

  it('parses pure black', () => {
    const rgb = parseHsl('hsl(0 0% 0%)');
    expect(rgb).toEqual({ r: 0, g: 0, b: 0 });
  });

  it('throws on invalid HSL string', () => {
    expect(() => parseHsl('not-hsl')).toThrow('Invalid HSL string');
  });

  it('handles fractional hue values', () => {
    const rgb = parseHsl('hsl(210.5 50% 50%)');
    // Should not throw and return a valid colour
    expect(rgb.r).toBeGreaterThanOrEqual(0);
    expect(rgb.r).toBeLessThanOrEqual(255);
  });
});

// ---------------------------------------------------------------------------
// parseHex
// ---------------------------------------------------------------------------

describe('parseHex', () => {
  it('parses 6-digit hex', () => {
    expect(parseHex('#FF0000')).toEqual({ r: 255, g: 0, b: 0 });
  });

  it('parses 3-digit shorthand hex', () => {
    expect(parseHex('#0F0')).toEqual({ r: 0, g: 255, b: 0 });
  });

  it('parses 8-digit hex with alpha (drops alpha)', () => {
    expect(parseHex('#0000FFCC')).toEqual({ r: 0, g: 0, b: 255 });
  });

  it('parses lowercase hex', () => {
    expect(parseHex('#ff8800')).toEqual({ r: 255, g: 136, b: 0 });
  });

  it('throws on invalid hex', () => {
    expect(() => parseHex('#GGGG')).toThrow('Invalid hex colour');
  });
});

// ---------------------------------------------------------------------------
// parseColor
// ---------------------------------------------------------------------------

describe('parseColor', () => {
  it('routes HSL strings to parseHsl', () => {
    expect(parseColor('hsl(0 0% 0%)')).toEqual({ r: 0, g: 0, b: 0 });
  });

  it('routes hex strings to parseHex', () => {
    expect(parseColor('#FFFFFF')).toEqual({ r: 255, g: 255, b: 255 });
  });

  it('trims whitespace before parsing', () => {
    expect(parseColor('  #000000  ')).toEqual({ r: 0, g: 0, b: 0 });
  });

  it('throws on unsupported format', () => {
    expect(() => parseColor('rgb(255, 0, 0)')).toThrow('Unsupported colour format');
  });
});

// ---------------------------------------------------------------------------
// relativeLuminance
// ---------------------------------------------------------------------------

describe('relativeLuminance', () => {
  it('returns 0 for black', () => {
    expect(relativeLuminance({ r: 0, g: 0, b: 0 })).toBe(0);
  });

  it('returns 1 for white', () => {
    expect(relativeLuminance({ r: 255, g: 255, b: 255 })).toBeCloseTo(1, 4);
  });

  it('returns ~0.2126 for pure red', () => {
    expect(relativeLuminance({ r: 255, g: 0, b: 0 })).toBeCloseTo(0.2126, 3);
  });

  it('returns ~0.7152 for pure green', () => {
    expect(relativeLuminance({ r: 0, g: 255, b: 0 })).toBeCloseTo(0.7152, 3);
  });

  it('returns ~0.0722 for pure blue', () => {
    expect(relativeLuminance({ r: 0, g: 0, b: 255 })).toBeCloseTo(0.0722, 3);
  });

  it('handles mid-grey (~0.18 luminance)', () => {
    // sRGB 50% grey = ~0.2140 relative luminance
    const lum = relativeLuminance({ r: 128, g: 128, b: 128 });
    expect(lum).toBeGreaterThan(0.1);
    expect(lum).toBeLessThan(0.3);
  });
});

// ---------------------------------------------------------------------------
// checkContrast
// ---------------------------------------------------------------------------

describe('checkContrast', () => {
  it('returns 21:1 for black on white', () => {
    const ratio = checkContrast('#000000', '#FFFFFF');
    expect(ratio).toBeCloseTo(21, 0);
  });

  it('returns 1:1 for identical colours', () => {
    expect(checkContrast('#808080', '#808080')).toBeCloseTo(1, 1);
  });

  it('accepts pre-parsed RgbColor objects', () => {
    const fg: RgbColor = { r: 0, g: 0, b: 0 };
    const bg: RgbColor = { r: 255, g: 255, b: 255 };
    expect(checkContrast(fg, bg)).toBeCloseTo(21, 0);
  });

  it('is symmetric — order does not matter', () => {
    const r1 = checkContrast('#333333', '#CCCCCC');
    const r2 = checkContrast('#CCCCCC', '#333333');
    expect(r1).toBeCloseTo(r2, 5);
  });

  it('accepts mixed string + RgbColor args', () => {
    const ratio = checkContrast('#000000', { r: 255, g: 255, b: 255 });
    expect(ratio).toBeCloseTo(21, 0);
  });

  it('works with HSL strings', () => {
    // White text on dark background
    const ratio = checkContrast('hsl(0 0% 100%)', 'hsl(0 0% 0%)');
    expect(ratio).toBeCloseTo(21, 0);
  });
});

// ---------------------------------------------------------------------------
// WCAG threshold checks
// ---------------------------------------------------------------------------

describe('meetsWcagAA', () => {
  it('returns true for ratio >= 4.5', () => {
    expect(meetsWcagAA(4.5)).toBe(true);
    expect(meetsWcagAA(7)).toBe(true);
    expect(meetsWcagAA(21)).toBe(true);
  });

  it('returns false for ratio < 4.5', () => {
    expect(meetsWcagAA(4.49)).toBe(false);
    expect(meetsWcagAA(1)).toBe(false);
    expect(meetsWcagAA(3)).toBe(false);
  });
});

describe('meetsWcagAALarge', () => {
  it('returns true for ratio >= 3', () => {
    expect(meetsWcagAALarge(3)).toBe(true);
    expect(meetsWcagAALarge(4.5)).toBe(true);
  });

  it('returns false for ratio < 3', () => {
    expect(meetsWcagAALarge(2.99)).toBe(false);
  });
});

describe('meetsWcagAAA', () => {
  it('returns true for ratio >= 7', () => {
    expect(meetsWcagAAA(7)).toBe(true);
    expect(meetsWcagAAA(21)).toBe(true);
  });

  it('returns false for ratio < 7', () => {
    expect(meetsWcagAAA(6.99)).toBe(false);
    expect(meetsWcagAAA(4.5)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// contrastResult
// ---------------------------------------------------------------------------

describe('contrastResult', () => {
  it('returns all fields correctly for high-contrast pair', () => {
    const result = contrastResult('#000000', '#FFFFFF');
    expect(result.ratio).toBeCloseTo(21, 0);
    expect(result.meetsAA).toBe(true);
    expect(result.meetsAALarge).toBe(true);
    expect(result.meetsAAA).toBe(true);
  });

  it('identifies low-contrast failures', () => {
    // Very similar greys
    const result = contrastResult('hsl(0 0% 30%)', 'hsl(0 0% 40%)');
    expect(result.ratio).toBeLessThan(3);
    expect(result.meetsAA).toBe(false);
    expect(result.meetsAALarge).toBe(false);
  });

  it('correctly classifies AA-large-only pairs', () => {
    // Find a pair that is >= 3 but < 4.5
    const result = contrastResult('hsl(0 0% 50%)', 'hsl(0 0% 20%)');
    expect(result.ratio).toBeGreaterThanOrEqual(3);
    expect(result.ratio).toBeLessThan(4.5);
    expect(result.meetsAA).toBe(false);
    expect(result.meetsAALarge).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// CONTRAST_FIXES validation
// ---------------------------------------------------------------------------

describe('CONTRAST_FIXES', () => {
  it('contains the muted-foreground fix', () => {
    expect(CONTRAST_FIXES['--color-muted-foreground']).toBeDefined();
  });

  it('contains the border fix', () => {
    expect(CONTRAST_FIXES['--color-border']).toBeDefined();
  });

  it('contains the input fix', () => {
    expect(CONTRAST_FIXES['--color-input']).toBeDefined();
  });

  it('all values are valid parseable colours', () => {
    for (const [varName, value] of Object.entries(CONTRAST_FIXES)) {
      expect(() => parseColor(value)).not.toThrow(`Failed to parse ${varName}: ${value}`);
    }
  });

  it('fixed muted-foreground meets AA on background', () => {
    const fg = CONTRAST_FIXES['--color-muted-foreground'];
    const bg = 'hsl(225 20% 3%)'; // default background
    const ratio = checkContrast(fg, bg);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('fixed muted-foreground meets AA on muted', () => {
    const fg = CONTRAST_FIXES['--color-muted-foreground'];
    const bg = 'hsl(225 12% 10%)'; // default muted
    const ratio = checkContrast(fg, bg);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('fixed muted-foreground meets AA on card', () => {
    const fg = CONTRAST_FIXES['--color-muted-foreground'];
    const bg = 'hsl(225 18% 5%)'; // default card
    const ratio = checkContrast(fg, bg);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('fixed border has improved contrast over original on background', () => {
    const fixedBorder = CONTRAST_FIXES['--color-border'];
    const originalBorder = 'hsl(225 12% 14%)';
    const bg = 'hsl(225 20% 3%)'; // default background
    const fixedRatio = checkContrast(fixedBorder, bg);
    const originalRatio = checkContrast(originalBorder, bg);
    // Border is decorative (exempt from WCAG 1.4.11 3:1), but should be visibly improved
    expect(fixedRatio).toBeGreaterThan(originalRatio);
  });
});

// ---------------------------------------------------------------------------
// THEME_MUTED_FIXES validation
// ---------------------------------------------------------------------------

describe('THEME_MUTED_FIXES', () => {
  it('has fixes for all dark themes', () => {
    const darkThemes = ['neon-cyan', 'midnight-purple', 'forest', 'amber', 'rose', 'monochrome', 'oled-black'];
    for (const id of darkThemes) {
      expect(THEME_MUTED_FIXES[id]).toBeDefined();
    }
  });

  it('all fixed values are parseable', () => {
    for (const [themeId, value] of Object.entries(THEME_MUTED_FIXES)) {
      expect(() => parseColor(value)).not.toThrow(`Failed to parse ${themeId}: ${value}`);
    }
  });
});

// ---------------------------------------------------------------------------
// auditThemeContrast
// ---------------------------------------------------------------------------

describe('auditThemeContrast', () => {
  it('returns no failures for a high-contrast theme', () => {
    const highContrast: Record<string, string> = {
      '--color-foreground': 'hsl(0 0% 100%)',
      '--color-background': 'hsl(0 0% 0%)',
      '--color-card-foreground': 'hsl(0 0% 100%)',
      '--color-card': 'hsl(0 0% 0%)',
      '--color-popover-foreground': 'hsl(0 0% 100%)',
      '--color-popover': 'hsl(0 0% 0%)',
      '--color-primary-foreground': 'hsl(0 0% 0%)',
      '--color-primary': 'hsl(0 0% 100%)',
      '--color-secondary-foreground': 'hsl(0 0% 0%)',
      '--color-secondary': 'hsl(0 0% 100%)',
      '--color-muted-foreground': 'hsl(0 0% 80%)',
      '--color-muted': 'hsl(0 0% 0%)',
      '--color-accent-foreground': 'hsl(0 0% 0%)',
      '--color-accent': 'hsl(0 0% 100%)',
      '--color-destructive-foreground': 'hsl(0 0% 100%)',
      '--color-destructive': 'hsl(0 85% 30%)',
    };
    const failures = auditThemeContrast(highContrast);
    expect(failures).toHaveLength(0);
  });

  it('detects failures in a low-contrast theme', () => {
    const lowContrast: Record<string, string> = {
      '--color-foreground': 'hsl(0 0% 50%)',
      '--color-background': 'hsl(0 0% 40%)',
      '--color-muted-foreground': 'hsl(0 0% 50%)',
      '--color-muted': 'hsl(0 0% 45%)',
      '--color-card': 'hsl(0 0% 42%)',
    };
    const failures = auditThemeContrast(lowContrast);
    expect(failures.length).toBeGreaterThan(0);
    expect(failures[0].ratio).toBeLessThan(4.5);
  });

  it('skips pairs with missing variables', () => {
    const partial: Record<string, string> = {
      '--color-foreground': 'hsl(0 0% 100%)',
      '--color-background': 'hsl(0 0% 0%)',
    };
    // Should not throw even though most vars are missing
    const failures = auditThemeContrast(partial);
    expect(failures).toHaveLength(0);
  });

  it('reports muted-foreground at 50% lightness as a failure on muted surface', () => {
    // Some themes (forest, amber, rose, monochrome) use 50% lightness for muted-foreground
    // which fails AA on their muted backgrounds (~4.18:1)
    const themeWith50Pct: Record<string, string> = {
      '--color-muted-foreground': 'hsl(0 0% 50%)',
      '--color-background': 'hsl(0 0% 3%)',
      '--color-muted': 'hsl(0 0% 10%)',
      '--color-card': 'hsl(0 0% 5%)',
    };
    const failures = auditThemeContrast(themeWith50Pct);
    expect(failures.length).toBeGreaterThan(0);
    expect(failures.some((f) => f.fgVar === '--color-muted-foreground')).toBe(true);
  });

  it('reports zero failures for a fully AA-compliant dark theme', () => {
    const compliantDark: Record<string, string> = {
      '--color-foreground': 'hsl(210 20% 90%)',
      '--color-background': 'hsl(225 20% 3%)',
      '--color-card-foreground': 'hsl(210 20% 90%)',
      '--color-card': 'hsl(225 18% 5%)',
      '--color-popover-foreground': 'hsl(210 20% 90%)',
      '--color-popover': 'hsl(225 18% 5%)',
      '--color-primary-foreground': 'hsl(225 20% 3%)',
      '--color-primary': 'hsl(190 100% 43%)',
      '--color-secondary-foreground': 'hsl(0 0% 0%)',
      '--color-secondary': 'hsl(260 100% 65%)',
      '--color-muted-foreground': 'hsl(215 15% 63%)',
      '--color-muted': 'hsl(225 12% 10%)',
      '--color-accent-foreground': 'hsl(225 20% 3%)',
      '--color-accent': 'hsl(190 100% 43%)',
      '--color-destructive-foreground': 'hsl(0 0% 100%)',
      '--color-destructive': 'hsl(0 85% 45%)',
    };
    const failures = auditThemeContrast(compliantDark);
    expect(failures).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('edge cases', () => {
  it('handles hue of 360 (same as 0)', () => {
    const rgb = parseHsl('hsl(360 100% 50%)');
    expect(rgb).toEqual({ r: 255, g: 0, b: 0 });
  });

  it('handles zero saturation (greyscale)', () => {
    const rgb = parseHsl('hsl(180 0% 50%)');
    expect(rgb.r).toBe(rgb.g);
    expect(rgb.g).toBe(rgb.b);
  });

  it('handles 100% lightness (white regardless of hue)', () => {
    const rgb = parseHsl('hsl(270 100% 100%)');
    expect(rgb).toEqual({ r: 255, g: 255, b: 255 });
  });

  it('contrast ratio is always >= 1', () => {
    const ratio = checkContrast('hsl(180 50% 50%)', 'hsl(180 50% 50%)');
    expect(ratio).toBeGreaterThanOrEqual(1);
  });
});
