/**
 * Net Cross-Probing State Manager
 *
 * Enables cross-view highlighting of nets and components.
 * When a net is selected in one view (e.g., schematic), all other views
 * (PCB layout, netlist table) can highlight the same net.
 *
 * Usage:
 *   const manager = CrossProbeManager.getInstance();
 *   manager.highlightNet('VCC', 'schematic');
 *   manager.isNetHighlighted('VCC'); // true
 *
 * React hook:
 *   const { highlightedNets, highlightNet, getNetColor } = useCrossProbe();
 */

import { useCallback, useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CrossProbeState {
  highlightedNets: Set<string>;
  highlightedComponents: Set<string>;
  sourceView: string | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * 12 distinct bright colors for net highlighting.
 * Chosen for contrast against dark backgrounds and between each other.
 */
const NET_COLOR_PALETTE: readonly string[] = [
  '#FF4136', // red
  '#2ECC40', // green
  '#0074D9', // blue
  '#FFDC00', // yellow
  '#FF851B', // orange
  '#B10DC9', // purple
  '#7FDBFF', // aqua
  '#F012BE', // fuchsia
  '#01FF70', // lime
  '#39CCCC', // teal
  '#85144b', // maroon
  '#FF6384', // pink
] as const;

// ---------------------------------------------------------------------------
// CrossProbeManager
// ---------------------------------------------------------------------------

/**
 * Centralized manager for cross-probe highlighting state.
 * Singleton per application. Notifies subscribers on state changes.
 */
export class CrossProbeManager {
  private static instance: CrossProbeManager | null = null;

  private state: CrossProbeState;
  private subscribers: Set<() => void>;

  constructor() {
    this.state = {
      highlightedNets: new Set(),
      highlightedComponents: new Set(),
      sourceView: null,
    };
    this.subscribers = new Set();
  }

  /** Get or create the singleton instance. */
  static getInstance(): CrossProbeManager {
    if (!CrossProbeManager.instance) {
      CrossProbeManager.instance = new CrossProbeManager();
    }
    return CrossProbeManager.instance;
  }

  /** Reset the singleton (useful for testing). */
  static resetInstance(): void {
    CrossProbeManager.instance = null;
  }

  // -----------------------------------------------------------------------
  // Net highlighting
  // -----------------------------------------------------------------------

  /** Add a net to the highlighted set. */
  highlightNet(netId: string, sourceView: string): void {
    this.state.highlightedNets.add(netId);
    this.state.sourceView = sourceView;
    this.notify();
  }

  /** Toggle a net's highlight state (for Ctrl+click multi-select). */
  toggleNet(netId: string, sourceView: string): void {
    if (this.state.highlightedNets.has(netId)) {
      this.state.highlightedNets.delete(netId);
    } else {
      this.state.highlightedNets.add(netId);
    }
    this.state.sourceView = sourceView;
    this.notify();
  }

  /** Check if a net is currently highlighted. */
  isNetHighlighted(netId: string): boolean {
    return this.state.highlightedNets.has(netId);
  }

  /** Get all highlighted net IDs as an array. */
  getHighlightedNets(): string[] {
    return Array.from(this.state.highlightedNets);
  }

  /** Clear only net highlights. */
  clearNets(): void {
    if (this.state.highlightedNets.size === 0) {
      return;
    }
    this.state.highlightedNets.clear();
    this.notify();
  }

  // -----------------------------------------------------------------------
  // Component highlighting
  // -----------------------------------------------------------------------

  /** Add a component to the highlighted set. */
  highlightComponent(componentId: string, sourceView: string): void {
    this.state.highlightedComponents.add(componentId);
    this.state.sourceView = sourceView;
    this.notify();
  }

  /** Check if a component is currently highlighted. */
  isComponentHighlighted(componentId: string): boolean {
    return this.state.highlightedComponents.has(componentId);
  }

  /** Get all highlighted component IDs as an array. */
  getHighlightedComponents(): string[] {
    return Array.from(this.state.highlightedComponents);
  }

  /** Clear only component highlights. */
  clearComponents(): void {
    if (this.state.highlightedComponents.size === 0) {
      return;
    }
    this.state.highlightedComponents.clear();
    this.notify();
  }

  // -----------------------------------------------------------------------
  // General
  // -----------------------------------------------------------------------

  /** Get the view that initiated the current highlighting. */
  getSourceView(): string | null {
    return this.state.sourceView;
  }

  /** Clear all highlighting (nets + components). */
  clearAll(): void {
    const hadState =
      this.state.highlightedNets.size > 0 ||
      this.state.highlightedComponents.size > 0 ||
      this.state.sourceView !== null;

    this.state.highlightedNets.clear();
    this.state.highlightedComponents.clear();
    this.state.sourceView = null;

    if (hadState) {
      this.notify();
    }
  }

  // -----------------------------------------------------------------------
  // Color assignment
  // -----------------------------------------------------------------------

  /**
   * Get a deterministic color for a net ID.
   * Uses a simple hash of the net ID string to pick from the palette.
   * Same net ID always produces the same color.
   */
  getNetColor(netId: string): string {
    const hash = this.hashString(netId);
    const index = Math.abs(hash) % NET_COLOR_PALETTE.length;
    return NET_COLOR_PALETTE[index];
  }

  // -----------------------------------------------------------------------
  // Subscription
  // -----------------------------------------------------------------------

  /**
   * Subscribe to state changes. Returns an unsubscribe function.
   * Callback is invoked whenever nets or components are highlighted/cleared.
   */
  subscribe(callback: () => void): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
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

  /**
   * Simple string hash (djb2 algorithm).
   * Produces a 32-bit integer from a string.
   */
  private hashString(str: string): number {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      // hash * 33 + charCode
      hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
    }
    return hash;
  }
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

/**
 * Hook for accessing cross-probe state in React components.
 * Subscribes to the CrossProbeManager and triggers re-renders on state changes.
 */
export function useCrossProbe(): {
  highlightedNets: string[];
  highlightedComponents: string[];
  highlightNet: (netId: string, sourceView: string) => void;
  toggleNet: (netId: string, sourceView: string) => void;
  highlightComponent: (componentId: string, sourceView: string) => void;
  clearAll: () => void;
  isNetHighlighted: (netId: string) => boolean;
  isComponentHighlighted: (componentId: string) => boolean;
  getNetColor: (netId: string) => string;
} {
  const [, setTick] = useState(0);

  useEffect(() => {
    const manager = CrossProbeManager.getInstance();
    const unsubscribe = manager.subscribe(() => {
      setTick((t) => t + 1);
    });
    return unsubscribe;
  }, []);

  const manager = CrossProbeManager.getInstance();

  const highlightNet = useCallback((netId: string, sourceView: string) => {
    CrossProbeManager.getInstance().highlightNet(netId, sourceView);
  }, []);

  const toggleNet = useCallback((netId: string, sourceView: string) => {
    CrossProbeManager.getInstance().toggleNet(netId, sourceView);
  }, []);

  const highlightComponent = useCallback((componentId: string, sourceView: string) => {
    CrossProbeManager.getInstance().highlightComponent(componentId, sourceView);
  }, []);

  const clearAll = useCallback(() => {
    CrossProbeManager.getInstance().clearAll();
  }, []);

  const isNetHighlighted = useCallback((netId: string) => {
    return CrossProbeManager.getInstance().isNetHighlighted(netId);
  }, []);

  const isComponentHighlighted = useCallback((componentId: string) => {
    return CrossProbeManager.getInstance().isComponentHighlighted(componentId);
  }, []);

  const getNetColor = useCallback((netId: string) => {
    return CrossProbeManager.getInstance().getNetColor(netId);
  }, []);

  return {
    highlightedNets: manager.getHighlightedNets(),
    highlightedComponents: manager.getHighlightedComponents(),
    highlightNet,
    toggleNet,
    highlightComponent,
    clearAll,
    isNetHighlighted,
    isComponentHighlighted,
    getNetColor,
  };
}
