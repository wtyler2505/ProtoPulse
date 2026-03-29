/**
 * Standards Compliance — Barrel Export
 *
 * Re-exports all public types, constants, rules, engine, and hook
 * from the compliance module.
 */

// Types
export type {
  CheckContext,
  ClearanceCreepageResult,
  ComplianceBomItem,
  ComplianceCheckResult,
  ComplianceDomain,
  ComplianceFinding,
  ComplianceNode,
  ComplianceRule,
  ComplianceSeverity,
  ComponentRating,
  DeratingFactors,
  DesignParameters,
  EMCClass,
  Listener,
  MaterialGroup,
  PollutionDegree,
  SerializedPersistedData,
  SerializedRule,
} from './compliance-types';

// Constants & Helpers
export {
  calculateClearanceCreepage,
  CLEARANCE_TABLE,
  CREEPAGE_MULTIPLIER,
  DERATING_FACTORS,
  deratingCheck,
  isAutomotiveGrade,
  MAX_HISTORY,
  nextFindingId,
  STORAGE_KEY,
} from './compliance-constants';

// Domain Rules
export { AUTOMOTIVE_RULES } from './rules-automotive';
export { MEDICAL_RULES } from './rules-medical';
export { INDUSTRIAL_RULES } from './rules-industrial';
export { CONSUMER_RULES } from './rules-consumer';
export { AEROSPACE_RULES } from './rules-aerospace';
export { EMC_RULES } from './rules-emc';

// Aggregated Built-in Rules
export { BUILTIN_RULES } from './builtin-rules';

// Engine
export { StandardsComplianceEngine } from './compliance-engine';

// React Hook
export { useStandardsCompliance } from './use-standards-compliance';
