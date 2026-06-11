import type { Express } from 'express';
import { z } from 'zod';
import { fromZodError } from 'zod-validation-error/v3';
import { asyncHandler, parseIdParam, payloadLimit } from './utils';
import { requireProjectOwnership } from './auth-middleware';

const DATA_URL_MAX_LENGTH = 14 * 1024 * 1024;
const HARDWARE_INSPECTION_PAYLOAD_LIMIT = 16 * 1024 * 1024;

const imageDataUrlSchema = z
  .string({ required_error: 'Image is required' })
  .min(1, 'Image is required')
  .max(DATA_URL_MAX_LENGTH, 'Image payload is too large')
  .regex(/^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/, 'Image must be a PNG, JPEG, or WebP data URL');

const visualInspectionRequestSchema = z.object({
  imageUrl: imageDataUrlSchema,
  query: z.string().trim().min(1, 'Query is required').max(4000),
});

const layoutAnalysisRequestSchema = z.object({
  chassisDescription: z.string().trim().min(1, 'Chassis description is required').max(4000),
  query: z.string().trim().min(1, 'Query is required').max(4000),
  imageUrl: imageDataUrlSchema.optional(),
});

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export function registerHardwareInspectionRoutes(app: Express): void {
  const prefix = '/api/projects/:id/hardware-inspection';

  app.post(
    `${prefix}/visual`,
    requireProjectOwnership,
    payloadLimit(HARDWARE_INSPECTION_PAYLOAD_LIMIT),
    asyncHandler(async (req, res) => {
      const projectId = parseIdParam(req.params.id);
      const parsed = visualInspectionRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: fromZodError(parsed.error).toString() });
      }

      try {
        const { visualHardwareInspectionFlow } = await import('../genkit');
        const result = await visualHardwareInspectionFlow({ projectId, ...parsed.data });
        res.json({ result });
      } catch (error: unknown) {
        res.status(500).json({ message: `Hardware inspection failed: ${errorMessage(error)}` });
      }
    }),
  );

  app.post(
    `${prefix}/layout`,
    requireProjectOwnership,
    payloadLimit(HARDWARE_INSPECTION_PAYLOAD_LIMIT),
    asyncHandler(async (req, res) => {
      const projectId = parseIdParam(req.params.id);
      const parsed = layoutAnalysisRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: fromZodError(parsed.error).toString() });
      }

      try {
        const { embodiedLayoutAnalysisFlow } = await import('../genkit');
        const result = await embodiedLayoutAnalysisFlow({ projectId, ...parsed.data });
        res.json({ result });
      } catch (error: unknown) {
        res.status(500).json({ message: `Layout analysis failed: ${errorMessage(error)}` });
      }
    }),
  );
}
