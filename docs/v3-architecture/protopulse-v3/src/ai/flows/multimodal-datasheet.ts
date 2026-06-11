import { z } from 'zod';
import { VerificationStatusSchema } from '../../contracts/status';
import { v3Ai } from '../genkit';

export const DatasheetConstraintSchema = z.object({
  partNumber: z.string().min(1),
  source: z.string().min(1),
  facts: z.record(z.object({
    value: z.unknown(),
    source: z.string().min(1),
    status: VerificationStatusSchema,
  })).default({}),
  missingFacts: z.array(z.string()).default([]),
});

export type DatasheetConstraint = z.infer<typeof DatasheetConstraintSchema>;

export const MultimodalDatasheetInputSchema = z.object({
  projectId: z.number().int().positive(),
  sourceUri: z.string().min(1),
  partNumber: z.string().min(1),
  requestedFacts: z.array(z.string().min(1)).min(1),
});

export const MultimodalDatasheetOutputSchema = DatasheetConstraintSchema.extend({
  flowName: z.literal('multimodalDatasheet'),
});

export type MultimodalDatasheetInput = z.infer<typeof MultimodalDatasheetInputSchema>;
export type MultimodalDatasheetOutput = z.infer<typeof MultimodalDatasheetOutputSchema>;

export function normalizeDatasheetConstraints(input: unknown): DatasheetConstraint {
  return DatasheetConstraintSchema.parse(input);
}

export function runMultimodalDatasheetDraft(input: unknown): MultimodalDatasheetOutput {
  const parsed = MultimodalDatasheetInputSchema.parse(input);
  return MultimodalDatasheetOutputSchema.parse({
    flowName: 'multimodalDatasheet',
    partNumber: parsed.partNumber,
    source: parsed.sourceUri,
    facts: {},
    missingFacts: parsed.requestedFacts,
  });
}

export const multimodalDatasheetFlow = v3Ai.defineFlow({
  name: 'v3MultimodalDatasheetFlow',
  inputSchema: MultimodalDatasheetInputSchema,
  outputSchema: MultimodalDatasheetOutputSchema,
}, async (input) => runMultimodalDatasheetDraft(input));
