import type { OpBody } from '@protopulse/graph';

/**
 * Replay support: one human-readable line per op for the History panel.
 * Pure and graph-free — descriptions come from the op payload itself
 * (ops are self-contained by design), so the list renders for any
 * prefix without materializing anything.
 */

/** Playback speeds offered by the History panel, in ops per second. */
export const REPLAY_SPEEDS = [
  { label: 'slow', opsPerSec: 2 },
  { label: 'normal', opsPerSec: 5 },
  { label: 'fast', opsPerSec: 12 },
] as const;

function fallback(kind: string): string {
  return kind.replaceAll('_', ' ');
}

export function describeOp(op: OpBody): string {
  switch (op.kind) {
    case 'add_component':
      return `add ${op.ref} (${op.partId}${op.value !== undefined ? `, ${op.value}` : ''})`;
    case 'remove_component':
      return `remove component ${op.id}`;
    case 'set_component_props': {
      const what = Object.keys(op.props).join(', ');
      return `edit ${op.id}: ${what.length > 0 ? what : 'props'}`;
    }
    case 'connect':
      return `connect ${op.port} → ${op.netId ?? `new net ${op.newNetId ?? ''}`}`;
    case 'disconnect':
      return `disconnect ${op.port}`;
    case 'rename_net':
      return `rename net ${op.netId} → "${op.name}"`;
    case 'merge_nets':
      return `merge net ${op.absorbed} into ${op.survivor}`;
    case 'place_symbol':
      return `place symbol ${op.componentId}`;
    case 'move_symbol':
      return `move symbol ${op.componentId}`;
    case 'unplace_symbol':
      return `unplace symbol ${op.componentId}`;
    case 'set_wire_geometry':
      return `draw wires for ${op.netId} (${String(op.segments.length)} segment${op.segments.length === 1 ? '' : 's'})`;
    case 'place_footprint':
      return `place footprint ${op.componentId} (${op.side})`;
    case 'move_footprint':
      return `move footprint ${op.componentId}`;
    case 'unplace_footprint':
      return `unplace footprint ${op.componentId}`;
    case 'route_trace':
      return `route ${op.layerId} trace on ${op.netId}`;
    case 'remove_trace':
      return `remove trace ${op.id}`;
    case 'place_via':
      return `place via on ${op.netId}`;
    case 'remove_via':
      return `remove via ${op.id}`;
    case 'add_constraint':
      return `add ${op.body.kind} constraint`;
    case 'remove_constraint':
      return `remove constraint ${op.id}`;
    case 'batch':
      return `${op.label} (${String(op.ops.length)} ops)`;
    default:
      return fallback(op.kind);
  }
}
