/**
 * Standards Compliance — Built-in Rules Aggregator
 *
 * Collects all domain-specific rule sets into a single BUILTIN_RULES array.
 */

import type { ComplianceRule } from './compliance-types';
import { AUTOMOTIVE_RULES } from './rules-automotive';
import { MEDICAL_RULES } from './rules-medical';
import { INDUSTRIAL_RULES } from './rules-industrial';
import { CONSUMER_RULES } from './rules-consumer';
import { AEROSPACE_RULES } from './rules-aerospace';
import { EMC_RULES } from './rules-emc';

export const BUILTIN_RULES: ComplianceRule[] = [
  ...AUTOMOTIVE_RULES,
  ...MEDICAL_RULES,
  ...INDUSTRIAL_RULES,
  ...CONSUMER_RULES,
  ...AEROSPACE_RULES,
  ...EMC_RULES,
];
