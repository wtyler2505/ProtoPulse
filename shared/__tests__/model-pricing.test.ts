import { describe, it, expect } from 'vitest';
import {
  MODEL_PRICING,
  approximateTokens,
  estimateCost,
  resolveModelPricing,
} from '../model-pricing';

describe('model-pricing', () => {
  describe('resolveModelPricing', () => {
    it('resolves exact known model IDs', () => {
      expect(resolveModelPricing('gemini-2.5-flash-lite')).toBe(
        MODEL_PRICING['gemini-2.5-flash-lite'],
      );
      expect(resolveModelPricing('gemini-2.5-pro')).toBe(
        MODEL_PRICING['gemini-2.5-pro'],
      );
    });

    it('matches longest prefix for date-suffixed model IDs', () => {
      // Anthropic tacks on -20250514 etc.
      expect(resolveModelPricing('claude-sonnet-4-5-20250514')).toBe(
        MODEL_PRICING['claude-sonnet-4-5'],
      );
      expect(resolveModelPricing('claude-haiku-4-5-20251001')).toBe(
        MODEL_PRICING['claude-haiku-4-5'],
      );
    });

    it('returns undefined for unknown models', () => {
      expect(resolveModelPricing('totally-fake-model-9')).toBeUndefined();
      expect(resolveModelPricing('')).toBeUndefined();
    });
  });

  describe('estimateCost — flat-rate models', () => {
    it('charges gemini-2.5-flash-lite at $0.10 / $0.40 per 1M', () => {
      // 1M input + 1M output = $0.50
      expect(estimateCost('gemini-2.5-flash-lite', 1_000_000, 1_000_000)).toBeCloseTo(0.5, 10);
      // 1K input + 1K output = $0.0005
      expect(estimateCost('gemini-2.5-flash-lite', 1_000, 1_000)).toBeCloseTo(0.0005, 10);
    });

    it('charges gemini-2.5-flash at $0.30 / $2.50 per 1M', () => {
      expect(estimateCost('gemini-2.5-flash', 1_000_000, 1_000_000)).toBeCloseTo(2.8, 10);
    });

    it('charges claude-sonnet-4-5 at $3 / $15 per 1M (prefix match)', () => {
      // 500K in, 100K out = 1.5 + 1.5 = 3.0
      expect(estimateCost('claude-sonnet-4-5-20250514', 500_000, 100_000)).toBeCloseTo(3.0, 10);
    });

    it('returns 0 for unknown models', () => {
      expect(estimateCost('totally-fake-model-9', 1_000_000, 1_000_000)).toBe(0);
    });

    it('clamps negative token counts to zero', () => {
      expect(estimateCost('gemini-2.5-flash', -100, -50)).toBe(0);
    });

    it('handles zero tokens', () => {
      expect(estimateCost('gemini-2.5-flash', 0, 0)).toBe(0);
    });
  });

  describe('estimateCost — premium threshold (gemini-2.5-pro)', () => {
    it('applies base rates at exactly the 128K threshold', () => {
      // 128_000 input — NOT over the threshold → base rates.
      // 128_000 * 1.25 + 0 * 10.00 = 0.16
      expect(estimateCost('gemini-2.5-pro', 128_000, 0)).toBeCloseTo(0.16, 10);
    });

    it('applies base rates just below the threshold', () => {
      // 127_999 input → base rate. 127_999 * 1.25 / 1e6 ≈ 0.15999875
      expect(estimateCost('gemini-2.5-pro', 127_999, 1_000)).toBeCloseTo(
        (127_999 * 1.25 + 1_000 * 10.0) / 1_000_000,
        10,
      );
    });

    it('applies premium rates above the threshold (both input AND output)', () => {
      // 128_001 input → premium. 128_001 * 2.50 + 1_000 * 15.00 per 1M
      expect(estimateCost('gemini-2.5-pro', 128_001, 1_000)).toBeCloseTo(
        (128_001 * 2.5 + 1_000 * 15.0) / 1_000_000,
        10,
      );
    });

    it('uses premium rates for large prompts', () => {
      // 500K input, 10K output at premium tier = (500_000 * 2.5 + 10_000 * 15) / 1M = 1.4
      expect(estimateCost('gemini-2.5-pro', 500_000, 10_000)).toBeCloseTo(1.4, 10);
    });
  });

  describe('approximateTokens', () => {
    it('returns chars / 4 rounded up', () => {
      expect(approximateTokens('')).toBe(0);
      expect(approximateTokens('a')).toBe(1);
      expect(approximateTokens('abcd')).toBe(1);
      expect(approximateTokens('abcde')).toBe(2);
      expect(approximateTokens('x'.repeat(400))).toBe(100);
    });
  });
});
