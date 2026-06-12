import { applyOp, emptyGraph, MM } from '@protopulse/graph';
import { seedPartDb } from '@protopulse/parts';
import { describe, expect, it } from 'vitest';

import { FakeProvider } from './fake-provider.js';
import { runRouter } from './router.js';
import { createRouterRegistry } from './tools/router.js';

import type { PinnedRouteRequest, RouterHooks } from './route-types.js';
import type { DesignGraph, OpBody } from '@protopulse/graph';

const parts = seedPartDb();

function board(): DesignGraph {
  const g = emptyGraph();
  const ops: OpBody[] = [
    { kind: 'add_component', id: 'ra', ref: 'R1', partId: 'core:resistor', partRev: 1 },
    { kind: 'add_component', id: 'rb', ref: 'R2', partId: 'core:resistor', partRev: 1 },
    { kind: 'connect', port: 'ra:2', newNetId: 'na' },
    { kind: 'connect', port: 'rb:1', netId: 'na' },
    { kind: 'rename_net', netId: 'na', name: 'SIG' },
    { kind: 'place_footprint', componentId: 'ra', at: { x: 0, y: 0 }, rotMilli: 0, side: 'top', locked: false },
    { kind: 'place_footprint', componentId: 'rb', at: { x: 10 * MM, y: 0 }, rotMilli: 0, side: 'top', locked: false },
  ];
  for (const op of ops) {
    const res = applyOp(g, op);
    if (!res.ok) throw new Error(res.error);
  }
  return g;
}

const SIG_TRACE: OpBody = {
  kind: 'route_trace',
  id: 't-sig',
  netId: 'na',
  layerId: 'F.Cu',
  widthNm: 200_000,
  path: [
    { x: 950_000, y: 0 },
    { x: 9_050_000, y: 0 },
  ],
};

/** Fake stack: one unrouted SIG pair until a SIG trace exists; walk
 *  refuses, shove succeeds; DRC reports clean once routed. */
function fakeHooks(log: PinnedRouteRequest[] = []): RouterHooks {
  return {
    ratsnest: (graph) =>
      [...graph.pcb.traces.values()].some((t) => t.netId === 'na')
        ? []
        : [
            {
              netId: 'na',
              netName: 'SIG',
              a: { x: 950_000, y: 0, label: 'R1:2' },
              b: { x: 9_050_000, y: 0, label: 'R2:1' },
            },
          ],
    route: (_graph, req) => {
      log.push(req);
      if (req.mode === 'walk') {
        return { ok: false, reason: 'Walkaround found no clear corridor' };
      }
      return { ok: true, ops: [SIG_TRACE], summary: 'routed SIG R1:2→R2:1 (shove, 0 victims)' };
    },
    drc: (graph) =>
      Promise.resolve(
        graph.pcb.traces.size > 0
          ? []
          : [{ severity: 'error' as const, code: 'DRC-UNROUTED', message: 'SIG unrouted' }],
      ),
  };
}

describe('router tools', () => {
  it('read_board digests placements, traces, and the ratsnest', () => {
    const registry = createRouterRegistry(fakeHooks());
    const res = registry.dispatch('read_board', {}, { graph: board(), parts });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.result.summary).toContain('2 footprint(s)');
    expect(res.result.summary).toContain('1 unrouted connection(s)');
    const data = res.result.data as { unrouted: { net: string; from: string }[] };
    expect(data.unrouted[0]).toMatchObject({ net: 'SIG', from: 'R1:2' });
  });

  it('route_connection resolves net names and surfaces refusals as errors', () => {
    const log: PinnedRouteRequest[] = [];
    const registry = createRouterRegistry(fakeHooks(log));
    const ctx = { graph: board(), parts };

    const refused = registry.dispatch('route_connection', { net: 'SIG', mode: 'walk' }, ctx);
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.error).toContain('no clear corridor');

    const ok = registry.dispatch('route_connection', { net: 'SIG', mode: 'shove' }, ctx);
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.result.ops[0]).toMatchObject({ kind: 'route_trace', netId: 'na' });
    expect(log.map((r) => r.mode)).toEqual(['walk', 'shove']);
    expect(log[0]?.netId).toBe('na'); // name resolved to id

    const unknown = registry.dispatch('route_connection', { net: 'GHOST', mode: 'walk' }, ctx);
    expect(unknown.ok).toBe(false);
  });

  it('run_drc is async and digests counts; remove_trace guards unknown ids', async () => {
    const registry = createRouterRegistry(fakeHooks());
    const ctx = { graph: board(), parts };
    const drc = await registry.dispatchAsync('run_drc', {}, ctx);
    expect(drc.ok).toBe(true);
    if (drc.ok) expect(drc.result.summary).toBe('DRC: 1 error(s), 0 warning(s)');

    const missing = registry.dispatch('remove_trace', { traceId: 'ghost' }, ctx);
    expect(missing.ok).toBe(false);
  });
});

describe('runRouter (FakeProvider end-to-end)', () => {
  it('walks the route → refusal → shove → DRC story and applies ops to the working copy', async () => {
    const provider = new FakeProvider([
      [{ kind: 'tool_use', id: 't1', name: 'read_board', input: {} }],
      [{ kind: 'tool_use', id: 't2', name: 'route_connection', input: { net: 'SIG', mode: 'walk' } }],
      [{ kind: 'tool_use', id: 't3', name: 'route_connection', input: { net: 'SIG', mode: 'shove' } }],
      [{ kind: 'tool_use', id: 't4', name: 'run_drc', input: {} }],
      [{ kind: 'text', text: 'Board routed: SIG landed via shove after walk refused. DRC: 0 errors.' }],
    ]);

    const result = await runRouter({
      prompt: 'route the board',
      graph: board(),
      parts,
      provider,
      hooks: fakeHooks(),
    });

    // The shove route landed; the walk refusal did not.
    expect(result.ops).toEqual([SIG_TRACE]);
    expect(result.envelopes).toHaveLength(1);
    expect(result.envelopes[0]?.meta).toMatchObject({ agent: 'router' });
    expect(result.envelopes[0]?.meta?.rationale).toContain('SIG');
    expect(result.finalText).toContain('Board routed');

    // The refusal travelled back to the model as an error tool_result.
    const flat = JSON.stringify(result.transcript);
    expect(flat).toContain('no clear corridor');
    // And the post-route DRC saw the trace on the WORKING copy: clean.
    expect(flat).toContain('DRC: 0 error(s)');
  });

  it('destructive routing honors the confirm gate', async () => {
    const provider = new FakeProvider([
      [{ kind: 'tool_use', id: 't1', name: 'route_connection', input: { net: 'SIG', mode: 'shove' } }],
      [{ kind: 'text', text: 'declined' }],
    ]);
    const result = await runRouter({
      prompt: 'route it',
      graph: board(),
      parts,
      provider,
      hooks: fakeHooks(),
      confirmDestructive: () => false,
    });
    expect(result.ops).toEqual([]);
    expect(JSON.stringify(result.transcript)).toContain('user declined');
  });
});
