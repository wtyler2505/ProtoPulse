/**
 * Shared types for engineering calculators.
 *
 * All calculator modules return CalculatorResult objects with
 * a numeric value, SI unit, and a human-readable formatted string.
 */

/** A single calculated output value. */
export interface CalculatorResult {
  /** Numeric value in base SI units (ohms, volts, amps, watts, farads, hertz, seconds). */
  value: number;
  /** SI unit string (e.g., '\u03A9', 'V', 'A', 'W', 'F', 'Hz', 's'). */
  unit: string;
  /** Human-readable formatted string with engineering prefix (e.g., '4.7 k\u03A9'). */
  formatted: string;
}

/** Validation error returned when inputs are invalid. */
export interface CalculatorError {
  field: string;
  message: string;
}

/** Result from a calculator that may include nearest standard values. */
export interface ResistorResult extends CalculatorResult {
  /** Nearest E24 standard value in ohms. */
  nearestE24: number;
  /** Nearest E96 standard value in ohms. */
  nearestE96: number;
  /** Formatted nearest E24 string. */
  nearestE24Formatted: string;
  /** Formatted nearest E96 string. */
  nearestE96Formatted: string;
}

/** Filter type for filter calculations. */
export type FilterType = 'low-pass' | 'high-pass' | 'bandpass';

// ---------------------------------------------------------------------------
// E-series standard resistor values (multipliers for each decade)
// ---------------------------------------------------------------------------

/** E24 series: 24 values per decade (5% tolerance). */
export const E24_VALUES: readonly number[] = [
  1.0, 1.1, 1.2, 1.3, 1.5, 1.6, 1.8, 2.0, 2.2, 2.4, 2.7, 3.0,
  3.3, 3.6, 3.9, 4.3, 4.7, 5.1, 5.6, 6.2, 6.8, 7.5, 8.2, 9.1,
] as const;

/** E96 series: 96 values per decade (1% tolerance). */
export const E96_VALUES: readonly number[] = [
  1.00, 1.02, 1.05, 1.07, 1.10, 1.13, 1.15, 1.18, 1.21, 1.24,
  1.27, 1.30, 1.33, 1.37, 1.40, 1.43, 1.47, 1.50, 1.54, 1.58,
  1.62, 1.65, 1.69, 1.74, 1.78, 1.82, 1.87, 1.91, 1.96, 2.00,
  2.05, 2.10, 2.15, 2.21, 2.26, 2.32, 2.37, 2.43, 2.49, 2.55,
  2.61, 2.67, 2.74, 2.80, 2.87, 2.94, 3.01, 3.09, 3.16, 3.24,
  3.32, 3.40, 3.48, 3.57, 3.65, 3.74, 3.83, 3.92, 4.02, 4.12,
  4.22, 4.32, 4.42, 4.53, 4.64, 4.75, 4.87, 4.99, 5.11, 5.23,
  5.36, 5.49, 5.62, 5.76, 5.90, 6.04, 6.19, 6.34, 6.49, 6.65,
  6.81, 6.98, 7.15, 7.32, 7.50, 7.68, 7.87, 8.06, 8.25, 8.45,
  8.66, 8.87, 9.09, 9.31, 9.53, 9.76,
] as const;

// ---------------------------------------------------------------------------
// Utility: find nearest standard value from an E-series
// ---------------------------------------------------------------------------

/**
 * Find the nearest standard resistor value from a given E-series.
 * Works across decades (0.1 ohm through 100M ohm) by normalizing
 * the target value to a 1-9.99 multiplier and matching against the series.
 */
export function findNearestStandard(targetOhms: number, series: readonly number[]): number {
  if (targetOhms <= 0 || !Number.isFinite(targetOhms)) {
    return series[0];
  }

  // Determine the decade: 10^floor(log10(target))
  const decade = Math.pow(10, Math.floor(Math.log10(targetOhms)));
  const normalized = targetOhms / decade;

  let bestValue = series[0];
  let bestRatio = Infinity;

  for (const sv of series) {
    // Use logarithmic distance for better matching across the range
    const ratio = Math.abs(Math.log(normalized / sv));
    if (ratio < bestRatio) {
      bestRatio = ratio;
      bestValue = sv;
    }
  }

  // Also check one decade up in case the target is near the boundary
  const nextDecadeValue = series[0] * decade * 10;
  const nextRatio = Math.abs(Math.log(targetOhms / nextDecadeValue));
  if (nextRatio < bestRatio) {
    return nextDecadeValue;
  }

  return bestValue * decade;
}

// ---------------------------------------------------------------------------
// Engineering prefix formatter
// ---------------------------------------------------------------------------

/** SI prefixes for engineering notation (powers of 10 in multiples of 3). */
const SI_PREFIXES: ReadonlyArray<{ factor: number; prefix: string }> = [
  { factor: 1e12, prefix: 'T' },
  { factor: 1e9, prefix: 'G' },
  { factor: 1e6, prefix: 'M' },
  { factor: 1e3, prefix: 'k' },
  { factor: 1, prefix: '' },
  { factor: 1e-3, prefix: 'm' },
  { factor: 1e-6, prefix: '\u00B5' },
  { factor: 1e-9, prefix: 'n' },
  { factor: 1e-12, prefix: 'p' },
];

/**
 * Format a numeric value with engineering SI prefix notation.
 * @param value - The numeric value in base units
 * @param unit - The unit symbol (e.g., '\u03A9', 'V', 'A')
 * @param precision - Number of significant digits (default 3)
 */
export function formatEngineering(value: number, unit: string, precision = 3): string {
  if (value === 0) {
    return `0 ${unit}`;
  }
  if (!Number.isFinite(value)) {
    return `${String(value)} ${unit}`;
  }

  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  for (const { factor, prefix } of SI_PREFIXES) {
    if (absValue >= factor * 0.9999) {
      const scaled = absValue / factor;
      // Use toPrecision for consistent significant digits, then strip trailing zeros
      const formatted = Number(scaled.toPrecision(precision)).toString();
      return `${sign}${formatted} ${prefix}${unit}`;
    }
  }

  // Smaller than pico — use scientific notation
  return `${value.toExponential(precision - 1)} ${unit}`;
}
