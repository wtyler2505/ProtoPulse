/**
 * Pure scale math for the plot — tick generation, engineering notation,
 * linear/log mapping, dB conversion. No DOM, no canvas: this module is
 * what the unit tests exercise; Plot.tsx is a thin painter over it.
 */

const ENG_SUFFIX_BY_EXP: Record<number, string> = {
  [-18]: 'a',
  [-15]: 'f',
  [-12]: 'p',
  [-9]: 'n',
  [-6]: 'µ',
  [-3]: 'm',
  0: '',
  3: 'k',
  6: 'M',
  9: 'G',
  12: 'T',
  15: 'P',
};

/** 0.001 → "1m", 1e-6 → "1µ", 10_000 → "10k", -2200 → "-2.2k", 0 → "0". */
export function engNotation(value: number, sigDigits = 3): string {
  if (value === 0) return '0';
  if (!Number.isFinite(value)) return String(value);
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  let exp3 = Math.floor(Math.log10(abs) / 3) * 3;
  exp3 = Math.max(-18, Math.min(15, exp3));
  let mantissa = Number((abs / 10 ** exp3).toPrecision(sigDigits));
  // Rounding can carry over a decade (999.9 → 1000): renormalize.
  if (mantissa >= 1000 && exp3 < 15) {
    mantissa /= 1000;
    exp3 += 3;
  }
  return `${sign}${String(mantissa)}${ENG_SUFFIX_BY_EXP[exp3] ?? ''}`;
}

/** Round-numbered ticks covering [min, max]; ~targetCount of them. */
export function niceTicks(min: number, max: number, targetCount = 5): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || targetCount < 1) return [];
  if (min === max) return [min];
  if (min > max) [min, max] = [max, min];

  const rawStep = (max - min) / targetCount;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalized = rawStep / magnitude;
  const factor = normalized < 1.5 ? 1 : normalized < 3 ? 2 : normalized < 7 ? 5 : 10;
  const step = factor * magnitude;

  const ticks: number[] = [];
  // Epsilon-guarded so float quotients (1e-3 / 2e-4) don't drop endpoints.
  const first = Math.ceil(min / step - 1e-9);
  const last = Math.floor(max / step + 1e-9);
  for (let i = first; i <= last; i++) {
    // Snap away float drift (0.30000000000000004 → 0.3).
    ticks.push(Number((i * step).toPrecision(12)));
  }
  return ticks;
}

/** Powers of 10 within [min, max] (for the log-x frequency axis). */
export function logTicks(min: number, max: number): number[] {
  if (!(min > 0) || !(max > 0) || min > max) return [];
  const ticks: number[] = [];
  const first = Math.ceil(Math.log10(min) - 1e-9);
  const last = Math.floor(Math.log10(max) + 1e-9);
  for (let e = first; e <= last; e++) {
    ticks.push(10 ** e);
  }
  return ticks;
}

/** Linear domain → range mapping. */
export function linMap(v: number, d0: number, d1: number, r0: number, r1: number): number {
  if (d1 === d0) return (r0 + r1) / 2;
  return r0 + ((v - d0) / (d1 - d0)) * (r1 - r0);
}

/** Log domain → range mapping; non-positive inputs map to NaN. */
export function logMap(v: number, d0: number, d1: number, r0: number, r1: number): number {
  if (!(v > 0) || !(d0 > 0) || !(d1 > 0)) return NaN;
  return linMap(Math.log10(v), Math.log10(d0), Math.log10(d1), r0, r1);
}

/** Magnitude in dB: 20·log10(|re + j·im|). */
export function magnitudeDb(re: number, im = 0): number {
  return 20 * Math.log10(Math.hypot(re, im));
}

/** Convert a complex (or real) vector to dB magnitude. */
export function vectorDb(values: number[], imag?: number[]): number[] {
  return values.map((re, i) => magnitudeDb(re, imag?.[i] ?? 0));
}
