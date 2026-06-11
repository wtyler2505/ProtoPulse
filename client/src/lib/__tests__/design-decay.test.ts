import { describe, expect, it } from 'vitest';
import { getTopDesignDecayRecommendation, scoreDesignDecayViolation } from '@/lib/design-decay';
import type { ERCViolation } from '@shared/circuit-types';

function makeViolation(partial: Partial<ERCViolation>): ERCViolation {
  return {
    id: partial.id ?? 'v1',
    ruleType: partial.ruleType ?? 'unconnected-pin',
    severity: partial.severity ?? 'warning',
    message: partial.message ?? 'Issue',
    location: partial.location ?? { x: 0, y: 0 },
    ...partial,
  };
}

describe('design-decay scoring', () => {
  it('prioritizes session-speed issues above slower issues', () => {
    const top = getTopDesignDecayRecommendation([
      makeViolation({ id: 'slow', ruleType: 'missing-bypass-cap', severity: 'warning', message: 'Add cap' }),
      makeViolation({ id: 'fast', ruleType: 'shorted-power', severity: 'warning', message: 'Power short' }),
    ]);

    expect(top?.violation.id).toBe('fast');
    expect(top?.consequenceSpeed).toBe('session');
  });

  it('uses severity as tie-breaker within same speed class', () => {
    const warning = makeViolation({ ruleType: 'driver-conflict', severity: 'warning' });
    const error = makeViolation({ ruleType: 'driver-conflict', severity: 'error' });

    expect(scoreDesignDecayViolation(error)).toBeGreaterThan(scoreDesignDecayViolation(warning));
  });

  it('returns null for empty input', () => {
    expect(getTopDesignDecayRecommendation([])).toBeNull();
  });
});

