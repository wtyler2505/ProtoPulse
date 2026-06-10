import type { OpBody } from './ops.js';
import type { DesignGraph, Net, Uuid, WireSegment } from './types.js';
import { netOfPort, parsePortRef } from './types.js';

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

    case 'place_footprint':
    case 'route_trace':
    case 'place_via':
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

/** Ops that restore a GC'd net: identity, name, class, membership, wires. */
function restoreNet(before: DesignGraph, net: Net, ports: readonly string[]): OpBody[] {
  const [first, ...rest] = ports;
  if (first === undefined) return [];
  const out: OpBody[] = [{ kind: 'connect', port: first, newNetId: net.id }];
  for (const p of rest) out.push({ kind: 'connect', port: p, netId: net.id });
  out.push({ kind: 'rename_net', netId: net.id, name: net.name });
  out.push({ kind: 'set_net_class', netId: net.id, netClass: net.netClass });
  out.push(...restoreWires(before, net.id));
  return out;
}

function restoreWires(before: DesignGraph, netId: Uuid): OpBody[] {
  const wires = before.schematic.wires.get(netId);
  if (!wires || wires.length === 0) return [];
  return [{ kind: 'set_wire_geometry', netId, segments: cloneSegments(wires) }];
}
