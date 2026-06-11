import type { ERCRuleType, ERCViolation } from '@shared/circuit-types';

export interface JustInTimeSkillRecommendation {
  command: string;
  title: string;
  description: string;
  ruleType: ERCRuleType;
  violationId: string;
}

interface SkillTemplate {
  command: string;
  title: string;
  description: string;
}

const RULE_SKILL_MAP: Partial<Record<ERCRuleType, SkillTemplate>> = {
  'floating-input': {
    command: '/apply-input-bias-network',
    title: 'Apply Input Bias Network',
    description: 'Adds a pull-up or pull-down pattern for floating logic inputs.',
  },
  'missing-bypass-cap': {
    command: '/apply-decoupling-pack',
    title: 'Apply Decoupling Pack',
    description: 'Applies local bypass capacitor wiring near IC power pins.',
  },
  'shorted-power': {
    command: '/trace-power-rail-isolation',
    title: 'Trace Power Rail Isolation',
    description: 'Finds and isolates unintended rail-to-rail shorts.',
  },
  'driver-conflict': {
    command: '/resolve-net-driver-conflict',
    title: 'Resolve Net Driver Conflict',
    description: 'Converts competing outputs to a single-driver or gated topology.',
  },
};

export function resolveJustInTimeSkill(violation: ERCViolation): JustInTimeSkillRecommendation | null {
  const template = RULE_SKILL_MAP[violation.ruleType];
  if (!template) {
    return null;
  }
  return {
    ...template,
    ruleType: violation.ruleType,
    violationId: violation.id,
  };
}

export function getTopJustInTimeSkill(violations: ERCViolation[]): JustInTimeSkillRecommendation | null {
  for (const violation of violations) {
    const skill = resolveJustInTimeSkill(violation);
    if (skill) {
      return skill;
    }
  }
  return null;
}

