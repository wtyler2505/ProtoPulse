/**
 * Netlist diff / ECO (Engineering Change Order) engine (FG-33).
 *
 * Compares two netlist snapshots (baseline vs current) to produce a structured
 * diff showing added, removed, and modified nets and components, plus
 * connection-level changes. Used by the BOM Comparison panel and ECO workflow.
 */

// ---------------------------------------------------------------------------
// Snapshot types — lightweight representations of netlists for comparison
// ---------------------------------------------------------------------------

/** A single connection: a component pin wired to a net. */
export interface NetlistConnection {
  refDes: string;
  pin: string;
}

/** A net snapshot: name, type, and its set of pin connections. */
export interface NetSnapshot {
  name: string;
  netType: string;
  connections: NetlistConnection[];
}

/** A component snapshot: reference designator and optional part info. */
export interface ComponentSnapshot {
  referenceDesignator: string;
  partId: number | null;
  value: string;
}

/** A full netlist snapshot for comparison. */
export interface NetlistSnapshot {
  circuitName: string;
  components: ComponentSnapshot[];
  nets: NetSnapshot[];
}

// ---------------------------------------------------------------------------
// Diff result types
// ---------------------------------------------------------------------------

/** A net that exists only in the current netlist. */
export interface NetDiffAdded {
  type: 'added';
  netName: string;
  current: NetSnapshot;
}

/** A net that exists only in the baseline netlist. */
export interface NetDiffRemoved {
  type: 'removed';
  netName: string;
  baseline: NetSnapshot;
}

/** A net present in both with connection changes. */
export interface NetDiffModified {
  type: 'modified';
  netName: string;
  addedConnections: NetlistConnection[];
  removedConnections: NetlistConnection[];
  typeChanged: boolean;
  oldType: string;
  newType: string;
}

export type NetDiffEntry = NetDiffAdded | NetDiffRemoved | NetDiffModified;

/** A component that exists only in the current netlist. */
export interface ComponentDiffAdded {
  type: 'added';
  refDes: string;
  current: ComponentSnapshot;
}

/** A component that exists only in the baseline netlist. */
export interface ComponentDiffRemoved {
  type: 'removed';
  refDes: string;
  baseline: ComponentSnapshot;
}

/** A component present in both with property changes. */
export interface ComponentDiffModified {
  type: 'modified';
  refDes: string;
  changes: Array<{ field: string; oldValue: string; newValue: string }>;
}

export type ComponentDiffEntry = ComponentDiffAdded | ComponentDiffRemoved | ComponentDiffModified;

export interface NetlistDiffSummary {
  addedNetCount: number;
  removedNetCount: number;
  modifiedNetCount: number;
  addedComponentCount: number;
  removedComponentCount: number;
  modifiedComponentCount: number;
  totalChanges: number;
}

export interface NetlistDiffResult {
  netChanges: NetDiffEntry[];
  componentChanges: ComponentDiffEntry[];
  summary: NetlistDiffSummary;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Canonical key for a connection (for set comparison). */
function connectionKey(conn: NetlistConnection): string {
  return `${conn.refDes}:${conn.pin}`;
}

/** Build a set of connection keys for fast membership testing. */
function connectionKeySet(connections: NetlistConnection[]): Set<string> {
  const set = new Set<string>();
  for (const conn of connections) {
    set.add(connectionKey(conn));
  }
  return set;
}

// ---------------------------------------------------------------------------
// Core diff function
// ---------------------------------------------------------------------------

/**
 * Compute a structured diff between a baseline and current netlist.
 * Nets are matched by name (case-sensitive). Components by reference designator.
 */
export function computeNetlistDiff(
  baseline: NetlistSnapshot,
  current: NetlistSnapshot,
): NetlistDiffResult {
  // --- Net comparison ---
  const baselineNetMap = new Map<string, NetSnapshot>();
  for (const net of baseline.nets) {
    baselineNetMap.set(net.name, net);
  }

  const currentNetMap = new Map<string, NetSnapshot>();
  for (const net of current.nets) {
    currentNetMap.set(net.name, net);
  }

  const netChanges: NetDiffEntry[] = [];

  // Find added and modified nets
  for (const [netName, currentNet] of Array.from(currentNetMap)) {
    const baselineNet = baselineNetMap.get(netName);

    if (!baselineNet) {
      netChanges.push({ type: 'added', netName, current: currentNet });
      continue;
    }

    // Compare connections
    const baselineKeys = connectionKeySet(baselineNet.connections);
    const currentKeys = connectionKeySet(currentNet.connections);

    const addedConnections: NetlistConnection[] = currentNet.connections.filter(
      (conn) => !baselineKeys.has(connectionKey(conn)),
    );
    const removedConnections: NetlistConnection[] = baselineNet.connections.filter(
      (conn) => !currentKeys.has(connectionKey(conn)),
    );

    const typeChanged = baselineNet.netType !== currentNet.netType;

    if (addedConnections.length > 0 || removedConnections.length > 0 || typeChanged) {
      netChanges.push({
        type: 'modified',
        netName,
        addedConnections,
        removedConnections,
        typeChanged,
        oldType: baselineNet.netType,
        newType: currentNet.netType,
      });
    }
  }

  // Find removed nets
  for (const [netName, baselineNet] of Array.from(baselineNetMap)) {
    if (!currentNetMap.has(netName)) {
      netChanges.push({ type: 'removed', netName, baseline: baselineNet });
    }
  }

  // --- Component comparison ---
  const baselineCompMap = new Map<string, ComponentSnapshot>();
  for (const comp of baseline.components) {
    baselineCompMap.set(comp.referenceDesignator, comp);
  }

  const currentCompMap = new Map<string, ComponentSnapshot>();
  for (const comp of current.components) {
    currentCompMap.set(comp.referenceDesignator, comp);
  }

  const componentChanges: ComponentDiffEntry[] = [];

  // Find added and modified components
  for (const [refDes, currentComp] of Array.from(currentCompMap)) {
    const baselineComp = baselineCompMap.get(refDes);

    if (!baselineComp) {
      componentChanges.push({ type: 'added', refDes, current: currentComp });
      continue;
    }

    const changes: Array<{ field: string; oldValue: string; newValue: string }> = [];

    if (String(baselineComp.partId ?? '') !== String(currentComp.partId ?? '')) {
      changes.push({ field: 'Part ID', oldValue: String(baselineComp.partId ?? '—'), newValue: String(currentComp.partId ?? '—') });
    }
    if (baselineComp.value !== currentComp.value) {
      changes.push({ field: 'Value', oldValue: baselineComp.value, newValue: currentComp.value });
    }

    if (changes.length > 0) {
      componentChanges.push({ type: 'modified', refDes, changes });
    }
  }

  // Find removed components
  for (const [refDes, baselineComp] of Array.from(baselineCompMap)) {
    if (!currentCompMap.has(refDes)) {
      componentChanges.push({ type: 'removed', refDes, baseline: baselineComp });
    }
  }

  // --- Sort entries ---
  const NET_ORDER: Record<NetDiffEntry['type'], number> = { removed: 0, modified: 1, added: 2 };
  netChanges.sort((a, b) => {
    const typeOrder = NET_ORDER[a.type] - NET_ORDER[b.type];
    if (typeOrder !== 0) { return typeOrder; }
    const nameA = a.type === 'removed' ? a.netName : a.type === 'added' ? a.netName : a.netName;
    const nameB = b.type === 'removed' ? b.netName : b.type === 'added' ? b.netName : b.netName;
    return nameA.localeCompare(nameB);
  });

  const COMP_ORDER: Record<ComponentDiffEntry['type'], number> = { removed: 0, modified: 1, added: 2 };
  componentChanges.sort((a, b) => {
    const typeOrder = COMP_ORDER[a.type] - COMP_ORDER[b.type];
    if (typeOrder !== 0) { return typeOrder; }
    const refA = a.type === 'removed' ? a.refDes : a.type === 'added' ? a.refDes : a.refDes;
    const refB = b.type === 'removed' ? b.refDes : b.type === 'added' ? b.refDes : b.refDes;
    return refA.localeCompare(refB);
  });

  // --- Summary ---
  const addedNetCount = netChanges.filter((e) => e.type === 'added').length;
  const removedNetCount = netChanges.filter((e) => e.type === 'removed').length;
  const modifiedNetCount = netChanges.filter((e) => e.type === 'modified').length;
  const addedComponentCount = componentChanges.filter((e) => e.type === 'added').length;
  const removedComponentCount = componentChanges.filter((e) => e.type === 'removed').length;
  const modifiedComponentCount = componentChanges.filter((e) => e.type === 'modified').length;

  return {
    netChanges,
    componentChanges,
    summary: {
      addedNetCount,
      removedNetCount,
      modifiedNetCount,
      addedComponentCount,
      removedComponentCount,
      modifiedComponentCount,
      totalChanges:
        addedNetCount + removedNetCount + modifiedNetCount +
        addedComponentCount + removedComponentCount + modifiedComponentCount,
    },
  };
}
