/**
 * What-if parameter sweep engine (BL-0130).
 *
 * Extracts sweepable parameters (R, C, L, V, I values) from circuit
 * components, provides min/max range computation, and a runner that
 * evaluates a circuit with arbitrary parameter overrides.
 */

import { parseSINumber } from '@shared/design-variables';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single sweepable parameter extracted from a circuit component. */
export interface WhatIfParam {
  /** Unique identifier — typically the referenceDesignator (e.g. "R1"). */
  id: string;
  /** Human-readable label (e.g. "R1 Resistance"). */
  name: string;
  /** Original (nominal) value in base SI units. */
  nominal: number;
  /** Lower sweep bound (default: 0.1× nominal). */
  min: number;
  /** Upper sweep bound (default: 10× nominal). */
  max: number;
  /** SI unit symbol (e.g. "Ω", "F", "H", "V", "A"). */
  unit: string;
  /** Current slider value — starts at nominal. */
  currentValue: number;
}

/** Result of a single what-if evaluation. */
export interface WhatIfResult {
  /** Map from param id → value used for this evaluation. */
  paramValues: Map<string, number>;
  /** Scalar output produced by the evaluator. */
  output: number;
}

/**
 * Minimal component shape consumed by the extractor.
 * Matches the SPICE generator's `SpiceComponent` interface fields we need.
 */
export interface WhatIfComponent {
  referenceDesignator: string;
  properties: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// SI formatting (re-uses the SI prefix table for display)
// ---------------------------------------------------------------------------

const SI_DISPLAY_PREFIXES: ReadonlyArray<{ factor: number; prefix: string }> = [
  { factor: 1e12, prefix: 'T' },
  { factor: 1e9, prefix: 'G' },
  { factor: 1e6, prefix: 'M' },
  { factor: 1e3, prefix: 'k' },
  { factor: 1, prefix: '' },
  { factor: 1e-3, prefix: 'm' },
  { factor: 1e-6, prefix: 'µ' },
  { factor: 1e-9, prefix: 'n' },
  { factor: 1e-12, prefix: 'p' },
];

/**
 * Format a value with its SI prefix and unit.
 *
 * @example formatSIValue(4700, 'Ω') → "4.7 kΩ"
 * @example formatSIValue(0.0000001, 'F') → "100 nF"
 */
export function formatSIValue(value: number, unit: string, precision = 3): string {
  if (value === 0) {
    return `0 ${unit}`;
  }
  if (!Number.isFinite(value)) {
    return `${String(value)} ${unit}`;
  }

  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  for (const { factor, prefix } of SI_DISPLAY_PREFIXES) {
    if (absValue >= factor * 0.9999) {
      const scaled = absValue / factor;
      const formatted = Number(scaled.toPrecision(precision)).toString();
      return `${sign}${formatted} ${prefix}${unit}`;
    }
  }

  // Smaller than pico — scientific notation
  return `${value.toExponential(precision - 1)} ${unit}`;
}

// ---------------------------------------------------------------------------
// Component type → unit mapping
// ---------------------------------------------------------------------------

interface ComponentKind {
  /** Property keys to search for the value, in priority order. */
  valueKeys: string[];
  /** Default value string if none found. */
  defaultValue: string;
  /** Unit symbol for display. */
  unit: string;
  /** Human-readable quantity name. */
  quantityName: string;
}

const COMPONENT_KINDS: ReadonlyMap<string, ComponentKind> = new Map([
  ['R', { valueKeys: ['value', 'resistance'], defaultValue: '1k', unit: '\u03A9', quantityName: 'Resistance' }],
  ['C', { valueKeys: ['value', 'capacitance'], defaultValue: '100n', unit: 'F', quantityName: 'Capacitance' }],
  ['L', { valueKeys: ['value', 'inductance'], defaultValue: '10u', unit: 'H', quantityName: 'Inductance' }],
  ['V', { valueKeys: ['value', 'voltage'], defaultValue: '5', unit: 'V', quantityName: 'Voltage' }],
  ['I', { valueKeys: ['value', 'current'], defaultValue: '1m', unit: 'A', quantityName: 'Current' }],
]);

/**
 * Determine the component kind from a reference designator prefix.
 * Returns undefined for non-sweepable component types (D, Q, M, U, etc.).
 */
function getComponentKind(refDes: string): { prefix: string; kind: ComponentKind } | undefined {
  const prefix = refDes.charAt(0).toUpperCase();
  const kind = COMPONENT_KINDS.get(prefix);
  if (kind === undefined) {
    return undefined;
  }
  return { prefix, kind };
}

/**
 * Extract the numeric value from a component's properties.
 * Searches the priority key list and parses SI prefixes.
 */
function extractValue(properties: Record<string, unknown>, kind: ComponentKind): number {
  for (const key of kind.valueKeys) {
    const raw = properties[key];
    if (raw !== undefined && raw !== null && raw !== '') {
      const str = String(raw);
      const parsed = parseSINumber(str);
      if (!Number.isNaN(parsed) && parsed > 0) {
        return parsed;
      }
    }
  }
  return parseSINumber(kind.defaultValue);
}

// ---------------------------------------------------------------------------
// Parameter extraction
// ---------------------------------------------------------------------------

/**
 * Compute sweep range for a nominal value.
 * Default: 0.1× to 10× (one decade each direction).
 */
function computeRange(nominal: number, factor = 10): { min: number; max: number } {
  return {
    min: nominal / factor,
    max: nominal * factor,
  };
}

/**
 * Extract all sweepable parameters from a list of circuit components.
 *
 * Sweepable types: Resistors (R), Capacitors (C), Inductors (L),
 * Voltage sources (V), Current sources (I).
 *
 * @param components - Array of circuit components with referenceDesignator + properties
 * @returns Sorted array of WhatIfParam (sorted by reference designator)
 */
export function extractSweepableParams(components: WhatIfComponent[]): WhatIfParam[] {
  const params: WhatIfParam[] = [];

  for (const comp of components) {
    const result = getComponentKind(comp.referenceDesignator);
    if (result === undefined) {
      continue;
    }

    const { kind } = result;
    const nominal = extractValue(comp.properties as Record<string, unknown>, kind);

    if (nominal <= 0 || !Number.isFinite(nominal)) {
      continue;
    }

    const { min, max } = computeRange(nominal);

    params.push({
      id: comp.referenceDesignator,
      name: `${comp.referenceDesignator} ${kind.quantityName}`,
      nominal,
      min,
      max,
      unit: kind.unit,
      currentValue: nominal,
    });
  }

  // Sort by reference designator (R1 < R2 < C1 < V1, etc.)
  params.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));

  return params;
}

// ---------------------------------------------------------------------------
// What-if evaluation runner
// ---------------------------------------------------------------------------

/**
 * An evaluator function that receives a map of parameter id → current value
 * and returns a scalar output (voltage, current, power, etc.).
 */
export type WhatIfEvaluator = (paramValues: Map<string, number>) => number | Promise<number>;

/**
 * Run a what-if evaluation with the current parameter values.
 *
 * @param params - Array of WhatIfParam with currentValue set
 * @param evaluator - Function that computes a scalar output from parameter values
 * @returns WhatIfResult with the parameter snapshot and computed output
 */
export async function runWhatIf(
  params: ReadonlyArray<WhatIfParam>,
  evaluator: WhatIfEvaluator,
): Promise<WhatIfResult> {
  const paramValues = new Map<string, number>();
  for (const p of params) {
    paramValues.set(p.id, p.currentValue);
  }

  const output = await evaluator(paramValues);

  return { paramValues, output };
}

/**
 * Compute an appropriate slider step size based on the parameter range.
 * Returns a step that gives roughly 200-500 discrete positions.
 */
export function computeSliderStep(min: number, max: number): number {
  const range = max - min;
  if (range <= 0) {
    return 1;
  }

  // Target ~400 steps across the range
  const rawStep = range / 400;

  // Round to a nice number (1, 2, 5 × power of 10)
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const normalized = rawStep / magnitude;

  if (normalized <= 1.5) {
    return magnitude;
  }
  if (normalized <= 3.5) {
    return 2 * magnitude;
  }
  if (normalized <= 7.5) {
    return 5 * magnitude;
  }
  return 10 * magnitude;
}
