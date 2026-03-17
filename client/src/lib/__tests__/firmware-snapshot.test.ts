import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { FirmwareSnapshotManager, useFirmwareSnapshots } from '../firmware-snapshot';
import type { FirmwareSnapshot } from '../firmware-snapshot';

// ---------------------------------------------------------------------------
// localStorage mock
// ---------------------------------------------------------------------------

function createMockLocalStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
    }),
    clear: vi.fn(() => {
      store.clear();
    }),
    get length() {
      return store.size;
    },
    key: vi.fn((_index: number) => null),
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSnapshot(overrides: Partial<FirmwareSnapshot> = {}): FirmwareSnapshot {
  return {
    id: crypto.randomUUID(),
    projectId: 'proj-1',
    board: 'arduino:avr:mega',
    sketchCode: 'void setup() {} void loop() {}',
    compiledAt: Date.now(),
    status: 'untested',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// FirmwareSnapshotManager
// ---------------------------------------------------------------------------

describe('FirmwareSnapshotManager', () => {
  let manager: FirmwareSnapshotManager;
  let mockStorage: Storage;

  beforeEach(() => {
    mockStorage = createMockLocalStorage();
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockStorage,
      writable: true,
      configurable: true,
    });
    FirmwareSnapshotManager.resetInstance();
    manager = FirmwareSnapshotManager.getInstance();
  });

  afterEach(() => {
    FirmwareSnapshotManager.resetInstance();
  });

  // -----------------------------------------------------------------------
  // Singleton
  // -----------------------------------------------------------------------

  it('returns the same instance on repeated calls', () => {
    const a = FirmwareSnapshotManager.getInstance();
    const b = FirmwareSnapshotManager.getInstance();
    expect(a).toBe(b);
  });

  it('creates a fresh instance after resetInstance', () => {
    const snap = makeSnapshot();
    manager.saveSnapshot(snap);
    FirmwareSnapshotManager.resetInstance();
    const fresh = FirmwareSnapshotManager.getInstance();
    // fresh instance loads from localStorage — should still have the snapshot
    expect(fresh.getSnapshot(snap.id)).not.toBeNull();
  });

  // -----------------------------------------------------------------------
  // saveSnapshot
  // -----------------------------------------------------------------------

  it('saves a snapshot and retrieves it', () => {
    const snap = makeSnapshot();
    manager.saveSnapshot(snap);
    const retrieved = manager.getSnapshots('proj-1');
    expect(retrieved).toHaveLength(1);
    expect(retrieved[0].id).toBe(snap.id);
    expect(retrieved[0].board).toBe('arduino:avr:mega');
  });

  it('duplicate save with same ID is idempotent', () => {
    const snap = makeSnapshot();
    manager.saveSnapshot(snap);
    manager.saveSnapshot(snap);
    expect(manager.getSnapshots('proj-1')).toHaveLength(1);
  });

  it('saves a copy — external mutation does not affect stored data', () => {
    const snap = makeSnapshot();
    manager.saveSnapshot(snap);
    snap.board = 'mutated';
    expect(manager.getSnapshot(snap.id)?.board).toBe('arduino:avr:mega');
  });

  it('stores optional notes field', () => {
    const snap = makeSnapshot({ notes: 'Before motor driver fix' });
    manager.saveSnapshot(snap);
    expect(manager.getSnapshot(snap.id)?.notes).toBe('Before motor driver fix');
  });

  // -----------------------------------------------------------------------
  // getSnapshots
  // -----------------------------------------------------------------------

  it('returns snapshots sorted by compiledAt descending (newest first)', () => {
    const now = Date.now();
    manager.saveSnapshot(makeSnapshot({ id: 'old', compiledAt: now - 3000 }));
    manager.saveSnapshot(makeSnapshot({ id: 'mid', compiledAt: now - 1000 }));
    manager.saveSnapshot(makeSnapshot({ id: 'new', compiledAt: now }));

    const result = manager.getSnapshots('proj-1');
    expect(result.map((s) => s.id)).toEqual(['new', 'mid', 'old']);
  });

  it('returns only snapshots for the requested project', () => {
    manager.saveSnapshot(makeSnapshot({ id: 'a', projectId: 'proj-1' }));
    manager.saveSnapshot(makeSnapshot({ id: 'b', projectId: 'proj-2' }));
    manager.saveSnapshot(makeSnapshot({ id: 'c', projectId: 'proj-1' }));

    expect(manager.getSnapshots('proj-1')).toHaveLength(2);
    expect(manager.getSnapshots('proj-2')).toHaveLength(1);
    expect(manager.getSnapshots('proj-3')).toHaveLength(0);
  });

  it('returns copies — external mutation does not affect internal state', () => {
    manager.saveSnapshot(makeSnapshot({ id: 'x' }));
    const result = manager.getSnapshots('proj-1');
    result[0].board = 'tampered';
    expect(manager.getSnapshot('x')?.board).toBe('arduino:avr:mega');
  });

  // -----------------------------------------------------------------------
  // getSnapshot (by ID)
  // -----------------------------------------------------------------------

  it('returns null for non-existent ID', () => {
    expect(manager.getSnapshot('nonexistent')).toBeNull();
  });

  it('returns a copy of the snapshot', () => {
    const snap = makeSnapshot();
    manager.saveSnapshot(snap);
    const retrieved = manager.getSnapshot(snap.id);
    expect(retrieved).not.toBeNull();
    retrieved!.board = 'tampered';
    expect(manager.getSnapshot(snap.id)?.board).toBe('arduino:avr:mega');
  });

  // -----------------------------------------------------------------------
  // FIFO eviction (max 10 per project)
  // -----------------------------------------------------------------------

  it('enforces max 10 snapshots per project by evicting oldest', () => {
    const baseTime = Date.now();
    // Add 10 snapshots
    for (let i = 0; i < 10; i++) {
      manager.saveSnapshot(makeSnapshot({ id: `snap-${i}`, compiledAt: baseTime + i }));
    }
    expect(manager.getSnapshots('proj-1')).toHaveLength(10);

    // Add the 11th — should evict snap-0 (oldest by compiledAt)
    manager.saveSnapshot(makeSnapshot({ id: 'snap-10', compiledAt: baseTime + 10 }));
    expect(manager.getSnapshots('proj-1')).toHaveLength(10);
    expect(manager.getSnapshot('snap-0')).toBeNull();
    expect(manager.getSnapshot('snap-10')).not.toBeNull();
  });

  it('FIFO eviction does not affect other projects', () => {
    const baseTime = Date.now();
    // Fill proj-1 to max
    for (let i = 0; i < 10; i++) {
      manager.saveSnapshot(makeSnapshot({ id: `p1-${i}`, projectId: 'proj-1', compiledAt: baseTime + i }));
    }
    // Add one to proj-2
    manager.saveSnapshot(makeSnapshot({ id: 'p2-0', projectId: 'proj-2', compiledAt: baseTime }));

    // Add 11th to proj-1 — evicts from proj-1, not proj-2
    manager.saveSnapshot(makeSnapshot({ id: 'p1-10', projectId: 'proj-1', compiledAt: baseTime + 10 }));
    expect(manager.getSnapshots('proj-1')).toHaveLength(10);
    expect(manager.getSnapshots('proj-2')).toHaveLength(1);
    expect(manager.getSnapshot('p2-0')).not.toBeNull();
  });

  // -----------------------------------------------------------------------
  // getLastKnownGood
  // -----------------------------------------------------------------------

  it('returns null when no good snapshots exist', () => {
    manager.saveSnapshot(makeSnapshot({ status: 'untested' }));
    manager.saveSnapshot(makeSnapshot({ status: 'bad' }));
    expect(manager.getLastKnownGood('proj-1')).toBeNull();
  });

  it('returns the most recent good snapshot', () => {
    const now = Date.now();
    manager.saveSnapshot(makeSnapshot({ id: 'older-good', status: 'good', compiledAt: now - 2000 }));
    manager.saveSnapshot(makeSnapshot({ id: 'newer-good', status: 'good', compiledAt: now }));
    manager.saveSnapshot(makeSnapshot({ id: 'newest-bad', status: 'bad', compiledAt: now + 1000 }));

    const lkg = manager.getLastKnownGood('proj-1');
    expect(lkg).not.toBeNull();
    expect(lkg!.id).toBe('newer-good');
  });

  it('returns null for a project with no snapshots', () => {
    expect(manager.getLastKnownGood('empty-project')).toBeNull();
  });

  it('returns a copy — external mutation does not affect internal state', () => {
    manager.saveSnapshot(makeSnapshot({ id: 'g1', status: 'good' }));
    const lkg = manager.getLastKnownGood('proj-1');
    lkg!.board = 'tampered';
    expect(manager.getSnapshot('g1')?.board).toBe('arduino:avr:mega');
  });

  // -----------------------------------------------------------------------
  // restoreSnapshot
  // -----------------------------------------------------------------------

  it('returns the sketchCode for a valid ID', () => {
    const snap = makeSnapshot({ sketchCode: '#include <Servo.h>\nvoid setup() {}' });
    manager.saveSnapshot(snap);
    expect(manager.restoreSnapshot(snap.id)).toBe('#include <Servo.h>\nvoid setup() {}');
  });

  it('returns null for a non-existent ID', () => {
    expect(manager.restoreSnapshot('nonexistent')).toBeNull();
  });

  // -----------------------------------------------------------------------
  // markAsGood / markAsBad
  // -----------------------------------------------------------------------

  it('markAsGood transitions status to good', () => {
    const snap = makeSnapshot({ status: 'untested' });
    manager.saveSnapshot(snap);
    expect(manager.markAsGood(snap.id)).toBe(true);
    expect(manager.getSnapshot(snap.id)?.status).toBe('good');
  });

  it('markAsBad transitions status to bad', () => {
    const snap = makeSnapshot({ status: 'untested' });
    manager.saveSnapshot(snap);
    expect(manager.markAsBad(snap.id)).toBe(true);
    expect(manager.getSnapshot(snap.id)?.status).toBe('bad');
  });

  it('markAsGood returns false for non-existent ID', () => {
    expect(manager.markAsGood('nonexistent')).toBe(false);
  });

  it('markAsBad returns false for non-existent ID', () => {
    expect(manager.markAsBad('nonexistent')).toBe(false);
  });

  it('markAsGood is idempotent when already good', () => {
    const snap = makeSnapshot({ status: 'good' });
    manager.saveSnapshot(snap);
    const callback = vi.fn();
    manager.subscribe(callback);
    expect(manager.markAsGood(snap.id)).toBe(true);
    // No notification since status did not change
    expect(callback).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // deleteSnapshot
  // -----------------------------------------------------------------------

  it('deletes an existing snapshot', () => {
    const snap = makeSnapshot();
    manager.saveSnapshot(snap);
    expect(manager.deleteSnapshot(snap.id)).toBe(true);
    expect(manager.getSnapshot(snap.id)).toBeNull();
    expect(manager.getSnapshots('proj-1')).toHaveLength(0);
  });

  it('returns false when deleting a non-existent snapshot', () => {
    expect(manager.deleteSnapshot('nonexistent')).toBe(false);
  });

  it('delete is safe when called twice', () => {
    const snap = makeSnapshot();
    manager.saveSnapshot(snap);
    manager.deleteSnapshot(snap.id);
    expect(manager.deleteSnapshot(snap.id)).toBe(false);
  });

  // -----------------------------------------------------------------------
  // localStorage persistence
  // -----------------------------------------------------------------------

  it('persists to localStorage on saveSnapshot', () => {
    manager.saveSnapshot(makeSnapshot());
    expect(mockStorage.setItem).toHaveBeenCalledWith('protopulse:firmware-snapshots', expect.any(String));
  });

  it('persists to localStorage on markAsGood', () => {
    const snap = makeSnapshot({ status: 'untested' });
    manager.saveSnapshot(snap);
    vi.mocked(mockStorage.setItem).mockClear();
    manager.markAsGood(snap.id);
    expect(mockStorage.setItem).toHaveBeenCalled();
  });

  it('persists to localStorage on deleteSnapshot', () => {
    const snap = makeSnapshot();
    manager.saveSnapshot(snap);
    vi.mocked(mockStorage.setItem).mockClear();
    manager.deleteSnapshot(snap.id);
    expect(mockStorage.setItem).toHaveBeenCalled();
  });

  it('loads from localStorage on init', () => {
    const entries: FirmwareSnapshot[] = [
      makeSnapshot({ id: 'persisted-1', board: 'esp32:esp32:esp32' }),
    ];
    vi.mocked(mockStorage.getItem).mockReturnValue(JSON.stringify(entries));

    FirmwareSnapshotManager.resetInstance();
    const loaded = FirmwareSnapshotManager.getInstance();
    expect(loaded.getSnapshot('persisted-1')).not.toBeNull();
    expect(loaded.getSnapshot('persisted-1')?.board).toBe('esp32:esp32:esp32');
  });

  it('handles corrupt localStorage gracefully', () => {
    vi.mocked(mockStorage.getItem).mockReturnValue('not valid json{{{');
    FirmwareSnapshotManager.resetInstance();
    const loaded = FirmwareSnapshotManager.getInstance();
    expect(loaded.getSnapshots('proj-1')).toEqual([]);
  });

  it('handles non-array localStorage data gracefully', () => {
    vi.mocked(mockStorage.getItem).mockReturnValue('{"key": "value"}');
    FirmwareSnapshotManager.resetInstance();
    const loaded = FirmwareSnapshotManager.getInstance();
    expect(loaded.getSnapshots('proj-1')).toEqual([]);
  });

  it('filters out invalid entries from localStorage', () => {
    const data = [
      makeSnapshot({ id: 'valid-1' }),
      { invalid: true }, // missing required fields
      { id: 'bad-status', projectId: 'p', board: 'b', sketchCode: 's', compiledAt: 1, status: 'NOPE' },
      makeSnapshot({ id: 'valid-2' }),
    ];
    vi.mocked(mockStorage.getItem).mockReturnValue(JSON.stringify(data));
    FirmwareSnapshotManager.resetInstance();
    const loaded = FirmwareSnapshotManager.getInstance();
    // Only the two valid snapshots survive
    const all = loaded.getSnapshots('proj-1');
    expect(all).toHaveLength(2);
    expect(all.map((s) => s.id).sort()).toEqual(['valid-1', 'valid-2']);
  });

  // -----------------------------------------------------------------------
  // Subscribe / unsubscribe
  // -----------------------------------------------------------------------

  it('calls subscriber on saveSnapshot', () => {
    const callback = vi.fn();
    manager.subscribe(callback);
    manager.saveSnapshot(makeSnapshot());
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('calls subscriber on markAsGood', () => {
    const snap = makeSnapshot({ status: 'untested' });
    manager.saveSnapshot(snap);
    const callback = vi.fn();
    manager.subscribe(callback);
    manager.markAsGood(snap.id);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('calls subscriber on markAsBad', () => {
    const snap = makeSnapshot({ status: 'untested' });
    manager.saveSnapshot(snap);
    const callback = vi.fn();
    manager.subscribe(callback);
    manager.markAsBad(snap.id);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('calls subscriber on deleteSnapshot', () => {
    const snap = makeSnapshot();
    manager.saveSnapshot(snap);
    const callback = vi.fn();
    manager.subscribe(callback);
    manager.deleteSnapshot(snap.id);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('does not call subscriber after unsubscribe', () => {
    const callback = vi.fn();
    const unsub = manager.subscribe(callback);
    unsub();
    manager.saveSnapshot(makeSnapshot());
    expect(callback).not.toHaveBeenCalled();
  });

  it('does not notify on duplicate saveSnapshot', () => {
    const snap = makeSnapshot();
    manager.saveSnapshot(snap);
    const callback = vi.fn();
    manager.subscribe(callback);
    manager.saveSnapshot(snap); // duplicate — no-op
    expect(callback).not.toHaveBeenCalled();
  });

  it('does not notify on deleteSnapshot of non-existent ID', () => {
    const callback = vi.fn();
    manager.subscribe(callback);
    manager.deleteSnapshot('nonexistent');
    expect(callback).not.toHaveBeenCalled();
  });

  it('does not notify on markAsGood when already good', () => {
    const snap = makeSnapshot({ status: 'good' });
    manager.saveSnapshot(snap);
    const callback = vi.fn();
    manager.subscribe(callback);
    manager.markAsGood(snap.id);
    expect(callback).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// React hook — useFirmwareSnapshots
// ---------------------------------------------------------------------------

describe('useFirmwareSnapshots', () => {
  let mockStorage: Storage;

  beforeEach(() => {
    mockStorage = createMockLocalStorage();
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockStorage,
      writable: true,
      configurable: true,
    });
    FirmwareSnapshotManager.resetInstance();
  });

  afterEach(() => {
    FirmwareSnapshotManager.resetInstance();
  });

  it('returns initial empty state', () => {
    const { result } = renderHook(() => useFirmwareSnapshots('proj-1'));
    expect(result.current.snapshots).toEqual([]);
    expect(result.current.lastKnownGood).toBeNull();
    expect(result.current.count).toBe(0);
  });

  it('saves a snapshot via hook', () => {
    const { result } = renderHook(() => useFirmwareSnapshots('proj-1'));
    const snap = makeSnapshot();
    act(() => {
      result.current.saveSnapshot(snap);
    });
    expect(result.current.snapshots).toHaveLength(1);
    expect(result.current.count).toBe(1);
  });

  it('restores snapshot code via hook', () => {
    const { result } = renderHook(() => useFirmwareSnapshots('proj-1'));
    const snap = makeSnapshot({ sketchCode: 'int main() { return 0; }' });
    act(() => {
      result.current.saveSnapshot(snap);
    });
    expect(result.current.restoreSnapshot(snap.id)).toBe('int main() { return 0; }');
  });

  it('marks as good via hook', () => {
    const { result } = renderHook(() => useFirmwareSnapshots('proj-1'));
    const snap = makeSnapshot({ status: 'untested' });
    act(() => {
      result.current.saveSnapshot(snap);
    });
    act(() => {
      result.current.markAsGood(snap.id);
    });
    expect(result.current.snapshots[0].status).toBe('good');
    expect(result.current.lastKnownGood).not.toBeNull();
    expect(result.current.lastKnownGood?.id).toBe(snap.id);
  });

  it('marks as bad via hook', () => {
    const { result } = renderHook(() => useFirmwareSnapshots('proj-1'));
    const snap = makeSnapshot({ status: 'untested' });
    act(() => {
      result.current.saveSnapshot(snap);
    });
    act(() => {
      result.current.markAsBad(snap.id);
    });
    expect(result.current.snapshots[0].status).toBe('bad');
  });

  it('deletes a snapshot via hook', () => {
    const { result } = renderHook(() => useFirmwareSnapshots('proj-1'));
    const snap = makeSnapshot();
    act(() => {
      result.current.saveSnapshot(snap);
    });
    act(() => {
      result.current.deleteSnapshot(snap.id);
    });
    expect(result.current.snapshots).toHaveLength(0);
    expect(result.current.count).toBe(0);
  });

  it('scopes snapshots to the provided projectId', () => {
    const { result: hook1 } = renderHook(() => useFirmwareSnapshots('proj-1'));
    const { result: hook2 } = renderHook(() => useFirmwareSnapshots('proj-2'));

    act(() => {
      hook1.current.saveSnapshot(makeSnapshot({ id: 'p1-snap', projectId: 'proj-1' }));
      hook2.current.saveSnapshot(makeSnapshot({ id: 'p2-snap', projectId: 'proj-2' }));
    });

    expect(hook1.current.snapshots).toHaveLength(1);
    expect(hook1.current.snapshots[0].id).toBe('p1-snap');
    expect(hook2.current.snapshots).toHaveLength(1);
    expect(hook2.current.snapshots[0].id).toBe('p2-snap');
  });

  it('cleans up subscription on unmount', () => {
    const { unmount } = renderHook(() => useFirmwareSnapshots('proj-1'));
    unmount();
    // Should not throw when manager notifies after unmount
    expect(() => {
      FirmwareSnapshotManager.getInstance().saveSnapshot(makeSnapshot());
    }).not.toThrow();
  });
});
