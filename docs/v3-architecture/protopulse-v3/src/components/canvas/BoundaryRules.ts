import { z } from 'zod';
import { CanvasBoundarySchema, type CanvasBoundary } from './CanvasBindings';

export const BoundaryKindSchema = CanvasBoundarySchema.shape.kind;

export const BoundaryRuleSchema = z.object({
  kind: BoundaryKindSchema,
  requiredMetadata: z.array(z.string()),
});

export const BoundaryRuleResultSchema = z.object({
  boundaryId: z.string(),
  kind: BoundaryKindSchema,
  status: z.enum(['ready', 'blocked']),
  missingMetadata: z.array(z.string()),
});

export type BoundaryRule = z.infer<typeof BoundaryRuleSchema>;
export type BoundaryRuleResult = z.infer<typeof BoundaryRuleResultSchema>;

export const boundaryRules: BoundaryRule[] = [
  { kind: 'hardware', requiredMetadata: ['partNumber', 'verifiedFacts'] },
  { kind: 'firmware', requiredMetadata: ['targetBoard', 'ownedPins'] },
  { kind: 'power', requiredMetadata: ['voltage', 'currentLimit'] },
  { kind: 'signal', requiredMetadata: ['source', 'target', 'protocol'] },
  { kind: 'mechanical', requiredMetadata: ['dimensions', 'clearance'] },
];

export function evaluateBoundaryRules(boundaries: CanvasBoundary[]): BoundaryRuleResult[] {
  return boundaries.map((boundary) => {
    const rule = boundaryRules.find((candidate) => candidate.kind === boundary.kind);
    const metadata = boundary.metadata ?? {};
    const missingMetadata = (rule?.requiredMetadata ?? []).filter((field) => !(field in metadata));
    return BoundaryRuleResultSchema.parse({
      boundaryId: boundary.id,
      kind: boundary.kind,
      status: missingMetadata.length > 0 ? 'blocked' : 'ready',
      missingMetadata,
    });
  });
}
