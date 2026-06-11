import { netOfPort, parsePortRef } from './types.js';

import type { OpBody } from './ops.js';
import type { DesignGraph, Net, Trace, Uuid, Via, WireSegment, Zone } from './types.js';

/**
 * Undo emits the inverse op — the log is forward-only and honest about
 * what happened. Inversion needs the graph state *before* the op, so the
 * caller (undo stack) captures it at dispatch time.
 *
 * Returns the ops that, applied after `op`, restore the affected state.
 * Some ops (annotate, checkpoint) are not undoable and invert to [].
 */
export function invertOp(before: DesignGraph, op: OpBody): OpBody[] {
  switch (op.kind) {
    case 'add_component':
      return [{ kind: 'remove_component', id: op.id }];

    case 'remove_component':
      return resurrectComponent(before, op.id);

    case 'set_component_props': {
      const comp = before.components.get(op.id);
      if (!comp) return [];
      const props: { ref?: string; value?: string | null; dnp?: boolean; fields?: Record<string, string> } =
        {};
      if (op.props.ref !== undefined) props.ref = comp.ref;
      if (op.props.value !== undefined) props.value = comp.value ?? null;
      if (op.props.dnp !== undefined) props.dnp = comp.dnp;
      if (op.props.fields !== undefined) props.fields = { ...comp.fields };
      return [{ kind: 'set_component_props', id: op.id, props }];
    }

    case 'connect':
      return [{ kind: 'disconnect', port: op.port }];

    case 'disconnect': {
      const net = netOfPort(before, op.port);
      if (!net) return [];
      if (net.ports.length === 1) {
        // Disconnecting the last port GC'd the net — restore it whole.
        return restoreNet(before, net, [op.port]);
      }
      return [{ kind: 'connect', port: op.port, netId: net.id }];
    }

    case 'merge_nets': {
      const absorbed = before.nets.get(op.absorbed);
      const survivor = before.nets.get(op.survivor);
      if (!absorbed || !survivor) return [];
      const out: OpBody[] = [
        { kind: 'split_net', netId: op.survivor, movedPorts: [...absorbed.ports], newNetId: op.absorbed },
        { kind: 'rename_net', netId: op.absorbed, name: absorbed.name },
        { kind: 'set_net_class', netId: op.absorbed, netClass: absorbed.netClass },
      ];
      out.push(...restoreWires(before, op.survivor));
      out.push(...restoreWires(before, op.absorbed));
      // Merge re-pointed the absorbed net's traces/vias at the survivor;
      // recreate them on the restored net (same ids, original geometry).
      out.push(...repointPcbGeometry(before, op.absorbed));
      return out;
    }

    case 'split_net': {
      const net = before.nets.get(op.netId);
      if (!net) return [];
      return [{ kind: 'merge_nets', survivor: op.netId, absorbed: op.newNetId }];
    }

    case 'rename_net': {
      const net = before.nets.get(op.netId);
      if (!net) return [];
      return [{ kind: 'rename_net', netId: op.netId, name: net.name }];
    }

    case 'set_net_class': {
      const net = before.nets.get(op.netId);
      if (!net) return [];
      return [{ kind: 'set_net_class', netId: op.netId, netClass: net.netClass }];
    }

    case 'add_constraint':
      return [{ kind: 'remove_constraint', id: op.id }];

    case 'remove_constraint': {
      const c = before.constraints.get(op.id);
      if (!c) return [];
      return [
        {
          kind: 'add_constraint',
          id: c.id,
          body: structuredClone(c.body),
          ...(c.rationale !== undefined ? { rationale: c.rationale } : {}),
        },
      ];
    }

    case 'place_symbol':
    case 'move_symbol': {
      const prev = before.schematic.placements.get(op.componentId);
      if (!prev) return [{ kind: 'unplace_symbol', componentId: op.componentId }];
      return [
        {
          kind: 'move_symbol',
          componentId: op.componentId,
          at: { ...prev.at },
          rot: prev.rot,
          mirror: prev.mirror,
        },
      ];
    }

    case 'unplace_symbol': {
      const prev = before.schematic.placements.get(op.componentId);
      if (!prev) return [];
      return [
        {
          kind: 'place_symbol',
          componentId: op.componentId,
          at: { ...prev.at },
          rot: prev.rot,
          mirror: prev.mirror,
        },
      ];
    }

    case 'set_wire_geometry': {
      const prev = before.schematic.wires.get(op.netId) ?? [];
      return [{ kind: 'set_wire_geometry', netId: op.netId, segments: cloneSegments(prev) }];
    }

    case 'place_footprint':
    case 'move_footprint': {
      const prev = before.pcb.placements.get(op.componentId);
      if (!prev) {
        return op.kind === 'place_footprint'
          ? [{ kind: 'unplace_footprint', componentId: op.componentId }]
          : [];
      }
      return [
        {
          kind: 'move_footprint',
          componentId: op.componentId,
          at: { ...prev.at },
          rotMilli: prev.rotMilli,
          side: prev.side,
          locked: prev.locked,
        },
      ];
    }

    case 'unplace_footprint': {
      const prev = before.pcb.placements.get(op.componentId);
      if (!prev) return [];
      return [
        {
          kind: 'place_footprint',
          componentId: op.componentId,
          at: { ...prev.at },
          rotMilli: prev.rotMilli,
          side: prev.side,
          locked: prev.locked,
        },
      ];
    }

    case 'route_trace':
      return [{ kind: 'remove_trace', id: op.id }];

    case 'remove_trace': {
      const trace = before.pcb.traces.get(op.id);
      if (!trace) return [];
      return [routeTraceOp(trace)];
    }

    case 'place_via':
      return [{ kind: 'remove_via', id: op.id }];

    case 'place_zone':
      return [{ kind: 'remove_zone', id: op.id }];

    case 'remove_zone': {
      const zone = before.pcb.zones.get(op.id);
      if (!zone) return [];
      return [placeZoneOp(zone)];
    }

    case 'remove_via': {
      const via = before.pcb.vias.get(op.id);
      if (!via) return [];
      return [placeViaOp(via)];
    }

    case 'set_design_meta': {
      const patch: Record<string, string> = {};
      for (const key of Object.keys(op.patch)) {
        patch[key] = before.meta[key] ?? '';
      }
      return [{ kind: 'set_design_meta', patch }];
    }

    case 'batch': {
      // Invert members in reverse order, threading the intermediate state.
      // We need each member's "before", so replay the batch on a clone.
      const inverses: OpBody[] = [];
      const draft = structuredClone(before);
      for (const member of op.ops) {
        inverses.unshift(...invertOp(draft, member));
        // Best-effort replay; a member that fails changes nothing.
        // (applyOp import would create a cycle; inline minimal replay via
        // dynamic import is worse — accept the dependency.)
        applyForInversion(draft, member);
      }
      return [{ kind: 'batch', ops: inverses, label: `undo: ${op.label}` }];
    }

    case 'checkpoint':
    case 'annotate':
      return [];
  }
}

// Lazy import breaks an ESM cycle (apply.ts ← inverse.ts would be fine,
// but keep inversion self-contained): re-implemented as a thin wrapper.
import { applyOp } from './apply.js';
function applyForInversion(draft: DesignGraph, op: OpBody): void {
  applyOp(draft, op);
}

function cloneSegments(segments: readonly WireSegment[]): WireSegment[] {
  return segments.map((s) => ({ a: { ...s.a }, b: { ...s.b } }));
}

function routeTraceOp(trace: Trace): OpBody {
  return {
    kind: 'route_trace',
    id: trace.id,
    netId: trace.netId,
    layerId: trace.layerId,
    widthNm: trace.widthNm,
    path: trace.path.map((p) => ({ ...p })),
  };
}

function placeZoneOp(zone: Zone): OpBody {
  return {
    kind: 'place_zone',
    id: zone.id,
    netId: zone.netId,
    layerId: zone.layerId,
    outline: zone.outline.map((v) => ({ ...v })),
    ...(zone.clearanceNm !== undefined ? { clearanceNm: zone.clearanceNm } : {}),
  };
}

function placeViaOp(via: Via): OpBody {
  return {
    kind: 'place_via',
    id: via.id,
    netId: via.netId,
    at: { ...via.at },
    drillNm: via.drillNm,
    padNm: via.padNm,
    span: [via.span[0], via.span[1]],
  };
}

/** Ops that restore a GC'd net: identity, name, class, membership, geometry. */
function restoreNet(before: DesignGraph, net: Net, ports: readonly string[]): OpBody[] {
  const [first, ...rest] = ports;
  if (first === undefined) return [];
  const out: OpBody[] = [{ kind: 'connect', port: first, newNetId: net.id }];
  for (const p of rest) out.push({ kind: 'connect', port: p, netId: net.id });
  out.push({ kind: 'rename_net', netId: net.id, name: net.name });
  out.push({ kind: 'set_net_class', netId: net.id, netClass: net.netClass });
  out.push(...restoreWires(before, net.id));
  out.push(...restorePcbGeometry(before, net.id));
  return out;
}

function restoreWires(before: DesignGraph, netId: Uuid): OpBody[] {
  const wires = before.schematic.wires.get(netId);
  if (!wires || wires.length === 0) return [];
  return [{ kind: 'set_wire_geometry', netId, segments: cloneSegments(wires) }];
}

/** Re-route the traces and re-place the vias a dead net's GC swept away. */
function restorePcbGeometry(before: DesignGraph, netId: Uuid): OpBody[] {
  const out: OpBody[] = [];
  for (const trace of before.pcb.traces.values()) {
    if (trace.netId === netId) out.push(routeTraceOp(trace));
  }
  for (const via of before.pcb.vias.values()) {
    if (via.netId === netId) out.push(placeViaOp(via));
  }
  for (const zone of before.pcb.zones.values()) {
    if (zone.netId === netId) out.push(placeZoneOp(zone));
  }
  return out;
}

/** After un-merging, traces/vias the merge re-pointed at the survivor get
 *  removed and re-routed with their original net (ids preserved). */
function repointPcbGeometry(before: DesignGraph, netId: Uuid): OpBody[] {
  const out: OpBody[] = [];
  for (const trace of before.pcb.traces.values()) {
    if (trace.netId === netId) out.push({ kind: 'remove_trace', id: trace.id }, routeTraceOp(trace));
  }
  for (const via of before.pcb.vias.values()) {
    if (via.netId === netId) out.push({ kind: 'remove_via', id: via.id }, placeViaOp(via));
  }
  for (const zone of before.pcb.zones.values()) {
    if (zone.netId === netId) out.push({ kind: 'remove_zone', id: zone.id }, placeZoneOp(zone));
  }
  return out;
}

/**
 * Inverse of remove_component: recreate the component, its placement,
 * and every net membership it had — including nets the removal GC'd.
 */
function resurrectComponent(before: DesignGraph, componentId: Uuid): OpBody[] {
  const comp = before.components.get(componentId);
  if (!comp) return [];
  const out: OpBody[] = [
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
    out.push({
      kind: 'set_component_props',
      id: comp.id,
      props: { dnp: comp.dnp, fields: { ...comp.fields } },
    });
  }
  const placement = before.schematic.placements.get(componentId);
  if (placement) {
    out.push({
      kind: 'place_symbol',
      componentId,
      at: { ...placement.at },
      rot: placement.rot,
      mirror: placement.mirror,
    });
  }
  const footprint = before.pcb.placements.get(componentId);
  if (footprint) {
    out.push({
      kind: 'place_footprint',
      componentId,
      at: { ...footprint.at },
      rotMilli: footprint.rotMilli,
      side: footprint.side,
      locked: footprint.locked,
    });
  }
  for (const net of before.nets.values()) {
    const memberPorts = net.ports.filter((p) => parsePortRef(p).componentId === componentId);
    if (memberPorts.length === 0) continue;
    const survives = net.ports.length > memberPorts.length;
    if (survives) {
      // The net still exists after removal — just reconnect.
      for (const p of memberPorts) out.push({ kind: 'connect', port: p, netId: net.id });
    } else {
      // Removal GC'd this net — restore identity, name, class, wires.
      out.push(...restoreNet(before, net, memberPorts));
    }
  }
  return out;
}
