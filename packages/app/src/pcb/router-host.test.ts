import { applyOp, emptyGraph, MM } from '@protopulse/graph';
import { afterEach, describe, expect, it } from 'vitest';

import { createRouterHooks } from './router-host.js';
import { resetRoutingClearanceForTests } from './routing.js';

import type { DesignGraph, OpBody } from '@protopulse/graph';

/** Real engines end to end: real seed footprints, real walkaround,
 *  real shove, real DRC module — only the deck clearance is pinned. */

const CLEARANCE = 127_000;

afterEach(() => {
  resetRoutingClearanceForTests(null);
});

function board(extra: OpBody[] = []): DesignGraph {
  const g = emptyGraph();
  const ops: OpBody[] = [
    { kind: 'add_component', id: 'ra', ref: 'R1', partId: 'core:resistor', partRev: 1, value: '1k' },
    { kind: 'add_component', id: 'rb', ref: 'R2', partId: 'core:resistor', partRev: 1, value: '2k' },
    { kind: 'connect', port: 'ra:2', newNetId: 'na' },
    { kind: 'connect', port: 'rb:1', netId: 'na' },
    { kind: 'connect', port: 'ra:1', newNetId: 'nb' },
    { kind: 'connect', port: 'rb:2', netId: 'nb' },
    { kind: 'rename_net', netId: 'na', name: 'SIG' },
    { kind: 'place_footprint', componentId: 'ra', at: { x: 0, y: 0 }, rotMilli: 0, side: 'top', locked: false },
    { kind: 'place_footprint', componentId: 'rb', at: { x: 10 * MM, y: 0 }, rotMilli: 0, side: 'top', locked: false },
    ...extra,
  ];
  for (const op of ops) {
    const res = applyOp(g, op);
    if (!res.ok) throw new Error(res.error);
  }
  return g;
}

const CROSSING: OpBody = {
  kind: 'route_trace',
  id: 'crossing',
  netId: 'nb',
  layerId: 'F.Cu',
  widthNm: 250_000,
  path: [
    { x: 5 * MM, y: -3 * MM },
    { x: 5 * MM, y: 3 * MM },
  ],
};

describe('router hooks (real engines)', () => {
  it('ratsnest reports labeled unrouted pairs', () => {
    resetRoutingClearanceForTests(CLEARANCE);
    const hooks = createRouterHooks();
    const pairs = hooks.ratsnest(board());
    const sig = pairs.find((p) => p.netName === 'SIG');
    expect(sig).toBeDefined();
    expect([sig?.a.label, sig?.b.label].sort()).toEqual(['R1:2', 'R2:1']);
  });

  it('walk mode routes a clear corridor; applying the op empties that ratsnest entry', () => {
    resetRoutingClearanceForTests(CLEARANCE);
    const hooks = createRouterHooks();
    const graph = board();
    const outcome = hooks.route(graph, { netId: 'na', mode: 'walk', layerId: 'F.Cu' });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.summary).toContain('walk');
    for (const op of outcome.ops) {
      const res = applyOp(graph, op);
      expect(res.ok).toBe(true);
    }
    expect(hooks.ratsnest(graph).filter((p) => p.netId === 'na')).toHaveLength(0);
  });

  it('shove mode pushes a crossing trace aside (victim reroute ops included)', () => {
    resetRoutingClearanceForTests(CLEARANCE);
    const hooks = createRouterHooks();
    const graph = board([CROSSING]);
    const outcome = hooks.route(graph, { netId: 'na', mode: 'shove', layerId: 'F.Cu' });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.summary).toContain('1 trace(s) moved aside');
    expect(outcome.ops.map((o) => o.kind)).toEqual(['route_trace', 'remove_trace', 'route_trace']);
    // The whole shove applies cleanly.
    for (const op of outcome.ops) expect(applyOp(graph, op).ok).toBe(true);
  });

  it('refuses while the deck is loading, and on nets with nothing to route', () => {
    resetRoutingClearanceForTests(null);
    const hooks = createRouterHooks();
    const loading = hooks.route(board(), { netId: 'na', mode: 'walk', layerId: 'F.Cu' });
    expect(loading.ok).toBe(false);
    if (!loading.ok) expect(loading.reason).toContain('deck');

    resetRoutingClearanceForTests(CLEARANCE);
    const ghost = hooks.route(board(), { netId: 'ghost', mode: 'walk', layerId: 'F.Cu' });
    expect(ghost.ok).toBe(false);
  });

  it('drc runs the real module against the graph', async () => {
    resetRoutingClearanceForTests(CLEARANCE);
    const hooks = createRouterHooks();
    const findings = await hooks.drc(board());
    expect(Array.isArray(findings)).toBe(true);
    // Unrouted SIG/nb connections must surface as findings on this deck.
    expect(findings.some((f) => f.code.toLowerCase().includes('unrouted'))).toBe(true);
  });
});
