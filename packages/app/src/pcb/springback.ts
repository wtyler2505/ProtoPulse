import { pathIsLegal } from '@protopulse/route';

import { routingClearanceNm } from './routing.js';
import { SHOVE_LABEL } from './tools.js';

import type { PcbOpBody } from './types.js';
import type { DesignGraph, OpBody, OpEnvelope, Uuid, Vec } from '@protopulse/graph';
import type { FootprintSource } from '@protopulse/route';

/**
 * Spring-back (Vol II §E.1 step 3): when the trace that shoved others
 * aside is deleted, the victims return to the paths they had before the
 * shove — IF they still can. The op-log is the memory: a shove commit
 * is a batch labeled 'shove' whose first route_trace is the shover and
 * whose remove/route pairs are the victims, so "the path before the
 * shove" is simply the victim's last route_trace before that batch.
 *
 * A victim only springs back when BOTH hold:
 * - its current path is still exactly the shoved path (the user hasn't
 *   re-routed it since — their later edit outranks our restoration),
 * - the original path is clearance-legal in the post-delete world.
 */

interface ShoveRecord {
  victimId: Uuid;
  originalPath: Vec[];
  shovedPath: Vec[];
}

function clonePath(path: readonly Vec[]): Vec[] {
  return path.map((p) => ({ x: p.x, y: p.y }));
}

function samePath(a: readonly Vec[], b: readonly Vec[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const p = a[i];
    const q = b[i];
    if (!p || p.x !== q?.x || p.y !== q.y) return false;
  }
  return true;
}

/** Flatten an op into [op] or a batch's leaves (depth-first). */
function leavesOf(op: OpBody): OpBody[] {
  if (op.kind !== 'batch') return [op];
  return op.ops.flatMap(leavesOf);
}

/**
 * Scan the branch's effective ops: latest shove record per (shover,
 * victim), tracking every trace's current-known path as we go so the
 * "original" is whatever the victim had right before the shove batch.
 */
export function collectShoveRecords(
  envelopes: readonly OpEnvelope[],
): Map<Uuid, ShoveRecord[]> {
  const pathOf = new Map<Uuid, Vec[]>();
  const records = new Map<Uuid, ShoveRecord[]>();

  for (const env of envelopes) {
    const op = env.op;
    if (op.kind === 'batch' && op.label === SHOVE_LABEL) {
      const routes = leavesOf(op).filter((o) => o.kind === 'route_trace');
      const shover = routes[0];
      if (shover !== undefined) {
        const recs: ShoveRecord[] = [];
        for (const r of routes.slice(1)) {
          const original = pathOf.get(r.id);
          if (original) {
            recs.push({
              victimId: r.id,
              originalPath: clonePath(original),
              shovedPath: clonePath(r.path),
            });
          }
        }
        // Latest shove by this shover wins outright (re-shove replaces).
        if (recs.length > 0) records.set(shover.id, recs);
      }
    }
    // Keep the path index current (covers the batch we just processed too).
    for (const leaf of leavesOf(op)) {
      if (leaf.kind === 'route_trace') pathOf.set(leaf.id, clonePath(leaf.path));
      else if (leaf.kind === 'remove_trace') pathOf.delete(leaf.id);
    }
  }
  return records;
}

/** Graph copy without the given traces (the delete being committed). */
function graphWithoutTraces(graph: DesignGraph, ids: ReadonlySet<Uuid>): DesignGraph {
  const traces = new Map(graph.pcb.traces);
  for (const id of ids) traces.delete(id);
  return { ...graph, pcb: { ...graph.pcb, traces } };
}

/**
 * Restoration ops to append to a trace-delete batch. `graph` is the
 * live pre-delete graph; `deletedTraceIds` the traces being removed.
 * Returns [] when the deck hasn't loaded (spring-back is an
 * enhancement, never a blocker) or nothing qualifies.
 */
export function springBackOps(
  envelopes: readonly OpEnvelope[],
  graph: DesignGraph,
  parts: FootprintSource,
  deletedTraceIds: ReadonlySet<Uuid>,
  clearanceNm: number | null,
): OpBody[] {
  if (clearanceNm === null || deletedTraceIds.size === 0) return [];
  const records = collectShoveRecords(envelopes);
  const afterDelete = graphWithoutTraces(graph, deletedTraceIds);
  const ops: OpBody[] = [];

  for (const shoverId of deletedTraceIds) {
    for (const rec of records.get(shoverId) ?? []) {
      if (deletedTraceIds.has(rec.victimId)) continue; // victim is going too
      const victim = graph.pcb.traces.get(rec.victimId);
      if (!victim) continue; // gone some other way
      if (!samePath(victim.path, rec.shovedPath)) continue; // user re-routed it — theirs wins
      const legal = pathIsLegal(rec.originalPath, afterDelete, parts, {
        layerId: victim.layerId,
        clearanceNm,
        widthNm: victim.widthNm,
        netId: victim.netId,
        ignoreTraceId: victim.id,
      });
      if (!legal) continue; // the world changed — the old path no longer fits
      ops.push(
        { kind: 'remove_trace', id: victim.id },
        {
          kind: 'route_trace',
          id: victim.id,
          netId: victim.netId,
          layerId: victim.layerId,
          widthNm: victim.widthNm,
          path: clonePath(rec.originalPath),
        },
      );
    }
  }
  return ops;
}

/**
 * Convenience for the two delete paths (toolbar + Delete key): append
 * spring-back restorations to a delete-ops batch. Deleted trace ids
 * are read off the delete ops themselves.
 */
export function withSpringBack(
  deleteOps: PcbOpBody[],
  envelopes: readonly OpEnvelope[],
  graph: DesignGraph,
  parts: FootprintSource,
): PcbOpBody[] {
  const deleted = new Set<Uuid>();
  for (const op of deleteOps) if (op.kind === 'remove_trace') deleted.add(op.id);
  if (deleted.size === 0) return deleteOps;
  const restores = springBackOps(envelopes, graph, parts, deleted, routingClearanceNm());
  // Restorations are route/remove ops — members of the pcb op union.
  return [...deleteOps, ...(restores as PcbOpBody[])];
}
