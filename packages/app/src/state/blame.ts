import { describeOp } from './replay.js';

import type { OpBody, OpEnvelope } from '@protopulse/graph';

/**
 * Blame on canvas: every op envelope already records who (actor),
 * when (ts), and — for AI/fix ops — why (meta.rationale). Blame is
 * just a filtered view of the op-log from one entity's perspective.
 * Pure and graph-free; the Inspector joins it to the selection.
 */

export interface BlameEntry {
  /** 1-based position in the branch's effective op sequence — feeds
   *  setReplayIndex for "jump to this moment". */
  index: number;
  actor: string;
  ts: number;
  agent?: string;
  rationale?: string;
  /** What this envelope did to the entity (the matching inner op when
   *  the envelope is a batch). */
  summary: string;
}

/** Does `op` reference the entity (component or net) with this id? */
function opTouches(op: OpBody, entityId: string): boolean {
  const portPrefix = `${entityId}:`;
  switch (op.kind) {
    case 'add_component':
    case 'remove_component':
    case 'set_component_props':
    case 'remove_constraint':
      return op.id === entityId;
    case 'place_symbol':
    case 'move_symbol':
    case 'unplace_symbol':
    case 'place_footprint':
    case 'move_footprint':
    case 'unplace_footprint':
      return op.componentId === entityId;
    case 'connect':
      return (
        op.port.startsWith(portPrefix) || op.netId === entityId || op.newNetId === entityId
      );
    case 'disconnect':
      return op.port.startsWith(portPrefix);
    case 'rename_net':
    case 'set_net_class':
    case 'set_wire_geometry':
    case 'route_trace':
    case 'place_via':
      return op.netId === entityId;
    case 'merge_nets':
      return op.survivor === entityId || op.absorbed === entityId;
    case 'split_net':
      return (
        op.netId === entityId ||
        op.newNetId === entityId ||
        op.movedPorts.some((p) => p.startsWith(portPrefix))
      );
    case 'batch':
      return op.ops.some((inner) => opTouches(inner, entityId));
    default:
      return false;
  }
}

/** One line for what an envelope did to the entity: the first matching
 *  inner op when batched (suffixed with the batch label and a +N when
 *  several inner ops touched it). */
function summaryFor(op: OpBody, entityId: string): string {
  if (op.kind !== 'batch') return describeOp(op);
  const matching = op.ops.filter((inner) => opTouches(inner, entityId));
  const first = matching[0];
  if (!first) return describeOp(op);
  const more = matching.length > 1 ? ` +${String(matching.length - 1)} more` : '';
  return `${describeOp(first)}${more} — "${op.label}"`;
}

/** Every envelope in `envelopes` that touched the entity, in op order. */
export function blameFor(envelopes: readonly OpEnvelope[], entityId: string): BlameEntry[] {
  const out: BlameEntry[] = [];
  envelopes.forEach((env, i) => {
    if (!opTouches(env.op, entityId)) return;
    out.push({
      index: i + 1,
      actor: env.actor,
      ts: env.ts,
      ...(env.meta?.agent !== undefined ? { agent: env.meta.agent } : {}),
      ...(env.meta?.rationale !== undefined ? { rationale: env.meta.rationale } : {}),
      summary: summaryFor(env.op, entityId),
    });
  });
  return out;
}

/** Human-ish actor label: UUIDs shorten to their first block. */
export function actorLabel(actor: string): string {
  return /^[0-9a-f]{8}-[0-9a-f]{4}/i.test(actor) ? actor.slice(0, 8) : actor;
}
