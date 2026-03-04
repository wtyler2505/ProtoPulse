/**
 * Component Favorites Manager
 *
 * Allows users to mark frequently used components as favorites.
 * Persists to localStorage with a max limit of 50 entries.
 * Evicts the oldest entry when the limit is exceeded.
 *
 * Usage:
 *   const manager = FavoritesManager.getInstance();
 *   manager.addFavorite('resistor-10k', { name: '10K Resistor', family: 'Resistors' });
 *   manager.isFavorite('resistor-10k'); // true
 *
 * React hook:
 *   const { favorites, toggleFavorite, isFavorite } = useFavorites();
 */

import { useCallback, useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FavoriteEntry {
  componentId: string;
  name: string;
  family?: string;
  packageType?: string;
  addedAt: number;
}

export interface FavoriteMetadata {
  name: string;
  family?: string;
  packageType?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'protopulse-component-favorites';
const MAX_FAVORITES = 50;

// ---------------------------------------------------------------------------
// FavoritesManager
// ---------------------------------------------------------------------------

/**
 * Manages a list of favorite components with localStorage persistence.
 * Singleton per application. Notifies subscribers on state changes.
 */
export class FavoritesManager {
  private static instance: FavoritesManager | null = null;

  private favorites: FavoriteEntry[];
  private subscribers: Set<() => void>;

  constructor() {
    this.favorites = [];
    this.subscribers = new Set();
    this.load();
  }

  /** Get or create the singleton instance. */
  static getInstance(): FavoritesManager {
    if (!FavoritesManager.instance) {
      FavoritesManager.instance = new FavoritesManager();
    }
    return FavoritesManager.instance;
  }

  /** Reset the singleton (useful for testing). */
  static resetInstance(): void {
    FavoritesManager.instance = null;
  }

  // -----------------------------------------------------------------------
  // Queries
  // -----------------------------------------------------------------------

  /** Check if a component is in the favorites list. */
  isFavorite(componentId: string): boolean {
    return this.favorites.some((f) => f.componentId === componentId);
  }

  /**
   * Get all favorites sorted by addedAt descending (newest first).
   * Returns a copy to prevent external mutation.
   */
  getFavorites(): FavoriteEntry[] {
    return [...this.favorites].sort((a, b) => b.addedAt - a.addedAt);
  }

  /** Get the number of favorites. */
  getCount(): number {
    return this.favorites.length;
  }

  // -----------------------------------------------------------------------
  // Mutations
  // -----------------------------------------------------------------------

  /**
   * Add a component to favorites. Adds to front of list.
   * If the component is already a favorite, this is a no-op (idempotent).
   * When adding the 51st favorite, evicts the oldest entry.
   */
  addFavorite(componentId: string, metadata: FavoriteMetadata): void {
    if (this.isFavorite(componentId)) {
      return;
    }

    const entry: FavoriteEntry = {
      componentId,
      name: metadata.name,
      family: metadata.family,
      packageType: metadata.packageType,
      addedAt: Date.now(),
    };

    this.favorites.unshift(entry);

    // Enforce max limit — evict oldest
    if (this.favorites.length > MAX_FAVORITES) {
      // Sort to find oldest, remove it
      const sorted = [...this.favorites].sort((a, b) => a.addedAt - b.addedAt);
      const oldest = sorted[0];
      this.favorites = this.favorites.filter((f) => f.componentId !== oldest.componentId);
    }

    this.save();
    this.notify();
  }

  /** Remove a component from favorites by ID. */
  removeFavorite(componentId: string): void {
    const initialLength = this.favorites.length;
    this.favorites = this.favorites.filter((f) => f.componentId !== componentId);
    if (this.favorites.length !== initialLength) {
      this.save();
      this.notify();
    }
  }

  /** Toggle a component's favorite status. Add if not present, remove if present. */
  toggleFavorite(componentId: string, metadata: FavoriteMetadata): void {
    if (this.isFavorite(componentId)) {
      this.removeFavorite(componentId);
    } else {
      this.addFavorite(componentId, metadata);
    }
  }

  /** Remove all favorites. */
  clearAll(): void {
    if (this.favorites.length === 0) {
      return;
    }
    this.favorites = [];
    this.save();
    this.notify();
  }

  // -----------------------------------------------------------------------
  // Subscription
  // -----------------------------------------------------------------------

  /**
   * Subscribe to state changes. Returns an unsubscribe function.
   * Callback is invoked whenever favorites are added/removed/cleared.
   */
  subscribe(callback: () => void): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  // -----------------------------------------------------------------------
  // Persistence
  // -----------------------------------------------------------------------

  /** Persist favorites to localStorage. */
  private save(): void {
    try {
      if (typeof window === 'undefined') {
        return;
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.favorites));
    } catch {
      // localStorage may be unavailable or quota exceeded
    }
  }

  /** Load favorites from localStorage. */
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
        this.favorites = [];
        return;
      }
      // Validate each entry
      this.favorites = parsed.filter(
        (item: unknown): item is FavoriteEntry =>
          typeof item === 'object' &&
          item !== null &&
          typeof (item as FavoriteEntry).componentId === 'string' &&
          typeof (item as FavoriteEntry).name === 'string' &&
          typeof (item as FavoriteEntry).addedAt === 'number',
      );
    } catch {
      // Corrupt data — start fresh
      this.favorites = [];
    }
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  /** Notify all subscribers of a state change. */
  private notify(): void {
    this.subscribers.forEach((cb) => {
      cb();
    });
  }
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

/**
 * Hook for accessing component favorites in React components.
 * Subscribes to the FavoritesManager and triggers re-renders on state changes.
 * Safe for SSR (checks typeof window).
 */
export function useFavorites(): {
  favorites: FavoriteEntry[];
  addFavorite: (componentId: string, metadata: FavoriteMetadata) => void;
  removeFavorite: (componentId: string) => void;
  toggleFavorite: (componentId: string, metadata: FavoriteMetadata) => void;
  isFavorite: (componentId: string) => boolean;
  clearAll: () => void;
  count: number;
} {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const manager = FavoritesManager.getInstance();
    const unsubscribe = manager.subscribe(() => {
      setTick((t) => t + 1);
    });
    return unsubscribe;
  }, []);

  const getManager = useCallback(() => {
    return FavoritesManager.getInstance();
  }, []);

  const addFavorite = useCallback((componentId: string, metadata: FavoriteMetadata) => {
    FavoritesManager.getInstance().addFavorite(componentId, metadata);
  }, []);

  const removeFavorite = useCallback((componentId: string) => {
    FavoritesManager.getInstance().removeFavorite(componentId);
  }, []);

  const toggleFavorite = useCallback((componentId: string, metadata: FavoriteMetadata) => {
    FavoritesManager.getInstance().toggleFavorite(componentId, metadata);
  }, []);

  const isFavorite = useCallback((componentId: string) => {
    return FavoritesManager.getInstance().isFavorite(componentId);
  }, []);

  const clearAll = useCallback(() => {
    FavoritesManager.getInstance().clearAll();
  }, []);

  const manager = getManager();

  return {
    favorites: typeof window !== 'undefined' ? manager.getFavorites() : [],
    addFavorite,
    removeFavorite,
    toggleFavorite,
    isFavorite,
    clearAll,
    count: typeof window !== 'undefined' ? manager.getCount() : 0,
  };
}
