/**
 * Back-Annotation Manager
 *
 * Manages pending back-annotation patches that propagate changes from
 * BOM or PCB views back to schematic circuit instances.
 *
 * When a BOM item's MPN or value changes in the Procurement view,
 * the corresponding schematic instance's properties should update.
 * When a PCB ref-des or property changes, it should propagate back too.
 *
 * Usage:
 *   const manager = BackAnnotationManager.getInstance();
 *   manager.addPatch(generateBomBackAnnotationPatch(bomItem, instanceId, designId));
 *   manager.subscribe(() => console.log(manager.getSnapshot()));
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BackAnnotationPatch {
  sourceType: 'bom' | 'pcb';
  sourceId: number | string;
  targetInstanceId: string;
  targetDesignId: number;
  changes: Record<string, unknown>;
  timestamp: number;
}

export interface BackAnnotationSnapshot {
  pendingCount: number;
  patches: BackAnnotationPatch[];
}

interface InstanceCandidate {
  instanceId: string;
  label: string;
  componentId: string;
  properties: unknown;
}

interface BomItemCandidate {
  id: number;
  partNumber: string;
  manufacturer: string;
  description: string;
}

// ---------------------------------------------------------------------------
// BackAnnotationManager
// ---------------------------------------------------------------------------

export class BackAnnotationManager {
  private static instance: BackAnnotationManager | null = null;

  private pendingAnnotations: BackAnnotationPatch[];
  private subscribers: Set<() => void>;

  constructor() {
    this.pendingAnnotations = [];
    this.subscribers = new Set();
  }

  /** Get or create the singleton instance. */
  static getInstance(): BackAnnotationManager {
    if (!BackAnnotationManager.instance) {
      BackAnnotationManager.instance = new BackAnnotationManager();
    }
    return BackAnnotationManager.instance;
  }

  /** Reset the singleton (useful for testing). */
  static resetInstance(): void {
    BackAnnotationManager.instance = null;
  }

  // -----------------------------------------------------------------------
  // Patch management
  // -----------------------------------------------------------------------

  /** Add a back-annotation patch to the pending queue. */
  addPatch(patch: BackAnnotationPatch): void {
    this.pendingAnnotations.push(patch);
    this.notify();
  }

  /** Get a copy of all pending patches. */
  getPending(): BackAnnotationPatch[] {
    return [...this.pendingAnnotations];
  }

  /** Clear all pending patches. */
  clearPending(): void {
    this.pendingAnnotations = [];
    this.notify();
  }

  // -----------------------------------------------------------------------
  // Snapshot
  // -----------------------------------------------------------------------

  /** Get a snapshot of the current state (safe copy). */
  getSnapshot(): BackAnnotationSnapshot {
    return {
      pendingCount: this.pendingAnnotations.length,
      patches: [...this.pendingAnnotations],
    };
  }

  // -----------------------------------------------------------------------
  // Subscribe / notify
  // -----------------------------------------------------------------------

  /** Subscribe to state changes. Returns an unsubscribe function. */
  subscribe(listener: () => void): () => void {
    this.subscribers.add(listener);
    return () => {
      this.subscribers.delete(listener);
    };
  }

  private notify(): void {
    this.subscribers.forEach((listener) => {
      listener();
    });
  }
}

// ---------------------------------------------------------------------------
// Matching logic
// ---------------------------------------------------------------------------

/**
 * Safely extract a string property from an unknown properties bag.
 */
function getProp(properties: unknown, key: string): string | undefined {
  if (properties !== null && properties !== undefined && typeof properties === 'object') {
    const val = (properties as Record<string, unknown>)[key];
    if (typeof val === 'string') {
      return val;
    }
  }
  return undefined;
}

/**
 * Find schematic instances that match a BOM item.
 *
 * Matching priority:
 * 1. Exact partNumber/mpn match in instance properties (case-insensitive)
 * 2. Exact value match in instance properties (case-insensitive)
 * 3. Fuzzy: label appears in BOM description
 * 4. Fuzzy: manufacturer matches in instance properties
 *
 * If exact matches (partNumber/mpn/value) are found, fuzzy matches are skipped
 * to avoid noise. Results are deduplicated.
 */
export function findMatchingInstances(
  bomItem: BomItemCandidate,
  instances: InstanceCandidate[],
): string[] {
  if (instances.length === 0) {
    return [];
  }

  const exactMatches = new Set<string>();
  const fuzzyMatches = new Set<string>();

  const bomPn = bomItem.partNumber.toLowerCase();
  const bomMfr = bomItem.manufacturer.toLowerCase();
  const bomDesc = bomItem.description.toLowerCase();

  for (const inst of instances) {
    const props = inst.properties;

    // --- Exact matching: partNumber / mpn / value in properties ---
    const instPn = getProp(props, 'partNumber')?.toLowerCase();
    const instMpn = getProp(props, 'mpn')?.toLowerCase();
    const instValue = getProp(props, 'value')?.toLowerCase();

    if (instPn && instPn === bomPn) {
      exactMatches.add(inst.instanceId);
      continue;
    }

    if (instMpn && instMpn === bomPn) {
      exactMatches.add(inst.instanceId);
      continue;
    }

    if (instValue && instValue === bomPn) {
      exactMatches.add(inst.instanceId);
      continue;
    }

    // --- Fuzzy matching: label in description ---
    if (inst.label && bomDesc.includes(inst.label.toLowerCase())) {
      fuzzyMatches.add(inst.instanceId);
      continue;
    }

    // --- Fuzzy matching: manufacturer in properties ---
    const instMfr = getProp(props, 'manufacturer')?.toLowerCase();
    if (instMfr && instMfr === bomMfr && bomMfr.length > 0) {
      fuzzyMatches.add(inst.instanceId);
    }
  }

  // Prefer exact matches; only fall back to fuzzy if no exact matches exist
  if (exactMatches.size > 0) {
    return Array.from(exactMatches);
  }
  return Array.from(fuzzyMatches);
}

// ---------------------------------------------------------------------------
// Patch generators
// ---------------------------------------------------------------------------

/**
 * Generate a back-annotation patch from a BOM item change
 * to a target schematic instance.
 */
export function generateBomBackAnnotationPatch(
  bomItem: BomItemCandidate,
  instanceId: string,
  designId: number,
): BackAnnotationPatch {
  return {
    sourceType: 'bom',
    sourceId: bomItem.id,
    targetInstanceId: instanceId,
    targetDesignId: designId,
    changes: {
      partNumber: bomItem.partNumber,
      manufacturer: bomItem.manufacturer,
      description: bomItem.description,
    },
    timestamp: Date.now(),
  };
}

// ---------------------------------------------------------------------------
// PCB back-annotation generators (Task #4)
// ---------------------------------------------------------------------------

/**
 * Generate a back-annotation patch for a PCB reference designator rename.
 */
export function generatePcbRefDesAnnotation(
  oldRefDes: string,
  newRefDes: string,
  instanceId: string,
  designId: number,
): BackAnnotationPatch {
  return {
    sourceType: 'pcb',
    sourceId: instanceId,
    targetInstanceId: instanceId,
    targetDesignId: designId,
    changes: {
      referenceDesignator: newRefDes,
      previousReferenceDesignator: oldRefDes,
    },
    timestamp: Date.now(),
  };
}

/**
 * Generate a back-annotation patch for a PCB property change.
 */
export function generatePcbPropertyAnnotation(
  instanceId: string,
  designId: number,
  property: string,
  newValue: unknown,
): BackAnnotationPatch {
  return {
    sourceType: 'pcb',
    sourceId: instanceId,
    targetInstanceId: instanceId,
    targetDesignId: designId,
    changes: {
      [property]: newValue,
    },
    timestamp: Date.now(),
  };
}
