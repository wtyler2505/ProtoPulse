/**
 * Build Status Manager
 *
 * Tracks firmware compilation/upload progress through discrete build phases.
 * Provides a singleton manager with subscribe pattern for React integration,
 * plus a convenience hook for components that need real-time build status.
 *
 * Usage:
 *   const manager = BuildStatusManager.getInstance();
 *   manager.startBuild('arduino:avr:uno', 'Blink.ino');
 *   manager.updateProgress('compiling', 45);
 *   manager.addOutput('Compiling sketch...');
 *
 * React hook:
 *   const { status, isBuilding, startBuild, addError } = useBuildStatus();
 */

import { useCallback, useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BuildPhase = 'compiling' | 'linking' | 'uploading' | 'verifying' | 'done' | 'error';

export interface BuildStatus {
  phase: BuildPhase;
  progress: number;
  startedAt: number | null;
  errors: string[];
  warnings: string[];
  output: string[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_OUTPUT_LINES = 5000;
const MAX_ERRORS = 500;
const MAX_WARNINGS = 500;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Format a duration in milliseconds into a human-readable string.
 * Returns 'Xms' for < 1s, 'X.Xs' for < 60s, 'Xm Ys' for >= 60s.
 */
export function formatBuildDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) {
    return '0ms';
  }

  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  }

  const totalSeconds = ms / 1000;

  if (totalSeconds < 60) {
    return `${totalSeconds.toFixed(1)}s`;
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.round(totalSeconds % 60);
  return `${minutes}m ${seconds}s`;
}

// ---------------------------------------------------------------------------
// Listener type
// ---------------------------------------------------------------------------

type Listener = () => void;

// ---------------------------------------------------------------------------
// BuildStatusManager
// ---------------------------------------------------------------------------

/**
 * Manages firmware build status across compilation, linking, upload, and
 * verification phases. Singleton per application. Notifies subscribers on
 * every state mutation.
 */
export class BuildStatusManager {
  private static instance: BuildStatusManager | null = null;

  private status: BuildStatus;
  private board: string;
  private sketch: string;
  private listeners = new Set<Listener>();

  constructor() {
    this.status = BuildStatusManager.createDefaultStatus();
    this.board = '';
    this.sketch = '';
  }

  /** Get or create the singleton instance. */
  static getInstance(): BuildStatusManager {
    if (!BuildStatusManager.instance) {
      BuildStatusManager.instance = new BuildStatusManager();
    }
    return BuildStatusManager.instance;
  }

  /** Reset the singleton (useful for testing). */
  static resetForTesting(): void {
    BuildStatusManager.instance = null;
  }

  /** Create a fresh default status object. */
  private static createDefaultStatus(): BuildStatus {
    return {
      phase: 'done',
      progress: 0,
      startedAt: null,
      errors: [],
      warnings: [],
      output: [],
    };
  }

  // -----------------------------------------------------------------------
  // Subscription
  // -----------------------------------------------------------------------

  /**
   * Subscribe to state changes. Returns an unsubscribe function.
   * Callback is invoked on any build status mutation.
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
  // Queries
  // -----------------------------------------------------------------------

  /** Get a snapshot of the current build status. */
  getBuildStatus(): Readonly<BuildStatus> {
    return { ...this.status };
  }

  /** Whether a build is currently in progress (not done and not error). */
  isBuilding(): boolean {
    return this.status.phase !== 'done' && this.status.phase !== 'error';
  }

  /** Get the board FQBN for the current/last build. */
  getBoard(): string {
    return this.board;
  }

  /** Get the sketch name for the current/last build. */
  getSketch(): string {
    return this.sketch;
  }

  // -----------------------------------------------------------------------
  // Mutations
  // -----------------------------------------------------------------------

  /**
   * Start a new build. Resets all status fields and sets phase to 'compiling'.
   * @param board - Board FQBN (e.g. 'arduino:avr:uno')
   * @param sketch - Sketch filename (e.g. 'Blink.ino')
   */
  startBuild(board: string, sketch: string): void {
    this.board = board;
    this.sketch = sketch;
    this.status = {
      phase: 'compiling',
      progress: 0,
      startedAt: Date.now(),
      errors: [],
      warnings: [],
      output: [],
    };
    this.notify();
  }

  /**
   * Update the current build phase and progress.
   * Progress is clamped to 0-100.
   * Phase transitions are validated: cannot go backwards, and cannot
   * update after 'done' or 'error' without starting a new build.
   */
  updateProgress(phase: BuildPhase, progress: number): void {
    if (this.status.phase === 'done' || this.status.phase === 'error') {
      return;
    }

    const phaseOrder: Record<BuildPhase, number> = {
      compiling: 0,
      linking: 1,
      uploading: 2,
      verifying: 3,
      done: 4,
      error: 5,
    };

    // Allow same phase (progress update) or forward transition
    if (phaseOrder[phase] < phaseOrder[this.status.phase]) {
      return;
    }

    this.status.phase = phase;
    this.status.progress = Math.max(0, Math.min(100, Math.round(progress)));
    this.notify();
  }

  /**
   * Add an error message to the build.
   * Automatically transitions to the 'error' phase.
   */
  addError(message: string): void {
    if (this.status.errors.length < MAX_ERRORS) {
      this.status.errors.push(message);
    }

    if (this.status.phase !== 'done') {
      this.status.phase = 'error';
    }

    this.notify();
  }

  /**
   * Add a warning message to the build.
   * Does not change the build phase.
   */
  addWarning(message: string): void {
    if (this.status.warnings.length < MAX_WARNINGS) {
      this.status.warnings.push(message);
    }
    this.notify();
  }

  /**
   * Add a line of build output (stdout/stderr).
   * Caps at MAX_OUTPUT_LINES to prevent unbounded memory growth.
   */
  addOutput(line: string): void {
    if (this.status.output.length < MAX_OUTPUT_LINES) {
      this.status.output.push(line);
    }
    this.notify();
  }

  /**
   * Reset the build status to its default idle state.
   * Useful for dismissing a completed or errored build.
   */
  reset(): void {
    this.status = BuildStatusManager.createDefaultStatus();
    this.board = '';
    this.sketch = '';
    this.notify();
  }
}

// ---------------------------------------------------------------------------
// React Hook
// ---------------------------------------------------------------------------

/**
 * Hook for accessing the build status in React components.
 * Subscribes to the BuildStatusManager singleton and triggers re-renders
 * on state changes.
 */
export function useBuildStatus(): {
  status: Readonly<BuildStatus>;
  isBuilding: boolean;
  board: string;
  sketch: string;
  startBuild: (board: string, sketch: string) => void;
  updateProgress: (phase: BuildPhase, progress: number) => void;
  addError: (message: string) => void;
  addWarning: (message: string) => void;
  addOutput: (line: string) => void;
  reset: () => void;
} {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const manager = BuildStatusManager.getInstance();
    const unsubscribe = manager.subscribe(() => {
      setTick((t) => t + 1);
    });
    return unsubscribe;
  }, []);

  const startBuild = useCallback((board: string, sketch: string) => {
    BuildStatusManager.getInstance().startBuild(board, sketch);
  }, []);

  const updateProgress = useCallback((phase: BuildPhase, progress: number) => {
    BuildStatusManager.getInstance().updateProgress(phase, progress);
  }, []);

  const addError = useCallback((message: string) => {
    BuildStatusManager.getInstance().addError(message);
  }, []);

  const addWarning = useCallback((message: string) => {
    BuildStatusManager.getInstance().addWarning(message);
  }, []);

  const addOutput = useCallback((line: string) => {
    BuildStatusManager.getInstance().addOutput(line);
  }, []);

  const resetBuild = useCallback(() => {
    BuildStatusManager.getInstance().reset();
  }, []);

  const manager = typeof window !== 'undefined' ? BuildStatusManager.getInstance() : null;

  return {
    status: manager?.getBuildStatus() ?? {
      phase: 'done' as const,
      progress: 0,
      startedAt: null,
      errors: [],
      warnings: [],
      output: [],
    },
    isBuilding: manager?.isBuilding() ?? false,
    board: manager?.getBoard() ?? '',
    sketch: manager?.getSketch() ?? '',
    startBuild,
    updateProgress,
    addError,
    addWarning,
    addOutput,
    reset: resetBuild,
  };
}
