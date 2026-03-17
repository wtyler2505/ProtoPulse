/**
 * Assembly method classification and grouping for BOM items.
 * Groups items by SMT / THT / manual assembly method for manufacturing planning.
 */

// ── Types ────────────────────────────────────────────────────────────

export type AssemblyMethod = 'smt' | 'tht' | 'manual' | 'unknown';

export interface BomItemLike {
  id?: number | string;
  partNumber?: string;
  package?: string;
  mountingType?: string;
  description?: string;
  quantity?: number;
  totalPrice?: string | number | null;
  esdSensitive?: boolean | null;
}

export interface AssemblyGroup {
  method: AssemblyMethod;
  items: BomItemLike[];
  count: number;
  percentage: number;
}

export interface AssemblySummary {
  total: number;
  smt: number;
  tht: number;
  manual: number;
  unknown: number;
  smtPercentage: number;
}

// ── Classification patterns ──────────────────────────────────────────

const SMT_PATTERN =
  /\bQFP\b|\bLQFP\b|\bQFN\b|\bVQFN\b|\bSOIC\b|\bSOP\b|\bSOT\b|\bBGA\b|\bTSSOP\b|\bMSOP\b|\bDFN\b|\b0201\b|\b0402\b|\b0603\b|\b0805\b|\b1206\b|\b1210\b|\b2512\b|\bchip\b/i;

const THT_PATTERN = /\bDIP\b|\bPDIP\b|\bSIP\b|\bTO-220\b|\bTO-92\b|\bTO-3\b|\bTO-247\b|\baxial\b|\bradial\b/i;

const MANUAL_PATTERN =
  /\bheader\b|\bJST\b|\bMolex\b|\bconnector\b|\bswitch\b|\bpotentiometer\b|\bpot\b|\bheatsink\b|\bterminal\b|\bbarrel\b|\bsocket\b/i;

const DESCRIPTION_SMT_PATTERN = /\bsurface\s*mount\b/i;
const DESCRIPTION_THT_PATTERN = /\bthrough[\s-]hole\b/i;

// ── Sort order ───────────────────────────────────────────────────────

const METHOD_ORDER: Record<AssemblyMethod, number> = {
  smt: 0,
  tht: 1,
  manual: 2,
  unknown: 3,
};

// ── Public API ───────────────────────────────────────────────────────

/**
 * Classify a BOM item's assembly method based on mountingType, package, and description.
 * Priority: mountingType > package pattern > description pattern > unknown.
 */
export function classifyAssemblyMethod(item: BomItemLike): AssemblyMethod {
  // 1. Explicit mountingType takes priority
  const mt = item.mountingType?.trim().toLowerCase();
  if (mt === 'smd') {
    return 'smt';
  }
  if (mt === 'tht') {
    return 'tht';
  }

  // 2. Package string pattern matching
  const pkg = item.package?.trim();
  if (pkg) {
    const method = classifyFromString(pkg);
    if (method !== 'unknown') {
      return method;
    }
  }

  // 3. Description fallback
  const desc = item.description?.trim();
  if (desc) {
    const method = classifyFromString(desc);
    if (method !== 'unknown') {
      return method;
    }

    // Extra description-specific patterns
    if (DESCRIPTION_SMT_PATTERN.test(desc)) {
      return 'smt';
    }
    if (DESCRIPTION_THT_PATTERN.test(desc)) {
      return 'tht';
    }
  }

  return 'unknown';
}

/**
 * Group BOM items by assembly method. Returns groups sorted: smt, tht, manual, unknown.
 * Groups with zero items are omitted.
 */
export function groupByAssemblyMethod(items: BomItemLike[]): AssemblyGroup[] {
  if (items.length === 0) {
    return [];
  }

  const buckets = new Map<AssemblyMethod, BomItemLike[]>();

  for (const it of items) {
    const method = classifyAssemblyMethod(it);
    const bucket = buckets.get(method);
    if (bucket) {
      bucket.push(it);
    } else {
      buckets.set(method, [it]);
    }
  }

  const total = items.length;

  return Array.from(buckets.entries())
    .map(
      ([method, grouped]): AssemblyGroup => ({
        method,
        items: grouped,
        count: grouped.length,
        percentage: Math.round((grouped.length / total) * 10000) / 100,
      }),
    )
    .sort((a, b) => METHOD_ORDER[a.method] - METHOD_ORDER[b.method]);
}

/**
 * Get a summary of assembly method distribution for a list of BOM items.
 */
export function getAssemblySummary(items: BomItemLike[]): AssemblySummary {
  if (items.length === 0) {
    return { total: 0, smt: 0, tht: 0, manual: 0, unknown: 0, smtPercentage: 0 };
  }

  let smt = 0;
  let tht = 0;
  let manual = 0;
  let unknown = 0;

  for (const it of items) {
    const method = classifyAssemblyMethod(it);
    switch (method) {
      case 'smt':
        smt++;
        break;
      case 'tht':
        tht++;
        break;
      case 'manual':
        manual++;
        break;
      case 'unknown':
        unknown++;
        break;
    }
  }

  const total = items.length;

  return {
    total,
    smt,
    tht,
    manual,
    unknown,
    smtPercentage: Math.round((smt / total) * 100),
  };
}

/**
 * Human-readable label for an assembly method.
 */
export function getAssemblyMethodLabel(method: AssemblyMethod): string {
  switch (method) {
    case 'smt':
      return 'SMT (Surface Mount)';
    case 'tht':
      return 'THT (Through-Hole)';
    case 'manual':
      return 'Manual Assembly';
    case 'unknown':
      return 'Unknown';
  }
}

/**
 * Tailwind color class for an assembly method.
 */
export function getAssemblyMethodColor(method: AssemblyMethod): string {
  switch (method) {
    case 'smt':
      return 'text-cyan-400';
    case 'tht':
      return 'text-amber-400';
    case 'manual':
      return 'text-purple-400';
    case 'unknown':
      return 'text-zinc-400';
  }
}

// ── Panel-facing API (used by AssemblyGroupPanel.tsx) ────────────────

export interface GroupItem {
  item: BomItemLike;
  confidence: number;
  matchedRule: string | null;
}

export interface GroupStats {
  group: string;
  label: string;
  itemCount: number;
  totalQuantity: number;
  totalCost: number;
  items: GroupItem[];
}

export interface AssemblyGroupResult {
  totalItems: number;
  totalCost: number;
  classificationRate: number;
  groups: Record<string, GroupStats>;
}

export const GROUP_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  smt: { text: 'text-cyan-400', bg: 'bg-cyan-950/30', border: 'border-cyan-800/40' },
  tht: { text: 'text-amber-400', bg: 'bg-amber-950/30', border: 'border-amber-800/40' },
  manual: { text: 'text-purple-400', bg: 'bg-purple-950/30', border: 'border-purple-800/40' },
  unclassified: { text: 'text-zinc-400', bg: 'bg-zinc-950/30', border: 'border-zinc-800/40' },
};

export const GROUP_DESCRIPTIONS: Record<string, string> = {
  smt: 'Surface-mount components placed by pick-and-place machine and reflow soldered.',
  tht: 'Through-hole components inserted and wave or hand soldered.',
  manual: 'Connectors, switches, and mechanical parts requiring manual placement.',
  unclassified: 'Could not auto-classify — add package type to description for automatic grouping.',
};

/**
 * Group BOM items into assembly categories with cost/quantity aggregation.
 * Used by AssemblyGroupPanel.
 */
export function groupBomByAssembly(bom: BomItemLike[]): AssemblyGroupResult {
  const groups: Record<string, GroupStats> = {
    smt: { group: 'smt', label: 'SMT (Surface Mount)', itemCount: 0, totalQuantity: 0, totalCost: 0, items: [] },
    tht: { group: 'tht', label: 'THT (Through-Hole)', itemCount: 0, totalQuantity: 0, totalCost: 0, items: [] },
    manual: { group: 'manual', label: 'Manual Assembly', itemCount: 0, totalQuantity: 0, totalCost: 0, items: [] },
    unclassified: { group: 'unclassified', label: 'Unclassified', itemCount: 0, totalQuantity: 0, totalCost: 0, items: [] },
  };

  let totalCost = 0;

  for (const item of bom) {
    const method = classifyAssemblyMethod(item);
    const key = method === 'unknown' ? 'unclassified' : method;
    const g = groups[key];
    const qty = item.quantity ?? 1;
    const price = Number(item.totalPrice) || 0;

    g.itemCount++;
    g.totalQuantity += qty;
    g.totalCost += price;
    g.items.push({ item, confidence: method === 'unknown' ? 0 : 1, matchedRule: method === 'unknown' ? null : method });
    totalCost += price;
  }

  const classified = bom.length - groups.unclassified.itemCount;

  return {
    totalItems: bom.length,
    totalCost,
    classificationRate: bom.length > 0 ? classified / bom.length : 1,
    groups,
  };
}

/**
 * Return non-empty groups in display order: smt, tht, manual, unclassified.
 */
export function getOrderedGroups(result: AssemblyGroupResult): GroupStats[] {
  return ['smt', 'tht', 'manual', 'unclassified']
    .map((k) => result.groups[k])
    .filter((g): g is GroupStats => g !== undefined && g.itemCount > 0);
}

// ── Internal helpers ─────────────────────────────────────────────────

function classifyFromString(s: string): AssemblyMethod {
  // Check manual first — manual items (sockets, connectors) may contain
  // THT package names (e.g. "socket-DIP-28") but are hand-placed.
  if (MANUAL_PATTERN.test(s)) {
    return 'manual';
  }
  if (SMT_PATTERN.test(s)) {
    return 'smt';
  }
  if (THT_PATTERN.test(s)) {
    return 'tht';
  }
  return 'unknown';
}
