import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ReviewResolutionManager,
  RESOLUTION_LABELS,
  RESOLUTION_COLORS,
  ALL_STATUSES,
} from '../review-resolution';
import type { ResolutionStatus } from '../review-resolution';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createManager(): ReviewResolutionManager {
  return ReviewResolutionManager.createInstance();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ReviewResolutionManager', () => {
  beforeEach(() => {
    ReviewResolutionManager.resetInstance();
    localStorage.clear();
  });

  // -------------------------------------------------------------------------
  // Singleton
  // -------------------------------------------------------------------------

  describe('singleton', () => {
    it('returns the same instance on repeated calls', () => {
      const a = ReviewResolutionManager.getInstance();
      const b = ReviewResolutionManager.getInstance();
      expect(a).toBe(b);
    });

    it('resets the singleton', () => {
      const a = ReviewResolutionManager.getInstance();
      ReviewResolutionManager.resetInstance();
      const b = ReviewResolutionManager.getInstance();
      expect(a).not.toBe(b);
    });

    it('createInstance returns a standalone instance', () => {
      const singleton = ReviewResolutionManager.getInstance();
      const standalone = ReviewResolutionManager.createInstance();
      expect(standalone).not.toBe(singleton);
    });
  });

  // -------------------------------------------------------------------------
  // Status management
  // -------------------------------------------------------------------------

  describe('setStatus / getStatus', () => {
    it('defaults to open when no entry exists', () => {
      const mgr = createManager();
      expect(mgr.getStatus('issue-1')).toBe('open');
    });

    it('sets and retrieves a status', () => {
      const mgr = createManager();
      mgr.setStatus('issue-1', 'resolved');
      expect(mgr.getStatus('issue-1')).toBe('resolved');
    });

    it('overwrites an existing status', () => {
      const mgr = createManager();
      mgr.setStatus('issue-1', 'resolved');
      mgr.setStatus('issue-1', 'blocked');
      expect(mgr.getStatus('issue-1')).toBe('blocked');
    });

    it('preserves note when updating status', () => {
      const mgr = createManager();
      mgr.setNote('issue-1', 'some note');
      mgr.setStatus('issue-1', 'wontfix');
      expect(mgr.getNote('issue-1')).toBe('some note');
      expect(mgr.getStatus('issue-1')).toBe('wontfix');
    });

    it('sets updatedAt timestamp', () => {
      const mgr = createManager();
      const before = Date.now();
      mgr.setStatus('issue-1', 'resolved');
      const after = Date.now();
      const entry = mgr.getEntry('issue-1');
      expect(entry).toBeDefined();
      expect(entry!.updatedAt).toBeGreaterThanOrEqual(before);
      expect(entry!.updatedAt).toBeLessThanOrEqual(after);
    });
  });

  // -------------------------------------------------------------------------
  // Note management
  // -------------------------------------------------------------------------

  describe('setNote / getNote', () => {
    it('defaults to empty string when no entry exists', () => {
      const mgr = createManager();
      expect(mgr.getNote('issue-1')).toBe('');
    });

    it('sets and retrieves a note', () => {
      const mgr = createManager();
      mgr.setNote('issue-1', 'Waiting on upstream fix');
      expect(mgr.getNote('issue-1')).toBe('Waiting on upstream fix');
    });

    it('defaults status to open when setting note on new entry', () => {
      const mgr = createManager();
      mgr.setNote('issue-1', 'A note');
      expect(mgr.getStatus('issue-1')).toBe('open');
    });

    it('preserves status when updating note', () => {
      const mgr = createManager();
      mgr.setStatus('issue-1', 'blocked');
      mgr.setNote('issue-1', 'Need more info');
      expect(mgr.getStatus('issue-1')).toBe('blocked');
      expect(mgr.getNote('issue-1')).toBe('Need more info');
    });
  });

  // -------------------------------------------------------------------------
  // getEntry
  // -------------------------------------------------------------------------

  describe('getEntry', () => {
    it('returns undefined for unknown issues', () => {
      const mgr = createManager();
      expect(mgr.getEntry('nonexistent')).toBeUndefined();
    });

    it('returns full entry with all fields', () => {
      const mgr = createManager();
      mgr.setStatus('issue-1', 'resolved');
      mgr.setNote('issue-1', 'Fixed in v2');
      const entry = mgr.getEntry('issue-1');
      expect(entry).toEqual({
        issueId: 'issue-1',
        status: 'resolved',
        note: 'Fixed in v2',
        updatedAt: expect.any(Number) as number,
      });
    });
  });

  // -------------------------------------------------------------------------
  // remove / clear
  // -------------------------------------------------------------------------

  describe('remove', () => {
    it('removes a tracked entry', () => {
      const mgr = createManager();
      mgr.setStatus('issue-1', 'resolved');
      mgr.remove('issue-1');
      expect(mgr.getEntry('issue-1')).toBeUndefined();
      expect(mgr.size).toBe(0);
    });

    it('is a no-op for unknown issues', () => {
      const mgr = createManager();
      const listener = vi.fn();
      mgr.subscribe(listener);
      mgr.remove('nonexistent');
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('clear', () => {
    it('removes all entries', () => {
      const mgr = createManager();
      mgr.setStatus('a', 'resolved');
      mgr.setStatus('b', 'blocked');
      mgr.setStatus('c', 'wontfix');
      mgr.clear();
      expect(mgr.size).toBe(0);
      expect(mgr.getAllEntries()).toEqual([]);
    });

    it('is a no-op when already empty', () => {
      const mgr = createManager();
      const listener = vi.fn();
      mgr.subscribe(listener);
      mgr.clear();
      expect(listener).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // getAllEntries / getCountByStatus / size
  // -------------------------------------------------------------------------

  describe('getAllEntries', () => {
    it('returns all tracked entries', () => {
      const mgr = createManager();
      mgr.setStatus('a', 'open');
      mgr.setStatus('b', 'resolved');
      mgr.setStatus('c', 'blocked');
      const entries = mgr.getAllEntries();
      expect(entries).toHaveLength(3);
      const ids = entries.map((e) => e.issueId).sort();
      expect(ids).toEqual(['a', 'b', 'c']);
    });
  });

  describe('getCountByStatus', () => {
    it('returns zero counts when empty', () => {
      const mgr = createManager();
      expect(mgr.getCountByStatus()).toEqual({ open: 0, resolved: 0, blocked: 0, wontfix: 0 });
    });

    it('counts entries per status', () => {
      const mgr = createManager();
      mgr.setStatus('a', 'open');
      mgr.setStatus('b', 'resolved');
      mgr.setStatus('c', 'resolved');
      mgr.setStatus('d', 'blocked');
      mgr.setStatus('e', 'wontfix');
      expect(mgr.getCountByStatus()).toEqual({ open: 1, resolved: 2, blocked: 1, wontfix: 1 });
    });
  });

  describe('size', () => {
    it('reflects number of tracked entries', () => {
      const mgr = createManager();
      expect(mgr.size).toBe(0);
      mgr.setStatus('a', 'open');
      expect(mgr.size).toBe(1);
      mgr.setStatus('b', 'blocked');
      expect(mgr.size).toBe(2);
      mgr.remove('a');
      expect(mgr.size).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // Subscribe / notify
  // -------------------------------------------------------------------------

  describe('subscribe', () => {
    it('notifies on setStatus', () => {
      const mgr = createManager();
      const listener = vi.fn();
      mgr.subscribe(listener);
      mgr.setStatus('issue-1', 'resolved');
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('notifies on setNote', () => {
      const mgr = createManager();
      const listener = vi.fn();
      mgr.subscribe(listener);
      mgr.setNote('issue-1', 'note');
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('notifies on remove', () => {
      const mgr = createManager();
      mgr.setStatus('issue-1', 'open');
      const listener = vi.fn();
      mgr.subscribe(listener);
      mgr.remove('issue-1');
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('notifies on clear', () => {
      const mgr = createManager();
      mgr.setStatus('issue-1', 'open');
      const listener = vi.fn();
      mgr.subscribe(listener);
      mgr.clear();
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('unsubscribes cleanly', () => {
      const mgr = createManager();
      const listener = vi.fn();
      const unsub = mgr.subscribe(listener);
      unsub();
      mgr.setStatus('issue-1', 'resolved');
      expect(listener).not.toHaveBeenCalled();
    });

    it('supports multiple listeners', () => {
      const mgr = createManager();
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      mgr.subscribe(listener1);
      mgr.subscribe(listener2);
      mgr.setStatus('issue-1', 'resolved');
      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // getSnapshot
  // -------------------------------------------------------------------------

  describe('getSnapshot', () => {
    it('returns current entries map', () => {
      const mgr = createManager();
      mgr.setStatus('a', 'resolved');
      const snap = mgr.getSnapshot();
      expect(snap.entries.get('a')?.status).toBe('resolved');
    });

    it('reflects changes after mutation', () => {
      const mgr = createManager();
      mgr.setStatus('a', 'open');
      mgr.setStatus('a', 'blocked');
      expect(mgr.getSnapshot().entries.get('a')?.status).toBe('blocked');
    });
  });

  // -------------------------------------------------------------------------
  // Persistence (localStorage)
  // -------------------------------------------------------------------------

  describe('persistence', () => {
    it('persists entries to localStorage on setStatus', () => {
      const mgr = ReviewResolutionManager.getInstance();
      mgr.setStatus('issue-1', 'resolved');
      const stored = localStorage.getItem('protopulse:review-resolutions');
      expect(stored).toBeTruthy();
      const parsed = JSON.parse(stored!) as unknown[];
      expect(parsed).toHaveLength(1);
    });

    it('restores entries from localStorage on getInstance', () => {
      const data = [
        { issueId: 'a', status: 'blocked', note: 'waiting', updatedAt: 1000 },
        { issueId: 'b', status: 'resolved', note: '', updatedAt: 2000 },
      ];
      localStorage.setItem('protopulse:review-resolutions', JSON.stringify(data));
      ReviewResolutionManager.resetInstance();
      const mgr = ReviewResolutionManager.getInstance();
      expect(mgr.getStatus('a')).toBe('blocked');
      expect(mgr.getNote('a')).toBe('waiting');
      expect(mgr.getStatus('b')).toBe('resolved');
      expect(mgr.size).toBe(2);
    });

    it('ignores corrupt localStorage data', () => {
      localStorage.setItem('protopulse:review-resolutions', 'not-json!!!');
      ReviewResolutionManager.resetInstance();
      const mgr = ReviewResolutionManager.getInstance();
      expect(mgr.size).toBe(0);
    });

    it('ignores entries with invalid status', () => {
      const data = [
        { issueId: 'a', status: 'invalid-status', note: '', updatedAt: 1000 },
        { issueId: 'b', status: 'resolved', note: '', updatedAt: 2000 },
      ];
      localStorage.setItem('protopulse:review-resolutions', JSON.stringify(data));
      ReviewResolutionManager.resetInstance();
      const mgr = ReviewResolutionManager.getInstance();
      expect(mgr.size).toBe(1);
      expect(mgr.getStatus('a')).toBe('open'); // default — not loaded
      expect(mgr.getStatus('b')).toBe('resolved');
    });

    it('ignores entries with missing fields', () => {
      const data = [
        { issueId: 'a' }, // missing status, note, updatedAt
        { status: 'resolved', note: '', updatedAt: 1000 }, // missing issueId
      ];
      localStorage.setItem('protopulse:review-resolutions', JSON.stringify(data));
      ReviewResolutionManager.resetInstance();
      const mgr = ReviewResolutionManager.getInstance();
      expect(mgr.size).toBe(0);
    });

    it('persists on clear', () => {
      const mgr = ReviewResolutionManager.getInstance();
      mgr.setStatus('a', 'resolved');
      mgr.clear();
      const stored = localStorage.getItem('protopulse:review-resolutions');
      expect(JSON.parse(stored!)).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // Constants
  // -------------------------------------------------------------------------

  describe('constants', () => {
    it('ALL_STATUSES has 4 entries', () => {
      expect(ALL_STATUSES).toEqual(['open', 'resolved', 'blocked', 'wontfix']);
    });

    it('RESOLUTION_LABELS has labels for all statuses', () => {
      for (const status of ALL_STATUSES) {
        expect(typeof RESOLUTION_LABELS[status]).toBe('string');
        expect(RESOLUTION_LABELS[status].length).toBeGreaterThan(0);
      }
    });

    it('RESOLUTION_COLORS has Tailwind classes for all statuses', () => {
      for (const status of ALL_STATUSES) {
        expect(typeof RESOLUTION_COLORS[status]).toBe('string');
        expect(RESOLUTION_COLORS[status]).toMatch(/^text-/);
      }
    });
  });

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------

  describe('edge cases', () => {
    it('handles empty string issueId', () => {
      const mgr = createManager();
      mgr.setStatus('', 'resolved');
      expect(mgr.getStatus('')).toBe('resolved');
      expect(mgr.size).toBe(1);
    });

    it('handles very long notes', () => {
      const mgr = createManager();
      const longNote = 'x'.repeat(10000);
      mgr.setNote('issue-1', longNote);
      expect(mgr.getNote('issue-1')).toBe(longNote);
    });

    it('handles rapid status transitions', () => {
      const mgr = createManager();
      const statuses: ResolutionStatus[] = ['open', 'resolved', 'blocked', 'wontfix', 'open'];
      for (const s of statuses) {
        mgr.setStatus('issue-1', s);
      }
      expect(mgr.getStatus('issue-1')).toBe('open');
      expect(mgr.size).toBe(1);
    });

    it('handles many entries', () => {
      const mgr = createManager();
      for (let i = 0; i < 100; i++) {
        mgr.setStatus(`issue-${i}`, ALL_STATUSES[i % ALL_STATUSES.length]);
      }
      expect(mgr.size).toBe(100);
      const counts = mgr.getCountByStatus();
      expect(counts.open).toBe(25);
      expect(counts.resolved).toBe(25);
      expect(counts.blocked).toBe(25);
      expect(counts.wontfix).toBe(25);
    });
  });
});
