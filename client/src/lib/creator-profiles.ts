/**
 * Creator Profile Manager
 *
 * Manages creator/user profiles for the ProtoPulse community. Provides profile
 * CRUD, public directory browsing, search, and computed creator statistics.
 * Singleton+subscribe pattern with localStorage persistence and a React hook.
 *
 * Usage:
 *   const manager = CreatorProfileManager.getInstance();
 *   manager.updateProfile('user-1', { displayName: 'Ada Lovelace' });
 *   const results = manager.searchCreators('ada');
 *
 * React hook:
 *   const { profile, stats, updateProfile } = useCreatorProfile('user-1');
 */

import { useCallback, useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreatorProfile {
  id: string;
  displayName: string;
  bio?: string;
  avatar?: string;
  skills: string[];
  projectCount: number;
  sharedDesignCount: number;
  joinedAt: number;
  socialLinks?: Record<string, string>;
}

export interface CreatorStats {
  totalDownloads: number;
  averageRating: number;
  topDesigns: Array<{ id: string; name: string; downloads: number; rating: number }>;
}

export interface CreatorProfileUpdate {
  displayName?: string;
  bio?: string;
  avatar?: string;
  skills?: string[];
  projectCount?: number;
  sharedDesignCount?: number;
  socialLinks?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'protopulse-creator-profiles';
const MAX_PROFILES = 10000;
const MAX_SKILLS = 50;
const MAX_SOCIAL_LINKS = 20;
const MAX_TOP_DESIGNS = 10;
const DEFAULT_PAGE_SIZE = 20;

// ---------------------------------------------------------------------------
// Listener type
// ---------------------------------------------------------------------------

type Listener = () => void;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Case-insensitive substring match across multiple fields.
 */
function matchesQuery(profile: CreatorProfile, query: string): boolean {
  const q = query.toLowerCase();
  if (profile.displayName.toLowerCase().includes(q)) {
    return true;
  }
  if (profile.bio?.toLowerCase().includes(q)) {
    return true;
  }
  if (profile.skills.some((s) => s.toLowerCase().includes(q))) {
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// CreatorProfileManager
// ---------------------------------------------------------------------------

/**
 * Manages creator profiles with localStorage persistence. Singleton per
 * application. Notifies subscribers on every state mutation.
 */
export class CreatorProfileManager {
  private static instance: CreatorProfileManager | null = null;

  private profiles = new Map<string, CreatorProfile>();
  private statsCache = new Map<string, CreatorStats>();
  private listeners = new Set<Listener>();

  constructor() {
    this.loadFromStorage();
  }

  /** Get or create the singleton instance. */
  static getInstance(): CreatorProfileManager {
    if (!CreatorProfileManager.instance) {
      CreatorProfileManager.instance = new CreatorProfileManager();
    }
    return CreatorProfileManager.instance;
  }

  /** Reset the singleton (useful for testing). */
  static resetForTesting(): void {
    CreatorProfileManager.instance = null;
  }

  // -----------------------------------------------------------------------
  // Subscription
  // -----------------------------------------------------------------------

  /**
   * Subscribe to state changes. Returns an unsubscribe function.
   * Callback is invoked on any profile mutation.
   */
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    this.listeners.forEach((l) => {
      l();
    });
  }

  // -----------------------------------------------------------------------
  // Persistence
  // -----------------------------------------------------------------------

  private loadFromStorage(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return;
      }
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return;
      }
      for (const item of parsed) {
        if (this.isValidProfile(item)) {
          this.profiles.set(item.id, item as CreatorProfile);
        }
      }
    } catch {
      // Corrupted data — start fresh
    }
  }

  private saveToStorage(): void {
    try {
      const data = Array.from(this.profiles.values());
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Quota exceeded or other storage error — continue without persistence
    }
  }

  private isValidProfile(obj: unknown): boolean {
    if (typeof obj !== 'object' || obj === null) {
      return false;
    }
    const record = obj as Record<string, unknown>;
    return (
      typeof record['id'] === 'string' &&
      record['id'].length > 0 &&
      typeof record['displayName'] === 'string' &&
      record['displayName'].length > 0 &&
      Array.isArray(record['skills']) &&
      typeof record['projectCount'] === 'number' &&
      typeof record['sharedDesignCount'] === 'number' &&
      typeof record['joinedAt'] === 'number'
    );
  }

  // -----------------------------------------------------------------------
  // Queries
  // -----------------------------------------------------------------------

  /** Get a profile by ID, or undefined if not found. */
  getProfile(id: string): CreatorProfile | undefined {
    const profile = this.profiles.get(id);
    return profile ? { ...profile, skills: [...profile.skills] } : undefined;
  }

  /** Get all profiles, optionally limited. Sorted by joinedAt descending. */
  getPublicProfiles(limit?: number): CreatorProfile[] {
    const all = Array.from(this.profiles.values())
      .sort((a, b) => b.joinedAt - a.joinedAt)
      .map((p) => ({ ...p, skills: [...p.skills] }));
    if (limit !== undefined && limit > 0) {
      return all.slice(0, limit);
    }
    return all;
  }

  /**
   * Search creators by query string. Matches against displayName, bio, and
   * skills (case-insensitive substring). Returns results sorted by relevance
   * (displayName match first, then bio, then skills).
   */
  searchCreators(query: string, limit?: number): CreatorProfile[] {
    if (!query.trim()) {
      return this.getPublicProfiles(limit);
    }

    const q = query.toLowerCase().trim();
    const nameMatches: CreatorProfile[] = [];
    const bioMatches: CreatorProfile[] = [];
    const skillMatches: CreatorProfile[] = [];

    for (const profile of this.profiles.values()) {
      if (profile.displayName.toLowerCase().includes(q)) {
        nameMatches.push({ ...profile, skills: [...profile.skills] });
      } else if (profile.bio?.toLowerCase().includes(q)) {
        bioMatches.push({ ...profile, skills: [...profile.skills] });
      } else if (profile.skills.some((s) => s.toLowerCase().includes(q))) {
        skillMatches.push({ ...profile, skills: [...profile.skills] });
      }
    }

    const results = [...nameMatches, ...bioMatches, ...skillMatches];
    const pageSize = limit ?? DEFAULT_PAGE_SIZE;
    return results.slice(0, pageSize);
  }

  /**
   * Compute stats for a creator. Downloads/ratings are derived from the
   * stats cache (seeded externally or via setCreatorStats). Returns a
   * default zero-stats object if no stats are cached.
   */
  getCreatorStats(id: string): CreatorStats {
    const cached = this.statsCache.get(id);
    if (cached) {
      return {
        ...cached,
        topDesigns: cached.topDesigns.map((d) => ({ ...d })),
      };
    }
    return {
      totalDownloads: 0,
      averageRating: 0,
      topDesigns: [],
    };
  }

  /** Total number of stored profiles. */
  getProfileCount(): number {
    return this.profiles.size;
  }

  // -----------------------------------------------------------------------
  // Mutations
  // -----------------------------------------------------------------------

  /**
   * Add or replace a creator profile. Validates required fields. Enforces
   * limits on skills count and social links count.
   *
   * @returns true if the profile was added/updated, false if validation failed
   */
  addProfile(profile: CreatorProfile): boolean {
    if (!profile.id || !profile.displayName) {
      return false;
    }

    if (this.profiles.size >= MAX_PROFILES && !this.profiles.has(profile.id)) {
      return false;
    }

    const sanitized: CreatorProfile = {
      ...profile,
      skills: profile.skills.slice(0, MAX_SKILLS),
      socialLinks: profile.socialLinks
        ? Object.fromEntries(Object.entries(profile.socialLinks).slice(0, MAX_SOCIAL_LINKS))
        : undefined,
    };

    this.profiles.set(sanitized.id, sanitized);
    this.saveToStorage();
    this.notify();
    return true;
  }

  /**
   * Partially update an existing profile. Only provided fields are updated.
   * Skills and socialLinks limits are enforced.
   *
   * @returns the updated profile, or undefined if the profile doesn't exist
   */
  updateProfile(id: string, updates: CreatorProfileUpdate): CreatorProfile | undefined {
    const existing = this.profiles.get(id);
    if (!existing) {
      return undefined;
    }

    const updated: CreatorProfile = {
      ...existing,
      ...updates,
      id: existing.id, // ID is immutable
      joinedAt: existing.joinedAt, // joinedAt is immutable
      skills: updates.skills ? updates.skills.slice(0, MAX_SKILLS) : existing.skills,
      socialLinks: updates.socialLinks
        ? Object.fromEntries(Object.entries(updates.socialLinks).slice(0, MAX_SOCIAL_LINKS))
        : existing.socialLinks,
    };

    this.profiles.set(id, updated);
    this.saveToStorage();
    this.notify();
    return { ...updated, skills: [...updated.skills] };
  }

  /**
   * Remove a profile by ID.
   *
   * @returns true if the profile was removed, false if not found
   */
  removeProfile(id: string): boolean {
    if (!this.profiles.has(id)) {
      return false;
    }
    this.profiles.delete(id);
    this.statsCache.delete(id);
    this.saveToStorage();
    this.notify();
    return true;
  }

  /**
   * Set computed stats for a creator. Enforces topDesigns limit.
   */
  setCreatorStats(id: string, stats: CreatorStats): void {
    this.statsCache.set(id, {
      ...stats,
      topDesigns: stats.topDesigns.slice(0, MAX_TOP_DESIGNS),
    });
    this.notify();
  }

  /**
   * Clear all profiles and stats. Used for testing or account reset.
   */
  clear(): void {
    this.profiles.clear();
    this.statsCache.clear();
    this.saveToStorage();
    this.notify();
  }
}

// ---------------------------------------------------------------------------
// React Hook
// ---------------------------------------------------------------------------

/**
 * Hook for accessing a creator profile and stats in React components.
 * Subscribes to the CreatorProfileManager singleton and triggers re-renders
 * on state changes.
 *
 * @param id - The creator profile ID to track
 */
export function useCreatorProfile(id: string): {
  profile: CreatorProfile | undefined;
  stats: CreatorStats;
  updateProfile: (updates: CreatorProfileUpdate) => CreatorProfile | undefined;
  removeProfile: () => boolean;
} {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const manager = CreatorProfileManager.getInstance();
    const unsubscribe = manager.subscribe(() => {
      setTick((t) => t + 1);
    });
    return unsubscribe;
  }, []);

  const update = useCallback(
    (updates: CreatorProfileUpdate) => {
      return CreatorProfileManager.getInstance().updateProfile(id, updates);
    },
    [id],
  );

  const remove = useCallback(() => {
    return CreatorProfileManager.getInstance().removeProfile(id);
  }, [id]);

  const manager = typeof window !== 'undefined' ? CreatorProfileManager.getInstance() : null;

  return {
    profile: manager?.getProfile(id),
    stats: manager?.getCreatorStats(id) ?? { totalDownloads: 0, averageRating: 0, topDesigns: [] },
    updateProfile: update,
    removeProfile: remove,
  };
}
