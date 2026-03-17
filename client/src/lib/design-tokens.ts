/**
 * Design Tokens — Spacing & Typography
 *
 * Centralised design token definitions for ProtoPulse's dark-neon-cyan theme.
 * Provides type-safe spacing scale values, typography presets, and helpers
 * that convert tokens into CSS custom properties or inline style objects.
 *
 * Usage:
 *   import { getSpacing, getTypography, toCSSVariables, SPACING_SCALE, TYPOGRAPHY_TOKENS } from '@/lib/design-tokens';
 *
 *   // Inline style
 *   <div style={{ padding: getSpacing(4), ...getTypography('base') }} />
 *
 *   // CSS variables (inject into :root via CSSStyleDeclaration or style tag)
 *   const vars = toCSSVariables(TYPOGRAPHY_TOKENS);
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Valid spacing scale keys (loosely based on Tailwind 4). */
export type SpacingScale = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 8 | 10 | 12 | 16 | 20 | 24;

/** A single typography token definition. */
export interface TypographyToken {
  /** Font size in rem (e.g. '0.75rem'). */
  fontSize: string;
  /** Line height as a unitless ratio or rem value (e.g. '1rem', '1.5'). */
  lineHeight: string;
  /** CSS font-weight value (e.g. 400, 500, 700). */
  fontWeight: number;
  /** Letter spacing in em (e.g. '0.025em', 'normal'). */
  letterSpacing: string;
}

// ---------------------------------------------------------------------------
// Constants — Spacing
// ---------------------------------------------------------------------------

/**
 * Spacing scale mapping.
 * Each key is a logical step; the value is the pixel equivalent.
 * Follows a 4px base grid (step 1 = 4px).
 */
export const SPACING_SCALE: Record<SpacingScale, number> = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
  20: 80,
  24: 96,
} as const;

// ---------------------------------------------------------------------------
// Constants — Typography
// ---------------------------------------------------------------------------

/** Pre-defined typography tokens covering the full size range. */
export const TYPOGRAPHY_TOKENS: Record<string, TypographyToken> = {
  xs: {
    fontSize: '0.75rem',
    lineHeight: '1rem',
    fontWeight: 400,
    letterSpacing: '0.025em',
  },
  sm: {
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
    fontWeight: 400,
    letterSpacing: '0.015em',
  },
  base: {
    fontSize: '1rem',
    lineHeight: '1.5rem',
    fontWeight: 400,
    letterSpacing: 'normal',
  },
  lg: {
    fontSize: '1.125rem',
    lineHeight: '1.75rem',
    fontWeight: 500,
    letterSpacing: 'normal',
  },
  xl: {
    fontSize: '1.25rem',
    lineHeight: '1.75rem',
    fontWeight: 500,
    letterSpacing: '-0.01em',
  },
  '2xl': {
    fontSize: '1.5rem',
    lineHeight: '2rem',
    fontWeight: 600,
    letterSpacing: '-0.015em',
  },
  '3xl': {
    fontSize: '1.875rem',
    lineHeight: '2.25rem',
    fontWeight: 700,
    letterSpacing: '-0.02em',
  },
  display: {
    fontSize: '2.25rem',
    lineHeight: '2.5rem',
    fontWeight: 700,
    letterSpacing: '-0.025em',
  },
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns the pixel value for a spacing scale step as a CSS string (e.g. '16px').
 * Returns '0px' for scale 0.
 *
 * @throws {Error} if `scale` is not a valid SpacingScale key.
 */
export function getSpacing(scale: SpacingScale): string {
  const px = SPACING_SCALE[scale];
  if (px === undefined) {
    throw new Error(`Invalid spacing scale "${String(scale)}". Valid keys: ${Object.keys(SPACING_SCALE).join(', ')}`);
  }
  return `${String(px)}px`;
}

/**
 * Returns a React-compatible CSSProperties object for a named typography token.
 *
 * @throws {Error} if `token` is not a recognised typography token name.
 */
export function getTypography(token: string): React.CSSProperties {
  const t = TYPOGRAPHY_TOKENS[token];
  if (!t) {
    throw new Error(
      `Unknown typography token "${token}". Valid tokens: ${Object.keys(TYPOGRAPHY_TOKENS).join(', ')}`,
    );
  }
  return {
    fontSize: t.fontSize,
    lineHeight: t.lineHeight,
    fontWeight: t.fontWeight,
    letterSpacing: t.letterSpacing,
  };
}

/**
 * Converts a record of TypographyTokens into CSS custom-property pairs.
 *
 * For a token keyed `"base"` with `{ fontSize: '1rem', lineHeight: '1.5rem', fontWeight: 400, letterSpacing: 'normal' }`,
 * the output contains:
 *   --typography-base-font-size: 1rem
 *   --typography-base-line-height: 1.5rem
 *   --typography-base-font-weight: 400
 *   --typography-base-letter-spacing: normal
 *
 * @returns A flat Record<string, string> suitable for `element.style.setProperty()`.
 */
export function toCSSVariables(tokens: Record<string, TypographyToken>): Record<string, string> {
  const vars: Record<string, string> = {};

  for (const [name, token] of Object.entries(tokens)) {
    vars[`--typography-${name}-font-size`] = token.fontSize;
    vars[`--typography-${name}-line-height`] = token.lineHeight;
    vars[`--typography-${name}-font-weight`] = String(token.fontWeight);
    vars[`--typography-${name}-letter-spacing`] = token.letterSpacing;
  }

  return vars;
}
