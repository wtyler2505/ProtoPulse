import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { InteractionHistoryManager, useInteractionHistory } from '../interaction-history';
import type { InteractionEvent } from '../interaction-history';

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
// Test helpers
// ---------------------------------------------------------------------------

let eventCounter = 0;

function makeEvent(overrides?: Partial<InteractionEvent>): InteractionEvent {
  eventCounter += 1;
  return {
    id: `evt-${eventCounter}`,
    type: 'edit',
    view: 'architecture',
    timestamp: Date.now() + eventCounter,
    undoable: true,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// InteractionHistoryManager
// ---------------------------------------------------------------------------

describe('InteractionHistoryManager', () => {
  let manager: InteractionHistoryManager;
  let mockStorage: Storage;

  beforeEach(() => {
    eventCounter = 0;
    mockStorage = createMockLocalStorage();
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockStorage,
      writable: true,
      configurable: true,
    });
    InteractionHistoryManager.resetInstance();
    manager = InteractionHistoryManager.getInstance();
  });

  afterEach(() => {
    InteractionHistoryManager.resetInstance();
  });

  // -----------------------------------------------------------------------
  // Singleton
  // -----------------------------------------------------------------------

  it('returns the same instance on repeated calls', () => {
    const a = InteractionHistoryManager.getInstance();
    const b = InteractionHistoryManager.getInstance();
    expect(a).toBe(b);
  });

  it('creates a fresh instance after resetInstance', () => {
    manager.recordInteraction(makeEvent());
    InteractionHistoryManager.resetInstance();
    const fresh = InteractionHistoryManager.getInstance();
    // fresh instance loads from localStorage, should still have the event
    expect(fresh.getCount()).toBe(1);
  });

  // -----------------------------------------------------------------------
  // recordInteraction
  // -----------------------------------------------------------------------

  it('records a single interaction', () => {
    const event = makeEvent();
    manager.recordInteraction(event);
    expect(manager.getCount()).toBe(1);
  });

  it('records multiple interactions in order', () => {
    const e1 = makeEvent({ type: 'navigate', view: 'schematic' });
    const e2 = makeEvent({ type: 'edit', view: 'architecture' });
    const e3 = makeEvent({ type: 'create', view: 'bom' });
    manager.recordInteraction(e1);
    manager.recordInteraction(e2);
    manager.recordInteraction(e3);
    expect(manager.getCount()).toBe(3);
    const history = manager.getHistory();
    // Newest first
    expect(history[0].id).toBe(e3.id);
    expect(history[2].id).toBe(e1.id);
  });

  it('ignores events with missing id', () => {
    manager.recordInteraction({ id: '', type: 'edit', view: 'arch', timestamp: 1, undoable: false });
    expect(manager.getCount()).toBe(0);
  });

  it('ignores events with missing type', () => {
    manager.recordInteraction({ id: 'x', type: '' as InteractionEvent['type'], view: 'arch', timestamp: 1, undoable: false });
    expect(manager.getCount()).toBe(0);
  });

  it('ignores events with missing view', () => {
    manager.recordInteraction({ id: 'x', type: 'edit', view: '', timestamp: 1, undoable: false });
    expect(manager.getCount()).toBe(0);
  });

  it('ignores events with invalid timestamp', () => {
    manager.recordInteraction({
      id: 'x',
      type: 'edit',
      view: 'arch',
      timestamp: 'bad' as unknown as number,
      undoable: false,
    });
    expect(manager.getCount()).toBe(0);
  });

  // -----------------------------------------------------------------------
  // FIFO eviction at 200
  // -----------------------------------------------------------------------

  it('enforces max 200 entries via FIFO eviction', () => {
    for (let i = 0; i < 210; i++) {
      manager.recordInteraction(makeEvent({ id: `e-${i}` }));
    }
    expect(manager.getCount()).toBe(200);
    // Oldest entries (e-0 through e-9) should be gone
    const history = manager.getHistory();
    const ids = history.map((h) => h.id);
    expect(ids).not.toContain('e-0');
    expect(ids).not.toContain('e-9');
    expect(ids).toContain('e-10');
    expect(ids).toContain('e-209');
  });

  it('evicts exactly one when at 201', () => {
    for (let i = 0; i < 200; i++) {
      manager.recordInteraction(makeEvent({ id: `e-${i}` }));
    }
    expect(manager.getCount()).toBe(200);
    manager.recordInteraction(makeEvent({ id: 'e-200' }));
    expect(manager.getCount()).toBe(200);
    const ids = manager.getHistory().map((h) => h.id);
    expect(ids).not.toContain('e-0');
    expect(ids).toContain('e-1');
    expect(ids).toContain('e-200');
  });

  // -----------------------------------------------------------------------
  // getHistory
  // -----------------------------------------------------------------------

  it('returns empty array when no history', () => {
    expect(manager.getHistory()).toEqual([]);
  });

  it('returns all events newest-first', () => {
    const e1 = makeEvent({ timestamp: 100 });
    const e2 = makeEvent({ timestamp: 200 });
    manager.recordInteraction(e1);
    manager.recordInteraction(e2);
    const history = manager.getHistory();
    expect(history[0].id).toBe(e2.id);
    expect(history[1].id).toBe(e1.id);
  });

  it('respects limit parameter', () => {
    for (let i = 0; i < 10; i++) {
      manager.recordInteraction(makeEvent());
    }
    const limited = manager.getHistory(3);
    expect(limited).toHaveLength(3);
  });

  it('returns all if limit exceeds count', () => {
    manager.recordInteraction(makeEvent());
    manager.recordInteraction(makeEvent());
    const limited = manager.getHistory(100);
    expect(limited).toHaveLength(2);
  });

  it('returns all if limit is 0', () => {
    manager.recordInteraction(makeEvent());
    manager.recordInteraction(makeEvent());
    expect(manager.getHistory(0)).toHaveLength(2);
  });

  it('returns all if limit is negative', () => {
    manager.recordInteraction(makeEvent());
    expect(manager.getHistory(-5)).toHaveLength(1);
  });

  // -----------------------------------------------------------------------
  // getHistoryForView
  // -----------------------------------------------------------------------

  it('filters by view', () => {
    manager.recordInteraction(makeEvent({ view: 'architecture' }));
    manager.recordInteraction(makeEvent({ view: 'schematic' }));
    manager.recordInteraction(makeEvent({ view: 'architecture' }));
    const arch = manager.getHistoryForView('architecture');
    expect(arch).toHaveLength(2);
    arch.forEach((e) => {
      expect(e.view).toBe('architecture');
    });
  });

  it('returns empty array for unknown view', () => {
    manager.recordInteraction(makeEvent({ view: 'architecture' }));
    expect(manager.getHistoryForView('nonexistent')).toEqual([]);
  });

  it('returns results newest-first for view filter', () => {
    const e1 = makeEvent({ view: 'bom', timestamp: 100 });
    const e2 = makeEvent({ view: 'bom', timestamp: 200 });
    manager.recordInteraction(e1);
    manager.recordInteraction(e2);
    const bomHistory = manager.getHistoryForView('bom');
    expect(bomHistory[0].id).toBe(e2.id);
    expect(bomHistory[1].id).toBe(e1.id);
  });

  // -----------------------------------------------------------------------
  // stepBack
  // -----------------------------------------------------------------------

  it('stepBack returns the previous event', () => {
    const e1 = makeEvent();
    const e2 = makeEvent();
    manager.recordInteraction(e1);
    manager.recordInteraction(e2);
    // Cursor is at e2 (index 1)
    const result = manager.stepBack();
    expect(result).toBeDefined();
    expect(result!.id).toBe(e1.id);
  });

  it('stepBack(2) goes back two steps', () => {
    const e1 = makeEvent();
    const e2 = makeEvent();
    const e3 = makeEvent();
    manager.recordInteraction(e1);
    manager.recordInteraction(e2);
    manager.recordInteraction(e3);
    // Cursor at e3 (index 2), step back 2 → index 0 → e1
    const result = manager.stepBack(2);
    expect(result).toBeDefined();
    expect(result!.id).toBe(e1.id);
  });

  it('stepBack returns undefined when at the beginning', () => {
    const e1 = makeEvent();
    manager.recordInteraction(e1);
    // Cursor at index 0, can't step back
    expect(manager.stepBack()).toBeUndefined();
  });

  it('stepBack returns undefined on empty history', () => {
    expect(manager.stepBack()).toBeUndefined();
  });

  it('stepBack returns undefined when steps exceed history', () => {
    manager.recordInteraction(makeEvent());
    manager.recordInteraction(makeEvent());
    expect(manager.stepBack(5)).toBeUndefined();
  });

  it('stepBack returns undefined for steps < 1', () => {
    manager.recordInteraction(makeEvent());
    expect(manager.stepBack(0)).toBeUndefined();
    expect(manager.stepBack(-1)).toBeUndefined();
  });

  it('consecutive stepBack calls traverse history', () => {
    const events = Array.from({ length: 5 }, () => makeEvent());
    events.forEach((e) => {
      manager.recordInteraction(e);
    });
    // Cursor at 4
    expect(manager.stepBack()?.id).toBe(events[3].id); // cursor 3
    expect(manager.stepBack()?.id).toBe(events[2].id); // cursor 2
    expect(manager.stepBack()?.id).toBe(events[1].id); // cursor 1
    expect(manager.stepBack()?.id).toBe(events[0].id); // cursor 0
    expect(manager.stepBack()).toBeUndefined(); // can't go back further
  });

  it('recording after stepBack resets cursor to end', () => {
    const e1 = makeEvent();
    const e2 = makeEvent();
    manager.recordInteraction(e1);
    manager.recordInteraction(e2);
    manager.stepBack(); // cursor moves to 0
    const e3 = makeEvent();
    manager.recordInteraction(e3);
    // Cursor should be at end (index 2, pointing to e3)
    expect(manager.getCurrentEvent()?.id).toBe(e3.id);
  });

  // -----------------------------------------------------------------------
  // canStepBack
  // -----------------------------------------------------------------------

  it('canStepBack returns false on empty history', () => {
    expect(manager.canStepBack()).toBe(false);
  });

  it('canStepBack returns false with single event', () => {
    manager.recordInteraction(makeEvent());
    // Cursor is at 0, can't go back
    expect(manager.canStepBack()).toBe(false);
  });

  it('canStepBack returns true with multiple events', () => {
    manager.recordInteraction(makeEvent());
    manager.recordInteraction(makeEvent());
    expect(manager.canStepBack()).toBe(true);
  });

  it('canStepBack returns false after stepping to beginning', () => {
    manager.recordInteraction(makeEvent());
    manager.recordInteraction(makeEvent());
    manager.stepBack(); // cursor at 0
    expect(manager.canStepBack()).toBe(false);
  });

  // -----------------------------------------------------------------------
  // getCurrentEvent
  // -----------------------------------------------------------------------

  it('getCurrentEvent returns undefined on empty history', () => {
    expect(manager.getCurrentEvent()).toBeUndefined();
  });

  it('getCurrentEvent returns the latest after recording', () => {
    const e1 = makeEvent();
    manager.recordInteraction(e1);
    expect(manager.getCurrentEvent()?.id).toBe(e1.id);
  });

  it('getCurrentEvent reflects stepBack position', () => {
    const e1 = makeEvent();
    const e2 = makeEvent();
    manager.recordInteraction(e1);
    manager.recordInteraction(e2);
    manager.stepBack();
    expect(manager.getCurrentEvent()?.id).toBe(e1.id);
  });

  // -----------------------------------------------------------------------
  // clearHistory
  // -----------------------------------------------------------------------

  it('clears all history', () => {
    manager.recordInteraction(makeEvent());
    manager.recordInteraction(makeEvent());
    manager.clearHistory();
    expect(manager.getCount()).toBe(0);
    expect(manager.getHistory()).toEqual([]);
    expect(manager.canStepBack()).toBe(false);
    expect(manager.getCurrentEvent()).toBeUndefined();
  });

  it('clearHistory is safe when already empty', () => {
    expect(() => {
      manager.clearHistory();
    }).not.toThrow();
  });

  it('clearHistory resets cursor to -1', () => {
    manager.recordInteraction(makeEvent());
    manager.clearHistory();
    expect(manager.getCursor()).toBe(-1);
  });

  // -----------------------------------------------------------------------
  // localStorage persistence
  // -----------------------------------------------------------------------

  it('persists to localStorage on record', () => {
    manager.recordInteraction(makeEvent());
    expect(mockStorage.setItem).toHaveBeenCalledWith(
      'protopulse:interaction-history',
      expect.any(String),
    );
  });

  it('persists to localStorage on clear', () => {
    manager.recordInteraction(makeEvent());
    vi.mocked(mockStorage.setItem).mockClear();
    manager.clearHistory();
    expect(mockStorage.setItem).toHaveBeenCalled();
  });

  it('loads from localStorage on init', () => {
    const entries: InteractionEvent[] = [
      { id: 'loaded-1', type: 'navigate', view: 'architecture', timestamp: 1000, undoable: false },
    ];
    vi.mocked(mockStorage.getItem).mockReturnValue(JSON.stringify(entries));

    InteractionHistoryManager.resetInstance();
    const loaded = InteractionHistoryManager.getInstance();
    expect(loaded.getCount()).toBe(1);
    expect(loaded.getHistory()[0].id).toBe('loaded-1');
  });

  it('sets cursor to last entry on load', () => {
    const entries: InteractionEvent[] = [
      { id: 'a', type: 'edit', view: 'bom', timestamp: 1, undoable: true },
      { id: 'b', type: 'edit', view: 'bom', timestamp: 2, undoable: true },
    ];
    vi.mocked(mockStorage.getItem).mockReturnValue(JSON.stringify(entries));
    InteractionHistoryManager.resetInstance();
    const loaded = InteractionHistoryManager.getInstance();
    expect(loaded.getCursor()).toBe(1);
    expect(loaded.getCurrentEvent()?.id).toBe('b');
  });

  it('handles corrupt localStorage gracefully', () => {
    vi.mocked(mockStorage.getItem).mockReturnValue('not valid json{{{');
    InteractionHistoryManager.resetInstance();
    const loaded = InteractionHistoryManager.getInstance();
    expect(loaded.getCount()).toBe(0);
    expect(loaded.getHistory()).toEqual([]);
  });

  it('handles non-array localStorage data gracefully', () => {
    vi.mocked(mockStorage.getItem).mockReturnValue('{"key": "value"}');
    InteractionHistoryManager.resetInstance();
    const loaded = InteractionHistoryManager.getInstance();
    expect(loaded.getCount()).toBe(0);
  });

  it('filters out invalid entries from localStorage', () => {
    const data = [
      { id: 'a', type: 'edit', view: 'bom', timestamp: 1, undoable: true },
      { invalid: true }, // missing required fields
      { id: 'c', type: 'create', view: 'schematic', timestamp: 3, undoable: false },
    ];
    vi.mocked(mockStorage.getItem).mockReturnValue(JSON.stringify(data));
    InteractionHistoryManager.resetInstance();
    const loaded = InteractionHistoryManager.getInstance();
    expect(loaded.getCount()).toBe(2);
  });

  it('enforces max on load if localStorage has more than 200', () => {
    const entries: InteractionEvent[] = Array.from({ length: 210 }, (_, i) => ({
      id: `stored-${i}`,
      type: 'edit' as const,
      view: 'arch',
      timestamp: i,
      undoable: true,
    }));
    vi.mocked(mockStorage.getItem).mockReturnValue(JSON.stringify(entries));
    InteractionHistoryManager.resetInstance();
    const loaded = InteractionHistoryManager.getInstance();
    expect(loaded.getCount()).toBe(200);
    // Oldest should be evicted
    const ids = loaded.getHistory().map((h) => h.id);
    expect(ids).not.toContain('stored-0');
    expect(ids).toContain('stored-209');
  });

  // -----------------------------------------------------------------------
  // Subscribe / unsubscribe
  // -----------------------------------------------------------------------

  it('calls subscriber on record', () => {
    const callback = vi.fn();
    manager.subscribe(callback);
    manager.recordInteraction(makeEvent());
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('calls subscriber on stepBack', () => {
    manager.recordInteraction(makeEvent());
    manager.recordInteraction(makeEvent());
    const callback = vi.fn();
    manager.subscribe(callback);
    manager.stepBack();
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('calls subscriber on clearHistory', () => {
    manager.recordInteraction(makeEvent());
    const callback = vi.fn();
    manager.subscribe(callback);
    manager.clearHistory();
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('does not call subscriber after unsubscribe', () => {
    const callback = vi.fn();
    const unsub = manager.subscribe(callback);
    unsub();
    manager.recordInteraction(makeEvent());
    expect(callback).not.toHaveBeenCalled();
  });

  it('does not notify on clearHistory when already empty', () => {
    const callback = vi.fn();
    manager.subscribe(callback);
    manager.clearHistory();
    expect(callback).not.toHaveBeenCalled();
  });

  it('supports multiple subscribers', () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    manager.subscribe(cb1);
    manager.subscribe(cb2);
    manager.recordInteraction(makeEvent());
    expect(cb1).toHaveBeenCalledTimes(1);
    expect(cb2).toHaveBeenCalledTimes(1);
  });

  // -----------------------------------------------------------------------
  // Optional fields
  // -----------------------------------------------------------------------

  it('preserves entityType and entityId when provided', () => {
    const event = makeEvent({ entityType: 'node', entityId: 'node-123' });
    manager.recordInteraction(event);
    const retrieved = manager.getHistory()[0];
    expect(retrieved.entityType).toBe('node');
    expect(retrieved.entityId).toBe('node-123');
  });

  it('works without optional entityType and entityId', () => {
    const event = makeEvent();
    delete event.entityType;
    delete event.entityId;
    manager.recordInteraction(event);
    const retrieved = manager.getHistory()[0];
    expect(retrieved.entityType).toBeUndefined();
    expect(retrieved.entityId).toBeUndefined();
  });

  // -----------------------------------------------------------------------
  // All interaction types
  // -----------------------------------------------------------------------

  it('accepts all valid interaction types', () => {
    const types = ['navigate', 'edit', 'create', 'delete', 'export', 'import'] as const;
    types.forEach((type) => {
      manager.recordInteraction(makeEvent({ type }));
    });
    expect(manager.getCount()).toBe(6);
  });
});

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

describe('useInteractionHistory', () => {
  let mockStorage: Storage;

  beforeEach(() => {
    eventCounter = 0;
    mockStorage = createMockLocalStorage();
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockStorage,
      writable: true,
      configurable: true,
    });
    InteractionHistoryManager.resetInstance();
  });

  afterEach(() => {
    InteractionHistoryManager.resetInstance();
  });

  it('returns initial empty state', () => {
    const { result } = renderHook(() => useInteractionHistory());
    expect(result.current.history).toEqual([]);
    expect(result.current.count).toBe(0);
  });

  it('records interaction via hook', () => {
    const { result } = renderHook(() => useInteractionHistory());
    act(() => {
      result.current.recordInteraction(makeEvent());
    });
    expect(result.current.history).toHaveLength(1);
    expect(result.current.count).toBe(1);
  });

  it('stepBack via hook returns previous event', () => {
    const { result } = renderHook(() => useInteractionHistory());
    const e1 = makeEvent();
    const e2 = makeEvent();
    act(() => {
      result.current.recordInteraction(e1);
    });
    act(() => {
      result.current.recordInteraction(e2);
    });
    let stepped: InteractionEvent | undefined;
    act(() => {
      stepped = result.current.stepBack();
    });
    expect(stepped?.id).toBe(e1.id);
  });

  it('canStepBack via hook reflects state', () => {
    const { result } = renderHook(() => useInteractionHistory());
    expect(result.current.canStepBack()).toBe(false);
    act(() => {
      result.current.recordInteraction(makeEvent());
      result.current.recordInteraction(makeEvent());
    });
    expect(result.current.canStepBack()).toBe(true);
  });

  it('getHistoryForView via hook filters correctly', () => {
    const { result } = renderHook(() => useInteractionHistory());
    act(() => {
      result.current.recordInteraction(makeEvent({ view: 'bom' }));
      result.current.recordInteraction(makeEvent({ view: 'schematic' }));
      result.current.recordInteraction(makeEvent({ view: 'bom' }));
    });
    const bomHistory = result.current.getHistoryForView('bom');
    expect(bomHistory).toHaveLength(2);
    bomHistory.forEach((e) => {
      expect(e.view).toBe('bom');
    });
  });

  it('clearHistory via hook empties all', () => {
    const { result } = renderHook(() => useInteractionHistory());
    act(() => {
      result.current.recordInteraction(makeEvent());
      result.current.recordInteraction(makeEvent());
    });
    act(() => {
      result.current.clearHistory();
    });
    expect(result.current.history).toEqual([]);
    expect(result.current.count).toBe(0);
  });

  it('cleans up subscription on unmount', () => {
    const { unmount } = renderHook(() => useInteractionHistory());
    unmount();
    // Should not throw when manager notifies after unmount
    expect(() => {
      InteractionHistoryManager.getInstance().recordInteraction(makeEvent());
    }).not.toThrow();
  });
});
