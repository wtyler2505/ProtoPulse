import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  FirmwareVersionTracker,
  computeSketchHash,
  generateVersionLabel,
  type RecordVersionData,
  type FirmwareVersion,
} from '../firmware-version-tracker';

// ---------------------------------------------------------------------------
// Global mocks
// ---------------------------------------------------------------------------

let uuidCounter = 0;
vi.stubGlobal('crypto', {
  randomUUID: vi.fn(() => `fw-uuid-${++uuidCounter}`),
});

const store: Record<string, string> = {};
vi.stubGlobal('localStorage', {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, val: string) => {
    store[key] = val;
  }),
  removeItem: vi.fn((key: string) => {
    delete store[key];
  }),
  clear: vi.fn(() => {
    for (const k of Object.keys(store)) {
      delete store[k];
    }
  }),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeVersionData(overrides: Partial<RecordVersionData> = {}): RecordVersionData {
  return {
    projectId: 1,
    sketchContent: 'void setup() {} void loop() {}',
    boardFqbn: 'arduino:avr:mega',
    sketchPath: '/project/sketch.ino',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('computeSketchHash', () => {
  it('returns 8-character hex string', () => {
    const hash = computeSketchHash('void setup() {}');
    expect(hash).toMatch(/^[0-9a-f]{8}$/);
  });

  it('is deterministic', () => {
    const content = 'int x = 42;';
    expect(computeSketchHash(content)).toBe(computeSketchHash(content));
  });

  it('produces different hashes for different content', () => {
    const a = computeSketchHash('void setup() {}');
    const b = computeSketchHash('void loop() {}');
    expect(a).not.toBe(b);
  });

  it('handles empty string', () => {
    const hash = computeSketchHash('');
    expect(hash).toMatch(/^[0-9a-f]{8}$/);
  });

  it('handles long content', () => {
    const content = 'x'.repeat(100000);
    const hash = computeSketchHash(content);
    expect(hash).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe('generateVersionLabel', () => {
  it('returns v1.0.0+build.1 for first version', () => {
    const label = generateVersionLabel([], 1, 'arduino:avr:mega', []);
    expect(label).toBe('v1.0.0+build.1');
  });

  it('increments patch for same board', () => {
    const existing: FirmwareVersion[] = [
      {
        id: '1',
        projectId: 1,
        label: 'v1.0.0+build.1',
        sketchHash: 'abcdef01',
        designSnapshotId: null,
        boardFqbn: 'arduino:avr:mega',
        buildTimestamp: 1000,
        sketchPath: '/sketch.ino',
        notes: '',
        tags: [],
        metadata: {},
      },
    ];
    const label = generateVersionLabel(existing, 1, 'arduino:avr:mega', []);
    expect(label).toBe('v1.0.1+build.2');
  });

  it('bumps minor when board changes', () => {
    const existing: FirmwareVersion[] = [
      {
        id: '1',
        projectId: 1,
        label: 'v1.0.0+build.1',
        sketchHash: 'abcdef01',
        designSnapshotId: null,
        boardFqbn: 'arduino:avr:mega',
        buildTimestamp: 1000,
        sketchPath: '/sketch.ino',
        notes: '',
        tags: [],
        metadata: {},
      },
    ];
    const label = generateVersionLabel(existing, 1, 'arduino:avr:uno', []);
    expect(label).toBe('v1.1.0+build.2');
  });

  it('bumps major for breaking tag', () => {
    const existing: FirmwareVersion[] = [
      {
        id: '1',
        projectId: 1,
        label: 'v1.2.3+build.1',
        sketchHash: 'abcdef01',
        designSnapshotId: null,
        boardFqbn: 'arduino:avr:mega',
        buildTimestamp: 1000,
        sketchPath: '/sketch.ino',
        notes: '',
        tags: [],
        metadata: {},
      },
    ];
    const label = generateVersionLabel(existing, 1, 'arduino:avr:mega', ['breaking']);
    expect(label).toBe('v2.0.0+build.2');
  });

  it('only counts versions for the same project', () => {
    const existing: FirmwareVersion[] = [
      {
        id: '1',
        projectId: 2,
        label: 'v1.0.0+build.1',
        sketchHash: 'abcdef01',
        designSnapshotId: null,
        boardFqbn: 'arduino:avr:mega',
        buildTimestamp: 1000,
        sketchPath: '/sketch.ino',
        notes: '',
        tags: [],
        metadata: {},
      },
    ];
    const label = generateVersionLabel(existing, 1, 'arduino:avr:mega', []);
    expect(label).toBe('v1.0.0+build.1');
  });

  it('breaking takes precedence over board change', () => {
    const existing: FirmwareVersion[] = [
      {
        id: '1',
        projectId: 1,
        label: 'v1.0.0+build.1',
        sketchHash: 'abcdef01',
        designSnapshotId: null,
        boardFqbn: 'arduino:avr:mega',
        buildTimestamp: 1000,
        sketchPath: '/sketch.ino',
        notes: '',
        tags: [],
        metadata: {},
      },
    ];
    const label = generateVersionLabel(existing, 1, 'arduino:avr:uno', ['breaking']);
    expect(label).toBe('v2.0.0+build.2');
  });
});

describe('FirmwareVersionTracker', () => {
  let tracker: FirmwareVersionTracker;

  beforeEach(() => {
    for (const k of Object.keys(store)) {
      delete store[k];
    }
    uuidCounter = 0;
    FirmwareVersionTracker.resetInstance();
    tracker = FirmwareVersionTracker.getInstance();
  });

  // -------------------------------------------------------------------------
  // Singleton
  // -------------------------------------------------------------------------

  describe('singleton', () => {
    it('returns the same instance', () => {
      const a = FirmwareVersionTracker.getInstance();
      const b = FirmwareVersionTracker.getInstance();
      expect(a).toBe(b);
    });

    it('resetInstance creates a fresh instance', () => {
      const a = FirmwareVersionTracker.getInstance();
      FirmwareVersionTracker.resetInstance();
      const b = FirmwareVersionTracker.getInstance();
      expect(a).not.toBe(b);
    });
  });

  // -------------------------------------------------------------------------
  // Recording versions
  // -------------------------------------------------------------------------

  describe('recordVersion', () => {
    it('records a new firmware version', () => {
      const ver = tracker.recordVersion(makeVersionData());
      expect(ver.id).toBeDefined();
      expect(ver.projectId).toBe(1);
      expect(ver.boardFqbn).toBe('arduino:avr:mega');
      expect(ver.sketchPath).toBe('/project/sketch.ino');
      expect(ver.sketchHash).toMatch(/^[0-9a-f]{8}$/);
    });

    it('generates a version label automatically', () => {
      const ver = tracker.recordVersion(makeVersionData());
      expect(ver.label).toBe('v1.0.0+build.1');
    });

    it('allows label override', () => {
      const ver = tracker.recordVersion(makeVersionData({ labelOverride: 'custom-v42' }));
      expect(ver.label).toBe('custom-v42');
    });

    it('computes sketch hash from content', () => {
      const content = 'int x = 42;';
      const ver = tracker.recordVersion(makeVersionData({ sketchContent: content }));
      expect(ver.sketchHash).toBe(computeSketchHash(content));
    });

    it('sets default values for optional fields', () => {
      const ver = tracker.recordVersion(makeVersionData());
      expect(ver.notes).toBe('');
      expect(ver.tags).toEqual([]);
      expect(ver.metadata).toEqual({});
      expect(ver.designSnapshotId).toBeNull();
    });

    it('accepts optional fields', () => {
      const ver = tracker.recordVersion(makeVersionData({
        notes: 'Initial build',
        tags: ['release'],
        metadata: { compiler: 'avr-gcc' },
        designSnapshotId: 10,
      }));
      expect(ver.notes).toBe('Initial build');
      expect(ver.tags).toEqual(['release']);
      expect(ver.metadata).toEqual({ compiler: 'avr-gcc' });
      expect(ver.designSnapshotId).toBe(10);
    });

    it('sets buildTimestamp', () => {
      const ver = tracker.recordVersion(makeVersionData());
      expect(ver.buildTimestamp).toBeGreaterThan(0);
    });

    it('increments version labels', () => {
      const v1 = tracker.recordVersion(makeVersionData());
      const v2 = tracker.recordVersion(makeVersionData());
      expect(v1.label).toBe('v1.0.0+build.1');
      expect(v2.label).toBe('v1.0.1+build.2');
    });
  });

  // -------------------------------------------------------------------------
  // Query API
  // -------------------------------------------------------------------------

  describe('listVersions', () => {
    it('returns versions for a project, newest first', () => {
      tracker.recordVersion(makeVersionData({ projectId: 1 }));
      tracker.recordVersion(makeVersionData({ projectId: 1 }));
      tracker.recordVersion(makeVersionData({ projectId: 2 }));
      const versions = tracker.listVersions(1);
      expect(versions).toHaveLength(2);
      expect(versions[0].buildTimestamp).toBeGreaterThanOrEqual(versions[1].buildTimestamp);
    });

    it('returns empty for unknown project', () => {
      expect(tracker.listVersions(99)).toEqual([]);
    });
  });

  describe('getVersion', () => {
    it('returns a version by ID', () => {
      const ver = tracker.recordVersion(makeVersionData());
      expect(tracker.getVersion(ver.id)).toBeDefined();
      expect(tracker.getVersion(ver.id)!.label).toBe(ver.label);
    });

    it('returns undefined for missing ID', () => {
      expect(tracker.getVersion('nonexistent')).toBeUndefined();
    });
  });

  describe('getLatestVersion', () => {
    it('returns the latest version for a project', () => {
      tracker.recordVersion(makeVersionData());
      const v2 = tracker.recordVersion(makeVersionData());
      const latest = tracker.getLatestVersion(1);
      expect(latest).toBeDefined();
      expect(latest!.id).toBe(v2.id);
    });

    it('returns undefined for empty project', () => {
      expect(tracker.getLatestVersion(99)).toBeUndefined();
    });
  });

  describe('findBySnapshot', () => {
    it('finds versions linked to a snapshot', () => {
      tracker.recordVersion(makeVersionData({ designSnapshotId: 5 }));
      tracker.recordVersion(makeVersionData({ designSnapshotId: 10 }));
      tracker.recordVersion(makeVersionData({ designSnapshotId: 5 }));
      expect(tracker.findBySnapshot(5)).toHaveLength(2);
      expect(tracker.findBySnapshot(10)).toHaveLength(1);
      expect(tracker.findBySnapshot(99)).toHaveLength(0);
    });
  });

  describe('findByTag', () => {
    it('finds versions by tag', () => {
      tracker.recordVersion(makeVersionData({ tags: ['release', 'stable'] }));
      tracker.recordVersion(makeVersionData({ tags: ['beta'] }));
      tracker.recordVersion(makeVersionData({ tags: ['release'] }));
      expect(tracker.findByTag('release')).toHaveLength(2);
      expect(tracker.findByTag('beta')).toHaveLength(1);
    });

    it('filters by projectId when provided', () => {
      tracker.recordVersion(makeVersionData({ projectId: 1, tags: ['release'] }));
      tracker.recordVersion(makeVersionData({ projectId: 2, tags: ['release'] }));
      expect(tracker.findByTag('release', 1)).toHaveLength(1);
    });
  });

  describe('hasSketchChanged', () => {
    it('returns true for first version', () => {
      expect(tracker.hasSketchChanged(1, 'any content')).toBe(true);
    });

    it('returns false for identical content', () => {
      const content = 'void setup() {} void loop() {}';
      tracker.recordVersion(makeVersionData({ sketchContent: content }));
      expect(tracker.hasSketchChanged(1, content)).toBe(false);
    });

    it('returns true for changed content', () => {
      tracker.recordVersion(makeVersionData({ sketchContent: 'original' }));
      expect(tracker.hasSketchChanged(1, 'modified')).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Mutation API
  // -------------------------------------------------------------------------

  describe('linkSnapshot', () => {
    it('links a version to a design snapshot', () => {
      const ver = tracker.recordVersion(makeVersionData());
      expect(tracker.linkSnapshot(ver.id, 42)).toBe(true);
      expect(tracker.getVersion(ver.id)!.designSnapshotId).toBe(42);
    });

    it('returns false for missing version', () => {
      expect(tracker.linkSnapshot('nonexistent', 42)).toBe(false);
    });
  });

  describe('addTag', () => {
    it('adds a tag to a version', () => {
      const ver = tracker.recordVersion(makeVersionData());
      expect(tracker.addTag(ver.id, 'stable')).toBe(true);
      expect(tracker.getVersion(ver.id)!.tags).toContain('stable');
    });

    it('returns false for duplicate tag', () => {
      const ver = tracker.recordVersion(makeVersionData({ tags: ['stable'] }));
      expect(tracker.addTag(ver.id, 'stable')).toBe(false);
    });

    it('returns false for missing version', () => {
      expect(tracker.addTag('nonexistent', 'stable')).toBe(false);
    });
  });

  describe('removeTag', () => {
    it('removes a tag from a version', () => {
      const ver = tracker.recordVersion(makeVersionData({ tags: ['stable', 'release'] }));
      expect(tracker.removeTag(ver.id, 'stable')).toBe(true);
      expect(tracker.getVersion(ver.id)!.tags).not.toContain('stable');
      expect(tracker.getVersion(ver.id)!.tags).toContain('release');
    });

    it('returns false for missing tag', () => {
      const ver = tracker.recordVersion(makeVersionData());
      expect(tracker.removeTag(ver.id, 'nonexistent')).toBe(false);
    });

    it('returns false for missing version', () => {
      expect(tracker.removeTag('nonexistent', 'stable')).toBe(false);
    });
  });

  describe('updateNotes', () => {
    it('updates notes on a version', () => {
      const ver = tracker.recordVersion(makeVersionData());
      expect(tracker.updateNotes(ver.id, 'Updated notes')).toBe(true);
      expect(tracker.getVersion(ver.id)!.notes).toBe('Updated notes');
    });

    it('returns false for missing version', () => {
      expect(tracker.updateNotes('nonexistent', 'notes')).toBe(false);
    });
  });

  describe('deleteVersion', () => {
    it('deletes a version', () => {
      const ver = tracker.recordVersion(makeVersionData());
      expect(tracker.deleteVersion(ver.id)).toBe(true);
      expect(tracker.getVersion(ver.id)).toBeUndefined();
    });

    it('returns false for missing version', () => {
      expect(tracker.deleteVersion('nonexistent')).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Diffing
  // -------------------------------------------------------------------------

  describe('diffVersions', () => {
    it('returns diff between two versions', () => {
      const v1 = tracker.recordVersion(makeVersionData({
        sketchContent: 'version 1',
        boardFqbn: 'arduino:avr:mega',
        designSnapshotId: 1,
        tags: ['alpha'],
        metadata: { opt: '-O2' },
      }));
      const v2 = tracker.recordVersion(makeVersionData({
        sketchContent: 'version 2',
        boardFqbn: 'arduino:avr:uno',
        designSnapshotId: 2,
        tags: ['beta'],
        metadata: { opt: '-O3', newKey: true },
      }));

      const diff = tracker.diffVersions(v1.id, v2.id);
      expect(diff).toBeDefined();
      expect(diff!.sketchChanged).toBe(true);
      expect(diff!.boardChanged).toBe(true);
      expect(diff!.snapshotChanged).toBe(true);
      expect(diff!.tagsDiff.added).toContain('beta');
      expect(diff!.tagsDiff.removed).toContain('alpha');
      expect(diff!.metadataDiff.added).toContain('newKey');
      expect(diff!.metadataDiff.modified).toContain('opt');
    });

    it('reports no changes for identical versions', () => {
      const content = 'same content';
      const v1 = tracker.recordVersion(makeVersionData({
        sketchContent: content,
        tags: ['release'],
        metadata: { x: 1 },
        designSnapshotId: 5,
      }));
      const v2 = tracker.recordVersion(makeVersionData({
        sketchContent: content,
        tags: ['release'],
        metadata: { x: 1 },
        designSnapshotId: 5,
      }));
      const diff = tracker.diffVersions(v1.id, v2.id);
      expect(diff!.sketchChanged).toBe(false);
      expect(diff!.boardChanged).toBe(false);
      expect(diff!.snapshotChanged).toBe(false);
      expect(diff!.tagsDiff.added).toEqual([]);
      expect(diff!.tagsDiff.removed).toEqual([]);
      expect(diff!.metadataDiff.added).toEqual([]);
      expect(diff!.metadataDiff.removed).toEqual([]);
      expect(diff!.metadataDiff.modified).toEqual([]);
    });

    it('detects metadata removal', () => {
      const v1 = tracker.recordVersion(makeVersionData({ metadata: { a: 1, b: 2 } }));
      const v2 = tracker.recordVersion(makeVersionData({ metadata: { a: 1 } }));
      const diff = tracker.diffVersions(v1.id, v2.id);
      expect(diff!.metadataDiff.removed).toContain('b');
    });

    it('returns undefined for missing source', () => {
      const v1 = tracker.recordVersion(makeVersionData());
      expect(tracker.diffVersions('nonexistent', v1.id)).toBeUndefined();
    });

    it('returns undefined for missing target', () => {
      const v1 = tracker.recordVersion(makeVersionData());
      expect(tracker.diffVersions(v1.id, 'nonexistent')).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // Subscribe pattern
  // -------------------------------------------------------------------------

  describe('subscribe', () => {
    it('notifies listeners on recordVersion', () => {
      const fn = vi.fn();
      tracker.subscribe(fn);
      tracker.recordVersion(makeVersionData());
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('notifies listeners on deleteVersion', () => {
      const ver = tracker.recordVersion(makeVersionData());
      const fn = vi.fn();
      tracker.subscribe(fn);
      tracker.deleteVersion(ver.id);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('unsubscribe stops notifications', () => {
      const fn = vi.fn();
      const unsub = tracker.subscribe(fn);
      unsub();
      tracker.recordVersion(makeVersionData());
      expect(fn).not.toHaveBeenCalled();
    });

    it('increments storeVersion on mutations', () => {
      const v0 = tracker.storeVersion;
      tracker.recordVersion(makeVersionData());
      expect(tracker.storeVersion).toBe(v0 + 1);
    });
  });

  describe('getSnapshot', () => {
    it('returns current state and version', () => {
      tracker.recordVersion(makeVersionData());
      const snap = tracker.getSnapshot();
      expect(snap.versions).toHaveLength(1);
      expect(snap.version).toBeGreaterThan(0);
    });

    it('returns a copy (not a reference)', () => {
      tracker.recordVersion(makeVersionData());
      const snap = tracker.getSnapshot();
      snap.versions.pop();
      expect(tracker.listVersions(1)).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------------
  // Persistence
  // -------------------------------------------------------------------------

  describe('persistence', () => {
    it('persists to localStorage and restores', () => {
      const ver = tracker.recordVersion(makeVersionData({ notes: 'test note' }));

      FirmwareVersionTracker.resetInstance();
      const tracker2 = FirmwareVersionTracker.getInstance();
      const restored = tracker2.getVersion(ver.id);
      expect(restored).toBeDefined();
      expect(restored!.notes).toBe('test note');
      expect(restored!.boardFqbn).toBe('arduino:avr:mega');
    });

    it('handles corrupted localStorage gracefully', () => {
      store['protopulse-firmware-versions'] = '{{{invalid';
      FirmwareVersionTracker.resetInstance();
      const tracker2 = FirmwareVersionTracker.getInstance();
      expect(tracker2.listVersions(1)).toHaveLength(0);
    });

    it('handles empty localStorage', () => {
      FirmwareVersionTracker.resetInstance();
      const tracker2 = FirmwareVersionTracker.getInstance();
      expect(tracker2.listVersions(1)).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // Version cap
  // -------------------------------------------------------------------------

  describe('version cap', () => {
    it('enforces MAX_VERSIONS_PER_PROJECT by removing oldest', () => {
      // Record 201 versions — oldest should be evicted
      for (let i = 0; i < 201; i++) {
        tracker.recordVersion(makeVersionData({ sketchContent: `sketch-${i}` }));
      }
      const versions = tracker.listVersions(1);
      expect(versions.length).toBeLessThanOrEqual(201);
      // The first recorded version should have been evicted
      expect(versions.find((v) => v.sketchHash === computeSketchHash('sketch-0'))).toBeUndefined();
    });
  });
});
