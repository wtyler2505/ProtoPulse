import { Atmega328pCore, BRNE, CBI, DEC, IO, LDI, OUT, RJMP, SBI, assemble } from '@protopulse/emu';
import { materialize } from '@protopulse/graph';
import { seedPartDb } from '@protopulse/parts';
import { SpiceEngine, vectorByName } from '@protopulse/sim';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { runCosimWindow } from './run.js';

import type { CosimResult, CosimWindowSpec } from './types.js';
import type { McuCore } from '@protopulse/emu';
import type { DesignGraph, OpBody } from '@protopulse/graph';

const parts = seedPartDb();

/**
 * The classic blink from the emu test suite, hand-assembled: B5 output,
 * SBI/CBI around two 200-count busy-wait loops. Period ≈ 1206 cycles
 * ≈ 75µs at 16 MHz — several full periods fit in a 500µs window.
 */
const BLINK = assemble([
  LDI(16, 0x20), //  0: r16 = 1<<5
  OUT(IO.DDRB, 16), //  1: B5 → output (low)
  SBI(IO.PORTB, 5), //  2: loop — B5 high
  LDI(17, 200), //  3
  DEC(17), //  4: d1
  BRNE(-2), //  5: → 4
  CBI(IO.PORTB, 5), //  6: B5 low
  LDI(17, 200), //  7
  DEC(17), //  8: d2
  BRNE(-2), //  9: → 8
  RJMP(2 - 11), // 10: → 2 (loop)
]);

/** RC low-pass: R1 (1k) from DRIVE to CAP_OUT, C1 (100nF) from CAP_OUT to GND. */
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

const SPEC: CosimWindowSpec = {
  windowS: 500e-6,
  stepS: 1e-6,
  bindings: [{ pin: 'B5', netId: 'n_drive', voltsHigh: 5, routOhms: 30, riseS: 100e-9 }],
};

function blinkCore(): Atmega328pCore {
  const core = new Atmega328pCore();
  core.loadFirmware(BLINK);
  return core;
}

/** A core for validation tests — runCosimWindow must throw before stepping. */
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

describe('runCosimWindow — validation', () => {
  const graph = rcGraph();

  it('rejects a malformed pin id', async () => {
    const bad = { ...SPEC, bindings: [{ pin: '13', netId: 'n_drive' }] };
    await expect(
      runCosimWindow({ graph, parts, core: unsteppableCore(), spec: bad }),
    ).rejects.toThrow(/port letter \+ bit/);
  });

  it('rejects a bit outside 0-7', async () => {
    const bad = { ...SPEC, bindings: [{ pin: 'B9', netId: 'n_drive' }] };
    await expect(
      runCosimWindow({ graph, parts, core: unsteppableCore(), spec: bad }),
    ).rejects.toThrow(/port letter \+ bit/);
  });

  it('rejects a netId that is not in the graph', async () => {
    const bad = { ...SPEC, bindings: [{ pin: 'B5', netId: 'n_missing' }] };
    await expect(
      runCosimWindow({ graph, parts, core: unsteppableCore(), spec: bad }),
    ).rejects.toThrow(/"n_missing" is not in the graph/);
  });

  it('rejects duplicate bindings for the same pin', async () => {
    const bad = {
      ...SPEC,
      bindings: [
        { pin: 'B5', netId: 'n_drive' },
        { pin: 'B5', netId: 'n_cap' },
      ],
    };
    await expect(
      runCosimWindow({ graph, parts, core: unsteppableCore(), spec: bad }),
    ).rejects.toThrow(/duplicate binding for pin B5/);
  });

  it('rejects an empty bindings list and non-positive window/step', async () => {
    await expect(
      runCosimWindow({ graph, parts, core: unsteppableCore(), spec: { ...SPEC, bindings: [] } }),
    ).rejects.toThrow();
    await expect(
      runCosimWindow({ graph, parts, core: unsteppableCore(), spec: { ...SPEC, windowS: 0 } }),
    ).rejects.toThrow();
    await expect(
      runCosimWindow({ graph, parts, core: unsteppableCore(), spec: { ...SPEC, stepS: -1e-6 } }),
    ).rejects.toThrow();
  });

  it('rejects a step wider than the window', async () => {
    await expect(
      runCosimWindow({
        graph,
        parts,
        core: unsteppableCore(),
        spec: { ...SPEC, stepS: 1e-3 },
      }),
    ).rejects.toThrow(/stepS must not exceed windowS/);
  });
});

describe('runCosimWindow — blink firmware through an RC low-pass (the thesis)', () => {
  const engine = new SpiceEngine();
  let result: CosimResult;
  let rerun: CosimResult;

  beforeAll(async () => {
    await engine.start();
    result = await runCosimWindow({ graph: rcGraph(), parts, core: blinkCore(), spec: SPEC, engine });
    rerun = await runCosimWindow({ graph: rcGraph(), parts, core: blinkCore(), spec: SPEC, engine });
  }, 60_000);

  afterAll(async () => {
    await engine.stop();
  });

  it('charges the cap above 2V from a sub-2.5V start', () => {
    const vCap = vectorByName(result.sim, 'v(cap_out)');
    expect(vCap).toBeDefined();
    const values = vCap?.values ?? [];
    expect(values.length).toBeGreaterThan(100);
    expect(values[0] ?? Number.NaN).toBeLessThan(2.5); // starts discharged
    expect(Math.max(...values)).toBeGreaterThan(2);
    expect(Math.min(...values)).toBeLessThan(2.5);
  });

  it('genuinely ripples — the RC smooths the square wave, not flattens or passes it', () => {
    const vCap = vectorByName(result.sim, 'v(cap_out)');
    const values = vCap?.values ?? [];
    const spread = Math.max(...values) - Math.min(...values);
    expect(spread).toBeGreaterThan(0.5); // not flat
    expect(spread).toBeLessThan(4.5); // not the raw 0-5V square wave

    // Settled ripple (last 30% of the window) is small but alive.
    const time = vectorByName(result.sim, 'time');
    const ts = time?.values ?? [];
    const late = values.filter((_, i) => (ts[i] ?? 0) >= 350e-6);
    expect(late.length).toBeGreaterThan(10);
    const lateSpread = Math.max(...late) - Math.min(...late);
    expect(lateSpread).toBeGreaterThan(0.1);
    expect(lateSpread).toBeLessThan(2);
  });

  it('exposes the injected PWL source with the series Rout boundary', () => {
    const card = result.pwlSources.B5 ?? '';
    expect(card).toContain('Vb5 b5_drv 0 PWL(');
    expect(card).toContain('Rb5 b5_drv drive 30');
    // ≥4 edges fit in the window → ≥4 ramps → ≥10 PWL points.
    const inner = /PWL\(([^)]*)\)/.exec(card)?.[1] ?? '';
    const pointCount = inner.split(/\s+/).length / 2;
    expect(pointCount).toBeGreaterThanOrEqual(10);
  });

  it('collects several blink edges, all on B5', () => {
    expect(result.pinEvents.length).toBeGreaterThanOrEqual(4);
    expect(result.pinEvents.every((e) => e.pin === 'B5')).toBe(true);
    expect(result.pinEvents.filter((e) => e.level === 1).length).toBeGreaterThanOrEqual(2);
    expect(result.pinEvents.filter((e) => e.level === 0).length).toBeGreaterThanOrEqual(2);
  });

  it('reports honest cycle and time accounting', () => {
    // ceil(16e6 × 500e-6) = 8000 cycles, plus ≤ one-instruction overshoot.
    expect(result.mcuCycles).toBeGreaterThanOrEqual(8000);
    expect(result.mcuCycles).toBeLessThanOrEqual(8010);
    expect(result.virtualTimeS).toBeCloseTo(result.mcuCycles / 16e6, 12);
  });

  it('carries the sim fidelity manifest through', () => {
    expect(result.sim.manifest.length).toBeGreaterThanOrEqual(2);
    const r1 = result.sim.manifest.find((e) => e.ref === 'R1');
    const c1 = result.sim.manifest.find((e) => e.ref === 'C1');
    expect(r1?.tier).toBe('spice');
    expect(c1?.tier).toBe('spice');
  });

  it('is deterministic: a fresh core and identical spec produce the same PWL card', () => {
    expect(rerun.pwlSources.B5).toBe(result.pwlSources.B5);
    expect(rerun.pinEvents).toEqual(result.pinEvents);
    expect(rerun.mcuCycles).toBe(result.mcuCycles);
  });
});
