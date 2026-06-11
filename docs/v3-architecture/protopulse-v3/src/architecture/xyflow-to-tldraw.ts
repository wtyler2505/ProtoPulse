import { z } from 'zod';
import type { TldrawShapeRecord } from '../components/canvas/CanvasBindings';

export const LegacyArchitectureNodeSchema = z.object({
  nodeId: z.string(),
  nodeType: z.string(),
  label: z.string(),
  positionX: z.number(),
  positionY: z.number(),
  data: z.record(z.unknown()).nullable().optional(),
});

export const LegacyArchitectureEdgeSchema = z.object({
  edgeId: z.string(),
  source: z.string(),
  target: z.string(),
  label: z.string().nullable().optional(),
  signalType: z.string().nullable().optional(),
  voltage: z.string().nullable().optional(),
  busWidth: z.number().nullable().optional(),
  netName: z.string().nullable().optional(),
});

export const LegacyArchitectureSnapshotSchema = z.object({
  nodes: z.array(LegacyArchitectureNodeSchema),
  edges: z.array(LegacyArchitectureEdgeSchema),
});

export type LegacyArchitectureSnapshot = z.infer<typeof LegacyArchitectureSnapshotSchema>;

export interface ArchitectureMigrationResult {
  tldrawShapes: TldrawShapeRecord[];
  migratedNodeCount: number;
  migratedEdgeCount: number;
}

export function migrateXyflowArchitectureToTldraw(input: unknown): ArchitectureMigrationResult {
  const snapshot = LegacyArchitectureSnapshotSchema.parse(input);
  const nodeShapes = snapshot.nodes.map((node) => ({
    id: `shape:${node.nodeId}`,
    typeName: 'shape',
    type: 'geo',
    x: node.positionX,
    y: node.positionY,
    props: { text: node.label },
    meta: {
      protopulse: {
        id: node.nodeId,
        kind: boundaryKindFromNodeType(node.nodeType),
        label: node.label,
        provenance: [`xyflow-node:${node.nodeId}`],
        metadata: {
          nodeType: node.nodeType,
          ...(node.data ?? {}),
        },
      },
    },
  })) satisfies TldrawShapeRecord[];
  const edgeShapes = snapshot.edges.map((edge, index) => ({
    id: `shape:${edge.edgeId}`,
    typeName: 'shape',
    type: 'arrow',
    x: 120 + index * 40,
    y: 320 + index * 20,
    props: { text: edge.label ?? edge.netName ?? edge.signalType ?? edge.edgeId },
    meta: {
      protopulse: {
        id: edge.edgeId,
        kind: 'signal',
        label: edge.label ?? edge.netName ?? edge.edgeId,
        provenance: [`xyflow-edge:${edge.edgeId}`],
        metadata: {
          source: edge.source,
          target: edge.target,
          protocol: edge.signalType ?? undefined,
          voltage: edge.voltage ?? undefined,
          busWidth: edge.busWidth ?? undefined,
          net: edge.netName ?? undefined,
        },
      },
    },
  })) satisfies TldrawShapeRecord[];

  return {
    tldrawShapes: [...nodeShapes, ...edgeShapes],
    migratedNodeCount: nodeShapes.length,
    migratedEdgeCount: edgeShapes.length,
  };
}

function boundaryKindFromNodeType(nodeType: string): 'hardware' | 'firmware' | 'power' | 'signal' | 'mechanical' {
  const normalized = nodeType.toLowerCase();
  if (normalized.includes('firmware') || normalized.includes('software')) {
    return 'firmware';
  }
  if (normalized.includes('power') || normalized.includes('battery') || normalized.includes('regulator')) {
    return 'power';
  }
  if (normalized.includes('mechanical') || normalized.includes('chassis')) {
    return 'mechanical';
  }
  return 'hardware';
}
