/**
 * Mobile Review Mode
 *
 * Provides a compact, mobile-friendly review experience that aggregates
 * comments, validation issues, and DRC violations into a unified, priority-sorted
 * list. Persists config to localStorage (singleton+subscribe pattern).
 *
 * Usage:
 *   const manager = MobileReviewManager.getInstance();
 *   manager.updateConfig({ showComments: false });
 *
 * React hook:
 *   const { config, updateConfig, toggleConfig } = useReviewMode();
 *
 * Aggregation:
 *   const items = getReviewableItems(project);
 *   const progress = getReviewProgress(items);
 */

import { useCallback, useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReviewModeConfig {
  showComments: boolean;
  showValidation: boolean;
  showDrc: boolean;
  compactLayout: boolean;
}

/** Severity levels shared across all reviewable sources. */
export type ReviewSeverity = 'error' | 'warning' | 'info';

/** Source system that originated the review item. */
export type ReviewSource = 'comment' | 'validation' | 'drc';

/** Unified review item aggregated from comments, validations, and DRC results. */
export interface ReviewItem {
  id: string;
  source: ReviewSource;
  severity: ReviewSeverity;
  title: string;
  description: string;
  resolved: boolean;
  targetId?: string;
  timestamp: number;
}

/** Progress summary for a set of review items. */
export interface ReviewProgress {
  total: number;
  resolved: number;
  pending: number;
  percentComplete: number;
  bySeverity: Record<ReviewSeverity, { total: number; resolved: number }>;
  bySource: Record<ReviewSource, { total: number; resolved: number }>;
}

// ---------------------------------------------------------------------------
// Input types for getReviewableItems
// ---------------------------------------------------------------------------

/** A comment from the design_comments table (minimal shape). */
export interface ProjectComment {
  id: number | string;
  content: string;
  targetType?: string;
  targetId?: string;
  status?: string;
  createdAt?: string | Date;
}

/** A validation issue from the validation_issues table (minimal shape). */
export interface ProjectValidationIssue {
  id: number | string;
  severity: string;
  message: string;
  componentId?: string | null;
  suggestion?: string | null;
}

/** A DRC violation (component-level or PCB-level, minimal shape). */
export interface ProjectDrcViolation {
  id: string;
  ruleType?: string;
  severity: string;
  message: string;
  shapeIds?: string[];
  nodeIds?: string[];
  suggestion?: string;
}

/** Project data bundle consumed by getReviewableItems. */
export interface ReviewableProject {
  comments?: ProjectComment[];
  validationIssues?: ProjectValidationIssue[];
  drcViolations?: ProjectDrcViolation[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'protopulse-mobile-review-config';

const DEFAULT_CONFIG: ReviewModeConfig = {
  showComments: true,
  showValidation: true,
  showDrc: true,
  compactLayout: false,
};

/** Severity ordering for priority sort (lower = higher priority). */
const SEVERITY_ORDER: Record<string, number> = {
  error: 0,
  warning: 1,
  info: 2,
};

// ---------------------------------------------------------------------------
// MobileReviewManager
// ---------------------------------------------------------------------------

/**
 * Manages review mode configuration with localStorage persistence.
 * Singleton per application. Notifies subscribers on state changes.
 */
export class MobileReviewManager {
  private static instance: MobileReviewManager | null = null;

  private config: ReviewModeConfig;
  private subscribers: Set<() => void>;

  constructor() {
    this.config = { ...DEFAULT_CONFIG };
    this.subscribers = new Set();
    this.load();
  }

  /** Get or create the singleton instance. */
  static getInstance(): MobileReviewManager {
    if (!MobileReviewManager.instance) {
      MobileReviewManager.instance = new MobileReviewManager();
    }
    return MobileReviewManager.instance;
  }

  /** Reset the singleton (useful for testing). */
  static resetInstance(): void {
    MobileReviewManager.instance = null;
  }

  // -----------------------------------------------------------------------
  // Queries
  // -----------------------------------------------------------------------

  /** Get the current config. Returns a copy to prevent external mutation. */
  getConfig(): ReviewModeConfig {
    return { ...this.config };
  }

  /** Check whether a specific config flag is enabled. */
  isEnabled(key: keyof ReviewModeConfig): boolean {
    return this.config[key];
  }

  // -----------------------------------------------------------------------
  // Mutations
  // -----------------------------------------------------------------------

  /**
   * Merge partial config values into the current config.
   * Only changed keys trigger a save + notify cycle.
   */
  updateConfig(partial: Partial<ReviewModeConfig>): void {
    let changed = false;
    for (const key of Object.keys(partial) as Array<keyof ReviewModeConfig>) {
      if (partial[key] !== undefined && partial[key] !== this.config[key]) {
        (this.config as Record<keyof ReviewModeConfig, boolean>)[key] = partial[key] as boolean;
        changed = true;
      }
    }
    if (changed) {
      this.save();
      this.notify();
    }
  }

  /** Toggle a single boolean config field. */
  toggleConfig(key: keyof ReviewModeConfig): void {
    this.config[key] = !this.config[key];
    this.save();
    this.notify();
  }

  /** Reset all config values to defaults. */
  resetConfig(): void {
    const isDefault =
      this.config.showComments === DEFAULT_CONFIG.showComments &&
      this.config.showValidation === DEFAULT_CONFIG.showValidation &&
      this.config.showDrc === DEFAULT_CONFIG.showDrc &&
      this.config.compactLayout === DEFAULT_CONFIG.compactLayout;

    if (isDefault) {
      return;
    }

    this.config = { ...DEFAULT_CONFIG };
    this.save();
    this.notify();
  }

  // -----------------------------------------------------------------------
  // Subscription
  // -----------------------------------------------------------------------

  /**
   * Subscribe to config changes. Returns an unsubscribe function.
   * Callback is invoked whenever config is updated/toggled/reset.
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

  /** Persist config to localStorage. */
  private save(): void {
    try {
      if (typeof window === 'undefined') {
        return;
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.config));
    } catch {
      // localStorage may be unavailable or quota exceeded
    }
  }

  /** Load config from localStorage. */
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
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        return;
      }
      const obj = parsed as Record<string, unknown>;
      // Only apply valid boolean fields — ignore unknown keys
      if (typeof obj.showComments === 'boolean') {
        this.config.showComments = obj.showComments;
      }
      if (typeof obj.showValidation === 'boolean') {
        this.config.showValidation = obj.showValidation;
      }
      if (typeof obj.showDrc === 'boolean') {
        this.config.showDrc = obj.showDrc;
      }
      if (typeof obj.compactLayout === 'boolean') {
        this.config.compactLayout = obj.compactLayout;
      }
    } catch {
      // Corrupt data — keep defaults
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
// Pure functions — item aggregation and progress
// ---------------------------------------------------------------------------

/** Normalize a severity string to our union type, defaulting to 'info'. */
function normalizeSeverity(s: string): ReviewSeverity {
  const lower = s.toLowerCase();
  if (lower === 'error') {
    return 'error';
  }
  if (lower === 'warning') {
    return 'warning';
  }
  return 'info';
}

/** Parse a date-like value to epoch millis, fallback to 0. */
function toTimestamp(value: string | Date | null | undefined): number {
  if (!value) {
    return 0;
  }
  const d = value instanceof Date ? value : new Date(value);
  return isNaN(d.getTime()) ? 0 : d.getTime();
}

/**
 * Aggregate comments, validation issues, and DRC violations into a unified
 * ReviewItem list sorted by priority (severity descending, then newest first).
 *
 * The optional `config` parameter filters sources — items whose source category
 * is disabled in the config are excluded.
 */
export function getReviewableItems(
  project: ReviewableProject,
  config?: ReviewModeConfig,
): ReviewItem[] {
  const items: ReviewItem[] = [];

  // --- Comments ---
  if (!config || config.showComments) {
    for (const c of project.comments ?? []) {
      items.push({
        id: `comment-${String(c.id)}`,
        source: 'comment',
        severity: 'info',
        title: truncate(c.content, 80),
        description: c.content,
        resolved: c.status !== 'open',
        targetId: c.targetId,
        timestamp: toTimestamp(c.createdAt),
      });
    }
  }

  // --- Validation issues ---
  if (!config || config.showValidation) {
    for (const v of project.validationIssues ?? []) {
      items.push({
        id: `validation-${String(v.id)}`,
        source: 'validation',
        severity: normalizeSeverity(v.severity),
        title: truncate(v.message, 80),
        description: v.suggestion ? `${v.message} — ${v.suggestion}` : v.message,
        resolved: false,
        targetId: v.componentId ?? undefined,
        timestamp: 0, // Validation issues have no timestamp
      });
    }
  }

  // --- DRC violations ---
  if (!config || config.showDrc) {
    for (const d of project.drcViolations ?? []) {
      const targetIds = d.shapeIds ?? d.nodeIds ?? [];
      items.push({
        id: `drc-${d.id}`,
        source: 'drc',
        severity: normalizeSeverity(d.severity),
        title: d.ruleType ? `[${d.ruleType}] ${truncate(d.message, 60)}` : truncate(d.message, 80),
        description: d.suggestion ? `${d.message} — ${d.suggestion}` : d.message,
        resolved: false,
        targetId: targetIds[0],
        timestamp: 0,
      });
    }
  }

  // Sort: severity (error > warning > info), then newest first, then by id for stability
  items.sort((a, b) => {
    const sevDiff = (SEVERITY_ORDER[a.severity] ?? 2) - (SEVERITY_ORDER[b.severity] ?? 2);
    if (sevDiff !== 0) {
      return sevDiff;
    }
    const timeDiff = b.timestamp - a.timestamp;
    if (timeDiff !== 0) {
      return timeDiff;
    }
    return a.id.localeCompare(b.id);
  });

  return items;
}

/**
 * Compute review progress from a set of review items.
 * Returns totals, resolved counts, percent complete, and breakdowns by severity and source.
 */
export function getReviewProgress(items: ReviewItem[]): ReviewProgress {
  const bySeverity: Record<ReviewSeverity, { total: number; resolved: number }> = {
    error: { total: 0, resolved: 0 },
    warning: { total: 0, resolved: 0 },
    info: { total: 0, resolved: 0 },
  };

  const bySource: Record<ReviewSource, { total: number; resolved: number }> = {
    comment: { total: 0, resolved: 0 },
    validation: { total: 0, resolved: 0 },
    drc: { total: 0, resolved: 0 },
  };

  let resolved = 0;

  for (const item of items) {
    bySeverity[item.severity].total++;
    bySource[item.source].total++;
    if (item.resolved) {
      resolved++;
      bySeverity[item.severity].resolved++;
      bySource[item.source].resolved++;
    }
  }

  const total = items.length;
  const pending = total - resolved;
  const percentComplete = total === 0 ? 100 : Math.round((resolved / total) * 100);

  return { total, resolved, pending, percentComplete, bySeverity, bySource };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Truncate a string to `max` characters, appending ellipsis if needed. */
function truncate(str: string, max: number): string {
  if (str.length <= max) {
    return str;
  }
  return str.slice(0, max - 1) + '\u2026';
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

/**
 * Hook for accessing mobile review mode configuration in React components.
 * Subscribes to the MobileReviewManager and triggers re-renders on config changes.
 * Safe for SSR (checks typeof window).
 */
export function useReviewMode(): {
  config: ReviewModeConfig;
  updateConfig: (partial: Partial<ReviewModeConfig>) => void;
  toggleConfig: (key: keyof ReviewModeConfig) => void;
  resetConfig: () => void;
  isEnabled: (key: keyof ReviewModeConfig) => boolean;
} {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const manager = MobileReviewManager.getInstance();
    const unsubscribe = manager.subscribe(() => {
      setTick((t) => t + 1);
    });
    return unsubscribe;
  }, []);

  const updateConfig = useCallback((partial: Partial<ReviewModeConfig>) => {
    MobileReviewManager.getInstance().updateConfig(partial);
  }, []);

  const toggleConfig = useCallback((key: keyof ReviewModeConfig) => {
    MobileReviewManager.getInstance().toggleConfig(key);
  }, []);

  const resetConfig = useCallback(() => {
    MobileReviewManager.getInstance().resetConfig();
  }, []);

  const isEnabled = useCallback((key: keyof ReviewModeConfig) => {
    return MobileReviewManager.getInstance().isEnabled(key);
  }, []);

  const manager = typeof window !== 'undefined' ? MobileReviewManager.getInstance() : null;

  return {
    config: manager ? manager.getConfig() : { ...DEFAULT_CONFIG },
    updateConfig,
    toggleConfig,
    resetConfig,
    isEnabled,
  };
}
