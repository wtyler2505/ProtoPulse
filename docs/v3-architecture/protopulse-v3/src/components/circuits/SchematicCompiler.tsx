import { z } from 'zod';
import type { CanvasBoundary } from '../canvas/CanvasBindings';
import type { BoundaryRuleResult } from '../canvas/BoundaryRules';
import { VerificationStatusSchema } from '../../contracts/status';
import { emitTscircuitTsx, TscircuitDraftSchema, type TscircuitDraft } from './tscircuit-contract';

export const CompiledCircuitNodeSchema = z.object({
  id: z.string(),
  label: z.string(),
  sourceBoundaryId: z.string(),
  status: VerificationStatusSchema,
  notes: z.array(z.string()).default([]),
});

export type CompiledCircuitNode = z.infer<typeof CompiledCircuitNodeSchema>;

export const CanvasCompileResultSchema = z.object({
  status: z.enum(['ready', 'blocked']),
  draft: TscircuitDraftSchema.optional(),
  blockedReasons: z.array(z.string()),
});

export type CanvasCompileResult = z.infer<typeof CanvasCompileResultSchema>;

export function compileBoundariesToCircuitNodes(boundaries: CanvasBoundary[]): CompiledCircuitNode[] {
  return boundaries.map((boundary) => CompiledCircuitNodeSchema.parse({
    id: `circuit-${boundary.id}`,
    label: boundary.label,
    sourceBoundaryId: boundary.id,
    status: 'needs_verification',
    notes: ['Awaiting hardware fact verification before electrical layout generation.'],
  }));
}

export function compileCanvasBoundariesToTscircuit(
  boundaries: CanvasBoundary[],
  ruleResults: BoundaryRuleResult[],
): CanvasCompileResult {
  const blockedReasons: string[] = [];
  const ruleByBoundaryId = new Map(ruleResults.map((result) => [result.boundaryId, result]));
  const board = boundaries.find((boundary) => boundary.kind === 'mechanical' && boundary.metadata.boardSize);
  const elements: TscircuitDraft['elements'] = [
    {
      kind: 'board',
      props: {
        width: readStringMetadata(board?.metadata.width, '60mm'),
        height: readStringMetadata(board?.metadata.height, '40mm'),
      },
      provenance: board ? board.provenance : ['v3-default-board'],
      status: 'verified',
    },
  ];

  for (const boundary of boundaries) {
    const ruleResult = ruleByBoundaryId.get(boundary.id);
    if (!ruleResult || ruleResult.status !== 'ready') {
      blockedReasons.push(`${boundary.id} missing metadata: ${ruleResult?.missingMetadata.join(', ') || 'rule result'}`);
      continue;
    }

    elements.push(...compileBoundary(boundary));
  }

  if (blockedReasons.length > 0) {
    return CanvasCompileResultSchema.parse({
      status: 'blocked',
      draft: { elements },
      blockedReasons,
    });
  }

  return CanvasCompileResultSchema.parse({
    status: 'ready',
    draft: { elements },
    blockedReasons,
  });
}

export function emitVerifiedTscircuitTsx(result: CanvasCompileResult): string | undefined {
  if (result.status !== 'ready' || !result.draft) {
    return undefined;
  }

  return emitTscircuitTsx(result.draft);
}

export function getNoEmitReasons(result: CanvasCompileResult): string[] {
  if (result.status === 'ready') {
    return [];
  }

  return result.blockedReasons.length > 0
    ? result.blockedReasons
    : ['compile result is blocked'];
}

function compileBoundary(boundary: CanvasBoundary): TscircuitDraft['elements'] {
  if (boundary.kind === 'hardware') {
    const partNumber = String(boundary.metadata.partNumber);
    return [{
      kind: readElementKind(boundary.metadata.elementKind, 'chip'),
      name: safeElementName(boundary.id),
      props: {
        footprint: readStringMetadata(boundary.metadata.footprint, 'unknown'),
        schX: boundary.position.x / 100,
        schY: boundary.position.y / 100,
      },
      provenance: [...boundary.provenance, `part:${partNumber}`],
      status: 'verified',
    }];
  }

  if (boundary.kind === 'power') {
    return [{
      kind: 'powerRail',
      name: safeElementName(boundary.id),
      props: {
        voltage: readStringMetadata(boundary.metadata.voltage, 'unknown'),
        currentLimit: readStringMetadata(boundary.metadata.currentLimit, 'unknown'),
        net: readStringMetadata(boundary.metadata.net, 'net.VCC'),
      },
      provenance: boundary.provenance,
      status: 'verified',
    }];
  }

  if (boundary.kind === 'signal') {
    return [{
      kind: 'trace',
      props: {
        from: readStringMetadata(boundary.metadata.source, ''),
        to: readStringMetadata(boundary.metadata.target, ''),
        net: readStringMetadata(boundary.metadata.net, safeElementName(boundary.id)),
      },
      provenance: boundary.provenance,
      status: 'verified',
    }];
  }

  return [];
}

function readElementKind(value: unknown, fallback: 'chip' | 'connector'): 'chip' | 'connector' {
  return value === 'connector' ? 'connector' : fallback;
}

function readStringMetadata(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function safeElementName(id: string): string {
  const cleaned = id.replace(/[^a-zA-Z0-9_]/g, '_');
  return /^[a-zA-Z]/.test(cleaned) ? cleaned : `U_${cleaned}`;
}
