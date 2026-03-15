/**
 * Approved Vendor List (AVL) Enforcement Library
 *
 * Manages a tiered manufacturer approval list and checks BOM compliance.
 * Four tiers: preferred > approved > restricted > blocked.
 * ~20 built-in manufacturers. Singleton + subscribe pattern for state.
 * Persists to localStorage.
 *
 * Usage:
 *   const avl = AvlManager.getInstance();
 *   avl.addEntry({ manufacturer: 'Texas Instruments', tier: 'preferred' });
 *   const result = checkBomCompliance(bom, avl.getEntries());
 *
 * React hook:
 *   const { entries, addEntry, removeEntry, updateEntry, compliance } = useAvl(bom);
 */

import { useState, useCallback, useMemo, useSyncExternalStore } from 'react';
import type { BomItem } from '@/lib/project-context';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AvlTier = 'preferred' | 'approved' | 'restricted' | 'blocked';

export interface AvlEntry {
  /** Canonical manufacturer name (case-insensitive matching) */
  manufacturer: string;
  tier: AvlTier;
  /** Optional notes (e.g. "restricted due to lead times") */
  notes?: string;
  /** ISO date when this entry was added */
  addedAt: string;
}

export interface BomComplianceItem {
  bomItem: BomItem;
  tier: AvlTier | 'unlisted';
  compliant: boolean;
  reason: string;
}

export interface BomComplianceResult {
  items: BomComplianceItem[];
  overallCompliant: boolean;
  summary: {
    preferred: number;
    approved: number;
    restricted: number;
    blocked: number;
    unlisted: number;
    total: number;
  };
  score: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'protopulse:avl-entries';

export const AVL_TIER_ORDER: Record<AvlTier, number> = {
  preferred: 0,
  approved: 1,
  restricted: 2,
  blocked: 3,
};

export const AVL_TIER_LABELS: Record<AvlTier | 'unlisted', { label: string; color: string; description: string }> = {
  preferred: {
    label: 'Preferred',
    color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30',
    description: 'First-choice vendors — best pricing, reliability, and support.',
  },
  approved: {
    label: 'Approved',
    color: 'text-blue-400 bg-blue-400/10 border-blue-400/30',
    description: 'Qualified vendors — acceptable for production use.',
  },
  restricted: {
    label: 'Restricted',
    color: 'text-amber-400 bg-amber-400/10 border-amber-400/30',
    description: 'Use with caution — known issues or limited availability.',
  },
  blocked: {
    label: 'Blocked',
    color: 'text-red-400 bg-red-400/10 border-red-400/30',
    description: 'Do not use — quality, compliance, or EOL concerns.',
  },
  unlisted: {
    label: 'Unlisted',
    color: 'text-muted-foreground bg-muted/10 border-muted-foreground/30',
    description: 'Not in AVL — review and classify before production.',
  },
};

/** Built-in manufacturers with default tiers. */
export const DEFAULT_AVL_ENTRIES: AvlEntry[] = [
  // Preferred — major distributors with broad portfolio and strong support
  { manufacturer: 'Texas Instruments', tier: 'preferred', addedAt: '2026-01-01T00:00:00Z' },
  { manufacturer: 'Microchip', tier: 'preferred', addedAt: '2026-01-01T00:00:00Z' },
  { manufacturer: 'STMicroelectronics', tier: 'preferred', addedAt: '2026-01-01T00:00:00Z' },
  { manufacturer: 'Analog Devices', tier: 'preferred', addedAt: '2026-01-01T00:00:00Z' },
  { manufacturer: 'NXP Semiconductors', tier: 'preferred', addedAt: '2026-01-01T00:00:00Z' },
  // Approved — solid, widely used manufacturers
  { manufacturer: 'Murata', tier: 'approved', addedAt: '2026-01-01T00:00:00Z' },
  { manufacturer: 'Samsung Electro-Mechanics', tier: 'approved', addedAt: '2026-01-01T00:00:00Z' },
  { manufacturer: 'Vishay', tier: 'approved', addedAt: '2026-01-01T00:00:00Z' },
  { manufacturer: 'YAGEO', tier: 'approved', addedAt: '2026-01-01T00:00:00Z' },
  { manufacturer: 'TE Connectivity', tier: 'approved', addedAt: '2026-01-01T00:00:00Z' },
  { manufacturer: 'Molex', tier: 'approved', addedAt: '2026-01-01T00:00:00Z' },
  { manufacturer: 'ON Semiconductor', tier: 'approved', addedAt: '2026-01-01T00:00:00Z' },
  { manufacturer: 'Infineon', tier: 'approved', addedAt: '2026-01-01T00:00:00Z' },
  { manufacturer: 'Rohm', tier: 'approved', addedAt: '2026-01-01T00:00:00Z' },
  { manufacturer: 'Renesas', tier: 'approved', addedAt: '2026-01-01T00:00:00Z' },
  { manufacturer: 'Espressif', tier: 'approved', addedAt: '2026-01-01T00:00:00Z' },
  { manufacturer: 'Bosch Sensortec', tier: 'approved', addedAt: '2026-01-01T00:00:00Z' },
  // Restricted — usable but with caveats
  { manufacturer: 'Generic', tier: 'restricted', notes: 'Unbranded parts — verify specs independently.', addedAt: '2026-01-01T00:00:00Z' },
  { manufacturer: 'Unknown', tier: 'restricted', notes: 'Manufacturer not identified — requires qualification.', addedAt: '2026-01-01T00:00:00Z' },
  // Blocked — example placeholder
  { manufacturer: 'Counterfeit Corp', tier: 'blocked', notes: 'Known counterfeiter — never use.', addedAt: '2026-01-01T00:00:00Z' },
];

// ---------------------------------------------------------------------------
// Core Logic (pure functions)
// ---------------------------------------------------------------------------

/**
 * Normalize manufacturer name for case-insensitive matching.
 * Trims whitespace and lowercases.
 */
export function normalizeManufacturer(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Look up the AVL entry for a given manufacturer name.
 * Returns undefined if the manufacturer is not in the list.
 */
export function findAvlEntry(manufacturer: string, entries: AvlEntry[]): AvlEntry | undefined {
  const normalized = normalizeManufacturer(manufacturer);
  return entries.find((e) => normalizeManufacturer(e.manufacturer) === normalized);
}

/**
 * Check a single BOM item against the AVL.
 */
export function checkItemCompliance(item: BomItem, entries: AvlEntry[]): BomComplianceItem {
  const entry = findAvlEntry(item.manufacturer, entries);

  if (!entry) {
    return {
      bomItem: item,
      tier: 'unlisted',
      compliant: false,
      reason: `Manufacturer "${item.manufacturer}" is not in the Approved Vendor List.`,
    };
  }

  switch (entry.tier) {
    case 'preferred':
      return { bomItem: item, tier: 'preferred', compliant: true, reason: 'Preferred vendor.' };
    case 'approved':
      return { bomItem: item, tier: 'approved', compliant: true, reason: 'Approved vendor.' };
    case 'restricted':
      return {
        bomItem: item,
        tier: 'restricted',
        compliant: false,
        reason: entry.notes ? `Restricted: ${entry.notes}` : 'Restricted vendor — review required.',
      };
    case 'blocked':
      return {
        bomItem: item,
        tier: 'blocked',
        compliant: false,
        reason: entry.notes ? `Blocked: ${entry.notes}` : 'Blocked vendor — do not use.',
      };
  }
}

/**
 * Check an entire BOM against the AVL.
 * Returns per-item results, overall compliance, summary counts, and a score (0-100).
 */
export function checkBomCompliance(bom: BomItem[], entries: AvlEntry[]): BomComplianceResult {
  const items = bom.map((item) => checkItemCompliance(item, entries));

  const summary = { preferred: 0, approved: 0, restricted: 0, blocked: 0, unlisted: 0, total: bom.length };
  for (const item of items) {
    if (item.tier === 'preferred') { summary.preferred++; }
    else if (item.tier === 'approved') { summary.approved++; }
    else if (item.tier === 'restricted') { summary.restricted++; }
    else if (item.tier === 'blocked') { summary.blocked++; }
    else { summary.unlisted++; }
  }

  const overallCompliant = items.every((i) => i.compliant);

  // Score: preferred=100, approved=80, restricted=30, blocked=0, unlisted=20
  const weights: Record<AvlTier | 'unlisted', number> = {
    preferred: 100,
    approved: 80,
    restricted: 30,
    blocked: 0,
    unlisted: 20,
  };
  const score = bom.length > 0
    ? Math.round(items.reduce((sum, i) => sum + weights[i.tier], 0) / bom.length)
    : 100;

  return { items, overallCompliant, summary, score };
}

// ---------------------------------------------------------------------------
// AvlManager (singleton + subscribe)
// ---------------------------------------------------------------------------

type Listener = () => void;

export class AvlManager {
  private static instance: AvlManager | null = null;
  private entries: AvlEntry[];
  private listeners = new Set<Listener>();

  private constructor() {
    this.entries = AvlManager.loadFromStorage();
  }

  static getInstance(): AvlManager {
    if (!AvlManager.instance) {
      AvlManager.instance = new AvlManager();
    }
    return AvlManager.instance;
  }

  /** Reset for testing */
  static resetInstance(): void {
    AvlManager.instance = null;
  }

  private static loadFromStorage(): AvlEntry[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed as AvlEntry[];
        }
      }
    } catch { /* fall through */ }
    return [...DEFAULT_AVL_ENTRIES];
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.entries));
    } catch { /* quota */ }
  }

  private notify(): void {
    for (const listener of Array.from(this.listeners)) {
      listener();
    }
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  getEntries(): AvlEntry[] {
    return this.entries;
  }

  getSnapshot(): AvlEntry[] {
    return this.entries;
  }

  addEntry(entry: Omit<AvlEntry, 'addedAt'>): void {
    const normalized = normalizeManufacturer(entry.manufacturer);
    const existing = this.entries.findIndex((e) => normalizeManufacturer(e.manufacturer) === normalized);
    if (existing !== -1) {
      // Update existing instead of duplicating
      this.entries = this.entries.map((e, i) =>
        i === existing ? { ...e, tier: entry.tier, notes: entry.notes } : e,
      );
    } else {
      this.entries = [...this.entries, { ...entry, addedAt: new Date().toISOString() }];
    }
    this.persist();
    this.notify();
  }

  removeEntry(manufacturer: string): void {
    const normalized = normalizeManufacturer(manufacturer);
    this.entries = this.entries.filter((e) => normalizeManufacturer(e.manufacturer) !== normalized);
    this.persist();
    this.notify();
  }

  updateEntry(manufacturer: string, updates: Partial<Pick<AvlEntry, 'tier' | 'notes'>>): void {
    const normalized = normalizeManufacturer(manufacturer);
    this.entries = this.entries.map((e) =>
      normalizeManufacturer(e.manufacturer) === normalized ? { ...e, ...updates } : e,
    );
    this.persist();
    this.notify();
  }

  resetToDefaults(): void {
    this.entries = [...DEFAULT_AVL_ENTRIES];
    this.persist();
    this.notify();
  }

  /** Sort entries by tier order, then alphabetically. */
  getSortedEntries(): AvlEntry[] {
    return [...this.entries].sort((a, b) => {
      const tierDiff = AVL_TIER_ORDER[a.tier] - AVL_TIER_ORDER[b.tier];
      if (tierDiff !== 0) { return tierDiff; }
      return a.manufacturer.localeCompare(b.manufacturer);
    });
  }
}

// ---------------------------------------------------------------------------
// React Hook
// ---------------------------------------------------------------------------

export function useAvl(bom: BomItem[]) {
  const manager = useMemo(() => AvlManager.getInstance(), []);

  const entries = useSyncExternalStore(
    useCallback((cb: () => void) => manager.subscribe(cb), [manager]),
    () => manager.getSnapshot(),
  );

  const addEntry = useCallback(
    (entry: Omit<AvlEntry, 'addedAt'>) => { manager.addEntry(entry); },
    [manager],
  );

  const removeEntry = useCallback(
    (manufacturer: string) => { manager.removeEntry(manufacturer); },
    [manager],
  );

  const updateEntry = useCallback(
    (manufacturer: string, updates: Partial<Pick<AvlEntry, 'tier' | 'notes'>>) => {
      manager.updateEntry(manufacturer, updates);
    },
    [manager],
  );

  const resetToDefaults = useCallback(() => { manager.resetToDefaults(); }, [manager]);

  const sortedEntries = useMemo(() => {
    return [...entries].sort((a, b) => {
      const tierDiff = AVL_TIER_ORDER[a.tier] - AVL_TIER_ORDER[b.tier];
      if (tierDiff !== 0) { return tierDiff; }
      return a.manufacturer.localeCompare(b.manufacturer);
    });
  }, [entries]);

  const compliance = useMemo(() => checkBomCompliance(bom, entries), [bom, entries]);

  // Filter state for the UI
  const [tierFilter, setTierFilter] = useState<AvlTier | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredEntries = useMemo(() => {
    let result = sortedEntries;
    if (tierFilter !== 'all') {
      result = result.filter((e) => e.tier === tierFilter);
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (e) =>
          e.manufacturer.toLowerCase().includes(term) ||
          (e.notes?.toLowerCase().includes(term) ?? false),
      );
    }
    return result;
  }, [sortedEntries, tierFilter, searchTerm]);

  return {
    entries,
    sortedEntries,
    filteredEntries,
    addEntry,
    removeEntry,
    updateEntry,
    resetToDefaults,
    compliance,
    tierFilter,
    setTierFilter,
    searchTerm,
    setSearchTerm,
  };
}
