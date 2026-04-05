import type { ExactPartAiUsage } from './exact-part-ai-policy';
import type { ExactPartResolutionKind } from './exact-part-resolver';

export interface CircuitAiExactPartIntent {
  kind: ExactPartResolutionKind;
  message: string;
  recommendedDraftDescription: string;
  title: string;
  topMatchPartId: number | null;
}

export interface CircuitAiExactPartWorkflow {
  authoritativeWiringAllowed: boolean;
  requestedExactParts: CircuitAiExactPartIntent[];
  summary: string;
  usedParts: ExactPartAiUsage[];
  warnings: string[];
}

export interface CircuitAiGenerateResponse {
  success: boolean;
  message: string;
  exactPartWorkflow?: CircuitAiExactPartWorkflow;
}
