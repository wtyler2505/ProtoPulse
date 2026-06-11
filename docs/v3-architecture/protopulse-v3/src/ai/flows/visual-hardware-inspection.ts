import { z } from 'zod';
import { VerificationStatusSchema } from '../../contracts/status';
import { v3Ai } from '../genkit';

export const VisualHardwareInspectionInputSchema = z.object({
  projectId: z.number().int().positive(),
  imageUrl: z.string().startsWith('data:image/'),
  query: z.string().min(1),
  expectedFacts: z.array(z.string().min(1)).default([]),
  verifiedFacts: z.array(z.string().min(1)).default([]),
});

export const VisualHardwareInspectionOutputSchema = z.object({
  flowName: z.literal('visualHardwareInspection'),
  status: VerificationStatusSchema,
  markdown: z.string(),
  missingFacts: z.array(z.string()),
});

export type VisualHardwareInspectionInput = z.infer<typeof VisualHardwareInspectionInputSchema>;
export type VisualHardwareInspectionOutput = z.infer<typeof VisualHardwareInspectionOutputSchema>;

export function runVisualHardwareInspectionDraft(input: unknown): VisualHardwareInspectionOutput {
  const parsed = VisualHardwareInspectionInputSchema.parse(input);
  const missingFacts = parsed.expectedFacts.filter((fact) => !parsed.verifiedFacts.includes(fact));
  return VisualHardwareInspectionOutputSchema.parse({
    flowName: 'visualHardwareInspection',
    status: missingFacts.length > 0 ? 'needs_verification' : 'verified',
    markdown: missingFacts.length > 0
      ? [
        '# Hardware Inspection',
        '',
        '## Status',
        '- blocked',
        '',
        '## Missing Facts',
        ...missingFacts.map((fact) => `- ${fact}`),
      ].join('\n')
      : [
        '# Hardware Inspection',
        '',
        '## Status',
        '- accepted',
        '',
        '## Query',
        parsed.query,
      ].join('\n'),
    missingFacts,
  });
}

export const visualHardwareInspectionFlow = v3Ai.defineFlow({
  name: 'v3VisualHardwareInspectionFlow',
  inputSchema: VisualHardwareInspectionInputSchema,
  outputSchema: VisualHardwareInspectionOutputSchema,
}, async (input) => runVisualHardwareInspectionDraft(input));
