/**
 * Advanced PCB tools — via stitching, teardrop generation, net naming
 * suggestions, trace routing suggestions.
 *
 * @module ai-tools/circuit/pcb-advanced
 */

import { z } from 'zod';
import type { ToolRegistry } from '../registry';
import { guardCircuitInProject, type ConnectorRecord, type NetSegmentRecord } from './shared';
import {
  autoroute,
  extractObstaclesFromCircuit,
  type Layer,
  type NetLike,
  type InstanceLike,
} from '../../lib/autorouter';

/**
 * Register advanced PCB-related circuit tools.
 *
 * Tools registered (4 total):
 * - `auto_stitch_vias`    — Fill a copper pour zone with a grid of stitching vias.
 * - `generate_teardrops`  — Generate teardrops where traces meet pads/vias.
 * - `suggest_net_names`   — Suggest descriptive names for auto-generated nets.
 * - `suggest_trace_path`  — Suggest an optimal PCB routing path for a net.
 *
 * @param registry - The {@link ToolRegistry} instance to register tools into.
 */
export function registerPcbAdvancedTools(registry: ToolRegistry): void {
  /**
   * auto_stitch_vias — Automatically generate stitching vias for a copper pour zone.
   */
  registry.register({
    name: 'auto_stitch_vias',
    description: 'Automatically generate a grid of stitching vias within a copper pour zone to tie layers together for thermal and EMC performance.',
    category: 'circuit',
    parameters: z.object({
      circuitId: z.number().int().min(1).describe('The ID of the circuit design.'),
      zoneId: z.number().int().min(1).describe('The ID of the PCB zone (copper pour) to fill with vias.'),
      spacing: z.number().positive().optional().describe('Spacing between vias in mm (default: 2.0).'),
    }),
    requiresConfirmation: false,
    execute: async (params, ctx) => {
      const guard = await guardCircuitInProject(params.circuitId, ctx);
      if (guard) return guard;
      const zone = await ctx.storage.getPcbZone(params.zoneId);
      if (!zone) {
        return { success: false, message: `Zone ${params.zoneId} not found.` };
      }
      if (!zone.netId) {
        return { success: false, message: `Zone ${params.zoneId} must be assigned to a net for stitching.` };
      }

      const pts = zone.points as Array<{x: number; y: number}>;
      if (!pts || pts.length < 3) {
        return { success: false, message: `Zone ${params.zoneId} does not have a valid polygon shape.` };
      }

      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const p of pts) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }

      const spacing = params.spacing || 2.0; // mm
      const margin = 0.5; // Stay slightly away from the absolute edge
      const gridPts: Array<{x: number; y: number}> = [];

      for (let x = minX + margin; x <= maxX - margin; x += spacing) {
        for (let y = minY + margin; y <= maxY - margin; y += spacing) {
          let inside = false;
          for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
            const xi = pts[i].x, yi = pts[i].y;
            const xj = pts[j].x, yj = pts[j].y;
            const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
          }
          if (inside) {
            gridPts.push({ x, y });
          }
        }
      }

      if (gridPts.length === 0) {
        return { success: true, message: `Zone too small or irregular for spacing ${spacing}mm; 0 vias added.` };
      }

      const viasToInsert = gridPts.map(pt => ({
        circuitId: params.circuitId,
        netId: zone.netId as number,
        x: pt.x,
        y: pt.y,
        outerDiameter: 0.6,
        drillDiameter: 0.3,
        viaType: 'through' as const,
        layerStart: 'front',
        layerEnd: 'back',
        tented: true,
      }));

      await ctx.storage.createCircuitVias(viasToInsert);

      return {
        success: true,
        message: `Generated ${gridPts.length} stitching vias in zone ${params.zoneId} for net ${zone.netId}.`,
      };
    },
  });

  /**
   * generate_teardrops — Automatically generate teardrops on all PCB traces.
   */
  registry.register({
    name: 'generate_teardrops',
    description: 'Automatically generate teardrops where PCB traces connect to vias or pads to prevent drill breakout and improve manufacturing yield.',
    category: 'circuit',
    parameters: z.object({
      circuitId: z.number().int().min(1).describe('The ID of the circuit design.'),
    }),
    requiresConfirmation: false,
    execute: async (params, ctx) => {
      const guard = await guardCircuitInProject(params.circuitId, ctx);
      if (guard) return guard;
      // 1. Fetch all data
      const [wires, vias, instances, existingZones] = await Promise.all([
        ctx.storage.getCircuitWires(params.circuitId),
        ctx.storage.getCircuitVias(params.circuitId),
        ctx.storage.getCircuitInstances(params.circuitId),
        ctx.storage.getPcbZones(ctx.projectId),
      ]);

      const pcbWires = wires.filter(w => w.view === 'pcb');
      if (pcbWires.length === 0) {
        return { success: true, message: 'No PCB traces found. Route traces first before generating teardrops.' };
      }

      // 2. Clear existing teardrops for this circuit/project to prevent duplicates
      const existingTeardrops = existingZones.filter(z => z.zoneType === 'teardrop');
      for (const t of existingTeardrops) {
        await ctx.storage.deletePcbZone(t.id);
      }

      // 3. Extract all valid targets (vias + THT/SMD pads) into a lookup structure
      const targets: Array<{x: number, y: number, r: number, netId?: number, layer: string}> = [];

      // Vias are targets on both front and back
      for (const v of vias) {
        const r = v.outerDiameter / 2;
        targets.push({ x: v.x, y: v.y, r, netId: v.netId, layer: 'front' });
        targets.push({ x: v.x, y: v.y, r, netId: v.netId, layer: 'back' });
      }

      // Extract pads from instances
      for (const inst of instances) {
        if (!inst.properties || !inst.pcbSide) continue;
        const props = inst.properties as Record<string, unknown>;
        const connectors: ConnectorRecord[] = Array.isArray(props.connectors) ? props.connectors as ConnectorRecord[] : [];
        const layer = inst.pcbSide === 'front' ? 'front' : 'back';

        for (const conn of connectors) {
          if (!conn.offsetX && conn.offsetX !== 0) continue;
          // Simple rotation math for pad positions
          const angle = ((inst.pcbRotation || 0) * Math.PI) / 180;
          const oy = conn.offsetY ?? 0;
          const rx = conn.offsetX * Math.cos(angle) - oy * Math.sin(angle);
          const ry = conn.offsetX * Math.sin(angle) + oy * Math.cos(angle);

          const px = (inst.pcbX || 0) + rx;
          const py = (inst.pcbY || 0) + ry;

          // Estimate pad radius from width/height
          const w = conn.padWidth || 1.0;
          const h = conn.padHeight || 1.0;
          const r = Math.min(w, h) / 2; // Conservative radius for teardrop attachment

          // We don't have direct pad-net mapping here — rely on distance + trace's netId for matching.

          targets.push({ x: px, y: py, r, layer: conn.padType === 'tht' ? 'all' : layer });
        }
      }

      // 4. Generate teardrops for each wire endpoint
      const newTeardrops: Array<{ projectId: number; zoneType: 'teardrop'; layer: string; points: Array<{ x: number; y: number }>; netId: number | null }> = [];
      let generatedCount = 0;

      // Distance threshold to consider a wire endpoint "connected" to a target center
      const CONNECTION_TOL = 0.5;

      // Inline teardrop calculation (from teardrops-util logic)
      const calcTeardrop = (traceP1: {x: number, y: number}, traceP2: {x: number, y: number}, traceWidth: number, padR: number) => {
        const dx = traceP2.x - traceP1.x;
        const dy = traceP2.y - traceP1.y;
        const len = Math.sqrt(dx*dx + dy*dy);
        if (len < traceWidth) return null;

        const nx = dx / len;
        const ny = dy / len;
        const tearLen = Math.min(len * 0.8, padR * 3); // Length along the trace

        const startX = traceP2.x - nx * tearLen;
        const startY = traceP2.y - ny * tearLen;

        const perpX = -ny;
        const perpY = nx;

        // Connect to the pad at 90 degrees to the trace
        const pLeftX = traceP2.x + perpX * padR * 0.8;
        const pLeftY = traceP2.y + perpY * padR * 0.8;
        const pRightX = traceP2.x - perpX * padR * 0.8;
        const pRightY = traceP2.y - perpY * padR * 0.8;

        return [{ x: startX, y: startY }, { x: pLeftX, y: pLeftY }, { x: pRightX, y: pRightY }];
      };

      for (const wire of pcbWires) {
        const pts = wire.points as Array<{x: number, y: number}>;
        if (!pts || pts.length < 2) continue;

        const layer = wire.layer || 'front';
        const width = wire.width || 0.25;

        // Check both endpoints
        const pStart = pts[0];
        const pStartNext = pts[1];
        const pEnd = pts[pts.length - 1];
        const pEndPrev = pts[pts.length - 2];

        // Find targets on the same layer
        const layerTargets = targets.filter(t => t.layer === 'all' || t.layer === layer);

        // Check start
        for (const t of layerTargets) {
          const dist = Math.sqrt((t.x - pStart.x)**2 + (t.y - pStart.y)**2);
          if (dist < CONNECTION_TOL + t.r) {
            const poly = calcTeardrop(pStartNext, pStart, width, t.r);
            if (poly) {
              newTeardrops.push({ projectId: ctx.projectId, zoneType: 'teardrop' as const, layer, points: poly, netId: wire.netId });
              generatedCount++;
            }
          }
        }

        // Check end
        for (const t of layerTargets) {
          const dist = Math.sqrt((t.x - pEnd.x)**2 + (t.y - pEnd.y)**2);
          if (dist < CONNECTION_TOL + t.r) {
            const poly = calcTeardrop(pEndPrev, pEnd, width, t.r);
            if (poly) {
              newTeardrops.push({ projectId: ctx.projectId, zoneType: 'teardrop' as const, layer, points: poly, netId: wire.netId });
              generatedCount++;
            }
          }
        }
      }

      // 5. Insert into DB
      for (const td of newTeardrops) {
        await ctx.storage.createPcbZone(td);
      }

      return {
        success: true,
        message: `Generated ${generatedCount} teardrops. Replaced ${existingTeardrops.length} old ones.`,
      };
    },
  });

  /**
   * suggest_net_names — Analyze circuit and suggest descriptive net names.
   */
  registry.register({
    name: 'suggest_net_names',
    description: 'Analyze all nets in a circuit and suggest descriptive names based on connected component pins (e.g., SPI_MOSI, GND, 3V3).',
    category: 'circuit',
    parameters: z.object({
      circuitId: z.number().int().min(1).describe('The ID of the circuit to analyze.'),
    }),
    requiresConfirmation: false,
    execute: async (params, ctx) => {
      const guard = await guardCircuitInProject(params.circuitId, ctx);
      if (guard) return guard;
      const [nets, instances, parts] = await Promise.all([
        ctx.storage.getCircuitNets(params.circuitId),
        ctx.storage.getCircuitInstances(params.circuitId),
        ctx.storage.getComponentParts(ctx.projectId),
      ]);

      const partMap = new Map(parts.map(p => [p.id, p]));
      const suggestions: Array<{ netId: number, currentName: string, suggestedName: string, rationale: string }> = [];

      for (const net of nets) {
        // Only suggest for auto-generated names
        if (!net.name.startsWith('NET_') && !net.name.startsWith('wire_')) continue;

        const connectedPins: string[] = [];
        const segments = (net.segments as NetSegmentRecord[]) || [];

        for (const seg of segments) {
          const inst = instances.find(i => i.id === seg.fromInstanceId || i.id === seg.toInstanceId);
          if (inst) {
            const part = partMap.get(inst.partId!);
            const pinId = seg.fromInstanceId === inst.id ? seg.fromPin : seg.toPin;
            const connectors = (part?.connectors as ConnectorRecord[]) || [];
            const connector = connectors.find(c => String(c.id) === String(pinId) || c.name === pinId);
            if (connector?.name) connectedPins.push(connector.name);
          }
        }

        if (connectedPins.length > 0) {
          // Heuristic for naming: pick the most descriptive pin name
          const sorted = [...connectedPins].sort((a, b) => {
            const aPower = /vcc|vdd|gnd|vss/i.test(a);
            const bPower = /vcc|vdd|gnd|vss/i.test(b);
            if (aPower && !bPower) return -1;
            if (!aPower && bPower) return 1;
            return b.length - a.length;
          });

          const top = sorted[0].toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '');
          if (top && top !== net.name) {
            suggestions.push({
              netId: net.id,
              currentName: net.name,
              suggestedName: top,
              rationale: `Connected to pin "${sorted[0]}"`,
            });
          }
        }
      }

      return {
        success: true,
        message: `Generated ${suggestions.length} net naming suggestions.`,
        data: { type: 'net_name_suggestions', suggestions },
        sources: [
          ...nets.map(n => ({ type: 'net' as const, label: n.name, id: n.id })),
          ...instances.map(i => ({ type: 'node' as const, label: i.referenceDesignator, id: i.id })),
        ],
      };
    },
  });

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

      // Honest implementation: autorouter is not implemented server-side yet.
      // If the net already has segments (e.g., user hand-routed or upstream
      // tool placed them), return those as the current path. If not, return
      // an explicit not-implemented error instead of hardcoded fake points —
      // surfacing the real state to the AI agent and the user.
      const existingSegments = Array.isArray(net.segments) ? net.segments : [];
      if (existingSegments.length === 0) {
        return {
          success: false,
          message:
            `Autorouter not yet implemented. Net "${net.name}" has no existing segments. ` +
            `Use the PCB layout view to route manually, or invoke auto_route for client-side routing.`,
          data: {
            type: 'trace_path_unavailable',
            netId: net.id,
            layer: params.layer,
            reason: 'autorouter-not-implemented',
            connectedInstanceCount: instances.length,
          },
        };
      }

      return {
        success: true,
        message: `Existing routing path for net "${net.name}" (${existingSegments.length} segment${existingSegments.length === 1 ? '' : 's'}).`,
        data: {
          type: 'trace_path_existing',
          netId: net.id,
          layer: params.layer,
          segments: existingSegments,
        },
        sources: [
          { type: 'net', label: net.name, id: net.id },
          ...instances.map(i => ({ type: 'node' as const, label: i.referenceDesignator, id: i.id })),
        ],
      };
    },
  });
}
