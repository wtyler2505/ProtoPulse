/**
 * DiffPairManager — Differential pair definitions, protocol presets,
 * and DRC checking for controlled-impedance pair routing.
 *
 * All dimensions in mm, skew in ps. Pure class, no React/DOM dependencies.
 * Subscribe pattern for UI integration (same as FlexZoneManager).
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DiffPairProtocol = 'USB 2.0' | 'USB 3.0' | 'HDMI' | 'LVDS' | 'PCIe' | 'Ethernet' | 'Custom';

export interface ProtocolPreset {
  targetImpedance: number; // ohms
  traceWidth: number; // mm
  gap: number; // mm
  maxSkewPs: number; // ps
  maxUncoupledPct: number; // percent
}

export interface DiffPairDefinition {
  id: string;
  netIdP: string;
  netIdN: string;
  protocol: DiffPairProtocol;
  traceWidth: number; // mm
  gap: number; // mm
  targetImpedance: number; // ohms
  maxSkewPs: number; // ps
  maxUncoupledPct: number; // percent
}

export interface AddPairInput {
  id: string;
  netIdP: string;
  netIdN: string;
  protocol: DiffPairProtocol;
  traceWidth?: number;
  gap?: number;
  targetImpedance?: number;
  maxSkewPs?: number;
  maxUncoupledPct?: number;
}

export interface DiffPairMeasurement {
  lengthP: number; // mm
  lengthN: number; // mm
  gapActual: number; // mm
  widthActual: number; // mm
  uncoupledLength: number; // mm
}

export interface DiffPairDrcViolation {
  type: 'diff-pair-gap' | 'diff-pair-width' | 'diff-pair-skew' | 'diff-pair-uncoupled';
  message: string;
  pairId: string;
  severity: 'error' | 'warning';
}

export interface SerializedDiffPairManager {
  pairs: DiffPairDefinition[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Propagation delay constant: ~6.5 ps/mm for FR-4 outer-layer microstrip. */
const PROP_DELAY_PS_PER_MM = 6.5;

// ---------------------------------------------------------------------------
// Protocol Presets
// ---------------------------------------------------------------------------

export const PROTOCOL_PRESETS: Record<DiffPairProtocol, ProtocolPreset> = {
  'USB 2.0': {
    targetImpedance: 90,
    traceWidth: 0.15,
    gap: 0.15,
    maxSkewPs: 50,
    maxUncoupledPct: 10,
  },
  'USB 3.0': {
    targetImpedance: 85,
    traceWidth: 0.127,
    gap: 0.127,
    maxSkewPs: 15,
    maxUncoupledPct: 5,
  },
  'HDMI': {
    targetImpedance: 100,
    traceWidth: 0.15,
    gap: 0.18,
    maxSkewPs: 20,
    maxUncoupledPct: 10,
  },
  'LVDS': {
    targetImpedance: 100,
    traceWidth: 0.15,
    gap: 0.2,
    maxSkewPs: 50,
    maxUncoupledPct: 15,
  },
  'PCIe': {
    targetImpedance: 85,
    traceWidth: 0.127,
    gap: 0.127,
    maxSkewPs: 15,
    maxUncoupledPct: 5,
  },
  'Ethernet': {
    targetImpedance: 100,
    traceWidth: 0.2,
    gap: 0.15,
    maxSkewPs: 50,
    maxUncoupledPct: 15,
  },
  'Custom': {
    targetImpedance: 100,
    traceWidth: 0.15,
    gap: 0.15,
    maxSkewPs: 25,
    maxUncoupledPct: 10,
  },
};

// ---------------------------------------------------------------------------
// Listener type
// ---------------------------------------------------------------------------

type Listener = () => void;

// ---------------------------------------------------------------------------
// DiffPairManager
// ---------------------------------------------------------------------------

/**
 * Manages differential pair definitions, validates against protocol presets,
 * and runs DRC checks on routed pair measurements.
 *
 * Use `DiffPairManager.create()` factory for new instances (testing-friendly).
 * Subscribe pattern for reactive UI integration.
 */
export class DiffPairManager {
  private pairs = new Map<string, DiffPairDefinition>();
  private listeners = new Set<Listener>();

  private constructor() {}

  /** Factory — creates a fresh instance (testing-friendly, no global singleton). */
  static create(): DiffPairManager {
    return new DiffPairManager();
  }

  // -----------------------------------------------------------------------
  // Subscription
  // -----------------------------------------------------------------------

  /** Subscribe to change notifications. Returns an unsubscribe function. */
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    Array.from(this.listeners).forEach((l) => {
      l();
    });
  }

  // -----------------------------------------------------------------------
  // Pair CRUD
  // -----------------------------------------------------------------------

  /**
   * Add a differential pair. Auto-populates width/gap/impedance/skew from
   * the protocol preset unless explicitly overridden.
   *
   * @throws if id is duplicate, net already assigned, or P === N.
   */
  addPair(input: AddPairInput): void {
    if (this.pairs.has(input.id)) {
      throw new Error(`Duplicate diff pair id: "${input.id}"`);
    }

    if (input.netIdP === input.netIdN) {
      throw new Error('Positive and negative nets must be different');
    }

    // Check that neither net is already assigned to another pair
    const existingP = this.findPairByNet(input.netIdP);
    if (existingP) {
      throw new Error(`Net "${input.netIdP}" is already assigned to pair "${existingP.id}"`);
    }
    const existingN = this.findPairByNet(input.netIdN);
    if (existingN) {
      throw new Error(`Net "${input.netIdN}" is already assigned to pair "${existingN.id}"`);
    }

    const preset = PROTOCOL_PRESETS[input.protocol];
    const definition: DiffPairDefinition = {
      id: input.id,
      netIdP: input.netIdP,
      netIdN: input.netIdN,
      protocol: input.protocol,
      traceWidth: input.traceWidth ?? preset.traceWidth,
      gap: input.gap ?? preset.gap,
      targetImpedance: input.targetImpedance ?? preset.targetImpedance,
      maxSkewPs: input.maxSkewPs ?? preset.maxSkewPs,
      maxUncoupledPct: input.maxUncoupledPct ?? preset.maxUncoupledPct,
    };

    this.pairs.set(input.id, definition);
    this.notify();
  }

  /**
   * Remove a differential pair by ID.
   * @throws if pair not found.
   */
  removePair(id: string): void {
    if (!this.pairs.has(id)) {
      throw new Error(`Diff pair not found: "${id}"`);
    }
    this.pairs.delete(id);
    this.notify();
  }

  /** Partially update a differential pair. */
  updatePair(id: string, updates: Partial<DiffPairDefinition>): void {
    const pair = this.pairs.get(id);
    if (!pair) {
      throw new Error(`Diff pair not found: "${id}"`);
    }
    const updated: DiffPairDefinition = { ...pair, ...updates, id: pair.id };
    this.pairs.set(id, updated);
    this.notify();
  }

  /** Get a single pair by ID (defensive copy). */
  getPair(id: string): DiffPairDefinition | undefined {
    const pair = this.pairs.get(id);
    if (!pair) {
      return undefined;
    }
    return { ...pair };
  }

  /** Get all pairs (defensive copies). */
  getPairs(): DiffPairDefinition[] {
    return Array.from(this.pairs.values()).map((p) => ({ ...p }));
  }

  /** Find the pair that contains the given net ID (P or N). */
  getPairByNetId(netId: string): DiffPairDefinition | undefined {
    const found = this.findPairByNet(netId);
    if (!found) {
      return undefined;
    }
    return { ...found };
  }

  // -----------------------------------------------------------------------
  // DRC
  // -----------------------------------------------------------------------

  /**
   * Check all pairs against measured routing data.
   *
   * Violations:
   * - `diff-pair-gap`: actual gap < target gap * 0.9
   * - `diff-pair-width`: actual width < target width * 0.9
   * - `diff-pair-skew`: |lengthP - lengthN| * 6.5 ps/mm > maxSkewPs
   * - `diff-pair-uncoupled`: uncoupledLength > avgLength * maxUncoupledPct / 100
   *
   * Pairs with no measurement data are skipped.
   */
  checkDrc(measurements: Record<string, DiffPairMeasurement>): DiffPairDrcViolation[] {
    const violations: DiffPairDrcViolation[] = [];

    Array.from(this.pairs.values()).forEach((pair) => {
      const m = measurements[pair.id];
      if (!m) {
        return; // skip pairs with no measurement
      }

      // Gap check
      if (m.gapActual < pair.gap * 0.9) {
        violations.push({
          type: 'diff-pair-gap',
          message: `Pair "${pair.id}" gap ${String(m.gapActual.toFixed(3))}mm < ${String((pair.gap * 0.9).toFixed(3))}mm (90% of ${String(pair.gap.toFixed(3))}mm target)`,
          pairId: pair.id,
          severity: 'error',
        });
      }

      // Width check
      if (m.widthActual < pair.traceWidth * 0.9) {
        violations.push({
          type: 'diff-pair-width',
          message: `Pair "${pair.id}" width ${String(m.widthActual.toFixed(3))}mm < ${String((pair.traceWidth * 0.9).toFixed(3))}mm (90% of ${String(pair.traceWidth.toFixed(3))}mm target)`,
          pairId: pair.id,
          severity: 'error',
        });
      }

      // Skew check
      const deltaLength = Math.abs(m.lengthP - m.lengthN);
      const skewPs = deltaLength * PROP_DELAY_PS_PER_MM;
      if (skewPs > pair.maxSkewPs) {
        violations.push({
          type: 'diff-pair-skew',
          message: `Pair "${pair.id}" skew ${String(skewPs.toFixed(1))}ps exceeds max ${String(pair.maxSkewPs)}ps (delta ${String(deltaLength.toFixed(2))}mm)`,
          pairId: pair.id,
          severity: 'error',
        });
      }

      // Uncoupled length check
      const avgLength = (m.lengthP + m.lengthN) / 2;
      const maxUncoupled = avgLength * pair.maxUncoupledPct / 100;
      if (m.uncoupledLength > maxUncoupled) {
        violations.push({
          type: 'diff-pair-uncoupled',
          message: `Pair "${pair.id}" uncoupled length ${String(m.uncoupledLength.toFixed(2))}mm > ${String(maxUncoupled.toFixed(2))}mm (${String(pair.maxUncoupledPct)}% of avg length)`,
          pairId: pair.id,
          severity: 'warning',
        });
      }
    });

    return violations;
  }

  // -----------------------------------------------------------------------
  // Serialization
  // -----------------------------------------------------------------------

  /** Serialize to a plain object for JSON persistence. */
  toJSON(): SerializedDiffPairManager {
    return {
      pairs: this.getPairs(),
    };
  }

  /**
   * Restore a DiffPairManager from serialized data.
   * @throws if data is not a valid object with a `pairs` array.
   */
  static fromJSON(data: unknown): DiffPairManager {
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      throw new Error('Invalid DiffPairManager data: expected an object');
    }
    const obj = data as Record<string, unknown>;
    if (!Array.isArray(obj.pairs)) {
      throw new Error('Invalid DiffPairManager data: missing "pairs" array');
    }

    const mgr = DiffPairManager.create();
    const pairs = obj.pairs as DiffPairDefinition[];
    for (const pair of pairs) {
      // Directly set rather than going through addPair validation
      // (the data was already valid when serialized)
      mgr.pairs.set(pair.id, { ...pair });
    }
    return mgr;
  }

  // -----------------------------------------------------------------------
  // Internal helpers
  // -----------------------------------------------------------------------

  private findPairByNet(netId: string): DiffPairDefinition | undefined {
    const entries = Array.from(this.pairs.values());
    return entries.find((p) => p.netIdP === netId || p.netIdN === netId);
  }
}
