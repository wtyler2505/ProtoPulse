/**
 * NetClassRules — Per-net and per-class trace width, clearance, and via sizing
 * rules for PCB routing.
 *
 * Manages net class definitions and net-to-class assignments. The 'Default'
 * class always exists and cannot be removed or renamed. Unassigned nets
 * inherit the Default class rules.
 *
 * Impedance-aware width calculation delegates to BoardStackup when a stackup
 * is configured.
 *
 * Pure class — no React, no side effects beyond BoardStackup singleton access.
 */

import { BoardStackup } from '../board-stackup';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NetClass {
  name: string;
  traceWidth: number; // mm
  clearance: number; // mm
  viaDrill: number; // mm
  viaOuter: number; // mm
  diffPairWidth?: number; // mm (optional, for differential pairs)
  diffPairGap?: number; // mm (optional, for differential pairs)
}

export interface NetClassValidation {
  valid: boolean;
  errors: string[];
}

// ---------------------------------------------------------------------------
// Default net classes
// ---------------------------------------------------------------------------

export const DEFAULT_NET_CLASSES: Record<string, NetClass> = {
  Default: {
    name: 'Default',
    traceWidth: 0.254,
    clearance: 0.2,
    viaDrill: 0.3,
    viaOuter: 0.6,
  },
  Power: {
    name: 'Power',
    traceWidth: 0.5,
    clearance: 0.3,
    viaDrill: 0.4,
    viaOuter: 0.8,
  },
  'High-Speed': {
    name: 'High-Speed',
    traceWidth: 0.15,
    clearance: 0.15,
    viaDrill: 0.2,
    viaOuter: 0.45,
  },
};

// ---------------------------------------------------------------------------
// Serialized shape
// ---------------------------------------------------------------------------

interface SerializedNetClassManager {
  classes: NetClass[];
  assignments: Record<string, string>; // netId -> className
}

// ---------------------------------------------------------------------------
// NetClassManager
// ---------------------------------------------------------------------------

export class NetClassManager {
  private classes: Map<string, NetClass>;
  private assignments: Map<string, string>; // netId -> className

  constructor(classes?: NetClass[], assignments?: Map<string, string>) {
    this.classes = new Map<string, NetClass>();
    this.assignments = assignments ?? new Map<string, string>();

    if (classes) {
      for (const nc of classes) {
        this.classes.set(nc.name, { ...nc });
      }
    }

    // Ensure Default always exists
    if (!this.classes.has('Default')) {
      this.classes.set('Default', { ...DEFAULT_NET_CLASSES['Default'] });
    }
  }

  // -----------------------------------------------------------------------
  // Class CRUD
  // -----------------------------------------------------------------------

  getNetClasses(): NetClass[] {
    return Array.from(this.classes.values()).map((c) => ({ ...c }));
  }

  getNetClass(name: string): NetClass | undefined {
    const nc = this.classes.get(name);
    return nc ? { ...nc } : undefined;
  }

  addNetClass(netClass: NetClass): void {
    if (this.classes.has(netClass.name)) {
      throw new Error(`Net class "${netClass.name}" already exists`);
    }

    const validation = this.validateNetClass(netClass);
    if (!validation.valid) {
      throw new Error(`Invalid net class: ${validation.errors.join(', ')}`);
    }

    this.classes.set(netClass.name, { ...netClass });
  }

  updateNetClass(name: string, updates: Partial<NetClass>): void {
    const existing = this.classes.get(name);
    if (!existing) {
      throw new Error(`Net class "${name}" not found`);
    }

    // Prevent renaming Default
    if (name === 'Default' && updates.name !== undefined && updates.name !== 'Default') {
      throw new Error('Cannot rename the Default class');
    }

    // Check for name collision on rename
    if (updates.name !== undefined && updates.name !== name && this.classes.has(updates.name)) {
      throw new Error(`Net class "${updates.name}" already exists`);
    }

    // Build the merged class for validation
    const merged: NetClass = { ...existing, ...updates };

    const validation = this.validateNetClass(merged);
    if (!validation.valid) {
      throw new Error(`Invalid net class: ${validation.errors.join(', ')}`);
    }

    // Handle rename: update the map key and net assignments
    if (updates.name !== undefined && updates.name !== name) {
      this.classes.delete(name);
      this.classes.set(updates.name, merged);

      // Update all net assignments pointing to the old name
      for (const [netId, className] of Array.from(this.assignments.entries())) {
        if (className === name) {
          this.assignments.set(netId, updates.name);
        }
      }
    } else {
      this.classes.set(name, merged);
    }
  }

  removeNetClass(name: string): void {
    if (name === 'Default') {
      throw new Error('Cannot remove the Default class');
    }

    if (!this.classes.has(name)) {
      throw new Error(`Net class "${name}" not found`);
    }

    this.classes.delete(name);

    // Unassign any nets that were using this class
    for (const [netId, className] of Array.from(this.assignments.entries())) {
      if (className === name) {
        this.assignments.delete(netId);
      }
    }
  }

  // -----------------------------------------------------------------------
  // Net-to-class assignment
  // -----------------------------------------------------------------------

  assignNetToClass(netId: string, className: string): void {
    if (!this.classes.has(className)) {
      throw new Error(`Net class "${className}" not found`);
    }
    this.assignments.set(netId, className);
  }

  unassignNet(netId: string): void {
    this.assignments.delete(netId);
  }

  getClassForNet(netId: string): NetClass {
    const className = this.assignments.get(netId);
    if (className) {
      const nc = this.classes.get(className);
      if (nc) {
        return { ...nc };
      }
    }
    // Fallback to Default (always exists)
    return { ...this.classes.get('Default')! };
  }

  // -----------------------------------------------------------------------
  // Convenience getters for routing
  // -----------------------------------------------------------------------

  getTraceWidth(netId: string): number {
    return this.getClassForNet(netId).traceWidth;
  }

  getClearance(netId: string): number {
    return this.getClassForNet(netId).clearance;
  }

  getViaRules(netId: string): { drill: number; outer: number } {
    const nc = this.getClassForNet(netId);
    return { drill: nc.viaDrill, outer: nc.viaOuter };
  }

  // -----------------------------------------------------------------------
  // Validation
  // -----------------------------------------------------------------------

  validateNetClass(netClass: Partial<NetClass>): NetClassValidation {
    const errors: string[] = [];

    if (netClass.name !== undefined && netClass.name.trim().length === 0) {
      errors.push('name must be a non-empty string');
    }

    if (netClass.traceWidth !== undefined && netClass.traceWidth <= 0) {
      errors.push('traceWidth must be greater than 0');
    }

    if (netClass.clearance !== undefined && netClass.clearance <= 0) {
      errors.push('clearance must be greater than 0');
    }

    if (netClass.viaDrill !== undefined && netClass.viaDrill <= 0) {
      errors.push('viaDrill must be greater than 0');
    }

    if (
      netClass.viaOuter !== undefined &&
      netClass.viaDrill !== undefined &&
      netClass.viaOuter <= netClass.viaDrill
    ) {
      errors.push('viaOuter must be greater than viaDrill');
    }

    if (netClass.diffPairWidth !== undefined && netClass.diffPairGap !== undefined) {
      if (netClass.diffPairGap <= 0) {
        errors.push('diffPairGap must be greater than 0 when diffPairWidth is set');
      }
    }

    return { valid: errors.length === 0, errors };
  }

  // -----------------------------------------------------------------------
  // Impedance-aware width calculation
  // -----------------------------------------------------------------------

  /**
   * Calculate the trace width needed for a target impedance on a given layer.
   *
   * Uses the board stackup's impedance model with a binary search to find
   * the width that produces the target impedance. Returns null if no stackup
   * is configured or the layer cannot be found.
   *
   * @param targetZ - Target impedance in ohms
   * @param layerName - Stackup layer name (e.g. 'Top (Signal)')
   * @returns Trace width in mils, or null
   */
  calculateImpedanceWidth(targetZ: number, layerName: string): number | null {
    const stackup = BoardStackup.getInstance();
    const layers = stackup.getAllLayers();

    if (layers.length === 0) {
      return null;
    }

    // Find the layer by name
    const layer = layers.find((l) => l.name === layerName);
    if (!layer) {
      return null;
    }

    // Binary search for trace width that yields target impedance.
    // Impedance decreases as width increases, so we search accordingly.
    let lo = 0.5; // mils — minimum practical trace
    let hi = 200; // mils — very wide trace
    const maxIterations = 100;
    const tolerance = 0.1; // ohms

    for (let i = 0; i < maxIterations; i++) {
      const mid = (lo + hi) / 2;
      const result = stackup.calculateImpedance(layer.id, mid);

      if (!result.valid || result.microstrip <= 0) {
        // Can't compute — narrow the search toward wider traces
        lo = mid;
        continue;
      }

      const diff = result.microstrip - targetZ;

      if (Math.abs(diff) < tolerance) {
        // Convert mils to mm (1 mil = 0.0254 mm), round to 4 decimal places
        return Math.round(mid * 0.0254 * 10000) / 10000;
      }

      if (diff > 0) {
        // Impedance too high — need wider trace
        lo = mid;
      } else {
        // Impedance too low — need narrower trace
        hi = mid;
      }
    }

    // Return best approximation at midpoint
    const finalWidth = (lo + hi) / 2;
    return Math.round(finalWidth * 0.0254 * 10000) / 10000;
  }

  // -----------------------------------------------------------------------
  // Serialization
  // -----------------------------------------------------------------------

  toJSON(): SerializedNetClassManager {
    const assignmentsObj: Record<string, string> = {};
    for (const [netId, className] of Array.from(this.assignments.entries())) {
      assignmentsObj[netId] = className;
    }

    return {
      classes: this.getNetClasses(),
      assignments: assignmentsObj,
    };
  }

  static fromJSON(data: unknown): NetClassManager {
    if (typeof data !== 'object' || data === null) {
      throw new Error('Invalid data: expected an object');
    }

    const obj = data as Record<string, unknown>;

    if (!Array.isArray(obj.classes)) {
      throw new Error('Invalid data: missing "classes" array');
    }

    const classes = obj.classes as NetClass[];
    const assignments = new Map<string, string>();

    if (typeof obj.assignments === 'object' && obj.assignments !== null) {
      const rawAssignments = obj.assignments as Record<string, string>;
      for (const [netId, className] of Object.entries(rawAssignments)) {
        assignments.set(netId, className);
      }
    }

    return new NetClassManager(classes, assignments);
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Create a NetClassManager pre-loaded with the 3 default net classes. */
export function createDefaultNetClassManager(): NetClassManager {
  return new NetClassManager(Object.values(DEFAULT_NET_CLASSES));
}
