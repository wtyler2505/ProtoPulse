/**
 * Standards Compliance — Automotive Rules (AEC-Q100/Q101/Q200)
 */

import type { ComplianceFinding, ComplianceRule } from './compliance-types';
import { deratingCheck, isAutomotiveGrade, nextFindingId } from './compliance-constants';

export const AUTOMOTIVE_RULES: ComplianceRule[] = [
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
];
