import { z } from 'zod';
import { VerificationStatusSchema } from '../contracts/status';

export const HardwareFactRequestSchema = z.object({
  partNumber: z.string().min(1),
  requiredFacts: z.array(z.string().min(1)).min(1),
  knownFacts: z.record(z.object({
    value: z.unknown(),
    source: z.string().min(1),
    status: VerificationStatusSchema,
  })).default({}),
});

export const HardwareFactGateResultSchema = z.object({
  status: VerificationStatusSchema,
  missingFacts: z.array(z.string()),
  acceptedFacts: z.record(z.unknown()),
});

export type HardwareFactGateResult = z.infer<typeof HardwareFactGateResultSchema>;

export function checkHardwareFacts(input: unknown): HardwareFactGateResult {
  const request = HardwareFactRequestSchema.parse(input);
  const acceptedFacts: Record<string, unknown> = {};
  const missingFacts: string[] = [];

  for (const fact of request.requiredFacts) {
    const known = request.knownFacts[fact];
    if (!known || known.status !== 'verified') {
      missingFacts.push(fact);
      continue;
    }
    acceptedFacts[fact] = known.value;
  }

  return HardwareFactGateResultSchema.parse({
    status: missingFacts.length > 0 ? 'needs_verification' : 'verified',
    missingFacts,
    acceptedFacts,
  });
}
