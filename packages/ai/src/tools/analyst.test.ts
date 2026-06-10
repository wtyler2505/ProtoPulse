import { makePortRef, materialize } from '@protopulse/graph';
import { seedPartDb } from '@protopulse/parts';
import { describe, expect, it, vi } from 'vitest';

import { fidelitySummary } from '../sim-types.js';

import { createAnalystRegistry, sweepVectorName, ANALYST_TOOL_NAMES } from './analyst.js';

import type { ToolCtx } from '../registry.js';
import type { Analysis, PinnedSimulateFn, SimResultWithManifest } from '../sim-types.js';
import type { DesignGraph, OpBody, OpEnvelope } from '@protopulse/graph';
import type { PartDb } from '@protopulse/parts';

const parts: PartDb = seedPartDb();

function env(lamport: number, op: OpBody): OpEnvelope {
  return { actor: 'test', lamport, ts: 0, op };
}

/** R1 (10k) and D1 (led) wired on net VOUT, with a current budget. */
function fixtureGraph(): DesignGraph {
  const rRev = parts.latest('core:resistor')?.rev ?? 1;
  const dRev = parts.latest('core:led')?.rev ?? 1;
  const result = materialize([
    env(1, { kind: 'add_component', id: 'c-r1', ref: 'R1', partId: 'core:resistor', partRev: rRev, value: '10k' }),
    env(2, { kind: 'add_component', id: 'c-d1', ref: 'D1', partId: 'core:led', partRev: dRev }),
    env(3, { kind: 'connect', port: makePortRef('c-r1', '2'), newNetId: 'n-out' }),
    env(4, { kind: 'connect', port: makePortRef('c-d1', 'A'), netId: 'n-out' }),
    env(5, { kind: 'rename_net', netId: 'n-out', name: 'VOUT' }),
    env(6, {
      kind: 'add_constraint',
      id: 'k-1',
      body: { kind: 'current_max', netId: 'n-out', amps: 0.02 },
      rationale: 'LED budget',
    }),
  ]);
  expect(result.warnings).toEqual([]);
  return result.graph;
}

function ctxOf(graph: DesignGraph): ToolCtx {
  return { graph, parts };
}

const TRAN: Analysis = { kind: 'tran', stepS: 1e-6, stopS: 4e-6 };

function tranResult(analysis: Analysis): SimResultWithManifest {
  return {
    analysis,
    variables: ['time', 'v(out)'],
    points: 5,
    vectors: [
      { name: 'time', values: [0, 1, 2, 3, 4] },
      { name: 'v(out)', values: [1, 2, 3, 4, 5] },
    ],
    manifest: [
      { ref: 'R1', partId: 'core:resistor', tier: 'spice' },
      { ref: 'D1', partId: 'core:led', tier: 'stub', note: 'ideal diode stub' },
    ],
  };
}

function fakeSimulate(): { fn: PinnedSimulateFn; calls: Analysis[] } {
  const calls: Analysis[] = [];
  const fn: PinnedSimulateFn = (_graph, _parts, analysis) => {
    calls.push(analysis);
    return Promise.resolve(tranResult(analysis));
  };
  return { fn, calls };
}

describe('analyst registry shape and scoping', () => {
  it('exposes exactly the 3 analyst tools', () => {
    const registry = createAnalystRegistry(fakeSimulate().fn);
    expect(registry.names().sort()).toEqual([...ANALYST_TOOL_NAMES].sort());
  });

  it('rejects draftsman tools — scope is dispatch-enforced, not prompt politeness', async () => {
    const registry = createAnalystRegistry(fakeSimulate().fn);
    for (const name of ['add_component', 'connect', 'run_erc', 'batch']) {
      const res = await registry.dispatchAsync(name, {}, ctxOf(fixtureGraph()));
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error).toMatch(/unknown or out-of-scope/);
    }
  });

  it('run_simulation is heavy and non-destructive; the others are cheap', () => {
    const registry = createAnalystRegistry(fakeSimulate().fn);
    const sim = registry.get('run_simulation');
    expect(sim?.costClass).toBe('heavy');
    expect(sim?.destructive).toBe(false);
    expect(registry.get('measure')?.costClass).toBe('cheap');
    expect(registry.get('read_design')?.costClass).toBe('cheap');
  });
});

describe('run_simulation', () => {
  it('runs the injected simulate against ctx and returns stats + manifest', async () => {
    const { fn, calls } = fakeSimulate();
    const registry = createAnalystRegistry(fn);
    const res = await registry.dispatchAsync(
      'run_simulation',
      { analysis: TRAN },
      ctxOf(fixtureGraph()),
    );
    expect(res.ok, res.ok ? '' : res.error).toBe(true);
    if (!res.ok) return;
    expect(calls).toEqual([TRAN]);
    expect(res.result.ops).toEqual([]);
    const data = res.result.data as {
      variables: string[];
      points: number;
      manifest: unknown[];
      stats: Record<string, { min: number; max: number; final: number }>;
    };
    expect(data.variables).toEqual(['time', 'v(out)']);
    expect(data.points).toBe(5);
    expect(data.manifest).toHaveLength(2);
    expect(data.stats['v(out)']).toEqual({ min: 1, max: 5, final: 5 });
  });

  it('summary states the fidelity manifest — simulations never lie', async () => {
    const registry = createAnalystRegistry(fakeSimulate().fn);
    const res = await registry.dispatchAsync(
      'run_simulation',
      { analysis: TRAN },
      ctxOf(fixtureGraph()),
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.result.summary).toContain('1 spice, 1 stub');
      expect(res.result.summary).toContain('D1 (ideal diode stub)');
    }
  });

  it('validates the analysis union', async () => {
    const registry = createAnalystRegistry(fakeSimulate().fn);
    const bad = await registry.dispatchAsync(
      'run_simulation',
      { analysis: { kind: 'noise' } },
      ctxOf(fixtureGraph()),
    );
    expect(bad.ok).toBe(false);
    const negative = await registry.dispatchAsync(
      'run_simulation',
      { analysis: { kind: 'tran', stepS: -1, stopS: 1 } },
      ctxOf(fixtureGraph()),
    );
    expect(negative.ok).toBe(false);
  });

  it('cannot be dispatched synchronously', () => {
    const registry = createAnalystRegistry(fakeSimulate().fn);
    const res = registry.dispatch('run_simulation', { analysis: TRAN }, ctxOf(fixtureGraph()));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/asynchronous/);
  });

  it('surfaces simulate() rejections as dispatch errors', async () => {
    const registry = createAnalystRegistry(() => Promise.reject(new Error('singular matrix')));
    const res = await registry.dispatchAsync(
      'run_simulation',
      { analysis: TRAN },
      ctxOf(fixtureGraph()),
    );
    expect(res).toEqual({ ok: false, error: 'singular matrix' });
  });
});

describe('measure', () => {
  async function primedRegistry() {
    const registry = createAnalystRegistry(fakeSimulate().fn);
    const res = await registry.dispatchAsync(
      'run_simulation',
      { analysis: TRAN },
      ctxOf(fixtureGraph()),
    );
    expect(res.ok).toBe(true);
    return registry;
  }

  function value(res: Awaited<ReturnType<typeof primedRegistry>>, input: unknown): number {
    const out = res.dispatch('measure', input, ctxOf(fixtureGraph()));
    expect(out.ok, out.ok ? '' : out.error).toBe(true);
    if (!out.ok) throw new Error(out.error);
    return (out.result.data as { value: number }).value;
  }

  it('errors before any simulation has run', () => {
    const registry = createAnalystRegistry(fakeSimulate().fn);
    const res = registry.dispatch('measure', { vector: 'v(out)', metric: 'min' }, ctxOf(fixtureGraph()));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/run_simulation first/);
  });

  it('computes every metric over v(out) = [1..5]', async () => {
    const registry = await primedRegistry();
    expect(value(registry, { vector: 'v(out)', metric: 'min' })).toBe(1);
    expect(value(registry, { vector: 'v(out)', metric: 'max' })).toBe(5);
    expect(value(registry, { vector: 'v(out)', metric: 'avg' })).toBe(3);
    expect(value(registry, { vector: 'v(out)', metric: 'final' })).toBe(5);
    expect(value(registry, { vector: 'v(out)', metric: 'peak_to_peak' })).toBe(4);
    // rms = sqrt((1+4+9+16+25)/5) = sqrt(11)
    expect(value(registry, { vector: 'v(out)', metric: 'rms' })).toBeCloseTo(Math.sqrt(11));
  });

  it('clips to the [t_start, t_stop] window on the sweep axis', async () => {
    const registry = await primedRegistry();
    expect(value(registry, { vector: 'v(out)', metric: 'avg', t_start: 2, t_stop: 3 })).toBe(3.5);
    expect(value(registry, { vector: 'v(out)', metric: 'min', t_start: 3 })).toBe(4);
    expect(value(registry, { vector: 'v(out)', metric: 'max', t_stop: 1 })).toBe(2);
    expect(value(registry, { vector: 'v(out)', metric: 'final', t_stop: 2 })).toBe(3);
  });

  it('rejects empty windows and unknown vectors', async () => {
    const registry = await primedRegistry();
    const empty = registry.dispatch(
      'measure',
      { vector: 'v(out)', metric: 'min', t_start: 99, t_stop: 100 },
      ctxOf(fixtureGraph()),
    );
    expect(empty.ok).toBe(false);
    if (!empty.ok) expect(empty.error).toMatch(/no points/);

    const unknown = registry.dispatch(
      'measure',
      { vector: 'v(ghost)', metric: 'min' },
      ctxOf(fixtureGraph()),
    );
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) expect(unknown.error).toMatch(/available: time, v\(out\)/);
  });
});

describe('read_design', () => {
  it('digests components, nets, and constraints', () => {
    const registry = createAnalystRegistry(fakeSimulate().fn);
    const res = registry.dispatch('read_design', {}, ctxOf(fixtureGraph()));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const data = res.result.data as { components: string[]; nets: string[]; constraints: string[] };
    expect(data.components).toEqual(['D1 LED', 'R1 10k Resistor']);
    expect(data.nets).toEqual(['VOUT: D1:A, R1:2']);
    expect(data.constraints).toEqual(['current_max on VOUT: 0.02A — LED budget']);
    expect(res.result.summary).toBe('2 component(s), 1 net(s), 1 constraint(s)');
  });
});

describe('helpers', () => {
  it('sweepVectorName per analysis kind', () => {
    expect(sweepVectorName(tranResult(TRAN))).toBe('time');
    expect(sweepVectorName(tranResult({ kind: 'op' }))).toBeNull();
    expect(
      sweepVectorName({
        ...tranResult({ kind: 'ac', variation: 'dec', points: 20, fStart: 1, fStop: 1e6 }),
      }),
    ).toBe('frequency');
    expect(
      sweepVectorName({
        ...tranResult({ kind: 'dc', source: 'BT1', start: 0, stop: 5, step: 0.1 }),
        variables: ['v-sweep', 'v(out)'],
      }),
    ).toBe('v-sweep');
  });

  it('fidelitySummary formats tiers and stub notes', () => {
    expect(
      fidelitySummary([
        { ref: 'R1', partId: 'core:resistor', tier: 'spice' },
        { ref: 'U1', partId: 'core:ne555', tier: 'stub' },
      ]),
    ).toBe('Fidelity: 1 spice, 1 stub; STUB models: U1');
    expect(fidelitySummary([])).toBe('Fidelity: no models in manifest');
  });

  it('vi mock sanity: the injected simulate is what executes', async () => {
    const spy = vi.fn((_g: DesignGraph, _p: PartDb, a: Analysis) => Promise.resolve(tranResult(a)));
    const registry = createAnalystRegistry(spy);
    const graph = fixtureGraph();
    await registry.dispatchAsync('run_simulation', { analysis: { kind: 'op' } }, ctxOf(graph));
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]?.[0]).toBe(graph);
    expect(spy.mock.calls[0]?.[1]).toBe(parts);
  });
});
