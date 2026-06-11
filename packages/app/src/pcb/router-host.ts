import { newUuid, parsePortRef } from '@protopulse/graph';
import { pcbViewOf } from '@protopulse/renderer';
import { buildObstacleSet, planShove, routeHead } from '@protopulse/route';

import { runDrcDirect } from '../drc/runner.js';
import { partDb } from '../state/session.js';

import { ratsnestSegments } from './ratsnest.js';
import { routingClearanceNm } from './routing.js';
import { DEFAULT_TRACE_WIDTH_NM } from './types.js';

import type { PadSource } from './tools.js';
import type {
  PinnedRouteOutcome,
  PinnedUnroutedPair,
  RouterHooks,
} from '@protopulse/ai';
import type { DesignGraph, OpBody, Vec } from '@protopulse/graph';
import type { FootprintSource } from '@protopulse/route';

/**
 * The Router's real hooks: ratsnest from the canvas's own helper, walk
 * routes through the walkaround engine, shove routes through planShove
 * (victims and all), DRC through the lazy module. The same machinery
 * the human trace tool drives — the agent just holds the mouse.
 */

const padSource = partDb as unknown as PadSource;
const footprints = partDb as unknown as FootprintSource;

function labelOf(graph: DesignGraph, port: string): string {
  const { componentId, pinKey } = parsePortRef(port);
  const ref = graph.components.get(componentId)?.ref ?? componentId;
  return `${ref}:${pinKey}`;
}

function pairsFor(graph: DesignGraph): (PinnedUnroutedPair & { aVec: Vec; bVec: Vec })[] {
  return ratsnestSegments(graph, pcbViewOf(graph), padSource).map((seg) => ({
    netId: seg.netId,
    netName: graph.nets.get(seg.netId)?.name ?? seg.netId,
    a: { x: seg.a.x, y: seg.a.y, label: labelOf(graph, seg.aPort) },
    b: { x: seg.b.x, y: seg.b.y, label: labelOf(graph, seg.bPort) },
    aVec: seg.a,
    bVec: seg.b,
  }));
}

export function createRouterHooks(): RouterHooks {
  return {
    ratsnest: (graph) => pairsFor(graph).map(({ aVec: _a, bVec: _b, ...pair }) => pair),

    route: (graph, req): PinnedRouteOutcome => {
      const clearanceNm = routingClearanceNm();
      if (clearanceNm === null) {
        return { ok: false, reason: 'rule deck still loading — try again in a moment' };
      }
      const pair = pairsFor(graph).find((p) => p.netId === req.netId);
      if (!pair) {
        return { ok: false, reason: 'that net has no unrouted connections (read_board to re-check)' };
      }
      const widthNm = req.widthNm ?? DEFAULT_TRACE_WIDTH_NM;
      const span = `${pair.a.label}→${pair.b.label}`;

      if (req.mode === 'walk') {
        const set = buildObstacleSet(graph, footprints, {
          layerId: req.layerId,
          clearanceNm,
          widthNm,
          netId: req.netId,
        });
        const r = routeHead(pair.aVec, pair.bVec, set);
        if (r.blocked) {
          return { ok: false, reason: `walkaround found no clear corridor for ${span} — try mode "shove"` };
        }
        return {
          ok: true,
          ops: [
            {
              kind: 'route_trace',
              id: newUuid(),
              netId: req.netId,
              layerId: req.layerId,
              widthNm,
              path: r.path,
            },
          ],
          summary: `routed ${pair.netName} ${span} on ${req.layerId} (walk, ${String(r.path.length)} points)`,
        };
      }

      // shove: straight line; blocking traces detour around it.
      const path: Vec[] = [pair.aVec, pair.bVec];
      const plan = planShove(path, graph, footprints, {
        layerId: req.layerId,
        clearanceNm,
        widthNm,
        netId: req.netId,
      });
      if (plan.kind === 'blocked') return { ok: false, reason: plan.reason };
      const ops: OpBody[] = [
        { kind: 'route_trace', id: newUuid(), netId: req.netId, layerId: req.layerId, widthNm, path },
      ];
      const reroutes = plan.kind === 'shove' ? plan.reroutes : [];
      for (const r of reroutes) {
        const victim = graph.pcb.traces.get(r.traceId);
        if (!victim) continue;
        ops.push(
          { kind: 'remove_trace', id: r.traceId },
          {
            kind: 'route_trace',
            id: r.traceId,
            netId: victim.netId,
            layerId: victim.layerId,
            widthNm: victim.widthNm,
            path: r.path,
          },
        );
      }
      return {
        ok: true,
        ops,
        summary: `routed ${pair.netName} ${span} on ${req.layerId} (shove, ${String(reroutes.length)} trace(s) moved aside)`,
      };
    },

    drc: async (graph) => {
      const findings = await runDrcDirect(graph, partDb);
      return findings.map((f) => ({ severity: f.severity, code: f.code, message: f.message }));
    },
  };
}
