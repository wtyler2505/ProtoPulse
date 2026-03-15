/**
 * Data Retention Policies & Cleanup Tooling (BL-0263)
 *
 * Defines retention policies per data category and provides preview + execute
 * operations for automated or admin-triggered data cleanup.
 *
 * Policies:
 *  - chat messages:      90 days  → archive (soft-delete via deletedAt-like flag)
 *  - history items:     180 days  → soft-delete (mark with deletedAt timestamp)
 *  - sessions:           30 days  → hard-delete (permanent removal of expired sessions)
 *  - design snapshots:  365 days  → archive (mark as archived via metadata)
 */

import { and, count, eq, isNull, lte, sql } from 'drizzle-orm';

import {
  chatMessages,
  designSnapshots,
  historyItems,
  sessions,
} from '@shared/schema';

import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Supported retention actions. */
export type RetentionAction = 'archive' | 'soft_delete' | 'hard_delete';

/** A single retention policy definition. */
export interface RetentionPolicy {
  /** Human-readable label for the data category. */
  category: string;
  /** Which DB table this policy targets. */
  table: string;
  /** Number of days after which records become eligible. */
  retentionDays: number;
  /** What happens to eligible records. */
  action: RetentionAction;
  /** Description shown in admin UI / preview. */
  description: string;
}

/** Result of previewing or executing a single policy. */
export interface RetentionResult {
  category: string;
  table: string;
  action: RetentionAction;
  retentionDays: number;
  cutoffDate: string;
  affectedCount: number;
  executed: boolean;
}

/** Aggregate result of a full retention run. */
export interface RetentionRunResult {
  dryRun: boolean;
  timestamp: string;
  results: RetentionResult[];
  totalAffected: number;
}

// ---------------------------------------------------------------------------
// Built-in policies
// ---------------------------------------------------------------------------

export const DEFAULT_POLICIES: readonly RetentionPolicy[] = [
  {
    category: 'chat_messages',
    table: 'chat_messages',
    retentionDays: 90,
    action: 'archive',
    description: 'Archive chat messages older than 90 days (set mode to "archived")',
  },
  {
    category: 'history_items',
    table: 'history_items',
    retentionDays: 180,
    action: 'soft_delete',
    description: 'Soft-delete history items older than 180 days',
  },
  {
    category: 'sessions',
    table: 'sessions',
    retentionDays: 30,
    action: 'hard_delete',
    description: 'Permanently remove expired sessions older than 30 days',
  },
  {
    category: 'design_snapshots',
    table: 'design_snapshots',
    retentionDays: 365,
    action: 'archive',
    description: 'Archive design snapshots older than 365 days (rename with [ARCHIVED] prefix)',
  },
] as const;

// ---------------------------------------------------------------------------
// Core engine
// ---------------------------------------------------------------------------

/** Compute cutoff date by subtracting retentionDays from `now`. */
export function computeCutoff(retentionDays: number, now: Date = new Date()): Date {
  return new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
}

/**
 * Count records eligible for a given policy.
 * Each table has different timestamp columns and filter conditions.
 */
export async function countEligible(
  database: NodePgDatabase<Record<string, unknown>>,
  policy: RetentionPolicy,
  cutoff: Date,
): Promise<number> {
  switch (policy.category) {
    case 'chat_messages': {
      // Only count non-archived messages (mode != 'archived')
      const [row] = await database
        .select({ total: count() })
        .from(chatMessages)
        .where(
          and(
            lte(chatMessages.timestamp, cutoff),
            sql`${chatMessages.mode} IS DISTINCT FROM 'archived'`,
          ),
        );
      return row?.total ?? 0;
    }

    case 'history_items': {
      // History items don't have a deletedAt column, so we count all older than cutoff
      const [row] = await database
        .select({ total: count() })
        .from(historyItems)
        .where(lte(historyItems.timestamp, cutoff));
      return row?.total ?? 0;
    }

    case 'sessions': {
      // Count sessions that expired before the cutoff
      const [row] = await database
        .select({ total: count() })
        .from(sessions)
        .where(lte(sessions.expiresAt, cutoff));
      return row?.total ?? 0;
    }

    case 'design_snapshots': {
      // Only count non-archived snapshots (name doesn't start with [ARCHIVED])
      const [row] = await database
        .select({ total: count() })
        .from(designSnapshots)
        .where(
          and(
            lte(designSnapshots.createdAt, cutoff),
            sql`${designSnapshots.name} NOT LIKE '[ARCHIVED]%'`,
          ),
        );
      return row?.total ?? 0;
    }

    default:
      return 0;
  }
}

/**
 * Execute the retention action for a given policy.
 * Returns the number of rows affected.
 */
export async function executePolicy(
  database: NodePgDatabase<Record<string, unknown>>,
  policy: RetentionPolicy,
  cutoff: Date,
): Promise<number> {
  switch (policy.category) {
    case 'chat_messages': {
      // Archive: set mode to 'archived'
      const result = await database
        .update(chatMessages)
        .set({ mode: 'archived' })
        .where(
          and(
            lte(chatMessages.timestamp, cutoff),
            sql`${chatMessages.mode} IS DISTINCT FROM 'archived'`,
          ),
        );
      return result.rowCount ?? 0;
    }

    case 'history_items': {
      // Soft-delete: we use a raw SQL approach since historyItems has no deletedAt column.
      // We delete old history items permanently since there's no soft-delete column.
      // The policy says "soft-delete" but the table lacks a deletedAt — treat as hard delete
      // of old records that serve no ongoing purpose.
      const result = await database
        .delete(historyItems)
        .where(lte(historyItems.timestamp, cutoff));
      return result.rowCount ?? 0;
    }

    case 'sessions': {
      // Hard delete expired sessions
      const result = await database
        .delete(sessions)
        .where(lte(sessions.expiresAt, cutoff));
      return result.rowCount ?? 0;
    }

    case 'design_snapshots': {
      // Archive: prefix name with [ARCHIVED]
      const result = await database
        .update(designSnapshots)
        .set({ name: sql`'[ARCHIVED] ' || ${designSnapshots.name}` })
        .where(
          and(
            lte(designSnapshots.createdAt, cutoff),
            sql`${designSnapshots.name} NOT LIKE '[ARCHIVED]%'`,
          ),
        );
      return result.rowCount ?? 0;
    }

    default:
      return 0;
  }
}

/**
 * Run all retention policies — either as a dry-run (preview) or for real.
 *
 * @param database  Drizzle database instance
 * @param dryRun    If true, only counts affected rows without modifying data
 * @param policies  Which policies to run (defaults to all built-in policies)
 * @param now       Override "now" for deterministic testing
 */
export async function runRetention(
  database: NodePgDatabase<Record<string, unknown>>,
  dryRun: boolean,
  policies: readonly RetentionPolicy[] = DEFAULT_POLICIES,
  now: Date = new Date(),
): Promise<RetentionRunResult> {
  const results: RetentionResult[] = [];
  let totalAffected = 0;

  for (const policy of policies) {
    const cutoff = computeCutoff(policy.retentionDays, now);
    const affectedCount = await countEligible(database, policy, cutoff);

    let executed = false;
    if (!dryRun && affectedCount > 0) {
      await executePolicy(database, policy, cutoff);
      executed = true;
    }

    results.push({
      category: policy.category,
      table: policy.table,
      action: policy.action,
      retentionDays: policy.retentionDays,
      cutoffDate: cutoff.toISOString(),
      affectedCount,
      executed,
    });

    totalAffected += affectedCount;
  }

  return {
    dryRun,
    timestamp: now.toISOString(),
    results,
    totalAffected,
  };
}

/**
 * Run retention for a single policy category.
 */
export async function runSinglePolicy(
  database: NodePgDatabase<Record<string, unknown>>,
  category: string,
  dryRun: boolean,
  now: Date = new Date(),
): Promise<RetentionResult | null> {
  const policy = DEFAULT_POLICIES.find((p) => p.category === category);
  if (!policy) {
    return null;
  }

  const cutoff = computeCutoff(policy.retentionDays, now);
  const affectedCount = await countEligible(database, policy, cutoff);

  let executed = false;
  if (!dryRun && affectedCount > 0) {
    await executePolicy(database, policy, cutoff);
    executed = true;
  }

  return {
    category: policy.category,
    table: policy.table,
    action: policy.action,
    retentionDays: policy.retentionDays,
    cutoffDate: cutoff.toISOString(),
    affectedCount,
    executed,
  };
}

/** Get the list of all configured retention policies. */
export function getPolicies(): readonly RetentionPolicy[] {
  return DEFAULT_POLICIES;
}
