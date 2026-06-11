import type { GraphEdge, GraphNode } from '@/lib/graph-types';
import {
  buildTSCircuitCompileProof,
  type TSCircuitCompileInput,
  type TSCircuitCompileProof,
  type TSCircuitExportInstance,
  type TSCircuitExportNet,
} from '@/lib/tscircuit-compile-proof';
import { enrichV3NodesFromVerifiedSources } from '@/lib/v3-verified-fact-enrichment';

export type V3CompileStatus = 'ready' | 'blocked';

export interface V3ArchitectureCompileReport {
  status: V3CompileStatus;
  acceptedFacts: string[];
  missingFacts: string[];
  blockedTasks: string[];
  emittedTsx?: string;
  compileInput?: TSCircuitCompileInput;
  compileProof?: TSCircuitCompileProof;
  summary: {
    boardWidth: string;
    boardHeight: string;
    chips: number;
    connectors: number;
    passives: number;
    powerRails: number;
    nets: number;
    traces: number;
  };
}

export interface V3ArchitectureCompileOptions {
  enrichFromVerifiedSources?: boolean;
}

type NodeData = Record<string, unknown>;
type EdgeData = Record<string, unknown>;

export function buildLiveArchitectureCompileReport(
  nodes: GraphNode[],
  edges: GraphEdge[],
  options: V3ArchitectureCompileOptions = {},
): V3ArchitectureCompileReport {
  const sourceEnrichment = options.enrichFromVerifiedSources
    ? enrichV3NodesFromVerifiedSources(nodes)
    : { nodes, facts: [] };
  const compileNodes = sourceEnrichment.nodes;
  const acceptedFacts: string[] = [];
  const missingFacts: string[] = [];
  const blockedTasks: string[] = [];
  const board = readBoardSize(compileNodes);
  const instances: TSCircuitExportInstance[] = [];
  const idByNodeId = new Map<string, number>();
  let chips = 0;
  let connectors = 0;
  let passives = 0;
  let powerRails = 0;

  sourceEnrichment.facts.forEach((fact) => {
    acceptedFacts.push(`${fact.subject}: ${fact.factType} from ${fact.sourceRef}`);
  });

  compileNodes.forEach((node, index) => {
    const data = readData(node.data);
    const kind = readKind(data);
    const label = readString(data.label) ?? node.id;

    if (kind === 'mechanical') {
      acceptedFacts.push(`${label}: board ${board.width} x ${board.height}`);
      return;
    }

    if (kind === 'power') {
      powerRails += 1;
      const net = readString(data.net) ?? readString(data.netName) ?? safeNetName(label);
      acceptedFacts.push(`${label}: power rail ${net}`);
      return;
    }

    if (!isVerified(data)) {
      missingFacts.push(`${label}: verified hardware fact`);
      blockedTasks.push(`${label}: mark source metadata as verified before tscircuit emit`);
      return;
    }

    const referenceDesignator = readReferenceDesignator(data, index + 1);
    const footprint = readString(data.footprint) ?? fallbackFootprint(referenceDesignator);
    const componentType = classifyComponent(referenceDesignator, data);
    if (componentType === 'connector') {
      connectors += 1;
    } else if (componentType === 'chip') {
      chips += 1;
    } else {
      passives += 1;
    }

    const numericId = index + 1;
    idByNodeId.set(node.id, numericId);
    instances.push({
      id: numericId,
      referenceDesignator,
      schematicX: node.position.x / 100,
      schematicY: node.position.y / 100,
      pcbX: node.position.x / 100,
      pcbY: node.position.y / 100,
      properties: {
        value: readString(data.value) ?? readString(data.partNumber) ?? label,
        partNumber: readString(data.partNumber),
        manufacturerPartNumber: readString(data.manufacturerPartNumber),
        footprint,
      },
    });
    acceptedFacts.push(`${label}: ${referenceDesignator} ${footprint}`);
  });

  const nets = buildNets(edges, idByNodeId, missingFacts, blockedTasks);
  const compileInput: TSCircuitCompileInput = {
    instances,
    nets,
    boardWidth: board.width,
    boardHeight: board.height,
  };
  const ready = blockedTasks.length === 0 && instances.length > 0;

  return {
    status: ready ? 'ready' : 'blocked',
    acceptedFacts,
    missingFacts,
    blockedTasks,
    emittedTsx: ready ? emitTscircuitPreview(compileInput) : undefined,
    compileInput: ready ? compileInput : undefined,
    summary: {
      boardWidth: board.width,
      boardHeight: board.height,
      chips,
      connectors,
      passives,
      powerRails,
      nets: nets.length,
      traces: nets.reduce((count, net) => count + (Array.isArray(net.segments) ? net.segments.length : 0), 0),
    },
  };
}

export async function runLiveArchitectureTSCircuitCompile(
  nodes: GraphNode[],
  edges: GraphEdge[],
  options: V3ArchitectureCompileOptions = {},
): Promise<V3ArchitectureCompileReport> {
  const report = buildLiveArchitectureCompileReport(nodes, edges, options);
  if (report.status !== 'ready' || !report.compileInput) {
    return report;
  }

  return {
    ...report,
    compileProof: await buildTSCircuitCompileProof(report.compileInput),
  };
}

function readData(data: unknown): NodeData {
  return data && typeof data === 'object' ? data as NodeData : {};
}

function readEdgeData(data: unknown): EdgeData {
  return data && typeof data === 'object' ? data as EdgeData : {};
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function readKind(data: NodeData): string {
  return (readString(data.kind) ?? readString(data.type) ?? 'hardware').toLowerCase();
}

function isVerified(data: NodeData): boolean {
  return data.verified === true
    || data.verificationStatus === 'verified'
    || data.status === 'verified'
    || data.sourceStatus === 'verified';
}

function readReferenceDesignator(data: NodeData, fallbackIndex: number): string {
  const explicit = readString(data.referenceDesignator) ?? readString(data.refDes);
  if (explicit) {
    return explicit;
  }

  const kind = readKind(data);
  if (kind.includes('connector')) {
    return `J${String(fallbackIndex)}`;
  }
  if (kind.includes('resistor')) {
    return `R${String(fallbackIndex)}`;
  }
  if (kind.includes('capacitor')) {
    return `C${String(fallbackIndex)}`;
  }
  if (kind.includes('led')) {
    return `LED${String(fallbackIndex)}`;
  }
  return `U${String(fallbackIndex)}`;
}

function classifyComponent(referenceDesignator: string, data: NodeData): 'chip' | 'connector' | 'passive' {
  const kind = readKind(data);
  if (kind.includes('connector') || /^(J|P|CONN)\d*/i.test(referenceDesignator)) {
    return 'connector';
  }
  if (/^(R|C|LED|L)\d*/i.test(referenceDesignator)) {
    return 'passive';
  }
  return 'chip';
}

function fallbackFootprint(referenceDesignator: string): string {
  if (/^R/i.test(referenceDesignator)) {
    return '0603';
  }
  if (/^C/i.test(referenceDesignator)) {
    return '0603';
  }
  if (/^(LED|L)/i.test(referenceDesignator)) {
    return '0603';
  }
  if (/^(J|P|CONN)/i.test(referenceDesignator)) {
    return 'pinrow2';
  }
  return 'soic8';
}

function readBoardSize(nodes: GraphNode[]): { width: string; height: string } {
  const mechanical = nodes.find((node) => readKind(readData(node.data)).includes('mechanical'));
  const data = readData(mechanical?.data);
  return {
    width: readString(data.width) ?? readString(data.boardWidth) ?? '60mm',
    height: readString(data.height) ?? readString(data.boardHeight) ?? '40mm',
  };
}

function buildNets(
  edges: GraphEdge[],
  idByNodeId: Map<string, number>,
  missingFacts: string[],
  blockedTasks: string[],
): TSCircuitExportNet[] {
  return edges.flatMap((edge, index): TSCircuitExportNet[] => {
    const sourceId = idByNodeId.get(edge.source);
    const targetId = idByNodeId.get(edge.target);
    const data = readEdgeData(edge.data);
    const label = typeof edge.label === 'string' && edge.label.trim() ? edge.label.trim() : edge.id;
    const name = readString(data.netName) ?? readString(data.net) ?? safeNetName(label);

    if (!sourceId || !targetId) {
      missingFacts.push(`${label}: mapped source and target components`);
      blockedTasks.push(`${label}: connect only verified hardware components before trace emit`);
      return [];
    }

    return [{
      id: index + 1,
      name,
      netType: readString(data.signalType) ?? 'signal',
      segments: [{
        fromInstanceId: sourceId,
        fromPin: readString(data.sourcePin) ?? 'pin1',
        toInstanceId: targetId,
        toPin: readString(data.targetPin) ?? 'pin1',
      }],
    }];
  });
}

function safeNetName(label: string): string {
  const cleaned = label.replace(/[^A-Za-z0-9_]/g, '_').replace(/^_+|_+$/g, '');
  return cleaned ? `net.${cleaned.toUpperCase()}` : 'net.SIGNAL';
}

function emitTscircuitPreview(input: TSCircuitCompileInput): string {
  const boardWidth = input.boardWidth ?? '60mm';
  const boardHeight = input.boardHeight ?? '40mm';
  const components = (input.instances ?? []).map((instance) => {
    const props = instance.properties && typeof instance.properties === 'object'
      ? instance.properties as Record<string, unknown>
      : {};
    return `    <${tagForReference(instance.referenceDesignator)} name="${instance.referenceDesignator}" footprint="${String(props.footprint ?? fallbackFootprint(instance.referenceDesignator))}" />`;
  });
  const traces = (input.nets ?? []).flatMap((net) => {
    const segments = Array.isArray(net.segments) ? net.segments : [];
    return segments.map((segment) => {
      const typed = segment as { fromInstanceId: number; fromPin: string; toInstanceId: number; toPin: string };
      const from = input.instances?.find((instance) => instance.id === typed.fromInstanceId)?.referenceDesignator;
      const to = input.instances?.find((instance) => instance.id === typed.toInstanceId)?.referenceDesignator;
      return from && to ? `    <trace from="${from}.${typed.fromPin}" to="${to}.${typed.toPin}" />` : undefined;
    }).filter((line): line is string => Boolean(line));
  });

  return [
    'export default () => (',
    `  <board width="${boardWidth}" height="${boardHeight}">`,
    ...components,
    ...traces,
    '  </board>',
    ')',
    '',
  ].join('\n');
}

function tagForReference(referenceDesignator: string): 'resistor' | 'capacitor' | 'led' | 'chip' {
  if (/^R/i.test(referenceDesignator)) {
    return 'resistor';
  }
  if (/^C/i.test(referenceDesignator)) {
    return 'capacitor';
  }
  if (/^(LED|L)/i.test(referenceDesignator)) {
    return 'led';
  }
  return 'chip';
}
