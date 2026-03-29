/**
 * Standards Compliance — EMC Rules (IEC 61000)
 */

import type { ComplianceFinding, ComplianceRule } from './compliance-types';
import { nextFindingId } from './compliance-constants';

export const EMC_RULES: ComplianceRule[] = [
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
