// ---------------------------------------------------------------------------
// BL-0568 — Design snapshot restore cascade
// Multi-domain snapshot restore: analyze, plan, warn
// ---------------------------------------------------------------------------

/** Domains that can be independently restored from a snapshot. */
export type RestoreDomain = 'architecture' | 'schematic' | 'bom' | 'simulation';

/** Per-domain analysis of a snapshot's content. */
export interface SnapshotDomainInfo {
  domain: RestoreDomain;
  available: boolean;
  itemCount: number;
  description: string;
}

/** Configuration for a cascade restore operation. */
export interface CascadeRestoreConfig {
  snapshotId: number;
  domains: RestoreDomain[];
  projectId: number;
}

/** A single step in a restore plan. */
export interface RestoreStep {
  domain: RestoreDomain;
  action: 'replace' | 'merge';
  itemCount: number;
  description: string;
}

/** Full restore plan with estimated impact and warnings. */
export interface RestorePlan {
  steps: RestoreStep[];
  estimatedChanges: number;
  warnings: string[];
}

/** Shape of the JSONB snapshot data blob. All keys are optional arrays. */
export interface SnapshotData {
  nodes?: unknown[];
  edges?: unknown[];
  instances?: unknown[];
  nets?: unknown[];
  wires?: unknown[];
  bomItems?: unknown[];
  simulationResults?: unknown[];
}

// ---------------------------------------------------------------------------
// Domain → snapshot key mapping
// ---------------------------------------------------------------------------

const DOMAIN_KEYS: Record<RestoreDomain, (keyof SnapshotData)[]> = {
  architecture: ['nodes', 'edges'],
  schematic: ['instances', 'nets', 'wires'],
  bom: ['bomItems'],
  simulation: ['simulationResults'],
};

const DOMAIN_DESCRIPTIONS: Record<RestoreDomain, { available: string; unavailable: string }> = {
  architecture: {
    available: 'Architecture block diagram nodes and connections',
    unavailable: 'No architecture data in snapshot',
  },
  schematic: {
    available: 'Schematic instances, nets, and wires',
    unavailable: 'No schematic data in snapshot',
  },
  bom: {
    available: 'Bill of materials items',
    unavailable: 'No BOM data in snapshot',
  },
  simulation: {
    available: 'Simulation results and configuration',
    unavailable: 'No simulation data in snapshot',
  },
};

const STEP_DESCRIPTIONS: Record<RestoreDomain, string> = {
  architecture: 'Replace architecture nodes and edges from snapshot',
  schematic: 'Replace schematic instances, nets, and wires from snapshot',
  bom: 'Replace bill of materials from snapshot',
  simulation: 'Replace simulation results from snapshot',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function safeArrayLength(data: SnapshotData | null | undefined, key: keyof SnapshotData): number {
  if (!data) {
    return 0;
  }
  const value = data[key];
  return Array.isArray(value) ? value.length : 0;
}

function domainItemCount(data: SnapshotData | null | undefined, domain: RestoreDomain): number {
  return DOMAIN_KEYS[domain].reduce((sum, key) => sum + safeArrayLength(data, key), 0);
}

// ---------------------------------------------------------------------------
// Cross-domain dependency warnings
// ---------------------------------------------------------------------------

interface DependencyRule {
  /** Domain being restored. */
  domain: RestoreDomain;
  /** Domain that should also be restored to avoid inconsistency. */
  requires: RestoreDomain;
  /** Warning message when the dependency is missing. */
  warning: string;
}

const DEPENDENCY_RULES: DependencyRule[] = [
  {
    domain: 'schematic',
    requires: 'bom',
    warning: 'Restoring schematic without BOM may cause data inconsistency',
  },
  {
    domain: 'schematic',
    requires: 'architecture',
    warning: 'Restoring schematic without architecture may cause data inconsistency',
  },
  {
    domain: 'bom',
    requires: 'schematic',
    warning: 'Restoring BOM without schematic may cause data inconsistency',
  },
  {
    domain: 'simulation',
    requires: 'schematic',
    warning: 'Restoring simulation without schematic may cause data inconsistency',
  },
  {
    domain: 'architecture',
    requires: 'schematic',
    warning: 'Restoring architecture without schematic may cause data inconsistency',
  },
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Inspect snapshot data JSON to determine which domains have content.
 * Always returns all four domains in canonical order.
 */
export function analyzeSnapshotDomains(data: SnapshotData): SnapshotDomainInfo[] {
  const domains: RestoreDomain[] = ['architecture', 'schematic', 'bom', 'simulation'];

  return domains.map((domain) => {
    const count = domainItemCount(data, domain);
    const available = count > 0;
    const desc = DOMAIN_DESCRIPTIONS[domain];

    return {
      domain,
      available,
      itemCount: count,
      description: available ? desc.available : desc.unavailable,
    };
  });
}

/**
 * Create a step-by-step restore plan for the given config and snapshot data.
 * Generates warnings for cross-domain inconsistencies and empty domains.
 */
export function generateRestorePlan(
  config: CascadeRestoreConfig,
  data: SnapshotData,
): RestorePlan {
  const { domains } = config;

  if (domains.length === 0) {
    return { steps: [], estimatedChanges: 0, warnings: [] };
  }

  const domainSet = new Set(domains);
  const warnings: string[] = [];

  // Build steps in config order
  const steps: RestoreStep[] = domains.map((domain) => {
    const count = domainItemCount(data, domain);
    return {
      domain,
      action: 'replace' as const,
      itemCount: count,
      description: STEP_DESCRIPTIONS[domain],
    };
  });

  // Cross-domain dependency warnings
  for (const rule of DEPENDENCY_RULES) {
    if (domainSet.has(rule.domain) && !domainSet.has(rule.requires)) {
      warnings.push(rule.warning);
    }
  }

  // Empty domain warnings
  for (const domain of domains) {
    const count = domainItemCount(data, domain);
    if (count === 0) {
      const label = domain.charAt(0).toUpperCase() + domain.slice(1);
      warnings.push(`${label} domain has no data in snapshot — restoring will clear existing data`);
    }
  }

  const estimatedChanges = steps.reduce((sum, s) => sum + s.itemCount, 0);

  return { steps, estimatedChanges, warnings };
}
