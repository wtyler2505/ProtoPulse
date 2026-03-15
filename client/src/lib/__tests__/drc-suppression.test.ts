import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { DrcSuppressionManager, useDrcSuppression } from '../drc-suppression';
import type { SuppressInput, DrcSuppression } from '../drc-suppression';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PROJECT_ID = 42;

function makeInput(overrides: Partial<SuppressInput> = {}): SuppressInput {
  return {
    projectId: PROJECT_ID,
    ruleId: 'clearance',
    instanceId: 'v-001',
    reason: 'Known spacing for test connector',
    suppressedBy: 'tester',
    permanent: false,
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// localStorage mock
// ---------------------------------------------------------------------------

const storage = new Map<string, string>();

beforeEach(() => {
  DrcSuppressionManager.resetInstance();
  storage.clear();
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key: string) => storage.get(key) ?? null);
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key: string, value: string) => {
    storage.set(key, value);
  });
  vi.spyOn(Storage.prototype, 'removeItem').mockImplementation((key: string) => {
    storage.delete(key);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Manager tests
// ---------------------------------------------------------------------------

describe('DrcSuppressionManager', () => {
  it('returns a singleton instance', () => {
    const a = DrcSuppressionManager.getInstance();
    const b = DrcSuppressionManager.getInstance();
    expect(a).toBe(b);
  });

  it('resetInstance creates a fresh instance', () => {
    const a = DrcSuppressionManager.getInstance();
    DrcSuppressionManager.resetInstance();
    const b = DrcSuppressionManager.getInstance();
    expect(a).not.toBe(b);
  });

  describe('suppress()', () => {
    it('creates a suppression with correct fields', () => {
      const mgr = DrcSuppressionManager.getInstance();
      const result = mgr.suppress(makeInput());
      expect(result.id).toBeTruthy();
      expect(result.projectId).toBe(PROJECT_ID);
      expect(result.ruleId).toBe('clearance');
      expect(result.instanceId).toBe('v-001');
      expect(result.reason).toBe('Known spacing for test connector');
      expect(result.suppressedBy).toBe('tester');
      expect(result.permanent).toBe(false);
      expect(result.expiresAt).toBeGreaterThan(Date.now());
      expect(result.suppressedAt).toBeLessThanOrEqual(Date.now());
    });

    it('persists to localStorage', () => {
      const mgr = DrcSuppressionManager.getInstance();
      mgr.suppress(makeInput());
      const key = `protopulse-drc-suppressions-${PROJECT_ID}`;
      expect(storage.has(key)).toBe(true);
      const parsed = JSON.parse(storage.get(key)!) as DrcSuppression[];
      expect(parsed).toHaveLength(1);
      expect(parsed[0].ruleId).toBe('clearance');
    });

    it('deduplicates by ruleId+instanceId (updates existing)', () => {
      const mgr = DrcSuppressionManager.getInstance();
      const first = mgr.suppress(makeInput({ reason: 'first' }));
      const second = mgr.suppress(makeInput({ reason: 'updated' }));
      expect(second.id).toBe(first.id); // same ID
      expect(second.reason).toBe('updated');
      expect(mgr.getSuppressions(PROJECT_ID)).toHaveLength(1);
    });

    it('creates separate entries for different instanceIds', () => {
      const mgr = DrcSuppressionManager.getInstance();
      mgr.suppress(makeInput({ instanceId: 'a' }));
      mgr.suppress(makeInput({ instanceId: 'b' }));
      expect(mgr.getSuppressions(PROJECT_ID)).toHaveLength(2);
    });

    it('creates permanent suppression with null expiresAt', () => {
      const mgr = DrcSuppressionManager.getInstance();
      const result = mgr.suppress(makeInput({ permanent: true, expiresAt: 999 }));
      expect(result.permanent).toBe(true);
      expect(result.expiresAt).toBeNull();
    });

    it('uses default suppressedBy when not provided', () => {
      const mgr = DrcSuppressionManager.getInstance();
      const result = mgr.suppress({
        projectId: PROJECT_ID,
        ruleId: 'clearance',
        instanceId: 'x',
        reason: 'test',
      });
      expect(result.suppressedBy).toBe('user');
    });
  });

  describe('unsuppress()', () => {
    it('removes a suppression by ID', () => {
      const mgr = DrcSuppressionManager.getInstance();
      const s = mgr.suppress(makeInput());
      expect(mgr.unsuppress(PROJECT_ID, s.id)).toBe(true);
      expect(mgr.getSuppressions(PROJECT_ID)).toHaveLength(0);
    });

    it('returns false for unknown suppression ID', () => {
      const mgr = DrcSuppressionManager.getInstance();
      expect(mgr.unsuppress(PROJECT_ID, 'nonexistent')).toBe(false);
    });

    it('persists removal to localStorage', () => {
      const mgr = DrcSuppressionManager.getInstance();
      const s = mgr.suppress(makeInput());
      mgr.unsuppress(PROJECT_ID, s.id);
      const key = `protopulse-drc-suppressions-${PROJECT_ID}`;
      const parsed = JSON.parse(storage.get(key)!) as DrcSuppression[];
      expect(parsed).toHaveLength(0);
    });
  });

  describe('unsuppressByInstance()', () => {
    it('removes by ruleId+instanceId', () => {
      const mgr = DrcSuppressionManager.getInstance();
      mgr.suppress(makeInput());
      expect(mgr.unsuppressByInstance(PROJECT_ID, 'clearance', 'v-001')).toBe(true);
      expect(mgr.getSuppressions(PROJECT_ID)).toHaveLength(0);
    });

    it('returns false when no match', () => {
      const mgr = DrcSuppressionManager.getInstance();
      expect(mgr.unsuppressByInstance(PROJECT_ID, 'nope', 'nope')).toBe(false);
    });
  });

  describe('isSuppressed()', () => {
    it('returns true for active suppression', () => {
      const mgr = DrcSuppressionManager.getInstance();
      mgr.suppress(makeInput());
      expect(mgr.isSuppressed(PROJECT_ID, 'clearance', 'v-001')).toBe(true);
    });

    it('returns false for unknown violation', () => {
      const mgr = DrcSuppressionManager.getInstance();
      expect(mgr.isSuppressed(PROJECT_ID, 'clearance', 'unknown')).toBe(false);
    });

    it('returns false for expired suppression', () => {
      const mgr = DrcSuppressionManager.getInstance();
      mgr.suppress(makeInput({ expiresAt: Date.now() - 1000, permanent: false }));
      expect(mgr.isSuppressed(PROJECT_ID, 'clearance', 'v-001')).toBe(false);
    });

    it('returns true for permanent suppression', () => {
      const mgr = DrcSuppressionManager.getInstance();
      mgr.suppress(makeInput({ permanent: true }));
      expect(mgr.isSuppressed(PROJECT_ID, 'clearance', 'v-001')).toBe(true);
    });
  });

  describe('getActiveSuppressions()', () => {
    it('excludes expired suppressions', () => {
      const mgr = DrcSuppressionManager.getInstance();
      mgr.suppress(makeInput({ instanceId: 'active', expiresAt: Date.now() + 100000 }));
      mgr.suppress(makeInput({ instanceId: 'expired', expiresAt: Date.now() - 1000 }));
      const active = mgr.getActiveSuppressions(PROJECT_ID);
      expect(active).toHaveLength(1);
      expect(active[0].instanceId).toBe('active');
    });

    it('includes permanent suppressions', () => {
      const mgr = DrcSuppressionManager.getInstance();
      mgr.suppress(makeInput({ instanceId: 'perm', permanent: true }));
      expect(mgr.getActiveSuppressions(PROJECT_ID)).toHaveLength(1);
    });
  });

  describe('getExpiredSuppressions()', () => {
    it('returns only expired suppressions', () => {
      const mgr = DrcSuppressionManager.getInstance();
      mgr.suppress(makeInput({ instanceId: 'active', expiresAt: Date.now() + 100000 }));
      mgr.suppress(makeInput({ instanceId: 'expired', expiresAt: Date.now() - 1000 }));
      const expired = mgr.getExpiredSuppressions(PROJECT_ID);
      expect(expired).toHaveLength(1);
      expect(expired[0].instanceId).toBe('expired');
    });
  });

  describe('purgeExpired()', () => {
    it('removes expired suppressions and returns count', () => {
      const mgr = DrcSuppressionManager.getInstance();
      mgr.suppress(makeInput({ instanceId: 'keep', expiresAt: Date.now() + 100000 }));
      mgr.suppress(makeInput({ instanceId: 'purge1', expiresAt: Date.now() - 1000 }));
      mgr.suppress(makeInput({ instanceId: 'purge2', expiresAt: Date.now() - 2000 }));
      const purged = mgr.purgeExpired(PROJECT_ID);
      expect(purged).toBe(2);
      expect(mgr.getSuppressions(PROJECT_ID)).toHaveLength(1);
      expect(mgr.getSuppressions(PROJECT_ID)[0].instanceId).toBe('keep');
    });

    it('returns 0 when nothing to purge', () => {
      const mgr = DrcSuppressionManager.getInstance();
      mgr.suppress(makeInput({ permanent: true }));
      expect(mgr.purgeExpired(PROJECT_ID)).toBe(0);
    });
  });

  describe('clearAll()', () => {
    it('removes all suppressions for a project', () => {
      const mgr = DrcSuppressionManager.getInstance();
      mgr.suppress(makeInput({ instanceId: 'a' }));
      mgr.suppress(makeInput({ instanceId: 'b' }));
      mgr.suppress(makeInput({ instanceId: 'c' }));
      mgr.clearAll(PROJECT_ID);
      expect(mgr.getSuppressions(PROJECT_ID)).toHaveLength(0);
    });

    it('does not affect other projects', () => {
      const mgr = DrcSuppressionManager.getInstance();
      mgr.suppress(makeInput({ projectId: 1, instanceId: 'a' }));
      mgr.suppress(makeInput({ projectId: 2, instanceId: 'b' }));
      mgr.clearAll(1);
      expect(mgr.getSuppressions(1)).toHaveLength(0);
      expect(mgr.getSuppressions(2)).toHaveLength(1);
    });
  });

  describe('findSuppression()', () => {
    it('finds by ruleId+instanceId', () => {
      const mgr = DrcSuppressionManager.getInstance();
      const s = mgr.suppress(makeInput());
      const found = mgr.findSuppression(PROJECT_ID, 'clearance', 'v-001');
      expect(found).toBeDefined();
      expect(found!.id).toBe(s.id);
    });

    it('returns undefined when not found', () => {
      const mgr = DrcSuppressionManager.getInstance();
      expect(mgr.findSuppression(PROJECT_ID, 'nope', 'nope')).toBeUndefined();
    });
  });

  describe('subscribe()', () => {
    it('notifies listeners on suppress', () => {
      const mgr = DrcSuppressionManager.getInstance();
      const listener = vi.fn();
      mgr.subscribe(listener);
      mgr.suppress(makeInput());
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('notifies listeners on unsuppress', () => {
      const mgr = DrcSuppressionManager.getInstance();
      const s = mgr.suppress(makeInput());
      const listener = vi.fn();
      mgr.subscribe(listener);
      mgr.unsuppress(PROJECT_ID, s.id);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('unsubscribe stops notifications', () => {
      const mgr = DrcSuppressionManager.getInstance();
      const listener = vi.fn();
      const unsub = mgr.subscribe(listener);
      unsub();
      mgr.suppress(makeInput());
      expect(listener).not.toHaveBeenCalled();
    });

    it('notifies on clearAll', () => {
      const mgr = DrcSuppressionManager.getInstance();
      const listener = vi.fn();
      mgr.subscribe(listener);
      mgr.clearAll(PROJECT_ID);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('notifies on purgeExpired when items purged', () => {
      const mgr = DrcSuppressionManager.getInstance();
      mgr.suppress(makeInput({ expiresAt: Date.now() - 1000 }));
      const listener = vi.fn();
      mgr.subscribe(listener);
      mgr.purgeExpired(PROJECT_ID);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('does not notify on purgeExpired when nothing purged', () => {
      const mgr = DrcSuppressionManager.getInstance();
      mgr.suppress(makeInput({ permanent: true }));
      const listener = vi.fn();
      mgr.subscribe(listener);
      mgr.purgeExpired(PROJECT_ID);
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('persistence edge cases', () => {
    it('loads existing data from localStorage', () => {
      const key = `protopulse-drc-suppressions-${PROJECT_ID}`;
      const existing: DrcSuppression[] = [
        {
          id: 'pre-existing',
          projectId: PROJECT_ID,
          ruleId: 'trace_width',
          instanceId: 'tw-1',
          reason: 'Pre-seeded',
          suppressedBy: 'admin',
          suppressedAt: Date.now() - 60000,
          expiresAt: Date.now() + 3600000,
          permanent: false,
        },
      ];
      storage.set(key, JSON.stringify(existing));

      const mgr = DrcSuppressionManager.getInstance();
      const items = mgr.getSuppressions(PROJECT_ID);
      expect(items).toHaveLength(1);
      expect(items[0].id).toBe('pre-existing');
    });

    it('handles corrupted localStorage gracefully', () => {
      const key = `protopulse-drc-suppressions-${PROJECT_ID}`;
      storage.set(key, '{not valid json!!!}');

      const mgr = DrcSuppressionManager.getInstance();
      const items = mgr.getSuppressions(PROJECT_ID);
      expect(items).toHaveLength(0); // starts fresh
    });

    it('handles non-array localStorage value', () => {
      const key = `protopulse-drc-suppressions-${PROJECT_ID}`;
      storage.set(key, JSON.stringify({ not: 'an array' }));

      const mgr = DrcSuppressionManager.getInstance();
      const items = mgr.getSuppressions(PROJECT_ID);
      expect(items).toHaveLength(0);
    });
  });

  describe('activeCount()', () => {
    it('counts only active (non-expired) suppressions', () => {
      const mgr = DrcSuppressionManager.getInstance();
      mgr.suppress(makeInput({ instanceId: 'a', expiresAt: Date.now() + 100000 }));
      mgr.suppress(makeInput({ instanceId: 'b', permanent: true }));
      mgr.suppress(makeInput({ instanceId: 'c', expiresAt: Date.now() - 1000 }));
      expect(mgr.activeCount(PROJECT_ID)).toBe(2);
    });
  });
});

// ---------------------------------------------------------------------------
// Hook tests
// ---------------------------------------------------------------------------

describe('useDrcSuppression', () => {
  it('returns empty suppressions initially', () => {
    const { result } = renderHook(() => useDrcSuppression(PROJECT_ID));
    expect(result.current.suppressions).toHaveLength(0);
    expect(result.current.activeCount).toBe(0);
  });

  it('suppress() adds a suppression and re-renders', () => {
    const { result } = renderHook(() => useDrcSuppression(PROJECT_ID));

    act(() => {
      result.current.suppress({
        ruleId: 'clearance',
        instanceId: 'v1',
        reason: 'test',
      });
    });

    expect(result.current.suppressions).toHaveLength(1);
    expect(result.current.activeCount).toBe(1);
  });

  it('unsuppress() removes a suppression', () => {
    const { result } = renderHook(() => useDrcSuppression(PROJECT_ID));

    let id: string;
    act(() => {
      const s = result.current.suppress({
        ruleId: 'clearance',
        instanceId: 'v1',
        reason: 'test',
      });
      id = s.id;
    });

    act(() => {
      result.current.unsuppress(id!);
    });

    expect(result.current.suppressions).toHaveLength(0);
  });

  it('isSuppressed() checks correctly', () => {
    const { result } = renderHook(() => useDrcSuppression(PROJECT_ID));

    act(() => {
      result.current.suppress({
        ruleId: 'clearance',
        instanceId: 'v1',
        reason: 'test',
        permanent: true,
      });
    });

    expect(result.current.isSuppressed('clearance', 'v1')).toBe(true);
    expect(result.current.isSuppressed('clearance', 'v2')).toBe(false);
  });

  it('unsuppressByInstance() removes by rule+instance', () => {
    const { result } = renderHook(() => useDrcSuppression(PROJECT_ID));

    act(() => {
      result.current.suppress({
        ruleId: 'clearance',
        instanceId: 'v1',
        reason: 'test',
        permanent: true,
      });
    });

    act(() => {
      result.current.unsuppressByInstance('clearance', 'v1');
    });

    expect(result.current.suppressions).toHaveLength(0);
  });

  it('findSuppression() returns matching suppression', () => {
    const { result } = renderHook(() => useDrcSuppression(PROJECT_ID));

    act(() => {
      result.current.suppress({
        ruleId: 'clearance',
        instanceId: 'v1',
        reason: 'found it',
        permanent: true,
      });
    });

    const found = result.current.findSuppression('clearance', 'v1');
    expect(found).toBeDefined();
    expect(found!.reason).toBe('found it');
  });

  it('clearAll() removes everything', () => {
    const { result } = renderHook(() => useDrcSuppression(PROJECT_ID));

    act(() => {
      result.current.suppress({ ruleId: 'a', instanceId: '1', reason: 'r' });
      result.current.suppress({ ruleId: 'b', instanceId: '2', reason: 'r' });
    });

    act(() => {
      result.current.clearAll();
    });

    expect(result.current.suppressions).toHaveLength(0);
  });

  it('purgeExpired() cleans up expired items', () => {
    const { result } = renderHook(() => useDrcSuppression(PROJECT_ID));

    act(() => {
      result.current.suppress({
        ruleId: 'a',
        instanceId: '1',
        reason: 'keep',
        permanent: true,
      });
      result.current.suppress({
        ruleId: 'b',
        instanceId: '2',
        reason: 'purge',
        expiresAt: Date.now() - 1000,
      });
    });

    let purged: number;
    act(() => {
      purged = result.current.purgeExpired();
    });

    expect(purged!).toBe(1);
    expect(result.current.suppressions).toHaveLength(1);
    expect(result.current.suppressions[0].instanceId).toBe('1');
  });

  it('expiredSuppressions returns expired items', () => {
    const { result } = renderHook(() => useDrcSuppression(PROJECT_ID));

    act(() => {
      result.current.suppress({
        ruleId: 'a',
        instanceId: '1',
        reason: 'active',
        expiresAt: Date.now() + 100000,
      });
      result.current.suppress({
        ruleId: 'b',
        instanceId: '2',
        reason: 'expired',
        expiresAt: Date.now() - 1000,
      });
    });

    expect(result.current.expiredSuppressions).toHaveLength(1);
    expect(result.current.expiredSuppressions[0].instanceId).toBe('2');
  });
});
