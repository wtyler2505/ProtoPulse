/**
 * Mentions & Notification Manager (BL-0187)
 *
 * Parses @username patterns from comment text, manages a notification inbox
 * with read/unread tracking, and persists to localStorage.
 * Singleton + subscribe pattern for React integration.
 *
 * Usage:
 *   const manager = MentionNotificationManager.getInstance();
 *   manager.addNotification({ ... });
 *   const { notifications, unreadCount } = useMentions();
 */

import { useCallback, useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ParsedMention {
  /** The raw @username text (including the @). */
  raw: string;
  /** The username without the @ prefix. */
  username: string;
  /** Start index of the mention in the source string. */
  startIndex: number;
  /** End index (exclusive) of the mention in the source string. */
  endIndex: number;
}

export interface MentionNotification {
  /** Unique notification ID. */
  id: string;
  /** The username being mentioned (without @). */
  mentionedUser: string;
  /** The username of the person who wrote the comment. */
  fromUser: string;
  /** The comment content (or excerpt). */
  commentExcerpt: string;
  /** The comment ID this mention originated from. */
  commentId: number;
  /** The project ID the comment belongs to. */
  projectId: number;
  /** Whether the notification has been read. */
  read: boolean;
  /** Timestamp of notification creation. */
  createdAt: number;
}

// ---------------------------------------------------------------------------
// Mention Parser
// ---------------------------------------------------------------------------

/**
 * Regex for matching @username patterns.
 * Usernames: 1-32 alphanumeric, underscore, or hyphen characters.
 * Must be preceded by a word boundary or start of string.
 */
const MENTION_REGEX = /(?:^|(?<=\s|[^a-zA-Z0-9_-]))@([a-zA-Z0-9_-]{1,32})/g;

/**
 * Parse all @username mentions from a string.
 * Returns an array of ParsedMention objects with positions.
 */
export function parseMentions(text: string): ParsedMention[] {
  if (!text) {
    return [];
  }

  const mentions: ParsedMention[] = [];
  let match: RegExpExecArray | null;

  // Reset regex state for global matching
  MENTION_REGEX.lastIndex = 0;

  while ((match = MENTION_REGEX.exec(text)) !== null) {
    const atIndex = text.lastIndexOf('@', match.index + match[0].length - 1);
    mentions.push({
      raw: `@${match[1]}`,
      username: match[1],
      startIndex: atIndex,
      endIndex: atIndex + match[1].length + 1,
    });
  }

  return mentions;
}

/**
 * Extract unique usernames mentioned in a string.
 * Returns deduplicated, lowercase-normalized array.
 */
export function extractMentionedUsers(text: string): string[] {
  const mentions = parseMentions(text);
  const unique = new Set(mentions.map((m) => m.username.toLowerCase()));
  return Array.from(unique);
}

/**
 * Check if a specific username is mentioned in the text.
 * Case-insensitive comparison.
 */
export function isMentioned(text: string, username: string): boolean {
  const users = extractMentionedUsers(text);
  return users.includes(username.toLowerCase());
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'protopulse:mention-notifications';
const MAX_NOTIFICATIONS = 100;

// ---------------------------------------------------------------------------
// MentionNotificationManager
// ---------------------------------------------------------------------------

type Listener = () => void;

/**
 * Manages mention notifications with localStorage persistence.
 * Singleton per application. Notifies subscribers on state changes.
 */
export class MentionNotificationManager {
  private static instance: MentionNotificationManager | null = null;

  private notifications: MentionNotification[];
  private listeners: Set<Listener>;

  constructor() {
    this.notifications = [];
    this.listeners = new Set();
    this.load();
  }

  /** Get or create the singleton instance. */
  static getInstance(): MentionNotificationManager {
    if (!MentionNotificationManager.instance) {
      MentionNotificationManager.instance = new MentionNotificationManager();
    }
    return MentionNotificationManager.instance;
  }

  /** Reset the singleton (useful for testing). */
  static resetInstance(): void {
    MentionNotificationManager.instance = null;
  }

  // -----------------------------------------------------------------------
  // Queries
  // -----------------------------------------------------------------------

  /** Get all notifications, newest first. */
  getNotifications(): MentionNotification[] {
    return [...this.notifications].sort((a, b) => b.createdAt - a.createdAt);
  }

  /** Get unread notifications only, newest first. */
  getUnread(): MentionNotification[] {
    return this.getNotifications().filter((n) => !n.read);
  }

  /** Get the count of unread notifications. */
  getUnreadCount(): number {
    return this.notifications.filter((n) => !n.read).length;
  }

  /** Get total notification count. */
  getCount(): number {
    return this.notifications.length;
  }

  /** Get a notification by ID. */
  getById(id: string): MentionNotification | undefined {
    return this.notifications.find((n) => n.id === id);
  }

  /** Get notifications for a specific user. */
  getForUser(username: string): MentionNotification[] {
    const lower = username.toLowerCase();
    return this.getNotifications().filter((n) => n.mentionedUser.toLowerCase() === lower);
  }

  // -----------------------------------------------------------------------
  // Mutations
  // -----------------------------------------------------------------------

  /**
   * Add a new notification. Deduplicates by commentId + mentionedUser.
   * Enforces MAX_NOTIFICATIONS limit by evicting oldest read notifications first,
   * then oldest unread.
   */
  addNotification(notification: Omit<MentionNotification, 'id' | 'read' | 'createdAt'>): MentionNotification {
    // Deduplicate: same comment + same mentioned user = skip
    const existing = this.notifications.find(
      (n) =>
        n.commentId === notification.commentId &&
        n.mentionedUser.toLowerCase() === notification.mentionedUser.toLowerCase(),
    );
    if (existing) {
      return existing;
    }

    const entry: MentionNotification = {
      ...notification,
      id: crypto.randomUUID(),
      read: false,
      createdAt: Date.now(),
    };

    this.notifications.unshift(entry);

    // Enforce max limit — evict oldest read first, then oldest unread
    while (this.notifications.length > MAX_NOTIFICATIONS) {
      const oldestReadIdx = this.findOldestReadIndex();
      if (oldestReadIdx >= 0) {
        this.notifications.splice(oldestReadIdx, 1);
      } else {
        // No read notifications to evict — remove oldest unread
        this.notifications.pop();
      }
    }

    this.save();
    this.notify();
    return entry;
  }

  /** Mark a notification as read. */
  markRead(id: string): void {
    const notification = this.notifications.find((n) => n.id === id);
    if (notification && !notification.read) {
      notification.read = true;
      this.save();
      this.notify();
    }
  }

  /** Mark all notifications as read. */
  markAllRead(): void {
    let changed = false;
    for (const n of this.notifications) {
      if (!n.read) {
        n.read = true;
        changed = true;
      }
    }
    if (changed) {
      this.save();
      this.notify();
    }
  }

  /** Remove a notification by ID. */
  remove(id: string): void {
    const initialLength = this.notifications.length;
    this.notifications = this.notifications.filter((n) => n.id !== id);
    if (this.notifications.length !== initialLength) {
      this.save();
      this.notify();
    }
  }

  /** Remove all notifications. */
  clearAll(): void {
    if (this.notifications.length === 0) {
      return;
    }
    this.notifications = [];
    this.save();
    this.notify();
  }

  // -----------------------------------------------------------------------
  // Subscription
  // -----------------------------------------------------------------------

  /** Subscribe to state changes. Returns unsubscribe function. */
  subscribe(callback: Listener): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  // -----------------------------------------------------------------------
  // Persistence
  // -----------------------------------------------------------------------

  private save(): void {
    try {
      if (typeof window === 'undefined') {
        return;
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.notifications));
    } catch {
      // localStorage may be unavailable or quota exceeded
    }
  }

  private load(): void {
    try {
      if (typeof window === 'undefined') {
        return;
      }
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return;
      }
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        this.notifications = [];
        return;
      }
      this.notifications = parsed.filter(
        (item: unknown): item is MentionNotification => isValidNotification(item),
      );
    } catch {
      // Corrupt data — start fresh
      this.notifications = [];
    }
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  private notify(): void {
    for (const cb of Array.from(this.listeners)) {
      cb();
    }
  }

  /** Find the index of the oldest read notification. Returns -1 if none. */
  private findOldestReadIndex(): number {
    let oldestIdx = -1;
    let oldestTime = Infinity;
    for (let i = 0; i < this.notifications.length; i++) {
      if (this.notifications[i].read && this.notifications[i].createdAt < oldestTime) {
        oldestTime = this.notifications[i].createdAt;
        oldestIdx = i;
      }
    }
    return oldestIdx;
  }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function isValidNotification(value: unknown): value is MentionNotification {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.id === 'string' &&
    typeof obj.mentionedUser === 'string' &&
    typeof obj.fromUser === 'string' &&
    typeof obj.commentExcerpt === 'string' &&
    typeof obj.commentId === 'number' &&
    typeof obj.projectId === 'number' &&
    typeof obj.read === 'boolean' &&
    typeof obj.createdAt === 'number'
  );
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

/**
 * Hook for accessing mention notifications in React components.
 * Subscribes to the MentionNotificationManager and triggers re-renders on state changes.
 */
export function useMentions(): {
  notifications: MentionNotification[];
  unread: MentionNotification[];
  unreadCount: number;
  markRead: (id: string) => void;
  markAllRead: () => void;
  remove: (id: string) => void;
  clearAll: () => void;
  count: number;
} {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const manager = MentionNotificationManager.getInstance();
    const unsubscribe = manager.subscribe(() => {
      setTick((t) => t + 1);
    });
    return unsubscribe;
  }, []);

  const markRead = useCallback((id: string) => {
    MentionNotificationManager.getInstance().markRead(id);
  }, []);

  const markAllRead = useCallback(() => {
    MentionNotificationManager.getInstance().markAllRead();
  }, []);

  const remove = useCallback((id: string) => {
    MentionNotificationManager.getInstance().remove(id);
  }, []);

  const clearAll = useCallback(() => {
    MentionNotificationManager.getInstance().clearAll();
  }, []);

  const manager = typeof window !== 'undefined' ? MentionNotificationManager.getInstance() : null;

  return {
    notifications: manager?.getNotifications() ?? [],
    unread: manager?.getUnread() ?? [],
    unreadCount: manager?.getUnreadCount() ?? 0,
    markRead,
    markAllRead,
    remove,
    clearAll,
    count: manager?.getCount() ?? 0,
  };
}
