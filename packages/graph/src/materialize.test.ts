import { describe, expect, it } from 'vitest';

import { materialize } from './materialize.js';
import { compareEnvelopes, opEnvelopeSchema, opId } from './ops.js';
import { graphFromJson, graphToJson } from './store/serialize.js';
import { envelopes, ledCircuitOps } from './test-helpers.js';

import type { OpEnvelope } from './ops.js';

/** Deterministic shuffle (LCG) so failures reproduce. */
function shuffled<T>(items: readonly T[], seed: number): T[] {
  const out = [...items];
  let s = seed;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) % 2147483648;
    const j = s % (i + 1);
    const a = out[i] as T;
    out[i] = out[j] as T;
    out[j] = a;
  }
  return out;
}

function snapshotString(envs: readonly OpEnvelope[]): string {
  const { graph } = materialize(envs);
  return JSON.stringify(graphToJson(graph));
}

describe('materialize', () => {
  it('replays the LED circuit to the expected graph', () => {
    const { graph, warnings, violations } = materialize(envelopes(ledCircuitOps()));
    expect(warnings).toEqual([]);
    expect(violations).toEqual([]);
    expect(graph.components.size).toBe(3);
    expect(graph.nets.size).toBe(3);
    expect([...graph.nets.values()].map((n) => n.name).sort()).toEqual(['GND', 'N$1', 'N$2']);
  });

  it('is deterministic: shuffled envelopes materialize to the identical graph', () => {
    const envs = envelopes(ledCircuitOps());
    const reference = snapshotString(envs);
    for (const seed of [1, 42, 1337, 99991]) {
      expect(snapshotString(shuffled(envs, seed))).toBe(reference);
    }
  });

  it('orders by (lamport, actorId): same lamport breaks ties lexicographically', () => {
    const a: OpEnvelope = {
      actor: 'aaa',
      lamport: 1,
      ts: 0,
      op: { kind: 'set_design_meta', patch: { who: 'aaa' } },
    };
    const b: OpEnvelope = {
      actor: 'bbb',
      lamport: 1,
      ts: 0,
      op: { kind: 'set_design_meta', patch: { who: 'bbb' } },
    };
    expect(compareEnvelopes(a, b)).toBeLessThan(0);
    expect(compareEnvelopes(b, a)).toBeGreaterThan(0);
    expect(compareEnvelopes(a, a)).toBe(0);
    // Later actor wins the last-write on the same key.
    const { graph } = materialize([b, a]);
    expect(graph.meta.who).toBe('bbb');
  });

  it('skips failed ops with a warning and keeps going', () => {
    const envs = envelopes([
      { kind: 'add_component', id: 'c1', ref: 'R1', partId: 'p1', partRev: 1 },
      { kind: 'connect', port: 'ghost:1', netId: 'nope' }, // fails
      { kind: 'connect', port: 'c1:1', newNetId: 'n1' }, // still applies
    ]);
    const { graph, warnings } = materialize(envs);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({ kind: 'apply_failed', opId: 'test-actor@2' });
    expect(graph.nets.has('n1')).toBe(true);
  });

  it('surfaces apply warnings (net GC) with op attribution', () => {
    const envs = envelopes([
      { kind: 'add_component', id: 'c1', ref: 'R1', partId: 'p1', partRev: 1 },
      { kind: 'connect', port: 'c1:1', newNetId: 'n1' },
      { kind: 'disconnect', port: 'c1:1' },
    ]);
    const { warnings } = materialize(envs);
    expect(warnings.some((w) => w.kind === 'apply_warning' && w.detail?.code === 'net_gc')).toBe(true);
  });

  it('snapshot fast-path: from + tail === full replay', () => {
    const all = envelopes(ledCircuitOps());
    const cut = 6;
    const head = all.slice(0, cut);
    const tail = all.slice(cut);
    const { graph: snapshot } = materialize(head);
    // Round-trip the snapshot through JSON like a real .snap file would.
    const restored = graphFromJson(JSON.parse(JSON.stringify(graphToJson(snapshot))));
    const viaSnapshot = materialize(tail, { from: restored });
    const full = materialize(all);
    expect(JSON.stringify(graphToJson(viaSnapshot.graph))).toBe(
      JSON.stringify(graphToJson(full.graph)),
    );
  });

  it('validate modes: per-op, final, off', () => {
    const envs = envelopes(ledCircuitOps());
    expect(materialize(envs, { validate: 'per-op' }).violations).toEqual([]);
    expect(materialize(envs, { validate: 'final' }).violations).toEqual([]);
    expect(materialize(envs, { validate: 'off' }).violations).toEqual([]);
  });

  it('pinExists option flags unknown pins as violations', () => {
    const envs = envelopes([
      { kind: 'add_component', id: 'c1', ref: 'R1', partId: 'p1', partRev: 1 },
      { kind: 'connect', port: 'c1:1', newNetId: 'n1' },
      { kind: 'connect', port: 'c1:99', netId: 'n1' },
    ]);
    const { violations } = materialize(envs, {
      pinExists: (_partId, _rev, pinKey) => pinKey === '1' || pinKey === '2',
    });
    expect(violations.some((v) => v.code === 'unknown_pin')).toBe(true);
  });

  it('opId and envelope schema round-trip', () => {
    const env: OpEnvelope = {
      actor: 'a1',
      lamport: 7,
      ts: 123,
      op: { kind: 'checkpoint', label: 'x' },
      meta: { rationale: 'why', agent: 'draftsman' },
    };
    expect(opId(env)).toBe('a1@7');
    expect(opEnvelopeSchema.parse(JSON.parse(JSON.stringify(env)))).toEqual(env);
  });

  it('rejects non-integer coordinates at the schema boundary', () => {
    expect(() =>
      opEnvelopeSchema.parse({
        actor: 'a',
        lamport: 1,
        ts: 0,
        op: { kind: 'place_symbol', componentId: 'c1', at: { x: 1.5, y: 0 }, rot: 0, mirror: false },
      }),
    ).toThrow();
    expect(() =>
      opEnvelopeSchema.parse({
        actor: 'a',
        lamport: 1,
        ts: 0,
        op: { kind: 'place_symbol', componentId: 'c1', at: { x: 0, y: 0 }, rot: 45, mirror: false },
      }),
    ).toThrow();
  });

  it('property test: random op soup materializes without invariant violations', () => {
    // Seeded generator emits plausible-but-racy op sequences; whatever
    // applies must never corrupt the graph.
    let s = 20260610;
    const rand = (n: number): number => {
      s = (s * 1103515245 + 12345) % 2147483648;
      return s % n;
    };
    for (let run = 0; run < 25; run++) {
      const ops = [];
      const compIds = ['x1', 'x2', 'x3', 'x4'];
      const netIds = ['m1', 'm2', 'm3'];
      for (let i = 0; i < 60; i++) {
        const c = compIds[rand(compIds.length)]!;
        const n = netIds[rand(netIds.length)]!;
        const pick = rand(7);
        if (pick === 0) {
          ops.push({ kind: 'add_component', id: c, ref: `R${c}`, partId: 'p1', partRev: 1 } as const);
        } else if (pick === 1) {
          ops.push({ kind: 'remove_component', id: c } as const);
        } else if (pick === 2) {
          ops.push({ kind: 'connect', port: `${c}:1`, newNetId: n } as const);
        } else if (pick === 3) {
          ops.push({ kind: 'connect', port: `${c}:${String(rand(3))}`, netId: n } as const);
        } else if (pick === 4) {
          ops.push({ kind: 'disconnect', port: `${c}:1` } as const);
        } else if (pick === 5) {
          ops.push({
            kind: 'place_symbol',
            componentId: c,
            at: { x: rand(100) * 1270000, y: rand(100) * 1270000 },
            rot: 0,
            mirror: false,
          } as const);
        } else {
          ops.push({ kind: 'merge_nets', survivor: n, absorbed: netIds[rand(netIds.length)]! } as const);
        }
      }
      const { violations } = materialize(envelopes([...ops]));
      expect(violations).toEqual([]);
    }
  });
});

describe('op schema — batch', () => {
  it('parses batches (including nested) through the lazy schema', () => {
    const env: OpEnvelope = {
      actor: 'a',
      lamport: 1,
      ts: 0,
      op: {
        kind: 'batch',
        label: 'outer',
        parents: ['x@1', 'y@2'],
        ops: [
          { kind: 'checkpoint', label: 'inner' },
          { kind: 'batch', label: 'nested', ops: [{ kind: 'set_design_meta', patch: { a: '1' } }] },
        ],
      },
    };
    expect(opEnvelopeSchema.parse(JSON.parse(JSON.stringify(env)))).toEqual(env);
    expect(() =>
      opEnvelopeSchema.parse({ actor: 'a', lamport: 1, ts: 0, op: { kind: 'warp_core_breach' } }),
    ).toThrow();
  });
});
