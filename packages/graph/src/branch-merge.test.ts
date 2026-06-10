import { describe, expect, it } from 'vitest';

import { BranchLog, MAIN_BRANCH } from './branch.js';
import { materialize } from './materialize.js';
import { threeWayMerge } from './merge.js';
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
