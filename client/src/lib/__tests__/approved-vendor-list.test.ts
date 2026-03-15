import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  normalizeManufacturer,
  findAvlEntry,
  checkItemCompliance,
  checkBomCompliance,
  AvlManager,
  DEFAULT_AVL_ENTRIES,
  AVL_TIER_ORDER,
  AVL_TIER_LABELS,
} from '../approved-vendor-list';
import type { AvlEntry, AvlTier, BomComplianceResult } from '../approved-vendor-list';
import type { BomItem } from '@/lib/project-context';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeBomItem(overrides: Partial<BomItem> = {}): BomItem {
  return {
    id: '1',
    partNumber: 'LM7805',
    manufacturer: 'Texas Instruments',
    description: 'Linear voltage regulator 5V',
    quantity: 10,
    unitPrice: 0.5,
    totalPrice: 5,
    supplier: 'Digi-Key',
    stock: 100,
    status: 'In Stock',
    ...overrides,
  };
}

const AVL_TIERS: AvlTier[] = ['preferred', 'approved', 'restricted', 'blocked'];

// ---------------------------------------------------------------------------
// normalizeManufacturer
// ---------------------------------------------------------------------------

describe('normalizeManufacturer', () => {
  it('lowercases the input', () => {
    expect(normalizeManufacturer('Texas Instruments')).toBe('texas instruments');
  });

  it('trims whitespace', () => {
    expect(normalizeManufacturer('  Murata  ')).toBe('murata');
  });

  it('handles empty string', () => {
    expect(normalizeManufacturer('')).toBe('');
  });

  it('handles mixed case with whitespace', () => {
    expect(normalizeManufacturer('  ON Semiconductor  ')).toBe('on semiconductor');
  });
});

// ---------------------------------------------------------------------------
// findAvlEntry
// ---------------------------------------------------------------------------

describe('findAvlEntry', () => {
  const entries: AvlEntry[] = [
    { manufacturer: 'Texas Instruments', tier: 'preferred', addedAt: '2026-01-01T00:00:00Z' },
    { manufacturer: 'Murata', tier: 'approved', addedAt: '2026-01-01T00:00:00Z' },
    { manufacturer: 'Generic', tier: 'restricted', addedAt: '2026-01-01T00:00:00Z' },
  ];

  it('finds an entry by exact name', () => {
    const result = findAvlEntry('Texas Instruments', entries);
    expect(result).toBeDefined();
    expect(result?.tier).toBe('preferred');
  });

  it('matches case-insensitively', () => {
    const result = findAvlEntry('texas instruments', entries);
    expect(result).toBeDefined();
    expect(result?.manufacturer).toBe('Texas Instruments');
  });

  it('matches with extra whitespace', () => {
    const result = findAvlEntry('  Murata  ', entries);
    expect(result).toBeDefined();
    expect(result?.tier).toBe('approved');
  });

  it('returns undefined for unlisted manufacturer', () => {
    expect(findAvlEntry('Acme Corp', entries)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// checkItemCompliance
// ---------------------------------------------------------------------------

describe('checkItemCompliance', () => {
  const entries: AvlEntry[] = [
    { manufacturer: 'Texas Instruments', tier: 'preferred', addedAt: '2026-01-01T00:00:00Z' },
    { manufacturer: 'Murata', tier: 'approved', addedAt: '2026-01-01T00:00:00Z' },
    { manufacturer: 'Generic', tier: 'restricted', notes: 'Unbranded parts.', addedAt: '2026-01-01T00:00:00Z' },
    { manufacturer: 'Counterfeit Corp', tier: 'blocked', notes: 'Known counterfeiter.', addedAt: '2026-01-01T00:00:00Z' },
  ];

  it('marks preferred vendor as compliant', () => {
    const result = checkItemCompliance(makeBomItem({ manufacturer: 'Texas Instruments' }), entries);
    expect(result.tier).toBe('preferred');
    expect(result.compliant).toBe(true);
    expect(result.reason).toContain('Preferred');
  });

  it('marks approved vendor as compliant', () => {
    const result = checkItemCompliance(makeBomItem({ manufacturer: 'Murata' }), entries);
    expect(result.tier).toBe('approved');
    expect(result.compliant).toBe(true);
  });

  it('marks restricted vendor as non-compliant', () => {
    const result = checkItemCompliance(makeBomItem({ manufacturer: 'Generic' }), entries);
    expect(result.tier).toBe('restricted');
    expect(result.compliant).toBe(false);
    expect(result.reason).toContain('Unbranded parts.');
  });

  it('marks blocked vendor as non-compliant', () => {
    const result = checkItemCompliance(makeBomItem({ manufacturer: 'Counterfeit Corp' }), entries);
    expect(result.tier).toBe('blocked');
    expect(result.compliant).toBe(false);
    expect(result.reason).toContain('Known counterfeiter.');
  });

  it('marks unlisted vendor as non-compliant', () => {
    const result = checkItemCompliance(makeBomItem({ manufacturer: 'Acme Corp' }), entries);
    expect(result.tier).toBe('unlisted');
    expect(result.compliant).toBe(false);
    expect(result.reason).toContain('not in the Approved Vendor List');
  });

  it('includes the BOM item reference', () => {
    const item = makeBomItem({ id: '42', manufacturer: 'Murata' });
    const result = checkItemCompliance(item, entries);
    expect(result.bomItem).toBe(item);
  });

  it('handles restricted vendor without notes', () => {
    const noNotesEntries: AvlEntry[] = [
      { manufacturer: 'NoNotes', tier: 'restricted', addedAt: '2026-01-01T00:00:00Z' },
    ];
    const result = checkItemCompliance(makeBomItem({ manufacturer: 'NoNotes' }), noNotesEntries);
    expect(result.reason).toContain('review required');
  });

  it('handles blocked vendor without notes', () => {
    const noNotesEntries: AvlEntry[] = [
      { manufacturer: 'BadCo', tier: 'blocked', addedAt: '2026-01-01T00:00:00Z' },
    ];
    const result = checkItemCompliance(makeBomItem({ manufacturer: 'BadCo' }), noNotesEntries);
    expect(result.reason).toContain('do not use');
  });
});

// ---------------------------------------------------------------------------
// checkBomCompliance
// ---------------------------------------------------------------------------

describe('checkBomCompliance', () => {
  const entries: AvlEntry[] = [
    { manufacturer: 'Texas Instruments', tier: 'preferred', addedAt: '2026-01-01T00:00:00Z' },
    { manufacturer: 'Murata', tier: 'approved', addedAt: '2026-01-01T00:00:00Z' },
    { manufacturer: 'Generic', tier: 'restricted', notes: 'Unbranded.', addedAt: '2026-01-01T00:00:00Z' },
    { manufacturer: 'Counterfeit Corp', tier: 'blocked', notes: 'Fake.', addedAt: '2026-01-01T00:00:00Z' },
  ];

  it('returns overall compliant when all items are preferred/approved', () => {
    const bom = [
      makeBomItem({ id: '1', manufacturer: 'Texas Instruments' }),
      makeBomItem({ id: '2', manufacturer: 'Murata' }),
    ];
    const result = checkBomCompliance(bom, entries);
    expect(result.overallCompliant).toBe(true);
    expect(result.summary.preferred).toBe(1);
    expect(result.summary.approved).toBe(1);
    expect(result.summary.restricted).toBe(0);
    expect(result.summary.blocked).toBe(0);
    expect(result.summary.unlisted).toBe(0);
    expect(result.summary.total).toBe(2);
  });

  it('returns non-compliant when any item is blocked', () => {
    const bom = [
      makeBomItem({ id: '1', manufacturer: 'Texas Instruments' }),
      makeBomItem({ id: '2', manufacturer: 'Counterfeit Corp' }),
    ];
    const result = checkBomCompliance(bom, entries);
    expect(result.overallCompliant).toBe(false);
    expect(result.summary.blocked).toBe(1);
  });

  it('returns non-compliant when any item is restricted', () => {
    const bom = [
      makeBomItem({ id: '1', manufacturer: 'Murata' }),
      makeBomItem({ id: '2', manufacturer: 'Generic' }),
    ];
    const result = checkBomCompliance(bom, entries);
    expect(result.overallCompliant).toBe(false);
    expect(result.summary.restricted).toBe(1);
  });

  it('returns non-compliant when any item is unlisted', () => {
    const bom = [
      makeBomItem({ id: '1', manufacturer: 'Texas Instruments' }),
      makeBomItem({ id: '2', manufacturer: 'Unknown Vendor' }),
    ];
    const result = checkBomCompliance(bom, entries);
    expect(result.overallCompliant).toBe(false);
    expect(result.summary.unlisted).toBe(1);
  });

  it('handles empty BOM', () => {
    const result = checkBomCompliance([], entries);
    expect(result.overallCompliant).toBe(true);
    expect(result.summary.total).toBe(0);
    expect(result.score).toBe(100);
    expect(result.items).toHaveLength(0);
  });

  it('computes score based on tier weights', () => {
    // 1 preferred (100) + 1 approved (80) → avg = 90
    const bom = [
      makeBomItem({ id: '1', manufacturer: 'Texas Instruments' }),
      makeBomItem({ id: '2', manufacturer: 'Murata' }),
    ];
    const result = checkBomCompliance(bom, entries);
    expect(result.score).toBe(90);
  });

  it('computes score with mixed tiers', () => {
    // preferred(100) + blocked(0) → avg = 50
    const bom = [
      makeBomItem({ id: '1', manufacturer: 'Texas Instruments' }),
      makeBomItem({ id: '2', manufacturer: 'Counterfeit Corp' }),
    ];
    const result = checkBomCompliance(bom, entries);
    expect(result.score).toBe(50);
  });

  it('gives low score for all-unlisted BOM', () => {
    // unlisted = 20 per item
    const bom = [
      makeBomItem({ id: '1', manufacturer: 'Acme' }),
      makeBomItem({ id: '2', manufacturer: 'Foo' }),
    ];
    const result = checkBomCompliance(bom, entries);
    expect(result.score).toBe(20);
  });

  it('returns per-item results in order', () => {
    const bom = [
      makeBomItem({ id: '1', manufacturer: 'Texas Instruments' }),
      makeBomItem({ id: '2', manufacturer: 'Counterfeit Corp' }),
      makeBomItem({ id: '3', manufacturer: 'Murata' }),
    ];
    const result = checkBomCompliance(bom, entries);
    expect(result.items).toHaveLength(3);
    expect(result.items[0].tier).toBe('preferred');
    expect(result.items[1].tier).toBe('blocked');
    expect(result.items[2].tier).toBe('approved');
  });
});

// ---------------------------------------------------------------------------
// AVL_TIER_ORDER
// ---------------------------------------------------------------------------

describe('AVL_TIER_ORDER', () => {
  it('orders preferred < approved < restricted < blocked', () => {
    expect(AVL_TIER_ORDER.preferred).toBeLessThan(AVL_TIER_ORDER.approved);
    expect(AVL_TIER_ORDER.approved).toBeLessThan(AVL_TIER_ORDER.restricted);
    expect(AVL_TIER_ORDER.restricted).toBeLessThan(AVL_TIER_ORDER.blocked);
  });
});

// ---------------------------------------------------------------------------
// AVL_TIER_LABELS
// ---------------------------------------------------------------------------

describe('AVL_TIER_LABELS', () => {
  it('has entries for all 4 tiers plus unlisted', () => {
    expect(AVL_TIER_LABELS).toHaveProperty('preferred');
    expect(AVL_TIER_LABELS).toHaveProperty('approved');
    expect(AVL_TIER_LABELS).toHaveProperty('restricted');
    expect(AVL_TIER_LABELS).toHaveProperty('blocked');
    expect(AVL_TIER_LABELS).toHaveProperty('unlisted');
  });

  it('each entry has label, color, and description', () => {
    for (const key of [...AVL_TIERS, 'unlisted'] as const) {
      const entry = AVL_TIER_LABELS[key];
      expect(entry.label).toBeTruthy();
      expect(entry.color).toBeTruthy();
      expect(entry.description).toBeTruthy();
    }
  });
});

// ---------------------------------------------------------------------------
// DEFAULT_AVL_ENTRIES
// ---------------------------------------------------------------------------

describe('DEFAULT_AVL_ENTRIES', () => {
  it('has at least 20 built-in entries', () => {
    expect(DEFAULT_AVL_ENTRIES.length).toBeGreaterThanOrEqual(20);
  });

  it('includes all 4 tiers', () => {
    const tiers = new Set(DEFAULT_AVL_ENTRIES.map((e) => e.tier));
    expect(tiers.has('preferred')).toBe(true);
    expect(tiers.has('approved')).toBe(true);
    expect(tiers.has('restricted')).toBe(true);
    expect(tiers.has('blocked')).toBe(true);
  });

  it('every entry has a valid addedAt date', () => {
    for (const entry of DEFAULT_AVL_ENTRIES) {
      expect(new Date(entry.addedAt).toISOString()).toBe(entry.addedAt);
    }
  });

  it('has no duplicate manufacturers', () => {
    const names = DEFAULT_AVL_ENTRIES.map((e) => normalizeManufacturer(e.manufacturer));
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });
});

// ---------------------------------------------------------------------------
// AvlManager
// ---------------------------------------------------------------------------

describe('AvlManager', () => {
  beforeEach(() => {
    AvlManager.resetInstance();
    localStorage.clear();
  });

  it('returns a singleton instance', () => {
    const a = AvlManager.getInstance();
    const b = AvlManager.getInstance();
    expect(a).toBe(b);
  });

  it('loads default entries when localStorage is empty', () => {
    const mgr = AvlManager.getInstance();
    expect(mgr.getEntries()).toEqual(DEFAULT_AVL_ENTRIES);
  });

  it('loads entries from localStorage', () => {
    const custom: AvlEntry[] = [
      { manufacturer: 'Custom Co', tier: 'approved', addedAt: '2026-03-01T00:00:00Z' },
    ];
    localStorage.setItem('protopulse:avl-entries', JSON.stringify(custom));
    const mgr = AvlManager.getInstance();
    expect(mgr.getEntries()).toEqual(custom);
  });

  it('falls back to defaults on corrupted localStorage', () => {
    localStorage.setItem('protopulse:avl-entries', 'not valid json{{{');
    const mgr = AvlManager.getInstance();
    expect(mgr.getEntries()).toEqual(DEFAULT_AVL_ENTRIES);
  });

  it('falls back to defaults on empty array in localStorage', () => {
    localStorage.setItem('protopulse:avl-entries', '[]');
    const mgr = AvlManager.getInstance();
    expect(mgr.getEntries()).toEqual(DEFAULT_AVL_ENTRIES);
  });

  describe('addEntry', () => {
    it('adds a new entry', () => {
      const mgr = AvlManager.getInstance();
      const initialCount = mgr.getEntries().length;
      mgr.addEntry({ manufacturer: 'New Vendor', tier: 'approved' });
      expect(mgr.getEntries().length).toBe(initialCount + 1);
      const added = mgr.getEntries().find((e) => e.manufacturer === 'New Vendor');
      expect(added).toBeDefined();
      expect(added?.tier).toBe('approved');
      expect(added?.addedAt).toBeTruthy();
    });

    it('updates existing entry instead of duplicating', () => {
      const mgr = AvlManager.getInstance();
      const initialCount = mgr.getEntries().length;
      mgr.addEntry({ manufacturer: 'Texas Instruments', tier: 'restricted', notes: 'Lead time issue' });
      expect(mgr.getEntries().length).toBe(initialCount); // No new entry
      const updated = mgr.getEntries().find(
        (e) => normalizeManufacturer(e.manufacturer) === 'texas instruments',
      );
      expect(updated?.tier).toBe('restricted');
      expect(updated?.notes).toBe('Lead time issue');
    });

    it('persists to localStorage', () => {
      const mgr = AvlManager.getInstance();
      mgr.addEntry({ manufacturer: 'Persisted Co', tier: 'preferred' });
      const stored = JSON.parse(localStorage.getItem('protopulse:avl-entries') ?? '[]') as AvlEntry[];
      expect(stored.some((e) => e.manufacturer === 'Persisted Co')).toBe(true);
    });

    it('notifies subscribers', () => {
      const mgr = AvlManager.getInstance();
      const listener = vi.fn();
      mgr.subscribe(listener);
      mgr.addEntry({ manufacturer: 'Subscriber Co', tier: 'approved' });
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe('removeEntry', () => {
    it('removes an entry by manufacturer name', () => {
      const mgr = AvlManager.getInstance();
      const hasTI = mgr.getEntries().some((e) => normalizeManufacturer(e.manufacturer) === 'texas instruments');
      expect(hasTI).toBe(true);
      mgr.removeEntry('Texas Instruments');
      const afterRemove = mgr.getEntries().some(
        (e) => normalizeManufacturer(e.manufacturer) === 'texas instruments',
      );
      expect(afterRemove).toBe(false);
    });

    it('is case-insensitive', () => {
      const mgr = AvlManager.getInstance();
      mgr.removeEntry('TEXAS INSTRUMENTS');
      expect(
        mgr.getEntries().some((e) => normalizeManufacturer(e.manufacturer) === 'texas instruments'),
      ).toBe(false);
    });

    it('does nothing for non-existent manufacturer', () => {
      const mgr = AvlManager.getInstance();
      const before = mgr.getEntries().length;
      mgr.removeEntry('Does Not Exist');
      expect(mgr.getEntries().length).toBe(before);
    });
  });

  describe('updateEntry', () => {
    it('updates tier of an existing entry', () => {
      const mgr = AvlManager.getInstance();
      mgr.updateEntry('Texas Instruments', { tier: 'restricted' });
      const entry = findAvlEntry('Texas Instruments', mgr.getEntries());
      expect(entry?.tier).toBe('restricted');
    });

    it('updates notes of an existing entry', () => {
      const mgr = AvlManager.getInstance();
      mgr.updateEntry('Texas Instruments', { notes: 'Supply chain issues' });
      const entry = findAvlEntry('Texas Instruments', mgr.getEntries());
      expect(entry?.notes).toBe('Supply chain issues');
    });

    it('is case-insensitive', () => {
      const mgr = AvlManager.getInstance();
      mgr.updateEntry('texas instruments', { tier: 'blocked' });
      const entry = findAvlEntry('Texas Instruments', mgr.getEntries());
      expect(entry?.tier).toBe('blocked');
    });
  });

  describe('resetToDefaults', () => {
    it('restores default entries', () => {
      const mgr = AvlManager.getInstance();
      mgr.addEntry({ manufacturer: 'Custom', tier: 'approved' });
      mgr.removeEntry('Texas Instruments');
      mgr.resetToDefaults();
      expect(mgr.getEntries()).toEqual(DEFAULT_AVL_ENTRIES);
    });
  });

  describe('subscribe', () => {
    it('returns an unsubscribe function', () => {
      const mgr = AvlManager.getInstance();
      const listener = vi.fn();
      const unsub = mgr.subscribe(listener);
      mgr.addEntry({ manufacturer: 'Sub1', tier: 'approved' });
      expect(listener).toHaveBeenCalledTimes(1);
      unsub();
      mgr.addEntry({ manufacturer: 'Sub2', tier: 'approved' });
      expect(listener).toHaveBeenCalledTimes(1); // Not called again
    });
  });

  describe('getSortedEntries', () => {
    it('sorts by tier order then alphabetically', () => {
      const mgr = AvlManager.getInstance();
      const sorted = mgr.getSortedEntries();
      // All preferred entries should come before approved
      const firstApprovedIdx = sorted.findIndex((e) => e.tier === 'approved');
      const lastPreferredIdx = sorted.reduce(
        (last, e, i) => (e.tier === 'preferred' ? i : last),
        -1,
      );
      if (firstApprovedIdx !== -1 && lastPreferredIdx !== -1) {
        expect(lastPreferredIdx).toBeLessThan(firstApprovedIdx);
      }
    });

    it('alphabetizes within same tier', () => {
      const mgr = AvlManager.getInstance();
      const sorted = mgr.getSortedEntries();
      const preferred = sorted.filter((e) => e.tier === 'preferred');
      for (let i = 1; i < preferred.length; i++) {
        expect(
          preferred[i - 1].manufacturer.localeCompare(preferred[i].manufacturer),
        ).toBeLessThanOrEqual(0);
      }
    });
  });

  describe('getSnapshot', () => {
    it('returns the same reference as getEntries', () => {
      const mgr = AvlManager.getInstance();
      expect(mgr.getSnapshot()).toBe(mgr.getEntries());
    });
  });
});
