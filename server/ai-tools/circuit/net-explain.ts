/**
 * Net explanation tool — looks up a net by name and produces a plain-English
 * explanation of its purpose, drivers, loads, and protocol (BL-0522).
 *
 * @module ai-tools/circuit/net-explain
 */

import { z } from 'zod';
import type { ToolRegistry } from '../registry';
import { type NetSegmentRecord } from './shared';
import { classifyNet, classifyInstanceRole, buildNetExplanation } from './net-classify';

/**
 * Register the `explain_net` tool with the given registry.
 *
 * @param registry - The {@link ToolRegistry} instance to register tools into.
 */
export function registerNetExplainTool(registry: ToolRegistry): void {
  registry.register({
    name: 'explain_net',
    description:
      'Explain what a circuit net carries in plain English — its type, protocol (if applicable), what drives it, and what loads it.',
    category: 'circuit',
    parameters: z.object({
      netName: z.string().min(1).describe('The name of the net to explain (e.g., VCC, SDA, MOSI)'),
      circuitDesignId: z.number().int().positive().optional().describe('Optional circuit design ID. If omitted, searches all designs in the project.'),
    }),
    requiresConfirmation: false,
    modelPreference: 'standard',
    execute: async (params, ctx) => {
      // 1. Find the target circuit design(s) and locate the net by name
      const designs = await ctx.storage.getCircuitDesigns(ctx.projectId);
      if (designs.length === 0) {
        return { success: false, message: 'No circuit designs found in this project.' };
      }

      const targetDesigns = params.circuitDesignId
        ? designs.filter((d) => d.id === params.circuitDesignId)
        : designs;

      if (targetDesigns.length === 0) {
        return { success: false, message: `Circuit design ${String(params.circuitDesignId)} not found.` };
      }

      // Search for the net across target designs
      let foundNet: { id: number; circuitId: number; name: string; netType: string; voltage: string | null; segments: unknown } | undefined;
      let allNets: Array<{ id: number; circuitId: number; name: string; netType: string; voltage: string | null; segments: unknown }> = [];

      for (const design of targetDesigns) {
        const nets = await ctx.storage.getCircuitNets(design.id);
        allNets = allNets.concat(nets);
        const match = nets.find((n) => n.name.toLowerCase() === params.netName.toLowerCase());
        if (match) {
          foundNet = match;
          break;
        }
      }

      if (!foundNet) {
        const availableNames = allNets
          .map((n) => n.name)
          .filter((name, idx, arr) => arr.indexOf(name) === idx)
          .slice(0, 20);
        return {
          success: false,
          message: `Net "${params.netName}" not found. Available nets: ${availableNames.length > 0 ? availableNames.join(', ') : '(none)'}`,
        };
      }

      // 2. Fetch connected instances and wires for this net's circuit
      const [instances, wires, parts] = await Promise.all([
        ctx.storage.getCircuitInstances(foundNet.circuitId),
        ctx.storage.getCircuitWires(foundNet.circuitId),
        ctx.storage.getComponentParts(ctx.projectId),
      ]);

      const partMap = new Map(parts.map((p) => [p.id, p]));

      // 3. Classify the net
      const classification = classifyNet(foundNet.name, foundNet.netType, foundNet.voltage);

      // 4. Find connected instances via segments
      const segments = (foundNet.segments as NetSegmentRecord[]) || [];
      const connectedInstanceIds = new Set<number>();
      for (const seg of segments) {
        if (seg.fromInstanceId) { connectedInstanceIds.add(seg.fromInstanceId); }
        if (seg.toInstanceId) { connectedInstanceIds.add(seg.toInstanceId); }
      }

      // Also find instances connected via wires on this net
      const netWires = wires.filter((w) => w.netId === foundNet!.id);

      const connectedInstances = instances.filter((inst) => connectedInstanceIds.has(inst.id));

      // 5. Identify drivers and loads
      const drivers: string[] = [];
      const loads: string[] = [];
      const unknownRole: string[] = [];

      for (const inst of connectedInstances) {
        const part = inst.partId ? partMap.get(inst.partId) : undefined;
        const partMeta = part?.meta as Record<string, unknown> | undefined;
        const partName = (partMeta?.name as string) ?? inst.referenceDesignator;
        const role = classifyInstanceRole(inst.referenceDesignator, partName, classification);
        if (role === 'driver') {
          drivers.push(`${inst.referenceDesignator} (${partName})`);
        } else if (role === 'load') {
          loads.push(`${inst.referenceDesignator} (${partName})`);
        } else {
          unknownRole.push(`${inst.referenceDesignator} (${partName})`);
        }
      }

      // 6. Build plain-English explanation
      const explanation = buildNetExplanation({
        netName: foundNet.name,
        classification,
        voltage: foundNet.voltage,
        drivers,
        loads,
        unknownRole,
        wireCount: netWires.length,
        instanceCount: connectedInstances.length,
      });

      return {
        success: true,
        message: explanation,
        data: {
          type: 'net_explanation' as const,
          netId: foundNet.id,
          netName: foundNet.name,
          classification: classification.type,
          protocol: classification.protocol,
          drivers,
          loads,
          connectedInstances: connectedInstances.map((i) => i.referenceDesignator),
          wireCount: netWires.length,
        },
        sources: [
          { type: 'net' as const, label: foundNet.name, id: foundNet.id },
          ...connectedInstances.map((i) => ({ type: 'node' as const, label: i.referenceDesignator, id: i.id })),
        ],
        confidence: {
          score: connectedInstances.length > 0 ? 85 : 50,
          explanation: connectedInstances.length > 0
            ? `Classification based on net name pattern and ${connectedInstances.length} connected component(s).`
            : 'Classification based on net name pattern only — no connected components found.',
          factors: [
            `Net name "${foundNet.name}" matches ${classification.type} pattern`,
            ...(connectedInstances.length > 0 ? [`${connectedInstances.length} connected instance(s) analyzed`] : []),
            ...(classification.protocol ? [`Protocol detected: ${classification.protocol}`] : []),
          ],
        },
      };
    },
  });
}
