/**
 * View Onboarding Manager
 *
 * Tracks per-view visit counts and provides contextual onboarding hints
 * for the first N visits to each view. After the threshold is reached,
 * hints are permanently dismissed for that view.
 *
 * Uses localStorage for persistence and a singleton+subscribe pattern
 * for React integration.
 *
 * Usage:
 *   const manager = ViewOnboardingManager.getInstance();
 *   manager.markVisited('architecture');
 *   manager.shouldShowHint('architecture'); // true if < MAX_VISITS
 *
 * React hook:
 *   const { hint, dismiss } = useViewOnboarding('architecture');
 */

import { useCallback, useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ViewHintContent {
  /** Short title for the hint banner. */
  title: string;
  /** Longer description of what the user can do in this view. */
  description: string;
}

export interface OnboardingState {
  /** Map of viewName -> number of visits recorded. */
  visitCounts: Record<string, number>;
  /** Set of view names the user has explicitly dismissed (never show again). */
  dismissed: string[];
}

type Listener = () => void;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum number of visits before hints stop showing automatically. */
export const MAX_HINT_VISITS = 3;

const STORAGE_KEY = 'protopulse:view-onboarding';

// ---------------------------------------------------------------------------
// Hint content per view
// ---------------------------------------------------------------------------

export const VIEW_HINTS: Record<string, ViewHintContent> = {
  dashboard: {
    title: 'Welcome to the Dashboard',
    description: 'Get an overview of your project status, recent activity, and quick access to all tools.',
  },
  architecture: {
    title: 'Architecture Block Diagrams',
    description: 'Drag blocks to design your system architecture. Connect components to define signal flow and data paths.',
  },
  component_editor: {
    title: 'Component Editor',
    description: 'Create and edit custom component symbols with configurable pins, shapes, and properties.',
  },
  schematic: {
    title: 'Schematic Editor',
    description: 'Place components, draw wires, and define your circuit connections. Use the component library on the left to get started.',
  },
  breadboard: {
    title: 'Breadboard View',
    description: 'Visualize your circuit on a virtual breadboard. Drag components into place and connect them with wires.',
  },
  pcb: {
    title: 'PCB Layout',
    description: 'Arrange component footprints and route copper traces. Run DRC checks to verify your board design.',
  },
  procurement: {
    title: 'Bill of Materials',
    description: 'Manage your parts list, check supplier pricing, and track component availability.',
  },
  validation: {
    title: 'Design Validation',
    description: 'Run design rule checks (DRC) and electrical rule checks (ERC) to catch errors before manufacturing.',
  },
  simulation: {
    title: 'Circuit Simulation',
    description: 'Run DC, AC, and transient simulations to verify your circuit behavior before building hardware.',
  },
  output: {
    title: 'Export Center',
    description: 'Export your design in multiple formats: KiCad, Eagle, Gerber, BOM, SPICE, and more.',
  },
  design_history: {
    title: 'Design History',
    description: 'Track changes to your project over time. Compare snapshots and restore previous versions.',
  },
  lifecycle: {
    title: 'Component Lifecycle',
    description: 'Monitor the lifecycle status of your components — active, NRND, obsolete — and find replacements.',
  },
  calculators: {
    title: 'Engineering Calculators',
    description: 'Handy tools for resistor dividers, capacitor charging, Ohm\'s law, PCB trace width, and more.',
  },
  design_patterns: {
    title: 'Design Pattern Library',
    description: 'Browse and apply proven circuit design patterns. Save your own patterns for reuse across projects.',
  },
  storage: {
    title: 'Inventory Manager',
    description: 'Track your physical component inventory, scan barcodes, and get low-stock alerts.',
  },
  kanban: {
    title: 'Project Board',
    description: 'Organize your tasks and track progress with a drag-and-drop Kanban board.',
  },
  knowledge: {
    title: 'Electronics Knowledge Hub',
    description: 'Browse articles and reference material to learn electronics concepts as you build.',
  },
  viewer_3d: {
    title: '3D Board Viewer',
    description: 'Preview your PCB in 3D. Rotate, zoom, and inspect component placement from any angle.',
  },
  community: {
    title: 'Community Library',
    description: 'Discover and share components, footprints, and design blocks with the ProtoPulse community.',
  },
  ordering: {
    title: 'PCB Ordering',
    description: 'Configure your PCB specifications, run DFM checks, and order boards directly from fab houses.',
  },
  serial_monitor: {
    title: 'Serial Monitor',
    description: 'Communicate with your microcontroller over USB serial. Send commands and view responses in real time.',
  },
  circuit_code: {
    title: 'Circuit as Code',
    description: 'Define circuits programmatically using a TypeScript-based DSL. Great for parametric and reusable designs.',
  },
  generative_design: {
    title: 'Generative Design',
    description: 'Let AI explore the design space. Define constraints and objectives, then evaluate generated candidates.',
  },
  digital_twin: {
    title: 'Digital Twin',
    description: 'Connect your physical hardware to a live digital model. Compare real telemetry against simulation.',
  },
  arduino: {
    title: 'Arduino Workbench',
    description: 'Write, compile, and upload Arduino sketches. Integrated with board detection and serial output.',
  },
  starter_circuits: {
    title: 'Starter Circuits',
    description: 'Begin with a pre-built circuit to learn the basics. Each starter includes step-by-step guidance.',
  },
  audit_trail: {
    title: 'Audit Trail',
    description: 'Review a detailed log of all project actions — who changed what, and when.',
  },
  labs: {
    title: 'Experimental Labs',
    description: 'Try out cutting-edge features and experiments. These may change or be removed in future updates.',
  },
  comments: {
    title: 'Design Comments',
    description: 'Leave and review comments on your design. Great for collaboration and tracking design decisions.',
  },
};

// ---------------------------------------------------------------------------
// Manager (singleton + subscribe)
// ---------------------------------------------------------------------------

export class ViewOnboardingManager {
  private static instance: ViewOnboardingManager | null = null;
  private state: OnboardingState;
  private listeners: Set<Listener> = new Set();

  private constructor() {
    this.state = ViewOnboardingManager.loadState();
  }

  static getInstance(): ViewOnboardingManager {
    if (!ViewOnboardingManager.instance) {
      ViewOnboardingManager.instance = new ViewOnboardingManager();
    }
    return ViewOnboardingManager.instance;
  }

  /** Reset singleton — for testing only. */
  static resetInstance(): void {
    ViewOnboardingManager.instance = null;
  }

  // -------------------------------------------------------------------------
  // Persistence
  // -------------------------------------------------------------------------

  private static loadState(): OnboardingState {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (
          parsed &&
          typeof parsed === 'object' &&
          'visitCounts' in parsed &&
          'dismissed' in parsed
        ) {
          const p = parsed as OnboardingState;
          return {
            visitCounts: p.visitCounts && typeof p.visitCounts === 'object' ? p.visitCounts : {},
            dismissed: Array.isArray(p.dismissed) ? p.dismissed : [],
          };
        }
      }
    } catch {
      // Corrupted storage — start fresh
    }
    return { visitCounts: {}, dismissed: [] };
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch {
      // Storage full or unavailable — hints are non-critical
    }
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /** Subscribe to state changes. Returns unsubscribe function. */
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Get the current visit count for a view. */
  getVisitCount(viewName: string): number {
    return this.state.visitCounts[viewName] ?? 0;
  }

  /** Whether the onboarding hint should be shown for a view. */
  shouldShowHint(viewName: string): boolean {
    if (!(viewName in VIEW_HINTS)) {
      return false;
    }
    if (this.state.dismissed.includes(viewName)) {
      return false;
    }
    const count = this.getVisitCount(viewName);
    return count < MAX_HINT_VISITS;
  }

  /** Get the hint content for a view, or null if no hint defined. */
  getHintContent(viewName: string): ViewHintContent | null {
    return VIEW_HINTS[viewName] ?? null;
  }

  /**
   * Record a visit to a view. Increments the visit counter.
   * Should be called each time the user navigates to a view.
   */
  markVisited(viewName: string): void {
    const current = this.state.visitCounts[viewName] ?? 0;
    // Only increment up to MAX_HINT_VISITS to avoid unbounded growth
    if (current < MAX_HINT_VISITS) {
      this.state.visitCounts[viewName] = current + 1;
      this.persist();
      this.notify();
    }
  }

  /**
   * Permanently dismiss the hint for a view.
   * The hint will never show again regardless of visit count.
   */
  dismiss(viewName: string): void {
    if (!this.state.dismissed.includes(viewName)) {
      this.state.dismissed.push(viewName);
      this.persist();
      this.notify();
    }
  }

  /** Check if a view has been explicitly dismissed. */
  isDismissed(viewName: string): boolean {
    return this.state.dismissed.includes(viewName);
  }

  /** Get a snapshot of the full state (for testing / debugging). */
  getState(): Readonly<OnboardingState> {
    return this.state;
  }

  /** Reset all onboarding state. */
  reset(): void {
    this.state = { visitCounts: {}, dismissed: [] };
    this.persist();
    this.notify();
  }
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

export interface UseViewOnboardingResult {
  /** Whether the hint should be shown for this view right now. */
  visible: boolean;
  /** The hint content, or null if no hint is defined for this view. */
  hint: ViewHintContent | null;
  /** Dismiss the hint permanently for this view. */
  dismiss: () => void;
  /** Current visit count for this view. */
  visitCount: number;
}

/**
 * React hook for view onboarding hints.
 *
 * Automatically records a visit when the hook mounts (i.e., when the view
 * becomes active). Returns hint content and dismiss function.
 */
export function useViewOnboarding(viewName: string): UseViewOnboardingResult {
  const manager = ViewOnboardingManager.getInstance();
  const [, forceUpdate] = useState(0);

  // Subscribe to manager changes
  useEffect(() => {
    return manager.subscribe(() => {
      forceUpdate((n) => n + 1);
    });
  }, [manager]);

  // Record a visit when the view becomes active
  useEffect(() => {
    manager.markVisited(viewName);
  }, [viewName, manager]);

  const dismiss = useCallback(() => {
    manager.dismiss(viewName);
  }, [viewName, manager]);

  return {
    visible: manager.shouldShowHint(viewName),
    hint: manager.getHintContent(viewName),
    dismiss,
    visitCount: manager.getVisitCount(viewName),
  };
}
