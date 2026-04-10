import type { Express } from 'express';
import type { IStorage } from '../storage';
import { parseIdParam, payloadLimit, nextRefDes } from './utils';
import { requireProjectOwnership } from '../routes/auth-middleware';
import { mapEdgePins, extractConnectors } from '../lib/semantic-pin-mapper';

export function registerCircuitExpansionRoutes(app: Express, storage: IStorage): void {
  app.post('/api/projects/:projectId/circuits/expand-architecture', requireProjectOwnership, payloadLimit(16 * 1024), async (req, res) => {
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

    // 6. Pre-extract connectors per instance for semantic pin mapping
    const instanceConnectors = new Map<number, ReturnType<typeof extractConnectors>>();
    for (const [instanceId, part] of Array.from(instancePartMap.entries())) {
      instanceConnectors.set(instanceId, extractConnectors(part));
    }

    // Track which pins are already claimed per instance
    const usedPinsPerInstance = new Map<number, Set<string>>();
    const getUsedPins = (instanceId: number): Set<string> => {
      let set = usedPinsPerInstance.get(instanceId);
      if (!set) {
        set = new Set<string>();
        usedPinsPerInstance.set(instanceId, set);
      }
      return set;
    };

    // 7. Create circuit nets -- one per architecture edge
    let netCounter = 0;
    for (const edge of archEdges) {
      const sourceInstanceId = archNodeIdToInstanceId.get(edge.source);
      const targetInstanceId = archNodeIdToInstanceId.get(edge.target);
      if (!sourceInstanceId || !targetInstanceId) { continue; }

      netCounter++;
      const netName = edge.netName || edge.label || `Net_${netCounter}`;
      const signalType = (edge.signalType || 'signal').toLowerCase();
      const netType = signalType === 'power' ? 'power' : signalType === 'ground' ? 'ground' : signalType === 'bus' ? 'bus' : 'signal';

      const srcConns = instanceConnectors.get(sourceInstanceId) ?? [];
      const tgtConns = instanceConnectors.get(targetInstanceId) ?? [];
      const { fromPin, toPin } = mapEdgePins(
        srcConns,
        tgtConns,
        { label: edge.label, signalType: edge.signalType, netName: edge.netName, voltage: edge.voltage },
        getUsedPins(sourceInstanceId),
        getUsedPins(targetInstanceId),
      );

      await storage.createCircuitNet({
        circuitId: circuit.id,
        name: netName,
        netType,
        voltage: edge.voltage || undefined,
        busWidth: edge.busWidth ?? undefined,
        segments: [{
          fromInstanceId: sourceInstanceId,
          fromPin: fromPin.pinId,
          toInstanceId: targetInstanceId,
          toPin: toPin.pinId,
        }],
        labels: [],
        style: {},
      });
    }

    // 8. Return the created circuit with summary
    const instances = await storage.getCircuitInstances(circuit.id);
    const nets = await storage.getCircuitNets(circuit.id);

    res.status(201).json({
      circuit,
      instanceCount: instances.length,
      netCount: nets.length,
      unmatchedNodes: archNodes.length - instances.length,
    });
  });
}
