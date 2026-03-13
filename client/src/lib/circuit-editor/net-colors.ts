/**
 * NetColorManager — singleton+subscribe pattern for per-net color assignment.
 * Colors persist to localStorage and propagate to wires + ratsnest overlay.
 */

import type { NetType } from '@shared/circuit-types';

// ---------------------------------------------------------------------------
// Default palette by net type
// ---------------------------------------------------------------------------

const DEFAULT_NET_TYPE_COLORS: Record<NetType, string> = {
  power: '#ef4444',   // red
  ground: '#22c55e',  // green (matches existing ground wire color)
  signal: '#06b6d4',  // cyan
  bus: '#a855f7',     // purple
};

const STORAGE_KEY = 'protopulse:net-colors';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NetColorEntry {
  netId: number;
  color: string;
}

type Listener = () => void;

// ---------------------------------------------------------------------------
// NetColorManager
// ---------------------------------------------------------------------------

class NetColorManagerImpl {
  private colors = new Map<number, string>();
  private listeners = new Set<Listener>();
  /** Monotonic version counter — incremented on every mutation. Used as a stable
   *  snapshot value for `useSyncExternalStore` so React re-renders on any change. */
  private _version = 0;

  constructor() {
    this.load();
  }

  /** Current version — changes on every mutation (set/clear/clearAll). */
  get version(): number {
    return this._version;
  }

  // ---- Public API ----

  /** Set a custom color for a specific net. */
  setNetColor(netId: number, color: string): void {
    this.colors.set(netId, color);
    this._version++;
    this.persist();
    this.notify();
  }

  /** Remove a custom color for a net (reverts to default). */
  clearNetColor(netId: number): void {
    this.colors.delete(netId);
    this._version++;
    this.persist();
    this.notify();
  }

  /** Get the custom color for a net, or undefined if using default. */
  getNetColor(netId: number): string | undefined {
    return this.colors.get(netId);
  }

  /** Get the default color for a net type. */
  getDefaultColor(netType: NetType): string {
    return DEFAULT_NET_TYPE_COLORS[netType];
  }

  /** Resolve the effective color: custom override or type-based default. */
  resolveColor(netId: number, netType: NetType): string {
    return this.colors.get(netId) ?? DEFAULT_NET_TYPE_COLORS[netType];
  }

  /** Get all custom color assignments. */
  getAllColors(): NetColorEntry[] {
    return Array.from(this.colors.entries()).map(([netId, color]) => ({
      netId,
      color,
    }));
  }

  /** Clear all custom colors. */
  clearAll(): void {
    this.colors.clear();
    this._version++;
    this.persist();
    this.notify();
  }

  // ---- Subscribe pattern ----

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  // ---- Internal ----

  private notify(): void {
    Array.from(this.listeners).forEach((listener) => {
      listener();
    });
  }

  private persist(): void {
    try {
      const entries: Array<[number, string]> = Array.from(this.colors.entries());
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch {
      // localStorage may be unavailable
    }
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const entries = JSON.parse(raw) as Array<[number, string]>;
      for (const [netId, color] of entries) {
        if (typeof netId === 'number' && typeof color === 'string') {
          this.colors.set(netId, color);
        }
      }
    } catch {
      // Ignore corrupt data
    }
  }
}

/** Singleton instance. */
export const netColorManager = new NetColorManagerImpl();
