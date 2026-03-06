import type { Express } from 'express';
import type { IStorage } from '../storage';
import { asyncHandler, parseIdParam, payloadLimit, nextRefDes, firstPinId } from './utils';
import { requireProjectOwnership } from '../routes/auth-middleware';

export function registerCircuitExpansionRoutes(app: Express, storage: IStorage): void {
  app.post('/api/projects/:projectId/circuits/expand-architecture', requireProjectOwnership, payloadLimit(16 * 1024), asyncHandler(async (req, res) => {
    const projectId = parseIdParam(req.params.projectId);
    const { circuitName } = req.body as { circuitName?: string };

    // 1. Fetch architecture nodes + edges
    const archNodes = await storage.getNodes(projectId, { limit: 500, offset: 0, sort: 'asc' });
    const archEdges = await storage.getEdges(projectId, { limit: 500, offset: 0, sort: 'asc' });

    if (archNodes.length === 0) {
      return res.status(400).json({ message: 'No architecture nodes to expand' });
    }

    // 2. Fetch available component parts
    const parts = await storage.getComponentParts(projectId);

    // 3. Create circuit design
    const circuit = await storage.createCircuitDesign({
      projectId,
      name: circuitName || 'Expanded from Architecture',
    });

    // 4. Match architecture nodes -> component parts by family/type
    // Build a lookup: family -> part (use first match)
    const familyToPart = new Map<string, typeof parts[0]>();
    for (const part of parts) {
      const meta = (part.meta ?? {}) as Record<string, unknown>;
      const family = ((meta.family as string) || '').toLowerCase();
      if (family && !familyToPart.has(family)) {
        familyToPart.set(family, part);
      }
      // Also index by title (lowercase)
      const title = ((meta.title as string) || '').toLowerCase();
      if (title && !familyToPart.has(title)) {
        familyToPart.set(title, part);
      }
    }

    // Track ref des counters
    const refDesCounters = new Map<string, number>();

    // 5. Create circuit instances -- one per architecture node
    const archNodeIdToInstanceId = new Map<string, number>();
    const instancePartMap = new Map<number, typeof parts[0]>();
    const GRID = 200; // Spacing for grid layout
    const COLS = Math.max(3, Math.ceil(Math.sqrt(archNodes.length)));

    for (let i = 0; i < archNodes.length; i++) {
      const archNode = archNodes[i];
      const nodeType = archNode.nodeType.toLowerCase();
      const label = archNode.label.toLowerCase();

      // Try to find a matching part: by nodeType, then label
      const matchedPart = familyToPart.get(nodeType) || familyToPart.get(label) || parts[0];

      if (!matchedPart) { continue; } // No parts at all -- skip

      const col = i % COLS;
      const row = Math.floor(i / COLS);

      const instance = await storage.createCircuitInstance({
        circuitId: circuit.id,
        partId: matchedPart.id,
        referenceDesignator: nextRefDes(archNode.nodeType, refDesCounters),
        schematicX: archNode.positionX || col * GRID,
        schematicY: archNode.positionY || row * GRID,
        schematicRotation: 0,
        properties: {
          sourceArchNodeId: archNode.nodeId,
          sourceLabel: archNode.label,
        },
      });

      archNodeIdToInstanceId.set(archNode.nodeId, instance.id);
      instancePartMap.set(instance.id, matchedPart);
    }

    // 6. Create circuit nets -- one per architecture edge
    let netCounter = 0;
    for (const edge of archEdges) {
      const sourceInstanceId = archNodeIdToInstanceId.get(edge.source);
      const targetInstanceId = archNodeIdToInstanceId.get(edge.target);
      if (!sourceInstanceId || !targetInstanceId) { continue; }

      netCounter++;
      const netName = edge.netName || edge.label || `Net_${netCounter}`;
      const signalType = (edge.signalType || 'signal').toLowerCase();
      const netType = signalType === 'power' ? 'power' : signalType === 'ground' ? 'ground' : signalType === 'bus' ? 'bus' : 'signal';

      await storage.createCircuitNet({
        circuitId: circuit.id,
        name: netName,
        netType,
        voltage: edge.voltage || undefined,
        busWidth: edge.busWidth ?? undefined,
        segments: [{
          fromInstanceId: sourceInstanceId,
          fromPin: firstPinId(instancePartMap, sourceInstanceId),
          toInstanceId: targetInstanceId,
          toPin: firstPinId(instancePartMap, targetInstanceId),
        }],
        labels: [],
        style: {},
      });
    }

    // 7. Return the created circuit with summary
    const instances = await storage.getCircuitInstances(circuit.id);
    const nets = await storage.getCircuitNets(circuit.id);

    res.status(201).json({
      circuit,
      instanceCount: instances.length,
      netCount: nets.length,
      unmatchedNodes: archNodes.length - instances.length,
      warning: "Net segments use each part's first pin as a placeholder. Review pin assignments in the schematic editor.",
    });
  }));
}
