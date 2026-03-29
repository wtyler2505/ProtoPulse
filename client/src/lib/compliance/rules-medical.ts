/**
 * Standards Compliance — Medical Rules (IEC 60601)
 */

import type { ComplianceFinding, ComplianceRule } from './compliance-types';
import { deratingCheck, nextFindingId } from './compliance-constants';

export const MEDICAL_RULES: ComplianceRule[] = [
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
];
