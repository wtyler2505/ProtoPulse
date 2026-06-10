import { emptyGraph } from '@protopulse/graph';
import { seedPartDb } from '@protopulse/parts';
import { describe, expect, it, vi } from 'vitest';

import { createSimRunner, fallbackFidelitySummary } from './runner.js';

import type { Analysis, SimModule, SimResultWithManifest } from './types.js';

/** A mocked engine module — the real @protopulse/sim is NEVER imported here. */
function mockResult(analysis: Analysis): SimResultWithManifest {
  return {
    analysis,
    variables: ['time', 'v(out)'],
    points: 3,
    vectors: [
      { name: 'time', values: [0, 1e-6, 2e-6] },
      { name: 'v(out)', values: [0, 2.5, 5] },
    ],
    manifest: [
      { ref: 'R1', partId: 'core:resistor', tier: 'spice' },
      { ref: 'U1', partId: 'core:ne555', tier: 'stub', note: 'timer stubbed as ideal switch' },
    ],
  };
}

const TRAN: Analysis = { kind: 'tran', stepS: 1e-6, stopS: 2e-6 };
const graph = emptyGraph();
const parts = seedPartDb();

function makeModule() {
  const simulate = vi.fn((_g: unknown, _p: unknown, analysis: Analysis) =>
    Promise.resolve(mockResult(analysis)),
  );
  const fidelitySummary = vi.fn(() => 'engine summary');
  return { simulate, fidelitySummary };
}

describe('createSimRunner', () => {
  it('runs via the lazily loaded module and returns the engine fidelity summary', async () => {
    const mod = makeModule();
    const loader = vi.fn(() => Promise.resolve(mod as unknown as Partial<SimModule>));
    const runner = createSimRunner(loader);

    const out = await runner.run(graph, parts, TRAN, { branch: 'main', opsVersion: 1 });
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.result.points).toBe(3);
      expect(out.fidelity).toBe('engine summary');
    }
    expect(loader).toHaveBeenCalledTimes(1);
    expect(mod.simulate).toHaveBeenCalledWith(graph, parts, TRAN);
  });

  it('caches per (branch, opsVersion, analysis): identical key does not re-run', async () => {
    const mod = makeModule();
    const runner = createSimRunner(() => Promise.resolve(mod as unknown as Partial<SimModule>));

    const a = await runner.run(graph, parts, TRAN, { branch: 'main', opsVersion: 4 });
    const b = await runner.run(graph, parts, TRAN, { branch: 'main', opsVersion: 4 });
    expect(mod.simulate).toHaveBeenCalledTimes(1);
    expect(b).toBe(a); // same outcome object served from cache
  });

  it('re-runs when opsVersion, branch, or analysis changes', async () => {
    const mod = makeModule();
    const runner = createSimRunner(() => Promise.resolve(mod as unknown as Partial<SimModule>));

    await runner.run(graph, parts, TRAN, { branch: 'main', opsVersion: 1 });
    await runner.run(graph, parts, TRAN, { branch: 'main', opsVersion: 2 });
    expect(mod.simulate).toHaveBeenCalledTimes(2);
    await runner.run(graph, parts, TRAN, { branch: 'exp', opsVersion: 2 });
    expect(mod.simulate).toHaveBeenCalledTimes(3);
    await runner.run(graph, parts, { ...TRAN, stopS: 5e-6 }, { branch: 'exp', opsVersion: 2 });
    expect(mod.simulate).toHaveBeenCalledTimes(4);
  });

  it('surfaces simulate() rejections as error values, not throws', async () => {
    const runner = createSimRunner(() =>
      Promise.resolve({
        simulate: () => Promise.reject(new Error('singular matrix')),
      } as unknown as Partial<SimModule>),
    );
    const out = await runner.run(graph, parts, TRAN, { branch: 'main', opsVersion: 1 });
    expect(out).toEqual({ ok: false, error: 'singular matrix' });
  });

  it('errors are not served from cache — a retry re-runs', async () => {
    let fail = true;
    const simulate = vi.fn((_g: unknown, _p: unknown, analysis: Analysis) =>
      fail ? Promise.reject(new Error('boom')) : Promise.resolve(mockResult(analysis)),
    );
    const runner = createSimRunner(() =>
      Promise.resolve({ simulate } as unknown as Partial<SimModule>),
    );

    const first = await runner.run(graph, parts, TRAN, { branch: 'main', opsVersion: 1 });
    expect(first.ok).toBe(false);
    fail = false;
    const second = await runner.run(graph, parts, TRAN, { branch: 'main', opsVersion: 1 });
    expect(second.ok).toBe(true);
    expect(simulate).toHaveBeenCalledTimes(2);
  });

  it('reports a friendly error while @protopulse/sim is still a stub', async () => {
    const runner = createSimRunner(() => Promise.resolve({} as Partial<SimModule>));
    const out = await runner.run(graph, parts, TRAN, { branch: 'main', opsVersion: 1 });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error).toMatch(/not available yet/);

    await expect(runner.simulate(graph, parts, TRAN)).rejects.toThrow(/not available yet/);
  });

  it('falls back to the local fidelity summary when the engine lacks one', async () => {
    const mod = makeModule();
    const runner = createSimRunner(() =>
      Promise.resolve({ simulate: mod.simulate } as unknown as Partial<SimModule>),
    );
    const out = await runner.run(graph, parts, TRAN, { branch: 'main', opsVersion: 1 });
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.fidelity).toBe(
        'Fidelity: 1 spice, 1 stub; STUB models: U1 (timer stubbed as ideal switch)',
      );
    }
  });

  it('runner.simulate is uncached (the Analyst decides when to run)', async () => {
    const mod = makeModule();
    const runner = createSimRunner(() => Promise.resolve(mod as unknown as Partial<SimModule>));
    await runner.simulate(graph, parts, TRAN);
    await runner.simulate(graph, parts, TRAN);
    expect(mod.simulate).toHaveBeenCalledTimes(2);
  });
});

describe('fallbackFidelitySummary', () => {
  it('counts tiers and calls out stubs with notes', () => {
    expect(
      fallbackFidelitySummary([
        { ref: 'R1', partId: 'core:resistor', tier: 'spice' },
        { ref: 'Q1', partId: 'core:2n3904', tier: 'behavioral' },
        { ref: 'U1', partId: 'core:ne555', tier: 'stub', note: 'ideal' },
      ]),
    ).toBe('Fidelity: 1 spice, 1 behavioral, 1 stub; STUB models: U1 (ideal)');
  });

  it('handles the empty manifest honestly', () => {
    expect(fallbackFidelitySummary([])).toBe('Fidelity: no models in manifest');
  });
});
