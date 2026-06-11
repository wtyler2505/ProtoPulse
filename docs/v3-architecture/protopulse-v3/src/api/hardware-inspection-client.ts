import { z } from 'zod';

export const VisualInspectionApiRequestSchema = z.object({
  projectId: z.number().int().positive(),
  imageUrl: z.string().startsWith('data:image/'),
  query: z.string().min(1),
});

export const VisualInspectionApiResponseSchema = z.object({
  result: z.string(),
});

export const LayoutAnalysisApiRequestSchema = z.object({
  projectId: z.number().int().positive(),
  chassisDescription: z.string().min(1),
  query: z.string().min(1),
  imageUrl: z.string().startsWith('data:image/').optional(),
});

export type VisualInspectionApiRequest = z.infer<typeof VisualInspectionApiRequestSchema>;
export type VisualInspectionApiResponse = z.infer<typeof VisualInspectionApiResponseSchema>;
export type LayoutAnalysisApiRequest = z.infer<typeof LayoutAnalysisApiRequestSchema>;

export function getVisualInspectionEndpoint(projectId: number): string {
  return `/api/projects/${String(projectId)}/hardware-inspection/visual`;
}

export function getLayoutAnalysisEndpoint(projectId: number): string {
  return `/api/projects/${String(projectId)}/hardware-inspection/layout`;
}

export async function runVisualInspectionApi(input: unknown): Promise<VisualInspectionApiResponse> {
  const payload = VisualInspectionApiRequestSchema.parse(input);
  const response = await fetch(getVisualInspectionEndpoint(payload.projectId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      imageUrl: payload.imageUrl,
      query: payload.query,
    }),
  });

  const body = await response.json() as unknown;
  if (!response.ok) {
    const message = body && typeof body === 'object' && 'message' in body
      ? String(body.message)
      : 'Visual inspection failed';
    throw new Error(message);
  }
  return VisualInspectionApiResponseSchema.parse(body);
}

export async function runLayoutAnalysisApi(input: unknown): Promise<VisualInspectionApiResponse> {
  const payload = LayoutAnalysisApiRequestSchema.parse(input);
  const response = await fetch(getLayoutAnalysisEndpoint(payload.projectId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chassisDescription: payload.chassisDescription,
      imageUrl: payload.imageUrl,
      query: payload.query,
    }),
  });

  const body = await response.json() as unknown;
  if (!response.ok) {
    const message = body && typeof body === 'object' && 'message' in body
      ? String(body.message)
      : 'Layout analysis failed';
    throw new Error(message);
  }
  return VisualInspectionApiResponseSchema.parse(body);
}
