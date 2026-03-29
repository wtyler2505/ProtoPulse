/**
 * Standards Compliance — Constants & Helpers
 *
 * Derating factors, clearance/creepage tables, automotive-grade detection,
 * finding ID generation, and the shared derating check function.
 */

import type {
  CheckContext,
  ClearanceCreepageResult,
  ComplianceBomItem,
  ComplianceDomain,
  ComplianceFinding,
  DeratingFactors,
  MaterialGroup,
  PollutionDegree,
} from './compliance-types';

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

export const STORAGE_KEY = 'protopulse-standards-compliance';
export const MAX_HISTORY = 20;

// ---------------------------------------------------------------------------
// Derating Factors by Domain
// ---------------------------------------------------------------------------

export const DERATING_FACTORS: Record<ComplianceDomain, DeratingFactors> = {
  automotive: { voltage: 0.70, current: 0.70, temperature: 0.80, power: 0.60 },
  medical: { voltage: 0.60, current: 0.60, temperature: 0.75, power: 0.50 },
  industrial: { voltage: 0.75, current: 0.75, temperature: 0.85, power: 0.65 },
  consumer: { voltage: 0.80, current: 0.80, temperature: 0.90, power: 0.75 },
  aerospace: { voltage: 0.50, current: 0.50, temperature: 0.70, power: 0.40 },
  emc: { voltage: 0.80, current: 0.80, temperature: 0.90, power: 0.75 },
};

// ---------------------------------------------------------------------------
// Clearance/Creepage Tables (IEC 60664-1)
// ---------------------------------------------------------------------------

/** Minimum clearance in mm by RMS voltage and pollution degree. */
export const CLEARANCE_TABLE: Record<number, Record<PollutionDegree, number>> = {
  50: { 1: 0.04, 2: 0.2, 3: 0.8, 4: 0.8 },
  100: { 1: 0.1, 2: 0.2, 3: 0.8, 4: 0.8 },
  150: { 1: 0.15, 2: 0.5, 3: 0.8, 4: 0.8 },
  300: { 1: 0.5, 2: 1.5, 3: 1.5, 4: 1.5 },
  600: { 1: 1.0, 2: 3.0, 3: 3.0, 4: 3.0 },
  1000: { 1: 1.5, 2: 5.0, 3: 5.5, 4: 5.5 },
};

/** CTI (comparative tracking index) groups for creepage multipliers. */
export const CREEPAGE_MULTIPLIER: Record<MaterialGroup, number> = {
  I: 1.0,
  II: 1.2,
  IIIa: 1.4,
  IIIb: 1.6,
};

// ---------------------------------------------------------------------------
// Automotive-grade component identification
// ---------------------------------------------------------------------------

const AUTOMOTIVE_GRADE_INDICATORS = [
  'aec-q', 'automotive', 'auto grade', 'aecq100', 'aecq101', 'aecq200',
  'grade 0', 'grade 1', 'grade 2', 'grade 3',
  '-q100', '-q101', '-q200',
];

export function isAutomotiveGrade(item: ComplianceBomItem): boolean {
  const searchText = `${item.partNumber} ${item.manufacturer} ${item.description}`.toLowerCase();
  return AUTOMOTIVE_GRADE_INDICATORS.some((indicator) => searchText.includes(indicator));
}

// ---------------------------------------------------------------------------
// Utility: generate a finding ID
// ---------------------------------------------------------------------------

let findingCounter = 0;
export function nextFindingId(): string {
  findingCounter++;
  return `SCF-${Date.now()}-${findingCounter}`;
}

// ---------------------------------------------------------------------------
// Derating Check Helper
// ---------------------------------------------------------------------------

export function deratingCheck(
  ctx: CheckContext,
  domain: ComplianceDomain,
  ruleId: string,
  standardRef: string,
): ComplianceFinding[] {
  const findings: ComplianceFinding[] = [];
  const factors = DERATING_FACTORS[domain];
  const ratings = ctx.params.componentRatings;

  if (!ratings) {
    return findings;
  }

  for (const [componentId, rating] of Object.entries(ratings)) {
    if (rating.maxVoltage && rating.operatingVoltage) {
      const allowedVoltage = rating.maxVoltage * factors.voltage;
      if (rating.operatingVoltage > allowedVoltage) {
        findings.push({
          id: nextFindingId(),
          ruleId,
          domain,
          standardRef,
          severity: 'warning',
          message: `Component "${componentId}" voltage ${rating.operatingVoltage}V exceeds derated limit ${allowedVoltage.toFixed(1)}V (${(factors.voltage * 100).toFixed(0)}% of ${rating.maxVoltage}V max)`,
          remediation: `Reduce operating voltage to below ${allowedVoltage.toFixed(1)}V or select higher-rated component.`,
          componentId,
          componentLabel: componentId,
        });
      }
    }
    if (rating.maxCurrent && rating.operatingCurrent) {
      const allowedCurrent = rating.maxCurrent * factors.current;
      if (rating.operatingCurrent > allowedCurrent) {
        findings.push({
          id: nextFindingId(),
          ruleId,
          domain,
          standardRef,
          severity: 'warning',
          message: `Component "${componentId}" current ${rating.operatingCurrent}A exceeds derated limit ${allowedCurrent.toFixed(2)}A (${(factors.current * 100).toFixed(0)}% of ${rating.maxCurrent}A max)`,
          remediation: `Reduce operating current to below ${allowedCurrent.toFixed(2)}A or select higher-rated component.`,
          componentId,
          componentLabel: componentId,
        });
      }
    }
    if (rating.maxTemperature && rating.operatingTemperature) {
      const allowedTemp = rating.maxTemperature * factors.temperature;
      if (rating.operatingTemperature > allowedTemp) {
        findings.push({
          id: nextFindingId(),
          ruleId,
          domain,
          standardRef,
          severity: 'warning',
          message: `Component "${componentId}" temperature ${rating.operatingTemperature}C exceeds derated limit ${allowedTemp.toFixed(0)}C (${(factors.temperature * 100).toFixed(0)}% of ${rating.maxTemperature}C max)`,
          remediation: `Improve thermal management or select component with higher temperature rating.`,
          componentId,
          componentLabel: componentId,
        });
      }
    }
    if (rating.maxPowerDissipation && rating.operatingPower) {
      const allowedPower = rating.maxPowerDissipation * factors.power;
      if (rating.operatingPower > allowedPower) {
        findings.push({
          id: nextFindingId(),
          ruleId,
          domain,
          standardRef,
          severity: 'warning',
          message: `Component "${componentId}" power ${rating.operatingPower}W exceeds derated limit ${allowedPower.toFixed(2)}W (${(factors.power * 100).toFixed(0)}% of ${rating.maxPowerDissipation}W max)`,
          remediation: `Reduce power dissipation to below ${allowedPower.toFixed(2)}W or select higher-rated component.`,
          componentId,
          componentLabel: componentId,
        });
      }
    }
  }

  return findings;
}

// ---------------------------------------------------------------------------
// Clearance/Creepage Calculator (IEC 60664-1)
// ---------------------------------------------------------------------------

/**
 * Calculate minimum clearance and creepage distances per IEC 60664-1.
 * Uses voltage, pollution degree, and material group.
 */
export function calculateClearanceCreepage(
  voltage: number,
  pollutionDegree: PollutionDegree = 2,
  materialGroup: MaterialGroup = 'II',
): ClearanceCreepageResult {
  // Find applicable clearance from table using interpolation
  const voltageSteps = Object.keys(CLEARANCE_TABLE).map(Number).sort((a, b) => a - b);
  let clearance = 0;

  // Find the next higher voltage step
  const applicableStep = voltageSteps.find((step) => step >= voltage);
  if (applicableStep !== undefined) {
    clearance = CLEARANCE_TABLE[applicableStep][pollutionDegree];
  } else {
    // Above highest table value — extrapolate linearly from last two entries
    const last = voltageSteps[voltageSteps.length - 1];
    const secondLast = voltageSteps[voltageSteps.length - 2];
    const lastClearance = CLEARANCE_TABLE[last][pollutionDegree];
    const secondLastClearance = CLEARANCE_TABLE[secondLast][pollutionDegree];
    const slope = (lastClearance - secondLastClearance) / (last - secondLast);
    clearance = lastClearance + slope * (voltage - last);
  }

  // Creepage = clearance * material group multiplier (minimum)
  const creepage = clearance * CREEPAGE_MULTIPLIER[materialGroup];

  return {
    clearance: Math.round(clearance * 100) / 100,
    creepage: Math.round(creepage * 100) / 100,
    standard: 'IEC 60664-1',
    voltage,
    pollutionDegree,
    materialGroup,
  };
}
