import type { CosimWindowSpec, PinBinding } from './types.js';
import type { DesignGraph } from '@protopulse/graph';

/**
 * Pure helpers behind the Co-sim panel's bindings editor: candidate pin
 * and net lists, add/remove with duplicate-pin refusal, and full window-
 * spec validation. No DOM, no engine — this module is what the unit
 * tests exercise; CosimPanel.tsx is a thin form over it.
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
 *  toggle, merged with the common defaults, deduped and sorted. */
export function candidatePins(seenPins: readonly string[]): string[] {
  return [...new Set([...seenPins, ...DEFAULT_PIN_CANDIDATES])].sort();
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
