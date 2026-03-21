import { describe, it, expect, beforeEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — must be set up before importing the module under test
// ---------------------------------------------------------------------------

vi.stubGlobal('crypto', {
  randomUUID: vi.fn<() => string>(() => `uuid-${Math.random().toString(36).slice(2, 10)}`),
});

const store: Record<string, string> = {};
vi.stubGlobal('localStorage', {
  getItem: vi.fn<(key: string) => string | null>((key: string) => store[key] ?? null),
  setItem: vi.fn<(key: string, val: string) => void>((key: string, val: string) => {
    store[key] = val;
  }),
  removeItem: vi.fn<(key: string) => void>((key: string) => {
    delete store[key];
  }),
  clear: vi.fn<() => void>(() => {
    for (const k of Object.keys(store)) {
      delete store[k];
    }
  }),
});

import {
  DesignBranchManager,
  ALL_BRANCH_DOMAINS,
} from '../design-branching';
import type {
  BranchDomain,
  BranchChange,
  MergeConflict,
  DesignBranch,
  BranchDiff,
  MergePreCheck,
  MergeResult,
  BranchReview,
  BranchReviewComment,
  ConflictResolution,
  FieldDiff,
  BranchDiffEntry,
  BranchDiffSummary,
  BranchManagerSnapshot,
} from '../design-branching';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createManager(): DesignBranchManager {
  DesignBranchManager.resetInstance();
  return DesignBranchManager.getInstance();
}

function createTestBranch(
  manager: DesignBranchManager,
  opts?: Partial<{ projectId: number; name: string; createdBy: string; parentBranchId: string }>,
): DesignBranch {
  return manager.createBranch({
    projectId: opts?.projectId ?? 1,
    name: opts?.name ?? `branch-${Date.now()}-${Math.random()}`,
    createdBy: opts?.createdBy ?? 'test-user',
    parentBranchId: opts?.parentBranchId,
  });
}

function recordTestChange(
  manager: DesignBranchManager,
  branchId: string,
  opts?: Partial<Omit<BranchChange, 'id' | 'timestamp'>>,
): BranchChange {
  return manager.recordChange(branchId, {
    domain: opts?.domain ?? 'architecture',
    changeType: opts?.changeType ?? 'modify',
    entityId: opts?.entityId ?? 'entity-1',
    entityLabel: opts?.entityLabel ?? 'Test Entity',
    description: opts?.description ?? 'Test change',
    before: opts?.before ?? { value: 'old' },
    after: opts?.after ?? { value: 'new' },
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DesignBranchManager', () => {
  let manager: DesignBranchManager;

  beforeEach(() => {
    for (const k of Object.keys(store)) {
      delete store[k];
    }
    manager = createManager();
  });

  // =========================================================================
  // Singleton
  // =========================================================================

  describe('singleton', () => {
    it('returns the same instance on subsequent calls', () => {
      const a = DesignBranchManager.getInstance();
      const b = DesignBranchManager.getInstance();
      expect(a).toBe(b);
    });

    it('returns a new instance after reset', () => {
      const a = DesignBranchManager.getInstance();
      DesignBranchManager.resetInstance();
      const b = DesignBranchManager.getInstance();
      expect(a).not.toBe(b);
    });
  });

  // =========================================================================
  // Subscribe & Snapshot
  // =========================================================================

  describe('subscribe & snapshot', () => {
    it('notifies subscribers on branch creation', () => {
      const listener = vi.fn();
      manager.subscribe(listener);
      createTestBranch(manager);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('unsubscribe stops notifications', () => {
      const listener = vi.fn();
      const unsub = manager.subscribe(listener);
      unsub();
      createTestBranch(manager);
      expect(listener).not.toHaveBeenCalled();
    });

    it('getSnapshot returns current state', () => {
      const snap = manager.getSnapshot();
      expect(snap.branches).toEqual([]);
      expect(snap.activeBranchId).toBeNull();
      expect(snap.currentProjectId).toBeNull();
    });

    it('snapshot includes created branches', () => {
      const branch = createTestBranch(manager, { name: 'feature-x' });
      const snap = manager.getSnapshot();
      expect(snap.branches).toHaveLength(1);
      expect(snap.branches[0].name).toBe('feature-x');
      expect(snap.activeBranchId).toBe(branch.id);
    });

    it('notifies on every state change', () => {
      const listener = vi.fn();
      manager.subscribe(listener);
      const b = createTestBranch(manager);
      recordTestChange(manager, b.id);
      expect(listener).toHaveBeenCalledTimes(2);
    });
  });

  // =========================================================================
  // Project scope
  // =========================================================================

  describe('setProject', () => {
    it('sets the current project ID', () => {
      manager.setProject(42);
      expect(manager.getSnapshot().currentProjectId).toBe(42);
    });

    it('notifies subscribers', () => {
      const listener = vi.fn();
      manager.subscribe(listener);
      manager.setProject(1);
      expect(listener).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Branch CRUD
  // =========================================================================

  describe('createBranch', () => {
    it('creates a branch with correct defaults', () => {
      const branch = manager.createBranch({
        projectId: 1,
        name: 'feature-a',
        createdBy: 'alice',
      });
      expect(branch.id).toBeTruthy();
      expect(branch.projectId).toBe(1);
      expect(branch.name).toBe('feature-a');
      expect(branch.state).toBe('active');
      expect(branch.parentBranchId).toBeNull();
      expect(branch.changes).toEqual([]);
      expect(branch.review).toBeNull();
      expect(branch.description).toBe('');
      expect(branch.createdBy).toBe('alice');
      expect(branch.createdAt).toBeGreaterThan(0);
      expect(branch.updatedAt).toBe(branch.createdAt);
    });

    it('sets as active branch', () => {
      const branch = createTestBranch(manager);
      expect(manager.getSnapshot().activeBranchId).toBe(branch.id);
    });

    it('rejects empty name', () => {
      expect(() =>
        manager.createBranch({ projectId: 1, name: '', createdBy: 'a' }),
      ).toThrow('Branch name cannot be empty');
    });

    it('rejects whitespace-only name', () => {
      expect(() =>
        manager.createBranch({ projectId: 1, name: '   ', createdBy: 'a' }),
      ).toThrow('Branch name cannot be empty');
    });

    it('rejects duplicate names in same project', () => {
      createTestBranch(manager, { projectId: 1, name: 'dup' });
      expect(() =>
        createTestBranch(manager, { projectId: 1, name: 'dup' }),
      ).toThrow('Branch "dup" already exists');
    });

    it('allows same name in different projects', () => {
      createTestBranch(manager, { projectId: 1, name: 'same' });
      const b2 = createTestBranch(manager, { projectId: 2, name: 'same' });
      expect(b2.name).toBe('same');
    });

    it('allows reusing name after abandon', () => {
      const b1 = createTestBranch(manager, { projectId: 1, name: 'reuse' });
      manager.abandonBranch(b1.id);
      const b2 = createTestBranch(manager, { projectId: 1, name: 'reuse' });
      expect(b2.name).toBe('reuse');
      expect(b2.id).not.toBe(b1.id);
    });

    it('stores parent branch ID', () => {
      const parent = createTestBranch(manager, { name: 'main-dev' });
      const child = createTestBranch(manager, { name: 'feature', parentBranchId: parent.id });
      expect(child.parentBranchId).toBe(parent.id);
    });

    it('stores description', () => {
      const branch = manager.createBranch({
        projectId: 1,
        name: 'described',
        description: 'A branch for testing',
        createdBy: 'a',
      });
      expect(branch.description).toBe('A branch for testing');
    });
  });

  describe('getBranch', () => {
    it('returns branch by ID', () => {
      const branch = createTestBranch(manager);
      expect(manager.getBranch(branch.id)).toEqual(branch);
    });

    it('returns null for unknown ID', () => {
      expect(manager.getBranch('nonexistent')).toBeNull();
    });
  });

  describe('getBranchesForProject', () => {
    it('returns only branches for the specified project', () => {
      createTestBranch(manager, { projectId: 1, name: 'a' });
      createTestBranch(manager, { projectId: 1, name: 'b' });
      createTestBranch(manager, { projectId: 2, name: 'c' });

      const p1 = manager.getBranchesForProject(1);
      expect(p1).toHaveLength(2);
      expect(p1.every((b) => b.projectId === 1)).toBe(true);

      const p2 = manager.getBranchesForProject(2);
      expect(p2).toHaveLength(1);
    });

    it('returns empty array for project with no branches', () => {
      expect(manager.getBranchesForProject(99)).toEqual([]);
    });
  });

  describe('switchBranch', () => {
    it('switches the active branch', () => {
      const b1 = createTestBranch(manager, { name: 'first' });
      const b2 = createTestBranch(manager, { name: 'second' });
      expect(manager.getSnapshot().activeBranchId).toBe(b2.id);

      manager.switchBranch(b1.id);
      expect(manager.getSnapshot().activeBranchId).toBe(b1.id);
    });

    it('throws for unknown branch', () => {
      expect(() => manager.switchBranch('nope')).toThrow('not found');
    });

    it('throws for merged branch', () => {
      const main = createTestBranch(manager, { name: 'main-br' });
      const feat = createTestBranch(manager, { name: 'feat-br' });
      recordTestChange(manager, feat.id);
      manager.mergeBranch(feat.id, main.id);
      expect(() => manager.switchBranch(feat.id)).toThrow('merged');
    });

    it('throws for abandoned branch', () => {
      const b = createTestBranch(manager, { name: 'gone' });
      manager.abandonBranch(b.id);
      expect(() => manager.switchBranch(b.id)).toThrow('abandoned');
    });

    it('updates current project ID', () => {
      const b1 = createTestBranch(manager, { projectId: 1, name: 'p1' });
      createTestBranch(manager, { projectId: 2, name: 'p2' });
      manager.switchBranch(b1.id);
      expect(manager.getSnapshot().currentProjectId).toBe(1);
    });
  });

  describe('abandonBranch', () => {
    it('sets state to abandoned', () => {
      const b = createTestBranch(manager);
      manager.abandonBranch(b.id);
      expect(manager.getBranch(b.id)!.state).toBe('abandoned');
    });

    it('clears active branch if abandoned branch was active', () => {
      const b = createTestBranch(manager);
      expect(manager.getSnapshot().activeBranchId).toBe(b.id);
      manager.abandonBranch(b.id);
      expect(manager.getSnapshot().activeBranchId).toBeNull();
    });

    it('throws for unknown branch', () => {
      expect(() => manager.abandonBranch('nope')).toThrow('not found');
    });

    it('throws for already merged branch', () => {
      const main = createTestBranch(manager, { name: 'main-ab' });
      const feat = createTestBranch(manager, { name: 'feat-ab' });
      recordTestChange(manager, feat.id);
      manager.mergeBranch(feat.id, main.id);
      expect(() => manager.abandonBranch(feat.id)).toThrow('Invalid state transition');
    });

    it('can abandon a review_requested branch', () => {
      const b = createTestBranch(manager);
      recordTestChange(manager, b.id);
      manager.requestReview(b.id, 'user');
      manager.abandonBranch(b.id);
      expect(manager.getBranch(b.id)!.state).toBe('abandoned');
    });
  });

  // =========================================================================
  // Change tracking
  // =========================================================================

  describe('recordChange', () => {
    it('records a change on a branch', () => {
      const b = createTestBranch(manager);
      const change = recordTestChange(manager, b.id);
      expect(change.id).toBeTruthy();
      expect(change.timestamp).toBeGreaterThan(0);
      expect(change.domain).toBe('architecture');
      expect(change.changeType).toBe('modify');
    });

    it('throws for unknown branch', () => {
      expect(() => recordTestChange(manager, 'nope')).toThrow('not found');
    });

    it('throws for non-active branch', () => {
      const b = createTestBranch(manager);
      recordTestChange(manager, b.id);
      manager.requestReview(b.id, 'user');
      expect(() => recordTestChange(manager, b.id)).toThrow('review_requested');
    });

    it('appends multiple changes', () => {
      const b = createTestBranch(manager);
      recordTestChange(manager, b.id, { entityId: 'e1' });
      recordTestChange(manager, b.id, { entityId: 'e2' });
      recordTestChange(manager, b.id, { entityId: 'e3' });
      expect(manager.getChanges(b.id)).toHaveLength(3);
    });

    it('updates branch updatedAt', () => {
      const b = createTestBranch(manager);
      const before = b.updatedAt;
      recordTestChange(manager, b.id);
      expect(manager.getBranch(b.id)!.updatedAt).toBeGreaterThanOrEqual(before);
    });
  });

  describe('getChanges', () => {
    it('returns all changes for a branch', () => {
      const b = createTestBranch(manager);
      recordTestChange(manager, b.id, { domain: 'architecture' });
      recordTestChange(manager, b.id, { domain: 'bom' });
      expect(manager.getChanges(b.id)).toHaveLength(2);
    });

    it('filters by domain', () => {
      const b = createTestBranch(manager);
      recordTestChange(manager, b.id, { domain: 'architecture' });
      recordTestChange(manager, b.id, { domain: 'bom' });
      recordTestChange(manager, b.id, { domain: 'architecture' });
      expect(manager.getChanges(b.id, 'architecture')).toHaveLength(2);
      expect(manager.getChanges(b.id, 'bom')).toHaveLength(1);
    });

    it('returns empty for unknown branch', () => {
      expect(manager.getChanges('nope')).toEqual([]);
    });

    it('returns copy not reference', () => {
      const b = createTestBranch(manager);
      recordTestChange(manager, b.id);
      const changes = manager.getChanges(b.id);
      changes.push({} as BranchChange);
      expect(manager.getChanges(b.id)).toHaveLength(1);
    });
  });

  describe('getLatestChangesByEntity', () => {
    it('deduplicates by entity, keeping latest', () => {
      const b = createTestBranch(manager);
      recordTestChange(manager, b.id, {
        entityId: 'e1',
        after: { value: 'first' },
      });
      recordTestChange(manager, b.id, {
        entityId: 'e1',
        after: { value: 'second' },
      });
      const latest = manager.getLatestChangesByEntity(b.id);
      expect(latest.size).toBe(1);
      const entry = Array.from(latest.values())[0];
      expect(entry.after).toEqual({ value: 'second' });
    });

    it('keeps separate entries for different entities', () => {
      const b = createTestBranch(manager);
      recordTestChange(manager, b.id, { entityId: 'e1' });
      recordTestChange(manager, b.id, { entityId: 'e2' });
      const latest = manager.getLatestChangesByEntity(b.id);
      expect(latest.size).toBe(2);
    });

    it('keys include domain for cross-domain dedup', () => {
      const b = createTestBranch(manager);
      recordTestChange(manager, b.id, { entityId: 'e1', domain: 'architecture' });
      recordTestChange(manager, b.id, { entityId: 'e1', domain: 'bom' });
      const latest = manager.getLatestChangesByEntity(b.id);
      expect(latest.size).toBe(2);
    });

    it('returns empty map for unknown branch', () => {
      expect(manager.getLatestChangesByEntity('nope').size).toBe(0);
    });
  });

  describe('getAffectedDomains', () => {
    it('returns unique domains with changes', () => {
      const b = createTestBranch(manager);
      recordTestChange(manager, b.id, { domain: 'architecture' });
      recordTestChange(manager, b.id, { domain: 'bom' });
      recordTestChange(manager, b.id, { domain: 'architecture' });
      const domains = manager.getAffectedDomains(b.id);
      expect(domains).toEqual(['architecture', 'bom']);
    });

    it('returns empty for unknown branch', () => {
      expect(manager.getAffectedDomains('nope')).toEqual([]);
    });

    it('returns empty for branch with no changes', () => {
      const b = createTestBranch(manager);
      expect(manager.getAffectedDomains(b.id)).toEqual([]);
    });
  });

  // =========================================================================
  // Diff computation
  // =========================================================================

  describe('computeDiff', () => {
    it('shows entries only in source as added/modified', () => {
      const main = createTestBranch(manager, { name: 'main-diff' });
      const feat = createTestBranch(manager, { name: 'feat-diff' });
      recordTestChange(manager, feat.id, {
        entityId: 'new-node',
        changeType: 'add',
        before: null,
        after: { label: 'New Node' },
      });

      const diff = manager.computeDiff(feat.id, main.id);
      expect(diff.entries).toHaveLength(1);
      expect(diff.entries[0].type).toBe('added');
      expect(diff.entries[0].entityId).toBe('new-node');
      expect(diff.summary.added).toBe(1);
    });

    it('shows entries only in target', () => {
      const main = createTestBranch(manager, { name: 'main-diff2' });
      recordTestChange(manager, main.id, {
        entityId: 'target-node',
        changeType: 'add',
        before: null,
        after: { label: 'Target' },
      });
      const feat = createTestBranch(manager, { name: 'feat-diff2' });

      const diff = manager.computeDiff(feat.id, main.id);
      expect(diff.entries.some((e) => e.entityId === 'target-node')).toBe(true);
    });

    it('detects modifications when both changed same entity differently', () => {
      const main = createTestBranch(manager, { name: 'main-mod' });
      recordTestChange(manager, main.id, {
        entityId: 'shared',
        before: { value: 'original' },
        after: { value: 'main-edit' },
      });
      const feat = createTestBranch(manager, { name: 'feat-mod' });
      recordTestChange(manager, feat.id, {
        entityId: 'shared',
        before: { value: 'original' },
        after: { value: 'feat-edit' },
      });

      const diff = manager.computeDiff(feat.id, main.id);
      const modified = diff.entries.filter((e) => e.type === 'modified');
      expect(modified.length).toBeGreaterThan(0);
    });

    it('omits entries where both have identical after state', () => {
      const main = createTestBranch(manager, { name: 'main-same' });
      recordTestChange(manager, main.id, {
        entityId: 'same-entity',
        after: { value: 'identical' },
      });
      const feat = createTestBranch(manager, { name: 'feat-same' });
      recordTestChange(manager, feat.id, {
        entityId: 'same-entity',
        after: { value: 'identical' },
      });

      const diff = manager.computeDiff(feat.id, main.id);
      const sameEntry = diff.entries.filter((e) => e.entityId === 'same-entity');
      expect(sameEntry).toHaveLength(0);
    });

    it('computes domainsAffected correctly', () => {
      const main = createTestBranch(manager, { name: 'main-dom' });
      const feat = createTestBranch(manager, { name: 'feat-dom' });
      recordTestChange(manager, feat.id, { domain: 'architecture', entityId: 'a1' });
      recordTestChange(manager, feat.id, { domain: 'bom', entityId: 'b1' });

      const diff = manager.computeDiff(feat.id, main.id);
      expect(diff.summary.domainsAffected).toContain('architecture');
      expect(diff.summary.domainsAffected).toContain('bom');
    });

    it('shows removed entries', () => {
      const main = createTestBranch(manager, { name: 'main-rm' });
      const feat = createTestBranch(manager, { name: 'feat-rm' });
      recordTestChange(manager, feat.id, {
        entityId: 'removed-node',
        changeType: 'remove',
        before: { label: 'Gone' },
        after: null,
      });

      const diff = manager.computeDiff(feat.id, main.id);
      expect(diff.entries[0].type).toBe('removed');
      expect(diff.summary.removed).toBe(1);
    });

    it('throws for unknown source branch', () => {
      const main = createTestBranch(manager, { name: 'main-err' });
      expect(() => manager.computeDiff('nope', main.id)).toThrow('Source branch');
    });

    it('throws for unknown target branch', () => {
      const feat = createTestBranch(manager, { name: 'feat-err' });
      expect(() => manager.computeDiff(feat.id, 'nope')).toThrow('Target branch');
    });

    it('returns correct branchId and targetBranchId', () => {
      const main = createTestBranch(manager, { name: 'main-ids' });
      const feat = createTestBranch(manager, { name: 'feat-ids' });
      const diff = manager.computeDiff(feat.id, main.id);
      expect(diff.branchId).toBe(feat.id);
      expect(diff.targetBranchId).toBe(main.id);
    });
  });

  // =========================================================================
  // Conflict detection & resolution
  // =========================================================================

  describe('detectConflicts', () => {
    it('returns empty when no overlapping entities', () => {
      const main = createTestBranch(manager, { name: 'main-noconflict' });
      recordTestChange(manager, main.id, { entityId: 'e1' });
      const feat = createTestBranch(manager, { name: 'feat-noconflict' });
      recordTestChange(manager, feat.id, { entityId: 'e2' });

      expect(manager.detectConflicts(feat.id, main.id)).toEqual([]);
    });

    it('detects conflict when both modify same entity same fields', () => {
      const main = createTestBranch(manager, { name: 'main-conflict' });
      recordTestChange(manager, main.id, {
        entityId: 'shared',
        before: { value: 'original' },
        after: { value: 'main-version' },
      });
      const feat = createTestBranch(manager, { name: 'feat-conflict' });
      recordTestChange(manager, feat.id, {
        entityId: 'shared',
        before: { value: 'original' },
        after: { value: 'feat-version' },
      });

      const conflicts = manager.detectConflicts(feat.id, main.id);
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].entityId).toBe('shared');
      expect(conflicts[0].conflictingFields).toContain('value');
      expect(conflicts[0].resolution).toBeNull();
    });

    it('no conflict when same entity but different fields changed', () => {
      const main = createTestBranch(manager, { name: 'main-nofield' });
      recordTestChange(manager, main.id, {
        entityId: 'shared',
        before: { name: 'old', color: 'red' },
        after: { name: 'new', color: 'red' },
      });
      const feat = createTestBranch(manager, { name: 'feat-nofield' });
      recordTestChange(manager, feat.id, {
        entityId: 'shared',
        before: { name: 'old', color: 'red' },
        after: { name: 'old', color: 'blue' },
      });

      const conflicts = manager.detectConflicts(feat.id, main.id);
      expect(conflicts).toHaveLength(0);
    });

    it('handles multiple conflicts', () => {
      const main = createTestBranch(manager, { name: 'main-multi' });
      recordTestChange(manager, main.id, { entityId: 'e1', before: { x: 0 }, after: { x: 1 } });
      recordTestChange(manager, main.id, { entityId: 'e2', before: { y: 0 }, after: { y: 2 } });
      const feat = createTestBranch(manager, { name: 'feat-multi' });
      recordTestChange(manager, feat.id, { entityId: 'e1', before: { x: 0 }, after: { x: 99 } });
      recordTestChange(manager, feat.id, { entityId: 'e2', before: { y: 0 }, after: { y: 88 } });

      const conflicts = manager.detectConflicts(feat.id, main.id);
      expect(conflicts).toHaveLength(2);
    });

    it('returns conflicting fields sorted alphabetically', () => {
      const main = createTestBranch(manager, { name: 'main-sorted' });
      recordTestChange(manager, main.id, {
        entityId: 'e1',
        before: { z: 0, a: 0 },
        after: { z: 1, a: 1 },
      });
      const feat = createTestBranch(manager, { name: 'feat-sorted' });
      recordTestChange(manager, feat.id, {
        entityId: 'e1',
        before: { z: 0, a: 0 },
        after: { z: 2, a: 2 },
      });

      const conflicts = manager.detectConflicts(feat.id, main.id);
      expect(conflicts[0].conflictingFields).toEqual(['a', 'z']);
    });
  });

  describe('resolveConflict', () => {
    it('sets resolution on matching conflict', () => {
      const conflicts: MergeConflict[] = [
        {
          entityId: 'e1',
          domain: 'architecture',
          entityLabel: 'Node 1',
          sourceChange: {} as BranchChange,
          targetChange: {} as BranchChange,
          conflictingFields: ['value'],
          resolution: null,
        },
      ];

      const resolved = manager.resolveConflict(conflicts, 'e1', 'architecture', 'keep_source');
      expect(resolved[0].resolution).toBe('keep_source');
    });

    it('does not mutate original array', () => {
      const conflicts: MergeConflict[] = [
        {
          entityId: 'e1',
          domain: 'bom',
          entityLabel: 'Item',
          sourceChange: {} as BranchChange,
          targetChange: {} as BranchChange,
          conflictingFields: ['qty'],
          resolution: null,
        },
      ];

      manager.resolveConflict(conflicts, 'e1', 'bom', 'keep_target');
      expect(conflicts[0].resolution).toBeNull();
    });

    it('only resolves the matching entity and domain', () => {
      const conflicts: MergeConflict[] = [
        {
          entityId: 'e1',
          domain: 'architecture',
          entityLabel: 'A',
          sourceChange: {} as BranchChange,
          targetChange: {} as BranchChange,
          conflictingFields: ['x'],
          resolution: null,
        },
        {
          entityId: 'e2',
          domain: 'bom',
          entityLabel: 'B',
          sourceChange: {} as BranchChange,
          targetChange: {} as BranchChange,
          conflictingFields: ['y'],
          resolution: null,
        },
      ];

      const resolved = manager.resolveConflict(conflicts, 'e1', 'architecture', 'keep_source');
      expect(resolved[0].resolution).toBe('keep_source');
      expect(resolved[1].resolution).toBeNull();
    });
  });

  describe('resolveAllConflicts', () => {
    it('resolves all conflicts with same strategy', () => {
      const conflicts: MergeConflict[] = [
        {
          entityId: 'e1',
          domain: 'architecture',
          entityLabel: 'A',
          sourceChange: {} as BranchChange,
          targetChange: {} as BranchChange,
          conflictingFields: ['x'],
          resolution: null,
        },
        {
          entityId: 'e2',
          domain: 'bom',
          entityLabel: 'B',
          sourceChange: {} as BranchChange,
          targetChange: {} as BranchChange,
          conflictingFields: ['y'],
          resolution: null,
        },
      ];

      const resolved = manager.resolveAllConflicts(conflicts, 'keep_target');
      expect(resolved.every((c) => c.resolution === 'keep_target')).toBe(true);
    });

    it('does not mutate original array', () => {
      const conflicts: MergeConflict[] = [
        {
          entityId: 'e1',
          domain: 'architecture',
          entityLabel: 'A',
          sourceChange: {} as BranchChange,
          targetChange: {} as BranchChange,
          conflictingFields: ['x'],
          resolution: null,
        },
      ];

      manager.resolveAllConflicts(conflicts, 'keep_source');
      expect(conflicts[0].resolution).toBeNull();
    });
  });

  // =========================================================================
  // Review workflow
  // =========================================================================

  describe('requestReview', () => {
    it('creates a review and transitions to review_requested', () => {
      const b = createTestBranch(manager);
      recordTestChange(manager, b.id);
      const review = manager.requestReview(b.id, 'alice');

      expect(review.requestedBy).toBe('alice');
      expect(review.requestedAt).toBeGreaterThan(0);
      expect(review.comments).toEqual([]);
      expect(review.resolvedAt).toBeNull();
      expect(review.resolution).toBeNull();
      expect(manager.getBranch(b.id)!.state).toBe('review_requested');
    });

    it('throws for unknown branch', () => {
      expect(() => manager.requestReview('nope', 'a')).toThrow('not found');
    });

    it('throws for branch with no changes', () => {
      const b = createTestBranch(manager);
      expect(() => manager.requestReview(b.id, 'a')).toThrow('no changes');
    });

    it('throws for non-active branch', () => {
      const b = createTestBranch(manager);
      recordTestChange(manager, b.id);
      manager.requestReview(b.id, 'a');
      expect(() => manager.requestReview(b.id, 'a')).toThrow('Invalid state transition');
    });
  });

  describe('addReviewComment', () => {
    it('adds a comment to the review', () => {
      const b = createTestBranch(manager);
      recordTestChange(manager, b.id);
      manager.requestReview(b.id, 'alice');

      const comment = manager.addReviewComment(b.id, {
        author: 'bob',
        text: 'Looks good',
        disposition: 'approve',
      });

      expect(comment.id).toBeTruthy();
      expect(comment.author).toBe('bob');
      expect(comment.text).toBe('Looks good');
      expect(comment.disposition).toBe('approve');
      expect(comment.timestamp).toBeGreaterThan(0);

      const review = manager.getBranch(b.id)!.review!;
      expect(review.comments).toHaveLength(1);
    });

    it('throws when no review exists', () => {
      const b = createTestBranch(manager);
      expect(() =>
        manager.addReviewComment(b.id, { author: 'a', text: 'x', disposition: 'comment' }),
      ).toThrow('No review');
    });

    it('throws for unknown branch', () => {
      expect(() =>
        manager.addReviewComment('nope', { author: 'a', text: 'x', disposition: 'comment' }),
      ).toThrow('not found');
    });
  });

  describe('approveReview', () => {
    it('approves and transitions to approved state', () => {
      const b = createTestBranch(manager);
      recordTestChange(manager, b.id);
      manager.requestReview(b.id, 'alice');
      manager.approveReview(b.id, 'bob');

      const branch = manager.getBranch(b.id)!;
      expect(branch.state).toBe('approved');
      expect(branch.review!.resolution).toBe('approved');
      expect(branch.review!.resolvedBy).toBe('bob');
      expect(branch.review!.resolvedAt).toBeGreaterThan(0);
    });

    it('throws for branch without review', () => {
      const b = createTestBranch(manager);
      recordTestChange(manager, b.id);
      // Skip requestReview — go directly to approve should fail
      expect(() => manager.approveReview(b.id, 'bob')).toThrow('Invalid state transition');
    });
  });

  describe('rejectReview', () => {
    it('rejects and transitions to rejected state', () => {
      const b = createTestBranch(manager);
      recordTestChange(manager, b.id);
      manager.requestReview(b.id, 'alice');
      manager.rejectReview(b.id, 'bob', 'Needs more work');

      const branch = manager.getBranch(b.id)!;
      expect(branch.state).toBe('rejected');
      expect(branch.review!.resolution).toBe('rejected');
      expect(branch.review!.resolvedBy).toBe('bob');
      // Reason added as comment
      expect(branch.review!.comments).toHaveLength(1);
      expect(branch.review!.comments[0].text).toBe('Needs more work');
      expect(branch.review!.comments[0].disposition).toBe('request_changes');
    });

    it('works without reason', () => {
      const b = createTestBranch(manager);
      recordTestChange(manager, b.id);
      manager.requestReview(b.id, 'alice');
      manager.rejectReview(b.id, 'bob');

      expect(manager.getBranch(b.id)!.state).toBe('rejected');
      expect(manager.getBranch(b.id)!.review!.comments).toHaveLength(0);
    });
  });

  describe('reopenBranch', () => {
    it('moves rejected branch back to active', () => {
      const b = createTestBranch(manager);
      recordTestChange(manager, b.id);
      manager.requestReview(b.id, 'alice');
      manager.rejectReview(b.id, 'bob');
      manager.reopenBranch(b.id);

      const branch = manager.getBranch(b.id)!;
      expect(branch.state).toBe('active');
      expect(branch.review).toBeNull();
    });

    it('throws for active branch', () => {
      const b = createTestBranch(manager);
      expect(() => manager.reopenBranch(b.id)).toThrow('Invalid state transition');
    });

    it('allows new changes after reopen', () => {
      const b = createTestBranch(manager);
      recordTestChange(manager, b.id);
      manager.requestReview(b.id, 'a');
      manager.rejectReview(b.id, 'b');
      manager.reopenBranch(b.id);
      const change = recordTestChange(manager, b.id, { entityId: 'new-after-reopen' });
      expect(change.entityId).toBe('new-after-reopen');
    });
  });

  // =========================================================================
  // Merge
  // =========================================================================

  describe('runMergePreCheck', () => {
    it('passes for approved branch with no conflicts', () => {
      const main = createTestBranch(manager, { name: 'main-pre' });
      const feat = createTestBranch(manager, { name: 'feat-pre' });
      recordTestChange(manager, feat.id);
      manager.requestReview(feat.id, 'a');
      manager.approveReview(feat.id, 'b');

      const check = manager.runMergePreCheck(feat.id, main.id);
      expect(check.canMerge).toBe(true);
      expect(check.errors).toHaveLength(0);
    });

    it('passes for active branch with no conflicts', () => {
      const main = createTestBranch(manager, { name: 'main-active' });
      const feat = createTestBranch(manager, { name: 'feat-active' });
      recordTestChange(manager, feat.id);

      const check = manager.runMergePreCheck(feat.id, main.id);
      expect(check.canMerge).toBe(true);
    });

    it('fails for review_requested source', () => {
      const main = createTestBranch(manager, { name: 'main-rr' });
      const feat = createTestBranch(manager, { name: 'feat-rr' });
      recordTestChange(manager, feat.id);
      manager.requestReview(feat.id, 'a');

      const check = manager.runMergePreCheck(feat.id, main.id);
      expect(check.canMerge).toBe(false);
      expect(check.errors.some((e) => e.includes('review_requested'))).toBe(true);
    });

    it('fails for merged target', () => {
      const main = createTestBranch(manager, { name: 'main-mt' });
      const feat1 = createTestBranch(manager, { name: 'feat1-mt' });
      recordTestChange(manager, feat1.id);
      manager.mergeBranch(feat1.id, main.id);

      const feat2 = createTestBranch(manager, { name: 'feat2-mt' });
      recordTestChange(manager, feat2.id, { entityId: 'e99' });
      const check = manager.runMergePreCheck(feat2.id, feat1.id);
      expect(check.canMerge).toBe(false);
      expect(check.errors.some((e) => e.includes('merged'))).toBe(true);
    });

    it('fails with unresolved conflicts', () => {
      const main = createTestBranch(manager, { name: 'main-uc' });
      recordTestChange(manager, main.id, { entityId: 'shared', before: { v: 0 }, after: { v: 1 } });
      const feat = createTestBranch(manager, { name: 'feat-uc' });
      recordTestChange(manager, feat.id, { entityId: 'shared', before: { v: 0 }, after: { v: 2 } });

      const check = manager.runMergePreCheck(feat.id, main.id);
      expect(check.canMerge).toBe(false);
      expect(check.unresolvedConflicts).toBe(1);
    });

    it('passes when all conflicts resolved', () => {
      const main = createTestBranch(manager, { name: 'main-rc' });
      recordTestChange(manager, main.id, { entityId: 'shared', before: { v: 0 }, after: { v: 1 } });
      const feat = createTestBranch(manager, { name: 'feat-rc' });
      recordTestChange(manager, feat.id, { entityId: 'shared', before: { v: 0 }, after: { v: 2 } });

      const conflicts = manager.detectConflicts(feat.id, main.id);
      const resolved = manager.resolveAllConflicts(conflicts, 'keep_source');

      const check = manager.runMergePreCheck(feat.id, main.id, resolved);
      expect(check.canMerge).toBe(true);
      expect(check.unresolvedConflicts).toBe(0);
    });

    it('warns about empty source', () => {
      const main = createTestBranch(manager, { name: 'main-empty' });
      const feat = createTestBranch(manager, { name: 'feat-empty' });

      const check = manager.runMergePreCheck(feat.id, main.id);
      expect(check.warnings.some((w) => w.includes('no changes'))).toBe(true);
    });

    it('warns about schematic without BOM', () => {
      const main = createTestBranch(manager, { name: 'main-warn' });
      const feat = createTestBranch(manager, { name: 'feat-warn' });
      recordTestChange(manager, feat.id, { domain: 'schematic', entityId: 'inst1' });

      const check = manager.runMergePreCheck(feat.id, main.id);
      expect(check.warnings.some((w) => w.includes('BOM'))).toBe(true);
    });

    it('warns about PCB without schematic', () => {
      const main = createTestBranch(manager, { name: 'main-pcb' });
      const feat = createTestBranch(manager, { name: 'feat-pcb' });
      recordTestChange(manager, feat.id, { domain: 'pcb', entityId: 'trace1' });

      const check = manager.runMergePreCheck(feat.id, main.id);
      expect(check.warnings.some((w) => w.includes('netlist'))).toBe(true);
    });

    it('fails for unknown source', () => {
      const main = createTestBranch(manager, { name: 'main-us' });
      const check = manager.runMergePreCheck('nope', main.id);
      expect(check.canMerge).toBe(false);
    });

    it('fails for unknown target', () => {
      const feat = createTestBranch(manager, { name: 'feat-ut' });
      const check = manager.runMergePreCheck(feat.id, 'nope');
      expect(check.canMerge).toBe(false);
    });
  });

  describe('mergeBranch', () => {
    it('merges source into target', () => {
      const main = createTestBranch(manager, { name: 'main-merge' });
      const feat = createTestBranch(manager, { name: 'feat-merge' });
      recordTestChange(manager, feat.id, { entityId: 'new-comp' });

      const result = manager.mergeBranch(feat.id, main.id);
      expect(result.success).toBe(true);
      expect(result.changesApplied).toBe(1);
      expect(result.errors).toEqual([]);
    });

    it('sets source to merged state', () => {
      const main = createTestBranch(manager, { name: 'main-state' });
      const feat = createTestBranch(manager, { name: 'feat-state' });
      recordTestChange(manager, feat.id);

      manager.mergeBranch(feat.id, main.id);
      expect(manager.getBranch(feat.id)!.state).toBe('merged');
    });

    it('applies source changes to target', () => {
      const main = createTestBranch(manager, { name: 'main-apply' });
      const feat = createTestBranch(manager, { name: 'feat-apply' });
      recordTestChange(manager, feat.id, { entityId: 'e1' });
      recordTestChange(manager, feat.id, { entityId: 'e2' });

      manager.mergeBranch(feat.id, main.id);
      expect(manager.getChanges(main.id).length).toBeGreaterThanOrEqual(2);
    });

    it('switches active branch to target if source was active', () => {
      const main = createTestBranch(manager, { name: 'main-switch' });
      const feat = createTestBranch(manager, { name: 'feat-switch' });
      recordTestChange(manager, feat.id);
      expect(manager.getSnapshot().activeBranchId).toBe(feat.id);

      manager.mergeBranch(feat.id, main.id);
      expect(manager.getSnapshot().activeBranchId).toBe(main.id);
    });

    it('fails when pre-check fails', () => {
      const main = createTestBranch(manager, { name: 'main-fail' });
      recordTestChange(manager, main.id, { entityId: 'shared', before: { v: 0 }, after: { v: 1 } });
      const feat = createTestBranch(manager, { name: 'feat-fail' });
      recordTestChange(manager, feat.id, { entityId: 'shared', before: { v: 0 }, after: { v: 2 } });

      const result = manager.mergeBranch(feat.id, main.id);
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      // Source should NOT be merged
      expect(manager.getBranch(feat.id)!.state).toBe('active');
    });

    it('respects keep_source conflict resolution', () => {
      const main = createTestBranch(manager, { name: 'main-ks' });
      recordTestChange(manager, main.id, { entityId: 'shared', before: { v: 0 }, after: { v: 1 } });
      const feat = createTestBranch(manager, { name: 'feat-ks' });
      recordTestChange(manager, feat.id, { entityId: 'shared', before: { v: 0 }, after: { v: 99 } });

      const conflicts = manager.detectConflicts(feat.id, main.id);
      const resolved = manager.resolveAllConflicts(conflicts, 'keep_source');

      const result = manager.mergeBranch(feat.id, main.id, resolved);
      expect(result.success).toBe(true);
      expect(result.conflictsResolved).toBe(1);
    });

    it('respects keep_target conflict resolution (skips source change)', () => {
      const main = createTestBranch(manager, { name: 'main-kt' });
      recordTestChange(manager, main.id, { entityId: 'shared', before: { v: 0 }, after: { v: 1 } });
      const feat = createTestBranch(manager, { name: 'feat-kt' });
      recordTestChange(manager, feat.id, { entityId: 'shared', before: { v: 0 }, after: { v: 99 } });

      const conflicts = manager.detectConflicts(feat.id, main.id);
      const resolved = manager.resolveAllConflicts(conflicts, 'keep_target');

      const result = manager.mergeBranch(feat.id, main.id, resolved);
      expect(result.success).toBe(true);
      // Source change was skipped, so 0 applied
      expect(result.changesApplied).toBe(0);
    });

    it('handles merge with multiple changes and one conflict', () => {
      const main = createTestBranch(manager, { name: 'main-mix' });
      recordTestChange(manager, main.id, { entityId: 'shared', before: { v: 0 }, after: { v: 1 } });
      const feat = createTestBranch(manager, { name: 'feat-mix' });
      recordTestChange(manager, feat.id, { entityId: 'shared', before: { v: 0 }, after: { v: 99 } });
      recordTestChange(manager, feat.id, { entityId: 'unique', before: null, after: { new: true } });

      const conflicts = manager.detectConflicts(feat.id, main.id);
      const resolved = manager.resolveAllConflicts(conflicts, 'keep_source');

      const result = manager.mergeBranch(feat.id, main.id, resolved);
      expect(result.success).toBe(true);
      expect(result.changesApplied).toBe(2);
      expect(result.conflictsResolved).toBe(1);
    });
  });

  // =========================================================================
  // Persistence
  // =========================================================================

  describe('localStorage persistence', () => {
    it('persists branches across instances', () => {
      const b = createTestBranch(manager, { name: 'persisted' });
      recordTestChange(manager, b.id);

      // Create a new instance (simulates page reload)
      DesignBranchManager.resetInstance();
      const manager2 = DesignBranchManager.getInstance();

      const snap = manager2.getSnapshot();
      expect(snap.branches).toHaveLength(1);
      expect(snap.branches[0].name).toBe('persisted');
      expect(snap.branches[0].changes).toHaveLength(1);
    });

    it('persists active branch ID', () => {
      const b = createTestBranch(manager, { name: 'active-persist' });
      DesignBranchManager.resetInstance();
      const manager2 = DesignBranchManager.getInstance();
      expect(manager2.getSnapshot().activeBranchId).toBe(b.id);
    });

    it('handles corrupted localStorage gracefully', () => {
      localStorage.setItem('protopulse:design-branches', '{invalid json!!!');
      DesignBranchManager.resetInstance();
      const m = DesignBranchManager.getInstance();
      expect(m.getSnapshot().branches).toEqual([]);
    });

    it('handles missing localStorage gracefully', () => {
      // Already cleared in beforeEach
      DesignBranchManager.resetInstance();
      const m = DesignBranchManager.getInstance();
      expect(m.getSnapshot().branches).toEqual([]);
    });
  });

  // =========================================================================
  // ALL_BRANCH_DOMAINS constant
  // =========================================================================

  describe('ALL_BRANCH_DOMAINS', () => {
    it('contains all 5 domains', () => {
      expect(ALL_BRANCH_DOMAINS).toHaveLength(5);
      expect(ALL_BRANCH_DOMAINS).toContain('architecture');
      expect(ALL_BRANCH_DOMAINS).toContain('schematic');
      expect(ALL_BRANCH_DOMAINS).toContain('bom');
      expect(ALL_BRANCH_DOMAINS).toContain('simulation');
      expect(ALL_BRANCH_DOMAINS).toContain('pcb');
    });

    it('is frozen (readonly)', () => {
      expect(() => {
        (ALL_BRANCH_DOMAINS as string[]).push('test');
      }).toThrow();
    });
  });

  // =========================================================================
  // State transition validation
  // =========================================================================

  describe('state transitions', () => {
    it('active → review_requested', () => {
      const b = createTestBranch(manager);
      recordTestChange(manager, b.id);
      manager.requestReview(b.id, 'a');
      expect(manager.getBranch(b.id)!.state).toBe('review_requested');
    });

    it('active → abandoned', () => {
      const b = createTestBranch(manager);
      manager.abandonBranch(b.id);
      expect(manager.getBranch(b.id)!.state).toBe('abandoned');
    });

    it('review_requested → approved', () => {
      const b = createTestBranch(manager);
      recordTestChange(manager, b.id);
      manager.requestReview(b.id, 'a');
      manager.approveReview(b.id, 'b');
      expect(manager.getBranch(b.id)!.state).toBe('approved');
    });

    it('review_requested → rejected', () => {
      const b = createTestBranch(manager);
      recordTestChange(manager, b.id);
      manager.requestReview(b.id, 'a');
      manager.rejectReview(b.id, 'b');
      expect(manager.getBranch(b.id)!.state).toBe('rejected');
    });

    it('review_requested → abandoned', () => {
      const b = createTestBranch(manager);
      recordTestChange(manager, b.id);
      manager.requestReview(b.id, 'a');
      manager.abandonBranch(b.id);
      expect(manager.getBranch(b.id)!.state).toBe('abandoned');
    });

    it('approved → merged (via mergeBranch)', () => {
      const main = createTestBranch(manager, { name: 'main-t' });
      const feat = createTestBranch(manager, { name: 'feat-t' });
      recordTestChange(manager, feat.id);
      manager.requestReview(feat.id, 'a');
      manager.approveReview(feat.id, 'b');
      manager.mergeBranch(feat.id, main.id);
      expect(manager.getBranch(feat.id)!.state).toBe('merged');
    });

    it('approved → abandoned', () => {
      const b = createTestBranch(manager);
      recordTestChange(manager, b.id);
      manager.requestReview(b.id, 'a');
      manager.approveReview(b.id, 'b');
      manager.abandonBranch(b.id);
      expect(manager.getBranch(b.id)!.state).toBe('abandoned');
    });

    it('rejected → active (via reopenBranch)', () => {
      const b = createTestBranch(manager);
      recordTestChange(manager, b.id);
      manager.requestReview(b.id, 'a');
      manager.rejectReview(b.id, 'b');
      manager.reopenBranch(b.id);
      expect(manager.getBranch(b.id)!.state).toBe('active');
    });

    it('rejected → abandoned', () => {
      const b = createTestBranch(manager);
      recordTestChange(manager, b.id);
      manager.requestReview(b.id, 'a');
      manager.rejectReview(b.id, 'b');
      manager.abandonBranch(b.id);
      expect(manager.getBranch(b.id)!.state).toBe('abandoned');
    });

    it('merged is terminal', () => {
      const main = createTestBranch(manager, { name: 'main-term' });
      const feat = createTestBranch(manager, { name: 'feat-term' });
      recordTestChange(manager, feat.id);
      manager.mergeBranch(feat.id, main.id);
      expect(() => manager.abandonBranch(feat.id)).toThrow('Invalid state transition');
    });

    it('abandoned is terminal', () => {
      const b = createTestBranch(manager);
      manager.abandonBranch(b.id);
      expect(() => manager.reopenBranch(b.id)).toThrow('Invalid state transition');
    });
  });

  // =========================================================================
  // Edge cases
  // =========================================================================

  describe('edge cases', () => {
    it('handles branch with changes in all 5 domains', () => {
      const b = createTestBranch(manager);
      const domains: BranchDomain[] = ['architecture', 'schematic', 'bom', 'simulation', 'pcb'];
      domains.forEach((domain, i) => {
        recordTestChange(manager, b.id, { domain, entityId: `e-${i}` });
      });
      expect(manager.getAffectedDomains(b.id)).toEqual(domains);
    });

    it('handles merge with no changes gracefully', () => {
      const main = createTestBranch(manager, { name: 'main-nc' });
      const feat = createTestBranch(manager, { name: 'feat-nc' });

      const result = manager.mergeBranch(feat.id, main.id);
      expect(result.success).toBe(true);
      expect(result.changesApplied).toBe(0);
    });

    it('handles multiple sequential merges into same target', () => {
      const main = createTestBranch(manager, { name: 'main-seq' });
      const feat1 = createTestBranch(manager, { name: 'feat1-seq' });
      recordTestChange(manager, feat1.id, { entityId: 'from-feat1' });
      manager.mergeBranch(feat1.id, main.id);

      const feat2 = createTestBranch(manager, { name: 'feat2-seq' });
      recordTestChange(manager, feat2.id, { entityId: 'from-feat2' });
      manager.mergeBranch(feat2.id, main.id);

      const mainChanges = manager.getChanges(main.id);
      expect(mainChanges.some((c) => c.entityId === 'from-feat1')).toBe(true);
      expect(mainChanges.some((c) => c.entityId === 'from-feat2')).toBe(true);
    });

    it('deduplicates entity changes across multiple recordings', () => {
      const b = createTestBranch(manager);
      recordTestChange(manager, b.id, { entityId: 'e1', after: { v: 1 } });
      recordTestChange(manager, b.id, { entityId: 'e1', after: { v: 2 } });
      recordTestChange(manager, b.id, { entityId: 'e1', after: { v: 3 } });

      const latest = manager.getLatestChangesByEntity(b.id);
      expect(latest.size).toBe(1);
      const entry = Array.from(latest.values())[0];
      expect(entry.after).toEqual({ v: 3 });
    });
  });

  // =========================================================================
  // Type exports verification
  // =========================================================================

  describe('type exports', () => {
    it('exports all required types', () => {
      // These would fail at compile time if types weren't exported
      const _domain: BranchDomain = 'architecture';
      const _resolution: ConflictResolution = 'keep_source';
      const _snapshot: BranchManagerSnapshot = {
        branches: [],
        activeBranchId: null,
        currentProjectId: null,
      };
      expect(_domain).toBe('architecture');
      expect(_resolution).toBe('keep_source');
      expect(_snapshot.branches).toEqual([]);
    });
  });
});
