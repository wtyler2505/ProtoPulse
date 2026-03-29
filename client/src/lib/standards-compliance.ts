/**
 * Standards Compliance Checking Engine
 *
 * Thin facade — all implementation lives in ./compliance/.
 * This file re-exports everything for backwards compatibility.
 *
 * @see ./compliance/compliance-types.ts   — Type definitions
 * @see ./compliance/compliance-constants.ts — Derating factors, clearance tables, helpers
 * @see ./compliance/rules-automotive.ts   — AEC-Q100/Q101/Q200 rules
 * @see ./compliance/rules-medical.ts      — IEC 60601 rules
 * @see ./compliance/rules-industrial.ts   — IEC 61131 rules
 * @see ./compliance/rules-consumer.ts     — IEC 62368 rules
 * @see ./compliance/rules-aerospace.ts    — DO-254 / MIL-STD rules
 * @see ./compliance/rules-emc.ts          — IEC 61000 rules
 * @see ./compliance/compliance-engine.ts  — StandardsComplianceEngine singleton
 * @see ./compliance/use-standards-compliance.ts — React hook
 */

// Re-export all types
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
  MaterialGroup,
  PollutionDegree,
} from './compliance';

// Re-export constants & helpers
export { calculateClearanceCreepage } from './compliance';

// Re-export engine
export { StandardsComplianceEngine } from './compliance';

// Re-export hook
export { useStandardsCompliance } from './compliance';
