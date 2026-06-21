import type { AdcBinding, ClosedLoopSpec, CosimWindowSpec, InputBinding, PinBinding } from './types.js';
import type { DesignGraph } from '@protopulse/graph';

/**
 * Pure helpers behind the Co-sim panel's bindings editor: candidate pin
 * and net lists, add/remove with duplicate-pin refusal, and full window-
 * spec validation — open-loop AND closed-loop (inputs + ADC channels +
 * quantum). No DOM, no engine — this module is what the unit tests
 * exercise; CosimPanel.tsx is a thin form over it.
 */

/** ATmega328P GPIO ports B and D — the pins firmware most commonly
 *  toggles — offered even before the emulator has seen any events. */
export const DEFAULT_PIN_CANDIDATES: readonly string[] = [
  ...Array.from({ length: 8 }, (_, i) => `PB${String(i)}`),
  ...Array.from({ length: 8 }, (_, i) => `PD${String(i)}`),
];

/** Cap on windowS / stepS — beyond this the solver output alone would
 *  dwarf the pin-event ring and freeze the panel. */
export const MAX_COSIM_STEPS = 1_000_000;

/** Pins offered by the binding editor: everything the emulator has seen
 *  toggle, merged with the loaded core's default pin set, deduped and
 *  sorted. `defaults` is the selected core's `CORE_KINDS[kind].defaultPins`
 *  (AVR `PB`/`PD`, RP2040 `GP`, ESP32-S3 `IO`); it falls back to the AVR
 *  set so callers without a core (and older tests) keep working. */
export function candidatePins(
  seenPins: readonly string[],
  defaults: readonly string[] = DEFAULT_PIN_CANDIDATES,
): string[] {
  return [...new Set([...seenPins, ...defaults])].sort();
}

export interface NetOption {
  id: string;
  name: string;
}

/** The design's nets as select options, sorted by name. */
export function candidateNets(graph: Pick<DesignGraph, 'nets'>): NetOption[] {
  return [...graph.nets.values()]
    .map((n) => ({ id: n.id, name: n.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Validate one binding; null when fine, a user-renderable error otherwise. */
export function validateBinding(b: PinBinding): string | null {
  if (b.pin.trim() === '') return 'a binding needs a pin';
  if (b.netId.trim() === '') return `${b.pin}: a binding needs a net`;
  if (b.voltsHigh !== undefined && !Number.isFinite(b.voltsHigh)) {
    return `${b.pin}: Vhigh must be a finite voltage`;
  }
  if (b.voltsLow !== undefined && !Number.isFinite(b.voltsLow)) {
    return `${b.pin}: Vlow must be a finite voltage`;
  }
  if (b.voltsHigh !== undefined && b.voltsLow !== undefined && b.voltsHigh <= b.voltsLow) {
    return `${b.pin}: Vhigh must be above Vlow`;
  }
  if (b.routOhms !== undefined && (!Number.isFinite(b.routOhms) || b.routOhms <= 0)) {
    return `${b.pin}: Rout must be a positive resistance`;
  }
  if (b.riseS !== undefined && (!Number.isFinite(b.riseS) || b.riseS < 0)) {
    return `${b.pin}: rise time must be ≥ 0 seconds`;
  }
  return null;
}

export type AddBindingOutcome =
  | { ok: true; bindings: PinBinding[] }
  | { ok: false; error: string };

/** Append a binding; duplicate pins are refused (one driver per pin),
 *  and the input list is never mutated. */
export function addBinding(
  bindings: readonly PinBinding[],
  next: PinBinding,
): AddBindingOutcome {
  const invalid = validateBinding(next);
  if (invalid !== null) return { ok: false, error: invalid };
  if (bindings.some((b) => b.pin === next.pin)) {
    return { ok: false, error: `${next.pin} is already bound — remove it first` };
  }
  return { ok: true, bindings: [...bindings, next] };
}

/** Remove the binding for a pin; the input list is never mutated. */
export function removeBinding(bindings: readonly PinBinding[], pin: string): PinBinding[] {
  return bindings.filter((b) => b.pin !== pin);
}

/** Full window-spec validation; null when runnable. */
export function validateSpec(spec: CosimWindowSpec): string | null {
  if (spec.bindings.length === 0) return 'add at least one pin → net binding';
  const seen = new Set<string>();
  for (const b of spec.bindings) {
    const invalid = validateBinding(b);
    if (invalid !== null) return invalid;
    if (seen.has(b.pin)) return `${b.pin} is bound twice — one driver per pin`;
    seen.add(b.pin);
  }
  if (!Number.isFinite(spec.windowS) || spec.windowS <= 0) {
    return 'window must be a positive number of seconds';
  }
  if (!Number.isFinite(spec.stepS) || spec.stepS <= 0) {
    return 'step must be a positive number of seconds';
  }
  if (spec.stepS > spec.windowS) return 'step cannot be larger than the window';
  if (spec.windowS / spec.stepS > MAX_COSIM_STEPS) {
    return `window/step is over ${MAX_COSIM_STEPS.toLocaleString()} solver steps — shorten the window or coarsen the step`;
  }
  return null;
}

// ── Closed loop (FEEDBACK direction) ─────────────────────────────────

/** ATmega328P single-ended ADC mux channels — the default candidate
 *  set. The panel offers the loaded core's own list instead (see
 *  CORE_KINDS in ../emu/types.ts: the RP2040 has only ADC0–3). */
export const ADC_CHANNEL_CANDIDATES: readonly number[] = Array.from({ length: 8 }, (_, i) => i);

/** Cap on windowS / quantumS — every quantum is a FULL from-zero
 *  re-solve (no solver state continuity), so the loop's total solver
 *  work grows quadratically with this count. */
export const MAX_COSIM_QUANTA = 1_000;

/** Validate one digital-input feedback binding; null when fine. */
export function validateInputBinding(b: InputBinding): string | null {
  if (b.pin.trim() === '') return 'an input binding needs a pin';
  if (b.netId.trim() === '') return `${b.pin}: an input binding needs a net`;
  return null;
}

export type AddInputOutcome =
  | { ok: true; inputs: InputBinding[] }
  | { ok: false; error: string };

/** Append an input binding; duplicate pins refused, never mutates. */
export function addInputBinding(
  inputs: readonly InputBinding[],
  next: InputBinding,
): AddInputOutcome {
  const invalid = validateInputBinding(next);
  if (invalid !== null) return { ok: false, error: invalid };
  if (inputs.some((i) => i.pin === next.pin)) {
    return { ok: false, error: `${next.pin} is already an input — remove it first` };
  }
  return { ok: true, inputs: [...inputs, next] };
}

/** Remove the input binding for a pin; never mutates. */
export function removeInputBinding(
  inputs: readonly InputBinding[],
  pin: string,
): InputBinding[] {
  return inputs.filter((i) => i.pin !== pin);
}

/** Validate one ADC feedback binding; null when fine. */
export function validateAdcBinding(b: AdcBinding): string | null {
  if (!Number.isInteger(b.channel) || b.channel < 0 || b.channel > 19) {
    return `ADC channel must be an integer 0–19 (got ${String(b.channel)})`;
  }
  if (b.netId.trim() === '') return `ADC ${String(b.channel)}: a binding needs a net`;
  return null;
}

export type AddAdcOutcome = { ok: true; adc: AdcBinding[] } | { ok: false; error: string };

/** Append an ADC binding; duplicate channels refused, never mutates. */
export function addAdcBinding(adc: readonly AdcBinding[], next: AdcBinding): AddAdcOutcome {
  const invalid = validateAdcBinding(next);
  if (invalid !== null) return { ok: false, error: invalid };
  if (adc.some((a) => a.channel === next.channel)) {
    return {
      ok: false,
      error: `ADC channel ${String(next.channel)} is already bound — remove it first`,
    };
  }
  return { ok: true, adc: [...adc, next] };
}

/** Remove the ADC binding for a channel; never mutates. */
export function removeAdcBinding(adc: readonly AdcBinding[], channel: number): AdcBinding[] {
  return adc.filter((a) => a.channel !== channel);
}

/** Full closed-loop spec validation; null when runnable. */
export function validateClosedLoopSpec(spec: ClosedLoopSpec): string | null {
  const base = validateSpec(spec);
  if (base !== null) return base;
  if (spec.quantumS !== undefined) {
    if (!Number.isFinite(spec.quantumS) || spec.quantumS <= 0) {
      return 'quantum must be a positive number of seconds';
    }
    if (spec.quantumS < spec.stepS) return 'quantum cannot be finer than the solver step';
    if (spec.quantumS > spec.windowS) return 'quantum cannot be larger than the window';
    if (spec.windowS / spec.quantumS > MAX_COSIM_QUANTA) {
      return `window/quantum is over ${MAX_COSIM_QUANTA.toLocaleString()} re-solves — every quantum re-runs the transient from zero, so this would crawl`;
    }
  }
  const inputPins = new Set<string>();
  for (const input of spec.inputs ?? []) {
    const invalid = validateInputBinding(input);
    if (invalid !== null) return invalid;
    if (inputPins.has(input.pin)) return `${input.pin} is an input twice — one comparator per pin`;
    inputPins.add(input.pin);
    if (spec.bindings.some((b) => b.pin === input.pin)) {
      return `${input.pin} is both an output binding and an input — pick one direction`;
    }
  }
  const channels = new Set<number>();
  for (const adc of spec.adc ?? []) {
    const invalid = validateAdcBinding(adc);
    if (invalid !== null) return invalid;
    if (channels.has(adc.channel)) {
      return `ADC channel ${String(adc.channel)} is bound twice — one net per channel`;
    }
    channels.add(adc.channel);
  }
  return null;
}
