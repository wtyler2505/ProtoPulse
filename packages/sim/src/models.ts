import { parseValue } from '@protopulse/graph';

import { spiceNum } from './analyses.js';

import type { Component, ComponentClass } from '@protopulse/graph';
import type { Part } from '@protopulse/parts';

/**
 * Model tiers — the honesty system (Vol II §D.4).
 *
 * Every simulated component declares what its model really is:
 *   - 'spice'      — vendor/datasheet-grade SPICE parameters
 *   - 'behavioral' — captures the dominant behavior, knowingly approximate
 *   - 'stub'       — no model at all; the component is excluded and the
 *                    manifest says so. Simulations never lie about what
 *                    they are.
 */
export type ModelTier = 'spice' | 'behavioral' | 'stub';

export interface FidelityEntry {
  ref: string;
  partId: string;
  tier: ModelTier;
  note?: string;
}

/** Context handed to an emitter for one component. */
export interface EmitCtx {
  component: Component;
  part: Part;
  /** SPICE node name for a pin key (dangling pins pre-assigned nc_*). */
  node: (pinKey: string) => string;
}

/** What one component contributes to the deck. */
export interface Emission {
  /** Element lines (may be empty for stubs/aliases). */
  lines: string[];
  /** `.model` cards required by the element lines (deduped later). */
  models: string[];
  entry: Omit<FidelityEntry, 'ref' | 'partId'>;
}

/**
 * SPICE element name: the ref, prefixed with the required element letter
 * only when the ref does not already start with it ("R1" stays R1;
 * battery "BT1" becomes VBT1; pushbutton "SW1" becomes RSW1).
 */
export function elementName(letter: string, ref: string): string {
  const clean = ref.replace(/[^A-Za-z0-9_]/g, '_');
  return clean.toUpperCase().startsWith(letter.toUpperCase()) ? clean : `${letter}${clean}`;
}

interface NumericValue {
  value: number;
  note?: string;
}

/** Parse a component value; fall back to a default with a manifest note. */
function numericValue(
  component: Component,
  cls: ComponentClass,
  fallback: number,
  fallbackLabel: string,
): NumericValue {
  const raw = component.value;
  if (raw === undefined || raw.trim() === '') {
    return { value: fallback, note: `no value — defaulted to ${fallbackLabel}` };
  }
  const parsed = parseValue(raw, cls);
  if ('error' in parsed) {
    return { value: fallback, note: `value "${raw}" unparseable — defaulted to ${fallbackLabel}` };
  }
  return { value: parsed.value };
}

type Emitter = (ctx: EmitCtx) => Emission;

const emitResistor: Emitter = ({ component, node }) => {
  const v = numericValue(component, 'resistor', 1000, '1k');
  return {
    lines: [`${elementName('R', component.ref)} ${node('1')} ${node('2')} ${spiceNum(v.value)}`],
    models: [],
    entry: { tier: 'spice', ...(v.note !== undefined ? { note: v.note } : {}) },
  };
};

const emitCapacitor: Emitter = ({ component, node }) => {
  const v = numericValue(component, 'capacitor', 100e-9, '100nF');
  return {
    lines: [`${elementName('C', component.ref)} ${node('1')} ${node('2')} ${spiceNum(v.value)}`],
    models: [],
    entry: { tier: 'spice', ...(v.note !== undefined ? { note: v.note } : {}) },
  };
};

const emitLed: Emitter = ({ component, node }) => {
  const name = elementName('D', component.ref);
  const model = `DLED_${name}`;
  return {
    lines: [`${name} ${node('A')} ${node('K')} ${model}`],
    models: [`.model ${model} D(IS=1e-20 N=2.0)`],
    entry: { tier: 'behavioral', note: 'behavioral two-parameter diode, no color binning' },
  };
};

const emit1n4148: Emitter = ({ component, node }) => ({
  lines: [`${elementName('D', component.ref)} ${node('A')} ${node('K')} D1N4148`],
  models: ['.model D1N4148 D(IS=4.352e-9 N=1.906 RS=0.6458 CJO=7.048e-13 TT=3.48e-9 BV=100)'],
  entry: { tier: 'spice' },
});

const emit1n5819: Emitter = ({ component, node }) => ({
  lines: [`${elementName('D', component.ref)} ${node('A')} ${node('K')} D1N5819`],
  models: ['.model D1N5819 D(IS=3.1e-6 N=1.0 RS=0.06 CJO=110e-12 TT=0 BV=40)'],
  entry: { tier: 'behavioral', note: 'approximate datasheet-class Schottky parameters' },
});

const emitTvs: Emitter = ({ component, node }) => {
  const bv = numericValue(component, 'voltage', 24, '24V');
  const name = elementName('D', component.ref);
  const model = `DTVS_${name}`;
  const baseNote = 'breakdown clamp only — no transient energy model';
  return {
    lines: [`${name} ${node('A')} ${node('K')} ${model}`],
    models: [`.model ${model} D(IS=1e-12 N=1.0 BV=${spiceNum(bv.value)} IBV=1e-3)`],
    entry: {
      tier: 'behavioral',
      note: bv.note !== undefined ? `${baseNote}; ${bv.note}` : baseNote,
    },
  };
};

const emitBat54s: Emitter = ({ component, node }) => {
  // Pin map (verified, Vishay 86410): 1 = anode of D1, 3 = common
  // midpoint (cathode of D1 + anode of D2), 2 = cathode of D2.
  const name = elementName('D', component.ref);
  return {
    lines: [
      `${name}A ${node('1')} ${node('3')} DBAT54`,
      `${name}B ${node('3')} ${node('2')} DBAT54`,
    ],
    models: ['.model DBAT54 D(IS=1e-7 N=1.08 RS=0.8)'],
    entry: { tier: 'behavioral', note: 'dual series Schottky as two identical diodes' },
  };
};

const emit2n3904: Emitter = ({ component, node }) => ({
  // SPICE BJT node order: collector, base, emitter.
  lines: [`${elementName('Q', component.ref)} ${node('C')} ${node('B')} ${node('E')} Q2N3904`],
  models: [
    '.model Q2N3904 NPN(IS=6.734e-15 BF=416.4 VAF=74.03 IKF=66.78e-3 RB=10 RC=1 CJE=4.493e-12 CJC=3.638e-12 TF=301.2e-12)',
  ],
  entry: { tier: 'spice' },
});

const emitNmosAo3400: Emitter = ({ component, node }) => {
  // SPICE MOSFET node order: drain, gate, source, bulk (tied to source).
  const s = node('S');
  return {
    lines: [`${elementName('M', component.ref)} ${node('D')} ${node('G')} ${s} ${s} NMOS_AO3400`],
    models: ['.model NMOS_AO3400 NMOS(VTO=1.05 KP=20 LAMBDA=0.01)'],
    entry: { tier: 'behavioral', note: 'first-order level-1; no gate charge' },
  };
};

/**
 * Optional small-signal AC magnitude for a voltage source, read from the
 * component's `fields.ac` ('1' → ` AC 1` appended to the V card). This
 * is what lets graph-driven `.ac` and `.noise` analyses run — ngspice
 * needs an AC value on the input source. An absent or blank field emits
 * an empty suffix, keeping the element line byte-identical to a deck
 * without the field; an unparseable field is skipped with an honest
 * manifest note rather than guessed at.
 */
function acMagnitude(component: Component): { suffix: string; note?: string } {
  const raw = component.fields.ac;
  if (raw === undefined || raw.trim() === '') return { suffix: '' };
  const mag = Number(raw);
  if (!Number.isFinite(mag) || mag < 0) {
    return { suffix: '', note: `fields.ac "${raw}" unparseable — AC magnitude not emitted` };
  }
  return {
    suffix: ` AC ${spiceNum(mag)}`,
    note: `AC small-signal magnitude ${spiceNum(mag)} (fields.ac)`,
  };
}

/** Join the honesty notes that apply ('base; value-fallback; ac'). */
function joinNotes(base: string, ...extra: (string | undefined)[]): string {
  return [base, ...extra].filter((n): n is string => n !== undefined).join('; ');
}

const emitBattery: Emitter = ({ component, node }) => {
  const v = numericValue(component, 'voltage', 9, '9V');
  const ac = acMagnitude(component);
  return {
    lines: [
      `${elementName('V', component.ref)} ${node('+')} ${node('-')} DC ${spiceNum(v.value)}${ac.suffix}`,
    ],
    models: [],
    entry: {
      tier: 'behavioral',
      note: joinNotes('ideal DC source (no internal resistance)', v.note, ac.note),
    },
  };
};

const emitPwrVcc: Emitter = ({ component, node }) => {
  const v = numericValue(component, 'voltage', 5, '5V');
  const ac = acMagnitude(component);
  return {
    lines: [`${elementName('V', component.ref)} ${node('1')} 0 DC ${spiceNum(v.value)}${ac.suffix}`],
    models: [],
    entry: {
      tier: 'behavioral',
      note: joinNotes('ideal rail', v.note, ac.note),
    },
  };
};

const emitPwrGnd: Emitter = () => ({
  // The net wired to this symbol IS ground; the netlist generator
  // aliases it to node 0. No element is emitted.
  lines: [],
  models: [],
  entry: { tier: 'behavioral', note: 'ground reference — net aliased to node 0' },
});

/**
 * Simplified NE555 behavioral macromodel, validated to converge and
 * oscillate in the eecircuit-engine (ngspice WASM) build:
 *   - 5k/5k/5k CONT divider sets the 2/3 and 1/3 Vcc thresholds
 *   - ideal comparators as tanh B-sources (0..1 logic levels)
 *   - regenerative SR latch (steep hold sigmoid + RC state memory);
 *     a DC-high PULSE "kick" releases 1µs into the transient so the
 *     latch has a consistent DC operating point instead of a
 *     metastable one (an astable has no true DC solution)
 *   - hysteretic S-element discharge switch (on below qeff≈0.2, off
 *     above ≈0.8) — a smooth switch creates a stable analog
 *     equilibrium at the threshold and kills the oscillation
 *   - approximate output stage: ~Vcc-1.2 high through 10Ω, ~50mV low
 * Not modeled: supply current, comparator offsets/bias currents,
 * propagation delays, temperature behavior.
 */
const NE555_SUBCKT = [
  '.subckt NE555_PP gnd trig out reset cont thres disch vcc',
  '* control divider: 2/3 and 1/3 Vcc thresholds',
  'RD1 vcc cont 5k',
  'RD2 cont thlo 5k',
  'RD3 thlo gnd 5k',
  '* startup kick: high at DC, releases 1us into the transient',
  'VKICK kick 0 PULSE(1 0 1u 1u 1u 100 200)',
  '* ideal comparators (0..1 logic levels)',
  'BCMPS sset 0 V=0.5*(1+tanh((v(thlo,gnd)-v(trig,gnd))*50))',
  'BCMPR srst 0 V=0.5*(1+tanh((v(thres,gnd)-v(cont,gnd))*50))',
  'BRSTOK rstok 0 V=0.5*(1+tanh((v(reset,gnd)-0.9)*20))',
  '* regenerative SR latch: set dominant, steep hold sigmoid, RC memory',
  'BSEFF seff 0 V=1-(1-v(sset))*(1-v(kick))',
  'BQNEXT qnext 0 V=v(seff)+(1-v(seff))*(1-v(srst))*0.5*(1+tanh((v(q)-0.5)*30))',
  'RQ qnext q 1k',
  'CQ q 0 10n',
  'BQEFF qeff 0 V=v(q)*v(rstok)',
  '* output stage: ~Vcc-1.2 high through 10 ohm, ~50mV low',
  'BOUT outi gnd V=0.5*(1+tanh((v(qeff)-0.5)*20))*(v(vcc,gnd)-1.2)+0.05',
  'ROUT outi out 10',
  '* hysteretic discharge switch: on when qeff < 0.2, off above 0.8',
  'BQINV qinv 0 V=1-v(qeff)',
  'SDIS disch gnd qinv 0 SWDIS_PP OFF',
  '.model SWDIS_PP SW(VT=0.5 VH=0.3 RON=20 ROFF=1G)',
  '.ends NE555_PP',
].join('\n');

const emitNe555: Emitter = ({ component, node }) => ({
  // Subcircuit port order mirrors the DIP-8 pinout: GND TRIG OUT RESET
  // CONT THRES DISCH VCC (pin keys 1..8).
  lines: [
    `${elementName('X', component.ref)} ${node('1')} ${node('2')} ${node('3')} ${node('4')} ${node('5')} ${node('6')} ${node('7')} ${node('8')} NE555_PP`,
  ],
  models: [NE555_SUBCKT],
  entry: {
    tier: 'behavioral',
    note: 'behavioral macromodel — ideal comparators, simplified SR latch, approximate output stage; no supply-current modeling',
  },
});

const emitPushbutton: Emitter = ({ component, node }) => ({
  lines: [`${elementName('R', component.ref)} ${node('1')} ${node('2')} 0.001`],
  models: [],
  entry: { tier: 'behavioral', note: 'modeled closed (pressed)' },
});

const stubEmission: Emission = {
  lines: [],
  models: [],
  entry: { tier: 'stub', note: 'no model — excluded from simulation' },
};

const EMITTERS_BY_PART_ID: ReadonlyMap<string, Emitter> = new Map<string, Emitter>([
  ['core:resistor', emitResistor],
  ['core:capacitor', emitCapacitor],
  ['core:capacitor-electrolytic', emitCapacitor],
  ['core:led', emitLed],
  ['core:1n4148', emit1n4148],
  ['core:1n5819', emit1n5819],
  ['core:tvs-unidirectional', emitTvs],
  ['core:bat54s', emitBat54s],
  ['core:2n3904', emit2n3904],
  ['core:nmos-ao3400', emitNmosAo3400],
  ['core:ne555', emitNe555],
  ['core:battery', emitBattery],
  ['core:pwr-vcc', emitPwrVcc],
  ['core:pwr-gnd', emitPwrGnd],
  ['core:pushbutton', emitPushbutton],
]);

/** Generic class fallbacks for parts outside the seed library. */
const EMITTERS_BY_CLASS: Partial<Record<Part['class'], Emitter>> = {
  resistor: emitResistor,
  capacitor: emitCapacitor,
  led: emitLed,
  battery: emitBattery,
};

/** True when the part's net should be aliased to SPICE ground (node 0). */
export function isGroundPart(part: Part): boolean {
  return part.id === 'core:pwr-gnd';
}

/**
 * Emit the SPICE contribution for one (component, part) pair.
 * Unknown parts produce a stub: no element, an honest manifest note.
 * DNP is handled by the caller (excluded before emission).
 */
export function emitComponent(ctx: EmitCtx): Emission {
  const emitter = EMITTERS_BY_PART_ID.get(ctx.part.id) ?? EMITTERS_BY_CLASS[ctx.part.class];
  if (!emitter) return stubEmission;
  return emitter(ctx);
}
