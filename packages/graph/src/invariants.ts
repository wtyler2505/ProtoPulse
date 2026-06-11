import { parsePortRef } from './types.js';

import type { DesignGraph, Uuid } from './types.js';

/**
 * Graph invariants — Vol II §A.4. Violations after materialization mean
 * a corrupt log: apply() should have made these unrepresentable.
 */
export interface InvariantViolation {
  code:
    | 'dangling_port'
    | 'unknown_pin'
    | 'port_in_multiple_nets'
    | 'duplicate_ref'
    | 'geometry_on_dead_net'
    | 'placement_without_component'
    | 'non_integer_coordinate';
  message: string;
  entityId?: Uuid;
}

export interface InvariantOpts {
  /** When the caller has a parts registry, pins are checked for existence. */
  pinExists?: (partId: Uuid, partRev: number, pinKey: string) => boolean;
}

export function validateGraph(graph: DesignGraph, opts: InvariantOpts = {}): InvariantViolation[] {
  const out: InvariantViolation[] = [];

  // 1. Every PortRef in every net resolves to a live component pin.
  // 2. A port belongs to at most one net.
  const seenPorts = new Map<string, Uuid>();
  for (const net of graph.nets.values()) {
    for (const port of net.ports) {
      const { componentId, pinKey } = parsePortRef(port);
      const comp = graph.components.get(componentId);
      if (!comp) {
        out.push({
          code: 'dangling_port',
          message: `net ${net.name} references port ${port} on a missing component`,
          entityId: net.id,
        });
        continue;
      }
      if (opts.pinExists && !opts.pinExists(comp.partId, comp.partRev, pinKey)) {
        out.push({
          code: 'unknown_pin',
          message: `net ${net.name} references pin ${pinKey} that does not exist on part ${comp.partId}`,
          entityId: net.id,
        });
      }
      const prior = seenPorts.get(port);
      if (prior !== undefined) {
        out.push({
          code: 'port_in_multiple_nets',
          message: `port ${port} appears on nets ${prior} and ${net.id}`,
          entityId: net.id,
        });
      } else {
        seenPorts.set(port, net.id);
      }
    }
  }

  // 3. Ref designators unique per design.
  const refs = new Map<string, Uuid>();
  for (const comp of graph.components.values()) {
    const prior = refs.get(comp.ref);
    if (prior !== undefined) {
      out.push({
        code: 'duplicate_ref',
        message: `ref designator ${comp.ref} used by ${prior} and ${comp.id}`,
        entityId: comp.id,
      });
    } else {
      refs.set(comp.ref, comp.id);
    }
  }

  // 4. Wire/trace/via geometry must sit on a live net.
  for (const netId of graph.schematic.wires.keys()) {
    if (!graph.nets.has(netId)) {
      out.push({
        code: 'geometry_on_dead_net',
        message: `wire geometry attached to missing net ${netId}`,
        entityId: netId,
      });
    }
  }
  for (const trace of graph.pcb.traces.values()) {
    if (!graph.nets.has(trace.netId)) {
      out.push({
        code: 'geometry_on_dead_net',
        message: `trace ${trace.id} attached to missing net ${trace.netId}`,
        entityId: trace.id,
      });
    }
  }
  for (const bus of graph.buses.values()) {
    for (const netId of bus.memberNets) {
      const net = graph.nets.get(netId);
      if (net?.busId !== bus.id) {
        out.push({
          code: 'geometry_on_dead_net',
          message: `bus ${bus.id} lists net ${netId} which is missing or not assigned back`,
          entityId: bus.id,
        });
      }
    }
  }
  for (const net of graph.nets.values()) {
    if (net.busId !== undefined) {
      const bus = graph.buses.get(net.busId);
      if (!bus?.memberNets.includes(net.id)) {
        out.push({
          code: 'geometry_on_dead_net',
          message: `net ${net.id} claims bus ${net.busId} which is missing or does not list it`,
          entityId: net.id,
        });
      }
    }
  }
  for (const sheet of graph.sheets.values()) {
    if (sheet.parentId !== null && !graph.sheets.has(sheet.parentId)) {
      out.push({
        code: 'geometry_on_dead_net',
        message: `sheet ${sheet.id} has missing parent ${sheet.parentId}`,
        entityId: sheet.id,
      });
    }
    // Cycle walk — parents must terminate at a root.
    const seen = new Set<string>([sheet.id]);
    let cursor = sheet.parentId;
    while (cursor !== null) {
      if (seen.has(cursor)) {
        out.push({
          code: 'geometry_on_dead_net',
          message: `sheet ${sheet.id} is part of a parent cycle`,
          entityId: sheet.id,
        });
        break;
      }
      seen.add(cursor);
      cursor = graph.sheets.get(cursor)?.parentId ?? null;
    }
    for (const port of sheet.interface) {
      if (!graph.nets.has(port.netId)) {
        out.push({
          code: 'geometry_on_dead_net',
          message: `sheet ${sheet.id} port ${port.name} binds missing net ${port.netId}`,
          entityId: sheet.id,
        });
      }
    }
  }
  for (const comp of graph.components.values()) {
    if (comp.sheetId !== undefined && !graph.sheets.has(comp.sheetId)) {
      out.push({
        code: 'placement_without_component',
        message: `component ${comp.id} lives on missing sheet ${comp.sheetId}`,
        entityId: comp.id,
      });
    }
  }
  for (const zone of graph.pcb.zones.values()) {
    if (!graph.nets.has(zone.netId)) {
      out.push({
        code: 'geometry_on_dead_net',
        message: `zone ${zone.id} attached to missing net ${zone.netId}`,
        entityId: zone.id,
      });
    }
  }
  for (const via of graph.pcb.vias.values()) {
    if (!graph.nets.has(via.netId)) {
      out.push({
        code: 'geometry_on_dead_net',
        message: `via ${via.id} attached to missing net ${via.netId}`,
        entityId: via.id,
      });
    }
  }

  // View records must have entities.
  for (const componentId of graph.schematic.placements.keys()) {
    if (!graph.components.has(componentId)) {
      out.push({
        code: 'placement_without_component',
        message: `schematic placement for missing component ${componentId}`,
        entityId: componentId,
      });
    }
  }
  for (const componentId of graph.pcb.placements.keys()) {
    if (!graph.components.has(componentId)) {
      out.push({
        code: 'placement_without_component',
        message: `footprint placement for missing component ${componentId}`,
        entityId: componentId,
      });
    }
  }

  // 6. All coordinates integers (zod guards the boundary; re-check the data).
  for (const [componentId, placement] of graph.schematic.placements) {
    if (!Number.isInteger(placement.at.x) || !Number.isInteger(placement.at.y)) {
      out.push({
        code: 'non_integer_coordinate',
        message: `placement of ${componentId} has non-integer coordinates`,
        entityId: componentId,
      });
    }
  }
  for (const [netId, segments] of graph.schematic.wires) {
    for (const s of segments) {
      if (
        !Number.isInteger(s.a.x) ||
        !Number.isInteger(s.a.y) ||
        !Number.isInteger(s.b.x) ||
        !Number.isInteger(s.b.y)
      ) {
        out.push({
          code: 'non_integer_coordinate',
          message: `wire segment on net ${netId} has non-integer coordinates`,
          entityId: netId,
        });
        break;
      }
    }
  }
  for (const [componentId, placement] of graph.pcb.placements) {
    if (!Number.isInteger(placement.at.x) || !Number.isInteger(placement.at.y)) {
      out.push({
        code: 'non_integer_coordinate',
        message: `footprint placement of ${componentId} has non-integer coordinates`,
        entityId: componentId,
      });
    }
  }
  for (const trace of graph.pcb.traces.values()) {
    if (trace.path.some((p) => !Number.isInteger(p.x) || !Number.isInteger(p.y))) {
      out.push({
        code: 'non_integer_coordinate',
        message: `trace ${trace.id} has non-integer coordinates`,
        entityId: trace.id,
      });
    }
  }
  for (const via of graph.pcb.vias.values()) {
    if (!Number.isInteger(via.at.x) || !Number.isInteger(via.at.y)) {
      out.push({
        code: 'non_integer_coordinate',
        message: `via ${via.id} has non-integer coordinates`,
        entityId: via.id,
      });
    }
  }
  for (const zone of graph.pcb.zones.values()) {
    if (zone.outline.some((v) => !Number.isInteger(v.x) || !Number.isInteger(v.y))) {
      out.push({
        code: 'non_integer_coordinate',
        message: `zone ${zone.id} has non-integer coordinates`,
        entityId: zone.id,
      });
    }
  }

  return out;
}
