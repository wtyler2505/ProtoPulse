import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  BackAnnotationManager,
  findMatchingInstances,
  generateBomBackAnnotationPatch,
  type BackAnnotationPatch,
} from '../back-annotation';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeBomItem(overrides: Partial<{
  id: number;
  partNumber: string;
  manufacturer: string;
  description: string;
}> = {}) {
  return {
    id: overrides.id ?? 1,
    partNumber: overrides.partNumber ?? 'RC0402FR-0710KL',
    manufacturer: overrides.manufacturer ?? 'Yageo',
    description: overrides.description ?? '10K Resistor 0402',
  };
}

function makeInstance(overrides: Partial<{
  instanceId: string;
  label: string;
  componentId: string;
  properties: unknown;
}> = {}) {
  return {
    instanceId: overrides.instanceId ?? 'inst-001',
    label: overrides.label ?? 'R1',
    componentId: overrides.componentId ?? 'comp-res-10k',
    properties: overrides.properties ?? {},
  };
}

// ===========================================================================
// BackAnnotationManager — singleton & subscribe
// ===========================================================================

describe('BackAnnotationManager', () => {
  let manager: BackAnnotationManager;

  beforeEach(() => {
    BackAnnotationManager.resetInstance();
    manager = BackAnnotationManager.getInstance();
  });

  // -------------------------------------------------------------------------
  // Singleton
  // -------------------------------------------------------------------------

  describe('singleton', () => {
    it('returns the same instance on repeated calls', () => {
      const a = BackAnnotationManager.getInstance();
      const b = BackAnnotationManager.getInstance();
      expect(a).toBe(b);
    });

    it('creates a fresh instance after resetInstance', () => {
      manager.addPatch({
        sourceType: 'bom',
        sourceId: 1,
        targetInstanceId: 'inst-001',
        targetDesignId: 10,
        changes: { partNumber: 'NEW-PN' },
        timestamp: Date.now(),
      });
      BackAnnotationManager.resetInstance();
      const fresh = BackAnnotationManager.getInstance();
      expect(fresh.getPending()).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // addPatch / getPending / clearPending
  // -------------------------------------------------------------------------

  describe('patch CRUD', () => {
    it('starts with no pending patches', () => {
      expect(manager.getPending()).toHaveLength(0);
    });

    it('addPatch appends a patch to the queue', () => {
      const patch: BackAnnotationPatch = {
        sourceType: 'bom',
        sourceId: 1,
        targetInstanceId: 'inst-001',
        targetDesignId: 10,
        changes: { partNumber: 'NEW-PN' },
        timestamp: 1000,
      };
      manager.addPatch(patch);
      expect(manager.getPending()).toHaveLength(1);
      expect(manager.getPending()[0]).toEqual(patch);
    });

    it('addPatch appends multiple patches in order', () => {
      const p1: BackAnnotationPatch = {
        sourceType: 'bom',
        sourceId: 1,
        targetInstanceId: 'inst-001',
        targetDesignId: 10,
        changes: { partNumber: 'PN-A' },
        timestamp: 1000,
      };
      const p2: BackAnnotationPatch = {
        sourceType: 'pcb',
        sourceId: 'pcb-wire-99',
        targetInstanceId: 'inst-002',
        targetDesignId: 10,
        changes: { refDes: 'R2' },
        timestamp: 2000,
      };
      manager.addPatch(p1);
      manager.addPatch(p2);
      expect(manager.getPending()).toHaveLength(2);
      expect(manager.getPending()[0]).toEqual(p1);
      expect(manager.getPending()[1]).toEqual(p2);
    });

    it('clearPending removes all patches', () => {
      manager.addPatch({
        sourceType: 'bom',
        sourceId: 1,
        targetInstanceId: 'inst-001',
        targetDesignId: 10,
        changes: {},
        timestamp: 1000,
      });
      manager.addPatch({
        sourceType: 'bom',
        sourceId: 2,
        targetInstanceId: 'inst-002',
        targetDesignId: 10,
        changes: {},
        timestamp: 2000,
      });
      expect(manager.getPending()).toHaveLength(2);
      manager.clearPending();
      expect(manager.getPending()).toHaveLength(0);
    });

    it('getPending returns a copy, not the internal array', () => {
      manager.addPatch({
        sourceType: 'bom',
        sourceId: 1,
        targetInstanceId: 'inst-001',
        targetDesignId: 10,
        changes: {},
        timestamp: 1000,
      });
      const arr = manager.getPending();
      arr.pop();
      expect(manager.getPending()).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------------
  // getSnapshot
  // -------------------------------------------------------------------------

  describe('getSnapshot', () => {
    it('returns zero count when empty', () => {
      const snap = manager.getSnapshot();
      expect(snap.pendingCount).toBe(0);
      expect(snap.patches).toHaveLength(0);
    });

    it('returns correct count and patches', () => {
      manager.addPatch({
        sourceType: 'bom',
        sourceId: 1,
        targetInstanceId: 'inst-001',
        targetDesignId: 10,
        changes: { value: '22K' },
        timestamp: 1000,
      });
      manager.addPatch({
        sourceType: 'bom',
        sourceId: 2,
        targetInstanceId: 'inst-002',
        targetDesignId: 10,
        changes: { value: '47K' },
        timestamp: 2000,
      });
      const snap = manager.getSnapshot();
      expect(snap.pendingCount).toBe(2);
      expect(snap.patches).toHaveLength(2);
    });

    it('snapshot patches are a copy', () => {
      manager.addPatch({
        sourceType: 'bom',
        sourceId: 1,
        targetInstanceId: 'inst-001',
        targetDesignId: 10,
        changes: {},
        timestamp: 1000,
      });
      const snap = manager.getSnapshot();
      snap.patches.pop();
      expect(manager.getSnapshot().pendingCount).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // subscribe / notify
  // -------------------------------------------------------------------------

  describe('subscribe', () => {
    it('calls subscriber when a patch is added', () => {
      const listener = vi.fn();
      manager.subscribe(listener);
      manager.addPatch({
        sourceType: 'bom',
        sourceId: 1,
        targetInstanceId: 'inst-001',
        targetDesignId: 10,
        changes: {},
        timestamp: 1000,
      });
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('calls subscriber when patches are cleared', () => {
      const listener = vi.fn();
      manager.addPatch({
        sourceType: 'bom',
        sourceId: 1,
        targetInstanceId: 'inst-001',
        targetDesignId: 10,
        changes: {},
        timestamp: 1000,
      });
      manager.subscribe(listener);
      manager.clearPending();
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('unsubscribes correctly', () => {
      const listener = vi.fn();
      const unsub = manager.subscribe(listener);
      unsub();
      manager.addPatch({
        sourceType: 'bom',
        sourceId: 1,
        targetInstanceId: 'inst-001',
        targetDesignId: 10,
        changes: {},
        timestamp: 1000,
      });
      expect(listener).not.toHaveBeenCalled();
    });

    it('supports multiple subscribers', () => {
      const a = vi.fn();
      const b = vi.fn();
      manager.subscribe(a);
      manager.subscribe(b);
      manager.addPatch({
        sourceType: 'bom',
        sourceId: 1,
        targetInstanceId: 'inst-001',
        targetDesignId: 10,
        changes: {},
        timestamp: 1000,
      });
      expect(a).toHaveBeenCalledTimes(1);
      expect(b).toHaveBeenCalledTimes(1);
    });

    it('does not call an already unsubscribed listener on second add', () => {
      const listener = vi.fn();
      const unsub = manager.subscribe(listener);
      manager.addPatch({
        sourceType: 'bom',
        sourceId: 1,
        targetInstanceId: 'inst-001',
        targetDesignId: 10,
        changes: {},
        timestamp: 1000,
      });
      expect(listener).toHaveBeenCalledTimes(1);
      unsub();
      manager.addPatch({
        sourceType: 'bom',
        sourceId: 2,
        targetInstanceId: 'inst-002',
        targetDesignId: 10,
        changes: {},
        timestamp: 2000,
      });
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });
});

// ===========================================================================
// findMatchingInstances
// ===========================================================================

describe('findMatchingInstances', () => {
  it('matches by partNumber in instance properties', () => {
    const bom = makeBomItem({ partNumber: 'RC0402FR-0710KL' });
    const instances = [
      makeInstance({
        instanceId: 'inst-001',
        label: 'R1',
        properties: { partNumber: 'RC0402FR-0710KL' },
      }),
      makeInstance({
        instanceId: 'inst-002',
        label: 'C1',
        properties: { partNumber: 'GRM188R71C104KA01D' },
      }),
    ];
    expect(findMatchingInstances(bom, instances)).toEqual(['inst-001']);
  });

  it('matches multiple instances with same partNumber', () => {
    const bom = makeBomItem({ partNumber: 'RC0402FR-0710KL' });
    const instances = [
      makeInstance({
        instanceId: 'inst-001',
        label: 'R1',
        properties: { partNumber: 'RC0402FR-0710KL' },
      }),
      makeInstance({
        instanceId: 'inst-002',
        label: 'R2',
        properties: { partNumber: 'RC0402FR-0710KL' },
      }),
    ];
    expect(findMatchingInstances(bom, instances)).toEqual(['inst-001', 'inst-002']);
  });

  it('matches by mpn property alias', () => {
    const bom = makeBomItem({ partNumber: 'ATmega328P' });
    const instances = [
      makeInstance({
        instanceId: 'inst-010',
        label: 'U1',
        properties: { mpn: 'ATmega328P' },
      }),
    ];
    expect(findMatchingInstances(bom, instances)).toEqual(['inst-010']);
  });

  it('falls back to description matching against label', () => {
    const bom = makeBomItem({
      partNumber: 'UNKNOWN-PN',
      description: 'R1 — 10K Resistor',
    });
    const instances = [
      makeInstance({ instanceId: 'inst-001', label: 'R1', properties: {} }),
      makeInstance({ instanceId: 'inst-002', label: 'C1', properties: {} }),
    ];
    expect(findMatchingInstances(bom, instances)).toEqual(['inst-001']);
  });

  it('falls back to manufacturer matching in properties', () => {
    const bom = makeBomItem({
      partNumber: 'UNKNOWN-PN',
      description: 'Some resistor',
      manufacturer: 'Yageo',
    });
    const instances = [
      makeInstance({
        instanceId: 'inst-001',
        label: 'R1',
        properties: { manufacturer: 'Yageo', value: '10K' },
      }),
      makeInstance({
        instanceId: 'inst-002',
        label: 'R2',
        properties: { manufacturer: 'TDK' },
      }),
    ];
    expect(findMatchingInstances(bom, instances)).toEqual(['inst-001']);
  });

  it('returns empty array when no matches found', () => {
    const bom = makeBomItem({ partNumber: 'XYZ-NOEXIST', description: 'Nothing matches' });
    const instances = [
      makeInstance({ instanceId: 'inst-001', label: 'R1', properties: {} }),
    ];
    expect(findMatchingInstances(bom, instances)).toEqual([]);
  });

  it('returns empty array for empty instances list', () => {
    const bom = makeBomItem();
    expect(findMatchingInstances(bom, [])).toEqual([]);
  });

  it('handles null/undefined properties gracefully', () => {
    const bom = makeBomItem({ partNumber: 'RC0402FR-0710KL' });
    const instances = [
      makeInstance({ instanceId: 'inst-001', label: 'R1', properties: null }),
      makeInstance({ instanceId: 'inst-002', label: 'C1', properties: undefined }),
    ];
    expect(findMatchingInstances(bom, instances)).toEqual([]);
  });

  it('is case-insensitive for partNumber matching', () => {
    const bom = makeBomItem({ partNumber: 'rc0402fr-0710kl' });
    const instances = [
      makeInstance({
        instanceId: 'inst-001',
        label: 'R1',
        properties: { partNumber: 'RC0402FR-0710KL' },
      }),
    ];
    expect(findMatchingInstances(bom, instances)).toEqual(['inst-001']);
  });

  it('is case-insensitive for mpn matching', () => {
    const bom = makeBomItem({ partNumber: 'ATMEGA328P' });
    const instances = [
      makeInstance({
        instanceId: 'inst-010',
        label: 'U1',
        properties: { mpn: 'atmega328p' },
      }),
    ];
    expect(findMatchingInstances(bom, instances)).toEqual(['inst-010']);
  });

  it('prefers partNumber match over fuzzy label match', () => {
    const bom = makeBomItem({
      partNumber: 'RC0402FR-0710KL',
      description: 'R2 — matches label of inst-002',
    });
    const instances = [
      makeInstance({
        instanceId: 'inst-001',
        label: 'R1',
        properties: { partNumber: 'RC0402FR-0710KL' },
      }),
      makeInstance({ instanceId: 'inst-002', label: 'R2', properties: {} }),
    ];
    // partNumber exact match should be returned, not fuzzy label match
    const result = findMatchingInstances(bom, instances);
    expect(result).toContain('inst-001');
  });

  it('matches by value property when partNumber contains it', () => {
    const bom = makeBomItem({ partNumber: '10K' });
    const instances = [
      makeInstance({
        instanceId: 'inst-001',
        label: 'R1',
        properties: { value: '10K' },
      }),
      makeInstance({
        instanceId: 'inst-002',
        label: 'R2',
        properties: { value: '22K' },
      }),
    ];
    expect(findMatchingInstances(bom, instances)).toEqual(['inst-001']);
  });

  it('does not produce duplicates when multiple criteria match same instance', () => {
    const bom = makeBomItem({
      partNumber: 'RC0402FR-0710KL',
      manufacturer: 'Yageo',
      description: 'R1 — 10K Resistor',
    });
    const instances = [
      makeInstance({
        instanceId: 'inst-001',
        label: 'R1',
        properties: { partNumber: 'RC0402FR-0710KL', manufacturer: 'Yageo' },
      }),
    ];
    const result = findMatchingInstances(bom, instances);
    expect(result).toEqual(['inst-001']);
    // No duplicates
    expect(new Set(result).size).toBe(result.length);
  });
});

// ===========================================================================
// generateBomBackAnnotationPatch
// ===========================================================================

describe('generateBomBackAnnotationPatch', () => {
  it('generates a patch with sourceType bom', () => {
    const bom = makeBomItem({ id: 42, partNumber: 'NEW-PN', manufacturer: 'ACME' });
    const patch = generateBomBackAnnotationPatch(bom, 'inst-001', 10);
    expect(patch.sourceType).toBe('bom');
    expect(patch.sourceId).toBe(42);
    expect(patch.targetInstanceId).toBe('inst-001');
    expect(patch.targetDesignId).toBe(10);
  });

  it('includes partNumber in changes', () => {
    const bom = makeBomItem({ partNumber: 'NEW-PN-123' });
    const patch = generateBomBackAnnotationPatch(bom, 'inst-001', 10);
    expect(patch.changes).toHaveProperty('partNumber', 'NEW-PN-123');
  });

  it('includes manufacturer in changes', () => {
    const bom = makeBomItem({ manufacturer: 'Texas Instruments' });
    const patch = generateBomBackAnnotationPatch(bom, 'inst-001', 10);
    expect(patch.changes).toHaveProperty('manufacturer', 'Texas Instruments');
  });

  it('includes description in changes', () => {
    const bom = makeBomItem({ description: 'Updated description' });
    const patch = generateBomBackAnnotationPatch(bom, 'inst-001', 10);
    expect(patch.changes).toHaveProperty('description', 'Updated description');
  });

  it('sets a valid numeric timestamp', () => {
    const before = Date.now();
    const bom = makeBomItem();
    const patch = generateBomBackAnnotationPatch(bom, 'inst-001', 10);
    const after = Date.now();
    expect(patch.timestamp).toBeGreaterThanOrEqual(before);
    expect(patch.timestamp).toBeLessThanOrEqual(after);
  });

  it('produces different patches for different BOM items', () => {
    const bom1 = makeBomItem({ id: 1, partNumber: 'PN-1' });
    const bom2 = makeBomItem({ id: 2, partNumber: 'PN-2' });
    const p1 = generateBomBackAnnotationPatch(bom1, 'inst-001', 10);
    const p2 = generateBomBackAnnotationPatch(bom2, 'inst-002', 10);
    expect(p1.sourceId).not.toBe(p2.sourceId);
    expect(p1.targetInstanceId).not.toBe(p2.targetInstanceId);
    expect(p1.changes.partNumber).not.toBe(p2.changes.partNumber);
  });

  it('produces different patches for different design IDs', () => {
    const bom = makeBomItem();
    const p1 = generateBomBackAnnotationPatch(bom, 'inst-001', 10);
    const p2 = generateBomBackAnnotationPatch(bom, 'inst-001', 20);
    expect(p1.targetDesignId).toBe(10);
    expect(p2.targetDesignId).toBe(20);
  });
});

// ===========================================================================
// Integration: Manager + patch generation
// ===========================================================================

describe('integration: Manager + generateBomBackAnnotationPatch', () => {
  let manager: BackAnnotationManager;

  beforeEach(() => {
    BackAnnotationManager.resetInstance();
    manager = BackAnnotationManager.getInstance();
  });

  it('addPatch + getSnapshot works with generated patches', () => {
    const bom = makeBomItem({ id: 5, partNumber: 'INT-PN' });
    const patch = generateBomBackAnnotationPatch(bom, 'inst-005', 10);
    manager.addPatch(patch);
    const snap = manager.getSnapshot();
    expect(snap.pendingCount).toBe(1);
    expect(snap.patches[0].sourceType).toBe('bom');
    expect(snap.patches[0].changes.partNumber).toBe('INT-PN');
  });

  it('clearPending after generated patches resets state', () => {
    const bom = makeBomItem();
    manager.addPatch(generateBomBackAnnotationPatch(bom, 'inst-001', 10));
    manager.addPatch(generateBomBackAnnotationPatch(bom, 'inst-002', 10));
    manager.clearPending();
    expect(manager.getSnapshot().pendingCount).toBe(0);
  });

  it('subscriber fires for each generated patch addition', () => {
    const listener = vi.fn();
    manager.subscribe(listener);
    const bom = makeBomItem();
    manager.addPatch(generateBomBackAnnotationPatch(bom, 'inst-001', 10));
    manager.addPatch(generateBomBackAnnotationPatch(bom, 'inst-002', 10));
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
