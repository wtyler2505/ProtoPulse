import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  parseMentions,
  extractMentionedUsers,
  isMentioned,
  MentionNotificationManager,
  useMentions,
} from '../mentions';
import type { MentionNotification } from '../mentions';

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
// Helper — create a notification payload
// ---------------------------------------------------------------------------

function makeNotification(overrides: Partial<Omit<MentionNotification, 'id' | 'read' | 'createdAt'>> = {}) {
  return {
    mentionedUser: overrides.mentionedUser ?? 'tyler',
    fromUser: overrides.fromUser ?? 'alice',
    commentExcerpt: overrides.commentExcerpt ?? 'Hey @tyler, check this out',
    commentId: overrides.commentId ?? Math.floor(Math.random() * 100000),
    projectId: overrides.projectId ?? 1,
  };
}

// ===========================================================================
// parseMentions
// ===========================================================================

describe('parseMentions', () => {
  it('parses a single mention', () => {
    const result = parseMentions('Hello @alice');
    expect(result).toHaveLength(1);
    expect(result[0].username).toBe('alice');
    expect(result[0].raw).toBe('@alice');
  });

  it('parses multiple mentions', () => {
    const result = parseMentions('@alice and @bob please review');
    expect(result).toHaveLength(2);
    expect(result[0].username).toBe('alice');
    expect(result[1].username).toBe('bob');
  });

  it('parses mention at start of string', () => {
    const result = parseMentions('@admin hello');
    expect(result).toHaveLength(1);
    expect(result[0].username).toBe('admin');
    expect(result[0].startIndex).toBe(0);
    expect(result[0].endIndex).toBe(6);
  });

  it('parses mention at end of string', () => {
    const result = parseMentions('hello @admin');
    expect(result).toHaveLength(1);
    expect(result[0].username).toBe('admin');
  });

  it('handles usernames with underscores and hyphens', () => {
    const result = parseMentions('@user_name-123 hello');
    expect(result).toHaveLength(1);
    expect(result[0].username).toBe('user_name-123');
  });

  it('returns empty array for empty string', () => {
    expect(parseMentions('')).toEqual([]);
  });

  it('returns empty array for text without mentions', () => {
    expect(parseMentions('hello world')).toEqual([]);
  });

  it('does not match email addresses', () => {
    const result = parseMentions('email user@example.com');
    expect(result).toHaveLength(0);
  });

  it('handles consecutive mentions', () => {
    const result = parseMentions('@alice @bob @charlie');
    expect(result).toHaveLength(3);
    expect(result.map((m) => m.username)).toEqual(['alice', 'bob', 'charlie']);
  });

  it('handles mention after punctuation', () => {
    const result = parseMentions('Hey! @tyler check this');
    expect(result).toHaveLength(1);
    expect(result[0].username).toBe('tyler');
  });

  it('handles mention after newline', () => {
    const result = parseMentions('line1\n@bob line2');
    expect(result).toHaveLength(1);
    expect(result[0].username).toBe('bob');
  });

  it('handles duplicate mentions', () => {
    const result = parseMentions('@alice said @alice should review');
    expect(result).toHaveLength(2);
    expect(result[0].username).toBe('alice');
    expect(result[1].username).toBe('alice');
  });

  it('limits username to 32 characters', () => {
    const longUser = 'a'.repeat(33);
    const result = parseMentions(`@${longUser}`);
    // Should match only first 32 chars
    expect(result).toHaveLength(1);
    expect(result[0].username).toBe('a'.repeat(32));
  });
});

// ===========================================================================
// extractMentionedUsers
// ===========================================================================

describe('extractMentionedUsers', () => {
  it('extracts unique users', () => {
    const result = extractMentionedUsers('@alice and @bob and @alice');
    expect(result).toHaveLength(2);
    expect(result).toContain('alice');
    expect(result).toContain('bob');
  });

  it('normalizes to lowercase', () => {
    const result = extractMentionedUsers('@Alice and @ALICE');
    expect(result).toHaveLength(1);
    expect(result[0]).toBe('alice');
  });

  it('returns empty array for no mentions', () => {
    expect(extractMentionedUsers('no mentions here')).toEqual([]);
  });
});

// ===========================================================================
// isMentioned
// ===========================================================================

describe('isMentioned', () => {
  it('returns true when username is mentioned', () => {
    expect(isMentioned('Hello @tyler', 'tyler')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(isMentioned('Hello @Tyler', 'tyler')).toBe(true);
    expect(isMentioned('Hello @tyler', 'Tyler')).toBe(true);
  });

  it('returns false when username is not mentioned', () => {
    expect(isMentioned('Hello @alice', 'tyler')).toBe(false);
  });

  it('returns false for empty text', () => {
    expect(isMentioned('', 'tyler')).toBe(false);
  });
});

// ===========================================================================
// MentionNotificationManager
// ===========================================================================

describe('MentionNotificationManager', () => {
  let manager: MentionNotificationManager;
  let mockStorage: Storage;

  beforeEach(() => {
    mockStorage = createMockLocalStorage();
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockStorage,
      writable: true,
      configurable: true,
    });
    MentionNotificationManager.resetInstance();
    manager = MentionNotificationManager.getInstance();
  });

  afterEach(() => {
    MentionNotificationManager.resetInstance();
  });

  // -----------------------------------------------------------------------
  // Singleton
  // -----------------------------------------------------------------------

  describe('singleton', () => {
    it('returns the same instance', () => {
      const a = MentionNotificationManager.getInstance();
      const b = MentionNotificationManager.getInstance();
      expect(a).toBe(b);
    });

    it('resetInstance creates a fresh instance', () => {
      const a = MentionNotificationManager.getInstance();
      a.addNotification(makeNotification());
      expect(a.getCount()).toBe(1);
      // Clear localStorage so the new instance starts empty
      mockStorage.clear();
      MentionNotificationManager.resetInstance();
      const b = MentionNotificationManager.getInstance();
      expect(b).not.toBe(a);
      expect(b.getCount()).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // addNotification
  // -----------------------------------------------------------------------

  describe('addNotification', () => {
    it('adds a notification', () => {
      manager.addNotification(makeNotification());
      expect(manager.getCount()).toBe(1);
    });

    it('sets read to false by default', () => {
      const n = manager.addNotification(makeNotification());
      expect(n.read).toBe(false);
    });

    it('generates a unique ID', () => {
      const a = manager.addNotification(makeNotification({ commentId: 1 }));
      const b = manager.addNotification(makeNotification({ commentId: 2 }));
      expect(a.id).not.toBe(b.id);
    });

    it('deduplicates by commentId + mentionedUser', () => {
      manager.addNotification(makeNotification({ commentId: 42, mentionedUser: 'tyler' }));
      manager.addNotification(makeNotification({ commentId: 42, mentionedUser: 'tyler' }));
      expect(manager.getCount()).toBe(1);
    });

    it('allows same commentId with different mentionedUser', () => {
      manager.addNotification(makeNotification({ commentId: 42, mentionedUser: 'tyler' }));
      manager.addNotification(makeNotification({ commentId: 42, mentionedUser: 'bob' }));
      expect(manager.getCount()).toBe(2);
    });

    it('enforces MAX_NOTIFICATIONS (100) limit', () => {
      for (let i = 0; i < 105; i++) {
        manager.addNotification(makeNotification({ commentId: i }));
      }
      expect(manager.getCount()).toBe(100);
    });

    it('evicts oldest read notifications first when at limit', () => {
      // Add 100 notifications
      for (let i = 0; i < 100; i++) {
        manager.addNotification(makeNotification({ commentId: i }));
      }
      // Mark some as read
      const all = manager.getNotifications();
      manager.markRead(all[all.length - 1].id); // Mark oldest as read

      // Add one more — should evict the read one, not unread
      manager.addNotification(makeNotification({ commentId: 200 }));
      expect(manager.getCount()).toBe(100);
      expect(manager.getUnreadCount()).toBe(100); // all remaining are unread
    });

    it('persists to localStorage', () => {
      manager.addNotification(makeNotification());
      expect(mockStorage.setItem).toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // Queries
  // -----------------------------------------------------------------------

  describe('queries', () => {
    it('getNotifications returns sorted by newest first', () => {
      manager.addNotification(makeNotification({ commentId: 1, commentExcerpt: 'first' }));
      manager.addNotification(makeNotification({ commentId: 2, commentExcerpt: 'second' }));
      const list = manager.getNotifications();
      expect(list[0].commentExcerpt).toBe('second');
      expect(list[1].commentExcerpt).toBe('first');
    });

    it('getUnread filters to unread only', () => {
      const n1 = manager.addNotification(makeNotification({ commentId: 1 }));
      manager.addNotification(makeNotification({ commentId: 2 }));
      manager.markRead(n1.id);
      expect(manager.getUnread()).toHaveLength(1);
    });

    it('getUnreadCount counts unread notifications', () => {
      manager.addNotification(makeNotification({ commentId: 1 }));
      manager.addNotification(makeNotification({ commentId: 2 }));
      expect(manager.getUnreadCount()).toBe(2);
      const all = manager.getNotifications();
      manager.markRead(all[0].id);
      expect(manager.getUnreadCount()).toBe(1);
    });

    it('getById returns notification by ID', () => {
      const n = manager.addNotification(makeNotification());
      expect(manager.getById(n.id)).toEqual(n);
    });

    it('getById returns undefined for unknown ID', () => {
      expect(manager.getById('nonexistent')).toBeUndefined();
    });

    it('getForUser filters by mentionedUser', () => {
      manager.addNotification(makeNotification({ commentId: 1, mentionedUser: 'tyler' }));
      manager.addNotification(makeNotification({ commentId: 2, mentionedUser: 'bob' }));
      manager.addNotification(makeNotification({ commentId: 3, mentionedUser: 'tyler' }));
      expect(manager.getForUser('tyler')).toHaveLength(2);
      expect(manager.getForUser('Tyler')).toHaveLength(2); // case insensitive
    });
  });

  // -----------------------------------------------------------------------
  // markRead / markAllRead
  // -----------------------------------------------------------------------

  describe('markRead', () => {
    it('marks a notification as read', () => {
      const n = manager.addNotification(makeNotification());
      manager.markRead(n.id);
      expect(manager.getById(n.id)?.read).toBe(true);
    });

    it('is idempotent', () => {
      const n = manager.addNotification(makeNotification());
      manager.markRead(n.id);
      manager.markRead(n.id);
      expect(manager.getById(n.id)?.read).toBe(true);
    });

    it('does nothing for unknown ID', () => {
      manager.markRead('nonexistent');
      expect(manager.getCount()).toBe(0);
    });

    it('persists after markRead', () => {
      const n = manager.addNotification(makeNotification());
      const callCount = (mockStorage.setItem as ReturnType<typeof vi.fn>).mock.calls.length;
      manager.markRead(n.id);
      expect((mockStorage.setItem as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(callCount);
    });
  });

  describe('markAllRead', () => {
    it('marks all as read', () => {
      manager.addNotification(makeNotification({ commentId: 1 }));
      manager.addNotification(makeNotification({ commentId: 2 }));
      manager.addNotification(makeNotification({ commentId: 3 }));
      manager.markAllRead();
      expect(manager.getUnreadCount()).toBe(0);
    });

    it('does nothing when all are already read', () => {
      const n = manager.addNotification(makeNotification());
      manager.markRead(n.id);
      const callCount = (mockStorage.setItem as ReturnType<typeof vi.fn>).mock.calls.length;
      manager.markAllRead();
      // Should not persist again since nothing changed
      expect((mockStorage.setItem as ReturnType<typeof vi.fn>).mock.calls.length).toBe(callCount);
    });
  });

  // -----------------------------------------------------------------------
  // remove / clearAll
  // -----------------------------------------------------------------------

  describe('remove', () => {
    it('removes a notification by ID', () => {
      const n = manager.addNotification(makeNotification());
      manager.remove(n.id);
      expect(manager.getCount()).toBe(0);
    });

    it('does nothing for unknown ID', () => {
      manager.addNotification(makeNotification());
      manager.remove('nonexistent');
      expect(manager.getCount()).toBe(1);
    });
  });

  describe('clearAll', () => {
    it('removes all notifications', () => {
      manager.addNotification(makeNotification({ commentId: 1 }));
      manager.addNotification(makeNotification({ commentId: 2 }));
      manager.clearAll();
      expect(manager.getCount()).toBe(0);
    });

    it('is idempotent when empty', () => {
      const callCount = (mockStorage.setItem as ReturnType<typeof vi.fn>).mock.calls.length;
      manager.clearAll();
      expect((mockStorage.setItem as ReturnType<typeof vi.fn>).mock.calls.length).toBe(callCount);
    });
  });

  // -----------------------------------------------------------------------
  // Subscription
  // -----------------------------------------------------------------------

  describe('subscribe', () => {
    it('notifies on addNotification', () => {
      const listener = vi.fn();
      manager.subscribe(listener);
      manager.addNotification(makeNotification());
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('notifies on markRead', () => {
      const n = manager.addNotification(makeNotification());
      const listener = vi.fn();
      manager.subscribe(listener);
      manager.markRead(n.id);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('notifies on remove', () => {
      const n = manager.addNotification(makeNotification());
      const listener = vi.fn();
      manager.subscribe(listener);
      manager.remove(n.id);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('notifies on clearAll', () => {
      manager.addNotification(makeNotification());
      const listener = vi.fn();
      manager.subscribe(listener);
      manager.clearAll();
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('notifies on markAllRead', () => {
      manager.addNotification(makeNotification());
      const listener = vi.fn();
      manager.subscribe(listener);
      manager.markAllRead();
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('unsubscribe stops notifications', () => {
      const listener = vi.fn();
      const unsubscribe = manager.subscribe(listener);
      unsubscribe();
      manager.addNotification(makeNotification());
      expect(listener).not.toHaveBeenCalled();
    });

    it('multiple listeners all receive notifications', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      manager.subscribe(listener1);
      manager.subscribe(listener2);
      manager.addNotification(makeNotification());
      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
    });
  });

  // -----------------------------------------------------------------------
  // Persistence
  // -----------------------------------------------------------------------

  describe('persistence', () => {
    it('restores notifications from localStorage', () => {
      const notification: MentionNotification = {
        id: 'test-id',
        mentionedUser: 'tyler',
        fromUser: 'alice',
        commentExcerpt: 'Hello @tyler',
        commentId: 1,
        projectId: 1,
        read: false,
        createdAt: Date.now(),
      };
      (mockStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(
        JSON.stringify([notification]),
      );
      MentionNotificationManager.resetInstance();
      const fresh = MentionNotificationManager.getInstance();
      expect(fresh.getCount()).toBe(1);
      expect(fresh.getById('test-id')?.mentionedUser).toBe('tyler');
    });

    it('handles corrupt localStorage data gracefully', () => {
      (mockStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('not json');
      MentionNotificationManager.resetInstance();
      const fresh = MentionNotificationManager.getInstance();
      expect(fresh.getCount()).toBe(0);
    });

    it('handles non-array localStorage data', () => {
      (mockStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('{"not":"array"}');
      MentionNotificationManager.resetInstance();
      const fresh = MentionNotificationManager.getInstance();
      expect(fresh.getCount()).toBe(0);
    });

    it('filters invalid entries from localStorage', () => {
      const data = [
        { id: 'valid', mentionedUser: 'u', fromUser: 'f', commentExcerpt: 'e', commentId: 1, projectId: 1, read: false, createdAt: 100 },
        { id: 'missing-fields' }, // invalid
        null, // invalid
      ];
      (mockStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(data));
      MentionNotificationManager.resetInstance();
      const fresh = MentionNotificationManager.getInstance();
      expect(fresh.getCount()).toBe(1);
    });

    it('handles null localStorage gracefully', () => {
      (mockStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(null);
      MentionNotificationManager.resetInstance();
      const fresh = MentionNotificationManager.getInstance();
      expect(fresh.getCount()).toBe(0);
    });
  });
});

// ===========================================================================
// useMentions hook
// ===========================================================================

describe('useMentions', () => {
  let mockStorage: Storage;

  beforeEach(() => {
    mockStorage = createMockLocalStorage();
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockStorage,
      writable: true,
      configurable: true,
    });
    MentionNotificationManager.resetInstance();
  });

  afterEach(() => {
    MentionNotificationManager.resetInstance();
  });

  it('returns initial empty state', () => {
    const { result } = renderHook(() => useMentions());
    expect(result.current.notifications).toEqual([]);
    expect(result.current.unreadCount).toBe(0);
    expect(result.current.count).toBe(0);
  });

  it('reflects notifications from manager', () => {
    const manager = MentionNotificationManager.getInstance();
    manager.addNotification(makeNotification({ commentId: 1 }));
    manager.addNotification(makeNotification({ commentId: 2 }));

    const { result } = renderHook(() => useMentions());
    expect(result.current.count).toBe(2);
    expect(result.current.unreadCount).toBe(2);
  });

  it('markRead updates state', () => {
    const manager = MentionNotificationManager.getInstance();
    const n = manager.addNotification(makeNotification());

    const { result } = renderHook(() => useMentions());
    act(() => {
      result.current.markRead(n.id);
    });
    expect(result.current.unreadCount).toBe(0);
  });

  it('markAllRead updates state', () => {
    const manager = MentionNotificationManager.getInstance();
    manager.addNotification(makeNotification({ commentId: 1 }));
    manager.addNotification(makeNotification({ commentId: 2 }));

    const { result } = renderHook(() => useMentions());
    act(() => {
      result.current.markAllRead();
    });
    expect(result.current.unreadCount).toBe(0);
  });

  it('remove updates state', () => {
    const manager = MentionNotificationManager.getInstance();
    const n = manager.addNotification(makeNotification());

    const { result } = renderHook(() => useMentions());
    act(() => {
      result.current.remove(n.id);
    });
    expect(result.current.count).toBe(0);
  });

  it('clearAll updates state', () => {
    const manager = MentionNotificationManager.getInstance();
    manager.addNotification(makeNotification({ commentId: 1 }));
    manager.addNotification(makeNotification({ commentId: 2 }));

    const { result } = renderHook(() => useMentions());
    act(() => {
      result.current.clearAll();
    });
    expect(result.current.count).toBe(0);
    expect(result.current.notifications).toEqual([]);
  });

  it('unread array contains only unread items', () => {
    const manager = MentionNotificationManager.getInstance();
    const n1 = manager.addNotification(makeNotification({ commentId: 1 }));
    manager.addNotification(makeNotification({ commentId: 2 }));
    manager.markRead(n1.id);

    const { result } = renderHook(() => useMentions());
    expect(result.current.unread).toHaveLength(1);
    expect(result.current.unread[0].commentId).toBe(2);
  });
});
