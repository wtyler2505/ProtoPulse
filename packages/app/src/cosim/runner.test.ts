import { describe, expect, it, vi } from 'vitest';

import { createEmuSession } from '../emu/runner.js';

import { createCosimRunner } from './runner.js';

import type {
  ClosedLoopResult,
  ClosedLoopSpec,
  CosimModule,
  CosimResult,
  CosimWindowSpec,
  RunCosimClosedLoopFn,
  RunCosimWindowFn,
} from './types.js';
import type { EmuSession } from '../emu/runner.js';
import type { DigitalLevel, EmuModule, McuCore, PinEvent } from '../emu/types.js';
import type { DesignGraph } from '@protopulse/graph';
import type { PartDb } from '@protopulse/parts';

/**
 * The runner is exercised against the REAL emu session wrapping a
 * scripted fake core, plus a fake cosim module — neither @protopulse/emu
 * nor @protopulse/cosim is ever imported here.
 */

class FakeCore implements McuCore {
  readonly clockHz = 16_000_000;
  resets = 0;
  loadFirmware(): void {
    // firmware accepted
  }
  step(maxCycles: number): { cycles: number; events: PinEvent[] } {
    return { cycles: maxCycles, events: [] };
  }
  setPin(_pin: string, _level: DigitalLevel): void {
    // unused in these tests
  }
  uartWrite(): void {
    // unused in these tests
  }
  drainUart(): Uint8Array {
    return new Uint8Array(0);
  }
  inspect() {
    return { pc: 0, cycles: 0, sreg: 0, sp: 0 };
  }
  reset(): void {
    this.resets += 1;
  }
}

const HEX = ':00000001FF';

async function loadedSession(core: FakeCore): Promise<EmuSession> {
  const Atmega328pCore = function (this: unknown) {
    return core;
  } as unknown as new () => McuCore;
  const session = createEmuSession({
    loader: () => Promise.resolve({ Atmega328pCore } as Partial<EmuModule>),
    now: () => 0,
  });
  const out = await session.load(HEX);
  expect(out.ok).toBe(true);
  return session;
}

const spec = (over: Partial<CosimWindowSpec> = {}): CosimWindowSpec => ({
  windowS: 500e-6,
  stepS: 1e-6,
  bindings: [{ pin: 'PB5', netId: 'net-1' }],
  ...over,
});

const okResult = (): CosimResult => ({
  sim: {
    analysis: { kind: 'tran', stepS: 1e-6, stopS: 500e-6 },
    variables: ['time', 'v(out)'],
    points: 3,
    vectors: [
      { name: 'time', values: [0, 1e-6, 2e-6] },
      { name: 'v(out)', values: [0, 1, 2] },
    ],
    manifest: [
      { ref: 'R1', partId: 'passive.r', tier: 'spice' },
      { ref: 'U1', partId: 'mcu.328p', tier: 'stub', note: 'digital side emulated' },
    ],
  },
  pinEvents: [{ pin: 'PB5', level: 1, cycle: 4000 }],
  mcuCycles: 8000,
  virtualTimeS: 500e-6,
  pwlSources: { 'net-1': 'PWL(0 0 1u 5)' },
});

const graph = { nets: new Map() } as unknown as DesignGraph;
const parts = {} as unknown as PartDb;

describe('createCosimRunner — error-as-value paths', () => {
  it('refuses an invalid spec before touching module or core', async () => {
    const loader = vi.fn(() => Promise.resolve({}));
    const session = await loadedSession(new FakeCore());
    const runner = createCosimRunner({ loader, session });
    const out = await runner.run(graph, parts, spec({ bindings: [] }));
    expect(out).toEqual({ ok: false, error: 'add at least one pin → net binding' });
    expect(loader).not.toHaveBeenCalled();
  });

  it("asks for firmware first when the emu session has none loaded", async () => {
    const loader = vi.fn(() => Promise.resolve({}));
    const session = createEmuSession({ loader: () => Promise.resolve({}) }); // never loads
    const runner = createCosimRunner({ loader, session });
    const out = await runner.run(graph, parts, spec());
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error).toMatch(/load firmware first/);
    expect(loader).not.toHaveBeenCalled();
  });

  it('surfaces a friendly error while @protopulse/cosim is not in the build', async () => {
    const session = await loadedSession(new FakeCore());
    const runner = createCosimRunner({ loader: () => Promise.resolve({}), session });
    const out = await runner.run(graph, parts, spec());
    expect(out).toEqual({
      ok: false,
      error: 'co-simulation not available yet — @protopulse/cosim is not in this build',
    });
    // The borrow never started: nothing was suspended or reset.
    expect(session.suspended).toBe(false);
  });

  it('surfaces a loader rejection as a value', async () => {
    const session = await loadedSession(new FakeCore());
    const runner = createCosimRunner({
      loader: () => Promise.reject(new Error('dynamic import failed')),
      session,
    });
    const out = await runner.run(graph, parts, spec());
    expect(out).toEqual({ ok: false, error: 'dynamic import failed' });
  });

  it('surfaces an engine throw as a value AND returns the borrowed core reset + resumed', async () => {
    const core = new FakeCore();
    const session = await loadedSession(core);
    const runCosimWindow: RunCosimWindowFn = () =>
      Promise.reject(new Error('singular matrix at t=3µs'));
    const runner = createCosimRunner({
      loader: () => Promise.resolve({ runCosimWindow } satisfies Partial<CosimModule>),
      session,
    });
    const out = await runner.run(graph, parts, spec());
    expect(out).toEqual({ ok: false, error: 'singular matrix at t=3µs' });
    expect(session.suspended).toBe(false); // resumed
    expect(core.resets).toBe(3); // load + before-window + after-window
    expect(session.loaded).toBe(true); // firmware survives a failed window
  });
});

describe('createCosimRunner — the borrow protocol', () => {
  it('runs the window against the SESSION’S core with the caller’s graph/parts/spec', async () => {
    const core = new FakeCore();
    const session = await loadedSession(core);
    const runCosimWindow = vi.fn<RunCosimWindowFn>(() => Promise.resolve(okResult()));
    const runner = createCosimRunner({
      loader: () => Promise.resolve({ runCosimWindow }),
      session,
    });
    const theSpec = spec();
    const out = await runner.run(graph, parts, theSpec);
    expect(out.ok).toBe(true);
    expect(runCosimWindow).toHaveBeenCalledWith({ graph, parts, core, spec: theSpec });
  });

  it('suspends and power-on-resets BEFORE the window, resets and resumes AFTER', async () => {
    const core = new FakeCore();
    const session = await loadedSession(core);
    let stateAtRun: { suspended: boolean; resets: number } | null = null;
    const runCosimWindow: RunCosimWindowFn = () => {
      stateAtRun = { suspended: session.suspended, resets: core.resets };
      return Promise.resolve(okResult());
    };
    const runner = createCosimRunner({
      loader: () => Promise.resolve({ runCosimWindow }),
      session,
    });

    // Dirty the session so the power-on reset is observable.
    session.runFrame();
    expect(session.cycles).toBeGreaterThan(0);

    const out = await runner.run(graph, parts, spec());
    expect(out.ok).toBe(true);
    expect(stateAtRun).toEqual({ suspended: true, resets: 2 }); // load + before-window
    expect(core.resets).toBe(3); // …and once after
    expect(session.suspended).toBe(false);
    expect(session.cycles).toBe(0); // Firmware tab resumes from power-on
    expect(session.events).toHaveLength(0);
  });

  it('reports fidelity from the manifest and the wall-clock cost of the window', async () => {
    const session = await loadedSession(new FakeCore());
    let t = 100;
    const runner = createCosimRunner({
      loader: () => Promise.resolve({ runCosimWindow: () => Promise.resolve(okResult()) }),
      session,
      now: () => (t += 6), // 6 ms per clock read: t0 then end → 6 ms window
    });
    const out = await runner.run(graph, parts, spec());
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.wallMs).toBe(6);
    expect(out.fidelity).toContain('1 spice');
    expect(out.fidelity).toContain('1 stub');
    expect(out.fidelity).toContain('U1 (digital side emulated)');
    expect(out.result.mcuCycles).toBe(8000);
  });

  it('never caches — every Run re-executes the window', async () => {
    const session = await loadedSession(new FakeCore());
    const runCosimWindow = vi.fn<RunCosimWindowFn>(() => Promise.resolve(okResult()));
    const runner = createCosimRunner({
      loader: () => Promise.resolve({ runCosimWindow }),
      session,
    });
    await runner.run(graph, parts, spec());
    await runner.run(graph, parts, spec());
    expect(runCosimWindow).toHaveBeenCalledTimes(2);
  });

  it('loads the module once across runs', async () => {
    const session = await loadedSession(new FakeCore());
    const loader = vi.fn(() =>
      Promise.resolve({ runCosimWindow: () => Promise.resolve(okResult()) }),
    );
    const runner = createCosimRunner({ loader, session });
    await runner.run(graph, parts, spec());
    await runner.run(graph, parts, spec());
    expect(loader).toHaveBeenCalledTimes(1);
  });
});

// ── The FEEDBACK direction: runClosedLoop ────────────────────────────

const closedSpec = (over: Partial<ClosedLoopSpec> = {}): ClosedLoopSpec => ({
  ...spec(),
  quantumS: 50e-6,
  inputs: [{ pin: 'PD2', netId: 'net-2' }],
  adc: [{ channel: 0, netId: 'net-2' }],
  ...over,
});

const okClosedResult = (): ClosedLoopResult => ({
  ...okResult(),
  quanta: 10,
  adcReads: [{ channel: 0, cycle: 1234, volts: 2.2 }],
  inputEdges: [{ pin: 'PD2', level: 1, cycle: 1600 }],
  rerunSolves: 10,
});

describe('createCosimRunner — runClosedLoop', () => {
  it('refuses an invalid closed-loop spec before touching module or core', async () => {
    const loader = vi.fn(() => Promise.resolve({}));
    const session = await loadedSession(new FakeCore());
    const runner = createCosimRunner({ loader, session });
    const out = await runner.runClosedLoop(graph, parts, closedSpec({ quantumS: 0.5e-6 }));
    expect(out).toEqual({ ok: false, error: 'quantum cannot be finer than the solver step' });
    expect(loader).not.toHaveBeenCalled();
  });

  it('asks for firmware first when the emu session has none loaded', async () => {
    const loader = vi.fn(() => Promise.resolve({}));
    const session = createEmuSession({ loader: () => Promise.resolve({}) }); // never loads
    const runner = createCosimRunner({ loader, session });
    const out = await runner.runClosedLoop(graph, parts, closedSpec());
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error).toMatch(/load firmware first/);
    expect(loader).not.toHaveBeenCalled();
  });

  it('surfaces "not in this build" when the module lacks runCosimClosedLoop', async () => {
    const session = await loadedSession(new FakeCore());
    // A build with ONLY the open-loop slice: closed loop is honestly absent.
    const runner = createCosimRunner({
      loader: () =>
        Promise.resolve({ runCosimWindow: () => Promise.resolve(okResult()) } satisfies Partial<CosimModule>),
      session,
    });
    const out = await runner.runClosedLoop(graph, parts, closedSpec());
    expect(out).toEqual({
      ok: false,
      error:
        'closed-loop co-simulation not in this build — @protopulse/cosim lacks runCosimClosedLoop',
    });
    expect(session.suspended).toBe(false); // the borrow never started
  });

  it('runs the loop against the SESSION’S core and reports the honesty numbers', async () => {
    const core = new FakeCore();
    const session = await loadedSession(core);
    const runCosimClosedLoop = vi.fn<RunCosimClosedLoopFn>(() =>
      Promise.resolve(okClosedResult()),
    );
    const runner = createCosimRunner({
      loader: () => Promise.resolve({ runCosimClosedLoop }),
      session,
    });
    const theSpec = closedSpec();
    const out = await runner.runClosedLoop(graph, parts, theSpec);
    expect(out.ok).toBe(true);
    expect(runCosimClosedLoop).toHaveBeenCalledWith({ graph, parts, core, spec: theSpec });
    if (!out.ok) return;
    expect(out.result.rerunSolves).toBe(10);
    expect(out.result.quanta).toBe(10);
    expect(out.result.adcReads).toHaveLength(1);
    expect(out.result.inputEdges).toHaveLength(1);
    expect(out.fidelity).toContain('1 spice');
  });

  it('follows the same borrow protocol: suspend + reset before, reset + resume after', async () => {
    const core = new FakeCore();
    const session = await loadedSession(core);
    let stateAtRun: { suspended: boolean; resets: number } | null = null;
    const runCosimClosedLoop: RunCosimClosedLoopFn = () => {
      stateAtRun = { suspended: session.suspended, resets: core.resets };
      return Promise.resolve(okClosedResult());
    };
    const runner = createCosimRunner({
      loader: () => Promise.resolve({ runCosimClosedLoop }),
      session,
    });
    const out = await runner.runClosedLoop(graph, parts, closedSpec());
    expect(out.ok).toBe(true);
    expect(stateAtRun).toEqual({ suspended: true, resets: 2 }); // load + before-window
    expect(core.resets).toBe(3); // …and once after
    expect(session.suspended).toBe(false);
    expect(session.cycles).toBe(0);
  });

  it('surfaces a quantum-loop throw as a value AND hands the core back reset + resumed', async () => {
    const core = new FakeCore();
    const session = await loadedSession(core);
    const runCosimClosedLoop: RunCosimClosedLoopFn = () =>
      Promise.reject(new Error('singular matrix at quantum 7'));
    const runner = createCosimRunner({
      loader: () => Promise.resolve({ runCosimClosedLoop }),
      session,
    });
    const out = await runner.runClosedLoop(graph, parts, closedSpec());
    expect(out).toEqual({ ok: false, error: 'singular matrix at quantum 7' });
    expect(session.suspended).toBe(false);
    expect(core.resets).toBe(3);
    expect(session.loaded).toBe(true);
  });

  it('open-loop and closed-loop share one lazily loaded module', async () => {
    const session = await loadedSession(new FakeCore());
    const loader = vi.fn(() =>
      Promise.resolve({
        runCosimWindow: () => Promise.resolve(okResult()),
        runCosimClosedLoop: () => Promise.resolve(okClosedResult()),
      } satisfies Partial<CosimModule>),
    );
    const runner = createCosimRunner({ loader, session });
    await runner.run(graph, parts, spec());
    await runner.runClosedLoop(graph, parts, closedSpec());
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('auto-installs I2C/SPI devices resolved from the graph when the spec omits them', async () => {
    const core = new FakeCore();
    const session = await loadedSession(core);
    const runCosimClosedLoop = vi.fn<RunCosimClosedLoopFn>(() => Promise.resolve(okClosedResult()));
    const i2cBinding = { port: 0 as const, slave: () => 0x68 };
    const spiBinding = { port: 2 as const, slave: () => 0x92 };
    const runner = createCosimRunner({
      loader: () =>
        Promise.resolve({
          runCosimClosedLoop,
          i2cDevicesFromGraph: () => [i2cBinding],
          spiDevicesFromGraph: () => [spiBinding],
        } as Partial<CosimModule>),
      session,
    });
    const out = await runner.runClosedLoop(graph, parts, closedSpec());
    expect(out.ok).toBe(true);
    const callArg = runCosimClosedLoop.mock.calls[0]?.[0];
    expect(callArg?.spec.i2cDevices).toEqual([i2cBinding]);
    expect(callArg?.spec.spiDevices).toEqual([spiBinding]);
  });

  it('does not override an explicit spec.i2cDevices, and skips graph resolution for it', async () => {
    const core = new FakeCore();
    const session = await loadedSession(core);
    const runCosimClosedLoop = vi.fn<RunCosimClosedLoopFn>(() => Promise.resolve(okClosedResult()));
    const i2cDevicesFromGraph = vi.fn(() => [{ port: 0 as const, slave: () => 0xff }]);
    const explicit = [{ port: 0 as const, slave: () => 0x68 }];
    const runner = createCosimRunner({
      loader: () =>
        Promise.resolve({ runCosimClosedLoop, i2cDevicesFromGraph } as Partial<CosimModule>),
      session,
    });
    await runner.runClosedLoop(graph, parts, closedSpec({ i2cDevices: explicit }));
    const callArg = runCosimClosedLoop.mock.calls[0]?.[0];
    expect(callArg?.spec.i2cDevices).toBe(explicit); // explicit wins (by reference)
    expect(i2cDevicesFromGraph).not.toHaveBeenCalled(); // ?? short-circuits
  });
});
