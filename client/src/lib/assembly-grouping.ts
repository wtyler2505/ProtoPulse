// ---------------------------------------------------------------------------
// Assembly Grouping Engine — BL-0239
//
// Classifies BOM items into assembly technology groups (SMT, THT, Manual) based
// on package/description patterns, then provides grouped views with per-group
// statistics (cost, item count, complexity score).
// ---------------------------------------------------------------------------

import type { BomItem } from '@shared/schema';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** High-level assembly technology group. */
export type AssemblyGroup = 'smt' | 'tht' | 'manual' | 'unclassified';

/** A BOM item annotated with its resolved assembly group. */
export interface GroupedBomItem {
  readonly item: BomItem;
  readonly group: AssemblyGroup;
  /** Confidence 0-1 of the classification. 1 = matched explicit pattern; 0 = default. */
  readonly confidence: number;
  /** Which pattern rule matched (for traceability). */
  readonly matchedRule: string | null;
}

/** Aggregate statistics for a single assembly group. */
export interface GroupStats {
  readonly group: AssemblyGroup;
  readonly label: string;
  readonly itemCount: number;
  readonly totalQuantity: number;
  readonly totalCost: number;
  readonly items: GroupedBomItem[];
}

/** Full result of grouping an entire BOM. */
export interface AssemblyGroupingResult {
  readonly groups: Record<AssemblyGroup, GroupStats>;
  readonly totalItems: number;
  readonly totalCost: number;
  /** Percentage of items that could be auto-classified (not 'unclassified'). */
  readonly classificationRate: number;
}

// ---------------------------------------------------------------------------
// Group metadata
// ---------------------------------------------------------------------------

export const GROUP_LABELS: Record<AssemblyGroup, string> = {
  smt: 'SMT (Surface Mount)',
  tht: 'THT (Through-Hole)',
  manual: 'Manual Assembly',
  unclassified: 'Unclassified',
};

export const GROUP_COLORS: Record<AssemblyGroup, { text: string; bg: string; border: string }> = {
  smt: { text: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
  tht: { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  manual: { text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  unclassified: { text: 'text-muted-foreground', bg: 'bg-muted/10', border: 'border-border' },
};

export const GROUP_DESCRIPTIONS: Record<AssemblyGroup, string> = {
  smt: 'Components placed by pick-and-place machine and soldered via reflow oven. Requires solder paste stencil.',
  tht: 'Components inserted through PCB holes. Wave soldering or hand soldering with lead trimming.',
  manual: 'Connectors, switches, heatsinks, mechanical parts. Typically hand-assembled or press-fit.',
  unclassified: 'Package type could not be determined from description or part number. Set manually.',
};

// ---------------------------------------------------------------------------
// Classification rules — ordered by specificity
// ---------------------------------------------------------------------------

interface ClassificationRule {
  readonly group: AssemblyGroup;
  readonly patterns: readonly RegExp[];
  readonly confidence: number;
  readonly name: string;
}

const CLASSIFICATION_RULES: readonly ClassificationRule[] = [
  // ── Mechanical / Manual (check first — connectors, hardware) ──
  {
    group: 'manual',
    confidence: 0.95,
    name: 'connector',
    patterns: [
      /\bconnector\b/i, /\bjst\b/i, /\bmolex\b/i, /\bheader\b/i, /\bterminal\b/i,
      /\bsocket\b/i, /\bplug\b/i, /\bjack\b/i, /\bdb9\b/i, /\bdb25\b/i,
      /\busb[- ]?[abc]\b/i, /\bhdmi\b/i, /\brj45\b/i, /\bbarrel jack\b/i,
    ],
  },
  {
    group: 'manual',
    confidence: 0.95,
    name: 'mechanical',
    patterns: [
      /\bstandoff\b/i, /\bscrew\b/i, /\bnut\b/i, /\bwasher\b/i, /\bspacer\b/i,
      /\bbracket\b/i, /\bmounting\b/i, /\bheatsink\b/i, /\bheat sink\b/i,
      /\benclosure\b/i, /\bclip\b/i, /\brivet\b/i, /\bgasket\b/i,
      /\brubber feet\b/i, /\bbumper\b/i, /\bthermal pad\b/i, /\bthermal tape\b/i,
    ],
  },
  {
    group: 'manual',
    confidence: 0.9,
    name: 'switch_misc',
    patterns: [
      /\bswitch\b/i, /\bbutton\b/i, /\bpotentiometer\b/i, /\btrimmer\b/i,
      /\bbattery holder\b/i, /\bfuse holder\b/i, /\brelay\b/i, /\btransformer\b/i,
      /\bbuzzer\b/i, /\bspeaker\b/i, /\btest point\b/i, /\bwire\b/i, /\bcable\b/i,
    ],
  },

  // ── SMT packages ──
  {
    group: 'smt',
    confidence: 1.0,
    name: 'chip_package',
    patterns: [
      /\b0201\b/, /\b0402\b/, /\b0603\b/, /\b0805\b/, /\b1206\b/, /\b1210\b/,
      /\b1812\b/, /\b2010\b/, /\b2512\b/,
    ],
  },
  {
    group: 'smt',
    confidence: 1.0,
    name: 'smt_explicit',
    patterns: [/\bsmd\b/i, /\bsmt\b/i, /\bsurface mount\b/i],
  },
  {
    group: 'smt',
    confidence: 0.95,
    name: 'qfp_bga',
    patterns: [
      /\bqfp\b/i, /\btqfp\b/i, /\blqfp\b/i, /\bqfn\b/i, /\bdfn\b/i, /\bson\b/i,
      /\bbga\b/i, /\bfbga\b/i, /\bwlcsp\b/i,
    ],
  },
  {
    group: 'smt',
    confidence: 0.95,
    name: 'soic_sop',
    patterns: [
      /\bsop\b/i, /\bssop\b/i, /\btssop\b/i, /\bmsop\b/i, /\bsoic\b/i,
    ],
  },
  {
    group: 'smt',
    confidence: 0.95,
    name: 'sot',
    patterns: [
      /\bsot[- ]?23\b/i, /\bsot[- ]?223\b/i, /\bsc[- ]?70\b/i, /\bd[- ]?pak\b/i,
      /\bto[- ]?252\b/i, /\bto[- ]?263\b/i,
    ],
  },

  // ── Through-hole packages ──
  {
    group: 'tht',
    confidence: 1.0,
    name: 'tht_explicit',
    patterns: [/\bthrough[- ]?hole\b/i, /\btht\b/i],
  },
  {
    group: 'tht',
    confidence: 0.95,
    name: 'dip_sip',
    patterns: [/\bdip\b/i, /\bpdip\b/i, /\bsip\b/i],
  },
  {
    group: 'tht',
    confidence: 0.95,
    name: 'to_package',
    patterns: [/\bto[- ]?92\b/i, /\bto[- ]?220\b/i, /\bto[- ]?247\b/i, /\bto[- ]?3\b/i],
  },
  {
    group: 'tht',
    confidence: 0.9,
    name: 'radial_axial',
    patterns: [/\bradial\b/i, /\baxial\b/i],
  },
];

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

/**
 * Classify a single BOM item into an assembly group based on its description
 * and part number.
 */
export function classifyItem(item: BomItem): GroupedBomItem {
  // If the item already has an explicit assemblyCategory from the DB, map it.
  if (item.assemblyCategory) {
    const mapped = mapStoredCategory(item.assemblyCategory);
    if (mapped) {
      return { item, group: mapped, confidence: 1.0, matchedRule: 'db_category' };
    }
  }

  const combined = `${item.description} ${item.partNumber}`;

  for (const rule of CLASSIFICATION_RULES) {
    if (rule.patterns.some((p) => p.test(combined))) {
      return { item, group: rule.group, confidence: rule.confidence, matchedRule: rule.name };
    }
  }

  return { item, group: 'unclassified', confidence: 0, matchedRule: null };
}

/** Map the stored `assemblyCategory` string to our AssemblyGroup enum. */
function mapStoredCategory(cat: string): AssemblyGroup | null {
  switch (cat) {
    case 'smt': return 'smt';
    case 'through_hole': return 'tht';
    case 'hand_solder': return 'manual';
    case 'mechanical': return 'manual';
    default: return null;
  }
}

// ---------------------------------------------------------------------------
// Grouping
// ---------------------------------------------------------------------------

function emptyGroupStats(group: AssemblyGroup): GroupStats {
  return {
    group,
    label: GROUP_LABELS[group],
    itemCount: 0,
    totalQuantity: 0,
    totalCost: 0,
    items: [],
  };
}

/**
 * Group an array of BOM items by assembly technology.
 * Returns per-group stats and overall classification metrics.
 */
export function groupBomByAssembly(items: readonly BomItem[]): AssemblyGroupingResult {
  const groups: Record<AssemblyGroup, GroupStats> = {
    smt: emptyGroupStats('smt'),
    tht: emptyGroupStats('tht'),
    manual: emptyGroupStats('manual'),
    unclassified: emptyGroupStats('unclassified'),
  };

  let totalCost = 0;

  for (const item of items) {
    const classified = classifyItem(item);
    const g = groups[classified.group];
    const cost = Number(item.totalPrice) || 0;

    // GroupStats is readonly at the interface level; we build mutable copies here.
    (groups[classified.group] as { itemCount: number }).itemCount = g.itemCount + 1;
    (groups[classified.group] as { totalQuantity: number }).totalQuantity = g.totalQuantity + item.quantity;
    (groups[classified.group] as { totalCost: number }).totalCost = g.totalCost + cost;
    (groups[classified.group] as { items: GroupedBomItem[] }).items = [...g.items, classified];

    totalCost += cost;
  }

  const classifiedCount = items.length - groups.unclassified.itemCount;
  const classificationRate = items.length > 0 ? classifiedCount / items.length : 1;

  return { groups, totalItems: items.length, totalCost, classificationRate };
}

// ---------------------------------------------------------------------------
// Utility: group ordering (for display)
// ---------------------------------------------------------------------------

const GROUP_ORDER: readonly AssemblyGroup[] = ['smt', 'tht', 'manual', 'unclassified'];

/** Return non-empty groups in display order. */
export function getOrderedGroups(result: AssemblyGroupingResult): GroupStats[] {
  return GROUP_ORDER.map((g) => result.groups[g]).filter((gs) => gs.itemCount > 0);
}
