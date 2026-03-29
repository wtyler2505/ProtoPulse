/**
 * Standards Compliance — Industrial Rules (IEC 61131)
 */

import type { ComplianceFinding, ComplianceRule } from './compliance-types';
import { deratingCheck, nextFindingId } from './compliance-constants';

export const INDUSTRIAL_RULES: ComplianceRule[] = [
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
];
