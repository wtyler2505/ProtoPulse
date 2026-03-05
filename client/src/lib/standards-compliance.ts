/**
 * Standards Compliance Checking Engine
 *
 * IEC/ISO/DIN/MIL standards enforcement engine organized by application domain.
 * Goes beyond manufacturer-specific DRC to check designs against regulatory
 * and industry standards requirements.
 *
 * Supported domains:
 *   - Automotive (AEC-Q100/Q101/Q200)
 *   - Medical (IEC 60601)
 *   - Industrial (IEC 61131)
 *   - Consumer (IEC 62368)
 *   - Aerospace (DO-254 / MIL-STD)
 *   - General EMC (IEC 61000)
 *
 * Usage:
 *   const engine = StandardsComplianceEngine.getInstance();
 *   const result = engine.runCheck(nodes, bomItems, params, ['automotive', 'emc']);
 *
 * React hook:
 *   const { runCheck, domains, ... } = useStandardsCompliance();
 */

import { useCallback, useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
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
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'protopulse-standards-compliance';
const MAX_HISTORY = 20;

// ---------------------------------------------------------------------------
// Derating Factors by Domain
// ---------------------------------------------------------------------------

const DERATING_FACTORS: Record<ComplianceDomain, DeratingFactors> = {
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
const CLEARANCE_TABLE: Record<number, Record<PollutionDegree, number>> = {
  50: { 1: 0.04, 2: 0.2, 3: 0.8, 4: 0.8 },
  100: { 1: 0.1, 2: 0.2, 3: 0.8, 4: 0.8 },
  150: { 1: 0.15, 2: 0.5, 3: 0.8, 4: 0.8 },
  300: { 1: 0.5, 2: 1.5, 3: 1.5, 4: 1.5 },
  600: { 1: 1.0, 2: 3.0, 3: 3.0, 4: 3.0 },
  1000: { 1: 1.5, 2: 5.0, 3: 5.5, 4: 5.5 },
};

/** CTI (comparative tracking index) groups for creepage multipliers. */
const CREEPAGE_MULTIPLIER: Record<MaterialGroup, number> = {
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

function isAutomotiveGrade(item: ComplianceBomItem): boolean {
  const searchText = `${item.partNumber} ${item.manufacturer} ${item.description}`.toLowerCase();
  return AUTOMOTIVE_GRADE_INDICATORS.some((indicator) => searchText.includes(indicator));
}

// ---------------------------------------------------------------------------
// Utility: generate a finding ID
// ---------------------------------------------------------------------------

let findingCounter = 0;
function nextFindingId(): string {
  findingCounter++;
  return `SCF-${Date.now()}-${findingCounter}`;
}

// ---------------------------------------------------------------------------
// Built-in Rules
// ---------------------------------------------------------------------------

const BUILTIN_RULES: ComplianceRule[] = [
  // ===== Automotive (AEC-Q) =====
  {
    id: 'AUTO-001',
    domain: 'automotive',
    standardRef: 'AEC-Q100 Rev. J',
    description: 'All ICs must be AEC-Q100 qualified for automotive applications',
    severity: 'violation',
    remediation: 'Replace non-automotive-grade ICs with AEC-Q100 qualified equivalents.',
    check: (ctx) => {
      const findings: ComplianceFinding[] = [];
      ctx.bomItems.forEach((item) => {
        const desc = item.description.toLowerCase();
        const isIC = desc.includes('ic') || desc.includes('microcontroller') || desc.includes('mcu')
          || desc.includes('processor') || desc.includes('memory') || desc.includes('fpga')
          || desc.includes('asic') || desc.includes('op-amp') || desc.includes('adc')
          || desc.includes('dac') || desc.includes('regulator') || desc.includes('driver');
        if (isIC && !isAutomotiveGrade(item)) {
          findings.push({
            id: nextFindingId(),
            ruleId: 'AUTO-001',
            domain: 'automotive',
            standardRef: 'AEC-Q100 Rev. J',
            severity: 'violation',
            message: `IC "${item.partNumber}" (${item.description}) is not AEC-Q100 qualified`,
            remediation: 'Replace with AEC-Q100 qualified equivalent.',
            componentId: String(item.id),
            componentLabel: item.partNumber,
          });
        }
      });
      return findings;
    },
  },
  {
    id: 'AUTO-002',
    domain: 'automotive',
    standardRef: 'AEC-Q101 Rev. E',
    description: 'Discrete semiconductors must be AEC-Q101 qualified',
    severity: 'violation',
    remediation: 'Replace non-automotive-grade discrete semiconductors with AEC-Q101 qualified equivalents.',
    check: (ctx) => {
      const findings: ComplianceFinding[] = [];
      ctx.bomItems.forEach((item) => {
        const desc = item.description.toLowerCase();
        const isDiscrete = desc.includes('diode') || desc.includes('transistor')
          || desc.includes('mosfet') || desc.includes('bjt') || desc.includes('igbt')
          || desc.includes('thyristor') || desc.includes('triac') || desc.includes('scr');
        if (isDiscrete && !isAutomotiveGrade(item)) {
          findings.push({
            id: nextFindingId(),
            ruleId: 'AUTO-002',
            domain: 'automotive',
            standardRef: 'AEC-Q101 Rev. E',
            severity: 'violation',
            message: `Discrete semiconductor "${item.partNumber}" (${item.description}) is not AEC-Q101 qualified`,
            remediation: 'Replace with AEC-Q101 qualified equivalent.',
            componentId: String(item.id),
            componentLabel: item.partNumber,
          });
        }
      });
      return findings;
    },
  },
  {
    id: 'AUTO-003',
    domain: 'automotive',
    standardRef: 'AEC-Q200 Rev. D',
    description: 'Passive components must be AEC-Q200 qualified',
    severity: 'violation',
    remediation: 'Replace non-automotive-grade passive components with AEC-Q200 qualified equivalents.',
    check: (ctx) => {
      const findings: ComplianceFinding[] = [];
      ctx.bomItems.forEach((item) => {
        const desc = item.description.toLowerCase();
        const isPassive = desc.includes('resistor') || desc.includes('capacitor')
          || desc.includes('inductor') || desc.includes('ferrite') || desc.includes('thermistor')
          || desc.includes('fuse') || desc.includes('crystal') || desc.includes('resonator');
        if (isPassive && !isAutomotiveGrade(item)) {
          findings.push({
            id: nextFindingId(),
            ruleId: 'AUTO-003',
            domain: 'automotive',
            standardRef: 'AEC-Q200 Rev. D',
            severity: 'warning',
            message: `Passive component "${item.partNumber}" (${item.description}) is not AEC-Q200 qualified`,
            remediation: 'Replace with AEC-Q200 qualified equivalent or document deviation.',
            componentId: String(item.id),
            componentLabel: item.partNumber,
          });
        }
      });
      return findings;
    },
  },
  {
    id: 'AUTO-004',
    domain: 'automotive',
    standardRef: 'AEC-Q100 Grade 1',
    description: 'Operating temperature range must cover -40C to +125C for Grade 1',
    severity: 'violation',
    remediation: 'Ensure all components rated for -40C to +125C operating temperature.',
    check: (ctx) => {
      const findings: ComplianceFinding[] = [];
      const minTemp = ctx.params.operatingTempMin;
      const maxTemp = ctx.params.operatingTempMax;
      if (minTemp !== undefined && minTemp > -40) {
        findings.push({
          id: nextFindingId(),
          ruleId: 'AUTO-004',
          domain: 'automotive',
          standardRef: 'AEC-Q100 Grade 1',
          severity: 'violation',
          message: `Design minimum temperature ${minTemp}C exceeds Grade 1 requirement of -40C`,
          remediation: 'Select components rated for -40C minimum operating temperature.',
        });
      }
      if (maxTemp !== undefined && maxTemp < 125) {
        findings.push({
          id: nextFindingId(),
          ruleId: 'AUTO-004',
          domain: 'automotive',
          standardRef: 'AEC-Q100 Grade 1',
          severity: 'violation',
          message: `Design maximum temperature ${maxTemp}C is below Grade 1 requirement of +125C`,
          remediation: 'Select components rated for +125C maximum operating temperature.',
        });
      }
      return findings;
    },
  },
  {
    id: 'AUTO-005',
    domain: 'automotive',
    standardRef: 'AEC-Q100 / SAE J1211',
    description: 'Component derating must meet automotive safety margins',
    severity: 'warning',
    remediation: 'Apply automotive derating factors: voltage 70%, current 70%, temperature 80%, power 60%.',
    check: (ctx) => deratingCheck(ctx, 'automotive', 'AUTO-005', 'AEC-Q100 / SAE J1211'),
  },

  // ===== Medical (IEC 60601) =====
  {
    id: 'MED-001',
    domain: 'medical',
    standardRef: 'IEC 60601-1 \u00a78.9.1.1',
    description: 'Creepage distances must meet IEC 60601-1 requirements for patient safety',
    severity: 'violation',
    remediation: 'Increase PCB creepage distances to meet IEC 60601-1 minimum requirements based on working voltage and pollution degree.',
    check: (ctx) => {
      const findings: ComplianceFinding[] = [];
      const voltage = ctx.params.maxVoltage;
      if (voltage === undefined) {
        findings.push({
          id: nextFindingId(),
          ruleId: 'MED-001',
          domain: 'medical',
          standardRef: 'IEC 60601-1 \u00a78.9.1.1',
          severity: 'warning',
          message: 'Maximum voltage not specified — cannot verify creepage distances',
          remediation: 'Specify design maxVoltage parameter for creepage verification.',
        });
        return findings;
      }
      if (voltage > 250) {
        findings.push({
          id: nextFindingId(),
          ruleId: 'MED-001',
          domain: 'medical',
          standardRef: 'IEC 60601-1 \u00a78.9.1.1',
          severity: 'violation',
          message: `Working voltage ${voltage}V exceeds standard 250V threshold — requires reinforced insulation`,
          remediation: 'Apply reinforced insulation or reduce working voltage below 250V.',
        });
      }
      return findings;
    },
  },
  {
    id: 'MED-002',
    domain: 'medical',
    standardRef: 'IEC 60601-1 \u00a78.7.3',
    description: 'Earth leakage current must not exceed 0.5 mA under normal conditions',
    severity: 'violation',
    remediation: 'Reduce earth leakage current to below 0.5 mA. Consider adding leakage current limiting circuits.',
    check: (ctx) => {
      const findings: ComplianceFinding[] = [];
      if (ctx.params.isSafetyGrounded === false) {
        findings.push({
          id: nextFindingId(),
          ruleId: 'MED-002',
          domain: 'medical',
          standardRef: 'IEC 60601-1 \u00a78.7.3',
          severity: 'violation',
          message: 'Medical device without safety ground — Class II insulation required throughout',
          remediation: 'Implement double or reinforced insulation for all accessible parts.',
        });
      }
      return findings;
    },
  },
  {
    id: 'MED-003',
    domain: 'medical',
    standardRef: 'IEC 60601-1 \u00a78.5.2',
    description: 'Isolation between patient-applied parts and mains must meet 2xMOPP or 1xMOOP',
    severity: 'violation',
    remediation: 'Ensure adequate isolation barriers between mains and patient-connected circuits. Use medical-grade isolation transformers or optocouplers.',
    check: (ctx) => {
      const findings: ComplianceFinding[] = [];
      const hasIsolation = ctx.nodes.some((n) => {
        const label = n.label.toLowerCase();
        return label.includes('isolation') || label.includes('isolator')
          || label.includes('optocoupler') || label.includes('transformer');
      });
      const voltage = ctx.params.maxVoltage ?? 0;
      if (voltage > 30 && !hasIsolation) {
        findings.push({
          id: nextFindingId(),
          ruleId: 'MED-003',
          domain: 'medical',
          standardRef: 'IEC 60601-1 \u00a78.5.2',
          severity: 'violation',
          message: 'No isolation barrier detected in design with voltage > 30V — patient safety risk',
          remediation: 'Add isolation barrier (transformer, optocoupler, or isolated DC-DC converter).',
        });
      }
      return findings;
    },
  },
  {
    id: 'MED-004',
    domain: 'medical',
    standardRef: 'IEC 60601-1 \u00a711.6',
    description: 'Biocompatibility of enclosure materials must be considered for patient-contact devices',
    severity: 'recommendation',
    remediation: 'Document biocompatibility assessment per ISO 10993 for all patient-contacting materials.',
    check: (ctx) => {
      const findings: ComplianceFinding[] = [];
      if (ctx.params.hasTouchableMetalParts) {
        findings.push({
          id: nextFindingId(),
          ruleId: 'MED-004',
          domain: 'medical',
          standardRef: 'IEC 60601-1 \u00a711.6 / ISO 10993',
          severity: 'recommendation',
          message: 'Design has touchable metal parts — biocompatibility assessment recommended',
          remediation: 'Perform ISO 10993 biocompatibility testing for patient-contacting materials.',
        });
      }
      return findings;
    },
  },
  {
    id: 'MED-005',
    domain: 'medical',
    standardRef: 'IEC 60601-1 / MDD',
    description: 'Component derating must meet medical safety margins',
    severity: 'warning',
    remediation: 'Apply medical derating factors: voltage 60%, current 60%, temperature 75%, power 50%.',
    check: (ctx) => deratingCheck(ctx, 'medical', 'MED-005', 'IEC 60601-1 / MDD'),
  },

  // ===== Industrial (IEC 61131) =====
  {
    id: 'IND-001',
    domain: 'industrial',
    standardRef: 'IEC 61131-2 \u00a74.3',
    description: 'I/O modules must have adequate protection against overvoltage and overcurrent',
    severity: 'warning',
    remediation: 'Add TVS diodes, fuses, or current limiting circuits to all I/O interfaces.',
    check: (ctx) => {
      const findings: ComplianceFinding[] = [];
      const hasIO = ctx.nodes.some((n) => {
        const label = n.label.toLowerCase();
        return label.includes('input') || label.includes('output') || label.includes('i/o')
          || label.includes('gpio') || label.includes('sensor') || label.includes('actuator');
      });
      const hasProtection = ctx.nodes.some((n) => {
        const label = n.label.toLowerCase();
        return label.includes('tvs') || label.includes('protection') || label.includes('fuse')
          || label.includes('ptc') || label.includes('varistor') || label.includes('esd');
      });
      if (hasIO && !hasProtection) {
        findings.push({
          id: nextFindingId(),
          ruleId: 'IND-001',
          domain: 'industrial',
          standardRef: 'IEC 61131-2 \u00a74.3',
          severity: 'warning',
          message: 'I/O interfaces detected without apparent overvoltage/overcurrent protection',
          remediation: 'Add TVS diodes, fuses, or current limiting circuits to all I/O interfaces.',
        });
      }
      return findings;
    },
  },
  {
    id: 'IND-002',
    domain: 'industrial',
    standardRef: 'IEC 61131-2 \u00a74.4.1',
    description: 'Operating temperature range must cover 0C to +55C for standard industrial equipment',
    severity: 'violation',
    remediation: 'Ensure all components rated for 0C to +55C minimum operating temperature range.',
    check: (ctx) => {
      const findings: ComplianceFinding[] = [];
      const minTemp = ctx.params.operatingTempMin;
      const maxTemp = ctx.params.operatingTempMax;
      if (minTemp !== undefined && minTemp > 0) {
        findings.push({
          id: nextFindingId(),
          ruleId: 'IND-002',
          domain: 'industrial',
          standardRef: 'IEC 61131-2 \u00a74.4.1',
          severity: 'violation',
          message: `Minimum operating temperature ${minTemp}C exceeds industrial requirement of 0C`,
          remediation: 'Select components rated for at least 0C minimum operating temperature.',
        });
      }
      if (maxTemp !== undefined && maxTemp < 55) {
        findings.push({
          id: nextFindingId(),
          ruleId: 'IND-002',
          domain: 'industrial',
          standardRef: 'IEC 61131-2 \u00a74.4.1',
          severity: 'violation',
          message: `Maximum operating temperature ${maxTemp}C is below industrial requirement of +55C`,
          remediation: 'Select components rated for at least +55C maximum operating temperature.',
        });
      }
      return findings;
    },
  },
  {
    id: 'IND-003',
    domain: 'industrial',
    standardRef: 'IEC 61131-2 \u00a74.6',
    description: 'EMC performance must meet industrial immunity levels per IEC 61000-6-2',
    severity: 'warning',
    remediation: 'Ensure design includes adequate EMI filtering and shielding for industrial environments.',
    check: (ctx) => {
      const findings: ComplianceFinding[] = [];
      const hasEMCProtection = ctx.nodes.some((n) => {
        const label = n.label.toLowerCase();
        return label.includes('filter') || label.includes('shield') || label.includes('ferrite')
          || label.includes('emc') || label.includes('emi');
      });
      if (!hasEMCProtection) {
        findings.push({
          id: nextFindingId(),
          ruleId: 'IND-003',
          domain: 'industrial',
          standardRef: 'IEC 61131-2 \u00a74.6 / IEC 61000-6-2',
          severity: 'warning',
          message: 'No EMC filtering or shielding components detected in design',
          remediation: 'Add EMI filters, ferrite beads, and/or shielding to meet IEC 61000-6-2 immunity levels.',
        });
      }
      return findings;
    },
  },
  {
    id: 'IND-004',
    domain: 'industrial',
    standardRef: 'IEC 61131-2 \u00a74.7',
    description: 'MTBF target should meet industrial reliability requirements',
    severity: 'recommendation',
    remediation: 'Perform reliability analysis and ensure MTBF target of > 50,000 hours for industrial equipment.',
    check: (ctx) => {
      const findings: ComplianceFinding[] = [];
      if (ctx.params.expectedLifetimeHours !== undefined && ctx.params.expectedLifetimeHours < 50000) {
        findings.push({
          id: nextFindingId(),
          ruleId: 'IND-004',
          domain: 'industrial',
          standardRef: 'IEC 61131-2 \u00a74.7',
          severity: 'recommendation',
          message: `Expected lifetime ${ctx.params.expectedLifetimeHours}h is below typical industrial MTBF target of 50,000h`,
          remediation: 'Consider higher-reliability components and thermal derating to improve MTBF.',
        });
      }
      return findings;
    },
  },
  {
    id: 'IND-005',
    domain: 'industrial',
    standardRef: 'IEC 61131-2',
    description: 'Component derating must meet industrial safety margins',
    severity: 'warning',
    remediation: 'Apply industrial derating factors: voltage 75%, current 75%, temperature 85%, power 65%.',
    check: (ctx) => deratingCheck(ctx, 'industrial', 'IND-005', 'IEC 61131-2'),
  },

  // ===== Consumer (IEC 62368) =====
  {
    id: 'CON-001',
    domain: 'consumer',
    standardRef: 'IEC 62368-1 \u00a76.4',
    description: 'Safety distances must meet IEC 62368-1 requirements for consumer AV/IT equipment',
    severity: 'violation',
    remediation: 'Ensure creepage and clearance distances meet IEC 62368-1 Table 16/17 for the working voltage.',
    check: (ctx) => {
      const findings: ComplianceFinding[] = [];
      const voltage = ctx.params.maxVoltage;
      if (voltage !== undefined && voltage > 42.4) {
        findings.push({
          id: nextFindingId(),
          ruleId: 'CON-001',
          domain: 'consumer',
          standardRef: 'IEC 62368-1 \u00a76.4',
          severity: 'violation',
          message: `Working voltage ${voltage}V exceeds ES1 limit (42.4V DC) — hazardous energy source classification required`,
          remediation: 'Implement safeguards per IEC 62368-1 for ES2 or ES3 energy sources.',
        });
      }
      return findings;
    },
  },
  {
    id: 'CON-002',
    domain: 'consumer',
    standardRef: 'IEC 62368-1 \u00a7G.3 / UL 94',
    description: 'Enclosure materials must meet UL 94 V-1 or V-0 flammability rating',
    severity: 'violation',
    remediation: 'Specify UL 94 V-0 or V-1 rated materials for enclosure and PCB substrate.',
    check: (ctx) => {
      const findings: ComplianceFinding[] = [];
      // Always a relevant recommendation for consumer products
      findings.push({
        id: nextFindingId(),
        ruleId: 'CON-002',
        domain: 'consumer',
        standardRef: 'IEC 62368-1 \u00a7G.3 / UL 94',
        severity: 'recommendation',
        message: 'Verify enclosure and PCB materials meet UL 94 V-0 or V-1 flammability rating',
        remediation: 'Use FR-4 or higher rated PCB substrate. Specify UL 94 V-0 rated enclosure materials.',
      });
      return findings;
    },
  },
  {
    id: 'CON-003',
    domain: 'consumer',
    standardRef: 'IEC 62368-1 \u00a76.2',
    description: 'Energy hazard classification must be determined for all circuits',
    severity: 'warning',
    remediation: 'Classify all circuits as ES1, ES2, or ES3. Apply appropriate safeguards per classification.',
    check: (ctx) => {
      const findings: ComplianceFinding[] = [];
      const voltage = ctx.params.maxVoltage ?? 0;
      const current = ctx.params.maxCurrent ?? 0;
      if (voltage > 60 || current > 2) {
        findings.push({
          id: nextFindingId(),
          ruleId: 'CON-003',
          domain: 'consumer',
          standardRef: 'IEC 62368-1 \u00a76.2',
          severity: 'warning',
          message: `Design parameters (${voltage}V, ${current}A) may classify as ES3 hazardous energy source`,
          remediation: 'Implement ES3 safeguards: operator access restricted, basic + supplementary insulation.',
        });
      } else if (voltage > 42.4 || current > 0.25) {
        findings.push({
          id: nextFindingId(),
          ruleId: 'CON-003',
          domain: 'consumer',
          standardRef: 'IEC 62368-1 \u00a76.2',
          severity: 'warning',
          message: `Design parameters (${voltage}V, ${current}A) classify as ES2 energy source`,
          remediation: 'Implement ES2 safeguards: basic insulation, fusing, and limited accessible energy.',
        });
      }
      return findings;
    },
  },
  {
    id: 'CON-004',
    domain: 'consumer',
    standardRef: 'IEC 62368-1',
    description: 'Component derating must meet consumer safety margins',
    severity: 'warning',
    remediation: 'Apply consumer derating factors: voltage 80%, current 80%, temperature 90%, power 75%.',
    check: (ctx) => deratingCheck(ctx, 'consumer', 'CON-004', 'IEC 62368-1'),
  },

  // ===== Aerospace (DO-254 / MIL-STD) =====
  {
    id: 'AERO-001',
    domain: 'aerospace',
    standardRef: 'DO-254 DAL A-C',
    description: 'Complex electronic hardware must follow DO-254 design assurance process',
    severity: 'violation',
    remediation: 'Implement DO-254 design assurance per the assigned Design Assurance Level (DAL).',
    check: (ctx) => {
      const findings: ComplianceFinding[] = [];
      const hasFPGA = ctx.bomItems.some((item) => {
        const desc = item.description.toLowerCase();
        return desc.includes('fpga') || desc.includes('cpld') || desc.includes('asic');
      });
      if (hasFPGA) {
        findings.push({
          id: nextFindingId(),
          ruleId: 'AERO-001',
          domain: 'aerospace',
          standardRef: 'DO-254 DAL A-C',
          severity: 'violation',
          message: 'FPGA/CPLD/ASIC detected — DO-254 design assurance process required',
          remediation: 'Follow DO-254 lifecycle: planning, design, verification, configuration management.',
        });
      }
      return findings;
    },
  },
  {
    id: 'AERO-002',
    domain: 'aerospace',
    standardRef: 'MIL-STD-883 / MIL-PRF-38535',
    description: 'Components must be radiation-tolerant or radiation-hardened for space applications',
    severity: 'warning',
    remediation: 'Specify radiation-tolerant or radiation-hardened (RadHard) components. Document total ionizing dose (TID) and single-event effects (SEE) requirements.',
    check: (ctx) => {
      const findings: ComplianceFinding[] = [];
      if (ctx.bomItems.length > 0) {
        const hasRadHard = ctx.bomItems.some((item) => {
          const text = `${item.partNumber} ${item.description}`.toLowerCase();
          return text.includes('rad') || text.includes('radiation') || text.includes('mil-prf')
            || text.includes('mil-std') || text.includes('space');
        });
        if (!hasRadHard) {
          findings.push({
            id: nextFindingId(),
            ruleId: 'AERO-002',
            domain: 'aerospace',
            standardRef: 'MIL-STD-883 / MIL-PRF-38535',
            severity: 'warning',
            message: 'No radiation-tolerant components detected — document radiation analysis for aerospace use',
            remediation: 'Perform radiation analysis (TID, SEE). Specify RadHard components or document mitigation.',
          });
        }
      }
      return findings;
    },
  },
  {
    id: 'AERO-003',
    domain: 'aerospace',
    standardRef: 'MIL-STD-810H Method 514',
    description: 'Design must account for vibration and shock requirements',
    severity: 'recommendation',
    remediation: 'Perform vibration analysis. Use conformal coating, staking, and mechanical retention for components.',
    check: (ctx) => {
      const findings: ComplianceFinding[] = [];
      const hasMechanicalProtection = ctx.nodes.some((n) => {
        const label = n.label.toLowerCase();
        return label.includes('conformal') || label.includes('staking')
          || label.includes('potting') || label.includes('vibration');
      });
      if (!hasMechanicalProtection) {
        findings.push({
          id: nextFindingId(),
          ruleId: 'AERO-003',
          domain: 'aerospace',
          standardRef: 'MIL-STD-810H Method 514',
          severity: 'recommendation',
          message: 'No vibration/shock protection measures detected in design',
          remediation: 'Add conformal coating, component staking, and/or potting for vibration/shock resilience.',
        });
      }
      return findings;
    },
  },
  {
    id: 'AERO-004',
    domain: 'aerospace',
    standardRef: 'ITAR / EAR',
    description: 'Export control classification must be documented for all components',
    severity: 'recommendation',
    remediation: 'Document ECCN (Export Control Classification Number) for each component. Flag ITAR-controlled items.',
    check: (ctx) => {
      const findings: ComplianceFinding[] = [];
      if (ctx.bomItems.length > 0) {
        findings.push({
          id: nextFindingId(),
          ruleId: 'AERO-004',
          domain: 'aerospace',
          standardRef: 'ITAR / EAR',
          severity: 'recommendation',
          message: 'Export control classification should be documented for aerospace designs',
          remediation: 'Document ECCN for each BOM component. Flag any ITAR-controlled items.',
        });
      }
      return findings;
    },
  },
  {
    id: 'AERO-005',
    domain: 'aerospace',
    standardRef: 'MIL-HDBK-217F / DO-254',
    description: 'Component derating must meet aerospace safety margins',
    severity: 'warning',
    remediation: 'Apply aerospace derating factors: voltage 50%, current 50%, temperature 70%, power 40%.',
    check: (ctx) => deratingCheck(ctx, 'aerospace', 'AERO-005', 'MIL-HDBK-217F / DO-254'),
  },
  {
    id: 'AERO-006',
    domain: 'aerospace',
    standardRef: 'MIL-STD-883',
    description: 'Operating temperature range must cover -55C to +125C for MIL-grade',
    severity: 'violation',
    remediation: 'Ensure all components rated for -55C to +125C operating temperature.',
    check: (ctx) => {
      const findings: ComplianceFinding[] = [];
      const minTemp = ctx.params.operatingTempMin;
      const maxTemp = ctx.params.operatingTempMax;
      if (minTemp !== undefined && minTemp > -55) {
        findings.push({
          id: nextFindingId(),
          ruleId: 'AERO-006',
          domain: 'aerospace',
          standardRef: 'MIL-STD-883',
          severity: 'violation',
          message: `Minimum operating temperature ${minTemp}C exceeds MIL requirement of -55C`,
          remediation: 'Select MIL-grade components rated for -55C minimum.',
        });
      }
      if (maxTemp !== undefined && maxTemp < 125) {
        findings.push({
          id: nextFindingId(),
          ruleId: 'AERO-006',
          domain: 'aerospace',
          standardRef: 'MIL-STD-883',
          severity: 'violation',
          message: `Maximum operating temperature ${maxTemp}C is below MIL requirement of +125C`,
          remediation: 'Select MIL-grade components rated for +125C maximum.',
        });
      }
      return findings;
    },
  },

  // ===== General EMC (IEC 61000) =====
  {
    id: 'EMC-001',
    domain: 'emc',
    standardRef: 'IEC 61000-6-3 (residential) / IEC 61000-6-4 (industrial)',
    description: 'Emissions must meet the applicable EMC emissions standard for the target environment',
    severity: 'warning',
    remediation: 'Add EMI filters on power supply inputs and decoupling capacitors near ICs. Consider shielding for high-frequency circuits.',
    check: (ctx) => {
      const findings: ComplianceFinding[] = [];
      const hasDecoupling = ctx.bomItems.some((item) => {
        const desc = item.description.toLowerCase();
        return desc.includes('decoupling') || desc.includes('bypass') || desc.includes('100nf')
          || desc.includes('0.1uf') || desc.includes('100n');
      });
      if (!hasDecoupling) {
        findings.push({
          id: nextFindingId(),
          ruleId: 'EMC-001',
          domain: 'emc',
          standardRef: 'IEC 61000-6-3/4',
          severity: 'warning',
          message: 'No decoupling/bypass capacitors detected in BOM — EMC emissions risk',
          remediation: 'Add 100nF decoupling capacitors near each IC power pin. Add bulk capacitors on power rails.',
        });
      }
      return findings;
    },
  },
  {
    id: 'EMC-002',
    domain: 'emc',
    standardRef: 'IEC 61000-4-2',
    description: 'ESD protection must meet IEC 61000-4-2 requirements (4kV contact, 8kV air)',
    severity: 'warning',
    remediation: 'Add ESD protection (TVS diodes) on all external-facing connectors and I/O lines.',
    check: (ctx) => {
      const findings: ComplianceFinding[] = [];
      const hasESD = ctx.bomItems.some((item) => {
        const desc = item.description.toLowerCase();
        return desc.includes('esd') || desc.includes('tvs');
      }) || ctx.nodes.some((n) => {
        const label = n.label.toLowerCase();
        return label.includes('esd') || label.includes('tvs');
      });
      const hasExternalIO = ctx.nodes.some((n) => {
        const label = n.label.toLowerCase();
        return label.includes('connector') || label.includes('usb') || label.includes('uart')
          || label.includes('spi') || label.includes('i2c') || label.includes('ethernet')
          || label.includes('can') || label.includes('rs-485') || label.includes('rs-232');
      });
      if (hasExternalIO && !hasESD) {
        findings.push({
          id: nextFindingId(),
          ruleId: 'EMC-002',
          domain: 'emc',
          standardRef: 'IEC 61000-4-2',
          severity: 'warning',
          message: 'External I/O interfaces detected without ESD protection components',
          remediation: 'Add ESD protection (TVS diodes) on all external-facing connectors and I/O lines.',
        });
      }
      return findings;
    },
  },
  {
    id: 'EMC-003',
    domain: 'emc',
    standardRef: 'IEC 61000-4-4',
    description: 'Electrical fast transient (EFT) immunity required on power and signal ports',
    severity: 'recommendation',
    remediation: 'Add ferrite beads and capacitor filters on power and signal cable entries.',
    check: (ctx) => {
      const findings: ComplianceFinding[] = [];
      const hasFerrite = ctx.bomItems.some((item) => {
        const desc = item.description.toLowerCase();
        return desc.includes('ferrite') || desc.includes('bead') || desc.includes('common mode choke');
      });
      if (!hasFerrite) {
        findings.push({
          id: nextFindingId(),
          ruleId: 'EMC-003',
          domain: 'emc',
          standardRef: 'IEC 61000-4-4',
          severity: 'recommendation',
          message: 'No ferrite beads or common mode chokes detected — EFT immunity may be insufficient',
          remediation: 'Add ferrite beads on power inputs and common mode chokes on signal cables.',
        });
      }
      return findings;
    },
  },
  {
    id: 'EMC-004',
    domain: 'emc',
    standardRef: 'IEC 61000-4-5',
    description: 'Surge protection required for equipment connected to AC mains or outdoor cabling',
    severity: 'warning',
    remediation: 'Add surge protection (MOVs, GDTs, TVS) on AC power input and external cable connections.',
    check: (ctx) => {
      const findings: ComplianceFinding[] = [];
      const voltage = ctx.params.maxVoltage ?? 0;
      const hasSurge = ctx.bomItems.some((item) => {
        const desc = item.description.toLowerCase();
        return desc.includes('mov') || desc.includes('varistor') || desc.includes('gdt')
          || desc.includes('gas discharge') || desc.includes('surge');
      });
      if (voltage > 48 && !hasSurge) {
        findings.push({
          id: nextFindingId(),
          ruleId: 'EMC-004',
          domain: 'emc',
          standardRef: 'IEC 61000-4-5',
          severity: 'warning',
          message: `Design operates at ${voltage}V without surge protection components`,
          remediation: 'Add MOVs or GDTs on power inputs. Add TVS diodes on signal lines.',
        });
      }
      return findings;
    },
  },
  {
    id: 'EMC-005',
    domain: 'emc',
    standardRef: 'IEC 61000-6-1/3 (Class B) / IEC 61000-6-2/4 (Class A)',
    description: 'EMC class must be determined and design must meet applicable limits',
    severity: 'recommendation',
    remediation: 'Determine EMC class (residential=Class B, commercial/industrial=Class A). Design to applicable limits.',
    check: (ctx) => {
      const findings: ComplianceFinding[] = [];
      const emcClass = ctx.params.emcClass;
      if (!emcClass) {
        findings.push({
          id: nextFindingId(),
          ruleId: 'EMC-005',
          domain: 'emc',
          standardRef: 'IEC 61000-6-1 through 6-4',
          severity: 'recommendation',
          message: 'EMC class not specified — cannot determine applicable emissions/immunity limits',
          remediation: 'Specify emcClass parameter (residential, commercial, or industrial).',
        });
      } else if (emcClass === 'residential') {
        findings.push({
          id: nextFindingId(),
          ruleId: 'EMC-005',
          domain: 'emc',
          standardRef: 'IEC 61000-6-1/3 (Class B)',
          severity: 'recommendation',
          message: 'Residential/Class B equipment — stricter emissions limits apply',
          remediation: 'Design to Class B (residential) limits per IEC 61000-6-3. Consider EMI pre-compliance testing.',
        });
      }
      return findings;
    },
  },
];

// ---------------------------------------------------------------------------
// Derating Check Helper
// ---------------------------------------------------------------------------

function deratingCheck(
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

// ---------------------------------------------------------------------------
// Listener type
// ---------------------------------------------------------------------------

type Listener = () => void;

// ---------------------------------------------------------------------------
// Persisted data shape
// ---------------------------------------------------------------------------

interface PersistedData {
  selectedDomains: ComplianceDomain[];
  customRules: ComplianceRule[];
  history: ComplianceCheckResult[];
}

// Serializable form (check functions become strings)
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

// ---------------------------------------------------------------------------
// StandardsComplianceEngine
// ---------------------------------------------------------------------------

export class StandardsComplianceEngine {
  private static instance: StandardsComplianceEngine | null = null;

  private selectedDomains: ComplianceDomain[] = [];
  private customRules: ComplianceRule[] = [];
  private history: ComplianceCheckResult[] = [];
  private listeners = new Set<Listener>();

  constructor() {
    this.load();
  }

  static getInstance(): StandardsComplianceEngine {
    if (!StandardsComplianceEngine.instance) {
      StandardsComplianceEngine.instance = new StandardsComplianceEngine();
    }
    return StandardsComplianceEngine.instance;
  }

  static resetForTesting(): void {
    StandardsComplianceEngine.instance = null;
  }

  // -----------------------------------------------------------------------
  // Subscription
  // -----------------------------------------------------------------------

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    this.listeners.forEach((l) => {
      l();
    });
  }

  // -----------------------------------------------------------------------
  // Domain Management
  // -----------------------------------------------------------------------

  getAvailableDomains(): ComplianceDomain[] {
    return ['automotive', 'medical', 'industrial', 'consumer', 'aerospace', 'emc'];
  }

  getSelectedDomains(): ComplianceDomain[] {
    return [...this.selectedDomains];
  }

  setSelectedDomains(domains: ComplianceDomain[]): void {
    this.selectedDomains = [...domains];
    this.save();
    this.notify();
  }

  // -----------------------------------------------------------------------
  // Rule Management
  // -----------------------------------------------------------------------

  getBuiltinRules(): ComplianceRule[] {
    return [...BUILTIN_RULES];
  }

  getCustomRules(): ComplianceRule[] {
    return [...this.customRules];
  }

  getAllRules(): ComplianceRule[] {
    return [...BUILTIN_RULES, ...this.customRules];
  }

  getRulesForDomains(domains: ComplianceDomain[]): ComplianceRule[] {
    const domainSet = new Set(domains);
    return this.getAllRules().filter((r) => domainSet.has(r.domain));
  }

  addCustomRule(rule: ComplianceRule): void {
    // Overwrite if same id exists
    this.customRules = this.customRules.filter((r) => r.id !== rule.id);
    this.customRules.push(rule);
    this.save();
    this.notify();
  }

  removeCustomRule(id: string): boolean {
    const len = this.customRules.length;
    this.customRules = this.customRules.filter((r) => r.id !== id);
    if (this.customRules.length < len) {
      this.save();
      this.notify();
      return true;
    }
    return false;
  }

  // -----------------------------------------------------------------------
  // Compliance Checking
  // -----------------------------------------------------------------------

  runCheck(
    nodes: ComplianceNode[],
    bomItems: ComplianceBomItem[],
    params: DesignParameters,
    domains?: ComplianceDomain[],
  ): ComplianceCheckResult {
    const activeDomains = domains ?? this.selectedDomains;
    const rules = this.getRulesForDomains(activeDomains);

    const ctx: CheckContext = { nodes, bomItems, params, domains: activeDomains };
    const allFindings: ComplianceFinding[] = [];
    let totalChecks = 0;

    rules.forEach((rule) => {
      totalChecks++;
      try {
        const findings = rule.check(ctx);
        allFindings.push(...findings);
      } catch {
        allFindings.push({
          id: nextFindingId(),
          ruleId: rule.id,
          domain: rule.domain,
          standardRef: rule.standardRef,
          severity: 'warning',
          message: `Rule ${rule.id} failed to execute`,
          remediation: 'Check custom rule implementation.',
        });
      }
    });

    const violations = allFindings.filter((f) => f.severity === 'violation').length;
    const warnings = allFindings.filter((f) => f.severity === 'warning').length;
    const recommendations = allFindings.filter((f) => f.severity === 'recommendation').length;

    // Build per-domain summary
    const byDomain: Record<string, { violations: number; warnings: number; recommendations: number; passed: boolean }> = {};
    for (const domain of activeDomains) {
      const domainFindings = allFindings.filter((f) => f.domain === domain);
      const dv = domainFindings.filter((f) => f.severity === 'violation').length;
      const dw = domainFindings.filter((f) => f.severity === 'warning').length;
      const dr = domainFindings.filter((f) => f.severity === 'recommendation').length;
      byDomain[domain] = { violations: dv, warnings: dw, recommendations: dr, passed: dv === 0 };
    }

    const result: ComplianceCheckResult = {
      timestamp: Date.now(),
      domains: [...activeDomains],
      findings: allFindings,
      passed: violations === 0,
      summary: {
        violations,
        warnings,
        recommendations,
        totalChecks,
        byDomain,
      },
    };

    this.history.push(result);
    if (this.history.length > MAX_HISTORY) {
      this.history = this.history.slice(-MAX_HISTORY);
    }
    this.save();
    this.notify();

    return result;
  }

  // -----------------------------------------------------------------------
  // Derating Calculator
  // -----------------------------------------------------------------------

  getDeratingFactors(domain: ComplianceDomain): DeratingFactors {
    return { ...DERATING_FACTORS[domain] };
  }

  checkDerating(
    componentId: string,
    rating: ComponentRating,
    domain: ComplianceDomain,
  ): ComplianceFinding[] {
    const ctx: CheckContext = {
      nodes: [],
      bomItems: [],
      params: { componentRatings: { [componentId]: rating } },
      domains: [domain],
    };
    const factors = DERATING_FACTORS[domain];
    const ruleId = `DERATE-${domain.toUpperCase()}`;
    const findings = deratingCheck(ctx, domain, ruleId, `Derating per ${domain}`);
    if (findings.length === 0) {
      // All within limits — return empty
    }
    // Also return a pass summary if all within limits is implicit (empty = pass)
    return findings.length > 0 ? findings : [];
  }

  // -----------------------------------------------------------------------
  // Clearance/Creepage
  // -----------------------------------------------------------------------

  calculateClearanceCreepage(
    voltage: number,
    pollutionDegree?: PollutionDegree,
    materialGroup?: MaterialGroup,
  ): ClearanceCreepageResult {
    return calculateClearanceCreepage(voltage, pollutionDegree, materialGroup);
  }

  // -----------------------------------------------------------------------
  // History
  // -----------------------------------------------------------------------

  getCheckHistory(): ComplianceCheckResult[] {
    return [...this.history];
  }

  clearHistory(): void {
    this.history = [];
    this.save();
    this.notify();
  }

  // -----------------------------------------------------------------------
  // Report Generation
  // -----------------------------------------------------------------------

  generateReport(result: ComplianceCheckResult): string {
    const lines: string[] = [];
    lines.push('# Standards Compliance Report');
    lines.push('');
    lines.push(`**Date:** ${new Date(result.timestamp).toISOString()}`);
    lines.push(`**Domains:** ${result.domains.join(', ')}`);
    lines.push(`**Overall Status:** ${result.passed ? 'PASSED' : 'FAILED'}`);
    lines.push('');

    lines.push('## Summary');
    lines.push('');
    lines.push('| Metric | Value |');
    lines.push('|--------|-------|');
    lines.push(`| Total Rules Checked | ${result.summary.totalChecks} |`);
    lines.push(`| Violations | ${result.summary.violations} |`);
    lines.push(`| Warnings | ${result.summary.warnings} |`);
    lines.push(`| Recommendations | ${result.summary.recommendations} |`);
    lines.push('');

    lines.push('## Domain Results');
    lines.push('');
    lines.push('| Domain | Status | Violations | Warnings | Recommendations |');
    lines.push('|--------|--------|------------|----------|-----------------|');
    for (const domain of result.domains) {
      const d = result.summary.byDomain[domain];
      if (d) {
        lines.push(`| ${domain} | ${d.passed ? 'PASS' : 'FAIL'} | ${d.violations} | ${d.warnings} | ${d.recommendations} |`);
      }
    }
    lines.push('');

    if (result.findings.length > 0) {
      lines.push('## Findings');
      lines.push('');

      // Group by domain
      for (const domain of result.domains) {
        const domainFindings = result.findings.filter((f) => f.domain === domain);
        if (domainFindings.length === 0) {
          continue;
        }
        lines.push(`### ${domain.charAt(0).toUpperCase() + domain.slice(1)}`);
        lines.push('');
        lines.push('| Severity | Rule | Standard | Message | Remediation |');
        lines.push('|----------|------|----------|---------|-------------|');
        domainFindings.forEach((f) => {
          lines.push(`| ${f.severity.toUpperCase()} | ${f.ruleId} | ${f.standardRef} | ${f.message} | ${f.remediation} |`);
        });
        lines.push('');
      }
    } else {
      lines.push('No findings. Design meets all checked standards.');
      lines.push('');
    }

    return lines.join('\n');
  }

  // -----------------------------------------------------------------------
  // JSON Export/Import
  // -----------------------------------------------------------------------

  exportRulesJSON(): string {
    const serialized: SerializedRule[] = this.customRules.map((r) => ({
      id: r.id,
      domain: r.domain,
      standardRef: r.standardRef,
      description: r.description,
      severity: r.severity,
      checkBody: r.check.toString(),
      remediation: r.remediation,
    }));
    return JSON.stringify(serialized, null, 2);
  }

  importRulesJSON(json: string): number {
    const parsed: unknown = JSON.parse(json);
    if (!Array.isArray(parsed)) {
      throw new Error('Expected a JSON array of rule definitions');
    }
    let imported = 0;
    for (const entry of parsed) {
      if (
        typeof entry === 'object' && entry !== null
        && typeof (entry as SerializedRule).id === 'string'
        && typeof (entry as SerializedRule).domain === 'string'
        && typeof (entry as SerializedRule).standardRef === 'string'
        && typeof (entry as SerializedRule).description === 'string'
        && typeof (entry as SerializedRule).severity === 'string'
        && typeof (entry as SerializedRule).remediation === 'string'
      ) {
        const sr = entry as SerializedRule;
        const validDomains: ComplianceDomain[] = ['automotive', 'medical', 'industrial', 'consumer', 'aerospace', 'emc'];
        const validSeverities: ComplianceSeverity[] = ['violation', 'warning', 'recommendation'];
        if (!validDomains.includes(sr.domain as ComplianceDomain)) {
          continue;
        }
        if (!validSeverities.includes(sr.severity as ComplianceSeverity)) {
          continue;
        }

        // Create a simple check that always returns an empty array for imported rules
        // (the check body is preserved as metadata but not executed for safety)
        const rule: ComplianceRule = {
          id: sr.id,
          domain: sr.domain as ComplianceDomain,
          standardRef: sr.standardRef,
          description: sr.description,
          severity: sr.severity as ComplianceSeverity,
          remediation: sr.remediation,
          check: () => [],
        };
        this.customRules = this.customRules.filter((r) => r.id !== rule.id);
        this.customRules.push(rule);
        imported++;
      }
    }

    if (imported > 0) {
      this.save();
      this.notify();
    }
    return imported;
  }

  // -----------------------------------------------------------------------
  // Persistence
  // -----------------------------------------------------------------------

  private save(): void {
    try {
      if (typeof window === 'undefined') {
        return;
      }
      const data: SerializedPersistedData = {
        selectedDomains: this.selectedDomains,
        customRules: this.customRules.map((r) => ({
          id: r.id,
          domain: r.domain,
          standardRef: r.standardRef,
          description: r.description,
          severity: r.severity,
          checkBody: r.check.toString(),
          remediation: r.remediation,
        })),
        history: this.history,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // localStorage may be unavailable or quota exceeded
    }
  }

  private load(): void {
    try {
      if (typeof window === 'undefined') {
        return;
      }
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return;
      }
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed !== 'object' || parsed === null) {
        return;
      }

      const data = parsed as SerializedPersistedData;

      if (Array.isArray(data.selectedDomains)) {
        const validDomains: ComplianceDomain[] = ['automotive', 'medical', 'industrial', 'consumer', 'aerospace', 'emc'];
        this.selectedDomains = data.selectedDomains.filter((d: unknown) =>
          typeof d === 'string' && validDomains.includes(d as ComplianceDomain),
        ) as ComplianceDomain[];
      }

      if (Array.isArray(data.customRules)) {
        this.customRules = data.customRules
          .filter((sr: unknown): sr is SerializedRule =>
            typeof sr === 'object' && sr !== null
            && typeof (sr as SerializedRule).id === 'string'
            && typeof (sr as SerializedRule).domain === 'string'
          )
          .map((sr) => ({
            id: sr.id,
            domain: sr.domain,
            standardRef: sr.standardRef,
            description: sr.description,
            severity: sr.severity,
            remediation: sr.remediation,
            check: () => [],
          }));
      }

      if (Array.isArray(data.history)) {
        this.history = data.history.filter(
          (r: unknown): r is ComplianceCheckResult =>
            typeof r === 'object'
            && r !== null
            && typeof (r as ComplianceCheckResult).timestamp === 'number'
            && Array.isArray((r as ComplianceCheckResult).findings)
            && Array.isArray((r as ComplianceCheckResult).domains),
        );
        if (this.history.length > MAX_HISTORY) {
          this.history = this.history.slice(-MAX_HISTORY);
        }
      }
    } catch {
      // Corrupt data — keep defaults
    }
  }
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

export function useStandardsCompliance(): {
  runCheck: (
    nodes: ComplianceNode[],
    bomItems: ComplianceBomItem[],
    params: DesignParameters,
    domains?: ComplianceDomain[],
  ) => ComplianceCheckResult;
  availableDomains: ComplianceDomain[];
  selectedDomains: ComplianceDomain[];
  setSelectedDomains: (domains: ComplianceDomain[]) => void;
  builtinRules: ComplianceRule[];
  customRules: ComplianceRule[];
  addCustomRule: (rule: ComplianceRule) => void;
  removeCustomRule: (id: string) => boolean;
  history: ComplianceCheckResult[];
  clearHistory: () => void;
  generateReport: (result: ComplianceCheckResult) => string;
  getDeratingFactors: (domain: ComplianceDomain) => DeratingFactors;
  checkDerating: (componentId: string, rating: ComponentRating, domain: ComplianceDomain) => ComplianceFinding[];
  calculateClearanceCreepage: (voltage: number, pollutionDegree?: PollutionDegree, materialGroup?: MaterialGroup) => ClearanceCreepageResult;
  exportRulesJSON: () => string;
  importRulesJSON: (json: string) => number;
} {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const engine = StandardsComplianceEngine.getInstance();
    const unsubscribe = engine.subscribe(() => {
      setTick((t) => t + 1);
    });
    return unsubscribe;
  }, []);

  const runCheck = useCallback(
    (nodes: ComplianceNode[], bomItems: ComplianceBomItem[], params: DesignParameters, domains?: ComplianceDomain[]) => {
      return StandardsComplianceEngine.getInstance().runCheck(nodes, bomItems, params, domains);
    },
    [],
  );

  const setSelectedDomains = useCallback((domains: ComplianceDomain[]) => {
    StandardsComplianceEngine.getInstance().setSelectedDomains(domains);
  }, []);

  const addCustomRule = useCallback((rule: ComplianceRule) => {
    StandardsComplianceEngine.getInstance().addCustomRule(rule);
  }, []);

  const removeCustomRule = useCallback((id: string) => {
    return StandardsComplianceEngine.getInstance().removeCustomRule(id);
  }, []);

  const clearHistory = useCallback(() => {
    StandardsComplianceEngine.getInstance().clearHistory();
  }, []);

  const generateReport = useCallback((result: ComplianceCheckResult) => {
    return StandardsComplianceEngine.getInstance().generateReport(result);
  }, []);

  const getDeratingFactors = useCallback((domain: ComplianceDomain) => {
    return StandardsComplianceEngine.getInstance().getDeratingFactors(domain);
  }, []);

  const checkDerating = useCallback((componentId: string, rating: ComponentRating, domain: ComplianceDomain) => {
    return StandardsComplianceEngine.getInstance().checkDerating(componentId, rating, domain);
  }, []);

  const calcClearanceCreepage = useCallback(
    (voltage: number, pollutionDegree?: PollutionDegree, materialGroup?: MaterialGroup) => {
      return StandardsComplianceEngine.getInstance().calculateClearanceCreepage(voltage, pollutionDegree, materialGroup);
    },
    [],
  );

  const exportRulesJSON = useCallback(() => {
    return StandardsComplianceEngine.getInstance().exportRulesJSON();
  }, []);

  const importRulesJSON = useCallback((json: string) => {
    return StandardsComplianceEngine.getInstance().importRulesJSON(json);
  }, []);

  const engine = typeof window !== 'undefined' ? StandardsComplianceEngine.getInstance() : null;

  return {
    runCheck,
    availableDomains: engine?.getAvailableDomains() ?? [],
    selectedDomains: engine?.getSelectedDomains() ?? [],
    setSelectedDomains,
    builtinRules: engine?.getBuiltinRules() ?? [],
    customRules: engine?.getCustomRules() ?? [],
    addCustomRule,
    removeCustomRule,
    history: engine?.getCheckHistory() ?? [],
    clearHistory,
    generateReport,
    getDeratingFactors,
    checkDerating,
    calculateClearanceCreepage: calcClearanceCreepage,
    exportRulesJSON,
    importRulesJSON,
  };
}
