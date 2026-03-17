/**
 * Slow Path Detector — runtime performance diagnostics for views, fetches,
 * and user interactions.
 *
 * Singleton+subscribe pattern. Fires a {@link SlowPathEvent} whenever an
 * operation exceeds its configurable threshold, then provides actionable
 * suggestions via {@link getSuggestions}.  The {@link useSlowPathAlerts}
 * React hook exposes events and auto-subscribes to the detector.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default thresholds (milliseconds). */
export const SlowPathThreshold = {
  renderMs: 100,
  fetchMs: 3000,
  interactionMs: 200,
} as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SlowPathOperation = 'render' | 'fetch' | 'interaction';

export interface SlowPathEvent {
  /** Which view or endpoint triggered the event. */
  view: string;
  /** Category of operation. */
  operation: SlowPathOperation;
  /** Measured duration in milliseconds. */
  durationMs: number;
  /** Threshold that was exceeded (ms). */
  threshold: number;
  /** Human-readable suggestion. */
  suggestion: string;
}

export interface SlowPathThresholds {
  renderMs: number;
  fetchMs: number;
  interactionMs: number;
}

// ---------------------------------------------------------------------------
// Suggestion engine
// ---------------------------------------------------------------------------

/** View-specific suggestions keyed by `${operation}:${viewOrEndpoint}`. */
const SPECIFIC_SUGGESTIONS: Record<string, string[]> = {
  'render:architecture': [
    'Enable progressive rendering for large node graphs',
    'Collapse distant nodes into summary clusters',
  ],
  'render:schematic': [
    'Enable viewport culling to skip off-screen instances',
    'Reduce wire re-routing passes per frame',
  ],
  'render:pcb': [
    'Switch to WebGPU-accelerated rendering for large boards',
    'Disable copper-pour preview while editing',
  ],
  'render:bom': [
    'Reduce BOM items per page',
    'Enable virtual scrolling for large BOMs',
  ],
  'render:simulation': [
    'Reduce timestep resolution for preview runs',
    'Run simulation in a Web Worker',
  ],
  'render:3d': [
    'Lower mesh polygon count',
    'Disable shadows for faster frame times',
  ],
  'fetch:/api/projects': [
    'Paginate project list responses',
    'Cache project metadata locally',
  ],
  'fetch:/api/bom': [
    'Batch BOM queries to reduce round-trips',
    'Enable server-side pagination for BOM items',
  ],
  'fetch:/api/chat': [
    'Stream AI responses instead of waiting for full payload',
    'Reduce context size sent per request',
  ],
  'fetch:/api/circuits': [
    'Lazy-load hierarchical circuit data',
    'Cache circuit designs in IndexedDB',
  ],
  'interaction:drag': [
    'Throttle drag events to 60 fps',
    'Disable snapping during fast drags',
  ],
  'interaction:zoom': [
    'Use transform-only zoom (skip re-layout)',
    'Debounce zoom-triggered repaints',
  ],
  'interaction:select': [
    'Use spatial index for hit-testing',
    'Defer tooltip rendering on selection',
  ],
};

const GENERIC_SUGGESTIONS: Record<SlowPathOperation, string[]> = {
  render: [
    'Enable progressive rendering',
    'Memoize expensive component subtrees with React.memo',
    'Profile with React DevTools to find re-render hotspots',
  ],
  fetch: [
    'Enable response caching',
    'Use stale-while-revalidate strategy',
    'Reduce payload size with server-side filtering',
  ],
  interaction: [
    'Debounce rapid user input',
    'Offload heavy computation to a Web Worker',
    'Use requestAnimationFrame for visual updates',
  ],
};

/**
 * Return an ordered list of human-readable suggestions for a given event.
 * Specific suggestions (by view+operation) come first; generic fallbacks
 * fill out the rest so the caller always receives at least one suggestion.
 */
export function getSuggestions(event: SlowPathEvent): string[] {
  const specificKey = `${event.operation}:${event.view}`;
  const specific = SPECIFIC_SUGGESTIONS[specificKey] ?? [];
  const generic = GENERIC_SUGGESTIONS[event.operation] ?? [];

  // Merge — specific first, then generic items that are not already present.
  const seen = new Set(specific);
  const merged = [...specific];
  for (const g of generic) {
    if (!seen.has(g)) {
      merged.push(g);
      seen.add(g);
    }
  }

  return merged;
}

// ---------------------------------------------------------------------------
// SlowPathDetector singleton
// ---------------------------------------------------------------------------

export type SlowPathSubscriber = (event: SlowPathEvent) => void;

export class SlowPathDetector {
  private static instance: SlowPathDetector | null = null;

  private thresholds: SlowPathThresholds;
  private subscribers: Set<SlowPathSubscriber> = new Set();
  private history: SlowPathEvent[] = [];

  private constructor(thresholds?: Partial<SlowPathThresholds>) {
    this.thresholds = {
      renderMs: thresholds?.renderMs ?? SlowPathThreshold.renderMs,
      fetchMs: thresholds?.fetchMs ?? SlowPathThreshold.fetchMs,
      interactionMs: thresholds?.interactionMs ?? SlowPathThreshold.interactionMs,
    };
  }

  static getInstance(thresholds?: Partial<SlowPathThresholds>): SlowPathDetector {
    if (!SlowPathDetector.instance) {
      SlowPathDetector.instance = new SlowPathDetector(thresholds);
    }
    return SlowPathDetector.instance;
  }

  /** Reset singleton — useful for testing. */
  static resetInstance(): void {
    SlowPathDetector.instance = null;
  }

  // -----------------------------------------------------------------------
  // Configuration
  // -----------------------------------------------------------------------

  getThresholds(): Readonly<SlowPathThresholds> {
    return { ...this.thresholds };
  }

  setThresholds(partial: Partial<SlowPathThresholds>): void {
    if (partial.renderMs !== undefined) {
      this.thresholds.renderMs = partial.renderMs;
    }
    if (partial.fetchMs !== undefined) {
      this.thresholds.fetchMs = partial.fetchMs;
    }
    if (partial.interactionMs !== undefined) {
      this.thresholds.interactionMs = partial.interactionMs;
    }
  }

  // -----------------------------------------------------------------------
  // Detection API
  // -----------------------------------------------------------------------

  /**
   * Report a view render duration.  If it exceeds `renderMs` threshold an
   * event is emitted to all subscribers.
   *
   * @returns The event if threshold was exceeded, otherwise `null`.
   */
  detectSlowRender(view: string, durationMs: number): SlowPathEvent | null {
    if (durationMs <= this.thresholds.renderMs) {
      return null;
    }

    const event: SlowPathEvent = {
      view,
      operation: 'render',
      durationMs,
      threshold: this.thresholds.renderMs,
      suggestion: this.buildPrimarySuggestion('render', view),
    };
    this.emit(event);
    return event;
  }

  /**
   * Report a network fetch duration.  If it exceeds `fetchMs` threshold an
   * event is emitted.
   *
   * @returns The event if threshold was exceeded, otherwise `null`.
   */
  detectSlowFetch(endpoint: string, durationMs: number): SlowPathEvent | null {
    if (durationMs <= this.thresholds.fetchMs) {
      return null;
    }

    const event: SlowPathEvent = {
      view: endpoint,
      operation: 'fetch',
      durationMs,
      threshold: this.thresholds.fetchMs,
      suggestion: this.buildPrimarySuggestion('fetch', endpoint),
    };
    this.emit(event);
    return event;
  }

  /**
   * Report a user-interaction duration (drag, click, zoom, etc.).
   *
   * @returns The event if threshold was exceeded, otherwise `null`.
   */
  detectSlowInteraction(interaction: string, durationMs: number): SlowPathEvent | null {
    if (durationMs <= this.thresholds.interactionMs) {
      return null;
    }

    const event: SlowPathEvent = {
      view: interaction,
      operation: 'interaction',
      durationMs,
      threshold: this.thresholds.interactionMs,
      suggestion: this.buildPrimarySuggestion('interaction', interaction),
    };
    this.emit(event);
    return event;
  }

  // -----------------------------------------------------------------------
  // History
  // -----------------------------------------------------------------------

  /** All events that have been emitted since the instance was created. */
  getHistory(): readonly SlowPathEvent[] {
    return this.history;
  }

  clearHistory(): void {
    this.history = [];
  }

  // -----------------------------------------------------------------------
  // Subscribe / notify
  // -----------------------------------------------------------------------

  subscribe(cb: SlowPathSubscriber): () => void {
    this.subscribers.add(cb);
    return () => {
      this.subscribers.delete(cb);
    };
  }

  // -----------------------------------------------------------------------
  // Internal helpers
  // -----------------------------------------------------------------------

  private emit(event: SlowPathEvent): void {
    this.history.push(event);
    this.subscribers.forEach((cb) => cb(event));
  }

  private buildPrimarySuggestion(operation: SlowPathOperation, view: string): string {
    const specificKey = `${operation}:${view}`;
    const specific = SPECIFIC_SUGGESTIONS[specificKey];
    if (specific && specific.length > 0) {
      return specific[0];
    }
    const generic = GENERIC_SUGGESTIONS[operation];
    if (generic && generic.length > 0) {
      return generic[0];
    }
    return 'Profile this operation to identify the bottleneck';
  }
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

export interface UseSlowPathAlertsReturn {
  /** Most recent events (newest first), up to `maxEvents`. */
  events: readonly SlowPathEvent[];
  /** Manually clear all accumulated events. */
  clearEvents: () => void;
  /** Convenience: report a render timing. */
  reportRender: (view: string, durationMs: number) => void;
  /** Convenience: report a fetch timing. */
  reportFetch: (endpoint: string, durationMs: number) => void;
  /** Convenience: report an interaction timing. */
  reportInteraction: (interaction: string, durationMs: number) => void;
}

/**
 * Subscribe to the global {@link SlowPathDetector} and expose recent slow-path
 * events plus convenience reporters.
 *
 * @param maxEvents Maximum number of events to keep in state (default 50).
 */
export function useSlowPathAlerts(maxEvents = 50): UseSlowPathAlertsReturn {
  const detectorRef = useRef(SlowPathDetector.getInstance());
  const [events, setEvents] = useState<SlowPathEvent[]>([]);

  useEffect(() => {
    const unsubscribe = detectorRef.current.subscribe((event) => {
      setEvents((prev) => {
        const next = [event, ...prev];
        return next.length > maxEvents ? next.slice(0, maxEvents) : next;
      });
    });
    return unsubscribe;
  }, [maxEvents]);

  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  const reportRender = useCallback((view: string, durationMs: number) => {
    detectorRef.current.detectSlowRender(view, durationMs);
  }, []);

  const reportFetch = useCallback((endpoint: string, durationMs: number) => {
    detectorRef.current.detectSlowFetch(endpoint, durationMs);
  }, []);

  const reportInteraction = useCallback((interaction: string, durationMs: number) => {
    detectorRef.current.detectSlowInteraction(interaction, durationMs);
  }, []);

  return { events, clearEvents, reportRender, reportFetch, reportInteraction };
}
