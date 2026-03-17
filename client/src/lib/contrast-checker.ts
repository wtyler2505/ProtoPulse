/**
 * WCAG 2.1 contrast ratio utilities.
 *
 * Provides functions to parse HSL/hex colours, compute relative luminance
 * (per WCAG 2.1 §1.4.3), and check whether a foreground/background pair
 * meets the AA minimum contrast ratio (4.5:1 for normal text, 3:1 for
 * large text and UI components).
 *
 * Also exports `CONTRAST_FIXES` — a map of CSS variable overrides that
 * bring the default dark theme into WCAG AA compliance.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RgbColor {
  r: number; // 0–255
  g: number; // 0–255
  b: number; // 0–255
}

export interface ContrastResult {
  ratio: number;
  meetsAA: boolean;
  meetsAALarge: boolean;
  meetsAAA: boolean;
}

// ---------------------------------------------------------------------------
// Colour parsing
// ---------------------------------------------------------------------------

/**
 * Parse an HSL string like `hsl(215 15% 55%)` or `hsl(215, 15%, 55%)` into
 * its {r, g, b} components (0–255).
 */
export function parseHsl(hsl: string): RgbColor {
  const match = hsl.match(
    /hsl\(\s*([\d.]+)\s*[,\s]\s*([\d.]+)%\s*[,\s]\s*([\d.]+)%\s*(?:\/\s*[\d.]+)?\)/,
  );
  if (!match) {
    throw new Error(`Invalid HSL string: ${hsl}`);
  }
  const h = parseFloat(match[1]) % 360;
  const s = parseFloat(match[2]) / 100;
  const l = parseFloat(match[3]) / 100;
  return hslToRgb(h, s, l);
}

/**
 * Parse a hex colour string (`#RGB`, `#RRGGBB`, or `#RRGGBBAA`) into RGB.
 */
export function parseHex(hex: string): RgbColor {
  let h = hex.replace('#', '');
  if (h.length === 3) {
    h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  }
  if (h.length === 8) {
    h = h.slice(0, 6); // drop alpha
  }
  if (h.length !== 6) {
    throw new Error(`Invalid hex colour: ${hex}`);
  }
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

/**
 * Parse any supported colour format (HSL or hex) into RGB.
 */
export function parseColor(color: string): RgbColor {
  const trimmed = color.trim();
  if (trimmed.startsWith('hsl')) {
    return parseHsl(trimmed);
  }
  if (trimmed.startsWith('#')) {
    return parseHex(trimmed);
  }
  throw new Error(`Unsupported colour format: ${color}`);
}

// ---------------------------------------------------------------------------
// HSL → RGB conversion
// ---------------------------------------------------------------------------

function hslToRgb(h: number, s: number, l: number): RgbColor {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;

  let rp: number;
  let gp: number;
  let bp: number;

  if (h < 60) {
    [rp, gp, bp] = [c, x, 0];
  } else if (h < 120) {
    [rp, gp, bp] = [x, c, 0];
  } else if (h < 180) {
    [rp, gp, bp] = [0, c, x];
  } else if (h < 240) {
    [rp, gp, bp] = [0, x, c];
  } else if (h < 300) {
    [rp, gp, bp] = [x, 0, c];
  } else {
    [rp, gp, bp] = [c, 0, x];
  }

  return {
    r: Math.round((rp + m) * 255),
    g: Math.round((gp + m) * 255),
    b: Math.round((bp + m) * 255),
  };
}

// ---------------------------------------------------------------------------
// Relative luminance (WCAG 2.1 §G17)
// ---------------------------------------------------------------------------

function linearize(channel: number): number {
  const sRGB = channel / 255;
  return sRGB <= 0.04045 ? sRGB / 12.92 : Math.pow((sRGB + 0.055) / 1.055, 2.4);
}

/**
 * Compute the relative luminance of an RGB colour per WCAG 2.1 definition.
 * Returns a value in [0, 1] where 0 is darkest and 1 is lightest.
 */
export function relativeLuminance(color: RgbColor): number {
  return 0.2126 * linearize(color.r) + 0.7152 * linearize(color.g) + 0.0722 * linearize(color.b);
}

// ---------------------------------------------------------------------------
// Contrast ratio
// ---------------------------------------------------------------------------

/**
 * Compute the contrast ratio between two colours.
 * Accepts HSL strings, hex strings, or pre-parsed RGB objects.
 * Returns a value >= 1. A ratio of 1 means identical luminance.
 */
export function checkContrast(fg: string | RgbColor, bg: string | RgbColor): number {
  const fgRgb = typeof fg === 'string' ? parseColor(fg) : fg;
  const bgRgb = typeof bg === 'string' ? parseColor(bg) : bg;

  const l1 = relativeLuminance(fgRgb);
  const l2 = relativeLuminance(bgRgb);

  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check a contrast ratio against WCAG thresholds.
 */
export function contrastResult(fg: string | RgbColor, bg: string | RgbColor): ContrastResult {
  const ratio = checkContrast(fg, bg);
  return {
    ratio,
    meetsAA: meetsWcagAA(ratio),
    meetsAALarge: meetsWcagAALarge(ratio),
    meetsAAA: meetsWcagAAA(ratio),
  };
}

// ---------------------------------------------------------------------------
// WCAG threshold checks
// ---------------------------------------------------------------------------

/** WCAG AA: normal text requires >= 4.5:1. */
export function meetsWcagAA(ratio: number): boolean {
  return ratio >= 4.5;
}

/** WCAG AA Large: large text / UI components require >= 3:1. */
export function meetsWcagAALarge(ratio: number): boolean {
  return ratio >= 3;
}

/** WCAG AAA: normal text requires >= 7:1. */
export function meetsWcagAAA(ratio: number): boolean {
  return ratio >= 7;
}

// ---------------------------------------------------------------------------
// Colour suggestion — lighten or darken to meet a target contrast ratio
// ---------------------------------------------------------------------------

/**
 * Convert RGB (0–255 per channel) back to a hex string.
 */
function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const toHex = (v: number) => clamp(v).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Lighten `fgHex` (a hex colour) until the contrast ratio against `bgHex`
 * meets or exceeds `targetRatio`. Returns the adjusted hex colour.
 *
 * Works by linearly interpolating each channel towards 255 (white) in small
 * steps. If the target ratio cannot be reached (e.g. bg is also very light),
 * returns pure white.
 */
export function suggestLighterColor(fgHex: string, bgHex: string, targetRatio: number): string {
  const fg = parseHex(fgHex);
  const bg = parseHex(bgHex);
  const steps = 256;

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const r = fg.r + (255 - fg.r) * t;
    const g = fg.g + (255 - fg.g) * t;
    const b = fg.b + (255 - fg.b) * t;
    const candidate: RgbColor = {
      r: Math.round(r),
      g: Math.round(g),
      b: Math.round(b),
    };
    const ratio = checkContrast(candidate, bg);
    if (ratio >= targetRatio) {
      return rgbToHex(candidate.r, candidate.g, candidate.b);
    }
  }

  return '#ffffff';
}

/**
 * Darken `fgHex` (a hex colour) until the contrast ratio against `bgHex`
 * meets or exceeds `targetRatio`. Returns the adjusted hex colour.
 *
 * Works by linearly interpolating each channel towards 0 (black) in small
 * steps. If the target ratio cannot be reached (e.g. bg is also very dark),
 * returns pure black.
 */
export function suggestDarkerColor(fgHex: string, bgHex: string, targetRatio: number): string {
  const fg = parseHex(fgHex);
  const bg = parseHex(bgHex);
  const steps = 256;

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const r = fg.r * (1 - t);
    const g = fg.g * (1 - t);
    const b = fg.b * (1 - t);
    const candidate: RgbColor = {
      r: Math.round(r),
      g: Math.round(g),
      b: Math.round(b),
    };
    const ratio = checkContrast(candidate, bg);
    if (ratio >= targetRatio) {
      return rgbToHex(candidate.r, candidate.g, candidate.b);
    }
  }

  return '#000000';
}

// ---------------------------------------------------------------------------
// Contrast fixes — CSS variable overrides for WCAG AA compliance
// ---------------------------------------------------------------------------

/**
 * CSS variable overrides that improve contrast on the default dark theme
 * to meet WCAG AA (4.5:1 minimum for normal text).
 *
 * The primary contrast improvements in the default Neon Cyan theme:
 *
 * 1. `--color-muted-foreground` hsl(215 15% 55%) on `--color-background`
 *    hsl(225 20% 3%) → ratio ~5.67:1 (passes AA, but marginal on muted surfaces).
 *    On `--color-muted` hsl(225 12% 10%) → ratio ~5.00:1 (barely passes).
 *    Fix: bump lightness from 55% → 63% → bg ratio ~7.42:1, muted ratio ~6.54:1
 *    This gives comfortable margin and brings other themes (50% lightness) into compliance.
 *
 * 2. `--color-border` hsl(225 12% 14%) is very subtle on dark backgrounds.
 *    Decorative borders are exempt from WCAG 1.4.11, but improved visibility
 *    helps usability. Bump from 14% → 20% for better visual separation.
 *
 * 3. Other themes' muted-foreground at 50% lightness FAILS AA on muted/card
 *    surfaces. See THEME_MUTED_FIXES for per-theme corrections.
 */
export const CONTRAST_FIXES: Record<string, string> = {
  // Muted foreground: 55% → 63% lightness — comfortable AA margin on all dark surfaces
  '--color-muted-foreground': 'hsl(215 15% 63%)',

  // Border: 14% → 20% lightness — improved visual separation (decorative, not WCAG-required)
  '--color-border': 'hsl(225 12% 20%)',

  // Input border: mirrors --color-border
  '--color-input': 'hsl(225 12% 20%)',

  // Sidebar border: 12% → 18% for consistent border visibility
  '--color-sidebar-border': 'hsl(225 12% 18%)',
};

/**
 * Map of theme IDs → their specific muted-foreground contrast fixes.
 * Each entry brings the muted-foreground into WCAG AA compliance on that
 * theme's background.
 */
export const THEME_MUTED_FIXES: Record<string, string> = {
  'neon-cyan': 'hsl(215 15% 63%)',
  'midnight-purple': 'hsl(250 12% 63%)',
  'forest': 'hsl(150 10% 58%)',
  'amber': 'hsl(35 10% 58%)',
  'rose': 'hsl(350 10% 58%)',
  'monochrome': 'hsl(0 0% 58%)',
  'oled-black': 'hsl(190 20% 60%)', // already compliant at 60%
};

/**
 * Validate that every foreground/background pair in a theme meets WCAG AA.
 * Returns an array of failing pairs with their ratios.
 */
export function auditThemeContrast(
  colors: Record<string, string>,
): Array<{ fg: string; bg: string; fgVar: string; bgVar: string; ratio: number }> {
  const pairs: Array<{ fgVar: string; bgVar: string }> = [
    { fgVar: '--color-foreground', bgVar: '--color-background' },
    { fgVar: '--color-card-foreground', bgVar: '--color-card' },
    { fgVar: '--color-popover-foreground', bgVar: '--color-popover' },
    { fgVar: '--color-primary-foreground', bgVar: '--color-primary' },
    { fgVar: '--color-secondary-foreground', bgVar: '--color-secondary' },
    { fgVar: '--color-muted-foreground', bgVar: '--color-background' },
    { fgVar: '--color-muted-foreground', bgVar: '--color-muted' },
    { fgVar: '--color-muted-foreground', bgVar: '--color-card' },
    { fgVar: '--color-accent-foreground', bgVar: '--color-accent' },
    { fgVar: '--color-destructive-foreground', bgVar: '--color-destructive' },
  ];

  const failures: Array<{ fg: string; bg: string; fgVar: string; bgVar: string; ratio: number }> = [];

  for (const { fgVar, bgVar } of pairs) {
    const fg = colors[fgVar];
    const bg = colors[bgVar];
    if (!fg || !bg) {
      continue;
    }
    try {
      const ratio = checkContrast(fg, bg);
      if (!meetsWcagAA(ratio)) {
        failures.push({ fg, bg, fgVar, bgVar, ratio });
      }
    } catch {
      // skip unparseable colours (e.g. raw hex editor-accent)
    }
  }

  return failures;
}
