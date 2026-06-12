/**
 * One shared value parser — Vol II §A.8. Used by BOM, sim, and the AI.
 * SI suffixes, the 4k7 infix convention, unit inference from component
 * class. `raw` is always preserved — never reformat what a human typed.
 */
export type Unit = 'ohm' | 'farad' | 'henry' | 'volt' | 'amp' | 'hertz' | 'none';

export type ComponentClass =
  | 'resistor'
  | 'capacitor'
  | 'inductor'
  | 'voltage'
  | 'current'
  | 'frequency'
  | 'other';

export interface ParsedValue {
  value: number;
  unit: Unit;
  raw: string;
}

export interface ParseError { error: string; raw: string }

const MULTIPLIERS: Record<string, number> = {
  p: 1e-12,
  n: 1e-9,
  u: 1e-6,
  µ: 1e-6,
  m: 1e-3,
  k: 1e3,
  K: 1e3,
  M: 1e6,
  G: 1e9,
};

const UNIT_PATTERNS: [RegExp, Unit][] = [
  [/^(Ω|ohms?|R)$/i, 'ohm'],
  [/^F$/i, 'farad'],
  [/^H$/i, 'henry'],
  [/^V$/i, 'volt'],
  [/^A$/i, 'amp'],
  [/^Hz$/i, 'hertz'],
];

const CLASS_UNIT: Partial<Record<ComponentClass, Unit>> = {
  resistor: 'ohm',
  capacitor: 'farad',
  inductor: 'henry',
  voltage: 'volt',
  current: 'amp',
  frequency: 'hertz',
};

/** Component classes where a bare number has an unambiguous unit. */
const BARE_NUMBER_OK: ReadonlySet<ComponentClass> = new Set(['resistor', 'voltage']);

function matchUnit(token: string): Unit | undefined {
  for (const [re, unit] of UNIT_PATTERNS) {
    if (re.test(token)) return unit;
  }
  return undefined;
}

export function parseValue(
  raw: string,
  componentClass: ComponentClass = 'other',
): ParsedValue | ParseError {
  const text = raw.trim();
  if (text.length === 0) return { error: 'empty value', raw };

  // Infix convention: 4k7 = 4.7k, 4R7 = 4.7Ω, 1M2 = 1.2M, 2n2 = 2.2n.
  const infix = /^(\d+)([pnuµmkKMGR])(\d+)$/.exec(text);
  if (infix) {
    const [, whole, sep, frac] = infix;
    const num = Number(`${String(whole)}.${String(frac)}`);
    if (sep === 'R') {
      return { value: num, unit: 'ohm', raw };
    }
    const mult = MULTIPLIERS[sep!];
    if (mult === undefined) return { error: `unknown multiplier ${String(sep)}`, raw };
    // Infix values are unambiguous: the multiplier implies the class unit
    // (2n2 on a capacitor is 2.2nF, never "bare 2.2").
    const unit = CLASS_UNIT[componentClass] ?? 'none';
    return { value: num * mult, unit, raw };
  }

  // General form: number + optional multiplier + optional unit token.
  const general = /^(-?\d+(?:\.\d+)?)\s*([pnuµmkKMG])?\s*([a-zA-ZΩµ]+)?$/.exec(text);
  if (!general) return { error: `cannot parse value "${text}"`, raw };
  const [, numText, multToken, unitToken] = general;
  const num = Number(numText);
  if (!Number.isFinite(num)) return { error: `bad number "${String(numText)}"`, raw };

  // Glued forms like "100nF" are already split by the regex: the
  // multiplier class is captured before the unit token.
  let mult = 1;
  const unitText = unitToken;
  if (multToken !== undefined) {
    const m = MULTIPLIERS[multToken];
    if (m === undefined) return { error: `unknown multiplier ${multToken}`, raw };
    mult = m;
  }

  let unit: Unit | undefined = unitText !== undefined ? matchUnit(unitText) : undefined;
  if (unitText !== undefined && unit === undefined) {
    return { error: `unknown unit "${unitText}"`, raw };
  }
  if (unit === undefined) {
    const inferred = inferUnit(undefined, componentClass);
    if (typeof inferred !== 'string') return { ...inferred, raw };
    unit = inferred;
  }
  // Unit sanity: a farad value on a resistor is a typo worth flagging.
  const expected = CLASS_UNIT[componentClass];
  if (expected !== undefined && unit !== expected && unit !== 'none') {
    return { error: `unit ${unit} does not match component class ${componentClass}`, raw };
  }
  return { value: num * mult, unit, raw };
}

function inferUnit(
  explicit: Unit | undefined,
  componentClass: ComponentClass,
): Unit | { error: string } {
  if (explicit) return explicit;
  const classUnit = CLASS_UNIT[componentClass];
  if (classUnit !== undefined && BARE_NUMBER_OK.has(componentClass)) return classUnit;
  if (componentClass === 'other') return 'none';
  // A bare "10" on a capacitor is ambiguous (10pF? 10nF? 10µF?) — ask.
  return { error: `bare number is ambiguous for ${componentClass}; add a unit` };
}
