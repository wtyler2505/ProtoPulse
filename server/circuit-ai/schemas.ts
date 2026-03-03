/**
 * Zod validation schemas for Circuit AI endpoints
 */

import { z } from 'zod';

export const generateSchema = z.object({
  description: z.string().min(1).max(2000),
  apiKey: z.string().min(1),
  model: z.string().default('claude-sonnet-4-20250514'),
});

export const reviewSchema = z.object({
  apiKey: z.string().min(1),
  model: z.string().default('claude-sonnet-4-20250514'),
});

export const analyzeSchema = z.object({
  question: z.string().min(1).max(2000),
  apiKey: z.string().min(1),
  model: z.string().default('claude-sonnet-4-20250514'),
});
