/**
 * Shared unit/scale contract across simulation, DRC, parametric search, and
 * bridge engines (BL-0126).
 *
 * The goal of this module is **one source of truth** for SI prefix tables,
 * unit families, and value parsing — so the sim, DRC, parametric-search, and
 * export pipelines all agree on what "10nF" or "100m" means.
 *
 * ---------------------------------------------------------------------------
 * Two parser conventions live here, intentionally:
 *
 *  1. **Strict SI** (`parseSiValue`) — case-sensitive.
 *       m  = milli  (1e-3)        M  = mega   (1e6)
 *       u  = micro  (1e-6)        µ  = micro  (1e-6)
 *       n  = nano   (1e-9)        k  = kilo   (1e3)
 *       p  = pico   (1e-12)       G  = giga   (1e9)
 *     Used by parametric search (catalog / inventory metadata) where
 *     "10M" must mean 10 mega (= 10,000,000).
 *
 *  2. **SPICE engineering notation** (`parseSpiceValue`) — case-insensitive.
 *       M or m  = milli  (1e-3)   MEG or meg = mega (1e6)
 *       U or u  = micro  (1e-6)   K   or k   = kilo (1e3)
 *       N or n  = nano   (1e-9)   G   or g   = giga (1e9)
 *       P or p  = pico   (1e-12)  T   or t   = tera (1e12)
 *       F or f  = femto  (1e-15)
 *     Used by the SPICE netlist generators / parsers where "10M" must
 *     mean 10 milli (= 0.01) per SPICE standard.
 *
 * The divergence between these two conventions (`M`) was the root cause of
 * silent numerical drift between the DRC / parametric-search layer and the
 * SPICE simulation layer. Now the behaviour lives in ONE file, is documented
 * explicitly, and cross-engine translation always goes through
 * `spiceToSiNumber` / `siToSpiceNumber` (which is a no-op — both parsers
 * produce numbers in SI base units; only the input string convention differs).
 * ---------------------------------------------------------------------------
 */

// ---------------------------------------------------------------------------
// SI unit families
// ---------------------------------------------------------------------------

/** Canonical unit families the codebase cares about. */
export type SiUnit =
  | 'volt'       // V  (base: volt)
  | 'amp'        // A  (base: ampere)
  | 'ohm'        // Ω  (base: ohm)
  | 'farad'      // F  (base: farad)
  | 'henry'      // H  (base: henry)
  | 'watt'       // W  (base: watt)
  | 'hertz'      // Hz (base: hertz)
  | 'second'     // s  (base: second)
  | 'meter'      // m  (base: meter)
  | 'kelvin'     // K  (base: kelvin)
  | 'celsius'    // °C (offset from kelvin)
  | 'none';      // dimensionless (ratio, count, tolerance %)

/** Micro sign and Greek mu both map to `u` (micro). */
export const MICRO_SIGN = '\u00B5';
export const GREEK_MU = '\u03BC';

// ---------------------------------------------------------------------------
// Canonical prefix tables — the single source of truth
// ---------------------------------------------------------------------------

/**
 * Strict SI prefixes. Case-sensitive: `m` = milli, `M` = mega.
 * `u`, `µ` (U+00B5), `μ` (U+03BC) all map to micro (1e-6).
 */
export const SI_PREFIXES: Readonly<Record<string, number>> = Object.freeze({
  y: 1e-24,
  z: 1e-21,
  a: 1e-18,
  f: 1e-15,
  p: 1e-12,
  n: 1e-9,
  u: 1e-6,
  [MICRO_SIGN]: 1e-6,
  [GREEK_MU]: 1e-6,
  m: 1e-3,
  c: 1e-2,
  d: 1e-1,
  '': 1,
  da: 1e1,
  h: 1e2,
  k: 1e3,
  M: 1e6,
  G: 1e9,
  T: 1e12,
  P: 1e15,
  E: 1e18,
  Z: 1e21,
  Y: 1e24,
});

/**
 * SPICE engineering prefixes. Case-insensitive — the SPICE standard
 * (Berkeley / ngspice) uses `M` = milli and `MEG` = mega.
 *
 * Keys here are lowercase; callers should upper/lowercase-normalize before
 * lookup. Order for longest-first matching is provided via
 * {@link SPICE_PREFIX_ORDER}.
 */
export const SPICE_PREFIXES: Readonly<Record<string, number>> = Object.freeze({
  t: 1e12,
  g: 1e9,
  meg: 1e6,
  mil: 25.4e-6, // SPICE "MIL" = 1/1000 inch = 25.4 µm
  k: 1e3,
  m: 1e-3,
  u: 1e-6,
  [MICRO_SIGN]: 1e-6,
  [GREEK_MU]: 1e-6,
  n: 1e-9,
  p: 1e-12,
  f: 1e-15,
});

/**
 * Order to try SPICE suffixes in. Longest first so "MEG" is matched before "M"
 * and "MIL" before "M".
 */
export const SPICE_PREFIX_ORDER: readonly string[] = Object.freeze([
  'meg',
  'mil',
  't',
  'g',
  'k',
  'm',
  'u',
  MICRO_SIGN,
  GREEK_MU,
  'n',
  'p',
  'f',
]);

// ---------------------------------------------------------------------------
// Unit-suffix recognition (shared between SI and SPICE callers)
// ---------------------------------------------------------------------------

/** Maps a trailing unit-string (lowercase) to a canonical {@link SiUnit}. */
export const UNIT_SUFFIX_MAP: Readonly<Record<string, SiUnit>> = Object.freeze({
  '': 'none',
  '\u2126': 'ohm', // Ω (U+2126 Ohm sign)
  '\u03A9': 'ohm', // Ω (U+03A9 Greek capital omega — what keyboards / most editors produce)
  ohm: 'ohm',
  ohms: 'ohm',
  r: 'ohm',
  f: 'farad',
  farad: 'farad',
  farads: 'farad',
  h: 'henry',
  henry: 'henry',
  henrys: 'henry',
  henries: 'henry',
  v: 'volt',
  volt: 'volt',
  volts: 'volt',
  a: 'amp',
  amp: 'amp',
  amps: 'amp',
  ampere: 'amp',
  amperes: 'amp',
  w: 'watt',
  watt: 'watt',
  watts: 'watt',
  hz: 'hertz',
  hertz: 'hertz',
  s: 'second',
  sec: 'second',
  secs: 'second',
  second: 'second',
  seconds: 'second',
});

// ---------------------------------------------------------------------------
// Parsed result shapes
// ---------------------------------------------------------------------------

/** Result returned by both {@link parseSiValue} and {@link parseSpiceValue}. */
export interface ParsedValue {
  /** Magnitude expressed in SI base units (volt, amp, ohm, farad, henry …). */
  value: number;
  /** Detected unit family — `'none'` if no unit letters were present. */
  unit: SiUnit;
  /** Raw scale multiplier that was applied (`1e-9` for `"n"`, `1` for none). */
  scale: number;
}

// ---------------------------------------------------------------------------
// Strict SI parser  (case-sensitive  —  m=milli, M=mega)
// ---------------------------------------------------------------------------

const SI_PARSE_RE =
  /^\s*([+-]?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*([a-zA-Z\u00B5\u03BC\u2126\u03A9°]*)\s*$/;

/**
 * Parse a strict-SI value string.
 *
 * Accepts inputs such as:
 *   `"10"`, `"3.14"`, `"1.5e-6"`, `"10k"`, `"4.7uF"`, `"100nH"`,
 *   `"22pF"`, `"10MΩ"`, `"10kOhm"`, `"500mA"`, `"3.3V"`.
 *
 * **Strict SI convention** — `m` = milli (1e-3), `M` = mega (1e6).
 * Do NOT use this for SPICE netlist values; use {@link parseSpiceValue}.
 *
 * Returns `null` if the string cannot be parsed.
 */
export function parseSiValue(input: string | number): ParsedValue | null {
  if (typeof input === 'number') {
    return Number.isFinite(input)
      ? { value: input, unit: 'none', scale: 1 }
      : null;
  }
  if (typeof input !== 'string') return null;

  const trimmed = input.trim();
  if (!trimmed) return null;

  const match = SI_PARSE_RE.exec(trimmed);
  if (!match) return null;

  const num = Number(match[1]);
  if (!Number.isFinite(num)) return null;

  const suffix = match[2] ?? '';
  const { scale, unit } = splitSiSuffix(suffix);
  if (scale === null) return null;

  return { value: num * scale, unit, scale };
}

/**
 * Split a raw suffix like `"uF"`, `"kΩ"`, `"Meg"`, `"mV"`, `""` into its
 * SI prefix multiplier and recognised unit family.
 *
 * Returns `scale: null` if the suffix cannot be resolved under strict SI rules.
 */
/**
 * Normalize a unit string for lookup. `.toLowerCase()` would turn `Ω`
 * (U+2126 Ohm sign) into `ω` (U+03C9 Greek small omega) which is a
 * DIFFERENT codepoint and would not match our UNIT_SUFFIX_MAP keys.
 * We keep the Ohm sign verbatim and only lowercase ASCII.
 */
function normalizeUnitKey(s: string): string {
  let out = '';
  for (const ch of s) {
    const code = ch.charCodeAt(0);
    if (code >= 65 && code <= 90) {
      out += String.fromCharCode(code + 32);
    } else {
      out += ch;
    }
  }
  return out;
}

function splitSiSuffix(suffix: string): { scale: number | null; unit: SiUnit } {
  if (!suffix) return { scale: 1, unit: 'none' };

  // Case A: suffix is purely a unit (no prefix) — e.g. "F", "Ω", "Hz", "V"
  const whole = UNIT_SUFFIX_MAP[normalizeUnitKey(suffix)];
  if (whole !== undefined) return { scale: 1, unit: whole };

  // Case B: first char is an SI prefix (case-sensitive), remainder is a unit.
  // Try the (case-preserving) first character as a prefix.
  const firstChar = suffix[0];
  const prefixScale = SI_PREFIXES[firstChar];
  if (prefixScale !== undefined) {
    const rest = suffix.slice(1);
    const restUnit = UNIT_SUFFIX_MAP[normalizeUnitKey(rest)];
    if (restUnit !== undefined) return { scale: prefixScale, unit: restUnit };
    // Empty remainder means caller wrote just the prefix ("10k") — allowed.
    if (rest === '') return { scale: prefixScale, unit: 'none' };
  }

  // Case C: "da" (deca) two-character prefix, then unit.
  if (suffix.startsWith('da')) {
    const rest = suffix.slice(2);
    const restUnit = UNIT_SUFFIX_MAP[normalizeUnitKey(rest)];
    if (restUnit !== undefined) return { scale: 1e1, unit: restUnit };
    if (rest === '') return { scale: 1e1, unit: 'none' };
  }

  return { scale: null, unit: 'none' };
}

// ---------------------------------------------------------------------------
// SPICE parser  (case-insensitive  —  M=milli, MEG=mega)
// ---------------------------------------------------------------------------

const SPICE_PARSE_RE =
  /^\s*([+-]?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)\s*([a-zA-Z\u00B5\u03BC\u2126]*)\s*$/;

/**
 * Parse a SPICE engineering-notation value string.
 *
 * Accepts inputs such as:
 *   `"100"`, `"3.14"`, `"1e3"`, `"2.2e-6"`, `"10k"`, `"1Meg"`, `"10K"`,
 *   `"4.7u"`, `"100n"`, `"100nF"`, `"10kOhm"`, `"4.7uH"`, `"1µ"`.
 *
 * **SPICE convention** — case-insensitive: `M`/`m` = milli (1e-3),
 * `MEG`/`meg` = mega (1e6). This matches Berkeley SPICE / ngspice.
 *
 * Returns `NaN` for unparseable input (matching legacy behaviour of all four
 * replaced parsers).
 */
export function parseSpiceValue(valueStr: string | number): number {
  if (typeof valueStr === 'number') {
    return Number.isFinite(valueStr) ? valueStr : NaN;
  }
  if (typeof valueStr !== 'string') return NaN;

  const cleaned = valueStr.trim();
  if (!cleaned) return NaN;

  // Direct numeric parse (handles "100", "3.14", "1e3", etc.) — we allow this
  // only when the entire trimmed input is a pure number to avoid Number("10k")
  // silently returning NaN but Number("10 5") returning NaN too.
  if (/^[+-]?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?$/.test(cleaned)) {
    const direct = Number(cleaned);
    if (Number.isFinite(direct)) return direct;
  }

  const match = SPICE_PARSE_RE.exec(cleaned);
  if (!match) return NaN;

  const num = Number(match[1]);
  if (!Number.isFinite(num)) return NaN;

  const suffix = match[2] ?? '';
  if (!suffix) return num;

  const multiplier = resolveSpiceSuffix(suffix);
  if (multiplier === null) return NaN;
  return num * multiplier;
}

/**
 * Look up a SPICE suffix (e.g. `"K"`, `"MEG"`, `"uF"`, `"Ohm"`). Case-insensitive.
 *
 * - First tries the longest-match prefix (so `"MEG"` beats `"M"`).
 * - Then treats the remainder (if any) as a unit letter — callers get `1` for
 *   `"Ohm"`, `"V"`, `"A"`, `"H"`, `"F"`, `"W"`, `"S"`, `"Hz"` when no prefix
 *   matches (SPICE allows bare unit suffixes).
 * - Returns `null` when nothing matches.
 */
function resolveSpiceSuffix(suffix: string): number | null {
  const lower = suffix.toLowerCase();

  // Longest-first prefix match
  for (const key of SPICE_PREFIX_ORDER) {
    if (lower.startsWith(key)) {
      const rest = lower.slice(key.length);
      if (rest === '') return SPICE_PREFIXES[key];
      // Prefix followed by a valid unit letter (F, H, V, A, Ohm, Hz, W, S)
      if (UNIT_SUFFIX_MAP[rest] !== undefined) return SPICE_PREFIXES[key];
    }
  }

  // No prefix — suffix may be a bare unit letter ("Ohm", "V", "Hz", "F", …)
  if (UNIT_SUFFIX_MAP[lower] !== undefined) return 1;

  return null;
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/** Ordered list of SPICE-compatible decades (largest first). */
const SPICE_FORMAT_DECADES: ReadonlyArray<{ threshold: number; divisor: number; suffix: string }> =
  Object.freeze([
    { threshold: 1e12, divisor: 1e12, suffix: 'T' },
    { threshold: 1e9, divisor: 1e9, suffix: 'G' },
    { threshold: 1e6, divisor: 1e6, suffix: 'MEG' },
    { threshold: 1e3, divisor: 1e3, suffix: 'K' },
    { threshold: 1, divisor: 1, suffix: '' },
    { threshold: 1e-3, divisor: 1e-3, suffix: 'M' },
    { threshold: 1e-6, divisor: 1e-6, suffix: 'U' },
    { threshold: 1e-9, divisor: 1e-9, suffix: 'N' },
    { threshold: 1e-12, divisor: 1e-12, suffix: 'P' },
    { threshold: 1e-15, divisor: 1e-15, suffix: 'F' },
  ]);

/**
 * Format a number in SPICE engineering notation using `toPrecision(4)`.
 *
 * e.g. `formatSpiceValueFixed(10e3) === "10.00K"`, `formatSpiceValueFixed(1e-6) === "1.000U"`.
 *
 * This is the style used by `spice-generator.ts` and `server/export/spice-exporter.ts`.
 * Values smaller than 1e-12 fall back to `toExponential(3)`.
 */
export function formatSpiceValueFixed(value: number, precision = 4): string {
  if (value === 0) return '0';
  if (!Number.isFinite(value)) return String(value);

  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  for (const { threshold, divisor, suffix } of SPICE_FORMAT_DECADES) {
    if (abs >= threshold) {
      return `${sign}${(abs / divisor).toPrecision(precision)}${suffix}`;
    }
  }
  return `${sign}${abs.toExponential(3)}`;
}

/**
 * Format a number in SPICE engineering notation stripping trailing zeros.
 *
 * e.g. `formatSpiceValueCompact(10e3) === "10K"`, `formatSpiceValueCompact(100e-9) === "100N"`.
 *
 * This is the style used by `design-var-spice-bridge.ts` when exporting
 * `.param` directives.
 */
export function formatSpiceValueCompact(value: number, sigDigits = 6): string {
  if (value === 0) return '0';
  if (!Number.isFinite(value)) return String(value);

  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  for (const { threshold, divisor, suffix } of SPICE_FORMAT_DECADES) {
    if (abs >= threshold) {
      const scaled = abs / divisor;
      const formatted = parseFloat(scaled.toPrecision(sigDigits)).toString();
      return `${sign}${formatted}${suffix}`;
    }
  }
  return value.toExponential(sigDigits);
}

/**
 * Format a number in strict-SI engineering notation (case-sensitive prefixes).
 *
 * e.g. `formatSiValue(1e-9, 'farad') === "1n F"`,
 *      `formatSiValue(10_000, 'ohm') === "10k Ω"`.
 *
 * A space separates the value-with-prefix from the unit symbol, matching BIPM
 * recommendation. Pass `symbol: ''` (or `unit: 'none'`) to omit the unit.
 */
export function formatSiValue(
  value: number,
  unit: SiUnit = 'none',
  precision = 3,
): string {
  if (value === 0) return unit === 'none' ? '0' : `0 ${unitSymbol(unit)}`;
  if (!Number.isFinite(value)) return String(value);

  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  const decades: ReadonlyArray<{ threshold: number; divisor: number; prefix: string }> = [
    { threshold: 1e12, divisor: 1e12, prefix: 'T' },
    { threshold: 1e9, divisor: 1e9, prefix: 'G' },
    { threshold: 1e6, divisor: 1e6, prefix: 'M' },
    { threshold: 1e3, divisor: 1e3, prefix: 'k' },
    { threshold: 1, divisor: 1, prefix: '' },
    { threshold: 1e-3, divisor: 1e-3, prefix: 'm' },
    { threshold: 1e-6, divisor: 1e-6, prefix: 'u' },
    { threshold: 1e-9, divisor: 1e-9, prefix: 'n' },
    { threshold: 1e-12, divisor: 1e-12, prefix: 'p' },
    { threshold: 1e-15, divisor: 1e-15, prefix: 'f' },
  ];

  for (const { threshold, divisor, prefix } of decades) {
    if (abs >= threshold) {
      const scaled = abs / divisor;
      const num = parseFloat(scaled.toPrecision(precision)).toString();
      const sym = unitSymbol(unit);
      return sym ? `${sign}${num}${prefix} ${sym}` : `${sign}${num}${prefix}`;
    }
  }
  const sym = unitSymbol(unit);
  return sym ? `${sign}${abs.toExponential(precision)} ${sym}` : `${sign}${abs.toExponential(precision)}`;
}

function unitSymbol(unit: SiUnit): string {
  switch (unit) {
    case 'volt': return 'V';
    case 'amp': return 'A';
    case 'ohm': return '\u2126';
    case 'farad': return 'F';
    case 'henry': return 'H';
    case 'watt': return 'W';
    case 'hertz': return 'Hz';
    case 'second': return 's';
    case 'meter': return 'm';
    case 'kelvin': return 'K';
    case 'celsius': return '\u00B0C';
    case 'none': return '';
  }
}

// ---------------------------------------------------------------------------
// Unit conversion (within a family)
// ---------------------------------------------------------------------------

/**
 * Convert a numeric value between same-family units.
 *
 * Currently supports the Kelvin ↔ Celsius offset. All other families in this
 * codebase already store values in SI base units (volt, amp, ohm, farad,
 * henry, watt, hertz, second, meter) so cross-scale conversion is identity.
 *
 * Throws if `fromUnit` and `toUnit` are not convertible.
 */
export function convertTo(value: number, fromUnit: SiUnit, toUnit: SiUnit): number {
  if (fromUnit === toUnit) return value;

  if (fromUnit === 'celsius' && toUnit === 'kelvin') return value + 273.15;
  if (fromUnit === 'kelvin' && toUnit === 'celsius') return value - 273.15;

  throw new Error(`Cannot convert ${fromUnit} to ${toUnit}`);
}

// ---------------------------------------------------------------------------
// Cross-engine translation
// ---------------------------------------------------------------------------

/**
 * Translate a SPICE-convention value string into an SI-base number.
 *
 * Canonical entry-point when a value flows **from** the SPICE netlist layer
 * **into** the parametric/DRC layer. Equivalent to {@link parseSpiceValue},
 * named explicitly so cross-engine call-sites are greppable.
 */
export function spiceToSiNumber(spiceValue: string | number): number {
  return parseSpiceValue(spiceValue);
}

/**
 * Translate an SI-base number into a SPICE-convention string.
 *
 * Canonical entry-point when a value flows **from** the parametric/DRC layer
 * **into** the SPICE netlist layer. Uses the compact format (no trailing zeros).
 */
export function siToSpiceString(siValue: number): string {
  return formatSpiceValueCompact(siValue);
}

// ---------------------------------------------------------------------------
// Length domain — cross-engine boundary (BL-0126 length extension)
// ---------------------------------------------------------------------------
//
// DRC engine (shared/drc-engine.ts) + board stackup (client/src/lib/board-stackup.ts)
// store all lengths in **mils** (1 mil = 1/1000 inch).
//
// Simulation layer (client/src/lib/simulation/transmission-line.ts,
// pcb-geometry-bridge.ts, pdn-analysis.ts) consumes lengths in **mm** (and
// internally converts to meters for SI physics).
//
// The drift point is the DRC↔sim bridge (pcb-geometry-bridge.ts): prior to
// BL-0126 this file had inline `* 0.0254` magic numbers with "mils to mm"
// comments. Now those call-sites call `milToMm` / `mmToMil` / `mmToMeter`.
//
// Branded types are **opt-in phantom tags** with zero runtime cost. Existing
// `number` call-sites keep working unmodified; migrated boundary code opts in
// by constructing `asMm(n)` / `asMil(n)` and receiving branded parameters.
//
// The type-level invariant "cannot pass mil where mm is expected" is
// **enforced at the sim↔DRC boundary, advisory elsewhere** — migration is
// incremental. New code at the boundary MUST use branded types; interior code
// that already agrees on a unit (e.g. DRC is all mils) does not need to
// migrate until it crosses a boundary.
// ---------------------------------------------------------------------------

/** Canonical length conversion constants — single source of truth. */
export const MM_PER_INCH = 25.4;
export const MIL_PER_INCH = 1000;
/** 1 mil = 25.4 / 1000 = 0.0254 mm. Exact by definition. */
export const MM_PER_MIL = MM_PER_INCH / MIL_PER_INCH;
export const METER_PER_MM = 1e-3;

/**
 * Branded phantom types for length units. These add a compile-time tag without
 * any runtime cost — at runtime they are plain `number`s. Opting in at a
 * function signature makes unit mistakes a type error.
 *
 * Example:
 *   function thermalResistance(traceLen: Length_mm): number { ... }
 *   thermalResistance(asMm(10));       // OK
 *   thermalResistance(asMil(10));      // TS error — wrong unit
 *   thermalResistance(10);             // TS error — no brand
 */
export type Length_mm = number & { readonly __unit: 'mm' };
export type Length_mil = number & { readonly __unit: 'mil' };
export type Length_meter = number & { readonly __unit: 'm' };
export type Length_inch = number & { readonly __unit: 'in' };

/** Brand a plain number as a millimetre length. Zero runtime cost. */
export function asMm(n: number): Length_mm { return n as Length_mm; }
/** Brand a plain number as a mil length (1/1000 inch). Zero runtime cost. */
export function asMil(n: number): Length_mil { return n as Length_mil; }
/** Brand a plain number as a metre length. Zero runtime cost. */
export function asMeter(n: number): Length_meter { return n as Length_meter; }
/** Brand a plain number as an inch length. Zero runtime cost. */
export function asInch(n: number): Length_inch { return n as Length_inch; }

/**
 * Convert mils (1/1000 inch) to millimetres.
 *
 * Accepts either a branded `Length_mil` (preferred at migrated boundaries) or
 * a plain `number` (for backward compat with un-migrated call sites).
 *
 * Pure. NaN/Infinity pass through. Negative input returns a negative mm value.
 */
export function milToMm(mils: Length_mil | number): Length_mm {
  return ((mils as number) * MM_PER_MIL) as Length_mm;
}

/** Convert millimetres to mils (1/1000 inch). Pure. */
export function mmToMil(mm: Length_mm | number): Length_mil {
  return ((mm as number) / MM_PER_MIL) as Length_mil;
}

/** Convert millimetres to metres. Pure. */
export function mmToMeter(mm: Length_mm | number): Length_meter {
  return ((mm as number) * METER_PER_MM) as Length_meter;
}

/** Convert metres to millimetres. Pure. */
export function meterToMm(m: Length_meter | number): Length_mm {
  return ((m as number) / METER_PER_MM) as Length_mm;
}

/** Convert mils directly to metres. Pure. */
export function milToMeter(mils: Length_mil | number): Length_meter {
  return ((mils as number) * MM_PER_MIL * METER_PER_MM) as Length_meter;
}

/** Convert metres directly to mils. Pure. */
export function meterToMil(m: Length_meter | number): Length_mil {
  return ((m as number) / METER_PER_MM / MM_PER_MIL) as Length_mil;
}

/** Convert inches to millimetres. Pure. */
export function inchToMm(inches: Length_inch | number): Length_mm {
  return ((inches as number) * MM_PER_INCH) as Length_mm;
}

/** Convert millimetres to inches. Pure. */
export function mmToInch(mm: Length_mm | number): Length_inch {
  return ((mm as number) / MM_PER_INCH) as Length_inch;
}

/** Convert inches to mils. Pure. Exact integer arithmetic for whole inches. */
export function inchToMil(inches: Length_inch | number): Length_mil {
  return ((inches as number) * MIL_PER_INCH) as Length_mil;
}

/** Convert mils to inches. Pure. */
export function milToInch(mils: Length_mil | number): Length_inch {
  return ((mils as number) / MIL_PER_INCH) as Length_inch;
}
