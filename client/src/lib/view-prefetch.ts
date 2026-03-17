/**
 * View Prefetch Manager — context-aware lazy-chunk prefetching.
 *
 * Unlike the static prefetch queue in ProjectWorkspace (which fires all chunks
 * sequentially on mount), this module observes the *active* view and
 * prefetches only the most-likely-next views after the user has been idle for
 * a configurable threshold. Navigation cancels any in-flight prefetch work so
 * we never compete with the chunk the user actually requested.
 *
 * Singleton + subscribe pattern (consistent with FavoritesManager, KanbanStore, etc.).
 */

import { useEffect, useRef } from 'react';
import type { ViewMode } from '@/lib/project-context';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface ViewPrefetchConfig {
  /** Milliseconds of user inactivity before prefetching starts. */
  idleThresholdMs: number;
  /** Maximum number of views to prefetch per idle session. */
  maxPrefetch: number;
}

export const DEFAULT_PREFETCH_CONFIG: Readonly<ViewPrefetchConfig> = {
  idleThresholdMs: 2000,
  maxPrefetch: 3,
};

// ---------------------------------------------------------------------------
// Priority map — higher = more likely to be navigated to next
// ---------------------------------------------------------------------------

/**
 * For every source view, maps destination views to a numeric priority.
 * Higher numbers are prefetched first. Views not listed get priority 0
 * (i.e. not prefetched context-awarely — the static queue handles those).
 */
export const PREFETCH_PRIORITIES: Record<string, Record<string, number>> = {
  dashboard: {
    architecture: 10,
    schematic: 6,
    procurement: 4,
  },
  architecture: {
    schematic: 10,
    component_editor: 7,
    validation: 5,
  },
  schematic: {
    pcb: 10,
    breadboard: 7,
    simulation: 6,
    architecture: 4,
  },
  breadboard: {
    schematic: 8,
    pcb: 7,
    simulation: 5,
  },
  pcb: {
    validation: 10,
    viewer_3d: 7,
    ordering: 6,
    schematic: 4,
  },
  validation: {
    pcb: 8,
    schematic: 6,
    procurement: 5,
  },
  procurement: {
    validation: 7,
    ordering: 6,
    pcb: 5,
  },
  simulation: {
    schematic: 8,
    pcb: 6,
    validation: 5,
  },
  component_editor: {
    schematic: 8,
    architecture: 6,
    procurement: 4,
  },
  circuit_code: {
    schematic: 8,
    simulation: 6,
    pcb: 5,
  },
  generative_design: {
    schematic: 7,
    simulation: 6,
    pcb: 5,
  },
  ordering: {
    pcb: 8,
    procurement: 6,
    validation: 5,
  },
  viewer_3d: {
    pcb: 8,
    ordering: 6,
  },
  digital_twin: {
    serial_monitor: 7,
    schematic: 5,
  },
  serial_monitor: {
    digital_twin: 6,
    arduino: 5,
  },
  arduino: {
    serial_monitor: 7,
    schematic: 5,
  },
  design_history: {
    architecture: 6,
    schematic: 5,
  },
  starter_circuits: {
    schematic: 8,
    breadboard: 6,
  },
  labs: {
    schematic: 6,
    simulation: 5,
  },
};

// ---------------------------------------------------------------------------
// Chunk loader registry — maps ViewMode → dynamic import thunk.
// This is the single source of truth for which modules back each view.
// ---------------------------------------------------------------------------

const VIEW_LOADERS: Partial<Record<ViewMode, () => Promise<unknown>>> = {
  dashboard: () => import('@/components/views/DashboardView'),
  architecture: () => import('@/components/views/ArchitectureView'),
  schematic: () => import('@/components/views/SchematicView'),
  breadboard: () => import('@/components/circuit-editor/BreadboardView'),
  pcb: () => import('@/components/circuit-editor/PCBLayoutView'),
  component_editor: () => import('@/components/views/ComponentEditorView'),
  procurement: () => import('@/components/views/ProcurementView'),
  validation: () => import('@/components/views/ValidationView'),
  simulation: () => import('@/components/simulation/SimulationPanel'),
  output: () => import('@/components/views/OutputView'),
  design_history: () => import('@/components/views/DesignHistoryView'),
  lifecycle: () => import('@/components/views/LifecycleDashboard'),
  calculators: () => import('@/components/views/CalculatorsView'),
  design_patterns: () => import('@/components/views/DesignPatternsView'),
  storage: () => import('@/components/views/StorageManagerPanel'),
  kanban: () => import('@/components/views/KanbanView'),
  knowledge: () => import('@/components/views/KnowledgeView'),
  viewer_3d: () => import('@/components/views/BoardViewer3DView'),
  community: () => import('@/components/views/CommunityView'),
  ordering: () => import('@/components/views/PcbOrderingView'),
  serial_monitor: () => import('@/components/panels/SerialMonitorPanel'),
  circuit_code: () => import('@/components/views/CircuitCodeView'),
  generative_design: () => import('@/components/views/GenerativeDesignView'),
  digital_twin: () => import('@/components/views/DigitalTwinView'),
  arduino: () => import('@/components/views/ArduinoWorkbenchView'),
  starter_circuits: () => import('@/components/views/StarterCircuitsPanel'),
  audit_trail: () => import('@/components/views/AuditTrailView'),
  labs: () => import('@/components/panels/LabTemplatePanel'),
  comments: () => import('@/components/panels/CommentsPanel'),
};

// ---------------------------------------------------------------------------
// ViewPrefetchManager — singleton + subscribe
// ---------------------------------------------------------------------------

export type PrefetchListener = () => void;

export interface PrefetchState {
  /** Set of ViewMode strings that have been prefetched (or are currently loading). */
  prefetched: ReadonlySet<ViewMode>;
  /** Whether a prefetch session is currently in progress. */
  active: boolean;
}

export class ViewPrefetchManager {
  private static instance: ViewPrefetchManager | null = null;

  private config: ViewPrefetchConfig;
  private prefetchedSet = new Set<ViewMode>();
  private listeners = new Set<PrefetchListener>();
  private idleTimerId: ReturnType<typeof setTimeout> | null = null;
  private abortController: AbortController | null = null;
  private active = false;
  private currentView: ViewMode | null = null;

  private constructor(config?: Partial<ViewPrefetchConfig>) {
    this.config = { ...DEFAULT_PREFETCH_CONFIG, ...config };
  }

  static getInstance(config?: Partial<ViewPrefetchConfig>): ViewPrefetchManager {
    if (!ViewPrefetchManager.instance) {
      ViewPrefetchManager.instance = new ViewPrefetchManager(config);
    }
    return ViewPrefetchManager.instance;
  }

  static resetInstance(): void {
    if (ViewPrefetchManager.instance) {
      ViewPrefetchManager.instance.destroy();
    }
    ViewPrefetchManager.instance = null;
  }

  // -------------------------------------------------------------------------
  // Subscribe / notify
  // -------------------------------------------------------------------------

  subscribe(listener: PrefetchListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    Array.from(this.listeners).forEach((listener) => {
      listener();
    });
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  getState(): PrefetchState {
    return {
      prefetched: this.prefetchedSet,
      active: this.active,
    };
  }

  getConfig(): Readonly<ViewPrefetchConfig> {
    return this.config;
  }

  /**
   * Called when the active view changes. Cancels any in-flight prefetch
   * session and schedules a new one after the idle threshold.
   */
  setActiveView(view: ViewMode): void {
    this.currentView = view;

    // Mark the navigated-to view as "prefetched" (it's loaded now).
    this.prefetchedSet.add(view);

    // Cancel in-flight prefetch.
    this.cancelPrefetch();

    // Schedule new idle prefetch.
    this.scheduleIdlePrefetch();
  }

  /**
   * Cancel any pending or in-flight prefetch work.
   */
  cancelPrefetch(): void {
    if (this.idleTimerId !== null) {
      clearTimeout(this.idleTimerId);
      this.idleTimerId = null;
    }
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    if (this.active) {
      this.active = false;
      this.notify();
    }
  }

  /**
   * Returns the ordered list of views that would be prefetched for the given
   * source view, excluding already-prefetched views. Exposed for testing.
   */
  getPrefetchCandidates(sourceView: ViewMode): ViewMode[] {
    const priorityMap = PREFETCH_PRIORITIES[sourceView];
    if (!priorityMap) {
      return [];
    }

    const candidates: Array<{ view: ViewMode; priority: number }> = [];
    for (const [view, priority] of Object.entries(priorityMap)) {
      const viewMode = view as ViewMode;
      if (!this.prefetchedSet.has(viewMode) && VIEW_LOADERS[viewMode]) {
        candidates.push({ view: viewMode, priority });
      }
    }

    // Sort descending by priority.
    candidates.sort((a, b) => b.priority - a.priority);

    return candidates.slice(0, this.config.maxPrefetch).map((c) => c.view);
  }

  /**
   * Immediately prefetch a specific view. Useful for hover-based hints.
   * Returns true if a prefetch was initiated, false if already done or no loader exists.
   */
  prefetchView(view: ViewMode): boolean {
    if (this.prefetchedSet.has(view)) {
      return false;
    }
    const loader = VIEW_LOADERS[view];
    if (!loader) {
      return false;
    }
    this.prefetchedSet.add(view);
    loader().catch(() => {
      // Chunk load failure is non-fatal — remove from set so retry is possible.
      this.prefetchedSet.delete(view);
    });
    this.notify();
    return true;
  }

  /**
   * Clean up all timers and abort controllers.
   */
  destroy(): void {
    this.cancelPrefetch();
    this.listeners.clear();
    this.prefetchedSet.clear();
    this.currentView = null;
  }

  // -------------------------------------------------------------------------
  // Internal
  // -------------------------------------------------------------------------

  private scheduleIdlePrefetch(): void {
    this.idleTimerId = setTimeout(() => {
      this.idleTimerId = null;
      void this.runPrefetchSession();
    }, this.config.idleThresholdMs);
  }

  private async runPrefetchSession(): Promise<void> {
    if (!this.currentView) {
      return;
    }

    const candidates = this.getPrefetchCandidates(this.currentView);
    if (candidates.length === 0) {
      return;
    }

    this.abortController = new AbortController();
    const { signal } = this.abortController;

    this.active = true;
    this.notify();

    for (const view of candidates) {
      if (signal.aborted) {
        break;
      }

      const loader = VIEW_LOADERS[view];
      if (!loader) {
        continue;
      }

      this.prefetchedSet.add(view);
      this.notify();

      try {
        await loader();
      } catch {
        // Chunk load failure is non-fatal — remove from set so retry is possible.
        this.prefetchedSet.delete(view);
      }

      // Yield to main thread between chunks.
      if (!signal.aborted) {
        await new Promise<void>((resolve) => {
          if (typeof requestIdleCallback === 'function') {
            requestIdleCallback(() => { resolve(); });
          } else {
            setTimeout(resolve, 50);
          }
        });
      }
    }

    this.active = false;
    this.abortController = null;
    this.notify();
  }
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

/**
 * Hook that drives the ViewPrefetchManager from the active view.
 *
 * Usage:
 * ```tsx
 * function WorkspaceContent({ activeView }: { activeView: ViewMode }) {
 *   usePrefetch(activeView);
 *   // ...
 * }
 * ```
 */
export function usePrefetch(
  activeView: ViewMode,
  config?: Partial<ViewPrefetchConfig>,
): PrefetchState {
  const managerRef = useRef<ViewPrefetchManager | null>(null);

  // Lazily initialize — avoid calling getInstance on every render.
  if (!managerRef.current) {
    managerRef.current = ViewPrefetchManager.getInstance(config);
  }
  const manager = managerRef.current;

  // Track active view changes.
  useEffect(() => {
    manager.setActiveView(activeView);
  }, [activeView, manager]);

  // Subscribe for state updates (trigger re-render on prefetch progress).
  // We use a simple counter to force re-render without storing the full state.
  const stateRef = useRef<PrefetchState>(manager.getState());

  useEffect(() => {
    const unsubscribe = manager.subscribe(() => {
      stateRef.current = manager.getState();
    });
    return unsubscribe;
  }, [manager]);

  // Cancel on unmount.
  useEffect(() => {
    return () => {
      manager.cancelPrefetch();
    };
  }, [manager]);

  return manager.getState();
}

// Re-export VIEW_LOADERS keys for testing.
export function getRegisteredViews(): ViewMode[] {
  return Object.keys(VIEW_LOADERS) as ViewMode[];
}
