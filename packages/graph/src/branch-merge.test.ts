import { describe, expect, it } from 'vitest';

import { BranchLog, MAIN_BRANCH } from './branch.js';
import { materialize } from './materialize.js';
import { resolveConflict, threeWayMerge } from './merge.js';
import { envelopes, ledCircuitOps, FIX } from './test-helpers.js';

import type { OpBody, OpEnvelope } from './ops.js';
import type { DesignGraph } from './types.js';

function env(op: OpBody, lamport: number, actor = 'a'): OpEnvelope {
  return { actor, lamport, ts: 0, op };
}

describe('BranchLog', () => {
  it('starts with main and appends ops', () => {
    const log = new BranchLog();
    expect(log.names()).toEqual([MAIN_BRANCH]);
    log.append(MAIN_BRANCH, env({ kind: 'checkpoint', label: 'a' }, 1));
    expect(log.opsFor(MAIN_BRANCH)).toHaveLength(1);
  });

  it('branching is a pointer: base ops stay shared, later main ops are not inherited', () => {
    const log = new BranchLog();
    const baseOps = envelopes(ledCircuitOps());
    for (const e of baseOps) log.append(MAIN_BRANCH, e);
    log.createBranch('try-alt', MAIN_BRANCH);
    // main moves on
    log.append(MAIN_BRANCH, env({ kind: 'rename_net', netId: FIX.netA, name: 'MAIN_ONLY' }, 100));
    // branch gets its own op
    log.append('try-alt', env({ kind: 'rename_net', netId: FIX.netA, name: 'BRANCH_ONLY' }, 100, 'b'));
    const mainGraph = materialize(log.opsFor(MAIN_BRANCH)).graph;
    const branchGraph = materialize(log.opsFor('try-alt')).graph;
    expect(mainGraph.nets.get(FIX.netA)?.name).toBe('MAIN_ONLY');
    expect(branchGraph.nets.get(FIX.netA)?.name).toBe('BRANCH_ONLY');
    // fork point
    expect(materialize(log.baseOpsFor('try-alt')).graph.nets.get(FIX.netA)?.name).toBe('N$1');
  });

  it('nested branches resolve recursively', () => {
    const log = new BranchLog();
    log.append(MAIN_BRANCH, env({ kind: 'set_design_meta', patch: { a: '1' } }, 1));
    log.createBranch('b1', MAIN_BRANCH);
    log.append('b1', env({ kind: 'set_design_meta', patch: { b: '2' } }, 2));
    log.createBranch('b2', 'b1');
    log.append('b2', env({ kind: 'set_design_meta', patch: { c: '3' } }, 3));
    const g = materialize(log.opsFor('b2')).graph;
    expect(g.meta).toEqual({ a: '1', b: '2', c: '3' });
    expect(log.baseOpsFor(MAIN_BRANCH)).toEqual([]);
  });

  it('rejects duplicate branch names and unknown branches', () => {
    const log = new BranchLog();
    log.createBranch('x', MAIN_BRANCH);
    expect(() => log.createBranch('x', MAIN_BRANCH)).toThrow('already exists');
    expect(() => log.get('ghost')).toThrow('does not exist');
    expect(log.has('x')).toBe(true);
    expect(log.entries().map((b) => b.name)).toEqual([MAIN_BRANCH, 'x']);
  });
});

describe('threeWayMerge', () => {
  function fork(): { base: DesignGraph; baseOps: OpBody[] } {
    return { base: materialize(envelopes(ledCircuitOps())).graph, baseOps: ledCircuitOps() };
  }

  function applyAll(baseOps: OpBody[], extra: OpBody[]): DesignGraph {
    return materialize(envelopes([...baseOps, ...extra])).graph;
  }

  function mergedGraph(ours: DesignGraph, autoOps: OpBody[]): DesignGraph {
    const result = materialize(
      autoOps.map((op, i) => ({ actor: 'merge', lamport: i + 1, ts: 0, op })),
      { from: ours },
    );
    expect(result.warnings.filter((w) => w.kind === 'apply_failed')).toEqual([]);
    expect(result.violations).toEqual([]);
    return result.graph;
  }

  it('auto-merges disjoint additions (component + placement + new net)', () => {
    const { base, baseOps } = fork();
    const ours = applyAll(baseOps, [
      { kind: 'rename_net', netId: FIX.netA, name: 'VCC' },
    ]);
    const theirs = applyAll(baseOps, [
      { kind: 'add_component', id: 'c9', ref: 'C9', partId: 'p-cap', partRev: 1, value: '100nF' },
      { kind: 'place_symbol', componentId: 'c9', at: { x: 0, y: 5080000 }, rot: 0, mirror: false },
      { kind: 'connect', port: 'c9:1', netId: FIX.netA },
      { kind: 'connect', port: 'c9:2', newNetId: 'n9' },
      { kind: 'set_component_props', id: 'c9', props: { dnp: true } },
    ]);
    const { autoOps, conflicts } = threeWayMerge(base, ours, theirs);
    expect(conflicts).toEqual([]);
    const merged = mergedGraph(ours, autoOps);
    expect(merged.components.has('c9')).toBe(true);
    expect(merged.components.get('c9')?.dnp).toBe(true);
    expect(merged.nets.get(FIX.netA)?.name).toBe('VCC'); // ours kept
    expect(merged.nets.get(FIX.netA)?.ports).toContain('c9:1');
    expect(merged.nets.has('n9')).toBe(true);
    expect(merged.schematic.placements.has('c9')).toBe(true);
  });

  it('auto-merges different properties on the same entity', () => {
    const { base, baseOps } = fork();
    const ours = applyAll(baseOps, [
      { kind: 'set_component_props', id: FIX.r1, props: { value: '470' } },
    ]);
    const theirs = applyAll(baseOps, [
      { kind: 'set_component_props', id: FIX.r1, props: { dnp: true } },
    ]);
    const { autoOps, conflicts } = threeWayMerge(base, ours, theirs);
    expect(conflicts).toEqual([]);
    const merged = mergedGraph(ours, autoOps);
    expect(merged.components.get(FIX.r1)).toMatchObject({ value: '470', dnp: true });
  });

  it('same property, different values → property conflict, nothing silent', () => {
    const { base, baseOps } = fork();
    const ours = applyAll(baseOps, [{ kind: 'set_component_props', id: FIX.r1, props: { value: '220' } }]);
    const theirs = applyAll(baseOps, [{ kind: 'set_component_props', id: FIX.r1, props: { value: '470' } }]);
    const { autoOps, conflicts } = threeWayMerge(base, ours, theirs);
    expect(conflicts).toEqual([
      {
        kind: 'property',
        entity: FIX.r1,
        entityKind: 'component',
        field: 'value',
        base: '330',
        ours: '220',
        theirs: '470',
      },
    ]);
    expect(autoOps).toEqual([]);
  });

  it('identical change on both sides converges without ops or conflicts', () => {
    const { base, baseOps } = fork();
    const change: OpBody = { kind: 'set_component_props', id: FIX.r1, props: { value: '470' } };
    const ours = applyAll(baseOps, [change]);
    const theirs = applyAll(baseOps, [change]);
    const { autoOps, conflicts } = threeWayMerge(base, ours, theirs);
    expect(conflicts).toEqual([]);
    expect(autoOps).toEqual([]);
  });

  it('net rename conflict and clean rename replay', () => {
    const { base, baseOps } = fork();
    const oursR = applyAll(baseOps, [{ kind: 'rename_net', netId: FIX.netA, name: 'VCC' }]);
    const theirsR = applyAll(baseOps, [{ kind: 'rename_net', netId: FIX.netA, name: 'VBAT' }]);
    const conflicted = threeWayMerge(base, oursR, theirsR);
    expect(conflicted.conflicts).toHaveLength(1);
    expect(conflicted.conflicts[0]).toMatchObject({ kind: 'property', field: 'name' });

    const clean = threeWayMerge(base, materialize(envelopes(baseOps)).graph, theirsR);
    expect(clean.conflicts).toEqual([]);
    const merged = mergedGraph(materialize(envelopes(baseOps)).graph, clean.autoOps);
    expect(merged.nets.get(FIX.netA)?.name).toBe('VBAT');
  });

  it('port moved to different nets on both sides → structural conflict', () => {
    const { base, baseOps } = fork();
    const ours = applyAll(baseOps, [
      { kind: 'disconnect', port: `${FIX.led}:A` },
      { kind: 'connect', port: `${FIX.led}:A`, netId: FIX.netA },
    ]);
    const theirs = applyAll(baseOps, [
      { kind: 'disconnect', port: `${FIX.led}:A` },
      { kind: 'connect', port: `${FIX.led}:A`, netId: FIX.netGnd },
    ]);
    const { conflicts } = threeWayMerge(base, ours, theirs);
    expect(conflicts).toContainEqual({
      kind: 'structural',
      port: `${FIX.led}:A`,
      oursNet: FIX.netA,
      theirsNet: FIX.netGnd,
    });
  });

  it('theirs moved a port, ours did not → replayed automatically', () => {
    const { base, baseOps } = fork();
    const ours = materialize(envelopes(baseOps)).graph;
    const theirs = applyAll(baseOps, [
      { kind: 'disconnect', port: `${FIX.led}:A` },
      { kind: 'connect', port: `${FIX.led}:A`, netId: FIX.netGnd },
    ]);
    const { autoOps, conflicts } = threeWayMerge(base, ours, theirs);
    expect(conflicts).toEqual([]);
    const merged = mergedGraph(ours, autoOps);
    expect(merged.nets.get(FIX.netGnd)?.ports).toContain(`${FIX.led}:A`);
    expect(merged.nets.get(FIX.netB)?.ports).not.toContain(`${FIX.led}:A`);
  });

  it('remove vs modify → conflict in both directions', () => {
    const { base, baseOps } = fork();
    const oursMod = applyAll(baseOps, [{ kind: 'set_component_props', id: FIX.led, props: { value: 'red' } }]);
    const theirsDel = applyAll(baseOps, [{ kind: 'remove_component', id: FIX.led }]);
    const r1 = threeWayMerge(base, oursMod, theirsDel);
    expect(r1.conflicts).toContainEqual({
      kind: 'remove_vs_modify',
      entity: FIX.led,
      entityKind: 'component',
      removedBy: 'theirs',
    });
    const r2 = threeWayMerge(base, theirsDel, oursMod);
    expect(r2.conflicts).toContainEqual({
      kind: 'remove_vs_modify',
      entity: FIX.led,
      entityKind: 'component',
      removedBy: 'ours',
    });
  });

  it('clean removal (no modifications on the other side) replays', () => {
    const { base, baseOps } = fork();
    const ours = materialize(envelopes(baseOps)).graph;
    const theirs = applyAll(baseOps, [{ kind: 'remove_component', id: FIX.led }]);
    const { autoOps, conflicts } = threeWayMerge(base, ours, theirs);
    expect(conflicts).toEqual([]);
    const merged = mergedGraph(ours, autoOps);
    expect(merged.components.has(FIX.led)).toBe(false);
  });

  it('constraints: theirs adds and removes replay; remove-vs-change conflicts', () => {
    const { baseOps } = fork();
    const kOps: OpBody[] = [
      { kind: 'add_constraint', id: 'k1', body: { kind: 'current_max', netId: FIX.netA, amps: 1 } },
    ];
    const baseWithK = materialize(envelopes([...baseOps, ...kOps])).graph;
    const ours = materialize(envelopes([...baseOps, ...kOps])).graph;
    const theirsAdd = applyAll(baseOps, [
      ...kOps,
      { kind: 'add_constraint', id: 'k2', body: { kind: 'thermal_limit', componentId: FIX.r1, maxC: 105 }, rationale: 'datasheet' },
    ]);
    const addMerge = threeWayMerge(baseWithK, ours, theirsAdd);
    expect(addMerge.conflicts).toEqual([]);
    expect(addMerge.autoOps).toContainEqual(expect.objectContaining({ kind: 'add_constraint', id: 'k2' }));

    const theirsDel = materialize(envelopes([...baseOps, ...kOps, { kind: 'remove_constraint', id: 'k1' }])).graph;
    const delMerge = threeWayMerge(baseWithK, ours, theirsDel);
    expect(delMerge.autoOps).toContainEqual({ kind: 'remove_constraint', id: 'k1' });

    const oursChanged = materialize(
      envelopes([
        ...baseOps,
        ...kOps,
        { kind: 'remove_constraint', id: 'k1' },
        { kind: 'add_constraint', id: 'k1', body: { kind: 'current_max', netId: FIX.netA, amps: 3 } },
      ]),
    ).graph;
    const conflictMerge = threeWayMerge(baseWithK, oursChanged, theirsDel);
    expect(conflictMerge.conflicts.some((c) => c.kind === 'property' && c.entityKind === 'constraint')).toBe(true);
  });

  it('pcb: theirs-only footprint moves, traces, and vias replay; races resolve to ours', () => {
    const { baseOps } = fork();
    const pcbBaseOps: OpBody[] = [
      ...baseOps,
      { kind: 'place_footprint', componentId: FIX.r1, at: { x: 0, y: 0 }, rotMilli: 0, side: 'top', locked: false },
      { kind: 'place_footprint', componentId: FIX.led, at: { x: 5_000_000, y: 0 }, rotMilli: 0, side: 'top', locked: false },
      { kind: 'route_trace', id: 't-old', netId: FIX.netA, layerId: 'F.Cu', widthNm: 250_000, path: [{ x: 0, y: 0 }, { x: 9, y: 0 }] },
    ];
    const base = materialize(envelopes(pcbBaseOps)).graph;
    const ours = applyAll(pcbBaseOps, [
      { kind: 'move_footprint', componentId: FIX.r1, at: { x: 0, y: 2_000_000 }, rotMilli: 0, side: 'top', locked: false },
    ]);
    const theirs = applyAll(pcbBaseOps, [
      // Race on r1: ours wins.
      { kind: 'move_footprint', componentId: FIX.r1, at: { x: 0, y: 9_000_000 }, rotMilli: 0, side: 'top', locked: false },
      // Theirs-only changes: led move, new trace + via, trace removal.
      { kind: 'move_footprint', componentId: FIX.led, at: { x: 7_000_000, y: 0 }, rotMilli: 90_000, side: 'top', locked: false },
      { kind: 'route_trace', id: 't-new', netId: FIX.netB, layerId: 'F.Cu', widthNm: 250_000, path: [{ x: 0, y: 0 }, { x: 5_000_000, y: 0 }] },
      { kind: 'place_via', id: 'v-new', netId: FIX.netB, at: { x: 5_000_000, y: 0 }, drillNm: 300_000, padNm: 600_000, span: ['F.Cu', 'B.Cu'] },
      { kind: 'remove_trace', id: 't-old' },
    ]);
    const { autoOps, conflicts } = threeWayMerge(base, ours, theirs);
    expect(conflicts).toEqual([]);
    const merged = mergedGraph(ours, autoOps);
    expect(merged.pcb.placements.get(FIX.r1)?.at.y).toBe(2_000_000); // ours wins
    expect(merged.pcb.placements.get(FIX.led)?.rotMilli).toBe(90_000); // theirs replays
    expect(merged.pcb.traces.has('t-new')).toBe(true);
    expect(merged.pcb.vias.has('v-new')).toBe(true);
    expect(merged.pcb.traces.has('t-old')).toBe(false);
  });

  it('pcb: a trace re-routed in theirs replays as remove + route; ours-touched traces stay', () => {
    const { baseOps } = fork();
    const via = (id: string, padNm: number): OpBody => ({
      kind: 'place_via',
      id,
      netId: FIX.netA,
      at: { x: 0, y: 0 },
      drillNm: 300_000,
      padNm,
      span: ['F.Cu', 'B.Cu'],
    });
    const pcbBaseOps: OpBody[] = [
      ...baseOps,
      { kind: 'route_trace', id: 't1', netId: FIX.netA, layerId: 'F.Cu', widthNm: 250_000, path: [{ x: 0, y: 0 }, { x: 9, y: 0 }] },
      { kind: 'route_trace', id: 't2', netId: FIX.netA, layerId: 'F.Cu', widthNm: 250_000, path: [{ x: 0, y: 9 }, { x: 9, y: 9 }] },
      via('v1', 600_000),
      via('v2', 600_000),
    ];
    const base = materialize(envelopes(pcbBaseOps)).graph;
    const ours = applyAll(pcbBaseOps, [
      { kind: 'remove_trace', id: 't2' },
      { kind: 'route_trace', id: 't2', netId: FIX.netA, layerId: 'B.Cu', widthNm: 400_000, path: [{ x: 0, y: 9 }, { x: 9, y: 9 }] },
      { kind: 'remove_via', id: 'v2' },
      via('v2', 900_000),
    ]);
    const theirs = applyAll(pcbBaseOps, [
      { kind: 'remove_trace', id: 't1' },
      { kind: 'route_trace', id: 't1', netId: FIX.netA, layerId: 'F.Cu', widthNm: 500_000, path: [{ x: 0, y: 0 }, { x: 9, y: 0 }] },
      // Races on t2/v2: ours wins.
      { kind: 'remove_trace', id: 't2' },
      { kind: 'remove_via', id: 'v2' },
      // Theirs-only via change: re-place v1.
      { kind: 'remove_via', id: 'v1' },
      via('v1', 800_000),
    ]);
    const { autoOps, conflicts } = threeWayMerge(base, ours, theirs);
    expect(conflicts).toEqual([]);
    const merged = mergedGraph(ours, autoOps);
    expect(merged.pcb.traces.get('t1')?.widthNm).toBe(500_000);
    expect(merged.pcb.traces.get('t2')?.layerId).toBe('B.Cu'); // ours wins
    expect(merged.pcb.vias.get('v1')?.padNm).toBe(800_000);
    expect(merged.pcb.vias.get('v2')?.padNm).toBe(900_000); // ours wins
  });

  it('pcb: a component added in theirs brings its footprint placement along', () => {
    const { base, baseOps } = fork();
    const ours = materialize(envelopes(baseOps)).graph;
    const theirs = applyAll(baseOps, [
      { kind: 'add_component', id: 'c9', ref: 'C9', partId: 'p-cap', partRev: 1 },
      { kind: 'place_footprint', componentId: 'c9', at: { x: 1, y: 2 }, rotMilli: 0, side: 'bottom', locked: false },
    ]);
    const { autoOps, conflicts } = threeWayMerge(base, ours, theirs);
    expect(conflicts).toEqual([]);
    const merged = mergedGraph(ours, autoOps);
    expect(merged.pcb.placements.get('c9')).toEqual({ at: { x: 1, y: 2 }, rotMilli: 0, side: 'bottom', locked: false });
  });

  it('geometry: theirs-only moves and wires replay; geometry races resolve to ours', () => {
    const { base, baseOps } = fork();
    const ours = applyAll(baseOps, [
      { kind: 'move_symbol', componentId: FIX.bat, at: { x: 0, y: 2540000 }, rot: 0, mirror: false },
    ]);
    const theirs = applyAll(baseOps, [
      { kind: 'move_symbol', componentId: FIX.bat, at: { x: 0, y: 5080000 }, rot: 0, mirror: false },
      { kind: 'move_symbol', componentId: FIX.led, at: { x: 0, y: 7620000 }, rot: 0, mirror: false },
      { kind: 'set_wire_geometry', netId: FIX.netA, segments: [{ a: { x: 0, y: 0 }, b: { x: 9, y: 0 } }] },
    ]);
    const { autoOps, conflicts } = threeWayMerge(base, ours, theirs);
    expect(conflicts).toEqual([]);
    const merged = mergedGraph(ours, autoOps);
    // Race on bat: ours wins.
    expect(merged.schematic.placements.get(FIX.bat)?.at.y).toBe(2540000);
    // Theirs-only move replays.
    expect(merged.schematic.placements.get(FIX.led)?.at.y).toBe(7620000);
    expect(merged.schematic.wires.get(FIX.netA)).toHaveLength(1);
  });
});

describe('BranchLog.mergeBaseOps', () => {
  function seededLog(): BranchLog {
    const log = new BranchLog();
    for (const e of envelopes(ledCircuitOps())) log.append(MAIN_BRANCH, e);
    return log;
  }

  it('child vs parent: the base is the fork point even after both advance', () => {
    const log = seededLog();
    const forkLen = log.opsFor(MAIN_BRANCH).length;
    log.createBranch('feature', MAIN_BRANCH);
    log.append(MAIN_BRANCH, env({ kind: 'rename_net', netId: FIX.netA, name: 'MAIN' }, 50));
    log.append('feature', env({ kind: 'rename_net', netId: FIX.netA, name: 'FEAT' }, 50, 'b'));

    for (const [a, b] of [['feature', MAIN_BRANCH], [MAIN_BRANCH, 'feature']] as const) {
      const base = log.mergeBaseOps(a, b);
      expect(base).toHaveLength(forkLen);
      expect(materialize(base).graph.nets.get(FIX.netA)?.name).toBe('N$1');
    }
  });

  it('siblings: two forks of main meet at the earlier fork point', () => {
    const log = seededLog();
    log.createBranch('s1', MAIN_BRANCH);
    const forkLen1 = log.opsFor(MAIN_BRANCH).length;
    log.append(MAIN_BRANCH, env({ kind: 'rename_net', netId: FIX.netA, name: 'LATER' }, 60));
    log.createBranch('s2', MAIN_BRANCH); // forks after the rename
    const base = log.mergeBaseOps('s1', 's2');
    expect(base).toHaveLength(forkLen1); // the EARLIER fork wins
    expect(materialize(base).graph.nets.get(FIX.netA)?.name).toBe('N$1');
  });

  it('nested: grandchild vs main meets at the outermost fork prefix', () => {
    const log = seededLog();
    const forkLen = log.opsFor(MAIN_BRANCH).length;
    log.createBranch('b1', MAIN_BRANCH);
    log.append('b1', env({ kind: 'rename_net', netId: FIX.netB, name: 'B1' }, 70, 'b'));
    log.createBranch('b2', 'b1');
    log.append('b2', env({ kind: 'rename_net', netId: FIX.netGnd, name: 'B2GND' }, 71, 'c'));
    const base = log.mergeBaseOps('b2', MAIN_BRANCH);
    expect(base).toHaveLength(forkLen);
    // And b2 vs b1 meets at b1's head as of b2's fork.
    const sibBase = log.mergeBaseOps('b2', 'b1');
    expect(materialize(sibBase).graph.nets.get(FIX.netB)?.name).toBe('B1');
  });
});

describe('resolveConflict', () => {
  function forkGraphs(oursExtra: OpBody[], theirsExtra: OpBody[]) {
    const baseOps = ledCircuitOps();
    const base = materialize(envelopes(baseOps)).graph;
    const ours = materialize(envelopes([...baseOps, ...oursExtra])).graph;
    const theirs = materialize(envelopes([...baseOps, ...theirsExtra])).graph;
    return { base, ours, theirs };
  }

  /** Apply autoOps + resolutions on ours and assert a clean result. */
  function applyResolution(ours: DesignGraph, ops: OpBody[]): DesignGraph {
    const result = materialize(
      ops.map((op, i) => ({ actor: 'merge', lamport: i + 1, ts: 0, op })),
      { from: ours },
    );
    expect(result.warnings.filter((w) => w.kind === 'apply_failed')).toEqual([]);
    expect(result.violations).toEqual([]);
    return result.graph;
  }

  it("'ours' is always an empty resolution", () => {
    const { base, ours, theirs } = forkGraphs(
      [{ kind: 'set_component_props', id: FIX.r1, props: { value: '1k' } }],
      [{ kind: 'set_component_props', id: FIX.r1, props: { value: '47k' } }],
    );
    const { conflicts } = threeWayMerge(base, ours, theirs);
    expect(conflicts).toHaveLength(1);
    expect(resolveConflict(conflicts[0]!, 'ours', { ours, theirs })).toEqual([]);
  });

  it('property/value conflict: theirs lands their value', () => {
    const { base, ours, theirs } = forkGraphs(
      [{ kind: 'set_component_props', id: FIX.r1, props: { value: '1k' } }],
      [{ kind: 'set_component_props', id: FIX.r1, props: { value: '47k' } }],
    );
    const { autoOps, conflicts } = threeWayMerge(base, ours, theirs);
    const res = resolveConflict(conflicts[0]!, 'theirs', { ours, theirs }, autoOps);
    expect(res).not.toBeNull();
    const merged = applyResolution(ours, [...autoOps, ...res!]);
    expect(merged.components.get(FIX.r1)?.value).toBe('47k');
  });

  it('property/net-name conflict: theirs lands their name', () => {
    const { base, ours, theirs } = forkGraphs(
      [{ kind: 'rename_net', netId: FIX.netA, name: 'VCC_OURS' }],
      [{ kind: 'rename_net', netId: FIX.netA, name: 'VCC_THEIRS' }],
    );
    const { autoOps, conflicts } = threeWayMerge(base, ours, theirs);
    expect(conflicts[0]?.kind).toBe('property');
    const res = resolveConflict(conflicts[0]!, 'theirs', { ours, theirs }, autoOps);
    const merged = applyResolution(ours, [...autoOps, ...res!]);
    expect(merged.nets.get(FIX.netA)?.name).toBe('VCC_THEIRS');
  });

  it('structural conflict: theirs replays their connectivity', () => {
    // Both sides move the same port to different nets.
    const { base, ours, theirs } = forkGraphs(
      [
        { kind: 'disconnect', port: `${FIX.led}:A` },
        { kind: 'connect', port: `${FIX.led}:A`, netId: FIX.netA },
      ],
      [
        { kind: 'disconnect', port: `${FIX.led}:A` },
        { kind: 'connect', port: `${FIX.led}:A`, newNetId: 'n-theirs' },
        { kind: 'rename_net', netId: 'n-theirs', name: 'THEIRS_NET' },
      ],
    );
    const { autoOps, conflicts } = threeWayMerge(base, ours, theirs);
    const structural = conflicts.find((c) => c.kind === 'structural');
    expect(structural).toBeDefined();
    const res = resolveConflict(structural!, 'theirs', { ours, theirs }, autoOps);
    const merged = applyResolution(ours, [...autoOps, ...res!]);
    expect(merged.nets.get('n-theirs')?.name).toBe('THEIRS_NET');
    expect([...(merged.nets.get('n-theirs')?.ports ?? [])]).toContain(`${FIX.led}:A`);
  });

  it('remove_vs_modify (theirs removed): theirs removes the component', () => {
    const { base, ours, theirs } = forkGraphs(
      [{ kind: 'set_component_props', id: FIX.led, props: { value: 'red' } }],
      [{ kind: 'remove_component', id: FIX.led }],
    );
    const { autoOps, conflicts } = threeWayMerge(base, ours, theirs);
    const rvm = conflicts.find((c) => c.kind === 'remove_vs_modify');
    expect(rvm).toBeDefined();
    const res = resolveConflict(rvm!, 'theirs', { ours, theirs }, autoOps);
    const merged = applyResolution(ours, [...autoOps, ...res!]);
    expect(merged.components.has(FIX.led)).toBe(false);
  });

  it('remove_vs_modify (ours removed): theirs resurrects their version, wiring intact', () => {
    const { base, ours, theirs } = forkGraphs(
      [{ kind: 'remove_component', id: FIX.led }],
      [{ kind: 'set_component_props', id: FIX.led, props: { value: 'green' } }],
    );
    const { autoOps, conflicts } = threeWayMerge(base, ours, theirs);
    const rvm = conflicts.find((c) => c.kind === 'remove_vs_modify');
    expect(rvm).toBeDefined();
    const res = resolveConflict(rvm!, 'theirs', { ours, theirs }, autoOps);
    expect(res).not.toBeNull();
    const merged = applyResolution(ours, [...autoOps, ...res!]);
    const led = merged.components.get(FIX.led);
    expect(led?.value).toBe('green');
    expect(merged.schematic.placements.has(FIX.led)).toBe(true);
    expect([...(merged.nets.get(FIX.netB)?.ports ?? [])]).toContain(`${FIX.led}:A`);
    expect([...(merged.nets.get(FIX.netGnd)?.ports ?? [])]).toContain(`${FIX.led}:K`);
  });

  it('returns null for choices M1 cannot express as ops', () => {
    const { ours, theirs } = forkGraphs([], []);
    expect(
      resolveConflict(
        { kind: 'property', entity: FIX.r1, entityKind: 'component', field: 'partId', base: 'a', ours: 'a', theirs: 'b' },
        'theirs',
        { ours, theirs },
      ),
    ).toBeNull();
    expect(
      resolveConflict(
        { kind: 'remove_vs_modify', entity: FIX.netA, entityKind: 'net', removedBy: 'theirs' },
        'theirs',
        { ours, theirs },
      ),
    ).toBeNull();
  });
});

describe('resolveConflict — branch coverage of the guard rails', () => {
  function graphs(oursExtra: OpBody[] = [], theirsExtra: OpBody[] = []) {
    const baseOps = ledCircuitOps();
    return {
      ours: materialize(envelopes([...baseOps, ...oursExtra])).graph,
      theirs: materialize(envelopes([...baseOps, ...theirsExtra])).graph,
    };
  }

  it('component ref / dnp / fields conflicts: theirs lands each prop', () => {
    const g = graphs();
    const mk = (field: string, theirs: unknown) =>
      ({ kind: 'property', entity: FIX.r1, entityKind: 'component', field, base: undefined, ours: undefined, theirs }) as const;
    expect(resolveConflict(mk('ref', 'R99'), 'theirs', g)).toEqual([
      { kind: 'set_component_props', id: FIX.r1, props: { ref: 'R99' } },
    ]);
    expect(resolveConflict(mk('dnp', true), 'theirs', g)).toEqual([
      { kind: 'set_component_props', id: FIX.r1, props: { dnp: true } },
    ]);
    expect(resolveConflict(mk('fields', { tol: '1%' }), 'theirs', g)).toEqual([
      { kind: 'set_component_props', id: FIX.r1, props: { fields: { tol: '1%' } } },
    ]);
    // value cleared on theirs → null-valued prop
    expect(resolveConflict(mk('value', undefined), 'theirs', g)).toEqual([
      { kind: 'set_component_props', id: FIX.r1, props: { value: null } },
    ]);
  });

  it('guards: missing entities and inexpressible kinds return null', () => {
    const g = graphs([{ kind: 'remove_component', id: FIX.led }]);
    // component gone in ours
    expect(
      resolveConflict(
        { kind: 'property', entity: FIX.led, entityKind: 'component', field: 'value', base: 'a', ours: 'a', theirs: 'b' },
        'theirs', g,
      ),
    ).toBeNull();
    // net name: unknown net / non-string name
    expect(
      resolveConflict(
        { kind: 'property', entity: 'n-ghost', entityKind: 'net', field: 'name', base: 'x', ours: 'x', theirs: 'y' },
        'theirs', g,
      ),
    ).toBeNull();
    expect(
      resolveConflict(
        { kind: 'property', entity: FIX.netA, entityKind: 'net', field: 'name', base: 'x', ours: 'x', theirs: 7 },
        'theirs', g,
      ),
    ).toBeNull();
    // constraint with theirs still defined (both-changed) — not expressible
    expect(
      resolveConflict(
        { kind: 'property', entity: 'k1', entityKind: 'constraint', field: 'body', base: {}, ours: {}, theirs: {} },
        'theirs', g,
      ),
    ).toBeNull();
    // meta — never emitted today, never resolvable
    expect(
      resolveConflict(
        { kind: 'property', entity: 'm', entityKind: 'meta', field: 'x', base: 'a', ours: 'b', theirs: 'c' },
        'theirs', g,
      ),
    ).toBeNull();
    // structural on a component ours no longer has
    expect(
      resolveConflict(
        { kind: 'structural', port: `${FIX.led}:A`, oursNet: null, theirsNet: FIX.netB },
        'theirs', g,
      ),
    ).toBeNull();
    // remove_vs_modify resurrect when theirs lacks the component too
    expect(
      resolveConflict(
        { kind: 'remove_vs_modify', entity: 'c-ghost', entityKind: 'component', removedBy: 'ours' },
        'theirs', g,
      ),
    ).toBeNull();
  });

  it('constraint removed-by-theirs resolves to remove_constraint', () => {
    const withConstraint: OpBody[] = [
      { kind: 'add_constraint', id: 'k1', body: { kind: 'current_max', netId: FIX.netB, amps: 0.02 } },
    ];
    const g = graphs(withConstraint, withConstraint);
    expect(
      resolveConflict(
        { kind: 'property', entity: 'k1', entityKind: 'constraint', field: 'body', base: {}, ours: {}, theirs: undefined },
        'theirs', g,
      ),
    ).toEqual([{ kind: 'remove_constraint', id: 'k1' }]);
  });

  it('structural: disconnect-only and connect-to-existing paths', () => {
    const g = graphs();
    // theirs disconnected the port entirely
    expect(
      resolveConflict(
        { kind: 'structural', port: `${FIX.led}:A`, oursNet: FIX.netB, theirsNet: null },
        'theirs', g,
      ),
    ).toEqual([{ kind: 'disconnect', port: `${FIX.led}:A` }]);
    // port floating in ours, theirs put it on a net ours already has
    expect(
      resolveConflict(
        { kind: 'structural', port: `${FIX.led}:A`, oursNet: null, theirsNet: FIX.netA },
        'theirs', g,
      ),
    ).toEqual([{ kind: 'connect', port: `${FIX.led}:A`, netId: FIX.netA }]);
  });

  it('structural: prior ops that already created the net suppress re-create and rename', () => {
    const g = graphs([], [
      { kind: 'disconnect', port: `${FIX.led}:A` },
      { kind: 'connect', port: `${FIX.led}:A`, newNetId: 'n-new' },
      { kind: 'rename_net', netId: 'n-new', name: 'NEW' },
      { kind: 'set_net_class', netId: 'n-new', netClass: 'power' },
    ]);
    const prior: OpBody[] = [
      { kind: 'connect', port: `${FIX.bat}:+`, newNetId: 'n-new' },
      { kind: 'rename_net', netId: 'n-new', name: 'NEW' },
    ];
    expect(
      resolveConflict(
        { kind: 'structural', port: `${FIX.led}:A`, oursNet: FIX.netB, theirsNet: 'n-new' },
        'theirs', g, prior,
      ),
    ).toEqual([
      { kind: 'disconnect', port: `${FIX.led}:A` },
      { kind: 'connect', port: `${FIX.led}:A`, netId: 'n-new' },
    ]);
  });

  it('structural: creating theirs net replicates name and non-default class', () => {
    const g = graphs([], [
      { kind: 'disconnect', port: `${FIX.led}:A` },
      { kind: 'connect', port: `${FIX.led}:A`, newNetId: 'n-pwr' },
      { kind: 'rename_net', netId: 'n-pwr', name: 'PWR' },
      { kind: 'set_net_class', netId: 'n-pwr', netClass: 'power' },
    ]);
    expect(
      resolveConflict(
        { kind: 'structural', port: `${FIX.led}:A`, oursNet: FIX.netB, theirsNet: 'n-pwr' },
        'theirs', g,
      ),
    ).toEqual([
      { kind: 'disconnect', port: `${FIX.led}:A` },
      { kind: 'connect', port: `${FIX.led}:A`, newNetId: 'n-pwr' },
      { kind: 'rename_net', netId: 'n-pwr', name: 'PWR' },
      { kind: 'set_net_class', netId: 'n-pwr', netClass: 'power' },
    ]);
  });

  it('remove_vs_modify (theirs removed) when ours already dropped it: empty resolution', () => {
    const g = graphs([{ kind: 'remove_component', id: FIX.led }]);
    expect(
      resolveConflict(
        { kind: 'remove_vs_modify', entity: FIX.led, entityKind: 'component', removedBy: 'theirs' },
        'theirs', g,
      ),
    ).toEqual([]);
  });

  it('resurrection copies dnp/fields and the footprint placement', () => {
    const g = graphs(
      [{ kind: 'remove_component', id: FIX.led }],
      [
        { kind: 'set_component_props', id: FIX.led, props: { dnp: true, fields: { note: 'spare' } } },
        { kind: 'place_footprint', componentId: FIX.led, at: { x: 1_000_000, y: 0 }, rotMilli: 0, side: 'top', locked: false },
      ],
    );
    const res = resolveConflict(
      { kind: 'remove_vs_modify', entity: FIX.led, entityKind: 'component', removedBy: 'ours' },
      'theirs', g,
    );
    expect(res).not.toBeNull();
    const kinds = res!.map((o) => o.kind);
    expect(kinds).toContain('set_component_props');
    expect(kinds).toContain('place_footprint');
    const merged = materialize(
      res!.map((op, i) => ({ actor: 'm', lamport: i + 1, ts: 0, op })),
      { from: g.ours },
    );
    expect(merged.warnings.filter((w) => w.kind === 'apply_failed')).toEqual([]);
    expect(merged.graph.components.get(FIX.led)?.dnp).toBe(true);
    expect(merged.graph.pcb.placements.has(FIX.led)).toBe(true);
  });
});

describe('mergeBaseOps — degenerate logs', () => {
  it('two independent roots (hand-built map) meet at the empty design', () => {
    const initial = new Map([
      ['rootA', { name: 'rootA', base: { branch: null, opCount: 0 }, ops: [env({ kind: 'checkpoint', label: 'a' }, 1)] }],
      ['rootB', { name: 'rootB', base: { branch: null, opCount: 0 }, ops: [env({ kind: 'checkpoint', label: 'b' }, 1)] }],
    ]);
    const log = new BranchLog(initial);
    expect(log.mergeBaseOps('rootA', 'rootB')).toEqual([]);
  });
});
