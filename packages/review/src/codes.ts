import { ERC_CODES } from '@protopulse/erc';

import type { CodeInfo } from '@protopulse/erc';

/**
 * Every review code maps to exactly one concepts-wiki article, exactly
 * like ERC codes (Vol III §2.2). Slugs reuse the existing fundamentals
 * articles — the review deck adds checks, not curriculum.
 *
 * REV-RAIL-OVERBUDGET is deliberately absent: erc's ruleCurrentBudget
 * already fires ERC-CURRENT-BUDGET for *every* exceeded current_max
 * constraint — rail-targeting ones included — and the 'erc' check embeds
 * those findings in the report. A review-side rail error would always
 * double-report the same defect under a second code, so the power-tree
 * check keeps only the per-rail REV-POWER-SUMMARY info.
 */
export const REV_CODES: Record<string, CodeInfo> = {
  'REV-DECOUPLING-MISSING': { title: 'Missing decoupling capacitor', conceptSlug: 'impedance-vs-resistance' },
  'REV-POWER-SUMMARY': { title: 'Rail current summary', conceptSlug: 'power-and-heat' },
  'REV-UNVERIFIED-PART': { title: 'Unverified part in a load-bearing role', conceptSlug: 'reading-a-datasheet' },
  'REV-IC-UNWIRED': { title: 'IC with almost no wiring', conceptSlug: 'floating-inputs' },
  'REV-DNP-RAIL': { title: 'Rail sourced only by a DNP part', conceptSlug: 'voltage-vs-current' },
};

/** Concept lookup across review codes and the embedded ERC codes. */
export function conceptForReview(code: string): CodeInfo | undefined {
  return REV_CODES[code] ?? ERC_CODES[code];
}
