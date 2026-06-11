import { cloneGraph, insertPortSorted, netOfPort, parsePortRef } from './types.js';

import type { OpBody } from './ops.js';
import type { DesignGraph, Net, Uuid } from './types.js';

/**
 * Applying an op mutates a draft graph. A failed op is a no-op with a
 * warning (concurrent edits may race — e.g. connect to a deleted net);
 * only invariant violations after materialization are corrupt-log errors.
 */
export type ApplyResult =
  | { ok: true; warnings: ApplyWarning[] }
  | { ok: false; error: string };

export interface ApplyWarning {
  code: 'net_gc' | 'wire_gc' | 'trace_gc' | 'via_gc' | 'zone_gc' | 'bus_member_gc' | 'sheet_port_gc';
  message: string;
  netId?: Uuid;
}

function autoNetName(graph: DesignGraph): string {
  graph.counters.net += 1;
  return `N$${String(graph.counters.net)}`;
}

/** Remove a net and its dependent geometry (wires, traces, vias). */
function gcNet(graph: DesignGraph, netId: Uuid, warnings: ApplyWarning[]): void {
  graph.nets.delete(netId);
  if (graph.schematic.wires.has(netId)) {
    graph.schematic.wires.delete(netId);
    warnings.push({ code: 'wire_gc', message: `Wire geometry on dead net GC'd`, netId });
  }
  for (const [id, trace] of graph.pcb.traces) {
    if (trace.netId === netId) {
      graph.pcb.traces.delete(id);
      warnings.push({ code: 'trace_gc', message: `Trace ${id} on dead net GC'd`, netId });
    }
  }
  for (const [id, via] of graph.pcb.vias) {
    if (via.netId === netId) {
      graph.pcb.vias.delete(id);
      warnings.push({ code: 'via_gc', message: `Via ${id} on dead net GC'd`, netId });
    }
  }
  for (const [id, zone] of graph.pcb.zones) {
    if (zone.netId === netId) {
      graph.pcb.zones.delete(id);
      warnings.push({ code: 'zone_gc', message: `Zone ${id} on dead net GC'd`, netId });
    }
  }
  for (const bus of graph.buses.values()) {
    const at = bus.memberNets.indexOf(netId);
    if (at !== -1) {
      bus.memberNets.splice(at, 1);
      warnings.push({ code: 'bus_member_gc', message: `Dead net left bus ${bus.id}`, netId });
    }
  }
  for (const sheet of graph.sheets.values()) {
    const before = sheet.interface.length;
    sheet.interface = sheet.interface.filter((port) => port.netId !== netId);
    if (sheet.interface.length !== before) {
      warnings.push({ code: 'sheet_port_gc', message: `Sheet ${sheet.id} port on dead net GC'd`, netId });
    }
  }
  warnings.push({ code: 'net_gc', message: `Empty net GC'd`, netId });
}

export function applyOp(graph: DesignGraph, op: OpBody): ApplyResult {
  const warnings: ApplyWarning[] = [];
  const fail = (error: string): ApplyResult => ({ ok: false, error });
  const ok = (): ApplyResult => ({ ok: true, warnings });

  switch (op.kind) {
    case 'add_component': {
      if (graph.components.has(op.id)) return fail(`component ${op.id} already exists`);
      for (const c of graph.components.values()) {
        if (c.ref === op.ref) return fail(`ref designator ${op.ref} already in use`);
      }
      graph.components.set(op.id, {
        id: op.id,
        ref: op.ref,
        partId: op.partId,
        partRev: op.partRev,
        ...(op.value !== undefined ? { value: op.value } : {}),
        dnp: false,
        fields: {},
      });
      return ok();
    }

    case 'remove_component': {
      const comp = graph.components.get(op.id);
      if (!comp) return fail(`component ${op.id} not found`);
      // Remove its ports from all nets; GC nets that empty out.
      for (const net of [...graph.nets.values()]) {
        const before = net.ports.length;
        net.ports = net.ports.filter((p) => parsePortRef(p).componentId !== op.id);
        if (net.ports.length === 0 && before > 0) gcNet(graph, net.id, warnings);
      }
      graph.components.delete(op.id);
      graph.schematic.placements.delete(op.id);
      graph.pcb.placements.delete(op.id);
      return ok();
    }

    case 'set_component_props': {
      const comp = graph.components.get(op.id);
      if (!comp) return fail(`component ${op.id} not found`);
      if (op.props.ref !== undefined && op.props.ref !== comp.ref) {
        for (const c of graph.components.values()) {
          if (c.ref === op.props.ref) return fail(`ref designator ${op.props.ref} already in use`);
        }
        comp.ref = op.props.ref;
      }
      if (op.props.value !== undefined) {
        if (op.props.value === null) delete comp.value;
        else comp.value = op.props.value;
      }
      if (op.props.dnp !== undefined) comp.dnp = op.props.dnp;
      if (op.props.fields !== undefined) comp.fields = { ...op.props.fields };
      return ok();
    }

    case 'connect': {
      const { componentId } = parsePortRef(op.port);
      if (!graph.components.has(componentId)) {
        return fail(`port ${op.port} refers to missing component`);
      }
      const existing = netOfPort(graph, op.port);
      if (existing) {
        return fail(
          `port ${op.port} already on net ${existing.name} — shorting is an explicit merge_nets`,
        );
      }
      if (op.netId !== undefined) {
        const net = graph.nets.get(op.netId);
        if (!net) return fail(`net ${op.netId} not found`);
        insertPortSorted(net.ports, op.port);
        return ok();
      }
      if (op.newNetId === undefined) {
        return fail(`connect without netId requires a pre-allocated newNetId`);
      }
      if (graph.nets.has(op.newNetId)) return fail(`net ${op.newNetId} already exists`);
      const net: Net = {
        id: op.newNetId,
        name: autoNetName(graph),
        ports: [op.port],
        netClass: 'default',
      };
      graph.nets.set(net.id, net);
      return ok();
    }

    case 'disconnect': {
      const net = netOfPort(graph, op.port);
      if (!net) return fail(`port ${op.port} is not connected`);
      net.ports = net.ports.filter((p) => p !== op.port);
      if (net.ports.length === 0) gcNet(graph, net.id, warnings);
      return ok();
    }

    case 'merge_nets': {
      const survivor = graph.nets.get(op.survivor);
      const absorbed = graph.nets.get(op.absorbed);
      if (!survivor) return fail(`survivor net ${op.survivor} not found`);
      if (!absorbed) return fail(`absorbed net ${op.absorbed} not found`);
      if (op.survivor === op.absorbed) return fail(`cannot merge a net into itself`);
      for (const p of absorbed.ports) insertPortSorted(survivor.ports, p);
      const absorbedWires = graph.schematic.wires.get(op.absorbed);
      if (absorbedWires) {
        const survivorWires = graph.schematic.wires.get(op.survivor) ?? [];
        graph.schematic.wires.set(op.survivor, [...survivorWires, ...absorbedWires]);
        graph.schematic.wires.delete(op.absorbed);
      }
      // PCB geometry follows its copper: re-point absorbed traces/vias.
      for (const trace of graph.pcb.traces.values()) {
        if (trace.netId === op.absorbed) trace.netId = op.survivor;
      }
      for (const via of graph.pcb.vias.values()) {
        if (via.netId === op.absorbed) via.netId = op.survivor;
      }
      for (const zone of graph.pcb.zones.values()) {
        if (zone.netId === op.absorbed) zone.netId = op.survivor;
      }
      for (const bus of graph.buses.values()) {
        const at = bus.memberNets.indexOf(op.absorbed);
        if (at !== -1) bus.memberNets.splice(at, 1);
      }
      for (const sheet of graph.sheets.values()) {
        for (const port of sheet.interface) {
          if (port.netId === op.absorbed) port.netId = op.survivor;
        }
      }
      graph.nets.delete(op.absorbed);
      return ok();
    }

    case 'split_net': {
      const net = graph.nets.get(op.netId);
      if (!net) return fail(`net ${op.netId} not found`);
      if (graph.nets.has(op.newNetId)) return fail(`net ${op.newNetId} already exists`);
      const moved = new Set(op.movedPorts);
      for (const p of moved) {
        if (!net.ports.includes(p)) return fail(`port ${p} is not on net ${op.netId}`);
      }
      net.ports = net.ports.filter((p) => !moved.has(p));
      const newNet: Net = {
        id: op.newNetId,
        name: autoNetName(graph),
        ports: [...moved].sort(),
        netClass: net.netClass,
      };
      graph.nets.set(newNet.id, newNet);
      if (net.ports.length === 0) gcNet(graph, net.id, warnings);
      return ok();
    }

    case 'rename_net': {
      const net = graph.nets.get(op.netId);
      if (!net) return fail(`net ${op.netId} not found`);
      net.name = op.name;
      return ok();
    }

    case 'set_net_class': {
      const net = graph.nets.get(op.netId);
      if (!net) return fail(`net ${op.netId} not found`);
      net.netClass = op.netClass;
      return ok();
    }

    case 'add_constraint': {
      if (graph.constraints.has(op.id)) return fail(`constraint ${op.id} already exists`);
      graph.constraints.set(op.id, {
        id: op.id,
        body: op.body,
        ...(op.rationale !== undefined ? { rationale: op.rationale } : {}),
      });
      return ok();
    }

    case 'remove_constraint': {
      if (!graph.constraints.has(op.id)) return fail(`constraint ${op.id} not found`);
      graph.constraints.delete(op.id);
      return ok();
    }

    case 'place_symbol':
    case 'move_symbol': {
      if (!graph.components.has(op.componentId)) {
        return fail(`component ${op.componentId} not found`);
      }
      if (op.kind === 'move_symbol' && !graph.schematic.placements.has(op.componentId)) {
        return fail(`component ${op.componentId} has no placement to move`);
      }
      graph.schematic.placements.set(op.componentId, {
        at: { ...op.at },
        rot: op.rot,
        mirror: op.mirror,
      });
      return ok();
    }

    case 'unplace_symbol': {
      if (!graph.schematic.placements.has(op.componentId)) {
        return fail(`component ${op.componentId} has no placement`);
      }
      graph.schematic.placements.delete(op.componentId);
      return ok();
    }

    case 'set_wire_geometry': {
      if (!graph.nets.has(op.netId)) return fail(`net ${op.netId} not found`);
      if (op.segments.length === 0) graph.schematic.wires.delete(op.netId);
      else graph.schematic.wires.set(op.netId, op.segments.map((s) => ({ a: { ...s.a }, b: { ...s.b } })));
      return ok();
    }

    case 'place_footprint':
    case 'move_footprint': {
      if (!graph.components.has(op.componentId)) {
        return fail(`component ${op.componentId} not found`);
      }
      if (op.kind === 'move_footprint' && !graph.pcb.placements.has(op.componentId)) {
        return fail(`component ${op.componentId} has no footprint placement to move`);
      }
      graph.pcb.placements.set(op.componentId, {
        at: { ...op.at },
        rotMilli: op.rotMilli,
        side: op.side,
        locked: op.locked,
      });
      return ok();
    }

    case 'unplace_footprint': {
      if (!graph.pcb.placements.has(op.componentId)) {
        return fail(`component ${op.componentId} has no footprint placement`);
      }
      graph.pcb.placements.delete(op.componentId);
      return ok();
    }

    case 'route_trace': {
      if (!graph.nets.has(op.netId)) return fail(`net ${op.netId} not found`);
      if (graph.pcb.traces.has(op.id)) return fail(`trace ${op.id} already exists`);
      graph.pcb.traces.set(op.id, {
        id: op.id,
        netId: op.netId,
        layerId: op.layerId,
        widthNm: op.widthNm,
        path: op.path.map((p) => ({ ...p })),
      });
      return ok();
    }

    case 'remove_trace': {
      if (!graph.pcb.traces.has(op.id)) return fail(`trace ${op.id} not found`);
      graph.pcb.traces.delete(op.id);
      return ok();
    }

    case 'place_via': {
      if (!graph.nets.has(op.netId)) return fail(`net ${op.netId} not found`);
      if (graph.pcb.vias.has(op.id)) return fail(`via ${op.id} already exists`);
      graph.pcb.vias.set(op.id, {
        id: op.id,
        netId: op.netId,
        at: { ...op.at },
        drillNm: op.drillNm,
        padNm: op.padNm,
        span: [op.span[0], op.span[1]],
      });
      return ok();
    }

    case 'remove_via': {
      if (!graph.pcb.vias.has(op.id)) return fail(`via ${op.id} not found`);
      graph.pcb.vias.delete(op.id);
      return ok();
    }

    case 'place_zone': {
      if (!graph.nets.has(op.netId)) return fail(`net ${op.netId} not found`);
      if (graph.pcb.zones.has(op.id)) return fail(`zone ${op.id} already exists`);
      graph.pcb.zones.set(op.id, {
        id: op.id,
        netId: op.netId,
        layerId: op.layerId,
        outline: op.outline.map((v) => ({ ...v })),
        ...(op.clearanceNm !== undefined ? { clearanceNm: op.clearanceNm } : {}),
      });
      return ok();
    }

    case 'remove_zone': {
      if (!graph.pcb.zones.has(op.id)) return fail(`zone ${op.id} not found`);
      graph.pcb.zones.delete(op.id);
      return ok();
    }

    case 'create_bus': {
      if (graph.buses.has(op.id)) return fail(`bus ${op.id} already exists`);
      graph.buses.set(op.id, { id: op.id, name: op.name, kind: op.busKind, memberNets: [] });
      return ok();
    }

    case 'remove_bus': {
      const bus = graph.buses.get(op.id);
      if (!bus) return fail(`bus ${op.id} not found`);
      for (const netId of bus.memberNets) {
        const net = graph.nets.get(netId);
        if (net) delete net.busId;
      }
      graph.buses.delete(op.id);
      return ok();
    }

    case 'assign_to_bus': {
      const net = graph.nets.get(op.netId);
      if (!net) return fail(`net ${op.netId} not found`);
      const target = op.busId === null ? null : graph.buses.get(op.busId);
      if (op.busId !== null && !target) return fail(`bus ${op.busId} not found`);
      // Leave the old bus.
      if (net.busId !== undefined) {
        const old = graph.buses.get(net.busId);
        if (old) {
          const at = old.memberNets.indexOf(op.netId);
          if (at !== -1) old.memberNets.splice(at, 1);
        }
      }
      if (op.busId === null || !target) {
        delete net.busId;
      } else {
        net.busId = op.busId;
        if (!target.memberNets.includes(op.netId)) {
          target.memberNets.push(op.netId);
          target.memberNets.sort();
        }
      }
      return ok();
    }

    case 'add_sheet': {
      if (graph.sheets.has(op.id)) return fail(`sheet ${op.id} already exists`);
      if (op.parentId !== null && !graph.sheets.has(op.parentId)) {
        return fail(`parent sheet ${op.parentId} not found`);
      }
      graph.sheets.set(op.id, { id: op.id, name: op.name, parentId: op.parentId, interface: [] });
      return ok();
    }

    case 'remove_sheet': {
      if (!graph.sheets.has(op.id)) return fail(`sheet ${op.id} not found`);
      for (const sheet of graph.sheets.values()) {
        if (sheet.parentId === op.id) return fail(`sheet ${op.id} still has child sheets`);
      }
      for (const comp of graph.components.values()) {
        if (comp.sheetId === op.id) return fail(`sheet ${op.id} still has components on it`);
      }
      graph.sheets.delete(op.id);
      return ok();
    }

    case 'set_sheet_interface': {
      const sheet = graph.sheets.get(op.sheetId);
      if (!sheet) return fail(`sheet ${op.sheetId} not found`);
      for (const port of op.interface) {
        if (!graph.nets.has(port.netId)) {
          return fail(`sheet port ${port.name} binds missing net ${port.netId}`);
        }
      }
      sheet.interface = op.interface.map((port) => ({ ...port }));
      return ok();
    }

    case 'move_to_sheet': {
      const comp = graph.components.get(op.componentId);
      if (!comp) return fail(`component ${op.componentId} not found`);
      if (op.sheetId !== null && !graph.sheets.has(op.sheetId)) {
        return fail(`sheet ${op.sheetId} not found`);
      }
      if (op.sheetId === null) delete comp.sheetId;
      else comp.sheetId = op.sheetId;
      return ok();
    }

    case 'checkpoint':
      return ok();

    case 'annotate': {
      graph.annotations.push({ anchor: op.anchor, text: op.text });
      return ok();
    }

    case 'set_design_meta': {
      Object.assign(graph.meta, op.patch);
      return ok();
    }

    case 'batch': {
      // Atomic: apply to a clone; commit only if every member succeeds.
      const draft = cloneGraph(graph);
      const batchWarnings: ApplyWarning[] = [];
      for (const member of op.ops) {
        const res = applyOp(draft, member);
        if (!res.ok) return fail(`batch "${op.label}" failed: ${res.error}`);
        batchWarnings.push(...res.warnings);
      }
      // Commit: copy the draft's state back onto the live graph object.
      graph.components = draft.components;
      graph.nets = draft.nets;
      graph.buses = draft.buses;
      graph.constraints = draft.constraints;
      graph.schematic = draft.schematic;
      graph.pcb = draft.pcb;
      graph.annotations = draft.annotations;
      graph.meta = draft.meta;
      graph.counters = draft.counters;
      warnings.push(...batchWarnings);
      return ok();
    }
  }
}
