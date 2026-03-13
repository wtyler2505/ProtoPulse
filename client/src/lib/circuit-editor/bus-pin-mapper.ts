/**
 * BusPinMapper — singleton+subscribe pattern for bus signal assignment.
 *
 * Manages named buses with individual signal-to-pin mapping.
 * Supports auto-assignment by prefix (e.g. "D0–D7 → data bus"),
 * validation for gaps/conflicts, and useSyncExternalStore compatibility.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BusSignal {
  /** Zero-based bit index within the bus. */
  bitIndex: number;
  /** Human-readable signal name (e.g. "D0", "A3"). null if unmapped. */
  signalName: string | null;
  /** Circuit net ID this signal is routed to. null if unmapped. */
  netId: string | null;
}

export interface BusDefinition {
  /** Unique identifier. */
  id: string;
  /** Human-readable bus name (e.g. "data", "address"). */
  name: string;
  /** Bus width in bits (1–64). */
  width: number;
  /** Per-bit signal assignments. Length always equals `width`. */
  signals: BusSignal[];
}

export interface BusConflict {
  /** Bit index where the conflict was detected. */
  bitIndex: number;
  /** Signal name assigned to this bit. */
  signalName: string;
  /** Description of what it conflicts with. */
  conflictsWith: string;
}

export interface BusValidation {
  /** True if no gaps, no conflicts, and all bits are mapped. */
  valid: boolean;
  /** Number of bits with no signal assigned. */
  unmappedCount: number;
  /** Duplicate signal names or duplicate net IDs within the bus. */
  conflicts: BusConflict[];
  /** Bit indices that are unmapped (gaps in an otherwise mapped bus). */
  gaps: number[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_BUS_WIDTH = 64;
const STORAGE_KEY = 'protopulse:bus-pin-mapper';

// ---------------------------------------------------------------------------
// Listener type
// ---------------------------------------------------------------------------

type Listener = () => void;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  return `bus-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function createEmptySignals(width: number): BusSignal[] {
  const signals: BusSignal[] = [];
  for (let i = 0; i < width; i++) {
    signals.push({ bitIndex: i, signalName: null, netId: null });
  }
  return signals;
}

/**
 * Extract a numeric suffix from a signal/net name.
 * Examples: "D7" → 7, "A15" → 15, "GPIO_12" → 12, "data3" → 3
 */
function extractNumericSuffix(name: string): number | null {
  const match = /(\d+)\s*$/.exec(name);
  if (!match) {
    return null;
  }
  return parseInt(match[1], 10);
}

/**
 * Check whether a name starts with a given prefix (case-insensitive),
 * and the remainder is purely numeric.
 */
function matchesPrefix(name: string, prefix: string): boolean {
  if (prefix.length === 0) {
    return false;
  }
  const lower = name.toLowerCase();
  const prefixLower = prefix.toLowerCase();
  if (!lower.startsWith(prefixLower)) {
    return false;
  }
  const remainder = name.slice(prefix.length).trim();
  // Allow optional separator: "_", "-", or nothing, followed by digits
  const cleaned = remainder.replace(/^[_-]/, '');
  return /^\d+$/.test(cleaned);
}

// ---------------------------------------------------------------------------
// BusPinMapper implementation
// ---------------------------------------------------------------------------

class BusPinMapperImpl {
  private buses = new Map<string, BusDefinition>();
  private listeners = new Set<Listener>();
  /** Monotonic version counter for useSyncExternalStore. */
  private _version = 0;

  constructor() {
    this.load();
  }

  /** Current version — changes on every mutation. */
  get version(): number {
    return this._version;
  }

  // ---- Bus CRUD ----

  /**
   * Create a new named bus with the given width.
   * @throws if name is empty, width is out of range, or a bus with the same name exists.
   */
  createBus(name: string, width: number): BusDefinition {
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      throw new Error('Bus name cannot be empty.');
    }
    if (width < 1 || width > MAX_BUS_WIDTH || !Number.isInteger(width)) {
      throw new Error(`Bus width must be an integer between 1 and ${MAX_BUS_WIDTH}.`);
    }
    // Check for duplicate names (case-insensitive)
    for (const bus of Array.from(this.buses.values())) {
      if (bus.name.toLowerCase() === trimmed.toLowerCase()) {
        throw new Error(`A bus named "${bus.name}" already exists.`);
      }
    }

    const bus: BusDefinition = {
      id: generateId(),
      name: trimmed,
      width,
      signals: createEmptySignals(width),
    };

    this.buses.set(bus.id, bus);
    this._version++;
    this.persist();
    this.notify();
    return { ...bus, signals: bus.signals.map((s) => ({ ...s })) };
  }

  /**
   * Delete a bus by ID.
   * No-op if the bus does not exist.
   */
  deleteBus(busId: string): void {
    if (!this.buses.has(busId)) {
      return;
    }
    this.buses.delete(busId);
    this._version++;
    this.persist();
    this.notify();
  }

  /** Get all bus definitions (deep copy). */
  getBusDefinitions(): BusDefinition[] {
    return Array.from(this.buses.values()).map((b) => ({
      ...b,
      signals: b.signals.map((s) => ({ ...s })),
    }));
  }

  /** Find a bus by exact name (case-insensitive). Returns null if not found. */
  getBusByName(name: string): BusDefinition | null {
    const lower = name.toLowerCase();
    for (const bus of Array.from(this.buses.values())) {
      if (bus.name.toLowerCase() === lower) {
        return { ...bus, signals: bus.signals.map((s) => ({ ...s })) };
      }
    }
    return null;
  }

  /** Find a bus by ID. Returns null if not found. */
  getBusById(busId: string): BusDefinition | null {
    const bus = this.buses.get(busId);
    if (!bus) {
      return null;
    }
    return { ...bus, signals: bus.signals.map((s) => ({ ...s })) };
  }

  // ---- Signal assignment ----

  /**
   * Assign a signal name and optional net ID to a specific bit of a bus.
   * @throws if bus not found or bitIndex out of range.
   */
  assignSignal(busId: string, bitIndex: number, signalName: string, netId?: string): void {
    const bus = this.buses.get(busId);
    if (!bus) {
      throw new Error(`Bus "${busId}" not found.`);
    }
    if (bitIndex < 0 || bitIndex >= bus.width || !Number.isInteger(bitIndex)) {
      throw new Error(`Bit index ${bitIndex} is out of range for bus "${bus.name}" (width ${bus.width}).`);
    }

    bus.signals[bitIndex] = {
      bitIndex,
      signalName: signalName.trim() || null,
      netId: netId ?? null,
    };

    this._version++;
    this.persist();
    this.notify();
  }

  /**
   * Clear the signal assignment at a specific bit of a bus.
   * @throws if bus not found or bitIndex out of range.
   */
  unassignSignal(busId: string, bitIndex: number): void {
    const bus = this.buses.get(busId);
    if (!bus) {
      throw new Error(`Bus "${busId}" not found.`);
    }
    if (bitIndex < 0 || bitIndex >= bus.width || !Number.isInteger(bitIndex)) {
      throw new Error(`Bit index ${bitIndex} is out of range for bus "${bus.name}" (width ${bus.width}).`);
    }

    bus.signals[bitIndex] = { bitIndex, signalName: null, netId: null };

    this._version++;
    this.persist();
    this.notify();
  }

  // ---- Auto-assign ----

  /**
   * Auto-assign nets to bus signals by matching a prefix pattern.
   * For example, prefix "D" matches nets "D0", "D1", ..., "D7" and assigns
   * them to the corresponding bit indices.
   *
   * @returns The number of signals that were successfully assigned.
   */
  autoAssignByPrefix(
    busId: string,
    prefix: string,
    nets: { id: string; name: string }[],
  ): number {
    const bus = this.buses.get(busId);
    if (!bus) {
      throw new Error(`Bus "${busId}" not found.`);
    }
    if (!prefix || prefix.trim().length === 0) {
      return 0;
    }

    const trimmedPrefix = prefix.trim();
    let assignedCount = 0;

    for (const net of nets) {
      if (!matchesPrefix(net.name, trimmedPrefix)) {
        continue;
      }
      const idx = extractNumericSuffix(net.name);
      if (idx === null || idx < 0 || idx >= bus.width) {
        continue;
      }

      bus.signals[idx] = {
        bitIndex: idx,
        signalName: net.name,
        netId: net.id,
      };
      assignedCount++;
    }

    if (assignedCount > 0) {
      this._version++;
      this.persist();
      this.notify();
    }

    return assignedCount;
  }

  // ---- Validation ----

  /**
   * Validate a bus for gaps, conflicts (duplicate signal names or net IDs),
   * and unmapped pins.
   */
  validateBus(busId: string): BusValidation {
    const bus = this.buses.get(busId);
    if (!bus) {
      return { valid: false, unmappedCount: 0, conflicts: [], gaps: [] };
    }

    const gaps: number[] = [];
    const conflicts: BusConflict[] = [];
    let unmappedCount = 0;

    // Track signal names and net IDs for duplicate detection
    const seenSignalNames = new Map<string, number>(); // signalName → first bitIndex
    const seenNetIds = new Map<string, number>(); // netId → first bitIndex

    for (const signal of bus.signals) {
      if (signal.signalName === null) {
        unmappedCount++;
        gaps.push(signal.bitIndex);
        continue;
      }

      // Check for duplicate signal names
      const nameLower = signal.signalName.toLowerCase();
      const prevNameIdx = seenSignalNames.get(nameLower);
      if (prevNameIdx !== undefined) {
        conflicts.push({
          bitIndex: signal.bitIndex,
          signalName: signal.signalName,
          conflictsWith: `Duplicate signal name at bit ${prevNameIdx}`,
        });
      } else {
        seenSignalNames.set(nameLower, signal.bitIndex);
      }

      // Check for duplicate net IDs
      if (signal.netId !== null) {
        const prevNetIdx = seenNetIds.get(signal.netId);
        if (prevNetIdx !== undefined) {
          conflicts.push({
            bitIndex: signal.bitIndex,
            signalName: signal.signalName,
            conflictsWith: `Duplicate net ID "${signal.netId}" at bit ${prevNetIdx}`,
          });
        } else {
          seenNetIds.set(signal.netId, signal.bitIndex);
        }
      }
    }

    return {
      valid: unmappedCount === 0 && conflicts.length === 0,
      unmappedCount,
      conflicts,
      gaps,
    };
  }

  // ---- Bulk clear ----

  /** Remove all buses and reset state. */
  clearAll(): void {
    this.buses.clear();
    this._version++;
    this.persist();
    this.notify();
  }

  // ---- Subscribe pattern ----

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  // ---- Internal ----

  private notify(): void {
    Array.from(this.listeners).forEach((listener) => {
      listener();
    });
  }

  private persist(): void {
    try {
      const data = Array.from(this.buses.values());
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // localStorage may be unavailable
    }
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return;
      }
      const data = JSON.parse(raw) as BusDefinition[];
      if (!Array.isArray(data)) {
        return;
      }
      for (const bus of data) {
        if (
          typeof bus.id === 'string' &&
          typeof bus.name === 'string' &&
          typeof bus.width === 'number' &&
          Array.isArray(bus.signals)
        ) {
          this.buses.set(bus.id, bus);
        }
      }
    } catch {
      // Ignore corrupt data
    }
  }
}

/** Singleton instance. */
export const busPinMapper = new BusPinMapperImpl();
