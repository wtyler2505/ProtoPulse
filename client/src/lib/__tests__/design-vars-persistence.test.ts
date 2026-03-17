import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  DesignVarPersistence,
  useDesignVarPersistence,
} from '../design-vars-persistence';
import type { DesignVarSnapshot } from '../design-vars-persistence';
import type { DesignVariable } from '@shared/design-variables';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeVar(name: string, value: string, unit?: string): DesignVariable {
  return { name, value, unit };
}

function makeSnapshot(
  projectId: string,
  variables: DesignVariable[],
  savedAt?: string,
): DesignVarSnapshot {
  return {
    projectId,
    variables,
    savedAt: savedAt ?? new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Mock localStorage
// ---------------------------------------------------------------------------

let storageMap: Map<string, string>;

const localStorageMock: Storage = {
  getItem: (key: string) => storageMap.get(key) ?? null,
  setItem: (key: string, value: string) => { storageMap.set(key, value); },
  removeItem: (key: string) => { storageMap.delete(key); },
  clear: () => { storageMap.clear(); },
  get length() { return storageMap.size; },
  key: (index: number) => {
    const keys = Array.from(storageMap.keys());
    return keys[index] ?? null;
  },
};

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  storageMap = new Map();
  Object.defineProperty(globalThis, 'localStorage', {
    value: localStorageMock,
    writable: true,
    configurable: true,
  });
  DesignVarPersistence.resetInstance();
});

afterEach(() => {
  DesignVarPersistence.resetInstance();
});

// ---------------------------------------------------------------------------
// DesignVarPersistence — Singleton
// ---------------------------------------------------------------------------

describe('DesignVarPersistence', () => {
  describe('singleton', () => {
    it('returns the same instance on repeated calls', () => {
      const a = DesignVarPersistence.getInstance();
      const b = DesignVarPersistence.getInstance();
      expect(a).toBe(b);
    });

    it('returns a new instance after resetInstance', () => {
      const a = DesignVarPersistence.getInstance();
      DesignVarPersistence.resetInstance();
      const b = DesignVarPersistence.getInstance();
      expect(a).not.toBe(b);
    });
  });

  // -------------------------------------------------------------------------
  // syncToProject + loadFromProject
  // -------------------------------------------------------------------------

  describe('syncToProject + loadFromProject', () => {
    it('saves and loads variables for a project', () => {
      const mgr = DesignVarPersistence.getInstance();
      const vars: DesignVariable[] = [
        makeVar('VCC', '3.3', 'V'),
        makeVar('R_LOAD', '10k', 'ohm'),
      ];
      mgr.syncToProject('proj-1', vars);

      const loaded = mgr.loadFromProject('proj-1');
      expect(loaded).toHaveLength(2);
      expect(loaded![0].name).toBe('VCC');
      expect(loaded![1].name).toBe('R_LOAD');
    });

    it('returns null when no data exists for a project', () => {
      const mgr = DesignVarPersistence.getInstance();
      expect(mgr.loadFromProject('nonexistent')).toBeNull();
    });

    it('isolates data between projects', () => {
      const mgr = DesignVarPersistence.getInstance();
      mgr.syncToProject('proj-a', [makeVar('X', '1')]);
      mgr.syncToProject('proj-b', [makeVar('Y', '2')]);

      const a = mgr.loadFromProject('proj-a');
      const b = mgr.loadFromProject('proj-b');

      expect(a).toHaveLength(1);
      expect(a![0].name).toBe('X');
      expect(b).toHaveLength(1);
      expect(b![0].name).toBe('Y');
    });

    it('overwrites previous data on repeated sync', () => {
      const mgr = DesignVarPersistence.getInstance();
      mgr.syncToProject('proj-1', [makeVar('A', '1')]);
      mgr.syncToProject('proj-1', [makeVar('B', '2'), makeVar('C', '3')]);

      const loaded = mgr.loadFromProject('proj-1');
      expect(loaded).toHaveLength(2);
      expect(loaded![0].name).toBe('B');
      expect(loaded![1].name).toBe('C');
    });

    it('preserves unit and optional fields', () => {
      const mgr = DesignVarPersistence.getInstance();
      const v: DesignVariable = {
        name: 'VCC',
        value: '3.3',
        unit: 'V',
        description: 'Supply voltage',
        resolved: 3.3,
      };
      mgr.syncToProject('proj-1', [v]);

      const loaded = mgr.loadFromProject('proj-1');
      expect(loaded![0].unit).toBe('V');
      expect(loaded![0].description).toBe('Supply voltage');
    });
  });

  // -------------------------------------------------------------------------
  // exportVariables
  // -------------------------------------------------------------------------

  describe('exportVariables', () => {
    it('returns a snapshot of the current project variables', () => {
      const mgr = DesignVarPersistence.getInstance();
      mgr.syncToProject('proj-1', [makeVar('VCC', '5')]);

      const snapshot = mgr.exportVariables('proj-1');
      expect(snapshot.projectId).toBe('proj-1');
      expect(snapshot.variables).toHaveLength(1);
      expect(snapshot.variables[0].name).toBe('VCC');
      expect(snapshot.savedAt).toBeTruthy();
    });

    it('returns an empty variables array when no data exists', () => {
      const mgr = DesignVarPersistence.getInstance();
      const snapshot = mgr.exportVariables('empty-proj');
      expect(snapshot.projectId).toBe('empty-proj');
      expect(snapshot.variables).toHaveLength(0);
    });

    it('snapshot savedAt is a valid ISO-8601 timestamp', () => {
      const mgr = DesignVarPersistence.getInstance();
      const snapshot = mgr.exportVariables('proj-1');
      const parsed = new Date(snapshot.savedAt);
      expect(parsed.getTime()).not.toBeNaN();
    });
  });

  // -------------------------------------------------------------------------
  // importVariables
  // -------------------------------------------------------------------------

  describe('importVariables', () => {
    it('imports a snapshot and stores variables under the project', () => {
      const mgr = DesignVarPersistence.getInstance();
      const snapshot = makeSnapshot('proj-import', [makeVar('R1', '100')]);
      mgr.importVariables(snapshot);

      const loaded = mgr.loadFromProject('proj-import');
      expect(loaded).toHaveLength(1);
      expect(loaded![0].name).toBe('R1');
    });

    it('adds the imported snapshot to history', () => {
      const mgr = DesignVarPersistence.getInstance();
      const snapshot = makeSnapshot('proj-import', [makeVar('R1', '100')]);
      mgr.importVariables(snapshot);

      const history = mgr.getHistory('proj-import');
      expect(history).toHaveLength(1);
      expect(history[0].variables[0].name).toBe('R1');
    });

    it('ignores invalid snapshots', () => {
      const mgr = DesignVarPersistence.getInstance();
      // Missing required fields
      mgr.importVariables({ projectId: 'x' } as DesignVarSnapshot);
      expect(mgr.loadFromProject('x')).toBeNull();
    });

    it('overwrites existing project data on import', () => {
      const mgr = DesignVarPersistence.getInstance();
      mgr.syncToProject('proj-1', [makeVar('OLD', '1')]);
      mgr.importVariables(makeSnapshot('proj-1', [makeVar('NEW', '2')]));

      const loaded = mgr.loadFromProject('proj-1');
      expect(loaded).toHaveLength(1);
      expect(loaded![0].name).toBe('NEW');
    });
  });

  // -------------------------------------------------------------------------
  // getHistory
  // -------------------------------------------------------------------------

  describe('getHistory', () => {
    it('returns empty array when no history exists', () => {
      const mgr = DesignVarPersistence.getInstance();
      expect(mgr.getHistory('no-history')).toEqual([]);
    });

    it('accumulates snapshots on repeated syncs', () => {
      const mgr = DesignVarPersistence.getInstance();
      mgr.syncToProject('proj-1', [makeVar('A', '1')]);
      mgr.syncToProject('proj-1', [makeVar('B', '2')]);
      mgr.syncToProject('proj-1', [makeVar('C', '3')]);

      const history = mgr.getHistory('proj-1');
      expect(history).toHaveLength(3);
    });

    it('returns snapshots in newest-first order', () => {
      const mgr = DesignVarPersistence.getInstance();
      const t1 = '2026-01-01T00:00:00.000Z';
      const t2 = '2026-01-02T00:00:00.000Z';
      const t3 = '2026-01-03T00:00:00.000Z';

      mgr.importVariables(makeSnapshot('proj-1', [makeVar('A', '1')], t1));
      mgr.importVariables(makeSnapshot('proj-1', [makeVar('B', '2')], t3));
      mgr.importVariables(makeSnapshot('proj-1', [makeVar('C', '3')], t2));

      const history = mgr.getHistory('proj-1');
      expect(history[0].savedAt).toBe(t3);
      expect(history[1].savedAt).toBe(t2);
      expect(history[2].savedAt).toBe(t1);
    });

    it('caps history at 10 entries', () => {
      const mgr = DesignVarPersistence.getInstance();
      for (let i = 0; i < 15; i++) {
        mgr.syncToProject('proj-1', [makeVar(`V${String(i)}`, String(i))]);
      }

      const history = mgr.getHistory('proj-1');
      expect(history).toHaveLength(10);
    });

    it('keeps the most recent entries when capping', () => {
      const mgr = DesignVarPersistence.getInstance();
      for (let i = 0; i < 12; i++) {
        const ts = new Date(Date.UTC(2026, 0, i + 1)).toISOString();
        mgr.importVariables(makeSnapshot('proj-1', [makeVar(`V${String(i)}`, String(i))], ts));
      }

      const history = mgr.getHistory('proj-1');
      expect(history).toHaveLength(10);
      // Oldest kept should be i=2 (Jan 3), not i=0 (Jan 1) or i=1 (Jan 2)
      const oldestKept = history[history.length - 1];
      expect(oldestKept.variables[0].name).toBe('V2');
    });

    it('isolates history between projects', () => {
      const mgr = DesignVarPersistence.getInstance();
      mgr.syncToProject('proj-a', [makeVar('A', '1')]);
      mgr.syncToProject('proj-b', [makeVar('B', '2')]);

      expect(mgr.getHistory('proj-a')).toHaveLength(1);
      expect(mgr.getHistory('proj-b')).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------------
  // migrateFromLocalStorage
  // -------------------------------------------------------------------------

  describe('migrateFromLocalStorage', () => {
    it('migrates legacy data to project-scoped storage', () => {
      const legacy: DesignVariable[] = [
        makeVar('VCC', '3.3', 'V'),
        makeVar('R1', '10k'),
      ];
      localStorage.setItem('protopulse:design-variables', JSON.stringify(legacy));

      const mgr = DesignVarPersistence.getInstance();
      const result = mgr.migrateFromLocalStorage('proj-1');

      expect(result).toBe(true);
      const loaded = mgr.loadFromProject('proj-1');
      expect(loaded).toHaveLength(2);
      expect(loaded![0].name).toBe('VCC');
    });

    it('creates a history entry during migration', () => {
      const legacy: DesignVariable[] = [makeVar('X', '42')];
      localStorage.setItem('protopulse:design-variables', JSON.stringify(legacy));

      const mgr = DesignVarPersistence.getInstance();
      mgr.migrateFromLocalStorage('proj-1');

      const history = mgr.getHistory('proj-1');
      expect(history).toHaveLength(1);
      expect(history[0].variables[0].name).toBe('X');
    });

    it('is idempotent — second call is a no-op', () => {
      const legacy: DesignVariable[] = [makeVar('X', '42')];
      localStorage.setItem('protopulse:design-variables', JSON.stringify(legacy));

      const mgr = DesignVarPersistence.getInstance();
      expect(mgr.migrateFromLocalStorage('proj-1')).toBe(true);
      expect(mgr.migrateFromLocalStorage('proj-1')).toBe(false);
    });

    it('does not overwrite existing project-scoped data', () => {
      const legacy: DesignVariable[] = [makeVar('LEGACY', '1')];
      localStorage.setItem('protopulse:design-variables', JSON.stringify(legacy));

      const mgr = DesignVarPersistence.getInstance();
      mgr.syncToProject('proj-1', [makeVar('EXISTING', '2')]);
      const result = mgr.migrateFromLocalStorage('proj-1');

      expect(result).toBe(false);
      const loaded = mgr.loadFromProject('proj-1');
      expect(loaded![0].name).toBe('EXISTING');
    });

    it('returns false when no legacy data exists', () => {
      const mgr = DesignVarPersistence.getInstance();
      expect(mgr.migrateFromLocalStorage('proj-1')).toBe(false);
    });

    it('handles corrupt legacy data gracefully', () => {
      localStorage.setItem('protopulse:design-variables', '{bad json}}}');

      const mgr = DesignVarPersistence.getInstance();
      expect(mgr.migrateFromLocalStorage('proj-1')).toBe(false);
    });

    it('skips items with missing name or value in legacy data', () => {
      const legacy = [
        { name: 'GOOD', value: '1' },
        { name: 'NO_VALUE' },
        { value: '3' },
        { name: 'ALSO_GOOD', value: '4' },
      ];
      localStorage.setItem('protopulse:design-variables', JSON.stringify(legacy));

      const mgr = DesignVarPersistence.getInstance();
      mgr.migrateFromLocalStorage('proj-1');

      const loaded = mgr.loadFromProject('proj-1');
      expect(loaded).toHaveLength(2);
      expect(loaded![0].name).toBe('GOOD');
      expect(loaded![1].name).toBe('ALSO_GOOD');
    });

    it('can migrate to different projects independently', () => {
      const legacy: DesignVariable[] = [makeVar('VCC', '5')];
      localStorage.setItem('protopulse:design-variables', JSON.stringify(legacy));

      const mgr = DesignVarPersistence.getInstance();
      expect(mgr.migrateFromLocalStorage('proj-a')).toBe(true);
      // proj-b should also get the legacy data since it has not been migrated yet
      // BUT it can't because proj-a already set project-scoped data for proj-a,
      // and proj-b has no project-scoped data yet
      expect(mgr.migrateFromLocalStorage('proj-b')).toBe(true);

      expect(mgr.loadFromProject('proj-a')).toHaveLength(1);
      expect(mgr.loadFromProject('proj-b')).toHaveLength(1);
    });

    it('returns false for empty legacy array', () => {
      localStorage.setItem('protopulse:design-variables', JSON.stringify([]));
      const mgr = DesignVarPersistence.getInstance();
      expect(mgr.migrateFromLocalStorage('proj-1')).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Subscription
  // -------------------------------------------------------------------------

  describe('subscribe', () => {
    it('notifies subscribers on syncToProject', () => {
      const mgr = DesignVarPersistence.getInstance();
      const callback = vi.fn();
      mgr.subscribe(callback);

      mgr.syncToProject('proj-1', [makeVar('X', '1')]);
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('notifies subscribers on importVariables', () => {
      const mgr = DesignVarPersistence.getInstance();
      const callback = vi.fn();
      mgr.subscribe(callback);

      mgr.importVariables(makeSnapshot('proj-1', [makeVar('X', '1')]));
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('notifies subscribers on migrateFromLocalStorage', () => {
      localStorage.setItem('protopulse:design-variables', JSON.stringify([makeVar('X', '1')]));

      const mgr = DesignVarPersistence.getInstance();
      const callback = vi.fn();
      mgr.subscribe(callback);

      mgr.migrateFromLocalStorage('proj-1');
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('does not notify after unsubscribe', () => {
      const mgr = DesignVarPersistence.getInstance();
      const callback = vi.fn();
      const unsubscribe = mgr.subscribe(callback);

      unsubscribe();
      mgr.syncToProject('proj-1', [makeVar('X', '1')]);
      expect(callback).not.toHaveBeenCalled();
    });

    it('supports multiple subscribers', () => {
      const mgr = DesignVarPersistence.getInstance();
      const cb1 = vi.fn();
      const cb2 = vi.fn();
      mgr.subscribe(cb1);
      mgr.subscribe(cb2);

      mgr.syncToProject('proj-1', [makeVar('X', '1')]);
      expect(cb1).toHaveBeenCalledTimes(1);
      expect(cb2).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // Edge cases — corrupt localStorage
  // -------------------------------------------------------------------------

  describe('corrupt localStorage', () => {
    it('loadFromProject returns null on corrupt JSON', () => {
      localStorage.setItem('protopulse:design-variables:project:proj-1', '{{bad}}');
      const mgr = DesignVarPersistence.getInstance();
      expect(mgr.loadFromProject('proj-1')).toBeNull();
    });

    it('loadFromProject returns null on non-array JSON', () => {
      localStorage.setItem('protopulse:design-variables:project:proj-1', '"string"');
      const mgr = DesignVarPersistence.getInstance();
      expect(mgr.loadFromProject('proj-1')).toBeNull();
    });

    it('getHistory returns empty array on corrupt JSON', () => {
      localStorage.setItem('protopulse:design-variables:project:proj-1:history', '{{bad}}');
      const mgr = DesignVarPersistence.getInstance();
      expect(mgr.getHistory('proj-1')).toEqual([]);
    });

    it('getHistory returns empty array on non-array JSON', () => {
      localStorage.setItem('protopulse:design-variables:project:proj-1:history', '42');
      const mgr = DesignVarPersistence.getInstance();
      expect(mgr.getHistory('proj-1')).toEqual([]);
    });

    it('getHistory filters out invalid snapshots', () => {
      const mixed = [
        makeSnapshot('proj-1', [makeVar('GOOD', '1')]),
        { projectId: 'proj-1', variables: 'not-array', savedAt: 'bad' },
        makeSnapshot('proj-1', [makeVar('ALSO_GOOD', '2')]),
      ];
      localStorage.setItem(
        'protopulse:design-variables:project:proj-1:history',
        JSON.stringify(mixed),
      );
      const mgr = DesignVarPersistence.getInstance();
      const history = mgr.getHistory('proj-1');
      expect(history).toHaveLength(2);
    });

    it('loadFromProject filters out invalid variable entries', () => {
      const mixed = [
        { name: 'GOOD', value: '1' },
        { name: 123, value: '2' }, // invalid name type
        { name: 'VALID', value: '3' },
      ];
      localStorage.setItem(
        'protopulse:design-variables:project:proj-1',
        JSON.stringify(mixed),
      );
      const mgr = DesignVarPersistence.getInstance();
      const loaded = mgr.loadFromProject('proj-1');
      expect(loaded).toHaveLength(2);
      expect(loaded![0].name).toBe('GOOD');
      expect(loaded![1].name).toBe('VALID');
    });

    it('loadFromProject returns null when all entries are invalid', () => {
      const bad = [
        { name: 123, value: '2' },
        { value: '3' },
      ];
      localStorage.setItem(
        'protopulse:design-variables:project:proj-1',
        JSON.stringify(bad),
      );
      const mgr = DesignVarPersistence.getInstance();
      expect(mgr.loadFromProject('proj-1')).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // exportVariables does not persist (read-only)
  // -------------------------------------------------------------------------

  describe('exportVariables is read-only', () => {
    it('does not create a history entry', () => {
      const mgr = DesignVarPersistence.getInstance();
      mgr.syncToProject('proj-1', [makeVar('X', '1')]);

      const histBefore = mgr.getHistory('proj-1');
      mgr.exportVariables('proj-1');
      const histAfter = mgr.getHistory('proj-1');

      expect(histAfter.length).toBe(histBefore.length);
    });
  });
});

// ---------------------------------------------------------------------------
// useDesignVarPersistence hook
// ---------------------------------------------------------------------------

describe('useDesignVarPersistence', () => {
  it('is exported as a function', () => {
    expect(typeof useDesignVarPersistence).toBe('function');
  });
});
