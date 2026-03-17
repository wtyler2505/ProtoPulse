import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { BuildJournalManager, useBuildJournal } from '../build-journal';
import type { JournalEntry } from '../build-journal';

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

const PROJECT_A = 'project-a';
const PROJECT_B = 'project-b';

// ---------------------------------------------------------------------------
// BuildJournalManager
// ---------------------------------------------------------------------------

describe('BuildJournalManager', () => {
  let manager: BuildJournalManager;
  let mockStorage: Storage;

  beforeEach(() => {
    mockStorage = createMockLocalStorage();
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockStorage,
      writable: true,
      configurable: true,
    });
    BuildJournalManager.resetInstance();
    manager = BuildJournalManager.getInstance();
  });

  afterEach(() => {
    BuildJournalManager.resetInstance();
  });

  // -----------------------------------------------------------------------
  // Singleton
  // -----------------------------------------------------------------------

  describe('singleton', () => {
    it('returns the same instance on repeated calls', () => {
      const a = BuildJournalManager.getInstance();
      const b = BuildJournalManager.getInstance();
      expect(a).toBe(b);
    });

    it('creates a fresh instance after resetInstance', () => {
      manager.addEntry({ projectId: PROJECT_A, type: 'note', title: 'Test', body: 'Body', tags: [] });
      BuildJournalManager.resetInstance();
      const fresh = BuildJournalManager.getInstance();
      // fresh instance loads from localStorage, so it should still have the entry
      expect(fresh.getCount(PROJECT_A)).toBe(1);
    });
  });

  // -----------------------------------------------------------------------
  // addEntry
  // -----------------------------------------------------------------------

  describe('addEntry', () => {
    it('adds an entry and returns it with generated id and timestamp', () => {
      const entry = manager.addEntry({
        projectId: PROJECT_A,
        type: 'note',
        title: 'First note',
        body: 'Some content',
        tags: ['setup'],
      });
      expect(entry.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(entry.projectId).toBe(PROJECT_A);
      expect(entry.type).toBe('note');
      expect(entry.title).toBe('First note');
      expect(entry.body).toBe('Some content');
      expect(entry.tags).toEqual(['setup']);
      expect(entry.auto).toBe(false);
      expect(typeof entry.timestamp).toBe('number');
    });

    it('defaults tags to empty array and auto to false', () => {
      const entry = manager.addEntry({
        projectId: PROJECT_A,
        type: 'milestone',
        title: 'Launch',
        body: 'First release',
      });
      expect(entry.tags).toEqual([]);
      expect(entry.auto).toBe(false);
    });

    it('increments count after adding', () => {
      expect(manager.getCount(PROJECT_A)).toBe(0);
      manager.addEntry({ projectId: PROJECT_A, type: 'note', title: 'A', body: 'B' });
      expect(manager.getCount(PROJECT_A)).toBe(1);
      manager.addEntry({ projectId: PROJECT_A, type: 'note', title: 'C', body: 'D' });
      expect(manager.getCount(PROJECT_A)).toBe(2);
    });

    it('keeps entries isolated between projects', () => {
      manager.addEntry({ projectId: PROJECT_A, type: 'note', title: 'A', body: '' });
      manager.addEntry({ projectId: PROJECT_B, type: 'note', title: 'B', body: '' });
      expect(manager.getCount(PROJECT_A)).toBe(1);
      expect(manager.getCount(PROJECT_B)).toBe(1);
    });
  });

  // -----------------------------------------------------------------------
  // Max entries enforcement
  // -----------------------------------------------------------------------

  describe('max entries per project', () => {
    it('evicts oldest entries when exceeding 500', () => {
      const basetime = Date.now();
      const dateSpy = vi.spyOn(Date, 'now');

      for (let i = 0; i < 500; i++) {
        dateSpy.mockReturnValueOnce(basetime + i);
        manager.addEntry({ projectId: PROJECT_A, type: 'note', title: `Entry ${i}`, body: '' });
      }
      expect(manager.getCount(PROJECT_A)).toBe(500);

      // Add the 501st — should evict the oldest
      dateSpy.mockReturnValueOnce(basetime + 500);
      manager.addEntry({ projectId: PROJECT_A, type: 'note', title: 'Entry 500', body: '' });
      expect(manager.getCount(PROJECT_A)).toBe(500);

      // Oldest (timestamp = basetime + 0) should be gone
      const timeline = manager.getTimeline(PROJECT_A);
      expect(timeline[0].title).toBe('Entry 1');
      expect(timeline[timeline.length - 1].title).toBe('Entry 500');

      vi.restoreAllMocks();
    });
  });

  // -----------------------------------------------------------------------
  // removeEntry
  // -----------------------------------------------------------------------

  describe('removeEntry', () => {
    it('removes an existing entry and returns true', () => {
      const entry = manager.addEntry({ projectId: PROJECT_A, type: 'note', title: 'To remove', body: '' });
      const result = manager.removeEntry(entry.id);
      expect(result).toBe(true);
      expect(manager.getCount(PROJECT_A)).toBe(0);
    });

    it('returns false for non-existent entry', () => {
      const result = manager.removeEntry('nonexistent-id');
      expect(result).toBe(false);
    });

    it('cleans up project key when last entry removed', () => {
      const entry = manager.addEntry({ projectId: PROJECT_A, type: 'note', title: 'Only one', body: '' });
      manager.removeEntry(entry.id);
      expect(manager.getProjectIds()).not.toContain(PROJECT_A);
    });
  });

  // -----------------------------------------------------------------------
  // updateEntry
  // -----------------------------------------------------------------------

  describe('updateEntry', () => {
    it('updates title and body', () => {
      const entry = manager.addEntry({ projectId: PROJECT_A, type: 'note', title: 'Old', body: 'Old body' });
      const updated = manager.updateEntry(entry.id, { title: 'New', body: 'New body' });
      expect(updated).not.toBeNull();
      expect(updated!.title).toBe('New');
      expect(updated!.body).toBe('New body');
    });

    it('updates tags', () => {
      const entry = manager.addEntry({ projectId: PROJECT_A, type: 'note', title: 'T', body: '', tags: ['old'] });
      const updated = manager.updateEntry(entry.id, { tags: ['new', 'updated'] });
      expect(updated!.tags).toEqual(['new', 'updated']);
    });

    it('updates type', () => {
      const entry = manager.addEntry({ projectId: PROJECT_A, type: 'note', title: 'T', body: '' });
      const updated = manager.updateEntry(entry.id, { type: 'decision' });
      expect(updated!.type).toBe('decision');
    });

    it('returns null for non-existent entry', () => {
      const result = manager.updateEntry('nonexistent', { title: 'X' });
      expect(result).toBeNull();
    });

    it('returns a copy (not a reference to internal state)', () => {
      const entry = manager.addEntry({ projectId: PROJECT_A, type: 'note', title: 'T', body: '' });
      const updated = manager.updateEntry(entry.id, { title: 'Updated' });
      updated!.title = 'Mutated';
      const fetched = manager.getEntry(entry.id);
      expect(fetched!.title).toBe('Updated');
    });
  });

  // -----------------------------------------------------------------------
  // clearProject
  // -----------------------------------------------------------------------

  describe('clearProject', () => {
    it('removes all entries for a project', () => {
      manager.addEntry({ projectId: PROJECT_A, type: 'note', title: 'A1', body: '' });
      manager.addEntry({ projectId: PROJECT_A, type: 'note', title: 'A2', body: '' });
      manager.clearProject(PROJECT_A);
      expect(manager.getCount(PROJECT_A)).toBe(0);
    });

    it('does not affect other projects', () => {
      manager.addEntry({ projectId: PROJECT_A, type: 'note', title: 'A', body: '' });
      manager.addEntry({ projectId: PROJECT_B, type: 'note', title: 'B', body: '' });
      manager.clearProject(PROJECT_A);
      expect(manager.getCount(PROJECT_B)).toBe(1);
    });

    it('is safe when project has no entries', () => {
      expect(() => {
        manager.clearProject('nonexistent-project');
      }).not.toThrow();
    });
  });

  // -----------------------------------------------------------------------
  // getEntries with filters
  // -----------------------------------------------------------------------

  describe('getEntries', () => {
    it('returns entries sorted by timestamp descending (newest first)', () => {
      const now = Date.now();
      const dateSpy = vi.spyOn(Date, 'now');
      dateSpy.mockReturnValueOnce(now - 2000);
      manager.addEntry({ projectId: PROJECT_A, type: 'note', title: 'Oldest', body: '' });
      dateSpy.mockReturnValueOnce(now - 1000);
      manager.addEntry({ projectId: PROJECT_A, type: 'note', title: 'Middle', body: '' });
      dateSpy.mockReturnValueOnce(now);
      manager.addEntry({ projectId: PROJECT_A, type: 'note', title: 'Newest', body: '' });

      const entries = manager.getEntries(PROJECT_A);
      expect(entries[0].title).toBe('Newest');
      expect(entries[1].title).toBe('Middle');
      expect(entries[2].title).toBe('Oldest');

      vi.restoreAllMocks();
    });

    it('returns empty array for unknown project', () => {
      expect(manager.getEntries('unknown')).toEqual([]);
    });

    it('filters by type', () => {
      manager.addEntry({ projectId: PROJECT_A, type: 'note', title: 'Note', body: '' });
      manager.addEntry({ projectId: PROJECT_A, type: 'milestone', title: 'Milestone', body: '' });
      manager.addEntry({ projectId: PROJECT_A, type: 'decision', title: 'Decision', body: '' });

      const notes = manager.getEntries(PROJECT_A, { type: 'note' });
      expect(notes).toHaveLength(1);
      expect(notes[0].title).toBe('Note');
    });

    it('filters by auto flag', () => {
      manager.addEntry({ projectId: PROJECT_A, type: 'note', title: 'Manual', body: '', auto: false });
      manager.autoLog(PROJECT_A, 'note', 'Auto', 'Auto body');

      const autoOnly = manager.getEntries(PROJECT_A, { auto: true });
      expect(autoOnly).toHaveLength(1);
      expect(autoOnly[0].title).toBe('Auto');

      const manualOnly = manager.getEntries(PROJECT_A, { auto: false });
      expect(manualOnly).toHaveLength(1);
      expect(manualOnly[0].title).toBe('Manual');
    });

    it('filters by tags (case insensitive)', () => {
      manager.addEntry({ projectId: PROJECT_A, type: 'note', title: 'Tagged', body: '', tags: ['Bug', 'critical'] });
      manager.addEntry({ projectId: PROJECT_A, type: 'note', title: 'Other', body: '', tags: ['feature'] });

      const bugEntries = manager.getEntries(PROJECT_A, { tags: ['bug'] });
      expect(bugEntries).toHaveLength(1);
      expect(bugEntries[0].title).toBe('Tagged');
    });

    it('filters by since timestamp', () => {
      const now = Date.now();
      const dateSpy = vi.spyOn(Date, 'now');
      dateSpy.mockReturnValueOnce(now - 5000);
      manager.addEntry({ projectId: PROJECT_A, type: 'note', title: 'Old', body: '' });
      dateSpy.mockReturnValueOnce(now);
      manager.addEntry({ projectId: PROJECT_A, type: 'note', title: 'Recent', body: '' });

      const recent = manager.getEntries(PROJECT_A, { since: now - 1000 });
      expect(recent).toHaveLength(1);
      expect(recent[0].title).toBe('Recent');

      vi.restoreAllMocks();
    });

    it('filters by until timestamp', () => {
      const now = Date.now();
      const dateSpy = vi.spyOn(Date, 'now');
      dateSpy.mockReturnValueOnce(now - 5000);
      manager.addEntry({ projectId: PROJECT_A, type: 'note', title: 'Old', body: '' });
      dateSpy.mockReturnValueOnce(now);
      manager.addEntry({ projectId: PROJECT_A, type: 'note', title: 'Recent', body: '' });

      const old = manager.getEntries(PROJECT_A, { until: now - 1000 });
      expect(old).toHaveLength(1);
      expect(old[0].title).toBe('Old');

      vi.restoreAllMocks();
    });

    it('combines multiple filters', () => {
      const now = Date.now();
      const dateSpy = vi.spyOn(Date, 'now');
      dateSpy.mockReturnValueOnce(now - 5000);
      manager.addEntry({ projectId: PROJECT_A, type: 'note', title: 'Old note', body: '', tags: ['setup'] });
      dateSpy.mockReturnValueOnce(now);
      manager.addEntry({ projectId: PROJECT_A, type: 'milestone', title: 'Recent milestone', body: '', tags: ['setup'] });
      dateSpy.mockReturnValueOnce(now);
      manager.addEntry({ projectId: PROJECT_A, type: 'note', title: 'Recent note', body: '', tags: ['setup'] });

      const result = manager.getEntries(PROJECT_A, { type: 'note', since: now - 1000, tags: ['setup'] });
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Recent note');

      vi.restoreAllMocks();
    });
  });

  // -----------------------------------------------------------------------
  // searchEntries
  // -----------------------------------------------------------------------

  describe('searchEntries', () => {
    it('searches by title', () => {
      manager.addEntry({ projectId: PROJECT_A, type: 'note', title: 'Power supply design', body: '' });
      manager.addEntry({ projectId: PROJECT_A, type: 'note', title: 'Motor wiring', body: '' });

      const results = manager.searchEntries(PROJECT_A, 'power');
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Power supply design');
    });

    it('searches by body', () => {
      manager.addEntry({ projectId: PROJECT_A, type: 'note', title: 'Entry', body: 'Need to add decoupling capacitors' });
      manager.addEntry({ projectId: PROJECT_A, type: 'note', title: 'Other', body: 'Motor control logic' });

      const results = manager.searchEntries(PROJECT_A, 'capacitor');
      expect(results).toHaveLength(1);
      expect(results[0].body).toContain('capacitors');
    });

    it('searches by tags', () => {
      manager.addEntry({ projectId: PROJECT_A, type: 'note', title: 'Entry', body: '', tags: ['electronics'] });
      manager.addEntry({ projectId: PROJECT_A, type: 'note', title: 'Other', body: '', tags: ['software'] });

      const results = manager.searchEntries(PROJECT_A, 'electronics');
      expect(results).toHaveLength(1);
      expect(results[0].tags).toContain('electronics');
    });

    it('is case insensitive', () => {
      manager.addEntry({ projectId: PROJECT_A, type: 'note', title: 'PCB Layout', body: '' });
      const results = manager.searchEntries(PROJECT_A, 'pcb layout');
      expect(results).toHaveLength(1);
    });

    it('returns all entries for empty query', () => {
      manager.addEntry({ projectId: PROJECT_A, type: 'note', title: 'A', body: '' });
      manager.addEntry({ projectId: PROJECT_A, type: 'note', title: 'B', body: '' });

      const results = manager.searchEntries(PROJECT_A, '');
      expect(results).toHaveLength(2);
    });

    it('returns all entries for whitespace-only query', () => {
      manager.addEntry({ projectId: PROJECT_A, type: 'note', title: 'A', body: '' });
      const results = manager.searchEntries(PROJECT_A, '   ');
      expect(results).toHaveLength(1);
    });

    it('returns results sorted newest first', () => {
      const now = Date.now();
      const dateSpy = vi.spyOn(Date, 'now');
      dateSpy.mockReturnValueOnce(now - 1000);
      manager.addEntry({ projectId: PROJECT_A, type: 'note', title: 'PCB v1', body: '' });
      dateSpy.mockReturnValueOnce(now);
      manager.addEntry({ projectId: PROJECT_A, type: 'note', title: 'PCB v2', body: '' });

      const results = manager.searchEntries(PROJECT_A, 'PCB');
      expect(results[0].title).toBe('PCB v2');
      expect(results[1].title).toBe('PCB v1');

      vi.restoreAllMocks();
    });
  });

  // -----------------------------------------------------------------------
  // autoLog
  // -----------------------------------------------------------------------

  describe('autoLog', () => {
    it('creates an entry with auto=true and "auto" tag', () => {
      const entry = manager.autoLog(PROJECT_A, 'milestone', 'Build complete', 'All tests passing');
      expect(entry.auto).toBe(true);
      expect(entry.tags).toContain('auto');
      expect(entry.type).toBe('milestone');
      expect(entry.title).toBe('Build complete');
      expect(entry.body).toBe('All tests passing');
    });
  });

  // -----------------------------------------------------------------------
  // getTimeline
  // -----------------------------------------------------------------------

  describe('getTimeline', () => {
    it('returns entries sorted ascending (chronological order)', () => {
      const now = Date.now();
      const dateSpy = vi.spyOn(Date, 'now');
      dateSpy.mockReturnValueOnce(now + 2000);
      manager.addEntry({ projectId: PROJECT_A, type: 'note', title: 'Later', body: '' });
      dateSpy.mockReturnValueOnce(now);
      manager.addEntry({ projectId: PROJECT_A, type: 'note', title: 'Earlier', body: '' });

      const timeline = manager.getTimeline(PROJECT_A);
      expect(timeline[0].title).toBe('Earlier');
      expect(timeline[1].title).toBe('Later');

      vi.restoreAllMocks();
    });

    it('returns empty array for unknown project', () => {
      expect(manager.getTimeline('unknown')).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // getEntry
  // -----------------------------------------------------------------------

  describe('getEntry', () => {
    it('returns a copy of the entry', () => {
      const created = manager.addEntry({ projectId: PROJECT_A, type: 'note', title: 'T', body: '' });
      const fetched = manager.getEntry(created.id);
      expect(fetched).not.toBeNull();
      expect(fetched!.id).toBe(created.id);
      expect(fetched!.title).toBe('T');

      // Verify it is a copy
      fetched!.title = 'Mutated';
      const fetchedAgain = manager.getEntry(created.id);
      expect(fetchedAgain!.title).toBe('T');
    });

    it('returns null for non-existent entry', () => {
      expect(manager.getEntry('nonexistent')).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // getProjectIds
  // -----------------------------------------------------------------------

  describe('getProjectIds', () => {
    it('returns project IDs that have entries', () => {
      manager.addEntry({ projectId: PROJECT_A, type: 'note', title: 'A', body: '' });
      manager.addEntry({ projectId: PROJECT_B, type: 'note', title: 'B', body: '' });
      const ids = manager.getProjectIds();
      expect(ids).toContain(PROJECT_A);
      expect(ids).toContain(PROJECT_B);
    });

    it('returns empty array when no entries exist', () => {
      expect(manager.getProjectIds()).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // localStorage persistence
  // -----------------------------------------------------------------------

  describe('persistence', () => {
    it('persists to localStorage on addEntry', () => {
      manager.addEntry({ projectId: PROJECT_A, type: 'note', title: 'Persist test', body: '' });
      expect(mockStorage.setItem).toHaveBeenCalledWith(
        'protopulse:build-journal',
        expect.any(String),
      );
    });

    it('persists to localStorage on removeEntry', () => {
      const entry = manager.addEntry({ projectId: PROJECT_A, type: 'note', title: 'T', body: '' });
      vi.mocked(mockStorage.setItem).mockClear();
      manager.removeEntry(entry.id);
      expect(mockStorage.setItem).toHaveBeenCalled();
    });

    it('persists to localStorage on updateEntry', () => {
      const entry = manager.addEntry({ projectId: PROJECT_A, type: 'note', title: 'T', body: '' });
      vi.mocked(mockStorage.setItem).mockClear();
      manager.updateEntry(entry.id, { title: 'Updated' });
      expect(mockStorage.setItem).toHaveBeenCalled();
    });

    it('persists to localStorage on clearProject', () => {
      manager.addEntry({ projectId: PROJECT_A, type: 'note', title: 'T', body: '' });
      vi.mocked(mockStorage.setItem).mockClear();
      manager.clearProject(PROJECT_A);
      expect(mockStorage.setItem).toHaveBeenCalled();
    });

    it('loads from localStorage on init', () => {
      const entries: Record<string, JournalEntry[]> = {
        [PROJECT_A]: [
          {
            id: 'test-id-1',
            projectId: PROJECT_A,
            timestamp: Date.now(),
            type: 'note',
            title: 'Loaded',
            body: 'From storage',
            tags: ['test'],
            auto: false,
          },
        ],
      };
      vi.mocked(mockStorage.getItem).mockReturnValue(JSON.stringify(entries));

      BuildJournalManager.resetInstance();
      const loaded = BuildJournalManager.getInstance();
      expect(loaded.getCount(PROJECT_A)).toBe(1);
      expect(loaded.getEntry('test-id-1')).not.toBeNull();
      expect(loaded.getEntry('test-id-1')!.title).toBe('Loaded');
    });

    it('handles corrupt localStorage gracefully', () => {
      vi.mocked(mockStorage.getItem).mockReturnValue('not valid json{{{');
      BuildJournalManager.resetInstance();
      const loaded = BuildJournalManager.getInstance();
      expect(loaded.getCount(PROJECT_A)).toBe(0);
    });

    it('handles non-object localStorage data gracefully', () => {
      vi.mocked(mockStorage.getItem).mockReturnValue('"just a string"');
      BuildJournalManager.resetInstance();
      const loaded = BuildJournalManager.getInstance();
      expect(loaded.getCount(PROJECT_A)).toBe(0);
    });

    it('handles array localStorage data gracefully', () => {
      vi.mocked(mockStorage.getItem).mockReturnValue('[1, 2, 3]');
      BuildJournalManager.resetInstance();
      const loaded = BuildJournalManager.getInstance();
      expect(loaded.getCount(PROJECT_A)).toBe(0);
    });

    it('filters out invalid entries from localStorage', () => {
      const data = {
        [PROJECT_A]: [
          {
            id: 'valid-1',
            projectId: PROJECT_A,
            timestamp: 123,
            type: 'note',
            title: 'Valid',
            body: '',
            tags: [],
            auto: false,
          },
          { invalid: true }, // missing required fields
          {
            id: 'valid-2',
            projectId: PROJECT_A,
            timestamp: 456,
            type: 'milestone',
            title: 'Also valid',
            body: 'Body',
            tags: ['test'],
            auto: true,
          },
        ],
      };
      vi.mocked(mockStorage.getItem).mockReturnValue(JSON.stringify(data));
      BuildJournalManager.resetInstance();
      const loaded = BuildJournalManager.getInstance();
      expect(loaded.getCount(PROJECT_A)).toBe(2);
    });

    it('skips non-array values in project entries', () => {
      const data = {
        [PROJECT_A]: 'not an array',
        [PROJECT_B]: [
          {
            id: 'valid-1',
            projectId: PROJECT_B,
            timestamp: 123,
            type: 'note',
            title: 'Valid',
            body: '',
            tags: [],
            auto: false,
          },
        ],
      };
      vi.mocked(mockStorage.getItem).mockReturnValue(JSON.stringify(data));
      BuildJournalManager.resetInstance();
      const loaded = BuildJournalManager.getInstance();
      expect(loaded.getCount(PROJECT_A)).toBe(0);
      expect(loaded.getCount(PROJECT_B)).toBe(1);
    });
  });

  // -----------------------------------------------------------------------
  // Subscribe / unsubscribe
  // -----------------------------------------------------------------------

  describe('subscribe', () => {
    it('calls subscriber on addEntry', () => {
      const callback = vi.fn();
      manager.subscribe(callback);
      manager.addEntry({ projectId: PROJECT_A, type: 'note', title: 'T', body: '' });
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('calls subscriber on removeEntry', () => {
      const entry = manager.addEntry({ projectId: PROJECT_A, type: 'note', title: 'T', body: '' });
      const callback = vi.fn();
      manager.subscribe(callback);
      manager.removeEntry(entry.id);
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('calls subscriber on updateEntry', () => {
      const entry = manager.addEntry({ projectId: PROJECT_A, type: 'note', title: 'T', body: '' });
      const callback = vi.fn();
      manager.subscribe(callback);
      manager.updateEntry(entry.id, { title: 'Updated' });
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('calls subscriber on clearProject', () => {
      manager.addEntry({ projectId: PROJECT_A, type: 'note', title: 'T', body: '' });
      const callback = vi.fn();
      manager.subscribe(callback);
      manager.clearProject(PROJECT_A);
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('does not call subscriber after unsubscribe', () => {
      const callback = vi.fn();
      const unsub = manager.subscribe(callback);
      unsub();
      manager.addEntry({ projectId: PROJECT_A, type: 'note', title: 'T', body: '' });
      expect(callback).not.toHaveBeenCalled();
    });

    it('does not notify on remove of non-existent entry', () => {
      const callback = vi.fn();
      manager.subscribe(callback);
      manager.removeEntry('nonexistent');
      expect(callback).not.toHaveBeenCalled();
    });

    it('does not notify on clearProject when already empty', () => {
      const callback = vi.fn();
      manager.subscribe(callback);
      manager.clearProject(PROJECT_A);
      expect(callback).not.toHaveBeenCalled();
    });

    it('does not notify on update of non-existent entry', () => {
      const callback = vi.fn();
      manager.subscribe(callback);
      manager.updateEntry('nonexistent', { title: 'X' });
      expect(callback).not.toHaveBeenCalled();
    });

    it('supports multiple subscribers', () => {
      const cb1 = vi.fn();
      const cb2 = vi.fn();
      manager.subscribe(cb1);
      manager.subscribe(cb2);
      manager.addEntry({ projectId: PROJECT_A, type: 'note', title: 'T', body: '' });
      expect(cb1).toHaveBeenCalledTimes(1);
      expect(cb2).toHaveBeenCalledTimes(1);
    });
  });

  // -----------------------------------------------------------------------
  // Entry types coverage
  // -----------------------------------------------------------------------

  describe('entry types', () => {
    it.each<'note' | 'milestone' | 'decision' | 'issue' | 'resolution'>([
      'note',
      'milestone',
      'decision',
      'issue',
      'resolution',
    ])('supports type "%s"', (type) => {
      const entry = manager.addEntry({ projectId: PROJECT_A, type, title: `${type} entry`, body: '' });
      expect(entry.type).toBe(type);
      const filtered = manager.getEntries(PROJECT_A, { type });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].type).toBe(type);
    });
  });
});

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

describe('useBuildJournal', () => {
  let mockStorage: Storage;

  beforeEach(() => {
    mockStorage = createMockLocalStorage();
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockStorage,
      writable: true,
      configurable: true,
    });
    BuildJournalManager.resetInstance();
  });

  afterEach(() => {
    BuildJournalManager.resetInstance();
  });

  it('returns initial empty state', () => {
    const { result } = renderHook(() => useBuildJournal(PROJECT_A));
    expect(result.current.entries).toEqual([]);
    expect(result.current.timeline).toEqual([]);
    expect(result.current.count).toBe(0);
  });

  it('adds an entry via hook', () => {
    const { result } = renderHook(() => useBuildJournal(PROJECT_A));
    act(() => {
      result.current.addEntry({ type: 'note', title: 'Hook test', body: 'Body' });
    });
    expect(result.current.entries).toHaveLength(1);
    expect(result.current.entries[0].title).toBe('Hook test');
    expect(result.current.count).toBe(1);
  });

  it('removes an entry via hook', () => {
    const { result } = renderHook(() => useBuildJournal(PROJECT_A));
    let entryId: string;
    act(() => {
      const entry = result.current.addEntry({ type: 'note', title: 'T', body: '' });
      entryId = entry.id;
    });
    act(() => {
      result.current.removeEntry(entryId);
    });
    expect(result.current.entries).toHaveLength(0);
    expect(result.current.count).toBe(0);
  });

  it('updates an entry via hook', () => {
    const { result } = renderHook(() => useBuildJournal(PROJECT_A));
    let entryId: string;
    act(() => {
      const entry = result.current.addEntry({ type: 'note', title: 'Old', body: '' });
      entryId = entry.id;
    });
    act(() => {
      result.current.updateEntry(entryId, { title: 'New' });
    });
    expect(result.current.entries[0].title).toBe('New');
  });

  it('searches entries via hook', () => {
    const { result } = renderHook(() => useBuildJournal(PROJECT_A));
    act(() => {
      result.current.addEntry({ type: 'note', title: 'Power supply', body: '' });
      result.current.addEntry({ type: 'note', title: 'Motor wiring', body: '' });
    });
    const results = result.current.searchEntries('power');
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('Power supply');
  });

  it('auto-logs via hook', () => {
    const { result } = renderHook(() => useBuildJournal(PROJECT_A));
    act(() => {
      result.current.autoLog('milestone', 'Build done', 'All green');
    });
    expect(result.current.entries).toHaveLength(1);
    expect(result.current.entries[0].auto).toBe(true);
  });

  it('provides filtered getEntries via hook', () => {
    const { result } = renderHook(() => useBuildJournal(PROJECT_A));
    act(() => {
      result.current.addEntry({ type: 'note', title: 'Note', body: '' });
      result.current.addEntry({ type: 'milestone', title: 'Milestone', body: '' });
    });
    const notes = result.current.getEntries({ type: 'note' });
    expect(notes).toHaveLength(1);
    expect(notes[0].title).toBe('Note');
  });

  it('clears project via hook', () => {
    const { result } = renderHook(() => useBuildJournal(PROJECT_A));
    act(() => {
      result.current.addEntry({ type: 'note', title: 'A', body: '' });
      result.current.addEntry({ type: 'note', title: 'B', body: '' });
    });
    act(() => {
      result.current.clearProject();
    });
    expect(result.current.entries).toEqual([]);
    expect(result.current.count).toBe(0);
  });

  it('provides timeline in chronological order', () => {
    const { result } = renderHook(() => useBuildJournal(PROJECT_A));
    const now = Date.now();
    const dateSpy = vi.spyOn(Date, 'now');
    dateSpy.mockReturnValueOnce(now + 2000);
    act(() => {
      result.current.addEntry({ type: 'note', title: 'Later', body: '' });
    });
    dateSpy.mockReturnValueOnce(now);
    act(() => {
      result.current.addEntry({ type: 'note', title: 'Earlier', body: '' });
    });
    expect(result.current.timeline[0].title).toBe('Earlier');
    expect(result.current.timeline[1].title).toBe('Later');

    vi.restoreAllMocks();
  });

  it('cleans up subscription on unmount', () => {
    const { unmount } = renderHook(() => useBuildJournal(PROJECT_A));
    unmount();
    // Should not throw when manager notifies after unmount
    expect(() => {
      BuildJournalManager.getInstance().addEntry({
        projectId: PROJECT_A,
        type: 'note',
        title: 'After unmount',
        body: '',
      });
    }).not.toThrow();
  });
});
