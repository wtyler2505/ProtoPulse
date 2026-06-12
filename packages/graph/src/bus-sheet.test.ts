import { describe, expect, it } from 'vitest';

import { applyOp } from './apply.js';
import { diff, isEmptyDelta } from './diff.js';
import { validateGraph } from './invariants.js';
import { invertOp } from './inverse.js';
import { threeWayMerge } from './merge.js';
import { graphFromJson, graphToJson } from './store/serialize.js';
import { buildGraph, FIX, ledCircuitOps } from './test-helpers.js';
import { cloneGraph } from './types.js';

import type { OpBody } from './ops.js';
import type { DesignGraph } from './types.js';

/** Buses + sheets through the whole core — the Architect's substrate. */

const mkBus: OpBody = { kind: 'create_bus', id: 'bus1', name: 'POWER', busKind: 'PWR' };
const mkSheet: OpBody = { kind: 'add_sheet', id: 'sh1', name: 'psu', parentId: null };

function base(extra: OpBody[] = []): DesignGraph {
  return buildGraph([...ledCircuitOps(), ...extra]);
}

describe('bus apply + inverse', () => {
  it('create/assign/detach/remove keep net.busId and members bidirectionally consistent', () => {
    const g = base([mkBus, { kind: 'assign_to_bus', netId: FIX.netA, busId: 'bus1' }]);
    expect(g.nets.get(FIX.netA)?.busId).toBe('bus1');
    expect(g.buses.get('bus1')?.memberNets).toEqual([FIX.netA]);
    expect(validateGraph(g)).toEqual([]);

    // Reassign to a second bus — leaves the first.
    expect(applyOp(g, { kind: 'create_bus', id: 'bus2', name: 'IO', busKind: 'GPIO' }).ok).toBe(true);
    expect(applyOp(g, { kind: 'assign_to_bus', netId: FIX.netA, busId: 'bus2' }).ok).toBe(true);
    expect(g.buses.get('bus1')?.memberNets).toEqual([]);
    expect(g.buses.get('bus2')?.memberNets).toEqual([FIX.netA]);

    // Detach with null.
    expect(applyOp(g, { kind: 'assign_to_bus', netId: FIX.netA, busId: null }).ok).toBe(true);
    expect(g.nets.get(FIX.netA)?.busId).toBeUndefined();

    // remove_bus clears members' busId.
    expect(applyOp(g, { kind: 'assign_to_bus', netId: FIX.netB, busId: 'bus1' }).ok).toBe(true);
    expect(applyOp(g, { kind: 'remove_bus', id: 'bus1' }).ok).toBe(true);
    expect(g.nets.get(FIX.netB)?.busId).toBeUndefined();
  });

  it('guards: dup bus, missing bus/net, removing the missing', () => {
    const g = base([mkBus]);
    expect(applyOp(g, mkBus).ok).toBe(false);
    expect(applyOp(g, { kind: 'assign_to_bus', netId: 'ghost', busId: 'bus1' }).ok).toBe(false);
    expect(applyOp(g, { kind: 'assign_to_bus', netId: FIX.netA, busId: 'ghost' }).ok).toBe(false);
    expect(applyOp(g, { kind: 'remove_bus', id: 'ghost' }).ok).toBe(false);
  });

  it('inverse closure: create↔remove (members restored), assign↔previous', () => {
    const g0 = base();
    expect(invertOp(g0, mkBus)).toEqual([{ kind: 'remove_bus', id: 'bus1' }]);

    const g = base([mkBus, { kind: 'assign_to_bus', netId: FIX.netA, busId: 'bus1' }]);
    const inv = invertOp(g, { kind: 'remove_bus', id: 'bus1' });
    const after = cloneGraph(g);
    expect(applyOp(after, { kind: 'remove_bus', id: 'bus1' }).ok).toBe(true);
    for (const op of inv) expect(applyOp(after, op).ok).toBe(true);
    expect(after.buses.get('bus1')?.memberNets).toEqual([FIX.netA]);
    expect(after.nets.get(FIX.netA)?.busId).toBe('bus1');

    // assign inverse restores the PREVIOUS assignment.
    const invAssign = invertOp(g, { kind: 'assign_to_bus', netId: FIX.netA, busId: null });
    expect(invAssign).toEqual([{ kind: 'assign_to_bus', netId: FIX.netA, busId: 'bus1' }]);
    expect(invertOp(g0, { kind: 'assign_to_bus', netId: FIX.netA, busId: 'bus1' })).toEqual([
      { kind: 'assign_to_bus', netId: FIX.netA, busId: null },
    ]);
    // Missing targets invert to nothing.
    expect(invertOp(g0, { kind: 'remove_bus', id: 'ghost' })).toEqual([]);
    expect(invertOp(g0, { kind: 'assign_to_bus', netId: 'ghost', busId: null })).toEqual([]);
  });

  it('GC and merge_nets maintain memberships', () => {
    const g = base([mkBus, { kind: 'assign_to_bus', netId: FIX.netGnd, busId: 'bus1' }]);
    const r1 = applyOp(g, { kind: 'disconnect', port: `${FIX.led}:K` });
    const r2 = applyOp(g, { kind: 'disconnect', port: `${FIX.bat}:-` });
    expect(r1.ok && r2.ok).toBe(true);
    if (r2.ok) expect(r2.warnings.some((w) => w.code === 'bus_member_gc')).toBe(true);
    expect(g.buses.get('bus1')?.memberNets).toEqual([]);

    const g2 = base([mkBus, { kind: 'assign_to_bus', netId: FIX.netGnd, busId: 'bus1' }]);
    expect(applyOp(g2, { kind: 'merge_nets', survivor: FIX.netA, absorbed: FIX.netGnd }).ok).toBe(true);
    expect(g2.buses.get('bus1')?.memberNets).toEqual([]);
    expect(validateGraph(g2)).toEqual([]);
  });
});

describe('sheet apply + inverse', () => {
  const iface: OpBody = {
    kind: 'set_sheet_interface',
    sheetId: 'sh1',
    interface: [{ name: 'VIN', direction: 'in', netId: FIX.netA }],
  };

  it('add/interface/move/remove with guards', () => {
    const g = base([mkSheet, iface, { kind: 'move_to_sheet', componentId: FIX.r1, sheetId: 'sh1' }]);
    expect(g.sheets.get('sh1')?.interface[0]).toMatchObject({ name: 'VIN', netId: FIX.netA });
    expect(g.components.get(FIX.r1)?.sheetId).toBe('sh1');
    expect(validateGraph(g)).toEqual([]);

    // Occupied sheets refuse removal; vacate then remove.
    expect(applyOp(g, { kind: 'remove_sheet', id: 'sh1' }).ok).toBe(false);
    expect(applyOp(g, { kind: 'move_to_sheet', componentId: FIX.r1, sheetId: null }).ok).toBe(true);
    expect(applyOp(g, { kind: 'remove_sheet', id: 'sh1' }).ok).toBe(true);

    const g2 = base([mkSheet]);
    expect(applyOp(g2, mkSheet).ok).toBe(false); // dup
    expect(applyOp(g2, { kind: 'add_sheet', id: 'sub', name: 's', parentId: 'ghost' }).ok).toBe(false);
    expect(applyOp(g2, { kind: 'add_sheet', id: 'sub', name: 's', parentId: 'sh1' }).ok).toBe(true);
    expect(applyOp(g2, { kind: 'remove_sheet', id: 'sh1' }).ok).toBe(false); // has child
    expect(applyOp(g2, { kind: 'remove_sheet', id: 'ghost' }).ok).toBe(false);
    expect(
      applyOp(g2, { kind: 'set_sheet_interface', sheetId: 'ghost', interface: [] }).ok,
    ).toBe(false);
    expect(
      applyOp(g2, {
        kind: 'set_sheet_interface',
        sheetId: 'sh1',
        interface: [{ name: 'X', direction: 'out', netId: 'ghost' }],
      }).ok,
    ).toBe(false);
    expect(applyOp(g2, { kind: 'move_to_sheet', componentId: 'ghost', sheetId: 'sh1' }).ok).toBe(false);
    expect(applyOp(g2, { kind: 'move_to_sheet', componentId: FIX.r1, sheetId: 'ghost' }).ok).toBe(false);
  });

  it('inverse closure: add↔remove (interface restored), interface↔previous, move↔previous', () => {
    const g = base([mkSheet, iface]);
    expect(invertOp(base(), mkSheet)).toEqual([{ kind: 'remove_sheet', id: 'sh1' }]);

    const invRemove = invertOp(g, { kind: 'remove_sheet', id: 'sh1' });
    const after = cloneGraph(g);
    expect(applyOp(after, { kind: 'remove_sheet', id: 'sh1' }).ok).toBe(true);
    for (const op of invRemove) expect(applyOp(after, op).ok).toBe(true);
    expect(after.sheets.get('sh1')?.interface).toHaveLength(1);

    const invIface = invertOp(g, { kind: 'set_sheet_interface', sheetId: 'sh1', interface: [] });
    expect(invIface[0]).toMatchObject({ kind: 'set_sheet_interface', sheetId: 'sh1' });

    const moved = base([mkSheet, { kind: 'move_to_sheet', componentId: FIX.r1, sheetId: 'sh1' }]);
    expect(invertOp(moved, { kind: 'move_to_sheet', componentId: FIX.r1, sheetId: null })).toEqual([
      { kind: 'move_to_sheet', componentId: FIX.r1, sheetId: 'sh1' },
    ]);
    expect(invertOp(base(), { kind: 'move_to_sheet', componentId: FIX.r1, sheetId: 'sh1' })).toEqual([
      { kind: 'move_to_sheet', componentId: FIX.r1, sheetId: null },
    ]);
    // Missing targets invert to nothing.
    expect(invertOp(base(), { kind: 'remove_sheet', id: 'ghost' })).toEqual([]);
    expect(invertOp(base(), { kind: 'set_sheet_interface', sheetId: 'ghost', interface: [] })).toEqual([]);
    expect(invertOp(base(), { kind: 'move_to_sheet', componentId: 'ghost', sheetId: null })).toEqual([]);
  });

  it('a dead net drops sheet ports; merge_nets re-points them', () => {
    const ifaceGnd: OpBody = {
      kind: 'set_sheet_interface',
      sheetId: 'sh1',
      interface: [{ name: 'GND', direction: 'inout', netId: FIX.netGnd }],
    };
    const g = base([mkSheet, ifaceGnd]);
    const r1 = applyOp(g, { kind: 'disconnect', port: `${FIX.led}:K` });
    const r2 = applyOp(g, { kind: 'disconnect', port: `${FIX.bat}:-` });
    expect(r1.ok && r2.ok).toBe(true);
    if (r2.ok) expect(r2.warnings.some((w) => w.code === 'sheet_port_gc')).toBe(true);
    expect(g.sheets.get('sh1')?.interface).toEqual([]);

    const g2 = base([mkSheet, ifaceGnd]);
    expect(applyOp(g2, { kind: 'merge_nets', survivor: FIX.netA, absorbed: FIX.netGnd }).ok).toBe(true);
    expect(g2.sheets.get('sh1')?.interface[0]?.netId).toBe(FIX.netA);
  });
});

describe('diff + merge + invariants + serialize', () => {
  it('delta sections track bus/sheet adds, removes, and changes', () => {
    const a = base();
    const b = base([mkBus, { kind: 'assign_to_bus', netId: FIX.netA, busId: 'bus1' }, mkSheet]);
    const d = diff(a, b);
    expect(d.buses.added).toEqual(['bus1']);
    expect(d.sheets.added).toEqual(['sh1']);
    expect(isEmptyDelta(d)).toBe(false);
    expect(diff(b, a).buses.removed).toEqual(['bus1']);
    expect(diff(b, a).sheets.removed).toEqual(['sh1']);

    const c = base([mkBus, mkSheet]);
    expect(diff(c, b).buses.changed).toEqual(['bus1']); // membership only
    const e = base([
      mkBus,
      { kind: 'assign_to_bus', netId: FIX.netA, busId: 'bus1' },
      mkSheet,
      { kind: 'set_sheet_interface', sheetId: 'sh1', interface: [{ name: 'V', direction: 'in', netId: FIX.netA }] },
    ]);
    expect(diff(b, e).sheets.changed).toEqual(['sh1']);
    // sheetId rides the component prop deltas.
    const moved = base([mkSheet, { kind: 'move_to_sheet', componentId: FIX.r1, sheetId: 'sh1' }]);
    const dm = diff(base([mkSheet]), moved);
    expect(dm.components.changed.get(FIX.r1)?.[0]).toMatchObject({ field: 'sheetId', b: 'sh1' });
  });

  it('merge replays theirs-only buses, sheets, memberships, and sheet moves', () => {
    const b0 = base();
    const theirs = base([
      mkBus,
      { kind: 'assign_to_bus', netId: FIX.netA, busId: 'bus1' },
      mkSheet,
      { kind: 'set_sheet_interface', sheetId: 'sh1', interface: [{ name: 'V', direction: 'in', netId: FIX.netA }] },
      { kind: 'move_to_sheet', componentId: FIX.r1, sheetId: 'sh1' },
    ]);
    const { autoOps, conflicts } = threeWayMerge(b0, cloneGraph(b0), theirs);
    expect(conflicts).toEqual([]);
    const merged = cloneGraph(b0);
    for (const op of autoOps) expect(applyOp(merged, op).ok).toBe(true);
    expect(merged.buses.get('bus1')?.memberNets).toEqual([FIX.netA]);
    expect(merged.sheets.get('sh1')?.interface).toHaveLength(1);
    expect(merged.components.get(FIX.r1)?.sheetId).toBe('sh1');
    expect(validateGraph(merged)).toEqual([]);

    // Theirs removed the bus; ours untouched → removed.
    const withBus = base([mkBus]);
    const rm = threeWayMerge(withBus, cloneGraph(withBus), base());
    const merged2 = cloneGraph(withBus);
    for (const op of rm.autoOps) expect(applyOp(merged2, op).ok).toBe(true);
    expect(merged2.buses.size).toBe(0);

    // Ours-touched membership wins the race (no replay).
    const baseB = base([mkBus]);
    const oursB = base([mkBus, { kind: 'assign_to_bus', netId: FIX.netB, busId: 'bus1' }]);
    const theirsB = base([mkBus, { kind: 'assign_to_bus', netId: FIX.netA, busId: 'bus1' }]);
    const race = threeWayMerge(baseB, oursB, theirsB);
    const merged3 = cloneGraph(oursB);
    for (const op of race.autoOps) expect(applyOp(merged3, op).ok).toBe(true);
    expect(merged3.buses.get('bus1')?.memberNets).toEqual([FIX.netB]);
  });

  it('invariants flag inconsistent memberships, missing parents, cycles, dangling bindings', () => {
    const g = base([mkBus, mkSheet]);
    g.buses.get('bus1')?.memberNets.push('ghost-net');
    const n = g.nets.get(FIX.netB);
    if (n) n.busId = 'ghost-bus';
    g.sheets.set('orphan', { id: 'orphan', name: 'o', parentId: 'ghost', interface: [] });
    g.sheets.set('cyc-a', { id: 'cyc-a', name: 'a', parentId: 'cyc-b', interface: [] });
    g.sheets.set('cyc-b', { id: 'cyc-b', name: 'b', parentId: 'cyc-a', interface: [] });
    g.sheets.get('sh1')?.interface.push({ name: 'X', direction: 'in', netId: 'ghost-net' });
    const r1 = g.components.get(FIX.r1);
    if (r1) r1.sheetId = 'ghost-sheet';
    const messages = validateGraph(g).map((v) => v.message);
    expect(messages.some((m) => m.includes('bus bus1 lists net ghost-net'))).toBe(true);
    expect(messages.some((m) => m.includes('claims bus ghost-bus'))).toBe(true);
    expect(messages.some((m) => m.includes('missing parent ghost'))).toBe(true);
    expect(messages.some((m) => m.includes('parent cycle'))).toBe(true);
    expect(messages.some((m) => m.includes('binds missing net ghost-net'))).toBe(true);
    expect(messages.some((m) => m.includes('missing sheet ghost-sheet'))).toBe(true);
  });

  it('serialization round-trips; legacy snapshots without sheets load', () => {
    const g = base([mkBus, { kind: 'assign_to_bus', netId: FIX.netA, busId: 'bus1' }, mkSheet]);
    const back = graphFromJson(graphToJson(g));
    expect(back.buses.get('bus1')?.memberNets).toEqual([FIX.netA]);
    expect(back.sheets.get('sh1')?.name).toBe('psu');

    const legacy = graphToJson(base());
    delete (legacy as { sheets?: unknown[] }).sheets;
    expect(graphFromJson(legacy).sheets.size).toBe(0);
  });
});

describe('coverage of defensive and guard branches', () => {
  it('apply survives corrupt member lists and stale busId pointers', () => {
    const g = base([mkBus, { kind: 'assign_to_bus', netId: FIX.netA, busId: 'bus1' }]);
    // Corrupt: a member net that does not exist.
    g.buses.get('bus1')?.memberNets.push('ghost-net');
    expect(applyOp(g, { kind: 'remove_bus', id: 'bus1' }).ok).toBe(true);

    // Corrupt: busId pointing at a vanished bus; reassign must not crash.
    const g2 = base([mkBus]);
    const net = g2.nets.get(FIX.netA);
    if (net) net.busId = 'vanished';
    expect(applyOp(g2, { kind: 'assign_to_bus', netId: FIX.netA, busId: 'bus1' }).ok).toBe(true);
    expect(g2.buses.get('bus1')?.memberNets).toEqual([FIX.netA]);

    // Corrupt: old bus exists but does not list the net.
    const g3 = base([mkBus, { kind: 'create_bus', id: 'bus2', name: 'B', busKind: 'custom' }]);
    const net3 = g3.nets.get(FIX.netA);
    if (net3) net3.busId = 'bus1'; // bus1.memberNets stays empty
    expect(applyOp(g3, { kind: 'assign_to_bus', netId: FIX.netA, busId: 'bus2' }).ok).toBe(true);

    // Re-assigning to the SAME bus is idempotent on members.
    expect(applyOp(g3, { kind: 'assign_to_bus', netId: FIX.netA, busId: 'bus2' }).ok).toBe(true);
    expect(g3.buses.get('bus2')?.memberNets).toEqual([FIX.netA]);
  });

  it('diff sees a sheetId move in BOTH directions', () => {
    const home = base([mkSheet]);
    const moved = base([mkSheet, { kind: 'move_to_sheet', componentId: FIX.r1, sheetId: 'sh1' }]);
    expect(diff(moved, home).components.changed.get(FIX.r1)?.[0]).toMatchObject({
      field: 'sheetId',
      a: 'sh1',
      b: null,
    });
  });

  it('merge guard paths: races, residents, unavailable parents and bindings', () => {
    // Bus removed by theirs while ours changed its membership → kept.
    const b1 = base([mkBus]);
    const ours1 = base([mkBus, { kind: 'assign_to_bus', netId: FIX.netA, busId: 'bus1' }]);
    const r1 = threeWayMerge(b1, ours1, base());
    expect(r1.autoOps.filter((o) => o.kind === 'remove_bus')).toEqual([]);

    // Membership changed on both sides → ours wins, no replay.
    const both = threeWayMerge(
      b1,
      base([mkBus, { kind: 'assign_to_bus', netId: FIX.netA, busId: 'bus1' }]),
      base([mkBus, { kind: 'assign_to_bus', netId: FIX.netB, busId: 'bus1' }]),
    );
    expect(both.autoOps.filter((o) => o.kind === 'assign_to_bus')).toEqual([]);

    // Theirs detached a member ours still has → detach replays.
    const withMember = base([mkBus, { kind: 'assign_to_bus', netId: FIX.netA, busId: 'bus1' }]);
    const detach = threeWayMerge(
      withMember,
      cloneGraph(withMember),
      base([mkBus, { kind: 'assign_to_bus', netId: FIX.netA, busId: 'bus1' }, { kind: 'assign_to_bus', netId: FIX.netA, busId: null }]),
    );
    expect(detach.autoOps).toContainEqual({ kind: 'assign_to_bus', netId: FIX.netA, busId: null });

    // Sheet removed by theirs but OURS moved a component onto it → kept.
    const s1 = base([mkSheet]);
    const oursResident = base([mkSheet, { kind: 'move_to_sheet', componentId: FIX.r1, sheetId: 'sh1' }]);
    const rmSheet = threeWayMerge(s1, oursResident, base());
    expect(rmSheet.autoOps.filter((o) => o.kind === 'remove_sheet')).toEqual([]);

    // Theirs-added subsheet whose parent ours lacks (and theirs did not add) → skipped.
    const parentless = cloneGraph(base());
    parentless.sheets.set('alien', { id: 'alien', name: 'a', parentId: 'not-here', interface: [] });
    const skip = threeWayMerge(base(), cloneGraph(base()), parentless);
    expect(skip.autoOps.filter((o) => o.kind === 'add_sheet')).toEqual([]);

    // Theirs interface binding a net ours lacks → interface replay skipped.
    const s2 = base([mkSheet]);
    const theirsIface = cloneGraph(s2);
    theirsIface.sheets.get('sh1')?.interface.push({ name: 'X', direction: 'in', netId: 'their-only-net' });
    const ifaceSkip = threeWayMerge(s2, cloneGraph(s2), theirsIface);
    expect(ifaceSkip.autoOps.filter((o) => o.kind === 'set_sheet_interface')).toEqual([]);

    // Interface changed on both sides → ours wins, no replay.
    const mk = (n: string): DesignGraph =>
      base([mkSheet, { kind: 'set_sheet_interface', sheetId: 'sh1', interface: [{ name: n, direction: 'in', netId: FIX.netA }] }]);
    const ifaceRace = threeWayMerge(base([mkSheet]), mk('OURS'), mk('THEIRS'));
    expect(ifaceRace.autoOps.filter((o) => o.kind === 'set_sheet_interface')).toEqual([]);

    // A sheetId move to a sheet ours lacks (not added by theirs) → skipped.
    const ghostMove = cloneGraph(base());
    ghostMove.sheets.set('gs', { id: 'gs', name: 'g', parentId: null, interface: [] });
    const c = ghostMove.components.get(FIX.r1);
    if (c) c.sheetId = 'gs';
    ghostMove.sheets.delete('gs'); // theirs is corrupt-ish; the guard must skip
    const moveSkip = threeWayMerge(base(), cloneGraph(base()), ghostMove);
    expect(moveSkip.autoOps.filter((o) => o.kind === 'move_to_sheet')).toEqual([]);

    // Both-added same bus id → no duplicate create.
    const dup = threeWayMerge(base(), base([mkBus]), base([mkBus]));
    expect(dup.autoOps.filter((o) => o.kind === 'create_bus')).toEqual([]);
  });
});

describe('GC and merge leave UNRELATED buses and sheet ports alone', () => {
  it('bystanders survive a net death and a net merge untouched', () => {
    const setup: OpBody[] = [
      mkBus,
      { kind: 'assign_to_bus', netId: FIX.netA, busId: 'bus1' },
      mkSheet,
      { kind: 'set_sheet_interface', sheetId: 'sh1', interface: [{ name: 'V', direction: 'in', netId: FIX.netA }] },
    ];
    // GND dies — bus1/sh1 reference only netA and must not change.
    const g = base(setup);
    expect(applyOp(g, { kind: 'disconnect', port: `${FIX.led}:K` }).ok).toBe(true);
    const r = applyOp(g, { kind: 'disconnect', port: `${FIX.bat}:-` });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.warnings.some((w) => w.code === 'bus_member_gc')).toBe(false);
      expect(r.warnings.some((w) => w.code === 'sheet_port_gc')).toBe(false);
    }
    expect(g.buses.get('bus1')?.memberNets).toEqual([FIX.netA]);
    expect(g.sheets.get('sh1')?.interface).toHaveLength(1);

    // netB merges away — again, no effect on netA's bus/port.
    const g2 = base(setup);
    expect(applyOp(g2, { kind: 'merge_nets', survivor: FIX.netA, absorbed: FIX.netB }).ok).toBe(true);
    expect(g2.buses.get('bus1')?.memberNets).toEqual([FIX.netA]);
    expect(g2.sheets.get('sh1')?.interface[0]?.netId).toBe(FIX.netA);
  });
});

describe('assign_to_bus is idempotent against a corrupt one-sided membership', () => {
  it('a bus already listing the net (without the back-pointer) gains no duplicate', () => {
    const g = base([mkBus]);
    g.buses.get('bus1')?.memberNets.push(FIX.netA); // one-sided corruption
    expect(applyOp(g, { kind: 'assign_to_bus', netId: FIX.netA, busId: 'bus1' }).ok).toBe(true);
    expect(g.buses.get('bus1')?.memberNets).toEqual([FIX.netA]); // no dup
    expect(validateGraph(g)).toEqual([]);
  });
});
