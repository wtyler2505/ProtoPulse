import { describe, expect, it } from 'vitest';
import {
  SCHEMATIC_GRID,
  applyOp,
  materialize,
  type DesignGraph,
  type OpBody,
  type OpEnvelope,
} from '@protopulse/graph';
import { seedPartDb, type PartDb } from '@protopulse/parts';
import { createDraftsmanRegistry, snapMmToGrid, DRAFTSMAN_TOOL_NAMES } from './draftsman.js';
import type { ToolCtx, ToolResult } from '../registry.js';

const parts: PartDb = seedPartDb();

function env(lamport: number, op: OpBody): OpEnvelope {
  return { actor: 'test', lamport, ts: 0, op };
}

/** A real materialized graph: R1 (330) and D1 (led), both placed. */
function fixtureGraph(): DesignGraph {
  const rRev = parts.latest('core:resistor')?.rev ?? 1;
  const dRev = parts.latest('core:led')?.rev ?? 1;
  const result = materialize([
    env(1, { kind: 'add_component', id: 'c-r1', ref: 'R1', partId: 'core:resistor', partRev: rRev, value: '330' }),
    env(2, { kind: 'place_symbol', componentId: 'c-r1', at: { x: 0, y: 0 }, rot: 0, mirror: false }),
    env(3, { kind: 'add_component', id: 'c-d1', ref: 'D1', partId: 'core:led', partRev: dRev }),
    env(4, { kind: 'place_symbol', componentId: 'c-d1', at: { x: 8 * SCHEMATIC_GRID, y: 0 }, rot: 0, mirror: false }),
  ]);
  expect(result.warnings).toEqual([]);
  return result.graph;
}

function ctxOf(graph: DesignGraph): ToolCtx {
  return { graph, parts };
}

const registry = createDraftsmanRegistry();

function run(name: string, input: unknown, ctx: ToolCtx): ToolResult {
  const res = registry.dispatch(name, input, ctx);
  if (!res.ok) throw new Error(res.error);
  return res.result;
}

function apply(graph: DesignGraph, ops: OpBody[]): void {
  for (const op of ops) {
    const res = applyOp(graph, op);
    expect(res.ok, res.ok ? '' : res.error).toBe(true);
  }
}

describe('draftsman registry shape', () => {
  it('exposes exactly the 8 M1 tools', () => {
    expect(registry.names().sort()).toEqual([...DRAFTSMAN_TOOL_NAMES].sort());
    expect(registry.names()).toHaveLength(8);
  });

  it('all mutating tools are destructive; run_erc is not', () => {
    for (const name of DRAFTSMAN_TOOL_NAMES) {
      const tool = registry.get(name);
      expect(tool?.destructive).toBe(name !== 'run_erc');
    }
    expect(registry.get('run_erc')?.costClass).toBe('cheap');
  });
});

describe('add_component', () => {
  it('auto-assigns the next free ref from the part refPrefix', () => {
    const graph = fixtureGraph();
    const result = run('add_component', { part_id: 'core:resistor', value: '10k' }, ctxOf(graph));
    expect(result.data).toMatchObject({ ref: 'R2' }); // R1 taken
    apply(graph, result.ops);
    const comp = [...graph.components.values()].find((c) => c.ref === 'R2');
    expect(comp?.value).toBe('10k');
    expect(comp?.partId).toBe('core:resistor');
    expect(graph.schematic.placements.has(comp?.id ?? '')).toBe(true);
  });

  it('returns one batch op containing add_component + place_symbol', () => {
    const result = run('add_component', { part_id: 'core:led' }, ctxOf(fixtureGraph()));
    expect(result.ops).toHaveLength(1);
    const op = result.ops[0];
    expect(op?.kind).toBe('batch');
    if (op?.kind === 'batch') {
      expect(op.ops.map((o) => o.kind)).toEqual(['add_component', 'place_symbol']);
    }
  });

  it('snaps explicit mm coordinates to the schematic grid', () => {
    const graph = fixtureGraph();
    const result = run(
      'add_component',
      { part_id: 'core:capacitor', at: { x_mm: 10, y_mm: 20 } },
      ctxOf(graph),
    );
    apply(graph, result.ops);
    const data = result.data as { component_id: string };
    const placement = graph.schematic.placements.get(data.component_id);
    expect(placement).toBeDefined();
    expect((placement?.at.x ?? 1) % SCHEMATIC_GRID).toBe(0);
    expect((placement?.at.y ?? 1) % SCHEMATIC_GRID).toBe(0);
    expect(placement?.at.x).toBe(snapMmToGrid(10));
    expect(placement?.at.y).toBe(snapMmToGrid(20));
  });

  it('default placement cursor skips occupied cells', () => {
    const graph = fixtureGraph(); // R1 sits at (0,0) — the first cursor cell
    const result = run('add_component', { part_id: 'core:battery' }, ctxOf(graph));
    apply(graph, result.ops);
    const data = result.data as { component_id: string };
    const placement = graph.schematic.placements.get(data.component_id);
    expect(placement?.at).not.toEqual({ x: 0, y: 0 });
  });

  it('rejects unknown part ids instead of inventing them', () => {
    const res = registry.dispatch('add_component', { part_id: 'core:flux-capacitor' }, ctxOf(fixtureGraph()));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/unknown part id/);
  });

  it('rejects an explicit ref that is already taken', () => {
    const res = registry.dispatch(
      'add_component',
      { part_id: 'core:resistor', ref: 'R1' },
      ctxOf(fixtureGraph()),
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/already in use/);
  });

  it('explain() narrates the placement', () => {
    const tool = registry.get('add_component');
    const line = tool?.explain({ part_id: 'core:resistor', value: '10k', ref: 'R3', at: { x_mm: 10, y_mm: 20 } });
    expect(line).toBe('Place a core:resistor "10k" as R3 at (10, 20)mm');
  });
});

describe('connect — the 4-case matrix', () => {
  it('neither port on a net → new net via connect+connect', () => {
    const graph = fixtureGraph();
    const result = run('connect', { from_port: 'R1:2', to_port: 'D1:A' }, ctxOf(graph));
    expect(result.ops.map((o) => o.kind)).toEqual(['connect', 'connect']);
    apply(graph, result.ops);
    expect(graph.nets.size).toBe(1);
    const net = [...graph.nets.values()][0];
    expect(net?.ports).toEqual(['c-d1:A', 'c-r1:2']);
    const data = result.data as { net_id: string; net_name: string };
    expect(data.net_id).toBe(net?.id);
    expect(data.net_name).toBe(net?.name); // predicted N$1 matches applied name
  });

  it('one port on a net → single connect onto that net', () => {
    const graph = fixtureGraph();
    apply(graph, run('connect', { from_port: 'R1:2', to_port: 'D1:A' }, ctxOf(graph)).ops);
    const result = run('connect', { from_port: 'R1:1', to_port: 'R1:2' }, ctxOf(graph));
    expect(result.ops).toHaveLength(1);
    expect(result.ops[0]?.kind).toBe('connect');
    apply(graph, result.ops);
    expect(graph.nets.size).toBe(1);
    expect([...graph.nets.values()][0]?.ports).toHaveLength(3);
  });

  it('ports on different nets → merge_nets', () => {
    const graph = fixtureGraph();
    apply(graph, run('connect', { from_port: 'R1:1', to_port: 'R1:2' }, ctxOf(graph)).ops); // net 1
    apply(graph, run('connect', { from_port: 'D1:A', to_port: 'D1:K' }, ctxOf(graph)).ops); // net 2
    expect(graph.nets.size).toBe(2);
    const result = run('connect', { from_port: 'R1:2', to_port: 'D1:A' }, ctxOf(graph));
    expect(result.ops).toHaveLength(1);
    expect(result.ops[0]?.kind).toBe('merge_nets');
    apply(graph, result.ops);
    expect(graph.nets.size).toBe(1);
    expect([...graph.nets.values()][0]?.ports).toHaveLength(4);
  });

  it('both ports already on the same net → no-op with a saying-so summary', () => {
    const graph = fixtureGraph();
    apply(graph, run('connect', { from_port: 'R1:2', to_port: 'D1:A' }, ctxOf(graph)).ops);
    const result = run('connect', { from_port: 'R1:2', to_port: 'D1:A' }, ctxOf(graph));
    expect(result.ops).toEqual([]);
    expect(result.summary).toMatch(/already on net/);
  });

  it('resolves refs, not UUIDs — bad ref and bad pin both error', () => {
    const graph = fixtureGraph();
    const badRef = registry.dispatch('connect', { from_port: 'R9:1', to_port: 'D1:A' }, ctxOf(graph));
    expect(badRef.ok).toBe(false);
    if (!badRef.ok) expect(badRef.error).toMatch(/no component with ref R9/);
    const badPin = registry.dispatch('connect', { from_port: 'R1:7', to_port: 'D1:A' }, ctxOf(graph));
    expect(badPin.ok).toBe(false);
    if (!badPin.ok) expect(badPin.error).toMatch(/pin 7 does not exist/);
  });
});

describe('place_symbol', () => {
  it('emits move_symbol when already placed, snapped to grid', () => {
    const graph = fixtureGraph();
    const result = run('place_symbol', { ref: 'R1', at: { x_mm: 25.4, y_mm: 12.7 }, rot: 90 }, ctxOf(graph));
    expect(result.ops[0]?.kind).toBe('move_symbol');
    apply(graph, result.ops);
    const placement = graph.schematic.placements.get('c-r1');
    expect(placement?.at).toEqual({ x: snapMmToGrid(25.4), y: snapMmToGrid(12.7) });
    expect(placement?.rot).toBe(90);
  });

  it('emits place_symbol when not yet placed', () => {
    const graph = fixtureGraph();
    graph.schematic.placements.delete('c-r1');
    const result = run('place_symbol', { ref: 'R1', at: { x_mm: 0, y_mm: 0 } }, ctxOf(graph));
    expect(result.ops[0]?.kind).toBe('place_symbol');
  });
});

describe('set_wire_geometry', () => {
  it('APPENDS to existing geometry with nm conversion', () => {
    const graph = fixtureGraph();
    apply(graph, run('connect', { from_port: 'R1:2', to_port: 'D1:A' }, ctxOf(graph)).ops);
    const net = [...graph.nets.values()][0];
    expect(net).toBeDefined();
    if (!net) return;

    apply(graph, run('set_wire_geometry', {
      net: net.name,
      segments: [{ ax_mm: 0, ay_mm: 0, bx_mm: 10, by_mm: 0 }],
    }, ctxOf(graph)).ops);
    expect(graph.schematic.wires.get(net.id)).toHaveLength(1);

    const second = run('set_wire_geometry', {
      net: net.id, // by id this time
      segments: [{ ax_mm: 10, ay_mm: 0, bx_mm: 10, by_mm: 10 }],
    }, ctxOf(graph));
    apply(graph, second.ops);
    const wires = graph.schematic.wires.get(net.id);
    expect(wires).toHaveLength(2);
    expect(wires?.[1]?.b).toEqual({ x: snapMmToGrid(10), y: snapMmToGrid(10) });
  });

  it('errors on unknown net', () => {
    const res = registry.dispatch('set_wire_geometry', {
      net: 'NOPE',
      segments: [{ ax_mm: 0, ay_mm: 0, bx_mm: 1, by_mm: 1 }],
    }, ctxOf(fixtureGraph()));
    expect(res.ok).toBe(false);
  });
});

describe('rename_net', () => {
  it('renames by current name and by id', () => {
    const graph = fixtureGraph();
    apply(graph, run('connect', { from_port: 'R1:2', to_port: 'D1:A' }, ctxOf(graph)).ops);
    const net = [...graph.nets.values()][0];
    if (!net) throw new Error('net missing');

    apply(graph, run('rename_net', { net: net.name, new_name: 'LED_ANODE' }, ctxOf(graph)).ops);
    expect(graph.nets.get(net.id)?.name).toBe('LED_ANODE');

    apply(graph, run('rename_net', { net: net.id, new_name: 'VLED' }, ctxOf(graph)).ops);
    expect(graph.nets.get(net.id)?.name).toBe('VLED');
  });
});

describe('add_constraint', () => {
  it('adds a current_max constraint with a fresh uuid and rationale', () => {
    const graph = fixtureGraph();
    apply(graph, run('connect', { from_port: 'R1:2', to_port: 'D1:A' }, ctxOf(graph)).ops);
    const net = [...graph.nets.values()][0];
    if (!net) throw new Error('net missing');
    const result = run('add_constraint', {
      kind: 'current_max', net: net.name, amps: 0.02, rationale: 'LED If limit',
    }, ctxOf(graph));
    apply(graph, result.ops);
    expect(graph.constraints.size).toBe(1);
    const constraint = [...graph.constraints.values()][0];
    expect(constraint?.body).toEqual({ kind: 'current_max', netId: net.id, amps: 0.02 });
    expect(constraint?.rationale).toBe('LED If limit');
    expect(constraint?.id.length).toBeGreaterThan(10);
  });

  it('rejects non-current_max kinds (M1 scope)', () => {
    const res = registry.dispatch('add_constraint', {
      kind: 'thermal_limit', net: 'X', amps: 1,
    }, ctxOf(fixtureGraph()));
    expect(res.ok).toBe(false);
  });
});

describe('run_erc', () => {
  it('returns findings as data and a count summary, with zero ops', () => {
    const rev = parts.latest('core:ne555')?.rev ?? 1;
    const result = materialize([
      env(1, { kind: 'add_component', id: 'c-u1', ref: 'U1', partId: 'core:ne555', partRev: rev }),
    ]);
    const out = run('run_erc', {}, ctxOf(result.graph));
    expect(out.ops).toEqual([]);
    const findings = out.data as { severity: string; code: string; message: string }[];
    // A bare 555 floats every input and supply pin.
    expect(findings.length).toBeGreaterThan(0);
    expect(findings.some((f) => f.code === 'ERC-FLOATING-INPUT')).toBe(true);
    expect(out.summary).toMatch(/^\d+ errors?, \d+ warnings?/);
  });

  it('summarizes a clean design as clean', () => {
    const out = run('run_erc', {}, ctxOf(fixtureGraph()));
    expect(out.summary).toMatch(/ERC clean/);
  });
});

describe('batch', () => {
  it('composes steps into ONE batch op; later steps see earlier components', () => {
    const graph = fixtureGraph();
    const result = run('batch', {
      label: 'LED current limiter',
      steps: [
        { tool: 'add_component', input: { part_id: 'core:resistor', value: '330', ref: 'R5' } },
        { tool: 'connect', input: { from_port: 'R5:2', to_port: 'D1:A' } },
      ],
    }, ctxOf(graph));
    expect(result.ops).toHaveLength(1);
    const op = result.ops[0];
    expect(op?.kind).toBe('batch');
    if (op?.kind === 'batch') {
      expect(op.label).toBe('LED current limiter');
      expect(op.ops.length).toBeGreaterThanOrEqual(3); // add batch(add+place) flattened + 2 connects
    }
    apply(graph, result.ops);
    expect([...graph.components.values()].some((c) => c.ref === 'R5')).toBe(true);
    expect(graph.nets.size).toBe(1);
  });

  it('validates each step against the scoped registry — unknown tool fails the batch', () => {
    const res = registry.dispatch('batch', {
      steps: [{ tool: 'order_pizza', input: {} }],
    }, ctxOf(fixtureGraph()));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/step 1 \(order_pizza\): unknown or out-of-scope/);
  });

  it('surfaces member zod validation errors with the step index', () => {
    const res = registry.dispatch('batch', {
      steps: [{ tool: 'connect', input: { from_port: 'R1:1' } }],
    }, ctxOf(fixtureGraph()));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/step 1 \(connect\).*to_port/);
  });

  it('refuses nested batch', () => {
    const res = registry.dispatch('batch', {
      steps: [{ tool: 'batch', input: { steps: [{ tool: 'run_erc', input: {} }] } }],
    }, ctxOf(fixtureGraph()));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/cannot nest batch/);
  });

  it('is destructive iff any member is', () => {
    const tool = registry.get('batch');
    expect(tool?.destructiveFor?.({ steps: [{ tool: 'run_erc', input: {} }] })).toBe(false);
    expect(
      tool?.destructiveFor?.({
        steps: [{ tool: 'run_erc', input: {} }, { tool: 'rename_net', input: { net: 'a', new_name: 'b' } }],
      }),
    ).toBe(true);
  });
});

describe('explain()', () => {
  it('every draftsman tool narrates a one-liner', () => {
    const inputs: Record<string, unknown> = {
      add_component: { part_id: 'core:led' },
      connect: { from_port: 'R1:1', to_port: 'D1:A' },
      place_symbol: { ref: 'R1', at: { x_mm: 5, y_mm: 5 } },
      set_wire_geometry: { net: 'N$1', segments: [{ ax_mm: 0, ay_mm: 0, bx_mm: 1, by_mm: 1 }] },
      rename_net: { net: 'N$1', new_name: 'VCC' },
      add_constraint: { kind: 'current_max', net: 'VCC', amps: 0.5 },
      run_erc: {},
      batch: { steps: [{ tool: 'run_erc', input: {} }] },
    };
    for (const name of DRAFTSMAN_TOOL_NAMES) {
      const tool = registry.get(name);
      const line = tool?.explain(inputs[name]);
      expect(line, name).toBeTruthy();
      expect(line?.length ?? 0).toBeGreaterThan(5);
    }
  });
});
