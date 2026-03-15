/**
 * Beginner Mode — Simplified UI Labels
 *
 * Provides a toggle to replace technical EDA terminology with
 * beginner-friendly plain-English labels throughout the UI.
 * Persists preference to localStorage.
 *
 * Usage:
 *   const bm = BeginnerMode.getInstance();
 *   bm.enable();
 *   bm.getLabel('Architecture');  // → 'Block Diagram'
 *   bm.getLabel('DRC');           // → 'Design Check'
 *
 * React hook:
 *   const { isEnabled, toggle, getLabel } = useBeginnerMode();
 */

import { useCallback, useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'protopulse-beginner-mode';

/**
 * Map from technical EDA terms to beginner-friendly equivalents.
 * Keys are compared case-insensitively.
 */
export const SIMPLIFIED_LABELS: ReadonlyMap<string, string> = new Map([
  ['Architecture', 'Block Diagram'],
  ['Schematic', 'Wiring Diagram'],
  ['DRC', 'Design Check'],
  ['ERC', 'Electrical Check'],
  ['BOM', 'Parts List'],
  ['Procurement', 'Parts & Sourcing'],
  ['Gerber', 'Manufacturing Files'],
  ['Netlist', 'Connection List'],
  ['PCB', 'Circuit Board'],
  ['Component Editor', 'Part Designer'],
  ['Simulation', 'Virtual Test'],
  ['Validation', 'Design Check'],
  ['Lifecycle', 'Part Health'],
  ['Generative', 'AI Designer'],
  ['Digital Twin', 'Live Hardware View'],
  ['Serial Monitor', 'Device Console'],
  ['Calculators', 'Quick Math'],
  ['Exports', 'Output Files'],
  ['Circuit Code', 'Code Editor'],
  ['Starter Circuits', 'Ready-Made Circuits'],
]);

/** Pre-built lowercase→simplified lookup for O(1) case-insensitive matching. */
const LOWER_LABEL_MAP: ReadonlyMap<string, string> = (() => {
  const m = new Map<string, string>();
  Array.from(SIMPLIFIED_LABELS.entries()).forEach(([key, value]) => {
    m.set(key.toLowerCase(), value);
  });
  return m;
})();

// ---------------------------------------------------------------------------
// BeginnerMode singleton
// ---------------------------------------------------------------------------

export class BeginnerMode {
  private static instance: BeginnerMode | null = null;

  private enabled: boolean;
  private subscribers: Set<() => void>;

  constructor() {
    this.enabled = false;
    this.subscribers = new Set();
    this.load();
  }

  static getInstance(): BeginnerMode {
    if (!BeginnerMode.instance) {
      BeginnerMode.instance = new BeginnerMode();
    }
    return BeginnerMode.instance;
  }

  /** Reset the singleton (useful for testing). */
  static resetInstance(): void {
    BeginnerMode.instance = null;
  }

  // -----------------------------------------------------------------------
  // State
  // -----------------------------------------------------------------------

  isEnabled(): boolean {
    return this.enabled;
  }

  enable(): void {
    if (!this.enabled) {
      this.enabled = true;
      this.save();
      this.notify();
    }
  }

  disable(): void {
    if (this.enabled) {
      this.enabled = false;
      this.save();
      this.notify();
    }
  }

  toggle(): void {
    this.enabled = !this.enabled;
    this.save();
    this.notify();
  }

  // -----------------------------------------------------------------------
  // Label resolution
  // -----------------------------------------------------------------------

  /**
   * Returns the simplified label when beginner mode is enabled.
   * Falls back to the original term if no mapping exists or mode is off.
   * Comparison is case-insensitive.
   */
  getLabel(technicalTerm: string): string {
    if (!this.enabled) {
      return technicalTerm;
    }
    return LOWER_LABEL_MAP.get(technicalTerm.toLowerCase()) ?? technicalTerm;
  }

  // -----------------------------------------------------------------------
  // Persistence
  // -----------------------------------------------------------------------

  private load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === 'true') {
        this.enabled = true;
      }
    } catch {
      // localStorage unavailable — stay disabled
    }
  }

  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, String(this.enabled));
    } catch {
      // localStorage full or unavailable
    }
  }

  // -----------------------------------------------------------------------
  // Subscribe / notify
  // -----------------------------------------------------------------------

  subscribe(callback: () => void): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  private notify(): void {
    Array.from(this.subscribers).forEach((cb) => {
      cb();
    });
  }
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

export interface UseBeginnerModeResult {
  isEnabled: boolean;
  enable: () => void;
  disable: () => void;
  toggle: () => void;
  getLabel: (technicalTerm: string) => string;
}

export function useBeginnerMode(): UseBeginnerModeResult {
  const bm = BeginnerMode.getInstance();
  const [isEnabled, setIsEnabled] = useState(bm.isEnabled());

  useEffect(() => {
    return bm.subscribe(() => {
      setIsEnabled(bm.isEnabled());
    });
  }, [bm]);

  const enable = useCallback(() => bm.enable(), [bm]);
  const disable = useCallback(() => bm.disable(), [bm]);
  const toggle = useCallback(() => bm.toggle(), [bm]);
  const getLabel = useCallback(
    (term: string) => bm.getLabel(term),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bm, isEnabled],
  );

  return { isEnabled, enable, disable, toggle, getLabel };
}
