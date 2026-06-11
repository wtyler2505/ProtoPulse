import { z } from 'zod';

export const CanvasBoundarySchema = z.object({
  id: z.string(),
  label: z.string().min(1),
  kind: z.enum(['hardware', 'firmware', 'power', 'signal', 'mechanical']),
  sourceShapeId: z.string(),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }).default({ x: 0, y: 0 }),
  provenance: z.array(z.string()).default([]),
  metadata: z.record(z.unknown()).default({}),
});

export type CanvasBoundary = z.infer<typeof CanvasBoundarySchema>;

export function bindShapeToBoundary(input: unknown): CanvasBoundary {
  return CanvasBoundarySchema.parse(input);
}

export const TldrawShapeRecordSchema = z.object({
  id: z.string(),
  typeName: z.string().optional(),
  type: z.string(),
  x: z.number().default(0),
  y: z.number().default(0),
  props: z.record(z.unknown()).default({}),
  meta: z.record(z.unknown()).default({}),
});

const BoundaryMetaSchema = z.object({
  id: z.string().optional(),
  label: z.string().optional(),
  kind: CanvasBoundarySchema.shape.kind.optional(),
  provenance: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type TldrawShapeRecord = z.infer<typeof TldrawShapeRecordSchema>;

export function extractBoundariesFromTldrawShapes(input: unknown[]): CanvasBoundary[] {
  return input.flatMap((candidate) => {
    const shape = TldrawShapeRecordSchema.parse(candidate);
    const metadata = shape.meta.protopulse;
    const parsedMeta = BoundaryMetaSchema.safeParse(metadata);
    if (!parsedMeta.success || !parsedMeta.data.kind) {
      return [];
    }

    return [CanvasBoundarySchema.parse({
      id: parsedMeta.data.id ?? shape.id.replace(/^shape:/, ''),
      label: parsedMeta.data.label ?? labelFromShape(shape),
      kind: parsedMeta.data.kind,
      sourceShapeId: shape.id,
      position: { x: shape.x, y: shape.y },
      provenance: parsedMeta.data.provenance ?? [`tldraw:${shape.id}`],
      metadata: parsedMeta.data.metadata ?? {},
    })];
  });
}

function labelFromShape(shape: TldrawShapeRecord): string {
  const text = shape.props.text;
  if (typeof text === 'string' && text.trim()) {
    return text.trim();
  }
  return shape.id.replace(/^shape:/, '');
}
