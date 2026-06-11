import { describe, expect, it } from 'vitest';
import { getTopJustInTimeSkill, resolveJustInTimeSkill } from '@/lib/just-in-time-skills';
import type { ERCViolation } from '@shared/circuit-types';

function makeViolation(ruleType: ERCViolation['ruleType'], id = 'v1'): ERCViolation {
  return {
    id,
    ruleType,
    severity: 'warning',
    message: 'Issue',
    location: { x: 0, y: 0 },
  };
}

describe('just-in-time-skills', () => {
  it('resolves a known rule type to an executable command recommendation', () => {
    const rec = resolveJustInTimeSkill(makeViolation('floating-input'));
    expect(rec?.command).toBe('/apply-input-bias-network');
  });

  it('returns first applicable recommendation from violation list', () => {
    const rec = getTopJustInTimeSkill([
      makeViolation('power-net-unnamed', 'a'),
      makeViolation('driver-conflict', 'b'),
    ]);
    expect(rec?.violationId).toBe('b');
    expect(rec?.command).toBe('/resolve-net-driver-conflict');
  });

  it('returns null when no mapped skill exists', () => {
    expect(getTopJustInTimeSkill([makeViolation('power-net-unnamed')])).toBeNull();
  });
});

