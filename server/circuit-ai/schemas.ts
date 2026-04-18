/**
 * Zod validation schemas for Circuit AI endpoints
 */

import { z } from 'zod';

export const generateSchema = z.object({
  description: z.string().min(1).max(2000),
  apiKey: z.string().min(1),
  model: z.string().default('gemini-2.5-flash'),
});

export const reviewSchema = z.object({
  apiKey: z.string().min(1),
  model: z.string().default('gemini-2.5-flash'),
});

export const analyzeSchema = z.object({
  question: z.string().min(1).max(2000),
  apiKey: z.string().min(1),
  model: z.string().default('gemini-2.5-flash'),
});
