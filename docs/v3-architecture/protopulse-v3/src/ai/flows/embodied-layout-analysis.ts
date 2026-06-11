import { z } from 'zod';
import { VerificationStatusSchema } from '../../contracts/status';
import { v3Ai } from '../genkit';

export const EmbodiedLayoutAnalysisInputSchema = z.object({
  projectId: z.number().int().positive(),
  chassisDescription: z.string().min(1),
  query: z.string().min(1),
  imageUrl: z.string().startsWith('data:image/').optional(),
  expectedFacts: z.array(z.string().min(1)).default([]),
  verifiedFacts: z.array(z.string().min(1)).default([]),
});

export const EmbodiedLayoutAnalysisOutputSchema = z.object({
  flowName: z.literal('embodiedLayoutAnalysis'),
  status: VerificationStatusSchema,
  markdown: z.string(),
  missingFacts: z.array(z.string()),
});

export type EmbodiedLayoutAnalysisInput = z.infer<typeof EmbodiedLayoutAnalysisInputSchema>;
export type EmbodiedLayoutAnalysisOutput = z.infer<typeof EmbodiedLayoutAnalysisOutputSchema>;

export function runEmbodiedLayoutAnalysisDraft(input: unknown): EmbodiedLayoutAnalysisOutput {
  const parsed = EmbodiedLayoutAnalysisInputSchema.parse(input);
  const missingFacts = parsed.expectedFacts.filter((fact) => !parsed.verifiedFacts.includes(fact));
  return EmbodiedLayoutAnalysisOutputSchema.parse({
    flowName: 'embodiedLayoutAnalysis',
    status: missingFacts.length > 0 ? 'needs_verification' : 'verified',
    markdown: missingFacts.length > 0
      ? [
        '# Layout Analysis',
        '',
        '## Status',
        '- blocked',
        '',
        '## Missing Facts',
        ...missingFacts.map((fact) => `- ${fact}`),
      ].join('\n')
      : [
        '# Layout Analysis',
        '',
        '## Status',
        '- accepted',
        '',
        '## Chassis',
        parsed.chassisDescription,
        '',
        '## Query',
        parsed.query,
      ].join('\n'),
    missingFacts,
  });
}

export const embodiedLayoutAnalysisFlow = v3Ai.defineFlow({
  name: 'v3EmbodiedLayoutAnalysisFlow',
  inputSchema: EmbodiedLayoutAnalysisInputSchema,
  outputSchema: EmbodiedLayoutAnalysisOutputSchema,
}, async (input) => runEmbodiedLayoutAnalysisDraft(input));
