/**
 * Standards Compliance — Consumer Rules (IEC 62368)
 */

import type { ComplianceFinding, ComplianceRule } from './compliance-types';
import { deratingCheck, nextFindingId } from './compliance-constants';

export const CONSUMER_RULES: ComplianceRule[] = [
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
];
