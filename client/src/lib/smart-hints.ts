/**
 * Smart Hints Manager
 *
 * Detects repeated user mistakes and surfaces contextual hints.
 * Tracks mistake occurrences per pattern, and when a threshold is reached,
 * activates a hint that the UI can display as a non-intrusive toast.
 *
 * Usage:
 *   const manager = SmartHintManager.getInstance();
 *   manager.trackMistake('drc-repeated-violations');
 *   const hints = manager.getActiveHints();
 *
 * React hook:
 *   const { activeHints, trackMistake, dismissHint } = useSmartHints();
 */

import { useCallback, useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type HintSeverity = 'info' | 'warning' | 'tip';

export interface MistakePattern {
  /** Unique identifier for this pattern. */
  id: string;
  /** Human-readable label for internal reference. */
  label: string;
  /** Number of occurrences required before the hint fires. */
  threshold: number;
  /** The hint message shown to the user when threshold is reached. */
  hint: string;
  /** Visual severity of the hint toast. */
  severity: HintSeverity;
  /** Optional category for grouping related patterns. */
  category?: string;
  /** Cooldown in ms before the same hint can re-activate after dismissal. */
  cooldownMs: number;
}

export interface MistakeRecord {
  /** Pattern ID. */
  patternId: string;
  /** How many times the mistake has been tracked since last reset. */
  count: number;
  /** Timestamp of the first occurrence in the current window. */
  firstSeen: number;
  /** Timestamp of the most recent occurrence. */
  lastSeen: number;
}

export interface ActiveHint {
  /** Pattern ID that triggered this hint. */
  patternId: string;
  /** The hint message. */
  hint: string;
  /** Severity level. */
  severity: HintSeverity;
  /** Pattern label. */
  label: string;
  /** Category, if any. */
  category?: string;
  /** When the hint was activated. */
  activatedAt: number;
}

interface DismissedRecord {
  patternId: string;
  dismissedAt: number;
}

interface PersistedState {
  records: MistakeRecord[];
  dismissed: DismissedRecord[];
}

// ---------------------------------------------------------------------------
// Built-in mistake patterns (10+)
// ---------------------------------------------------------------------------

export const BUILT_IN_PATTERNS: MistakePattern[] = [
  {
    id: 'drc-repeated-violations',
    label: 'Repeated DRC Violations',
    threshold: 3,
    hint: 'You have triggered DRC violations multiple times. Consider reviewing the Design Rule Check explanations in the Validation view to understand clearance and connectivity requirements.',
    severity: 'warning',
    category: 'validation',
    cooldownMs: 30 * 60 * 1000, // 30 min
  },
  {
    id: 'export-without-validation',
    label: 'Export Without Validation',
    threshold: 2,
    hint: 'You have exported designs without running validation first. Running DRC before export catches errors early and avoids manufacturing issues.',
    severity: 'warning',
    category: 'export',
    cooldownMs: 60 * 60 * 1000, // 1 hour
  },
  {
    id: 'bom-missing-mpn',
    label: 'BOM Items Missing MPN',
    threshold: 3,
    hint: 'Several BOM items are missing Manufacturer Part Numbers (MPN). Adding MPNs ensures accurate procurement and avoids ordering wrong components.',
    severity: 'tip',
    category: 'bom',
    cooldownMs: 60 * 60 * 1000,
  },
  {
    id: 'circuit-no-ground',
    label: 'Circuit Without Ground',
    threshold: 2,
    hint: 'Your circuit appears to have no ground connection. Every circuit needs a ground reference for proper operation. Add a GND node to your schematic.',
    severity: 'warning',
    category: 'circuit',
    cooldownMs: 30 * 60 * 1000,
  },
  {
    id: 'schematic-unconnected-pins',
    label: 'Unconnected Schematic Pins',
    threshold: 3,
    hint: 'Multiple unconnected pins detected. Floating pins can cause unpredictable behavior. Mark intentionally unconnected pins with a "no-connect" flag or wire them appropriately.',
    severity: 'warning',
    category: 'circuit',
    cooldownMs: 30 * 60 * 1000,
  },
  {
    id: 'simulation-no-probes',
    label: 'Running Simulation Without Probes',
    threshold: 2,
    hint: 'You ran a simulation without placing any probes. Add voltage or current probes to observe signals at specific nodes.',
    severity: 'tip',
    category: 'simulation',
    cooldownMs: 30 * 60 * 1000,
  },
  {
    id: 'pcb-clearance-violations',
    label: 'PCB Clearance Violations',
    threshold: 3,
    hint: 'Repeated PCB clearance violations detected. Check your net class rules and ensure trace spacing meets your manufacturer\'s capabilities.',
    severity: 'warning',
    category: 'pcb',
    cooldownMs: 30 * 60 * 1000,
  },
  {
    id: 'bom-duplicate-entries',
    label: 'Duplicate BOM Entries',
    threshold: 2,
    hint: 'Duplicate items found in the BOM. Consider merging entries with the same part number and adjusting quantities to keep the bill of materials clean.',
    severity: 'tip',
    category: 'bom',
    cooldownMs: 60 * 60 * 1000,
  },
  {
    id: 'architecture-orphan-nodes',
    label: 'Orphan Architecture Nodes',
    threshold: 3,
    hint: 'Several architecture blocks have no connections. Orphan nodes may indicate missing data flow or power connections in your system design.',
    severity: 'info',
    category: 'architecture',
    cooldownMs: 60 * 60 * 1000,
  },
  {
    id: 'compile-repeated-errors',
    label: 'Repeated Compile Errors',
    threshold: 4,
    hint: 'The same compile error keeps recurring. Check the error details carefully — the Knowledge Hub may have articles explaining common Arduino/firmware mistakes.',
    severity: 'tip',
    category: 'firmware',
    cooldownMs: 15 * 60 * 1000, // 15 min
  },
  {
    id: 'missing-bypass-caps',
    label: 'Missing Bypass Capacitors',
    threshold: 2,
    hint: 'ICs in your design may be missing bypass capacitors. Place 100nF ceramic capacitors close to each IC power pin for stable operation.',
    severity: 'tip',
    category: 'circuit',
    cooldownMs: 60 * 60 * 1000,
  },
  {
    id: 'footprint-mismatch',
    label: 'Footprint Mismatch',
    threshold: 2,
    hint: 'Component footprints may not match their symbols. Verify pad counts and spacing before ordering PCBs to avoid assembly issues.',
    severity: 'warning',
    category: 'pcb',
    cooldownMs: 60 * 60 * 1000,
  },
];

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'protopulse-smart-hints';

// ---------------------------------------------------------------------------
// SmartHintManager
// ---------------------------------------------------------------------------

/**
 * Manages mistake tracking and contextual hint activation.
 * Singleton per application. Notifies subscribers on state changes.
 */
export class SmartHintManager {
  private static instance: SmartHintManager | null = null;

  private patterns: Map<string, MistakePattern>;
  private records: Map<string, MistakeRecord>;
  private dismissed: Map<string, DismissedRecord>;
  private subscribers: Set<() => void>;

  constructor() {
    this.patterns = new Map();
    this.records = new Map();
    this.dismissed = new Map();
    this.subscribers = new Set();

    // Register built-in patterns
    for (const pattern of BUILT_IN_PATTERNS) {
      this.patterns.set(pattern.id, pattern);
    }

    this.load();
  }

  /** Get or create the singleton instance. */
  static getInstance(): SmartHintManager {
    if (!SmartHintManager.instance) {
      SmartHintManager.instance = new SmartHintManager();
    }
    return SmartHintManager.instance;
  }

  /** Reset the singleton (useful for testing). */
  static resetInstance(): void {
    SmartHintManager.instance = null;
  }

  // -----------------------------------------------------------------------
  // Pattern registration
  // -----------------------------------------------------------------------

  /** Register a custom mistake pattern. Overwrites if the ID already exists. */
  registerPattern(pattern: MistakePattern): void {
    this.patterns.set(pattern.id, pattern);
  }

  /** Get a pattern definition by ID. */
  getPattern(patternId: string): MistakePattern | undefined {
    return this.patterns.get(patternId);
  }

  /** Get all registered patterns. */
  getAllPatterns(): MistakePattern[] {
    return Array.from(this.patterns.values());
  }

  // -----------------------------------------------------------------------
  // Tracking
  // -----------------------------------------------------------------------

  /**
   * Track a mistake occurrence for the given pattern ID.
   * Increments the count and updates timestamps.
   * If the threshold is reached, the hint becomes active.
   */
  trackMistake(patternId: string): void {
    const pattern = this.patterns.get(patternId);
    if (!pattern) {
      return; // Unknown pattern — silently ignore
    }

    const now = Date.now();
    const existing = this.records.get(patternId);

    if (existing) {
      existing.count += 1;
      existing.lastSeen = now;
    } else {
      this.records.set(patternId, {
        patternId,
        count: 1,
        firstSeen: now,
        lastSeen: now,
      });
    }

    this.save();
    this.notify();
  }

  /** Get the current mistake record for a pattern. */
  getRecord(patternId: string): MistakeRecord | undefined {
    return this.records.get(patternId);
  }

  /** Get all mistake records. */
  getAllRecords(): MistakeRecord[] {
    return Array.from(this.records.values());
  }

  /** Reset the count for a specific pattern. */
  resetPattern(patternId: string): void {
    const had = this.records.delete(patternId);
    if (had) {
      this.save();
      this.notify();
    }
  }

  /** Clear all mistake records and dismissed state. */
  clearAll(): void {
    if (this.records.size === 0 && this.dismissed.size === 0) {
      return;
    }
    this.records.clear();
    this.dismissed.clear();
    this.save();
    this.notify();
  }

  // -----------------------------------------------------------------------
  // Active hints
  // -----------------------------------------------------------------------

  /**
   * Get all currently active hints.
   * A hint is active when:
   * 1. Its pattern's threshold has been reached
   * 2. It hasn't been dismissed (or the cooldown has expired)
   */
  getActiveHints(): ActiveHint[] {
    const now = Date.now();
    const active: ActiveHint[] = [];

    for (const [patternId, record] of Array.from(this.records.entries())) {
      const pattern = this.patterns.get(patternId);
      if (!pattern) {
        continue;
      }

      // Check threshold
      if (record.count < pattern.threshold) {
        continue;
      }

      // Check dismissal cooldown
      const dismissal = this.dismissed.get(patternId);
      if (dismissal) {
        const elapsed = now - dismissal.dismissedAt;
        if (elapsed < pattern.cooldownMs) {
          continue; // Still in cooldown
        }
      }

      active.push({
        patternId,
        hint: pattern.hint,
        severity: pattern.severity,
        label: pattern.label,
        category: pattern.category,
        activatedAt: record.lastSeen,
      });
    }

    // Sort by most recent activation first
    return active.sort((a, b) => b.activatedAt - a.activatedAt);
  }

  /** Check if a specific pattern has an active hint. */
  isHintActive(patternId: string): boolean {
    return this.getActiveHints().some((h) => h.patternId === patternId);
  }

  // -----------------------------------------------------------------------
  // Dismissal
  // -----------------------------------------------------------------------

  /**
   * Dismiss a hint. The hint will not show again until the cooldown expires
   * and the threshold is re-reached after the count is reset.
   */
  dismissHint(patternId: string): void {
    this.dismissed.set(patternId, {
      patternId,
      dismissedAt: Date.now(),
    });
    // Reset the count so the user has to re-trigger it
    this.records.delete(patternId);
    this.save();
    this.notify();
  }

  /** Check if a hint is currently dismissed and in cooldown. */
  isDismissed(patternId: string): boolean {
    const dismissal = this.dismissed.get(patternId);
    if (!dismissal) {
      return false;
    }
    const pattern = this.patterns.get(patternId);
    if (!pattern) {
      return false;
    }
    const elapsed = Date.now() - dismissal.dismissedAt;
    return elapsed < pattern.cooldownMs;
  }

  // -----------------------------------------------------------------------
  // Subscription
  // -----------------------------------------------------------------------

  /**
   * Subscribe to state changes. Returns an unsubscribe function.
   * Callback is invoked whenever hints are tracked, dismissed, or cleared.
   */
  subscribe(callback: () => void): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  // -----------------------------------------------------------------------
  // Persistence
  // -----------------------------------------------------------------------

  /** Persist state to localStorage. */
  private save(): void {
    try {
      if (typeof window === 'undefined') {
        return;
      }
      const state: PersistedState = {
        records: Array.from(this.records.values()),
        dismissed: Array.from(this.dismissed.values()),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // localStorage may be unavailable or quota exceeded
    }
  }

  /** Load state from localStorage. */
  private load(): void {
    try {
      if (typeof window === 'undefined') {
        return;
      }
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return;
      }
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') {
        return;
      }

      const state = parsed as Partial<PersistedState>;

      // Validate and load records
      if (Array.isArray(state.records)) {
        for (const item of state.records) {
          if (
            typeof item === 'object' &&
            item !== null &&
            typeof (item as MistakeRecord).patternId === 'string' &&
            typeof (item as MistakeRecord).count === 'number' &&
            typeof (item as MistakeRecord).firstSeen === 'number' &&
            typeof (item as MistakeRecord).lastSeen === 'number'
          ) {
            const record = item as MistakeRecord;
            this.records.set(record.patternId, record);
          }
        }
      }

      // Validate and load dismissed
      if (Array.isArray(state.dismissed)) {
        for (const item of state.dismissed) {
          if (
            typeof item === 'object' &&
            item !== null &&
            typeof (item as DismissedRecord).patternId === 'string' &&
            typeof (item as DismissedRecord).dismissedAt === 'number'
          ) {
            const record = item as DismissedRecord;
            this.dismissed.set(record.patternId, record);
          }
        }
      }
    } catch {
      // Corrupt data — start fresh
      this.records.clear();
      this.dismissed.clear();
    }
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  /** Notify all subscribers of a state change. */
  private notify(): void {
    this.subscribers.forEach((cb) => {
      cb();
    });
  }
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

/**
 * Hook for accessing smart hints in React components.
 * Subscribes to the SmartHintManager and triggers re-renders on state changes.
 */
export function useSmartHints(): {
  activeHints: ActiveHint[];
  trackMistake: (patternId: string) => void;
  dismissHint: (patternId: string) => void;
  isHintActive: (patternId: string) => boolean;
  clearAll: () => void;
} {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const manager = SmartHintManager.getInstance();
    const unsubscribe = manager.subscribe(() => {
      setTick((t) => t + 1);
    });
    return unsubscribe;
  }, []);

  const trackMistake = useCallback((patternId: string) => {
    SmartHintManager.getInstance().trackMistake(patternId);
  }, []);

  const dismissHint = useCallback((patternId: string) => {
    SmartHintManager.getInstance().dismissHint(patternId);
  }, []);

  const isHintActive = useCallback((patternId: string) => {
    return SmartHintManager.getInstance().isHintActive(patternId);
  }, []);

  const clearAll = useCallback(() => {
    SmartHintManager.getInstance().clearAll();
  }, []);

  const manager = SmartHintManager.getInstance();

  return {
    activeHints: typeof window !== 'undefined' ? manager.getActiveHints() : [],
    trackMistake,
    dismissHint,
    isHintActive,
    clearAll,
  };
}
