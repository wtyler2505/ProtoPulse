import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CircuitSelector } from '../circuit-selector';
import type { CircuitSelection } from '../circuit-selector';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeCircuits(count: number): Array<{ id: number; name: string }> {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    name: `Circuit ${i + 1}`,
  }));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CircuitSelector', () => {
  let selector: CircuitSelector;

  beforeEach(() => {
    CircuitSelector.resetInstance();
    localStorage.clear();
    selector = CircuitSelector.getInstance();
  });

  // -----------------------------------------------------------------------
  // Singleton
  // -----------------------------------------------------------------------

  describe('singleton', () => {
    it('returns the same instance on repeated calls', () => {
      const a = CircuitSelector.getInstance();
      const b = CircuitSelector.getInstance();
      expect(a).toBe(b);
    });

    it('returns a new instance after resetInstance()', () => {
      const a = CircuitSelector.getInstance();
      CircuitSelector.resetInstance();
      const b = CircuitSelector.getInstance();
      expect(a).not.toBe(b);
    });
  });

  // -----------------------------------------------------------------------
  // select / getSelected
  // -----------------------------------------------------------------------

  describe('select', () => {
    it('stores a selection for a project', () => {
      selector.select(1, 42, 'Main Circuit');
      const sel = selector.getSelected(1);
      expect(sel).not.toBeNull();
      expect(sel!.circuitId).toBe(42);
      expect(sel!.circuitName).toBe('Main Circuit');
      expect(sel!.selectedAt).toBeGreaterThan(0);
    });

    it('returns null for a project with no selection', () => {
      expect(selector.getSelected(999)).toBeNull();
    });

    it('overwrites a previous selection for the same project', () => {
      selector.select(1, 10, 'First');
      selector.select(1, 20, 'Second');
      const sel = selector.getSelected(1);
      expect(sel!.circuitId).toBe(20);
      expect(sel!.circuitName).toBe('Second');
    });

    it('is a no-op when selecting the same circuit again', () => {
      const notify = vi.fn();
      selector.subscribe(notify);
      selector.select(1, 42, 'Main');
      expect(notify).toHaveBeenCalledTimes(1);

      selector.select(1, 42, 'Main');
      // Should NOT have fired again
      expect(notify).toHaveBeenCalledTimes(1);
    });

    it('stores independent selections per project', () => {
      selector.select(1, 10, 'Proj 1 Circuit');
      selector.select(2, 20, 'Proj 2 Circuit');
      expect(selector.getSelected(1)!.circuitId).toBe(10);
      expect(selector.getSelected(2)!.circuitId).toBe(20);
    });
  });

  // -----------------------------------------------------------------------
  // isSelected
  // -----------------------------------------------------------------------

  describe('isSelected', () => {
    it('returns true for the currently selected circuit', () => {
      selector.select(1, 42, 'Main');
      expect(selector.isSelected(1, 42)).toBe(true);
    });

    it('returns false for a different circuit in the same project', () => {
      selector.select(1, 42, 'Main');
      expect(selector.isSelected(1, 99)).toBe(false);
    });

    it('returns false when no selection exists', () => {
      expect(selector.isSelected(1, 42)).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // clear
  // -----------------------------------------------------------------------

  describe('clear', () => {
    it('removes the selection for a specific project', () => {
      selector.select(1, 42, 'Main');
      selector.clear(1);
      expect(selector.getSelected(1)).toBeNull();
    });

    it('does not affect other projects', () => {
      selector.select(1, 10, 'Proj 1');
      selector.select(2, 20, 'Proj 2');
      selector.clear(1);
      expect(selector.getSelected(1)).toBeNull();
      expect(selector.getSelected(2)!.circuitId).toBe(20);
    });

    it('is a no-op when no selection exists', () => {
      const notify = vi.fn();
      selector.subscribe(notify);
      selector.clear(999);
      expect(notify).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // clearAll
  // -----------------------------------------------------------------------

  describe('clearAll', () => {
    it('removes all selections', () => {
      selector.select(1, 10, 'A');
      selector.select(2, 20, 'B');
      selector.clearAll();
      expect(selector.getSelected(1)).toBeNull();
      expect(selector.getSelected(2)).toBeNull();
    });

    it('is a no-op when already empty', () => {
      const notify = vi.fn();
      selector.subscribe(notify);
      selector.clearAll();
      expect(notify).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // getProjectIds
  // -----------------------------------------------------------------------

  describe('getProjectIds', () => {
    it('returns all project IDs with active selections', () => {
      selector.select(3, 30, 'C');
      selector.select(1, 10, 'A');
      const ids = selector.getProjectIds();
      expect(ids).toHaveLength(2);
      expect(ids).toContain(1);
      expect(ids).toContain(3);
    });

    it('returns empty array when no selections exist', () => {
      expect(selector.getProjectIds()).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // reconcile
  // -----------------------------------------------------------------------

  describe('reconcile', () => {
    it('auto-selects the first circuit when none is selected', () => {
      const circuits = makeCircuits(3);
      const result = selector.reconcile(1, circuits);
      expect(result).not.toBeNull();
      expect(result!.circuitId).toBe(1);
      expect(result!.circuitName).toBe('Circuit 1');
    });

    it('keeps the current selection when it is still valid', () => {
      selector.select(1, 2, 'Circuit 2');
      const circuits = makeCircuits(3);
      const result = selector.reconcile(1, circuits);
      expect(result!.circuitId).toBe(2);
      expect(result!.circuitName).toBe('Circuit 2');
    });

    it('replaces a stale selection with the first available circuit', () => {
      selector.select(1, 99, 'Deleted Circuit');
      const circuits = makeCircuits(3);
      const result = selector.reconcile(1, circuits);
      expect(result!.circuitId).toBe(1);
      expect(result!.circuitName).toBe('Circuit 1');
    });

    it('returns null and clears selection when no circuits are available', () => {
      selector.select(1, 42, 'Old');
      const result = selector.reconcile(1, []);
      expect(result).toBeNull();
      expect(selector.getSelected(1)).toBeNull();
    });

    it('is a no-op (no notification) when clearing empty and no circuits available', () => {
      const notify = vi.fn();
      selector.subscribe(notify);
      selector.reconcile(1, []);
      expect(notify).not.toHaveBeenCalled();
    });

    it('notifies when auto-selecting', () => {
      const notify = vi.fn();
      selector.subscribe(notify);
      selector.reconcile(1, makeCircuits(2));
      expect(notify).toHaveBeenCalledTimes(1);
    });
  });

  // -----------------------------------------------------------------------
  // subscribe
  // -----------------------------------------------------------------------

  describe('subscribe', () => {
    it('notifies on select', () => {
      const cb = vi.fn();
      selector.subscribe(cb);
      selector.select(1, 42, 'Main');
      expect(cb).toHaveBeenCalledTimes(1);
    });

    it('notifies on clear', () => {
      selector.select(1, 42, 'Main');
      const cb = vi.fn();
      selector.subscribe(cb);
      selector.clear(1);
      expect(cb).toHaveBeenCalledTimes(1);
    });

    it('unsubscribes correctly', () => {
      const cb = vi.fn();
      const unsub = selector.subscribe(cb);
      unsub();
      selector.select(1, 42, 'Main');
      expect(cb).not.toHaveBeenCalled();
    });

    it('supports multiple subscribers', () => {
      const cb1 = vi.fn();
      const cb2 = vi.fn();
      selector.subscribe(cb1);
      selector.subscribe(cb2);
      selector.select(1, 42, 'Main');
      expect(cb1).toHaveBeenCalledTimes(1);
      expect(cb2).toHaveBeenCalledTimes(1);
    });
  });

  // -----------------------------------------------------------------------
  // Persistence
  // -----------------------------------------------------------------------

  describe('persistence', () => {
    it('persists selections to localStorage', () => {
      selector.select(1, 42, 'Main Circuit');
      const raw = localStorage.getItem('protopulse-circuit-selection');
      expect(raw).not.toBeNull();
      const parsed = JSON.parse(raw!) as Record<string, CircuitSelection>;
      expect(parsed['1']).toBeDefined();
      expect(parsed['1'].circuitId).toBe(42);
    });

    it('loads selections from localStorage on construction', () => {
      selector.select(1, 42, 'Main Circuit');
      CircuitSelector.resetInstance();
      const fresh = CircuitSelector.getInstance();
      const sel = fresh.getSelected(1);
      expect(sel).not.toBeNull();
      expect(sel!.circuitId).toBe(42);
      expect(sel!.circuitName).toBe('Main Circuit');
    });

    it('handles corrupt localStorage gracefully', () => {
      localStorage.setItem('protopulse-circuit-selection', 'not-json!!!');
      CircuitSelector.resetInstance();
      const fresh = CircuitSelector.getInstance();
      expect(fresh.getSelected(1)).toBeNull();
    });

    it('handles non-object localStorage value gracefully', () => {
      localStorage.setItem('protopulse-circuit-selection', JSON.stringify([1, 2, 3]));
      CircuitSelector.resetInstance();
      const fresh = CircuitSelector.getInstance();
      expect(fresh.getSelected(1)).toBeNull();
    });

    it('skips entries with invalid project IDs', () => {
      localStorage.setItem(
        'protopulse-circuit-selection',
        JSON.stringify({
          'abc': { circuitId: 1, circuitName: 'X', selectedAt: 1000 },
          '-5': { circuitId: 2, circuitName: 'Y', selectedAt: 1000 },
          '3': { circuitId: 3, circuitName: 'Z', selectedAt: 1000 },
        }),
      );
      CircuitSelector.resetInstance();
      const fresh = CircuitSelector.getInstance();
      expect(fresh.getSelected(3)!.circuitId).toBe(3);
      expect(fresh.getProjectIds()).toEqual([3]);
    });

    it('skips entries with invalid selection shape', () => {
      localStorage.setItem(
        'protopulse-circuit-selection',
        JSON.stringify({
          '1': { circuitId: 'not-a-number', circuitName: 'X', selectedAt: 1000 },
          '2': { circuitId: 2, circuitName: 'Valid', selectedAt: 1000 },
        }),
      );
      CircuitSelector.resetInstance();
      const fresh = CircuitSelector.getInstance();
      expect(fresh.getSelected(1)).toBeNull();
      expect(fresh.getSelected(2)!.circuitId).toBe(2);
    });

    it('removes from localStorage on clear', () => {
      selector.select(1, 42, 'Main');
      selector.clear(1);
      const raw = localStorage.getItem('protopulse-circuit-selection');
      const parsed = JSON.parse(raw!) as Record<string, unknown>;
      expect(parsed['1']).toBeUndefined();
    });

    it('clears localStorage on clearAll', () => {
      selector.select(1, 10, 'A');
      selector.select(2, 20, 'B');
      selector.clearAll();
      const raw = localStorage.getItem('protopulse-circuit-selection');
      const parsed = JSON.parse(raw!) as Record<string, unknown>;
      expect(Object.keys(parsed)).toHaveLength(0);
    });
  });
});
