/**
 * Standards Compliance — Aerospace Rules (DO-254 / MIL-STD)
 */

import type { ComplianceFinding, ComplianceRule } from './compliance-types';
import { deratingCheck, nextFindingId } from './compliance-constants';

export const AEROSPACE_RULES: ComplianceRule[] = [
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
];
