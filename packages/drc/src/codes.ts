import type { CodeInfo } from '@protopulse/erc';

/**
 * Every DRC code maps to exactly one concepts-wiki article, same deal as
 * ERC — the error message IS the curriculum's index (Vol III §2.2).
 */
export const DRC_CODES: Record<string, CodeInfo> = {
  'DRC-TRACE-WIDTH': { title: 'Trace below minimum width', conceptSlug: 'power-and-heat' },
  'DRC-CLEARANCE': { title: 'Copper clearance violation', conceptSlug: 'tolerance-stacking' },
  'DRC-ANNULAR': { title: 'Annular ring too thin', conceptSlug: 'tolerance-stacking' },
  'DRC-DRILL': { title: 'Drill below the fab minimum', conceptSlug: 'tolerance-stacking' },
  'DRC-UNROUTED': { title: 'Unrouted net', conceptSlug: 'series-vs-parallel' },
  'DRC-ZONE-OVERLAP': { title: 'Different-net zones overlap', conceptSlug: 'tolerance-stacking' },
  'DRC-ZONE-ISOLATED': { title: 'Zone pours an isolated island', conceptSlug: 'series-vs-parallel' },
  'DRC-UNSUPPORTED-ROTATION': {
    title: 'Unsupported footprint rotation',
    conceptSlug: 'reading-a-datasheet',
  },
};

export function conceptFor(code: string): CodeInfo | undefined {
  return DRC_CODES[code];
}
