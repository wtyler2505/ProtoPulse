/**
 * Export Results Manager
 *
 * Tracks export results (file names + sizes) using a singleton + subscribe
 * pattern. Renders a persistent panel so users can see what was exported
 * after toasts disappear.
 *
 * Usage:
 *   const mgr = ExportResultsManager.getInstance();
 *   mgr.addResult({ formatId: 'kicad', formatLabel: 'KiCad', files: [...], timestamp: Date.now(), success: true });
 *
 * React hook:
 *   const { results, totalFileCount, totalSize, ... } = useExportResults();
 */

import { useCallback, useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExportResultFile {
  /** File name (e.g. "project.kicad_sch"). */
  name: string;
  /** Size in bytes. */
  sizeBytes: number;
}

export interface ExportResult {
  /** Export format identifier (matches ExportFormat.id). */
  formatId: string;
  /** Human-readable format name. */
  formatLabel: string;
  /** Individual files produced by this export. */
  files: ExportResultFile[];
  /** Epoch ms when the export completed. */
  timestamp: number;
  /** Whether the export succeeded. */
  success: boolean;
}

type Listener = () => void;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_RESULTS = 50;

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

/**
 * Format a byte count into a human-readable string.
 * Returns "0 B" for zero, negative, or NaN values.
 */
export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    if (bytes === Infinity) {
      return 'Infinity GB';
    }
    return '0 B';
  }

  if (bytes < 1024) {
    return `${Math.round(bytes)} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(2)} KB`;
  }
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

// ---------------------------------------------------------------------------
// Manager
// ---------------------------------------------------------------------------

export class ExportResultsManager {
  private static instance: ExportResultsManager | null = null;

  private results: ExportResult[] = [];
  private listeners = new Set<Listener>();

  /** Get or create the singleton instance. */
  static getInstance(): ExportResultsManager {
    if (!ExportResultsManager.instance) {
      ExportResultsManager.instance = new ExportResultsManager();
    }
    return ExportResultsManager.instance;
  }

  /** Reset singleton — test-only. */
  static resetForTesting(): void {
    ExportResultsManager.instance = null;
  }

  // -----------------------------------------------------------------------
  // Subscribe
  // -----------------------------------------------------------------------

  /** Subscribe to state changes. Returns an unsubscribe function. */
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
  // Accessors
  // -----------------------------------------------------------------------

  /** Return all results (defensive copy). */
  getResults(): ExportResult[] {
    return this.results.map((r) => ({ ...r, files: r.files.map((f) => ({ ...f })) }));
  }

  /** Return the number of export results. */
  getResultCount(): number {
    return this.results.length;
  }

  /** Return the total number of individual files across all results. */
  getTotalFileCount(): number {
    return this.results.reduce((sum, r) => sum + r.files.length, 0);
  }

  /** Return the total size (bytes) of all files across all results. */
  getTotalSize(): number {
    return this.results.reduce(
      (sum, r) => sum + r.files.reduce((fSum, f) => fSum + f.sizeBytes, 0),
      0,
    );
  }

  /** Return the most recently added result, or undefined if empty. */
  getLatestResult(): ExportResult | undefined {
    if (this.results.length === 0) {
      return undefined;
    }
    const r = this.results[this.results.length - 1];
    return { ...r, files: r.files.map((f) => ({ ...f })) };
  }

  // -----------------------------------------------------------------------
  // Mutations
  // -----------------------------------------------------------------------

  /** Add an export result. Evicts oldest entries when exceeding MAX_RESULTS. */
  addResult(result: ExportResult): void {
    this.results.push({
      ...result,
      files: result.files.map((f) => ({ ...f })),
    });

    // FIFO eviction
    while (this.results.length > MAX_RESULTS) {
      this.results.shift();
    }

    this.notify();
  }

  /** Remove a result by index. No-op if index is out of range. */
  removeResult(index: number): void {
    if (index < 0 || index >= this.results.length) {
      return;
    }
    this.results.splice(index, 1);
    this.notify();
  }

  /** Clear all results. */
  clearResults(): void {
    this.results = [];
    this.notify();
  }
}

// ---------------------------------------------------------------------------
// React Hook
// ---------------------------------------------------------------------------

export function useExportResults() {
  const [tick, setTick] = useState(0);
  void tick; // suppress unused warning

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const mgr = ExportResultsManager.getInstance();
    const unsubscribe = mgr.subscribe(() => {
      setTick((t) => t + 1);
    });
    return unsubscribe;
  }, []);

  const addResult = useCallback((result: ExportResult) => {
    ExportResultsManager.getInstance().addResult(result);
  }, []);

  const removeResult = useCallback((index: number) => {
    ExportResultsManager.getInstance().removeResult(index);
  }, []);

  const clearResults = useCallback(() => {
    ExportResultsManager.getInstance().clearResults();
  }, []);

  const mgr = typeof window !== 'undefined' ? ExportResultsManager.getInstance() : null;

  return {
    results: mgr?.getResults() ?? [],
    resultCount: mgr?.getResultCount() ?? 0,
    totalFileCount: mgr?.getTotalFileCount() ?? 0,
    totalSize: mgr?.getTotalSize() ?? 0,
    latestResult: mgr?.getLatestResult(),
    addResult,
    removeResult,
    clearResults,
  };
}
