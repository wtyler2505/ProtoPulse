import { describe, expect, it } from 'vitest';

import {
  addBinding,
  candidateNets,
  candidatePins,
  DEFAULT_PIN_CANDIDATES,
  MAX_COSIM_STEPS,
  removeBinding,
  validateBinding,
  validateSpec,
} from './bindings.js';

import type { CosimWindowSpec, PinBinding } from './types.js';
import type { DesignGraph, Net } from '@protopulse/graph';

const bind = (pin: string, extra: Partial<PinBinding> = {}): PinBinding => ({
  pin,
  netId: 'net-1',
  ...extra,
});

/** The default spec the panel ships with: 500 µs window, 1 µs step. */
const spec = (over: Partial<CosimWindowSpec> = {}): CosimWindowSpec => ({
  windowS: 500e-6,
  stepS: 1e-6,
  bindings: [bind('PB5')],
  ...over,
});

const graphWithNets = (...names: string[]): Pick<DesignGraph, 'nets'> => ({
  nets: new Map<string, Net>(
    names.map((name, i) => [
      `n${String(i)}`,
      { id: `n${String(i)}`, name, ports: [], netClass: 'default' },
    ]),
  ),
});

describe('candidatePins', () => {
  it('offers the PB0–PB7 / PD0–PD7 defaults when nothing has toggled yet', () => {
    const pins = candidatePins([]);
    expect(pins).toHaveLength(16);
    expect(pins).toEqual([...DEFAULT_PIN_CANDIDATES].sort());
    expect(pins).toContain('PB0');
    expect(pins).toContain('PD7');
  });

  it('merges pins the emulator has seen, deduped and sorted', () => {
    const pins = candidatePins(['PC0', 'PB5']);
    expect(pins).toHaveLength(17); // PB5 already a default; PC0 is new
    expect(pins).toContain('PC0');
    expect([...pins].sort()).toEqual(pins);
  });
});

describe('candidateNets', () => {
  it('maps nets to {id, name} options sorted by name', () => {
    const nets = candidateNets(graphWithNets('VOUT', 'GND', 'N$417'));
    expect(nets.map((n) => n.name)).toEqual(['GND', 'N$417', 'VOUT']);
    expect(nets[0]).toEqual({ id: 'n1', name: 'GND' });
  });
});

describe('addBinding / removeBinding', () => {
  it('appends without mutating the input list', () => {
    const before: PinBinding[] = [bind('PB5')];
    const out = addBinding(before, bind('PD3', { voltsHigh: 5, routOhms: 100 }));
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.bindings.map((b) => b.pin)).toEqual(['PB5', 'PD3']);
    expect(before).toHaveLength(1);
  });

  it('refuses a duplicate pin — one driver per pin', () => {
    const out = addBinding([bind('PB5')], bind('PB5', { netId: 'net-2' }));
    expect(out).toEqual({ ok: false, error: 'PB5 is already bound — remove it first' });
  });

  it('refuses invalid advanced values via validateBinding', () => {
    expect(validateBinding(bind('PB5', { routOhms: 0 }))).toMatch(/Rout/);
    expect(validateBinding(bind('PB5', { routOhms: -10 }))).toMatch(/Rout/);
    expect(validateBinding(bind('PB5', { riseS: -1e-9 }))).toMatch(/rise/);
    expect(validateBinding(bind('PB5', { voltsHigh: NaN }))).toMatch(/Vhigh/);
    expect(validateBinding(bind('PB5', { voltsHigh: 1, voltsLow: 3.3 }))).toMatch(/above/);
    expect(validateBinding(bind('', {}))).toMatch(/pin/);
    expect(validateBinding(bind('PB5', { netId: '' }))).toMatch(/net/);
    expect(validateBinding(bind('PB5', { voltsHigh: 5, voltsLow: 0, routOhms: 47, riseS: 5e-9 }))).toBeNull();
  });

  it('removeBinding drops only the named pin, without mutating', () => {
    const before = [bind('PB5'), bind('PD3')];
    expect(removeBinding(before, 'PB5').map((b) => b.pin)).toEqual(['PD3']);
    expect(removeBinding(before, 'PC9')).toHaveLength(2);
    expect(before).toHaveLength(2);
  });
});

describe('validateSpec', () => {
  it('accepts the default 500 µs / 1 µs window', () => {
    expect(validateSpec(spec())).toBeNull();
  });

  it('requires at least one binding', () => {
    expect(validateSpec(spec({ bindings: [] }))).toMatch(/at least one/);
  });

  it('rejects duplicate pins smuggled into the list', () => {
    expect(validateSpec(spec({ bindings: [bind('PB5'), bind('PB5')] }))).toMatch(/bound twice/);
  });

  it('rejects non-positive or non-finite window and step', () => {
    expect(validateSpec(spec({ windowS: 0 }))).toMatch(/window/);
    expect(validateSpec(spec({ windowS: NaN }))).toMatch(/window/);
    expect(validateSpec(spec({ stepS: 0 }))).toMatch(/step/);
    expect(validateSpec(spec({ stepS: -1e-6 }))).toMatch(/step/);
  });

  it('rejects a step larger than the window', () => {
    expect(validateSpec(spec({ windowS: 1e-6, stepS: 2e-6 }))).toMatch(/larger than the window/);
  });

  it('caps the solver step count', () => {
    expect(validateSpec(spec({ windowS: 2, stepS: 1e-9 }))).toMatch(/solver steps/);
    // Exactly at the cap is fine.
    expect(validateSpec(spec({ windowS: MAX_COSIM_STEPS * 1e-9, stepS: 1e-9 }))).toBeNull();
  });

  it('surfaces a bad binding with the pin named', () => {
    expect(validateSpec(spec({ bindings: [bind('PD2', { routOhms: 0 })] }))).toMatch(/PD2/);
  });
});
