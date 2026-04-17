/**
 * Token pricing for AI models (USD per 1M tokens).
 *
 * Last updated: 2026-04-17 — verify against current provider pricing pages:
 *   - Google Gemini:   https://ai.google.dev/gemini-api/docs/pricing
 *   - Anthropic Claude: https://www.anthropic.com/pricing
 *
 * When `premiumThreshold` is set, prompts whose input-token count EXCEEDS the
 * threshold are billed at the premium rates (e.g. Gemini 2.5 Pro charges more
 * for prompts over 128K tokens). Both input AND output of that request are
 * treated as premium on Google's current schedule.
 *
 * Fixes AI-audit H-2 / triage #8: ChatPanel was using stale hardcoded
 * $0.00025/$0.0005 per-1K pricing (roughly an order of magnitude off for
 * modern Gemini tiers) and always converting chars/4 even when the provider
 * returned real usage counts.
 */
export interface ModelPricing {
  /** USD per 1M input tokens at or below the premium threshold. */
  inputPer1M: number;
  /** USD per 1M output tokens at or below the premium threshold. */
  outputPer1M: number;
  /** USD per 1M input tokens above the premium threshold. */
  premiumInputPer1M?: number;
  /** USD per 1M output tokens above the premium threshold. */
  premiumOutputPer1M?: number;
  /** Input-token count above which premium rates apply. */
  premiumThreshold?: number;
}

/**
 * Registry of known model IDs to pricing.
 *
 * Key matching in `estimateCost`:
 *   1. Exact match first.
 *   2. Longest prefix match (e.g. "claude-sonnet-4-5-20250514" matches
 *      "claude-sonnet-4-5"). This keeps the table stable as providers append
 *      date suffixes.
 */
export const MODEL_PRICING: Record<string, ModelPricing> = {
  // --- Google Gemini 2.5 family ----------------------------------------------
  // Source: https://ai.google.dev/gemini-api/docs/pricing (retrieved 2026-04-17)
  'gemini-2.5-flash-lite': {
    inputPer1M: 0.10,
    outputPer1M: 0.40,
  },
  'gemini-2.5-flash': {
    inputPer1M: 0.30,
    outputPer1M: 2.50,
  },
  'gemini-2.5-pro': {
    inputPer1M: 1.25,
    outputPer1M: 10.00,
    premiumInputPer1M: 2.50,
    premiumOutputPer1M: 15.00,
    premiumThreshold: 128_000,
  },

  // --- Google Gemini 1.5 family (legacy) -------------------------------------
  'gemini-1.5-flash': {
    inputPer1M: 0.075,
    outputPer1M: 0.30,
    premiumInputPer1M: 0.15,
    premiumOutputPer1M: 0.60,
    premiumThreshold: 128_000,
  },
  'gemini-1.5-pro': {
    inputPer1M: 1.25,
    outputPer1M: 5.00,
    premiumInputPer1M: 2.50,
    premiumOutputPer1M: 10.00,
    premiumThreshold: 128_000,
  },

  // --- Anthropic Claude 4.5 family -------------------------------------------
  // Source: https://www.anthropic.com/pricing (retrieved 2026-04-17)
  'claude-haiku-4-5': {
    inputPer1M: 1.00,
    outputPer1M: 5.00,
  },
  'claude-sonnet-4-5': {
    inputPer1M: 3.00,
    outputPer1M: 15.00,
  },
  'claude-opus-4-5': {
    inputPer1M: 15.00,
    outputPer1M: 75.00,
  },
};

/**
 * Resolve a pricing entry for a model by exact or longest-prefix match.
 * Returns `undefined` if nothing matches.
 */
export function resolveModelPricing(model: string): ModelPricing | undefined {
  if (MODEL_PRICING[model]) return MODEL_PRICING[model];

  let bestKey: string | undefined;
  for (const key of Object.keys(MODEL_PRICING)) {
    if (model.startsWith(key) && (bestKey === undefined || key.length > bestKey.length)) {
      bestKey = key;
    }
  }
  return bestKey !== undefined ? MODEL_PRICING[bestKey] : undefined;
}

/**
 * Estimate USD cost for a request given the model's known pricing.
 * Returns 0 for unknown models — callers should check `resolveModelPricing`
 * first if they need to distinguish "free" from "unknown".
 *
 * @param model         Resolved model ID (e.g. "gemini-2.5-flash-lite").
 * @param inputTokens   Prompt / input token count.
 * @param outputTokens  Completion / output token count.
 */
export function estimateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const pricing = resolveModelPricing(model);
  if (!pricing) return 0;

  const useMinimum = Math.max(0, inputTokens);
  const outMinimum = Math.max(0, outputTokens);

  const isPremium =
    pricing.premiumThreshold !== undefined &&
    pricing.premiumInputPer1M !== undefined &&
    pricing.premiumOutputPer1M !== undefined &&
    useMinimum > pricing.premiumThreshold;

  const inRate = isPremium ? pricing.premiumInputPer1M! : pricing.inputPer1M;
  const outRate = isPremium ? pricing.premiumOutputPer1M! : pricing.outputPer1M;

  return (useMinimum * inRate + outMinimum * outRate) / 1_000_000;
}

/**
 * Rough chars→tokens approximation for UI previews before real usage arrives.
 * GPT/Gemini tokenizers average ~4 chars per token for English prose. This is
 * only used as a fallback; real usage from `response.usage` always wins.
 */
export function approximateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
