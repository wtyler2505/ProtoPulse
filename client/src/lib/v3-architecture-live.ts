import type { GraphEdge, GraphNode } from '@/lib/graph-types';

export type V3BoundaryKind = 'hardware' | 'firmware' | 'power' | 'signal' | 'mechanical';

export const V3_BOUNDARY_KINDS: V3BoundaryKind[] = ['hardware', 'firmware', 'power', 'signal', 'mechanical'];

export interface V3TldrawShape {
  id: string;
  typeName: 'shape';
  type: 'geo' | 'arrow' | 'note';
  x: number;
  y: number;
  props: { text: string };
  meta: {
    protopulse: {
      id: string;
      kind: V3BoundaryKind;
      label: string;
      provenance: string[];
      metadata: Record<string, unknown>;
    };
  };
}

export interface V3BoundaryObject {
  id: string;
  shapeId: string;
  kind: V3BoundaryKind;
  label: string;
  x: number;
  y: number;
  sourceBoundaryId?: string;
  targetBoundaryId?: string;
  provenance: string[];
  metadata: Record<string, unknown>;
}

export interface V3MigrationPlanStep {
  id: string;
  label: string;
  status: 'done' | 'blocked' | 'pending';
  detail: string;
}

export interface V3MigrationPlan {
  source: 'xyflow';
  target: 'tldraw-boundaries';
  steps: V3MigrationPlanStep[];
}

export interface V3MetadataRuleResult {
  kind: V3BoundaryKind;
  status: 'satisfied' | 'missing' | 'incomplete';
  requiredFields: string[];
  detail: string;
}

export interface V3ArchitectureReadiness {
  status: 'ready' | 'blocked';
  nodeCount: number;
  edgeCount: number;
  tldrawShapeCount: number;
  boundaryObjectCount: number;
  boundaryObjects: V3BoundaryObject[];
  boundaryKinds: V3BoundaryKind[];
  missingBoundaryKinds: V3BoundaryKind[];
  metadataRules: V3MetadataRuleResult[];
  migrationPlan: V3MigrationPlan;
  blockedReasons: string[];
  nextStep: string;
}

export function migrateLiveArchitectureToV3Shapes(nodes: GraphNode[], edges: GraphEdge[]): V3TldrawShape[] {
  const nodeShapes = nodes.map((node): V3TldrawShape => {
    const data = (node.data ?? {}) as Record<string, unknown>;
    const label = typeof data.label === 'string' ? data.label : node.id;
    const nodeType = typeof data.type === 'string' ? data.type : 'hardware';

    return {
      id: `shape:${node.id}`,
      typeName: 'shape',
      type: 'geo',
      x: node.position.x,
      y: node.position.y,
      props: { text: label },
      meta: {
        protopulse: {
          id: node.id,
          kind: boundaryKindFromNodeType(nodeType),
          label,
          provenance: [`live-architecture-node:${node.id}`],
          metadata: { ...data, nodeType },
        },
      },
    };
  });
  const edgeShapes = edges.map((edge, index): V3TldrawShape => {
    const data = edge.data as Record<string, unknown> | undefined;
    const label = typeof edge.label === 'string'
      ? edge.label
      : typeof data?.netName === 'string'
        ? data.netName
        : edge.id;

    return {
      id: `shape:${edge.id}`,
      typeName: 'shape',
      type: 'arrow',
      x: 160 + index * 32,
      y: 360 + index * 20,
      props: { text: label },
      meta: {
        protopulse: {
          id: edge.id,
          kind: 'signal',
          label,
          provenance: [`live-architecture-edge:${edge.id}`],
          metadata: {
            source: edge.source,
            target: edge.target,
            signalType: data?.signalType,
            voltage: data?.voltage,
            busWidth: data?.busWidth,
            net: data?.netName,
          },
        },
      },
    };
  });

  return [...nodeShapes, ...edgeShapes];
}

export function extractV3BoundaryObjectsFromShapes(shapes: V3TldrawShape[]): V3BoundaryObject[] {
  return shapes.map((shape): V3BoundaryObject => {
    const meta = shape.meta.protopulse;
    const metadata = readShapeMetadata(meta.metadata);
    const boundary: V3BoundaryObject = {
      id: meta.id,
      shapeId: shape.id,
      kind: meta.kind,
      label: meta.label || shape.props.text || meta.id,
      x: shape.x,
      y: shape.y,
      provenance: [...meta.provenance],
      metadata,
    };

    if (shape.type === 'arrow') {
      const source = readString(metadata.source);
      const target = readString(metadata.target);
      if (source) {
        boundary.sourceBoundaryId = source;
      }
      if (target) {
        boundary.targetBoundaryId = target;
      }
    }

    return boundary;
  });
}

export function extractLiveArchitectureBoundaries(nodes: GraphNode[], edges: GraphEdge[]): V3BoundaryObject[] {
  return extractV3BoundaryObjectsFromShapes(migrateLiveArchitectureToV3Shapes(nodes, edges));
}

export function buildLiveArchitectureMigrationPlan(
  nodes: GraphNode[],
  edges: GraphEdge[],
  boundaryObjects: V3BoundaryObject[] = extractLiveArchitectureBoundaries(nodes, edges),
): V3MigrationPlan {
  const boundaryKinds = new Set(boundaryObjects.map((boundary) => boundary.kind));
  const hasHardware = boundaryKinds.has('hardware');
  const hasSignal = boundaryKinds.has('signal');
  const hasBoundaries = boundaryObjects.length > 0;

  return {
    source: 'xyflow',
    target: 'tldraw-boundaries',
    steps: [
      {
        id: 'capture-live-graph',
        label: 'Capture live graph',
        status: nodes.length > 0 ? 'done' : 'blocked',
        detail: `${String(nodes.length)} nodes and ${String(edges.length)} edges from the current Architecture view.`,
      },
      {
        id: 'create-tldraw-shapes',
        label: 'Create tldraw shapes',
        status: hasBoundaries ? 'done' : 'blocked',
        detail: `${String(boundaryObjects.length)} shape-backed boundary records extracted.`,
      },
      {
        id: 'validate-boundaries',
        label: 'Validate boundary metadata',
        status: hasHardware && hasSignal ? 'done' : 'blocked',
        detail: hasHardware && hasSignal
          ? 'Hardware and signal boundaries are present.'
          : 'Hardware and signal boundaries are required before compile checks.',
      },
      {
        id: 'compile-v3',
        label: 'Compile v3 circuit',
        status: hasHardware && hasSignal ? 'pending' : 'blocked',
        detail: 'Run verified-fact checks before emitting tscircuit output.',
      },
      {
        id: 'feature-flag-launch',
        label: 'Feature-flag launch',
        status: 'pending',
        detail: 'Keep xyflow live until Tyler verifies the v3 gate on a real project.',
      },
    ],
  };
}

export function evaluateV3MetadataRules(boundaries: V3BoundaryObject[]): V3MetadataRuleResult[] {
  return V3_BOUNDARY_KINDS.map((kind) => {
    const matches = boundaries.filter((boundary) => boundary.kind === kind);
    if (matches.length === 0) {
      return {
        kind,
        status: 'missing',
        requiredFields: requiredFieldsForKind(kind),
        detail: `${kind} boundary is not present.`,
      };
    }

    const valid = matches.some((boundary) => hasRequiredMetadata(boundary));
    return {
      kind,
      status: valid ? 'satisfied' : 'incomplete',
      requiredFields: requiredFieldsForKind(kind),
      detail: valid
        ? `${kind} boundary metadata is usable.`
        : `${kind} boundary exists but is missing required metadata.`,
    };
  });
}

export function evaluateLiveV3Readiness(nodes: GraphNode[], edges: GraphEdge[]): V3ArchitectureReadiness {
  const shapes = migrateLiveArchitectureToV3Shapes(nodes, edges);
  const boundaryObjects = extractV3BoundaryObjectsFromShapes(shapes);
  const boundaryKinds = Array.from(new Set(boundaryObjects.map((boundary) => boundary.kind)));
  const missingBoundaryKinds = V3_BOUNDARY_KINDS.filter((kind) => !boundaryKinds.includes(kind));
  const metadataRules = evaluateV3MetadataRules(boundaryObjects);
  const blockedReasons: string[] = [];

  if (nodes.length === 0) {
    blockedReasons.push('add architecture nodes before v3 migration');
  }
  if (edges.length === 0) {
    blockedReasons.push('add at least one architecture connection before compile checks');
  }
  if (!boundaryKinds.includes('hardware')) {
    blockedReasons.push('hardware boundary is missing');
  }
  if (!boundaryKinds.includes('signal')) {
    blockedReasons.push('signal boundary is missing');
  }

  return {
    status: blockedReasons.length > 0 ? 'blocked' : 'ready',
    nodeCount: nodes.length,
    edgeCount: edges.length,
    tldrawShapeCount: shapes.length,
    boundaryObjectCount: boundaryObjects.length,
    boundaryObjects,
    boundaryKinds,
    missingBoundaryKinds,
    metadataRules,
    migrationPlan: buildLiveArchitectureMigrationPlan(nodes, edges, boundaryObjects),
    blockedReasons,
    nextStep: 'Open v3 behind a feature flag after this readiness card is green on a real project.',
  };
}

function boundaryKindFromNodeType(nodeType: string): V3BoundaryKind {
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

function readShapeMetadata(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? { ...value as Record<string, unknown> } : {};
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function requiredFieldsForKind(kind: V3BoundaryKind): string[] {
  switch (kind) {
    case 'hardware':
      return ['label', 'provenance'];
    case 'firmware':
      return ['board', 'behavior'];
    case 'power':
      return ['net or voltage'];
    case 'signal':
      return ['source', 'target', 'net'];
    case 'mechanical':
      return ['boardWidth or chassisDescription'];
  }
}

function hasRequiredMetadata(boundary: V3BoundaryObject): boolean {
  switch (boundary.kind) {
    case 'hardware':
      return Boolean(boundary.label && boundary.provenance.length > 0);
    case 'firmware':
      return Boolean(
        readString(boundary.metadata.board)
        || readString(boundary.metadata.targetBoard)
        || readString(boundary.metadata.behavior)
        || readString(boundary.metadata.firmwareBehavior),
      );
    case 'power':
      return Boolean(
        readString(boundary.metadata.net)
        || readString(boundary.metadata.netName)
        || readString(boundary.metadata.voltage),
      );
    case 'signal':
      return Boolean(
        boundary.sourceBoundaryId
        && boundary.targetBoundaryId
        && (readString(boundary.metadata.net) || readString(boundary.metadata.netName)),
      );
    case 'mechanical':
      return Boolean(
        readString(boundary.metadata.boardWidth)
        || readString(boundary.metadata.width)
        || readString(boundary.metadata.chassisDescription),
      );
  }
}
