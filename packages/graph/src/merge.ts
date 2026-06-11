import { diff } from './diff.js';
import { netOfPort } from './types.js';

import type { OpBody } from './ops.js';
import type { DesignGraph, PortRef, Uuid } from './types.js';

/**
 * Three-way merge over materialized graphs — Vol II §A.7.
 *
 * Auto-merges: disjoint entities; same entity, different properties;
 * view-geometry vs graph changes. Conflicts are surfaced as data — a
 * wrong silent merge in EDA is a fried board, so nothing structural is
 * ever resolved silently. Callers present `conflicts` and refuse to
 * merge until every one has a resolution (see resolveConflict below —
 * the app's Branches panel is the interactive resolver).
 *
 * `autoOps` transform OURS into the merged result by replaying THEIRS'
 * non-conflicting changes.
 */
export type MergeConflict =
  | {
      kind: 'property';
      entity: Uuid;
      entityKind: 'component' | 'net' | 'constraint' | 'meta';
      field: string;
      base: unknown;
      ours: unknown;
      theirs: unknown;
    }
  | { kind: 'structural'; port: PortRef; oursNet: Uuid | null; theirsNet: Uuid | null }
  | { kind: 'remove_vs_modify'; entity: Uuid; entityKind: 'component' | 'net'; removedBy: 'ours' | 'theirs' };

export interface MergeResult {
  autoOps: OpBody[];
  conflicts: MergeConflict[];
}

export function threeWayMerge(
  base: DesignGraph,
  ours: DesignGraph,
  theirs: DesignGraph,
): MergeResult {
  const autoOps: OpBody[] = [];
  const conflicts: MergeConflict[] = [];
  /** move_to_sheet replays must land AFTER the sheets section creates
   *  any theirs-added target sheets — collected here, appended there. */
  const deferredSheetMoves: OpBody[] = [];
  const baseToTheirs = diff(base, theirs);
  const baseToOurs = diff(base, ours);

  // ── Components added in theirs ──
  for (const id of baseToTheirs.components.added) {
    if (ours.components.has(id)) continue; // both added the same entity (same id) — already there
    const comp = theirs.components.get(id);
    if (!comp) continue;
    autoOps.push({
      kind: 'add_component',
      id: comp.id,
      ref: comp.ref,
      partId: comp.partId,
      partRev: comp.partRev,
      ...(comp.value !== undefined ? { value: comp.value } : {}),
    });
    if (comp.dnp || Object.keys(comp.fields).length > 0) {
      autoOps.push({
        kind: 'set_component_props',
        id: comp.id,
        props: { dnp: comp.dnp, fields: { ...comp.fields } },
      });
    }
    const placement = theirs.schematic.placements.get(id);
    if (placement) {
      autoOps.push({
        kind: 'place_symbol',
        componentId: id,
        at: { ...placement.at },
        rot: placement.rot,
        mirror: placement.mirror,
      });
    }
    const footprint = theirs.pcb.placements.get(id);
    if (footprint) {
      autoOps.push({
        kind: 'place_footprint',
        componentId: id,
        at: { ...footprint.at },
        rotMilli: footprint.rotMilli,
        side: footprint.side,
        locked: footprint.locked,
      });
    }
  }

  // ── Components removed in theirs ──
  const oursChangedComponents = new Set(baseToOurs.components.changed.keys());
  for (const id of baseToTheirs.components.removed) {
    if (!ours.components.has(id)) continue; // ours removed it too
    if (oursChangedComponents.has(id) || componentNetsChangedInOurs(base, ours, id)) {
      conflicts.push({ kind: 'remove_vs_modify', entity: id, entityKind: 'component', removedBy: 'theirs' });
      continue;
    }
    autoOps.push({ kind: 'remove_component', id });
  }
  // The mirror case: ours removed, theirs modified — surface it.
  const theirsChangedComponents = new Set(baseToTheirs.components.changed.keys());
  for (const id of baseToOurs.components.removed) {
    if (theirsChangedComponents.has(id) || componentNetsChangedInTheirs(base, theirs, id)) {
      conflicts.push({ kind: 'remove_vs_modify', entity: id, entityKind: 'component', removedBy: 'ours' });
    }
  }

  // ── Component property changes in theirs ──
  for (const [id, deltas] of baseToTheirs.components.changed) {
    if (!ours.components.has(id)) continue; // handled by remove_vs_modify above
    const oursDeltas = baseToOurs.components.changed.get(id);
    const oursFields = new Map((oursDeltas ?? []).map((d) => [d.field, d]));
    const props: { ref?: string; value?: string | null; dnp?: boolean; fields?: Record<string, string> } = {};
    for (const d of deltas) {
      const oursTouch = oursFields.get(d.field);
      if (oursTouch && JSON.stringify(oursTouch.b) !== JSON.stringify(d.b)) {
        conflicts.push({
          kind: 'property',
          entity: id,
          entityKind: 'component',
          field: d.field,
          base: d.a,
          ours: oursTouch.b,
          theirs: d.b,
        });
        continue;
      }
      if (oursTouch) continue; // both made the same change
      if (d.field === 'sheetId') {
        const target = d.b as Uuid | null;
        if (target === null || ours.sheets.has(target) || baseToTheirs.sheets.added.includes(target)) {
          deferredSheetMoves.push({ kind: 'move_to_sheet', componentId: id, sheetId: target });
        }
        continue;
      }
      if (d.field === 'ref') props.ref = d.b as string;
      else if (d.field === 'value') props.value = (d.b as string | undefined) ?? null;
      else if (d.field === 'dnp') props.dnp = d.b as boolean;
      else if (d.field === 'fields') props.fields = d.b as Record<string, string>;
      // partId/partRev changes: treat as property conflict-free patch is
      // not expressible as an op in M1 — surface as a conflict instead.
      else {
        conflicts.push({
          kind: 'property',
          entity: id,
          entityKind: 'component',
          field: d.field,
          base: d.a,
          ours: d.a,
          theirs: d.b,
        });
      }
    }
    if (Object.keys(props).length > 0) {
      autoOps.push({ kind: 'set_component_props', id, props });
    }
  }

  // ── Net membership: per-port three-way ──
  // Components whose removal is already replayed (or conflicted) are
  // excluded — their port disconnections happen via remove_component.
  const removedComponents = new Set<Uuid>();
  for (const o of autoOps) if (o.kind === 'remove_component') removedComponents.add(o.id);
  for (const c of conflicts) if (c.kind === 'remove_vs_modify') removedComponents.add(c.entity);
  const ports = new Set<PortRef>();
  for (const g of [base, ours, theirs]) {
    for (const net of g.nets.values()) for (const p of net.ports) ports.add(p);
  }
  for (const port of ports) {
    const portComponent = port.split(':')[0] ?? '';
    if (removedComponents.has(portComponent)) continue;
    const inBase = netOfPort(base, port)?.id ?? null;
    const inOurs = netOfPort(ours, port)?.id ?? null;
    const inTheirs = netOfPort(theirs, port)?.id ?? null;
    const oursMoved = inOurs !== inBase;
    const theirsMoved = inTheirs !== inBase;
    if (!theirsMoved) continue;
    if (oursMoved) {
      if (inOurs === inTheirs) continue; // converged
      // Skip ports whose component is gone on either side (handled above).
      conflicts.push({ kind: 'structural', port, oursNet: inOurs, theirsNet: inTheirs });
      continue;
    }
    // Theirs moved, ours didn't: replay.
    const componentId = port.split(':')[0] ?? '';
    if (!ours.components.has(componentId) && !baseToTheirs.components.added.includes(componentId)) {
      continue; // component removed in ours — covered by remove_vs_modify
    }
    if (inOurs !== null) autoOps.push({ kind: 'disconnect', port });
    if (inTheirs !== null) {
      const theirNet = theirs.nets.get(inTheirs);
      autoOps.push(
        ours.nets.has(inTheirs) || autoOpsCreateNet(autoOps, inTheirs)
          ? { kind: 'connect', port, netId: inTheirs }
          : { kind: 'connect', port, newNetId: inTheirs },
      );
      if (theirNet && !ours.nets.has(inTheirs) && !netRenamedIn(autoOps, inTheirs)) {
        autoOps.push({ kind: 'rename_net', netId: inTheirs, name: theirNet.name });
        if (theirNet.netClass !== 'default') {
          autoOps.push({ kind: 'set_net_class', netId: inTheirs, netClass: theirNet.netClass });
        }
      }
    }
  }

  // ── Net renames/class changes (theirs side, non-membership) ──
  for (const [id, [, newName]] of baseToTheirs.nets.renamed) {
    if (!ours.nets.has(id)) continue;
    const oursRename = baseToOurs.nets.renamed.get(id);
    if (oursRename && oursRename[1] !== newName) {
      conflicts.push({
        kind: 'property',
        entity: id,
        entityKind: 'net',
        field: 'name',
        base: oursRename[0],
        ours: oursRename[1],
        theirs: newName,
      });
      continue;
    }
    if (!oursRename) autoOps.push({ kind: 'rename_net', netId: id, name: newName });
  }

  // ── Buses & sheets (theirs-only changes replay; ours wins races) ──
  for (const id of baseToTheirs.buses.added) {
    if (ours.buses.has(id)) continue;
    const bus = theirs.buses.get(id);
    if (!bus) continue;
    autoOps.push({ kind: 'create_bus', id: bus.id, name: bus.name, busKind: bus.kind });
    for (const netId of bus.memberNets) {
      if (ours.nets.has(netId) || autoOpsCreateNet(autoOps, netId)) {
        autoOps.push({ kind: 'assign_to_bus', netId, busId: bus.id });
      }
    }
  }
  for (const id of baseToTheirs.buses.removed) {
    if (!ours.buses.has(id) || baseToOurs.buses.changed.includes(id)) continue;
    autoOps.push({ kind: 'remove_bus', id });
  }
  for (const id of baseToTheirs.buses.changed) {
    if (!ours.buses.has(id) || baseToOurs.buses.changed.includes(id)) continue;
    const theirBus = theirs.buses.get(id);
    const ourBus = ours.buses.get(id);
    if (!theirBus || !ourBus) continue;
    for (const netId of theirBus.memberNets) {
      if (!ourBus.memberNets.includes(netId) && ours.nets.has(netId)) {
        autoOps.push({ kind: 'assign_to_bus', netId, busId: id });
      }
    }
    for (const netId of ourBus.memberNets) {
      if (!theirBus.memberNets.includes(netId) && !theirs.nets.has(netId)) continue;
      if (!theirBus.memberNets.includes(netId)) {
        autoOps.push({ kind: 'assign_to_bus', netId, busId: null });
      }
    }
  }
  for (const id of baseToTheirs.sheets.added) {
    if (ours.sheets.has(id)) continue;
    const sheet = theirs.sheets.get(id);
    if (!sheet) continue;
    if (sheet.parentId !== null && !ours.sheets.has(sheet.parentId) &&
        !baseToTheirs.sheets.added.includes(sheet.parentId)) {
      continue; // parent unavailable in ours — skip rather than corrupt
    }
    autoOps.push({ kind: 'add_sheet', id: sheet.id, name: sheet.name, parentId: sheet.parentId });
    if (sheet.interface.length > 0) {
      const bindable = sheet.interface.filter((port) => ours.nets.has(port.netId));
      if (bindable.length === sheet.interface.length) {
        autoOps.push({
          kind: 'set_sheet_interface',
          sheetId: sheet.id,
          interface: sheet.interface.map((port) => ({ ...port })),
        });
      }
    }
  }
  for (const id of baseToTheirs.sheets.removed) {
    if (!ours.sheets.has(id) || baseToOurs.sheets.changed.includes(id)) continue;
    const hasResidents =
      [...ours.sheets.values()].some((sub) => sub.parentId === id) ||
      [...ours.components.values()].some((c) => c.sheetId === id);
    if (!hasResidents) autoOps.push({ kind: 'remove_sheet', id });
  }
  for (const id of baseToTheirs.sheets.changed) {
    if (!ours.sheets.has(id) || baseToOurs.sheets.changed.includes(id)) continue;
    const sheet = theirs.sheets.get(id);
    if (!sheet) continue;
    if (sheet.interface.every((port) => ours.nets.has(port.netId))) {
      autoOps.push({
        kind: 'set_sheet_interface',
        sheetId: id,
        interface: sheet.interface.map((port) => ({ ...port })),
      });
    }
  }

  autoOps.push(...deferredSheetMoves);

  // ── Constraints ──
  for (const id of baseToTheirs.constraints.added) {
    if (ours.constraints.has(id)) continue;
    const c = theirs.constraints.get(id);
    if (!c) continue;
    autoOps.push({
      kind: 'add_constraint',
      id: c.id,
      body: structuredClone(c.body),
      ...(c.rationale !== undefined ? { rationale: c.rationale } : {}),
    });
  }
  for (const id of baseToTheirs.constraints.removed) {
    if (!ours.constraints.has(id)) continue;
    if (baseToOurs.constraints.changed.includes(id)) {
      conflicts.push({
        kind: 'property',
        entity: id,
        entityKind: 'constraint',
        field: 'body',
        base: base.constraints.get(id)?.body,
        ours: ours.constraints.get(id)?.body,
        theirs: undefined,
      });
      continue;
    }
    autoOps.push({ kind: 'remove_constraint', id });
  }

  // ── View geometry: geometry yields to graph; non-conflicting moves replay ──
  for (const id of baseToTheirs.schematicView.moved) {
    if (!ours.components.has(id)) continue;
    if (baseToOurs.schematicView.moved.includes(id)) continue; // ours wins on geometry races
    const p = theirs.schematic.placements.get(id);
    if (!p) continue;
    autoOps.push({ kind: 'move_symbol', componentId: id, at: { ...p.at }, rot: p.rot, mirror: p.mirror });
  }
  for (const netId of baseToTheirs.schematicView.wiresChanged) {
    if (!ours.nets.has(netId)) continue;
    if (baseToOurs.schematicView.wiresChanged.includes(netId)) continue;
    const segments = theirs.schematic.wires.get(netId) ?? [];
    autoOps.push({
      kind: 'set_wire_geometry',
      netId,
      segments: segments.map((s) => ({ a: { ...s.a }, b: { ...s.b } })),
    });
  }

  // PCB geometry mirrors the schematic rules: theirs-only changes replay,
  // ours wins geometry races.
  for (const id of baseToTheirs.pcbView.moved) {
    if (!ours.pcb.placements.has(id)) continue;
    if (baseToOurs.pcbView.moved.includes(id)) continue;
    const p = theirs.pcb.placements.get(id);
    if (!p) continue;
    autoOps.push({
      kind: 'move_footprint',
      componentId: id,
      at: { ...p.at },
      rotMilli: p.rotMilli,
      side: p.side,
      locked: p.locked,
    });
  }
  // Removals before additions so a changed trace/via (remove+add, same id)
  // replays in an order apply() accepts.
  const oursTouchedTraces = new Set([...baseToOurs.pcbView.tracesAdded, ...baseToOurs.pcbView.tracesRemoved]);
  for (const id of baseToTheirs.pcbView.tracesRemoved) {
    if (!ours.pcb.traces.has(id) || oursTouchedTraces.has(id)) continue;
    autoOps.push({ kind: 'remove_trace', id });
  }
  for (const id of baseToTheirs.pcbView.tracesAdded) {
    if (oursTouchedTraces.has(id)) continue;
    const t = theirs.pcb.traces.get(id);
    if (!t || !ours.nets.has(t.netId)) continue;
    if (ours.pcb.traces.has(id) && !baseToTheirs.pcbView.tracesRemoved.includes(id)) continue;
    autoOps.push({
      kind: 'route_trace',
      id: t.id,
      netId: t.netId,
      layerId: t.layerId,
      widthNm: t.widthNm,
      path: t.path.map((p) => ({ ...p })),
    });
  }
  const oursTouchedZones = new Set([...baseToOurs.pcbView.zonesAdded, ...baseToOurs.pcbView.zonesRemoved]);
  for (const id of baseToTheirs.pcbView.zonesRemoved) {
    if (!ours.pcb.zones.has(id) || oursTouchedZones.has(id)) continue;
    autoOps.push({ kind: 'remove_zone', id });
  }
  for (const id of baseToTheirs.pcbView.zonesAdded) {
    if (oursTouchedZones.has(id)) continue;
    const zn = theirs.pcb.zones.get(id);
    if (!zn || !ours.nets.has(zn.netId)) continue;
    if (ours.pcb.zones.has(id) && !baseToTheirs.pcbView.zonesRemoved.includes(id)) continue;
    autoOps.push({
      kind: 'place_zone',
      id: zn.id,
      netId: zn.netId,
      layerId: zn.layerId,
      outline: zn.outline.map((p) => ({ ...p })),
      ...(zn.clearanceNm !== undefined ? { clearanceNm: zn.clearanceNm } : {}),
      ...(zn.connect !== undefined ? { connect: zn.connect } : {}),
    });
  }
  // Board outline: singleton, ours-wins when both touched it.
  if (baseToTheirs.pcbView.outlineChanged && !baseToOurs.pcbView.outlineChanged) {
    autoOps.push({
      kind: 'set_board_outline',
      outline: theirs.pcb.outline ? theirs.pcb.outline.map((p) => ({ ...p })) : null,
    });
  }
  const oursTouchedVias = new Set([...baseToOurs.pcbView.viasAdded, ...baseToOurs.pcbView.viasRemoved]);
  for (const id of baseToTheirs.pcbView.viasRemoved) {
    if (!ours.pcb.vias.has(id) || oursTouchedVias.has(id)) continue;
    autoOps.push({ kind: 'remove_via', id });
  }
  for (const id of baseToTheirs.pcbView.viasAdded) {
    if (oursTouchedVias.has(id)) continue;
    const v = theirs.pcb.vias.get(id);
    if (!v || !ours.nets.has(v.netId)) continue;
    if (ours.pcb.vias.has(id) && !baseToTheirs.pcbView.viasRemoved.includes(id)) continue;
    autoOps.push({
      kind: 'place_via',
      id: v.id,
      netId: v.netId,
      at: { ...v.at },
      drillNm: v.drillNm,
      padNm: v.padNm,
      span: [v.span[0], v.span[1]],
    });
  }

  return { autoOps, conflicts };
}

// ── Interactive resolution (the resolver UI's engine half) ───────────

export type MergeChoice = 'ours' | 'theirs';

/**
 * Ops that apply ONE conflict's resolution onto OURS. Choosing 'ours'
 * keeps the current branch's state — always expressible, always `[]`.
 * Choosing 'theirs' replays the other side's version; returns null when
 * that cannot be expressed as ops in M1 (partId/partRev swaps, net
 * removals) so callers can disable the choice instead of lying.
 *
 * `prior` is the op list the resolution will be appended to (autoOps +
 * earlier resolutions) — needed so two resolutions recreating the same
 * net agree on connect-vs-create, mirroring threeWayMerge's own checks.
 */
export function resolveConflict(
  conflict: MergeConflict,
  choice: MergeChoice,
  graphs: { ours: DesignGraph; theirs: DesignGraph },
  prior: readonly OpBody[] = [],
): OpBody[] | null {
  if (choice === 'ours') return [];
  const { ours, theirs } = graphs;

  switch (conflict.kind) {
    case 'property': {
      if (conflict.entityKind === 'component') {
        const id = conflict.entity;
        if (!ours.components.has(id)) return null;
        if (conflict.field === 'ref' && typeof conflict.theirs === 'string') {
          return [{ kind: 'set_component_props', id, props: { ref: conflict.theirs } }];
        }
        if (conflict.field === 'value') {
          return [
            {
              kind: 'set_component_props',
              id,
              props: { value: (conflict.theirs as string | undefined) ?? null },
            },
          ];
        }
        if (conflict.field === 'dnp' && typeof conflict.theirs === 'boolean') {
          return [{ kind: 'set_component_props', id, props: { dnp: conflict.theirs } }];
        }
        if (conflict.field === 'fields') {
          return [
            {
              kind: 'set_component_props',
              id,
              props: { fields: { ...(conflict.theirs as Record<string, string>) } },
            },
          ];
        }
        return null; // partId/partRev — not expressible as an op in M1
      }
      if (conflict.entityKind === 'net' && conflict.field === 'name') {
        if (!ours.nets.has(conflict.entity) || typeof conflict.theirs !== 'string') return null;
        return [{ kind: 'rename_net', netId: conflict.entity, name: conflict.theirs }];
      }
      if (conflict.entityKind === 'constraint') {
        // The only constraint conflict emitted: theirs removed it while
        // ours changed it — taking theirs means removing.
        if (conflict.theirs === undefined && ours.constraints.has(conflict.entity)) {
          return [{ kind: 'remove_constraint', id: conflict.entity }];
        }
        return null;
      }
      return null; // meta — not emitted today
    }

    case 'structural': {
      const componentId = conflict.port.split(':')[0] ?? '';
      if (!ours.components.has(componentId)) return null;
      const ops: OpBody[] = [];
      if (conflict.oursNet !== null) ops.push({ kind: 'disconnect', port: conflict.port });
      if (conflict.theirsNet !== null) {
        ops.push(...connectLikeTheirs(conflict.port, conflict.theirsNet, ours, theirs, [...prior, ...ops]));
      }
      return ops;
    }

    case 'remove_vs_modify': {
      if (conflict.entityKind !== 'component') return null; // nets die with their last port
      const id = conflict.entity;
      if (conflict.removedBy === 'theirs') {
        // Theirs deleted the component ours modified — taking theirs removes it.
        return ours.components.has(id) ? [{ kind: 'remove_component', id }] : [];
      }
      // Ours deleted it, theirs modified it — taking theirs resurrects
      // theirs' version: identity, props, placement(s), connectivity.
      const comp = theirs.components.get(id);
      if (!comp) return null;
      const ops: OpBody[] = [
        {
          kind: 'add_component',
          id: comp.id,
          ref: comp.ref,
          partId: comp.partId,
          partRev: comp.partRev,
          ...(comp.value !== undefined ? { value: comp.value } : {}),
        },
      ];
      if (comp.dnp || Object.keys(comp.fields).length > 0) {
        ops.push({
          kind: 'set_component_props',
          id: comp.id,
          props: { dnp: comp.dnp, fields: { ...comp.fields } },
        });
      }
      const placement = theirs.schematic.placements.get(id);
      if (placement) {
        ops.push({
          kind: 'place_symbol',
          componentId: id,
          at: { ...placement.at },
          rot: placement.rot,
          mirror: placement.mirror,
        });
      }
      const footprint = theirs.pcb.placements.get(id);
      if (footprint) {
        ops.push({
          kind: 'place_footprint',
          componentId: id,
          at: { ...footprint.at },
          rotMilli: footprint.rotMilli,
          side: footprint.side,
          locked: footprint.locked,
        });
      }
      for (const net of theirs.nets.values()) {
        for (const port of net.ports) {
          if (!port.startsWith(`${id}:`)) continue;
          ops.push(...connectLikeTheirs(port, net.id, ours, theirs, [...prior, ...ops]));
        }
      }
      return ops;
    }
  }
}

/** Connect `port` to theirs' net, creating it in ours (with theirs'
 *  name and class) when neither ours nor the op list built so far has
 *  it yet. */
function connectLikeTheirs(
  port: PortRef,
  theirsNetId: Uuid,
  ours: DesignGraph,
  theirs: DesignGraph,
  prior: readonly OpBody[],
): OpBody[] {
  const ops: OpBody[] = [];
  const exists = ours.nets.has(theirsNetId) || autoOpsCreateNet(prior, theirsNetId);
  ops.push(
    exists
      ? { kind: 'connect', port, netId: theirsNetId }
      : { kind: 'connect', port, newNetId: theirsNetId },
  );
  const theirNet = theirs.nets.get(theirsNetId);
  if (theirNet && !exists && !netRenamedIn(prior, theirsNetId)) {
    ops.push({ kind: 'rename_net', netId: theirsNetId, name: theirNet.name });
    if (theirNet.netClass !== 'default') {
      ops.push({ kind: 'set_net_class', netId: theirsNetId, netClass: theirNet.netClass });
    }
  }
  return ops;
}

function autoOpsCreateNet(ops: readonly OpBody[], netId: Uuid): boolean {
  return ops.some((o) => o.kind === 'connect' && o.newNetId === netId);
}

function netRenamedIn(ops: readonly OpBody[], netId: Uuid): boolean {
  return ops.some((o) => o.kind === 'rename_net' && o.netId === netId);
}

function componentNetsChangedInOurs(base: DesignGraph, ours: DesignGraph, componentId: Uuid): boolean {
  return componentConnectivityDiffers(base, ours, componentId);
}

function componentNetsChangedInTheirs(base: DesignGraph, theirs: DesignGraph, componentId: Uuid): boolean {
  return componentConnectivityDiffers(base, theirs, componentId);
}

function componentConnectivityDiffers(a: DesignGraph, b: DesignGraph, componentId: Uuid): boolean {
  const portsOf = (g: DesignGraph): string => {
    const entries: string[] = [];
    for (const net of g.nets.values()) {
      for (const p of net.ports) {
        if (p.startsWith(`${componentId}:`)) entries.push(`${p}→${net.id}`);
      }
    }
    return entries.sort().join('|');
  };
  return portsOf(a) !== portsOf(b);
}
