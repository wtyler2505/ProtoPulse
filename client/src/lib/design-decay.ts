import type { ERCRuleType, ERCSeverity, ERCViolation } from '@shared/circuit-types';

export type ConsequenceSpeed = 'session' | 'multi-session' | 'slow';

export interface DesignDecayRecommendation {
  violation: ERCViolation;
  consequenceSpeed: ConsequenceSpeed;
  score: number;
  action: string;
}

const RULE_SPEED: Record<ERCRuleType, ConsequenceSpeed> = {
  'shorted-power': 'session',
  'driver-conflict': 'session',
  'unconnected-pin': 'multi-session',
  'floating-input': 'multi-session',
  'no-connect-connected': 'multi-session',
  'missing-bypass-cap': 'slow',
  'power-net-unnamed': 'slow',
};

const SPEED_WEIGHT: Record<ConsequenceSpeed, number> = {
  session: 100,
  'multi-session': 60,
  slow: 30,
};

const SEVERITY_WEIGHT: Record<ERCSeverity, number> = {
  error: 20,
  warning: 0,
};

const RULE_ACTION: Record<ERCRuleType, string> = {
  'shorted-power': 'Separate power rails that are shorted before continuing routing.',
  'driver-conflict': 'Resolve competing output drivers on the same net.',
  'unconnected-pin': 'Connect or explicitly mark intentionally unconnected pins.',
  'floating-input': 'Add a pull-up/pull-down or driving source for floating input pins.',
  'no-connect-connected': 'Remove net ties from pins marked no-connect.',
  'missing-bypass-cap': 'Add local decoupling capacitors near IC power pins.',
  'power-net-unnamed': 'Name power nets explicitly to prevent downstream ambiguity.',
};

export function getConsequenceSpeed(ruleType: ERCRuleType): ConsequenceSpeed {
  return RULE_SPEED[ruleType];
}

export function scoreDesignDecayViolation(violation: ERCViolation): number {
  const speed = getConsequenceSpeed(violation.ruleType);
  return SPEED_WEIGHT[speed] + SEVERITY_WEIGHT[violation.severity];
}

export function getTopDesignDecayRecommendation(violations: ERCViolation[]): DesignDecayRecommendation | null {
  if (violations.length === 0) {
    return null;
  }

  const sorted = [...violations].sort((a, b) => scoreDesignDecayViolation(b) - scoreDesignDecayViolation(a));
  const violation = sorted[0];
  const consequenceSpeed = getConsequenceSpeed(violation.ruleType);

  return {
    violation,
    consequenceSpeed,
    score: scoreDesignDecayViolation(violation),
    action: RULE_ACTION[violation.ruleType],
  };
}

