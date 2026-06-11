import { z } from 'zod';

export const VerificationStatusSchema = z.enum(['verified', 'needs_verification', 'blocked']);

export type VerificationStatus = z.infer<typeof VerificationStatusSchema>;
