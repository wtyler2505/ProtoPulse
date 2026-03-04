import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { ReviewQueueManager, useReviewQueue } from '../ai-review-queue';
import type { ReviewItem } from '../ai-review-queue';

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
// Helper
// ---------------------------------------------------------------------------

function makeItem(overrides: Partial<Omit<ReviewItem, 'id' | 'status' | 'timestamp'>> = {}) {
  return {
    action: overrides.action ?? 'add_bom_item',
    description: overrides.description ?? 'Add 10K resistor to BOM',
    confidence: overrides.confidence ?? 30,
    metadata: overrides.metadata,
  };
}

describe('ReviewQueueManager', () => {
  let manager: ReviewQueueManager;
  let mockStorage: Storage;

  beforeEach(() => {
    mockStorage = createMockLocalStorage();
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockStorage,
      writable: true,
      configurable: true,
    });
    ReviewQueueManager.resetInstance();
    manager = ReviewQueueManager.getInstance();
  });

  afterEach(() => {
    ReviewQueueManager.resetInstance();
    vi.restoreAllMocks();
  });

  // -----------------------------------------------------------------------
  // Singleton
  // -----------------------------------------------------------------------

  it('returns the same instance on repeated calls', () => {
    const a = ReviewQueueManager.getInstance();
    const b = ReviewQueueManager.getInstance();
    expect(a).toBe(b);
  });

  it('creates a fresh instance after resetInstance', () => {
    manager.addToQueue(makeItem());
    ReviewQueueManager.resetInstance();
    const fresh = ReviewQueueManager.getInstance();
    // fresh instance loads from localStorage, so it should still have the item
    expect(fresh.getAllItems()).toHaveLength(1);
  });

  // -----------------------------------------------------------------------
  // addToQueue
  // -----------------------------------------------------------------------

  it('adds an item with auto-generated fields', () => {
    const id = manager.addToQueue(makeItem());
    expect(id).toBeTruthy();
    const item = manager.getItemById(id);
    expect(item).not.toBeNull();
    expect(item!.status).toBe('pending');
    expect(item!.action).toBe('add_bom_item');
    expect(item!.description).toBe('Add 10K resistor to BOM');
    expect(item!.confidence).toBe(30);
    expect(typeof item!.timestamp).toBe('number');
    expect(typeof item!.id).toBe('string');
  });

  it('stores metadata on items', () => {
    const id = manager.addToQueue(makeItem({ metadata: { source: 'ai-chat', nodeId: '42' } }));
    const item = manager.getItemById(id);
    expect(item!.metadata).toEqual({ source: 'ai-chat', nodeId: '42' });
  });

  it('deduplicates items with same action and description within 1 second', () => {
    const id1 = manager.addToQueue(makeItem());
    const id2 = manager.addToQueue(makeItem());
    expect(id1).toBe(id2);
    expect(manager.getAllItems()).toHaveLength(1);
  });

  it('allows items with different actions even with same description', () => {
    manager.addToQueue(makeItem({ action: 'add_bom_item' }));
    manager.addToQueue(makeItem({ action: 'modify_architecture' }));
    expect(manager.getAllItems()).toHaveLength(2);
  });

  it('allows items with same action but different descriptions', () => {
    manager.addToQueue(makeItem({ description: 'Add resistor' }));
    manager.addToQueue(makeItem({ description: 'Add capacitor' }));
    expect(manager.getAllItems()).toHaveLength(2);
  });

  it('allows same action+description after dedup window passes', () => {
    const now = Date.now();
    const dateSpy = vi.spyOn(Date, 'now');
    dateSpy.mockReturnValue(now);
    manager.addToQueue(makeItem());
    dateSpy.mockReturnValue(now + 1001); // past 1-second window
    manager.addToQueue(makeItem());
    expect(manager.getAllItems()).toHaveLength(2);
  });

  // -----------------------------------------------------------------------
  // approveItem / rejectItem
  // -----------------------------------------------------------------------

  it('approves a pending item', () => {
    const id = manager.addToQueue(makeItem());
    const result = manager.approveItem(id);
    expect(result).toBe(true);
    expect(manager.getItemById(id)!.status).toBe('approved');
  });

  it('returns false when approving non-existent item', () => {
    expect(manager.approveItem('nonexistent')).toBe(false);
  });

  it('rejects a pending item', () => {
    const id = manager.addToQueue(makeItem());
    const result = manager.rejectItem(id);
    expect(result).toBe(true);
    expect(manager.getItemById(id)!.status).toBe('rejected');
  });

  it('rejects with a reason', () => {
    const id = manager.addToQueue(makeItem());
    manager.rejectItem(id, 'Wrong component value');
    const item = manager.getItemById(id);
    expect(item!.status).toBe('rejected');
    expect(item!.rejectionReason).toBe('Wrong component value');
  });

  it('returns false when rejecting non-existent item', () => {
    expect(manager.rejectItem('nonexistent')).toBe(false);
  });

  // -----------------------------------------------------------------------
  // getPendingItems — sorted by confidence ascending
  // -----------------------------------------------------------------------

  it('returns pending items sorted by confidence ascending', () => {
    manager.addToQueue(makeItem({ description: 'high', confidence: 45 }));
    manager.addToQueue(makeItem({ description: 'low', confidence: 10 }));
    manager.addToQueue(makeItem({ description: 'mid', confidence: 25 }));

    const pending = manager.getPendingItems();
    expect(pending).toHaveLength(3);
    expect(pending[0].confidence).toBe(10);
    expect(pending[1].confidence).toBe(25);
    expect(pending[2].confidence).toBe(45);
  });

  it('excludes non-pending items from getPendingItems', () => {
    const id1 = manager.addToQueue(makeItem({ description: 'one', confidence: 10 }));
    manager.addToQueue(makeItem({ description: 'two', confidence: 20 }));
    manager.approveItem(id1);

    const pending = manager.getPendingItems();
    expect(pending).toHaveLength(1);
    expect(pending[0].description).toBe('two');
  });

  // -----------------------------------------------------------------------
  // getApprovedItems / getRejectedItems
  // -----------------------------------------------------------------------

  it('returns approved items', () => {
    const id = manager.addToQueue(makeItem());
    manager.approveItem(id);
    expect(manager.getApprovedItems()).toHaveLength(1);
    expect(manager.getApprovedItems()[0].id).toBe(id);
  });

  it('returns rejected items', () => {
    const id = manager.addToQueue(makeItem());
    manager.rejectItem(id);
    expect(manager.getRejectedItems()).toHaveLength(1);
    expect(manager.getRejectedItems()[0].id).toBe(id);
  });

  // -----------------------------------------------------------------------
  // getItemById
  // -----------------------------------------------------------------------

  it('returns null for non-existent item', () => {
    expect(manager.getItemById('nonexistent')).toBeNull();
  });

  // -----------------------------------------------------------------------
  // shouldQueue / threshold
  // -----------------------------------------------------------------------

  it('shouldQueue returns true when confidence is below threshold', () => {
    expect(manager.shouldQueue(30)).toBe(true); // default threshold 50
  });

  it('shouldQueue returns false when confidence equals threshold', () => {
    expect(manager.shouldQueue(50)).toBe(false);
  });

  it('shouldQueue returns false when confidence is above threshold', () => {
    expect(manager.shouldQueue(80)).toBe(false);
  });

  it('setThreshold updates the threshold', () => {
    manager.setThreshold(75);
    expect(manager.getThreshold()).toBe(75);
    expect(manager.shouldQueue(70)).toBe(true);
    expect(manager.shouldQueue(80)).toBe(false);
  });

  it('setThreshold clamps to 0', () => {
    manager.setThreshold(-10);
    expect(manager.getThreshold()).toBe(0);
  });

  it('setThreshold clamps to 100', () => {
    manager.setThreshold(150);
    expect(manager.getThreshold()).toBe(100);
  });

  // -----------------------------------------------------------------------
  // Stats
  // -----------------------------------------------------------------------

  it('computes stats correctly', () => {
    const id1 = manager.addToQueue(makeItem({ description: 'a', confidence: 20 }));
    manager.addToQueue(makeItem({ description: 'b', confidence: 40 }));
    const id3 = manager.addToQueue(makeItem({ description: 'c', confidence: 60 }));
    manager.approveItem(id1);
    manager.rejectItem(id3);

    const stats = manager.getStats();
    expect(stats.total).toBe(3);
    expect(stats.pending).toBe(1);
    expect(stats.approved).toBe(1);
    expect(stats.rejected).toBe(1);
    expect(stats.expired).toBe(0);
    expect(stats.averageConfidence).toBe(40); // (20 + 40 + 60) / 3
    expect(stats.oldestPendingAge).toBeGreaterThanOrEqual(0);
  });

  it('stats has null oldestPendingAge when no pending items', () => {
    const id = manager.addToQueue(makeItem());
    manager.approveItem(id);

    const stats = manager.getStats();
    expect(stats.oldestPendingAge).toBeNull();
  });

  it('stats averageConfidence is 0 with no items', () => {
    const stats = manager.getStats();
    expect(stats.averageConfidence).toBe(0);
    expect(stats.total).toBe(0);
  });

  // -----------------------------------------------------------------------
  // expireOldItems
  // -----------------------------------------------------------------------

  it('expires pending items older than maxAge', () => {
    const now = Date.now();
    const dateSpy = vi.spyOn(Date, 'now');

    // Add item 2 hours ago
    dateSpy.mockReturnValue(now - 2 * 60 * 60 * 1000);
    manager.addToQueue(makeItem({ description: 'old' }));

    // Add item now
    dateSpy.mockReturnValue(now);
    manager.addToQueue(makeItem({ description: 'new' }));

    // Expire items older than 1 hour
    const count = manager.expireOldItems(60 * 60 * 1000);
    expect(count).toBe(1);

    const expired = manager.getAllItems().filter((i) => i.status === 'expired');
    expect(expired).toHaveLength(1);
    expect(expired[0].description).toBe('old');

    // The new item should still be pending
    const pending = manager.getPendingItems();
    expect(pending).toHaveLength(1);
    expect(pending[0].description).toBe('new');
  });

  it('expireOldItems returns 0 when nothing to expire', () => {
    manager.addToQueue(makeItem());
    expect(manager.expireOldItems()).toBe(0);
  });

  it('does not expire already resolved items', () => {
    const now = Date.now();
    const dateSpy = vi.spyOn(Date, 'now');

    dateSpy.mockReturnValue(now - 2 * 60 * 60 * 1000);
    const id = manager.addToQueue(makeItem());
    manager.approveItem(id);

    dateSpy.mockReturnValue(now);
    const count = manager.expireOldItems(60 * 60 * 1000);
    expect(count).toBe(0);
    expect(manager.getItemById(id)!.status).toBe('approved');
  });

  // -----------------------------------------------------------------------
  // clearResolved
  // -----------------------------------------------------------------------

  it('removes only resolved items', () => {
    const id1 = manager.addToQueue(makeItem({ description: 'a' }));
    manager.addToQueue(makeItem({ description: 'b' }));
    const id3 = manager.addToQueue(makeItem({ description: 'c' }));
    manager.approveItem(id1);
    manager.rejectItem(id3);

    manager.clearResolved();
    expect(manager.getAllItems()).toHaveLength(1);
    expect(manager.getPendingItems()).toHaveLength(1);
    expect(manager.getPendingItems()[0].description).toBe('b');
  });

  it('clearResolved is safe when no resolved items', () => {
    manager.addToQueue(makeItem());
    const callback = vi.fn();
    manager.subscribe(callback);
    manager.clearResolved();
    // No resolved items to remove, so no notification
    expect(callback).not.toHaveBeenCalled();
  });

  it('clearResolved removes expired items', () => {
    const now = Date.now();
    const dateSpy = vi.spyOn(Date, 'now');
    dateSpy.mockReturnValue(now - 2 * 60 * 60 * 1000);
    manager.addToQueue(makeItem());
    dateSpy.mockReturnValue(now);
    manager.expireOldItems(60 * 60 * 1000);

    manager.clearResolved();
    expect(manager.getAllItems()).toHaveLength(0);
  });

  // -----------------------------------------------------------------------
  // Max 200 limit with eviction
  // -----------------------------------------------------------------------

  it('enforces max 200 items by evicting oldest resolved first', () => {
    const dateSpy = vi.spyOn(Date, 'now');
    const baseTime = 1000000;

    // Add 200 items, approve the first one (so it becomes resolved)
    for (let i = 0; i < 200; i++) {
      dateSpy.mockReturnValue(baseTime + i * 100);
      manager.addToQueue(makeItem({ description: `item-${i}`, confidence: i }));
    }
    expect(manager.getAllItems()).toHaveLength(200);

    // Approve the first item (oldest, will be evicted first)
    const allItems = manager.getAllItems();
    const firstId = allItems.find((i) => i.description === 'item-0')!.id;
    manager.approveItem(firstId);

    // Add the 201st item — should evict the resolved item-0
    dateSpy.mockReturnValue(baseTime + 200 * 100);
    manager.addToQueue(makeItem({ description: 'item-200', confidence: 99 }));
    expect(manager.getAllItems()).toHaveLength(200);

    // item-0 should be gone (it was resolved)
    expect(manager.getItemById(firstId)).toBeNull();
    // item-200 should be present
    const newest = manager.getAllItems().find((i) => i.description === 'item-200');
    expect(newest).toBeTruthy();
  });

  it('evicts oldest pending when all items are pending', () => {
    const dateSpy = vi.spyOn(Date, 'now');
    const baseTime = 1000000;

    for (let i = 0; i < 200; i++) {
      dateSpy.mockReturnValue(baseTime + i * 100);
      manager.addToQueue(makeItem({ description: `pending-${i}`, confidence: i }));
    }

    // Add 201st — all are pending, so oldest pending gets evicted
    dateSpy.mockReturnValue(baseTime + 200 * 100);
    manager.addToQueue(makeItem({ description: 'pending-200', confidence: 99 }));
    expect(manager.getAllItems()).toHaveLength(200);

    // pending-0 (oldest) should be gone
    const remaining = manager.getAllItems();
    expect(remaining.find((i) => i.description === 'pending-0')).toBeUndefined();
    expect(remaining.find((i) => i.description === 'pending-200')).toBeTruthy();
  });

  // -----------------------------------------------------------------------
  // localStorage persistence
  // -----------------------------------------------------------------------

  it('persists to localStorage on add', () => {
    manager.addToQueue(makeItem());
    expect(mockStorage.setItem).toHaveBeenCalledWith(
      'protopulse-ai-review-queue',
      expect.any(String),
    );
  });

  it('persists to localStorage on approve', () => {
    const id = manager.addToQueue(makeItem());
    vi.mocked(mockStorage.setItem).mockClear();
    manager.approveItem(id);
    expect(mockStorage.setItem).toHaveBeenCalled();
  });

  it('loads items from localStorage on init', () => {
    const items: ReviewItem[] = [
      {
        id: 'test-1',
        action: 'add_bom_item',
        description: 'Add resistor',
        confidence: 30,
        timestamp: Date.now(),
        status: 'pending',
      },
    ];
    vi.mocked(mockStorage.getItem).mockReturnValue(JSON.stringify({ items, threshold: 60 }));

    ReviewQueueManager.resetInstance();
    const loaded = ReviewQueueManager.getInstance();
    expect(loaded.getAllItems()).toHaveLength(1);
    expect(loaded.getThreshold()).toBe(60);
  });

  it('handles corrupt localStorage gracefully', () => {
    vi.mocked(mockStorage.getItem).mockReturnValue('not valid json{{{');
    ReviewQueueManager.resetInstance();
    const loaded = ReviewQueueManager.getInstance();
    expect(loaded.getAllItems()).toHaveLength(0);
  });

  it('handles non-object localStorage data gracefully', () => {
    vi.mocked(mockStorage.getItem).mockReturnValue('"just a string"');
    ReviewQueueManager.resetInstance();
    const loaded = ReviewQueueManager.getInstance();
    expect(loaded.getAllItems()).toHaveLength(0);
  });

  it('filters out invalid entries from localStorage', () => {
    const data = {
      items: [
        {
          id: 'valid-1',
          action: 'add_bom_item',
          description: 'Add resistor',
          confidence: 30,
          timestamp: 123456,
          status: 'pending',
        },
        { invalid: true }, // missing required fields
        {
          id: 'valid-2',
          action: 'modify_architecture',
          description: 'Modify node',
          confidence: 40,
          timestamp: 123457,
          status: 'approved',
        },
      ],
      threshold: 50,
    };
    vi.mocked(mockStorage.getItem).mockReturnValue(JSON.stringify(data));
    ReviewQueueManager.resetInstance();
    const loaded = ReviewQueueManager.getInstance();
    expect(loaded.getAllItems()).toHaveLength(2);
  });

  it('filters out items with invalid status from localStorage', () => {
    const data = {
      items: [
        {
          id: 'bad-status',
          action: 'test',
          description: 'test',
          confidence: 30,
          timestamp: 123456,
          status: 'invalid_status',
        },
      ],
    };
    vi.mocked(mockStorage.getItem).mockReturnValue(JSON.stringify(data));
    ReviewQueueManager.resetInstance();
    const loaded = ReviewQueueManager.getInstance();
    expect(loaded.getAllItems()).toHaveLength(0);
  });

  // -----------------------------------------------------------------------
  // Subscribe / unsubscribe
  // -----------------------------------------------------------------------

  it('calls subscriber on addToQueue', () => {
    const callback = vi.fn();
    manager.subscribe(callback);
    manager.addToQueue(makeItem());
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('calls subscriber on approveItem', () => {
    const id = manager.addToQueue(makeItem());
    const callback = vi.fn();
    manager.subscribe(callback);
    manager.approveItem(id);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('calls subscriber on rejectItem', () => {
    const id = manager.addToQueue(makeItem());
    const callback = vi.fn();
    manager.subscribe(callback);
    manager.rejectItem(id);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('calls subscriber on clearResolved', () => {
    const id = manager.addToQueue(makeItem());
    manager.approveItem(id);
    const callback = vi.fn();
    manager.subscribe(callback);
    manager.clearResolved();
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('calls subscriber on expireOldItems', () => {
    const now = Date.now();
    const dateSpy = vi.spyOn(Date, 'now');
    dateSpy.mockReturnValue(now - 2 * 60 * 60 * 1000);
    manager.addToQueue(makeItem());
    dateSpy.mockReturnValue(now);

    const callback = vi.fn();
    manager.subscribe(callback);
    manager.expireOldItems(60 * 60 * 1000);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('does not call subscriber after unsubscribe', () => {
    const callback = vi.fn();
    const unsub = manager.subscribe(callback);
    unsub();
    manager.addToQueue(makeItem());
    expect(callback).not.toHaveBeenCalled();
  });

  it('does not notify on duplicate add', () => {
    manager.addToQueue(makeItem());
    const callback = vi.fn();
    manager.subscribe(callback);
    manager.addToQueue(makeItem()); // duplicate
    expect(callback).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

describe('useReviewQueue', () => {
  let mockStorage: Storage;

  beforeEach(() => {
    mockStorage = createMockLocalStorage();
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockStorage,
      writable: true,
      configurable: true,
    });
    ReviewQueueManager.resetInstance();
  });

  afterEach(() => {
    ReviewQueueManager.resetInstance();
    vi.restoreAllMocks();
  });

  it('returns initial empty state', () => {
    const { result } = renderHook(() => useReviewQueue());
    expect(result.current.pendingItems).toEqual([]);
    expect(result.current.approvedItems).toEqual([]);
    expect(result.current.rejectedItems).toEqual([]);
    expect(result.current.stats.total).toBe(0);
    expect(result.current.threshold).toBe(50);
  });

  it('adds an item via hook and re-renders', () => {
    const { result } = renderHook(() => useReviewQueue());
    act(() => {
      result.current.addToQueue({
        action: 'add_bom_item',
        description: 'Add resistor',
        confidence: 30,
      });
    });
    expect(result.current.pendingItems).toHaveLength(1);
    expect(result.current.stats.total).toBe(1);
    expect(result.current.stats.pending).toBe(1);
  });

  it('approves an item via hook', () => {
    const { result } = renderHook(() => useReviewQueue());
    let id = '';
    act(() => {
      id = result.current.addToQueue({
        action: 'add_bom_item',
        description: 'Add resistor',
        confidence: 30,
      });
    });
    act(() => {
      result.current.approveItem(id);
    });
    expect(result.current.pendingItems).toHaveLength(0);
    expect(result.current.approvedItems).toHaveLength(1);
  });

  it('rejects an item via hook', () => {
    const { result } = renderHook(() => useReviewQueue());
    let id = '';
    act(() => {
      id = result.current.addToQueue({
        action: 'add_bom_item',
        description: 'Add resistor',
        confidence: 30,
      });
    });
    act(() => {
      result.current.rejectItem(id, 'Wrong value');
    });
    expect(result.current.pendingItems).toHaveLength(0);
    expect(result.current.rejectedItems).toHaveLength(1);
  });

  it('clears resolved via hook', () => {
    const { result } = renderHook(() => useReviewQueue());
    let id = '';
    act(() => {
      id = result.current.addToQueue({
        action: 'add_bom_item',
        description: 'Add resistor',
        confidence: 30,
      });
    });
    act(() => {
      result.current.approveItem(id);
    });
    act(() => {
      result.current.clearResolved();
    });
    expect(result.current.stats.total).toBe(0);
  });

  it('shouldQueue reflects threshold', () => {
    const { result } = renderHook(() => useReviewQueue());
    expect(result.current.shouldQueue(30)).toBe(true);
    expect(result.current.shouldQueue(80)).toBe(false);
  });

  it('cleans up subscription on unmount', () => {
    const { unmount } = renderHook(() => useReviewQueue());
    unmount();
    // Should not throw when manager notifies after unmount
    expect(() => {
      ReviewQueueManager.getInstance().addToQueue({
        action: 'add_bom_item',
        description: 'test',
        confidence: 30,
      });
    }).not.toThrow();
  });
});
