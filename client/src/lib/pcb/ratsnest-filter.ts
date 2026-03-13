/**
 * RatsnestFilter — singleton+subscribe manager for per-net ratsnest visibility.
 *
 * Controls which nets' ratsnest lines are drawn on the PCB canvas.
 * State persists to localStorage so filter preferences survive page reloads.
 */

import type { RatsnestNet } from '@/components/circuit-editor/RatsnestOverlay';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NetVisibility {
  visible: boolean;
  color?: string;
}

type Listener = () => void;

const STORAGE_KEY = 'protopulse-ratsnest-filter';

// ---------------------------------------------------------------------------
// RatsnestFilterManager
// ---------------------------------------------------------------------------

class RatsnestFilterManager {
  private state = new Map<number, NetVisibility>();
  private listeners = new Set<Listener>();
  private _version = 0;

  constructor() {
    this.load();
  }

  /** Monotonic version counter for useSyncExternalStore integration. */
  get version(): number {
    return this._version;
  }

  // ---- Visibility API ----

  /** Set visibility for a specific net. */
  setNetVisibility(netId: number, visible: boolean): void {
    const existing = this.state.get(netId);
    this.state.set(netId, { ...existing, visible });
    this._version++;
    this.persist();
    this.notify();
  }

  /** Toggle a net's visibility. Defaults to visible if not yet tracked. */
  toggleNet(netId: number): void {
    const current = this.state.get(netId);
    const currentlyVisible = current?.visible ?? true;
    this.setNetVisibility(netId, !currentlyVisible);
  }

  /** Show all nets (clear all hidden overrides). */
  showAll(): void {
    this.state.clear();
    this._version++;
    this.persist();
    this.notify();
  }

  /** Hide all nets. Requires the full list of known net IDs. */
  hideAll(netIds: number[]): void {
    for (const id of netIds) {
      const existing = this.state.get(id);
      this.state.set(id, { ...existing, visible: false });
    }
    this._version++;
    this.persist();
    this.notify();
  }

  /** Show only the specified nets, hide everything else. */
  showOnly(visibleNetIds: number[], allNetIds: number[]): void {
    const visibleSet = new Set(visibleNetIds);
    for (const id of allNetIds) {
      const existing = this.state.get(id);
      this.state.set(id, { ...existing, visible: visibleSet.has(id) });
    }
    this._version++;
    this.persist();
    this.notify();
  }

  /** Check if a net is visible. Returns true by default (nets are visible unless explicitly hidden). */
  isNetVisible(netId: number): boolean {
    const entry = this.state.get(netId);
    return entry?.visible ?? true;
  }

  /** Get all net IDs that are currently visible (or not explicitly hidden). */
  getVisibleNets(allNetIds: number[]): number[] {
    return allNetIds.filter((id) => this.isNetVisible(id));
  }

  /** Get the full state map (for debugging / introspection). */
  getState(): ReadonlyMap<number, NetVisibility> {
    return this.state;
  }

  // ---- Filtering ----

  /** Filter a list of RatsnestNet objects, removing nets that are hidden. */
  filterRatsnest(allNets: RatsnestNet[]): RatsnestNet[] {
    // If no overrides exist, all nets are visible — skip filtering
    if (this.state.size === 0) {
      return allNets;
    }
    return allNets.filter((net) => this.isNetVisible(net.netId));
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
    for (const listener of Array.from(this.listeners)) {
      listener();
    }
  }

  private persist(): void {
    try {
      const entries: Array<[number, NetVisibility]> = Array.from(this.state.entries());
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch {
      // localStorage may be unavailable
    }
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return;
      }
      const entries = JSON.parse(raw) as Array<[number, NetVisibility]>;
      for (const [netId, entry] of entries) {
        if (typeof netId === 'number' && typeof entry === 'object' && entry !== null) {
          this.state.set(netId, {
            visible: typeof entry.visible === 'boolean' ? entry.visible : true,
            color: typeof entry.color === 'string' ? entry.color : undefined,
          });
        }
      }
    } catch {
      // Ignore corrupt data
    }
  }
}

/** Singleton instance. */
export const ratsnestFilter = new RatsnestFilterManager();
