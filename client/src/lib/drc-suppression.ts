/**
 * DRC Suppression Manager
 *
 * Allows users to suppress specific DRC/ERC/validation violations with a reason,
 * optional expiration, and audit trail. Singleton + Subscribe pattern for React
 * integration. Persists to localStorage per project.
 *
 * Usage:
 *   const manager = DrcSuppressionManager.getInstance();
 *   manager.suppress({ projectId: 1, ruleId: 'clearance', instanceId: 'abc', reason: 'Known spacing', ... });
 *   manager.isSuppressed(1, 'clearance', 'abc'); // true
 *
 * React hook:
 *   const { suppressions, suppress, unsuppress, isSuppressed, ... } = useDrcSuppression(projectId);
 */

import { useCallback, useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DrcSuppression {
  /** Unique suppression ID */
  id: string;
  /** Project this suppression belongs to */
  projectId: number;
  /** The DRC/ERC rule type being suppressed (e.g. 'clearance', 'unconnected_pin') */
  ruleId: string;
  /** The specific violation instance ID being suppressed (issue id / violation id) */
  instanceId: string;
  /** Human-readable reason for suppressing */
  reason: string;
  /** Who created the suppression */
  suppressedBy: string;
  /** When the suppression was created (epoch ms) */
  suppressedAt: number;
  /** When the suppression expires (epoch ms), or null if permanent */
  expiresAt: number | null;
  /** Whether this suppression is permanent (no expiry) */
  permanent: boolean;
}

export interface SuppressInput {
  projectId: number;
  ruleId: string;
  instanceId: string;
  reason: string;
  suppressedBy?: string;
  /** Expiration date as epoch ms. Ignored if permanent is true. */
  expiresAt?: number | null;
  /** If true, suppression never expires. Defaults to false. */
  permanent?: boolean;
}

type Listener = () => void;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY_PREFIX = 'protopulse-drc-suppressions';

function storageKey(projectId: number): string {
  return `${STORAGE_KEY_PREFIX}-${projectId}`;
}

// ---------------------------------------------------------------------------
// Manager (Singleton + Subscribe)
// ---------------------------------------------------------------------------

export class DrcSuppressionManager {
  private static instance: DrcSuppressionManager | null = null;

  private suppressions: Map<number, DrcSuppression[]> = new Map();
  private listeners: Set<Listener> = new Set();

  private constructor() {
    // private — use getInstance()
  }

  static getInstance(): DrcSuppressionManager {
    if (!DrcSuppressionManager.instance) {
      DrcSuppressionManager.instance = new DrcSuppressionManager();
    }
    return DrcSuppressionManager.instance;
  }

  /** Reset singleton — useful for tests */
  static resetInstance(): void {
    DrcSuppressionManager.instance = null;
  }

  // -----------------------------------------------------------------------
  // Subscribe
  // -----------------------------------------------------------------------

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    for (const listener of Array.from(this.listeners)) {
      listener();
    }
  }

  // -----------------------------------------------------------------------
  // Persistence
  // -----------------------------------------------------------------------

  loadProject(projectId: number): void {
    if (this.suppressions.has(projectId)) {
      return;
    }
    try {
      const raw = localStorage.getItem(storageKey(projectId));
      if (raw) {
        const parsed = JSON.parse(raw) as DrcSuppression[];
        if (Array.isArray(parsed)) {
          this.suppressions.set(projectId, parsed);
          this.notify();
          return;
        }
      }
    } catch {
      // corrupted — start fresh
    }
    this.suppressions.set(projectId, []);
  }

  private save(projectId: number): void {
    const items = this.suppressions.get(projectId) ?? [];
    try {
      localStorage.setItem(storageKey(projectId), JSON.stringify(items));
    } catch {
      // localStorage full — silently ignore
    }
  }

  // -----------------------------------------------------------------------
  // Core operations
  // -----------------------------------------------------------------------

  suppress(input: SuppressInput): DrcSuppression {
    const { projectId, ruleId, instanceId, reason, suppressedBy = 'user', expiresAt = null, permanent = false } = input;

    this.loadProject(projectId);

    // Deduplicate: if an active suppression for the same rule+instance already exists, update it
    const existing = this.getSuppressions(projectId);
    const existingIdx = existing.findIndex(
      (s) => s.ruleId === ruleId && s.instanceId === instanceId,
    );

    const suppression: DrcSuppression = {
      id: existingIdx >= 0 ? existing[existingIdx].id : crypto.randomUUID(),
      projectId,
      ruleId,
      instanceId,
      reason,
      suppressedBy,
      suppressedAt: Date.now(),
      expiresAt: permanent ? null : expiresAt,
      permanent,
    };

    if (existingIdx >= 0) {
      existing[existingIdx] = suppression;
    } else {
      existing.push(suppression);
    }

    this.suppressions.set(projectId, existing);
    this.save(projectId);
    this.notify();
    return suppression;
  }

  unsuppress(projectId: number, suppressionId: string): boolean {
    this.loadProject(projectId);
    const items = this.getSuppressions(projectId);
    const idx = items.findIndex((s) => s.id === suppressionId);
    if (idx < 0) {
      return false;
    }
    items.splice(idx, 1);
    this.suppressions.set(projectId, items);
    this.save(projectId);
    this.notify();
    return true;
  }

  unsuppressByInstance(projectId: number, ruleId: string, instanceId: string): boolean {
    this.loadProject(projectId);
    const items = this.getSuppressions(projectId);
    const idx = items.findIndex((s) => s.ruleId === ruleId && s.instanceId === instanceId);
    if (idx < 0) {
      return false;
    }
    items.splice(idx, 1);
    this.suppressions.set(projectId, items);
    this.save(projectId);
    this.notify();
    return true;
  }

  isSuppressed(projectId: number, ruleId: string, instanceId: string): boolean {
    this.loadProject(projectId);
    const items = this.getSuppressions(projectId);
    const now = Date.now();
    return items.some(
      (s) =>
        s.ruleId === ruleId &&
        s.instanceId === instanceId &&
        (s.permanent || s.expiresAt === null || s.expiresAt > now),
    );
  }

  getSuppressions(projectId: number): DrcSuppression[] {
    this.loadProject(projectId);
    return this.suppressions.get(projectId) ?? [];
  }

  /** Return only non-expired suppressions */
  getActiveSuppressions(projectId: number): DrcSuppression[] {
    const now = Date.now();
    return this.getSuppressions(projectId).filter(
      (s) => s.permanent || s.expiresAt === null || s.expiresAt > now,
    );
  }

  /** Return expired suppressions */
  getExpiredSuppressions(projectId: number): DrcSuppression[] {
    const now = Date.now();
    return this.getSuppressions(projectId).filter(
      (s) => !s.permanent && s.expiresAt !== null && s.expiresAt <= now,
    );
  }

  /** Purge all expired suppressions for a project */
  purgeExpired(projectId: number): number {
    this.loadProject(projectId);
    const items = this.getSuppressions(projectId);
    const now = Date.now();
    const active = items.filter(
      (s) => s.permanent || s.expiresAt === null || s.expiresAt > now,
    );
    const purged = items.length - active.length;
    if (purged > 0) {
      this.suppressions.set(projectId, active);
      this.save(projectId);
      this.notify();
    }
    return purged;
  }

  /** Clear all suppressions for a project */
  clearAll(projectId: number): void {
    this.suppressions.set(projectId, []);
    this.save(projectId);
    this.notify();
  }

  /** Count active (non-expired) suppressions */
  activeCount(projectId: number): number {
    return this.getActiveSuppressions(projectId).length;
  }

  /** Find suppression for a specific rule+instance pair */
  findSuppression(projectId: number, ruleId: string, instanceId: string): DrcSuppression | undefined {
    this.loadProject(projectId);
    return this.getSuppressions(projectId).find(
      (s) => s.ruleId === ruleId && s.instanceId === instanceId,
    );
  }
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

export function useDrcSuppression(projectId: number) {
  const manager = DrcSuppressionManager.getInstance();

  const [, setTick] = useState(0);

  useEffect(() => {
    manager.loadProject(projectId);
    return manager.subscribe(() => {
      setTick((t) => t + 1);
    });
  }, [manager, projectId]);

  const suppressions = manager.getActiveSuppressions(projectId);
  const expiredSuppressions = manager.getExpiredSuppressions(projectId);
  const allSuppressions = manager.getSuppressions(projectId);

  const suppress = useCallback(
    (input: Omit<SuppressInput, 'projectId'>) => {
      return manager.suppress({ ...input, projectId });
    },
    [manager, projectId],
  );

  const unsuppress = useCallback(
    (suppressionId: string) => {
      return manager.unsuppress(projectId, suppressionId);
    },
    [manager, projectId],
  );

  const unsuppressByInstance = useCallback(
    (ruleId: string, instanceId: string) => {
      return manager.unsuppressByInstance(projectId, ruleId, instanceId);
    },
    [manager, projectId],
  );

  const isSuppressed = useCallback(
    (ruleId: string, instanceId: string) => {
      return manager.isSuppressed(projectId, ruleId, instanceId);
    },
    [manager, projectId],
  );

  const findSuppression = useCallback(
    (ruleId: string, instanceId: string) => {
      return manager.findSuppression(projectId, ruleId, instanceId);
    },
    [manager, projectId],
  );

  const purgeExpired = useCallback(() => {
    return manager.purgeExpired(projectId);
  }, [manager, projectId]);

  const clearAll = useCallback(() => {
    manager.clearAll(projectId);
  }, [manager, projectId]);

  return {
    suppressions,
    expiredSuppressions,
    allSuppressions,
    suppress,
    unsuppress,
    unsuppressByInstance,
    isSuppressed,
    findSuppression,
    purgeExpired,
    clearAll,
    activeCount: suppressions.length,
  };
}
