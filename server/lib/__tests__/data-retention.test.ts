import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  computeCutoff,
  countEligible,
  DEFAULT_POLICIES,
  executePolicy,
  getPolicies,
  runRetention,
  runSinglePolicy,
} from '../data-retention';

import type { RetentionPolicy } from '../data-retention';

// ---------------------------------------------------------------------------
// Mock DB helpers
// ---------------------------------------------------------------------------

function createMockDb(options: {
  selectCount?: number;
  updateRowCount?: number;
  deleteRowCount?: number;
} = {}) {
  const { selectCount = 0, updateRowCount = 0, deleteRowCount = 0 } = options;

  const whereFn = vi.fn().mockResolvedValue([{ total: selectCount }]);
  const fromFn = vi.fn().mockReturnValue({ where: whereFn });
  const selectFn = vi.fn().mockReturnValue({ from: fromFn });

  const updateWhereFn = vi.fn().mockResolvedValue({ rowCount: updateRowCount });
  const updateSetFn = vi.fn().mockReturnValue({ where: updateWhereFn });
  const updateFn = vi.fn().mockReturnValue({ set: updateSetFn });

  const deleteWhereFn = vi.fn().mockResolvedValue({ rowCount: deleteRowCount });
  const deleteFn = vi.fn().mockReturnValue({ where: deleteWhereFn });

  return {
    db: {
      select: selectFn,
      update: updateFn,
      delete: deleteFn,
    } as unknown as Parameters<typeof countEligible>[0],
    mocks: {
      select: selectFn,
      from: fromFn,
      where: whereFn,
      update: updateFn,
      updateSet: updateSetFn,
      updateWhere: updateWhereFn,
      delete: deleteFn,
      deleteWhere: deleteWhereFn,
    },
  };
}

/** Create a mock DB that returns different counts per sequential select call. */
function createMultiCountDb(counts: number[]) {
  let callIdx = 0;

  const fromFn = vi.fn().mockImplementation(() => ({
    where: vi.fn().mockResolvedValue([{ total: counts[callIdx++] ?? 0 }]),
  }));
  const selectFn = vi.fn().mockReturnValue({ from: fromFn });

  const updateWhereFn = vi.fn().mockResolvedValue({ rowCount: 0 });
  const updateSetFn = vi.fn().mockReturnValue({ where: updateWhereFn });
  const updateFn = vi.fn().mockReturnValue({ set: updateSetFn });

  const deleteWhereFn = vi.fn().mockResolvedValue({ rowCount: 0 });
  const deleteFn = vi.fn().mockReturnValue({ where: deleteWhereFn });

  return {
    select: selectFn,
    update: updateFn,
    delete: deleteFn,
  } as unknown as Parameters<typeof countEligible>[0];
}

// ---------------------------------------------------------------------------
// Fixed "now" for deterministic tests
// ---------------------------------------------------------------------------

const NOW = new Date('2026-06-15T12:00:00.000Z');

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('data-retention', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  // ── computeCutoff ─────────────────────────────────────────────────────

  describe('computeCutoff', () => {
    it('subtracts the correct number of days', () => {
      const cutoff = computeCutoff(30, NOW);
      const expected = new Date('2026-05-16T12:00:00.000Z');
      expect(cutoff.getTime()).toBe(expected.getTime());
    });

    it('handles 90 days', () => {
      const cutoff = computeCutoff(90, NOW);
      const expected = new Date(NOW.getTime() - 90 * 24 * 60 * 60 * 1000);
      expect(cutoff.getTime()).toBe(expected.getTime());
    });

    it('handles 180 days', () => {
      const cutoff = computeCutoff(180, NOW);
      const expected = new Date(NOW.getTime() - 180 * 24 * 60 * 60 * 1000);
      expect(cutoff.getTime()).toBe(expected.getTime());
    });

    it('handles 365 days', () => {
      const cutoff = computeCutoff(365, NOW);
      const expected = new Date(NOW.getTime() - 365 * 24 * 60 * 60 * 1000);
      expect(cutoff.getTime()).toBe(expected.getTime());
    });

    it('handles 0 days (cutoff is now)', () => {
      const cutoff = computeCutoff(0, NOW);
      expect(cutoff.getTime()).toBe(NOW.getTime());
    });

    it('defaults to current time when no `now` provided', () => {
      const before = Date.now();
      const cutoff = computeCutoff(1);
      const after = Date.now();
      const expectedMin = before - 1 * 24 * 60 * 60 * 1000;
      const expectedMax = after - 1 * 24 * 60 * 60 * 1000;
      expect(cutoff.getTime()).toBeGreaterThanOrEqual(expectedMin);
      expect(cutoff.getTime()).toBeLessThanOrEqual(expectedMax);
    });
  });

  // ── getPolicies ───────────────────────────────────────────────────────

  describe('getPolicies', () => {
    it('returns all 4 built-in policies', () => {
      const policies = getPolicies();
      expect(policies).toHaveLength(4);
    });

    it('includes chat_messages policy with 90 day retention', () => {
      const policy = getPolicies().find((p) => p.category === 'chat_messages');
      expect(policy).toBeDefined();
      expect(policy!.retentionDays).toBe(90);
      expect(policy!.action).toBe('archive');
    });

    it('includes history_items policy with 180 day retention', () => {
      const policy = getPolicies().find((p) => p.category === 'history_items');
      expect(policy).toBeDefined();
      expect(policy!.retentionDays).toBe(180);
      expect(policy!.action).toBe('soft_delete');
    });

    it('includes sessions policy with 30 day retention', () => {
      const policy = getPolicies().find((p) => p.category === 'sessions');
      expect(policy).toBeDefined();
      expect(policy!.retentionDays).toBe(30);
      expect(policy!.action).toBe('hard_delete');
    });

    it('includes design_snapshots policy with 365 day retention', () => {
      const policy = getPolicies().find((p) => p.category === 'design_snapshots');
      expect(policy).toBeDefined();
      expect(policy!.retentionDays).toBe(365);
      expect(policy!.action).toBe('archive');
    });

    it('returns the same reference as DEFAULT_POLICIES', () => {
      expect(getPolicies()).toBe(DEFAULT_POLICIES);
    });
  });

  // ── countEligible ─────────────────────────────────────────────────────

  describe('countEligible', () => {
    it('counts chat_messages eligible for archival', async () => {
      const { db } = createMockDb({ selectCount: 42 });
      const policy = DEFAULT_POLICIES.find((p) => p.category === 'chat_messages')!;
      const cutoff = computeCutoff(policy.retentionDays, NOW);

      const result = await countEligible(db, policy, cutoff);
      expect(result).toBe(42);
    });

    it('counts history_items eligible for cleanup', async () => {
      const { db } = createMockDb({ selectCount: 15 });
      const policy = DEFAULT_POLICIES.find((p) => p.category === 'history_items')!;
      const cutoff = computeCutoff(policy.retentionDays, NOW);

      const result = await countEligible(db, policy, cutoff);
      expect(result).toBe(15);
    });

    it('counts expired sessions', async () => {
      const { db } = createMockDb({ selectCount: 7 });
      const policy = DEFAULT_POLICIES.find((p) => p.category === 'sessions')!;
      const cutoff = computeCutoff(policy.retentionDays, NOW);

      const result = await countEligible(db, policy, cutoff);
      expect(result).toBe(7);
    });

    it('counts design_snapshots eligible for archival', async () => {
      const { db } = createMockDb({ selectCount: 3 });
      const policy = DEFAULT_POLICIES.find((p) => p.category === 'design_snapshots')!;
      const cutoff = computeCutoff(policy.retentionDays, NOW);

      const result = await countEligible(db, policy, cutoff);
      expect(result).toBe(3);
    });

    it('returns 0 for unknown category', async () => {
      const { db } = createMockDb({ selectCount: 99 });
      const unknownPolicy: RetentionPolicy = {
        category: 'unknown_table',
        table: 'unknown_table',
        retentionDays: 10,
        action: 'hard_delete',
        description: 'test',
      };
      const cutoff = computeCutoff(10, NOW);

      const result = await countEligible(db, unknownPolicy, cutoff);
      expect(result).toBe(0);
    });

    it('returns 0 when select returns empty', async () => {
      const whereFn = vi.fn().mockResolvedValue([]);
      const fromFn = vi.fn().mockReturnValue({ where: whereFn });
      const selectFn = vi.fn().mockReturnValue({ from: fromFn });
      const db = { select: selectFn } as unknown as Parameters<typeof countEligible>[0];

      const policy = DEFAULT_POLICIES.find((p) => p.category === 'chat_messages')!;
      const cutoff = computeCutoff(policy.retentionDays, NOW);

      const result = await countEligible(db, policy, cutoff);
      expect(result).toBe(0);
    });
  });

  // ── executePolicy ─────────────────────────────────────────────────────

  describe('executePolicy', () => {
    it('archives chat messages by setting mode to "archived"', async () => {
      const { db, mocks } = createMockDb({ updateRowCount: 10 });
      const policy = DEFAULT_POLICIES.find((p) => p.category === 'chat_messages')!;
      const cutoff = computeCutoff(policy.retentionDays, NOW);

      const result = await executePolicy(db, policy, cutoff);

      expect(result).toBe(10);
      expect(mocks.update).toHaveBeenCalled();
      expect(mocks.updateSet).toHaveBeenCalledWith(
        expect.objectContaining({ mode: 'archived' }),
      );
    });

    it('deletes history items', async () => {
      const { db, mocks } = createMockDb({ deleteRowCount: 5 });
      const policy = DEFAULT_POLICIES.find((p) => p.category === 'history_items')!;
      const cutoff = computeCutoff(policy.retentionDays, NOW);

      const result = await executePolicy(db, policy, cutoff);

      expect(result).toBe(5);
      expect(mocks.delete).toHaveBeenCalled();
    });

    it('hard-deletes expired sessions', async () => {
      const { db, mocks } = createMockDb({ deleteRowCount: 3 });
      const policy = DEFAULT_POLICIES.find((p) => p.category === 'sessions')!;
      const cutoff = computeCutoff(policy.retentionDays, NOW);

      const result = await executePolicy(db, policy, cutoff);

      expect(result).toBe(3);
      expect(mocks.delete).toHaveBeenCalled();
    });

    it('archives design snapshots by prefixing name', async () => {
      const { db, mocks } = createMockDb({ updateRowCount: 2 });
      const policy = DEFAULT_POLICIES.find((p) => p.category === 'design_snapshots')!;
      const cutoff = computeCutoff(policy.retentionDays, NOW);

      const result = await executePolicy(db, policy, cutoff);

      expect(result).toBe(2);
      expect(mocks.update).toHaveBeenCalled();
    });

    it('returns 0 for unknown category', async () => {
      const { db } = createMockDb();
      const unknownPolicy: RetentionPolicy = {
        category: 'nope',
        table: 'nope',
        retentionDays: 1,
        action: 'hard_delete',
        description: 'test',
      };
      const cutoff = computeCutoff(1, NOW);

      const result = await executePolicy(db, unknownPolicy, cutoff);
      expect(result).toBe(0);
    });

    it('returns 0 when rowCount is null', async () => {
      const updateWhereFn = vi.fn().mockResolvedValue({ rowCount: null });
      const updateSetFn = vi.fn().mockReturnValue({ where: updateWhereFn });
      const updateFn = vi.fn().mockReturnValue({ set: updateSetFn });
      const db = { update: updateFn } as unknown as Parameters<typeof executePolicy>[0];

      const policy = DEFAULT_POLICIES.find((p) => p.category === 'chat_messages')!;
      const cutoff = computeCutoff(policy.retentionDays, NOW);

      const result = await executePolicy(db, policy, cutoff);
      expect(result).toBe(0);
    });
  });

  // ── runRetention ──────────────────────────────────────────────────────

  describe('runRetention', () => {
    it('returns all 4 policy results in dry-run mode', async () => {
      const db = createMultiCountDb([10, 20, 5, 2]);

      const result = await runRetention(db, true, DEFAULT_POLICIES, NOW);

      expect(result.dryRun).toBe(true);
      expect(result.results).toHaveLength(4);
      expect(result.totalAffected).toBe(37);
      expect(result.timestamp).toBe(NOW.toISOString());
    });

    it('marks none as executed in dry-run mode', async () => {
      const db = createMultiCountDb([10, 20, 5, 2]);

      const result = await runRetention(db, true, DEFAULT_POLICIES, NOW);

      for (const r of result.results) {
        expect(r.executed).toBe(false);
      }
    });

    it('executes policies when not dry-run and affected > 0', async () => {
      // We need a more sophisticated mock for execute mode
      let selectCallIdx = 0;
      const selectCounts = [3, 0, 1, 0];

      const fromFn = vi.fn().mockImplementation(() => ({
        where: vi.fn().mockResolvedValue([{ total: selectCounts[selectCallIdx++] ?? 0 }]),
      }));
      const selectFn = vi.fn().mockReturnValue({ from: fromFn });

      const updateWhereFn = vi.fn().mockResolvedValue({ rowCount: 3 });
      const updateSetFn = vi.fn().mockReturnValue({ where: updateWhereFn });
      const updateFn = vi.fn().mockReturnValue({ set: updateSetFn });

      const deleteWhereFn = vi.fn().mockResolvedValue({ rowCount: 1 });
      const deleteFn = vi.fn().mockReturnValue({ where: deleteWhereFn });

      const db = {
        select: selectFn,
        update: updateFn,
        delete: deleteFn,
      } as unknown as Parameters<typeof runRetention>[0];

      const result = await runRetention(db, false, DEFAULT_POLICIES, NOW);

      expect(result.dryRun).toBe(false);
      // chat_messages (3) and sessions (1) should be executed
      const chatResult = result.results.find((r) => r.category === 'chat_messages')!;
      expect(chatResult.executed).toBe(true);
      expect(chatResult.affectedCount).toBe(3);

      const historyResult = result.results.find((r) => r.category === 'history_items')!;
      expect(historyResult.executed).toBe(false);
      expect(historyResult.affectedCount).toBe(0);

      const sessionsResult = result.results.find((r) => r.category === 'sessions')!;
      expect(sessionsResult.executed).toBe(true);
      expect(sessionsResult.affectedCount).toBe(1);

      const snapshotsResult = result.results.find((r) => r.category === 'design_snapshots')!;
      expect(snapshotsResult.executed).toBe(false);
      expect(snapshotsResult.affectedCount).toBe(0);
    });

    it('does not execute when affectedCount is 0 even in non-dry-run', async () => {
      const db = createMultiCountDb([0, 0, 0, 0]);

      const result = await runRetention(db, false, DEFAULT_POLICIES, NOW);

      expect(result.totalAffected).toBe(0);
      for (const r of result.results) {
        expect(r.executed).toBe(false);
      }
    });

    it('uses custom policies when provided', async () => {
      const customPolicies: RetentionPolicy[] = [
        {
          category: 'sessions',
          table: 'sessions',
          retentionDays: 7,
          action: 'hard_delete',
          description: 'Short retention for test',
        },
      ];

      const db = createMultiCountDb([50]);
      const result = await runRetention(db, true, customPolicies, NOW);

      expect(result.results).toHaveLength(1);
      expect(result.results[0].category).toBe('sessions');
      expect(result.results[0].retentionDays).toBe(7);
      expect(result.totalAffected).toBe(50);
    });

    it('includes correct cutoff dates per policy', async () => {
      const db = createMultiCountDb([0, 0, 0, 0]);

      const result = await runRetention(db, true, DEFAULT_POLICIES, NOW);

      const chatResult = result.results.find((r) => r.category === 'chat_messages')!;
      expect(chatResult.cutoffDate).toBe(computeCutoff(90, NOW).toISOString());

      const sessionsResult = result.results.find((r) => r.category === 'sessions')!;
      expect(sessionsResult.cutoffDate).toBe(computeCutoff(30, NOW).toISOString());
    });
  });

  // ── runSinglePolicy ───────────────────────────────────────────────────

  describe('runSinglePolicy', () => {
    it('returns null for unknown category', async () => {
      const { db } = createMockDb();
      const result = await runSinglePolicy(db, 'nonexistent', true, NOW);
      expect(result).toBeNull();
    });

    it('previews a single policy (dry-run)', async () => {
      const { db } = createMockDb({ selectCount: 12 });
      const result = await runSinglePolicy(db, 'sessions', true, NOW);

      expect(result).not.toBeNull();
      expect(result!.category).toBe('sessions');
      expect(result!.affectedCount).toBe(12);
      expect(result!.executed).toBe(false);
      expect(result!.action).toBe('hard_delete');
      expect(result!.retentionDays).toBe(30);
    });

    it('executes a single policy when not dry-run', async () => {
      const { db } = createMockDb({ selectCount: 4, deleteRowCount: 4 });
      const result = await runSinglePolicy(db, 'sessions', false, NOW);

      expect(result).not.toBeNull();
      expect(result!.executed).toBe(true);
      expect(result!.affectedCount).toBe(4);
    });

    it('does not execute when count is 0', async () => {
      const { db } = createMockDb({ selectCount: 0 });
      const result = await runSinglePolicy(db, 'chat_messages', false, NOW);

      expect(result).not.toBeNull();
      expect(result!.executed).toBe(false);
      expect(result!.affectedCount).toBe(0);
    });

    it('returns correct cutoff for the policy', async () => {
      const { db } = createMockDb({ selectCount: 0 });
      const result = await runSinglePolicy(db, 'design_snapshots', true, NOW);

      expect(result).not.toBeNull();
      expect(result!.cutoffDate).toBe(computeCutoff(365, NOW).toISOString());
    });
  });

  // ── DEFAULT_POLICIES structure ────────────────────────────────────────

  describe('DEFAULT_POLICIES structure', () => {
    it('all policies have required fields', () => {
      for (const policy of DEFAULT_POLICIES) {
        expect(policy.category).toBeTruthy();
        expect(policy.table).toBeTruthy();
        expect(policy.retentionDays).toBeGreaterThan(0);
        expect(['archive', 'soft_delete', 'hard_delete']).toContain(policy.action);
        expect(policy.description).toBeTruthy();
      }
    });

    it('has unique categories', () => {
      const categories = DEFAULT_POLICIES.map((p) => p.category);
      expect(new Set(categories).size).toBe(categories.length);
    });

    it('retention days are in ascending order of aggression', () => {
      // Sessions (30d hard_delete) is the most aggressive
      // Chat (90d archive) is moderate
      // History (180d soft_delete) is moderate
      // Snapshots (365d archive) is the most lenient
      const sessions = DEFAULT_POLICIES.find((p) => p.category === 'sessions')!;
      const chat = DEFAULT_POLICIES.find((p) => p.category === 'chat_messages')!;
      const history = DEFAULT_POLICIES.find((p) => p.category === 'history_items')!;
      const snapshots = DEFAULT_POLICIES.find((p) => p.category === 'design_snapshots')!;

      expect(sessions.retentionDays).toBeLessThan(chat.retentionDays);
      expect(chat.retentionDays).toBeLessThan(history.retentionDays);
      expect(history.retentionDays).toBeLessThan(snapshots.retentionDays);
    });
  });
});
