import { materialize } from '@protopulse/graph';
import { seedPartDb } from '@protopulse/parts';
import { describe, expect, it } from 'vitest';

import { comparatorStep, interpolateAt, runCosimClosedLoop } from './quantum.js';
import { COMPARATOR_HYST_V, DEFAULT_VIH_V, DEFAULT_VIL_V } from './types.js';

import type { ClosedLoopSpec } from './types.js';
import type { DigitalLevel, McuCore } from '@protopulse/emu';
import type { DesignGraph, OpBody } from '@protopulse/graph';

/**
 * The closed loop's pure math (comparator state machine, sampler
 * interpolation) and its validation wall — everything here fails or
 * passes WITHOUT booting the SPICE engine or stepping a core. The
 * engine-driven loop tests live in quantum.loop.test.ts.
 */

const parts = seedPartDb();

/** RC low-pass: R1 (1k) DRIVE→CAP_OUT, C1 (100nF) CAP_OUT→GND. */
function rcGraph(): DesignGraph {
  const ops: OpBody[] = [
    { kind: 'add_component', id: 'r1', ref: 'R1', partId: 'core:resistor', partRev: 1, value: '1k' },
    { kind: 'add_component', id: 'c1', ref: 'C1', partId: 'core:capacitor', partRev: 1, value: '100nF' },
    { kind: 'add_component', id: 'gnd', ref: 'PWR1', partId: 'core:pwr-gnd', partRev: 1 },
    { kind: 'connect', port: 'r1:1', newNetId: 'n_drive' },
    { kind: 'connect', port: 'r1:2', newNetId: 'n_cap' },
    { kind: 'connect', port: 'c1:1', netId: 'n_cap' },
    { kind: 'connect', port: 'c1:2', newNetId: 'n_gnd' },
    { kind: 'connect', port: 'gnd:1', netId: 'n_gnd' },
    { kind: 'rename_net', netId: 'n_drive', name: 'DRIVE' },
    { kind: 'rename_net', netId: 'n_cap', name: 'CAP_OUT' },
    { kind: 'rename_net', netId: 'n_gnd', name: 'GND' },
  ];
  return materialize(ops.map((op, i) => ({ actor: 't', lamport: i + 1, ts: 0, op }))).graph;
}

/** A core for validation tests — runCosimClosedLoop must throw first. */
function unsteppableCore(): McuCore {
  return {
    clockHz: 16_000_000,
    loadFirmware: () => undefined,
    step: () => {
      throw new Error('must not step — validation should fail first');
    },
    setPin: () => undefined,
    uartWrite: () => undefined,
    drainUart: () => new Uint8Array(),
    inspect: () => ({ pc: 0, cycles: 0, sreg: 0, sp: 0 }),
    reset: () => undefined,
  };
}

const SPEC: ClosedLoopSpec = {
  windowS: 500e-6,
  stepS: 1e-6,
  quantumS: 50e-6,
  bindings: [{ pin: 'B5', netId: 'n_drive' }],
  inputs: [{ pin: 'D2', netId: 'n_cap' }],
  adc: [{ channel: 0, netId: 'n_cap' }],
};

describe('comparatorStep — the Schmitt state machine', () => {
  it('starts low and stays low anywhere below VIH', () => {
    expect(comparatorStep(0, 0)).toBe(0);
    expect(comparatorStep(0, DEFAULT_VIL_V)).toBe(0); // VIL only matters when high
    expect(comparatorStep(0, DEFAULT_VIH_V - 0.01)).toBe(0);
  });

  it('rises exactly at VIH (3.0 V = 0.6 × 5)', () => {
    expect(DEFAULT_VIH_V).toBe(3);
    expect(comparatorStep(0, DEFAULT_VIH_V)).toBe(1);
    expect(comparatorStep(0, 5)).toBe(1);
  });

  it('holds high through the whole band between VIL and VIH', () => {
    expect(comparatorStep(1, DEFAULT_VIH_V - 0.01)).toBe(1);
    expect(comparatorStep(1, 2)).toBe(1);
    expect(comparatorStep(1, DEFAULT_VIL_V + 0.01)).toBe(1);
  });

  it('falls exactly at VIL (1.5 V = 0.3 × 5)', () => {
    expect(DEFAULT_VIL_V).toBe(1.5);
    expect(comparatorStep(1, DEFAULT_VIL_V)).toBe(0);
    expect(comparatorStep(1, 0)).toBe(0);
  });

  it('retains state through a ripple inside the band (no chatter)', () => {
    let state: DigitalLevel = 0;
    const ripple = [0.5, 2.9, 3.1, 2.0, 1.6, 2.9, 1.5, 2.0, 2.9];
    const levels = ripple.map((v) => (state = comparatorStep(state, v)));
    // One rise at 3.1, one fall at 1.5 — the band ripple changes nothing.
    expect(levels).toEqual([0, 0, 1, 1, 1, 1, 0, 0, 0]);
  });

  it('enforces the 100 mV hysteresis floor when custom thresholds collapse', () => {
    const tight = { vilV: 2.0, vihV: 2.0, hystV: COMPARATOR_HYST_V };
    // Rising threshold is lifted to VIL + 100 mV, never equal to VIL.
    expect(comparatorStep(0, 2.0, tight)).toBe(0);
    expect(comparatorStep(0, 2.05, tight)).toBe(0);
    expect(comparatorStep(0, 2.1, tight)).toBe(1);
    expect(comparatorStep(1, 2.05, tight)).toBe(1); // inside the floor band
    expect(comparatorStep(1, 2.0, tight)).toBe(0);
  });
});

describe('interpolateAt — sampler math over solver points', () => {
  const ts = [0, 1e-6, 3e-6, 4e-6];
  const vs = [0, 1, 5, 5];

  it('returns 0 V with no points at all (quantum 0: nothing solved yet)', () => {
    expect(interpolateAt([], [], 1e-6)).toBe(0);
  });

  it('hits solver points exactly', () => {
    expect(interpolateAt(ts, vs, 0)).toBe(0);
    expect(interpolateAt(ts, vs, 1e-6)).toBe(1);
    expect(interpolateAt(ts, vs, 3e-6)).toBe(5);
  });

  it('interpolates linearly between points', () => {
    expect(interpolateAt(ts, vs, 0.5e-6)).toBeCloseTo(0.5, 12);
    expect(interpolateAt(ts, vs, 2e-6)).toBeCloseTo(3, 12);
    expect(interpolateAt(ts, vs, 2.5e-6)).toBeCloseTo(4, 12);
  });

  it('clamps before the first point', () => {
    expect(interpolateAt(ts, vs, -1e-6)).toBe(0);
    expect(interpolateAt([2e-6, 3e-6], [4, 2], 1e-6)).toBe(4);
  });

  it('zero-order-holds past the last point — the one-quantum staleness', () => {
    expect(interpolateAt(ts, vs, 9e-6)).toBe(5);
  });

  it('handles a single point and unequal array lengths defensively', () => {
    expect(interpolateAt([1e-6], [2.5], 0)).toBe(2.5);
    expect(interpolateAt([1e-6], [2.5], 5e-6)).toBe(2.5);
    expect(interpolateAt([0, 1e-6, 2e-6], [0, 4], 2e-6)).toBe(4); // truncates to the pair
  });
});

describe('runCosimClosedLoop — validation (throws before any work)', () => {
  const graph = rcGraph();

  it('rejects a malformed output pin and a malformed input pin', async () => {
    await expect(
      runCosimClosedLoop({
        graph,
        parts,
        core: unsteppableCore(),
        spec: { ...SPEC, bindings: [{ pin: '13', netId: 'n_drive' }] },
      }),
    ).rejects.toThrow(/port letter \+ bit/);
    await expect(
      runCosimClosedLoop({
        graph,
        parts,
        core: unsteppableCore(),
        spec: { ...SPEC, inputs: [{ pin: 'd2', netId: 'n_cap' }] },
      }),
    ).rejects.toThrow(/port letter \+ bit/);
  });

  it('rejects unknown netIds on bindings, inputs, and ADC channels', async () => {
    const core = unsteppableCore();
    await expect(
      runCosimClosedLoop({
        graph,
        parts,
        core,
        spec: { ...SPEC, bindings: [{ pin: 'B5', netId: 'n_missing' }] },
      }),
    ).rejects.toThrow(/"n_missing" is not in the graph/);
    await expect(
      runCosimClosedLoop({
        graph,
        parts,
        core,
        spec: { ...SPEC, inputs: [{ pin: 'D2', netId: 'n_missing' }] },
      }),
    ).rejects.toThrow(/input D2.*not in the graph/);
    await expect(
      runCosimClosedLoop({
        graph,
        parts,
        core,
        spec: { ...SPEC, adc: [{ channel: 0, netId: 'n_missing' }] },
      }),
    ).rejects.toThrow(/ADC channel 0.*not in the graph/);
  });

  it('rejects a quantum finer than the solver step', async () => {
    await expect(
      runCosimClosedLoop({
        graph,
        parts,
        core: unsteppableCore(),
        spec: { ...SPEC, quantumS: 0.5e-6, stepS: 1e-6 },
      }),
    ).rejects.toThrow(/quantumS must be at least stepS/);
  });

  it('rejects duplicate input pins, output/input pin collisions, and duplicate ADC channels', async () => {
    const core = unsteppableCore();
    await expect(
      runCosimClosedLoop({
        graph,
        parts,
        core,
        spec: {
          ...SPEC,
          inputs: [
            { pin: 'D2', netId: 'n_cap' },
            { pin: 'D2', netId: 'n_drive' },
          ],
        },
      }),
    ).rejects.toThrow(/duplicate input binding for pin D2/);
    await expect(
      runCosimClosedLoop({
        graph,
        parts,
        core,
        spec: { ...SPEC, inputs: [{ pin: 'B5', netId: 'n_cap' }] },
      }),
    ).rejects.toThrow(/both an output binding and a digital input/);
    await expect(
      runCosimClosedLoop({
        graph,
        parts,
        core,
        spec: {
          ...SPEC,
          adc: [
            { channel: 0, netId: 'n_cap' },
            { channel: 0, netId: 'n_drive' },
          ],
        },
      }),
    ).rejects.toThrow(/duplicate ADC binding for channel 0/);
  });

  it('rejects an out-of-range ADC channel', async () => {
    await expect(
      runCosimClosedLoop({
        graph,
        parts,
        core: unsteppableCore(),
        spec: { ...SPEC, adc: [{ channel: 16, netId: 'n_cap' }] },
      }),
    ).rejects.toThrow();
  });

  it('refuses ADC bindings on a core without the pinned ADC surface', async () => {
    await expect(
      runCosimClosedLoop({ graph, parts, core: unsteppableCore(), spec: SPEC }),
    ).rejects.toThrow(/pinned ADC surface.*lacks it/s);
  });
});
