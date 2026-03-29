/**
 * Standards Compliance — Type Definitions
 *
 * All shared types, interfaces, and type aliases used across the compliance engine.
 */

// ---------------------------------------------------------------------------
// Domain & Severity
// ---------------------------------------------------------------------------

export type ComplianceDomain =
  | 'automotive'
  | 'medical'
  | 'industrial'
  | 'consumer'
  | 'aerospace'
  | 'emc';

export type ComplianceSeverity = 'violation' | 'warning' | 'recommendation';

export type PollutionDegree = 1 | 2 | 3 | 4;
export type MaterialGroup = 'I' | 'II' | 'IIIa' | 'IIIb';
export type EMCClass = 'residential' | 'commercial' | 'industrial';

// ---------------------------------------------------------------------------
// Rule & Finding
// ---------------------------------------------------------------------------

export interface ComplianceRule {
  id: string;
  domain: ComplianceDomain;
  standardRef: string;
  description: string;
  severity: ComplianceSeverity;
  check: (ctx: CheckContext) => ComplianceFinding[];
  remediation: string;
}

export interface ComplianceFinding {
  id: string;
  ruleId: string;
  domain: ComplianceDomain;
  standardRef: string;
  severity: ComplianceSeverity;
  message: string;
  remediation: string;
  componentId?: string;
  componentLabel?: string;
}

export interface ComplianceCheckResult {
  timestamp: number;
  domains: ComplianceDomain[];
  findings: ComplianceFinding[];
  passed: boolean;
  summary: {
    violations: number;
    warnings: number;
    recommendations: number;
    totalChecks: number;
    byDomain: Record<string, { violations: number; warnings: number; recommendations: number; passed: boolean }>;
  };
}

// ---------------------------------------------------------------------------
// Node & BOM
// ---------------------------------------------------------------------------

/** Lightweight representation of an architecture node for compliance checking. */
export interface ComplianceNode {
  nodeId: string;
  label: string;
  nodeType: string;
  data?: Record<string, unknown> | null;
}

/** Lightweight representation of a BOM item for compliance checking. */
export interface ComplianceBomItem {
  id: number;
  partNumber: string;
  manufacturer: string;
  description: string;
  quantity: number;
  unitPrice: string;
  totalPrice: string;
  supplier: string;
  status: string;
  esdSensitive?: boolean | null;
}

// ---------------------------------------------------------------------------
// Design Parameters & Ratings
// ---------------------------------------------------------------------------

/** Design parameters supplied by the user for standards checking. */
export interface DesignParameters {
  operatingTempMin?: number;
  operatingTempMax?: number;
  maxVoltage?: number;
  maxCurrent?: number;
  pollutionDegree?: PollutionDegree;
  materialGroup?: MaterialGroup;
  altitude?: number;
  emcClass?: EMCClass;
  isSafetyGrounded?: boolean;
  hasTouchableMetalParts?: boolean;
  boardArea?: number;
  expectedLifetimeHours?: number;
  componentRatings?: Record<string, ComponentRating>;
}

/** Rating info for a specific component for derating checks. */
export interface ComponentRating {
  maxVoltage?: number;
  maxCurrent?: number;
  maxTemperature?: number;
  maxPowerDissipation?: number;
  operatingVoltage?: number;
  operatingCurrent?: number;
  operatingTemperature?: number;
  operatingPower?: number;
}

/** Internal context passed to each rule's check function. */
export interface CheckContext {
  nodes: ComplianceNode[];
  bomItems: ComplianceBomItem[];
  params: DesignParameters;
  domains: ComplianceDomain[];
}

/** Derating factors per domain. */
export interface DeratingFactors {
  voltage: number;
  current: number;
  temperature: number;
  power: number;
}

/** Clearance/creepage calculation result. */
export interface ClearanceCreepageResult {
  clearance: number;
  creepage: number;
  standard: string;
  voltage: number;
  pollutionDegree: PollutionDegree;
  materialGroup: MaterialGroup;
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

type Listener = () => void;

export type { Listener };

interface SerializedRule {
  id: string;
  domain: ComplianceDomain;
  standardRef: string;
  description: string;
  severity: ComplianceSeverity;
  checkBody: string;
  remediation: string;
}

interface SerializedPersistedData {
  selectedDomains: ComplianceDomain[];
  customRules: SerializedRule[];
  history: ComplianceCheckResult[];
}

export type { SerializedRule, SerializedPersistedData };
