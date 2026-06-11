import type { GraphNode } from '@/lib/graph-types';
import { findVerifiedBoardByAlias } from '@shared/verified-boards';

export interface V3ResolvedHardwareFact {
  subject: string;
  factType: string;
  sourceType: 'verified-board-pack';
  sourceRef: string;
  provenance: string[];
  value: Record<string, unknown>;
}

export interface V3VerifiedFactEnrichment {
  nodes: GraphNode[];
  facts: V3ResolvedHardwareFact[];
}

export function enrichV3NodesFromVerifiedSources(nodes: GraphNode[]): V3VerifiedFactEnrichment {
  const facts: V3ResolvedHardwareFact[] = [];
  const enrichedNodes = nodes.map((node): GraphNode => {
    const data = readData(node.data);
    const query = readString(data.partNumber)
      ?? readString(data.board)
      ?? readString(data.label)
      ?? node.id;
    if (isGenericHardwareLabel(query)) {
      return node;
    }
    const board = findVerifiedBoardByAlias(query);

    if (!board) {
      return node;
    }

    const pinIds = board.pins.map((pin) => pin.id);
    const fact: V3ResolvedHardwareFact = {
      subject: board.title,
      factType: 'pinout',
      sourceType: 'verified-board-pack',
      sourceRef: `shared/verified-boards/${board.id}`,
      provenance: board.evidence
        .map((evidence) => evidence.href)
        .filter((href): href is string => typeof href === 'string' && href.length > 0),
      value: {
        boardId: board.id,
        title: board.title,
        manufacturer: board.manufacturer,
        dimensions: board.dimensions,
        pinCount: pinIds.length,
        pins: pinIds,
        evidence: board.evidence,
      },
    };
    facts.push(fact);

    return {
      ...node,
      data: {
        ...data,
        verified: true,
        sourceStatus: 'verified',
        pins: mergeStringArrays(readStringArray(data.pins), pinIds),
        verifiedFacts: mergeStringArrays(readStringArray(data.verifiedFacts), ['pinout', 'dimensions', 'source-provenance']),
        provenance: mergeStringArrays(readStringArray(data.provenance), fact.provenance),
      },
    };
  });

  return { nodes: enrichedNodes, facts };
}

function readData(data: unknown): Record<string, unknown> {
  return data && typeof data === 'object' ? data as Record<string, unknown> : {};
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function mergeStringArrays(first: string[], second: string[]): string[] {
  return Array.from(new Set([...first, ...second]));
}

function isGenericHardwareLabel(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized.length < 4
    || ['mcu', 'board', 'controller', 'module', 'firmware', 'hardware'].includes(normalized);
}
