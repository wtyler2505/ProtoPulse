/**
 * Autorouter-backed PCB trace suggestion tool.
 *
 * Extracted from `pcb-advanced.ts` to keep that module focused on
 * zone/teardrop/net-naming heuristics and this module focused on the A*
 * autorouter boundary.
 *
 * @module ai-tools/circuit/pcb-autoroute
 */

import { z } from 'zod';
import type { ToolRegistry } from '../registry';
import { guardCircuitInProject } from './shared';
import {
  autoroute,
  extractObstaclesFromCircuit,
  type Layer,
  type NetLike,
  type InstanceLike,
} from '../../lib/autorouter';

/**
 * Register the `suggest_trace_path` tool.
 *
 * Tools registered (1):
 * - `suggest_trace_path` — Suggest an optimal PCB routing path for a net
 *   using the real A* autorouter (no hardcoded stubs).
 *
 * @param registry - The {@link ToolRegistry} instance to register tools into.
 */
export function registerPcbAutorouteTools(registry: ToolRegistry): void {
  /**
   * suggest_trace_path — Suggest an optimal PCB trace path for a net.
   */
  registry.register({
    name: 'suggest_trace_path',
    description: 'Suggest an optimal routing path for a PCB net, avoiding existing components and traces.',
    category: 'circuit',
    parameters: z.object({
      circuitId: z.number().int().min(1).describe('The ID of the circuit design.'),
      netId: z.number().int().min(1).describe('The ID of the net to route.'),
      layer: z.string().default('front').describe('The PCB layer to route on.'),
    }),
    requiresConfirmation: false,
    execute: async (params, ctx) => {
      const guard = await guardCircuitInProject(params.circuitId, ctx);
      if (guard) return guard;

      const [net, instances] = await Promise.all([
        ctx.storage.getCircuitNet(params.netId),
        ctx.storage.getCircuitInstances(params.circuitId),
      ]);

      if (!net) return { success: false, message: 'Net not found.' };
      if (net.circuitId !== params.circuitId) {
        return { success: false, message: `Net ${String(params.netId)} does not belong to circuit ${String(params.circuitId)}.` };
      }

      // Real autorouter (A* on a 0.5mm grid with 2-layer support).
      //
      // Scope / simplifications (documented in server/lib/autorouter.ts):
      //   - single-net at a time (no rip-up-and-retry)
      //   - no length matching / differential pairs / impedance control
      //   - component footprints approximated to a default 5x5 mm rect unless
      //     the instance carries explicit dimensions
      //   - pin positions are approximated by the instance's PCB center
      //     (accurate pin offsets live in the part footprint library)
      const allSegments = Array.isArray(net.segments) ? net.segments : [];
      const existingSegments = allSegments as Array<{
        fromInstanceId: number;
        fromPin: string;
        toInstanceId: number;
        toPin: string;
        waypoints: { x: number; y: number }[];
      }>;

      // Pick the first connection without waypoints, else route the first
      // declared connection (re-routing).
      const targetConnection = existingSegments.find(
        s => !Array.isArray(s.waypoints) || s.waypoints.length < 2,
      ) ?? existingSegments[0];

      if (!targetConnection) {
        return {
          success: false,
          message: `Net "${net.name}" has no connections declared. Add pin-to-pin segments before routing.`,
          data: {
            type: 'trace_path_unavailable',
            netId: net.id,
            layer: params.layer,
            reason: 'no-connections',
            connectedInstanceCount: instances.length,
          },
        };
      }

      // DB rows expose flat pcbX/pcbY/pcbRotation/pcbSide. Map to the
      // autorouter's nested pcbPosition shape at this boundary.
      const toPcbPos = (inst: typeof instances[number]):
        | { x: number; y: number; rotation: number; side: 'front' | 'back' }
        | undefined =>
        inst.pcbX != null && inst.pcbY != null
          ? {
              x: inst.pcbX,
              y: inst.pcbY,
              rotation: inst.pcbRotation ?? 0,
              side: (inst.pcbSide === 'back' ? 'back' : 'front'),
            }
          : undefined;

      const fromInst = instances.find(i => i.id === targetConnection.fromInstanceId);
      const toInst = instances.find(i => i.id === targetConnection.toInstanceId);
      const fromPos = fromInst ? toPcbPos(fromInst) : undefined;
      const toPos = toInst ? toPcbPos(toInst) : undefined;
      if (!fromInst || !toInst || !fromPos || !toPos) {
        return {
          success: false,
          message: `Both endpoints must be placed on the PCB before routing. Place instances first.`,
          data: {
            type: 'trace_path_unavailable',
            netId: net.id,
            reason: 'endpoints-unplaced',
          },
        };
      }

      // Build obstacle grid from other nets + all placed instances (except
      // the two endpoints we need to reach).
      const otherNetsRaw = await ctx.storage.getCircuitNets(params.circuitId);
      const otherNets: NetLike[] = otherNetsRaw
        .filter(n => n.id !== net.id)
        .map(n => ({
          id: n.id,
          segments: (Array.isArray(n.segments) ? n.segments : []) as Array<{
            waypoints: { x: number; y: number }[];
          }>,
        }));

      const obstacleInstances: InstanceLike[] = instances
        .filter(i => i.id !== fromInst.id && i.id !== toInst.id)
        .map(i => ({
          id: i.id,
          pcbPosition: toPcbPos(i),
        }));

      const obstacles = extractObstaclesFromCircuit({
        instances: obstacleInstances,
        otherNets,
      });

      // Compute bounding box with a 10mm margin around both endpoints.
      const xs = [fromPos.x, toPos.x];
      const ys = [fromPos.y, toPos.y];
      for (const inst of instances) {
        const pos = toPcbPos(inst);
        if (pos) {
          xs.push(pos.x);
          ys.push(pos.y);
        }
      }
      const margin = 10;
      const bounds = {
        minX: Math.min(...xs) - margin,
        minY: Math.min(...ys) - margin,
        maxX: Math.max(...xs) + margin,
        maxY: Math.max(...ys) + margin,
      };

      const layerHint: Layer = params.layer === 'back' || params.layer === 'bottom' ? 'bottom' : 'top';

      const result = autoroute({
        bounds,
        start: { x: fromPos.x, y: fromPos.y, layer: layerHint },
        end: { x: toPos.x, y: toPos.y, layer: layerHint },
        obstacles,
      });

      if (!result.success) {
        return {
          success: false,
          message: `Autorouter could not find a path for net "${net.name}" (reason: ${result.reason}).`,
          data: {
            type: 'trace_path_unavailable',
            netId: net.id,
            layer: params.layer,
            reason: result.reason,
            visited: result.visited,
          },
        };
      }

      return {
        success: true,
        message: `Routed net "${net.name}" from ${fromInst.referenceDesignator}.${targetConnection.fromPin} to ${toInst.referenceDesignator}.${targetConnection.toPin} (${result.path.length} waypoints, ${result.viaCount} via${result.viaCount === 1 ? '' : 's'}).`,
        data: {
          type: 'trace_path_suggestion',
          netId: net.id,
          layer: params.layer,
          fromInstanceId: fromInst.id,
          fromPin: targetConnection.fromPin,
          toInstanceId: toInst.id,
          toPin: targetConnection.toPin,
          path: result.path,
          viaCount: result.viaCount,
          visited: result.visited,
        },
        sources: [
          { type: 'net', label: net.name, id: net.id },
          { type: 'node', label: fromInst.referenceDesignator, id: fromInst.id },
          { type: 'node', label: toInst.referenceDesignator, id: toInst.id },
        ],
      };
    },
  });
}
