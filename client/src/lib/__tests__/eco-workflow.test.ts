import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  EcoWorkflowManager,
  severityFromRiskScore,
  computeRiskScore,
  assessImpact,
  type EcoChange,
  type EcoState,
  type ChangeDomain,
  type CreateEcoData,
} from '../eco-workflow';

// ---------------------------------------------------------------------------
// Global mocks
// ---------------------------------------------------------------------------

let uuidCounter = 0;
vi.stubGlobal('crypto', {
  randomUUID: vi.fn(() => `uuid-${++uuidCounter}`),
});

const store: Record<string, string> = {};
vi.stubGlobal('localStorage', {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, val: string) => {
    store[key] = val;
  }),
  removeItem: vi.fn((key: string) => {
    delete store[key];
  }),
  clear: vi.fn(() => {
    for (const k of Object.keys(store)) {
      delete store[k];
    }
  }),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeChange(overrides: Partial<EcoChange> = {}): Omit<EcoChange, 'id'> {
  return {
    domain: 'schematic',
    changeType: 'modify',
    targetId: 'R1',
    targetLabel: 'R1 (10k)',
    description: 'Change R1 from 10k to 4.7k',
    before: { value: '10k' },
    after: { value: '4.7k' },
    ...overrides,
  };
}

function makeEcoData(overrides: Partial<CreateEcoData> = {}): CreateEcoData {
  return {
    projectId: 1,
    title: 'Swap resistor values',
    description: 'Adjust voltage divider for 3.3V output',
    ...overrides,
  };
}

/** Advance an ECO through draft→proposed→under_review, adding required change + review. */
function advanceToUnderReview(mgr: EcoWorkflowManager, ecoId: string): void {
  mgr.addChange(ecoId, makeChange());
  mgr.transition(ecoId, 'proposed');
  mgr.addReviewComment(ecoId, {
    author: 'reviewer',
    text: 'Looks good',
    disposition: 'comment',
  });
  mgr.transition(ecoId, 'under_review');
}

/** Advance an ECO all the way to approved. */
function advanceToApproved(mgr: EcoWorkflowManager, ecoId: string): void {
  advanceToUnderReview(mgr, ecoId);
  mgr.addReviewComment(ecoId, {
    author: 'lead',
    text: 'Approved',
    disposition: 'approve',
  });
  mgr.transition(ecoId, 'approved');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EcoWorkflowManager', () => {
  let mgr: EcoWorkflowManager;

  beforeEach(() => {
    localStorage.clear();
    EcoWorkflowManager.resetInstance();
    mgr = EcoWorkflowManager.getInstance();
  });

  // -------------------------------------------------------------------------
  // Singleton
  // -------------------------------------------------------------------------

  describe('singleton', () => {
    it('returns the same instance', () => {
      const a = EcoWorkflowManager.getInstance();
      const b = EcoWorkflowManager.getInstance();
      expect(a).toBe(b);
    });

    it('resetInstance creates a fresh instance', () => {
      const a = EcoWorkflowManager.getInstance();
      EcoWorkflowManager.resetInstance();
      const b = EcoWorkflowManager.getInstance();
      expect(a).not.toBe(b);
    });
  });

  // -------------------------------------------------------------------------
  // CRUD
  // -------------------------------------------------------------------------

  describe('createEco', () => {
    it('creates an ECO in draft state', () => {
      const eco = mgr.createEco(makeEcoData());
      expect(eco.state).toBe('draft');
      expect(eco.title).toBe('Swap resistor values');
      expect(eco.projectId).toBe(1);
      expect(eco.changes).toEqual([]);
      expect(eco.reviewComments).toEqual([]);
      expect(eco.designSnapshotId).toBeNull();
    });

    it('generates a unique ID', () => {
      const a = mgr.createEco(makeEcoData());
      const b = mgr.createEco(makeEcoData());
      expect(a.id).not.toBe(b.id);
    });

    it('sets timestamps', () => {
      const eco = mgr.createEco(makeEcoData());
      expect(eco.createdAt).toBeGreaterThan(0);
      expect(eco.updatedAt).toBe(eco.createdAt);
      expect(eco.proposedAt).toBeNull();
      expect(eco.reviewedAt).toBeNull();
      expect(eco.appliedAt).toBeNull();
      expect(eco.revertedAt).toBeNull();
    });

    it('initializes impact as none', () => {
      const eco = mgr.createEco(makeEcoData());
      expect(eco.impact.severity).toBe('none');
      expect(eco.impact.estimatedRiskScore).toBe(0);
      expect(eco.impact.affectedDomains).toEqual([]);
    });
  });

  describe('listEcos', () => {
    it('returns all ECOs', () => {
      mgr.createEco(makeEcoData({ projectId: 1 }));
      mgr.createEco(makeEcoData({ projectId: 2 }));
      expect(mgr.listEcos()).toHaveLength(2);
    });

    it('filters by projectId', () => {
      mgr.createEco(makeEcoData({ projectId: 1 }));
      mgr.createEco(makeEcoData({ projectId: 2 }));
      mgr.createEco(makeEcoData({ projectId: 1 }));
      expect(mgr.listEcos(1)).toHaveLength(2);
      expect(mgr.listEcos(2)).toHaveLength(1);
      expect(mgr.listEcos(99)).toHaveLength(0);
    });
  });

  describe('listByState', () => {
    it('filters by state', () => {
      const eco1 = mgr.createEco(makeEcoData());
      mgr.createEco(makeEcoData());
      mgr.addChange(eco1.id, makeChange());
      mgr.transition(eco1.id, 'proposed');
      expect(mgr.listByState('draft')).toHaveLength(1);
      expect(mgr.listByState('proposed')).toHaveLength(1);
    });

    it('filters by state and projectId', () => {
      const eco1 = mgr.createEco(makeEcoData({ projectId: 1 }));
      mgr.createEco(makeEcoData({ projectId: 2 }));
      mgr.addChange(eco1.id, makeChange());
      mgr.transition(eco1.id, 'proposed');
      expect(mgr.listByState('proposed', 1)).toHaveLength(1);
      expect(mgr.listByState('proposed', 2)).toHaveLength(0);
    });
  });

  describe('getEco', () => {
    it('returns the ECO by ID', () => {
      const eco = mgr.createEco(makeEcoData());
      expect(mgr.getEco(eco.id)).toBeDefined();
      expect(mgr.getEco(eco.id)!.title).toBe('Swap resistor values');
    });

    it('returns undefined for missing ID', () => {
      expect(mgr.getEco('nonexistent')).toBeUndefined();
    });
  });

  describe('updateEco', () => {
    it('updates title and description in draft state', () => {
      const eco = mgr.createEco(makeEcoData());
      const updated = mgr.updateEco(eco.id, {
        title: 'New title',
        description: 'New desc',
      });
      expect(updated).toBeDefined();
      expect(updated!.title).toBe('New title');
      expect(updated!.description).toBe('New desc');
    });

    it('returns undefined for non-draft ECOs', () => {
      const eco = mgr.createEco(makeEcoData());
      mgr.addChange(eco.id, makeChange());
      mgr.transition(eco.id, 'proposed');
      expect(mgr.updateEco(eco.id, { title: 'nope' })).toBeUndefined();
    });

    it('returns undefined for missing ECO', () => {
      expect(mgr.updateEco('nonexistent', { title: 'nope' })).toBeUndefined();
    });

    it('updates updatedAt timestamp', () => {
      const eco = mgr.createEco(makeEcoData());
      const before = eco.updatedAt;
      // Ensure clock advances
      vi.advanceTimersByTime?.(10);
      const updated = mgr.updateEco(eco.id, { title: 'Changed' });
      expect(updated!.updatedAt).toBeGreaterThanOrEqual(before);
    });
  });

  describe('deleteEco', () => {
    it('deletes a draft ECO', () => {
      const eco = mgr.createEco(makeEcoData());
      expect(mgr.deleteEco(eco.id)).toBe(true);
      expect(mgr.getEco(eco.id)).toBeUndefined();
      expect(mgr.listEcos()).toHaveLength(0);
    });

    it('deletes a rejected ECO', () => {
      const eco = mgr.createEco(makeEcoData());
      mgr.addChange(eco.id, makeChange());
      mgr.transition(eco.id, 'proposed');
      mgr.transition(eco.id, 'rejected');
      expect(mgr.deleteEco(eco.id)).toBe(true);
    });

    it('refuses to delete non-draft/non-rejected ECOs', () => {
      const eco = mgr.createEco(makeEcoData());
      mgr.addChange(eco.id, makeChange());
      mgr.transition(eco.id, 'proposed');
      expect(mgr.deleteEco(eco.id)).toBe(false);
    });

    it('returns false for missing ECO', () => {
      expect(mgr.deleteEco('nonexistent')).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Change tracking
  // -------------------------------------------------------------------------

  describe('addChange', () => {
    it('adds a change to a draft ECO', () => {
      const eco = mgr.createEco(makeEcoData());
      const change = mgr.addChange(eco.id, makeChange());
      expect(change).toBeDefined();
      expect(change!.id).toBeDefined();
      expect(mgr.getEco(eco.id)!.changes).toHaveLength(1);
    });

    it('generates unique IDs for changes', () => {
      const eco = mgr.createEco(makeEcoData());
      const c1 = mgr.addChange(eco.id, makeChange());
      const c2 = mgr.addChange(eco.id, makeChange({ targetId: 'C1' }));
      expect(c1!.id).not.toBe(c2!.id);
    });

    it('re-assesses impact after adding a change', () => {
      const eco = mgr.createEco(makeEcoData());
      mgr.addChange(eco.id, makeChange());
      const updated = mgr.getEco(eco.id)!;
      expect(updated.impact.estimatedRiskScore).toBeGreaterThan(0);
      expect(updated.impact.affectedDomains).toContain('schematic');
    });

    it('returns undefined for non-draft ECO', () => {
      const eco = mgr.createEco(makeEcoData());
      mgr.addChange(eco.id, makeChange());
      mgr.transition(eco.id, 'proposed');
      expect(mgr.addChange(eco.id, makeChange())).toBeUndefined();
    });

    it('returns undefined for missing ECO', () => {
      expect(mgr.addChange('nonexistent', makeChange())).toBeUndefined();
    });
  });

  describe('removeChange', () => {
    it('removes a change by ID', () => {
      const eco = mgr.createEco(makeEcoData());
      const change = mgr.addChange(eco.id, makeChange())!;
      expect(mgr.removeChange(eco.id, change.id)).toBe(true);
      expect(mgr.getEco(eco.id)!.changes).toHaveLength(0);
    });

    it('re-assesses impact after removal', () => {
      const eco = mgr.createEco(makeEcoData());
      const change = mgr.addChange(eco.id, makeChange())!;
      mgr.removeChange(eco.id, change.id);
      expect(mgr.getEco(eco.id)!.impact.estimatedRiskScore).toBe(0);
    });

    it('returns false for unknown change ID', () => {
      const eco = mgr.createEco(makeEcoData());
      expect(mgr.removeChange(eco.id, 'nonexistent')).toBe(false);
    });

    it('returns false for non-draft ECO', () => {
      const eco = mgr.createEco(makeEcoData());
      const change = mgr.addChange(eco.id, makeChange())!;
      mgr.transition(eco.id, 'proposed');
      expect(mgr.removeChange(eco.id, change.id)).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // State machine
  // -------------------------------------------------------------------------

  describe('state transitions', () => {
    it('draft → proposed (with changes)', () => {
      const eco = mgr.createEco(makeEcoData());
      mgr.addChange(eco.id, makeChange());
      const result = mgr.transition(eco.id, 'proposed');
      expect(result).toBeDefined();
      expect(result!.state).toBe('proposed');
      expect(result!.proposedAt).toBeGreaterThan(0);
    });

    it('draft → proposed rejected without changes', () => {
      const eco = mgr.createEco(makeEcoData());
      const result = mgr.transition(eco.id, 'proposed');
      expect(result).toBeUndefined();
    });

    it('proposed → under_review', () => {
      const eco = mgr.createEco(makeEcoData());
      mgr.addChange(eco.id, makeChange());
      mgr.transition(eco.id, 'proposed');
      const result = mgr.transition(eco.id, 'under_review');
      expect(result).toBeDefined();
      expect(result!.state).toBe('under_review');
    });

    it('proposed → rejected', () => {
      const eco = mgr.createEco(makeEcoData());
      mgr.addChange(eco.id, makeChange());
      mgr.transition(eco.id, 'proposed');
      const result = mgr.transition(eco.id, 'rejected');
      expect(result).toBeDefined();
      expect(result!.state).toBe('rejected');
      expect(result!.reviewedAt).toBeGreaterThan(0);
    });

    it('under_review → approved (with approval comment)', () => {
      const eco = mgr.createEco(makeEcoData());
      advanceToUnderReview(mgr, eco.id);
      mgr.addReviewComment(eco.id, {
        author: 'lead',
        text: 'Ship it',
        disposition: 'approve',
      });
      const result = mgr.transition(eco.id, 'approved');
      expect(result).toBeDefined();
      expect(result!.state).toBe('approved');
      expect(result!.reviewedAt).toBeGreaterThan(0);
    });

    it('under_review → approved rejected without approval comment', () => {
      const eco = mgr.createEco(makeEcoData());
      advanceToUnderReview(mgr, eco.id);
      // Only has a 'comment' disposition, not 'approve'
      const result = mgr.transition(eco.id, 'approved');
      expect(result).toBeUndefined();
    });

    it('under_review → rejected', () => {
      const eco = mgr.createEco(makeEcoData());
      advanceToUnderReview(mgr, eco.id);
      const result = mgr.transition(eco.id, 'rejected');
      expect(result).toBeDefined();
      expect(result!.state).toBe('rejected');
    });

    it('approved → applied', () => {
      const eco = mgr.createEco(makeEcoData());
      advanceToApproved(mgr, eco.id);
      const result = mgr.transition(eco.id, 'applied');
      expect(result).toBeDefined();
      expect(result!.state).toBe('applied');
      expect(result!.appliedAt).toBeGreaterThan(0);
    });

    it('approved → rejected (late rejection)', () => {
      const eco = mgr.createEco(makeEcoData());
      advanceToApproved(mgr, eco.id);
      const result = mgr.transition(eco.id, 'rejected');
      expect(result).toBeDefined();
      expect(result!.state).toBe('rejected');
    });

    it('applied → reverted', () => {
      const eco = mgr.createEco(makeEcoData());
      advanceToApproved(mgr, eco.id);
      mgr.transition(eco.id, 'applied');
      const result = mgr.transition(eco.id, 'reverted');
      expect(result).toBeDefined();
      expect(result!.state).toBe('reverted');
      expect(result!.revertedAt).toBeGreaterThan(0);
    });

    it('rejected is terminal', () => {
      const eco = mgr.createEco(makeEcoData());
      mgr.addChange(eco.id, makeChange());
      mgr.transition(eco.id, 'proposed');
      mgr.transition(eco.id, 'rejected');
      expect(mgr.transition(eco.id, 'draft')).toBeUndefined();
      expect(mgr.transition(eco.id, 'proposed')).toBeUndefined();
    });

    it('reverted is terminal', () => {
      const eco = mgr.createEco(makeEcoData());
      advanceToApproved(mgr, eco.id);
      mgr.transition(eco.id, 'applied');
      mgr.transition(eco.id, 'reverted');
      expect(mgr.transition(eco.id, 'applied')).toBeUndefined();
    });

    it('rejects invalid transitions', () => {
      const eco = mgr.createEco(makeEcoData());
      expect(mgr.transition(eco.id, 'approved')).toBeUndefined();
      expect(mgr.transition(eco.id, 'applied')).toBeUndefined();
      expect(mgr.transition(eco.id, 'reverted')).toBeUndefined();
    });

    it('returns undefined for missing ECO', () => {
      expect(mgr.transition('nonexistent', 'proposed')).toBeUndefined();
    });
  });

  describe('validateTransition', () => {
    it('returns valid for allowed transitions', () => {
      const eco = mgr.createEco(makeEcoData());
      mgr.addChange(eco.id, makeChange());
      const result = mgr.validateTransition(eco.id, 'proposed');
      expect(result.valid).toBe(true);
      expect(result.reason).toBeNull();
    });

    it('returns invalid with reason for disallowed transitions', () => {
      const eco = mgr.createEco(makeEcoData());
      const result = mgr.validateTransition(eco.id, 'applied');
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Cannot transition');
    });

    it('returns invalid for missing ECO', () => {
      const result = mgr.validateTransition('nonexistent', 'proposed');
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('ECO not found');
    });

    it('requires changes before proposing', () => {
      const eco = mgr.createEco(makeEcoData());
      const result = mgr.validateTransition(eco.id, 'proposed');
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('at least one change');
    });

    it('requires approval comment before approving', () => {
      const eco = mgr.createEco(makeEcoData());
      advanceToUnderReview(mgr, eco.id);
      const result = mgr.validateTransition(eco.id, 'approved');
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('approval');
    });
  });

  describe('getValidTransitions', () => {
    it('returns valid next states for draft', () => {
      const eco = mgr.createEco(makeEcoData());
      // No changes yet, so 'proposed' should not appear
      expect(mgr.getValidTransitions(eco.id)).toEqual([]);
      mgr.addChange(eco.id, makeChange());
      expect(mgr.getValidTransitions(eco.id)).toEqual(['proposed']);
    });

    it('returns valid next states for under_review', () => {
      const eco = mgr.createEco(makeEcoData());
      advanceToUnderReview(mgr, eco.id);
      // No approval comment yet — 'approved' filtered out
      expect(mgr.getValidTransitions(eco.id)).toEqual(['rejected']);
    });

    it('returns empty for terminal states', () => {
      const eco = mgr.createEco(makeEcoData());
      mgr.addChange(eco.id, makeChange());
      mgr.transition(eco.id, 'proposed');
      mgr.transition(eco.id, 'rejected');
      expect(mgr.getValidTransitions(eco.id)).toEqual([]);
    });

    it('returns empty for missing ECO', () => {
      expect(mgr.getValidTransitions('nonexistent')).toEqual([]);
    });
  });

  describe('isTerminal', () => {
    it('returns true for rejected', () => {
      const eco = mgr.createEco(makeEcoData());
      mgr.addChange(eco.id, makeChange());
      mgr.transition(eco.id, 'proposed');
      mgr.transition(eco.id, 'rejected');
      expect(mgr.isTerminal(eco.id)).toBe(true);
    });

    it('returns true for reverted', () => {
      const eco = mgr.createEco(makeEcoData());
      advanceToApproved(mgr, eco.id);
      mgr.transition(eco.id, 'applied');
      mgr.transition(eco.id, 'reverted');
      expect(mgr.isTerminal(eco.id)).toBe(true);
    });

    it('returns false for non-terminal states', () => {
      const eco = mgr.createEco(makeEcoData());
      expect(mgr.isTerminal(eco.id)).toBe(false);
    });

    it('returns false for missing ECO', () => {
      expect(mgr.isTerminal('nonexistent')).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Review comments
  // -------------------------------------------------------------------------

  describe('addReviewComment', () => {
    it('adds a comment to a proposed ECO', () => {
      const eco = mgr.createEco(makeEcoData());
      mgr.addChange(eco.id, makeChange());
      mgr.transition(eco.id, 'proposed');
      const comment = mgr.addReviewComment(eco.id, {
        author: 'reviewer',
        text: 'Needs more detail',
        disposition: 'request_changes',
      });
      expect(comment).toBeDefined();
      expect(comment!.timestamp).toBeGreaterThan(0);
      expect(mgr.getEco(eco.id)!.reviewComments).toHaveLength(1);
    });

    it('adds a comment to an under_review ECO', () => {
      const eco = mgr.createEco(makeEcoData());
      advanceToUnderReview(mgr, eco.id);
      const comment = mgr.addReviewComment(eco.id, {
        author: 'approver',
        text: 'LGTM',
        disposition: 'approve',
      });
      expect(comment).toBeDefined();
    });

    it('returns undefined for draft ECO', () => {
      const eco = mgr.createEco(makeEcoData());
      expect(
        mgr.addReviewComment(eco.id, {
          author: 'x',
          text: 'y',
          disposition: 'comment',
        }),
      ).toBeUndefined();
    });

    it('returns undefined for approved ECO', () => {
      const eco = mgr.createEco(makeEcoData());
      advanceToApproved(mgr, eco.id);
      expect(
        mgr.addReviewComment(eco.id, {
          author: 'x',
          text: 'y',
          disposition: 'comment',
        }),
      ).toBeUndefined();
    });

    it('returns undefined for missing ECO', () => {
      expect(
        mgr.addReviewComment('nonexistent', {
          author: 'x',
          text: 'y',
          disposition: 'comment',
        }),
      ).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // Snapshot linking
  // -------------------------------------------------------------------------

  describe('linkSnapshot', () => {
    it('links a design snapshot to an ECO', () => {
      const eco = mgr.createEco(makeEcoData());
      expect(mgr.linkSnapshot(eco.id, 42)).toBe(true);
      expect(mgr.getEco(eco.id)!.designSnapshotId).toBe(42);
    });

    it('returns false for missing ECO', () => {
      expect(mgr.linkSnapshot('nonexistent', 42)).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Project stats
  // -------------------------------------------------------------------------

  describe('getProjectStats', () => {
    it('returns zeroed stats for empty project', () => {
      const stats = mgr.getProjectStats(1);
      expect(stats.total).toBe(0);
      expect(stats.pendingReview).toBe(0);
      expect(stats.averageRiskScore).toBe(0);
    });

    it('counts ECOs by state', () => {
      const e1 = mgr.createEco(makeEcoData({ projectId: 1 }));
      mgr.createEco(makeEcoData({ projectId: 1 }));
      mgr.addChange(e1.id, makeChange());
      mgr.transition(e1.id, 'proposed');

      const stats = mgr.getProjectStats(1);
      expect(stats.total).toBe(2);
      expect(stats.byState.draft).toBe(1);
      expect(stats.byState.proposed).toBe(1);
      expect(stats.pendingReview).toBe(1);
    });

    it('computes average risk score', () => {
      const e1 = mgr.createEco(makeEcoData({ projectId: 1 }));
      const e2 = mgr.createEco(makeEcoData({ projectId: 1 }));
      mgr.addChange(e1.id, makeChange());
      mgr.addChange(e2.id, makeChange({ domain: 'firmware' }));
      const stats = mgr.getProjectStats(1);
      expect(stats.averageRiskScore).toBeGreaterThan(0);
    });

    it('excludes other projects', () => {
      mgr.createEco(makeEcoData({ projectId: 1 }));
      mgr.createEco(makeEcoData({ projectId: 2 }));
      expect(mgr.getProjectStats(1).total).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // Subscribe pattern
  // -------------------------------------------------------------------------

  describe('subscribe', () => {
    it('notifies listeners on create', () => {
      const fn = vi.fn();
      mgr.subscribe(fn);
      mgr.createEco(makeEcoData());
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('notifies listeners on transition', () => {
      const eco = mgr.createEco(makeEcoData());
      mgr.addChange(eco.id, makeChange());
      const fn = vi.fn();
      mgr.subscribe(fn);
      mgr.transition(eco.id, 'proposed');
      expect(fn).toHaveBeenCalled();
    });

    it('unsubscribe stops notifications', () => {
      const fn = vi.fn();
      const unsub = mgr.subscribe(fn);
      unsub();
      mgr.createEco(makeEcoData());
      expect(fn).not.toHaveBeenCalled();
    });

    it('increments version on mutations', () => {
      const v0 = mgr.version;
      mgr.createEco(makeEcoData());
      expect(mgr.version).toBe(v0 + 1);
    });
  });

  describe('getSnapshot', () => {
    it('returns current state and version', () => {
      mgr.createEco(makeEcoData());
      const snap = mgr.getSnapshot();
      expect(snap.ecos).toHaveLength(1);
      expect(snap.version).toBeGreaterThan(0);
    });

    it('returns a copy (not a reference)', () => {
      mgr.createEco(makeEcoData());
      const snap = mgr.getSnapshot();
      snap.ecos.pop();
      expect(mgr.listEcos()).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------------
  // Persistence
  // -------------------------------------------------------------------------

  describe('persistence', () => {
    it('persists to localStorage and restores', () => {
      const eco = mgr.createEco(makeEcoData());
      mgr.addChange(eco.id, makeChange());

      EcoWorkflowManager.resetInstance();
      const mgr2 = EcoWorkflowManager.getInstance();
      const restored = mgr2.getEco(eco.id);
      expect(restored).toBeDefined();
      expect(restored!.title).toBe('Swap resistor values');
      expect(restored!.changes).toHaveLength(1);
    });

    it('handles corrupted localStorage gracefully', () => {
      localStorage.setItem('protopulse-eco-workflows', '{{{invalid');
      EcoWorkflowManager.resetInstance();
      const mgr2 = EcoWorkflowManager.getInstance();
      expect(mgr2.listEcos()).toHaveLength(0);
    });

    it('handles empty localStorage', () => {
      EcoWorkflowManager.resetInstance();
      const mgr2 = EcoWorkflowManager.getInstance();
      expect(mgr2.listEcos()).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // Full lifecycle
  // -------------------------------------------------------------------------

  describe('full lifecycle', () => {
    it('draft → proposed → under_review → approved → applied → reverted', () => {
      const eco = mgr.createEco(makeEcoData());

      // Draft: add changes
      mgr.addChange(eco.id, makeChange());
      mgr.addChange(eco.id, makeChange({ domain: 'bom', targetId: 'BOM-1' }));
      expect(mgr.getEco(eco.id)!.changes).toHaveLength(2);

      // Propose
      const proposed = mgr.transition(eco.id, 'proposed')!;
      expect(proposed.state).toBe('proposed');
      expect(proposed.proposedAt).not.toBeNull();

      // Move to review
      mgr.transition(eco.id, 'under_review');
      expect(mgr.getEco(eco.id)!.state).toBe('under_review');

      // Add approval
      mgr.addReviewComment(eco.id, {
        author: 'lead',
        text: 'Good to go',
        disposition: 'approve',
      });

      // Approve
      const approved = mgr.transition(eco.id, 'approved')!;
      expect(approved.state).toBe('approved');

      // Apply
      const applied = mgr.transition(eco.id, 'applied')!;
      expect(applied.state).toBe('applied');
      expect(applied.appliedAt).not.toBeNull();

      // Revert
      const reverted = mgr.transition(eco.id, 'reverted')!;
      expect(reverted.state).toBe('reverted');
      expect(reverted.revertedAt).not.toBeNull();

      // Terminal
      expect(mgr.isTerminal(eco.id)).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// Pure function tests
// ---------------------------------------------------------------------------

describe('severityFromRiskScore', () => {
  it('returns none for 0', () => {
    expect(severityFromRiskScore(0)).toBe('none');
  });

  it('returns none for negative', () => {
    expect(severityFromRiskScore(-5)).toBe('none');
  });

  it('returns low for 1-20', () => {
    expect(severityFromRiskScore(1)).toBe('low');
    expect(severityFromRiskScore(20)).toBe('low');
  });

  it('returns medium for 21-50', () => {
    expect(severityFromRiskScore(21)).toBe('medium');
    expect(severityFromRiskScore(50)).toBe('medium');
  });

  it('returns high for 51-80', () => {
    expect(severityFromRiskScore(51)).toBe('high');
    expect(severityFromRiskScore(80)).toBe('high');
  });

  it('returns critical for 81+', () => {
    expect(severityFromRiskScore(81)).toBe('critical');
    expect(severityFromRiskScore(100)).toBe('critical');
  });
});

describe('computeRiskScore', () => {
  it('returns 0 for no changes', () => {
    expect(computeRiskScore([])).toBe(0);
  });

  it('scores single schematic modify', () => {
    const changes: EcoChange[] = [
      {
        id: '1',
        domain: 'schematic',
        changeType: 'modify',
        targetId: 'R1',
        targetLabel: 'R1',
        description: 'test',
        before: null,
        after: null,
      },
    ];
    const score = computeRiskScore(changes);
    expect(score).toBe(18); // 15 * 1.2 = 18
  });

  it('scores removals higher than adds', () => {
    const addChange: EcoChange = {
      id: '1',
      domain: 'schematic',
      changeType: 'add',
      targetId: 'R1',
      targetLabel: 'R1',
      description: 'test',
      before: null,
      after: null,
    };
    const removeChange: EcoChange = {
      id: '2',
      domain: 'schematic',
      changeType: 'remove',
      targetId: 'R1',
      targetLabel: 'R1',
      description: 'test',
      before: null,
      after: null,
    };
    expect(computeRiskScore([removeChange])).toBeGreaterThan(computeRiskScore([addChange]));
  });

  it('applies cross-domain multiplier', () => {
    const singleDomain: EcoChange[] = [
      {
        id: '1',
        domain: 'schematic',
        changeType: 'modify',
        targetId: 'R1',
        targetLabel: 'R1',
        description: 'test',
        before: null,
        after: null,
      },
      {
        id: '2',
        domain: 'schematic',
        changeType: 'modify',
        targetId: 'R2',
        targetLabel: 'R2',
        description: 'test',
        before: null,
        after: null,
      },
    ];
    const multiDomain: EcoChange[] = [
      {
        id: '1',
        domain: 'schematic',
        changeType: 'modify',
        targetId: 'R1',
        targetLabel: 'R1',
        description: 'test',
        before: null,
        after: null,
      },
      {
        id: '2',
        domain: 'firmware',
        changeType: 'modify',
        targetId: 'FW1',
        targetLabel: 'FW1',
        description: 'test',
        before: null,
        after: null,
      },
    ];
    expect(computeRiskScore(multiDomain)).toBeGreaterThan(computeRiskScore(singleDomain));
  });

  it('caps at 100', () => {
    const manyChanges: EcoChange[] = Array.from({ length: 20 }, (_, i) => ({
      id: String(i),
      domain: (['schematic', 'pcb', 'firmware', 'bom', 'simulation'] as ChangeDomain[])[i % 5],
      changeType: 'remove' as const,
      targetId: `T${i}`,
      targetLabel: `T${i}`,
      description: 'test',
      before: null,
      after: null,
    }));
    expect(computeRiskScore(manyChanges)).toBeLessThanOrEqual(100);
  });
});

describe('assessImpact', () => {
  it('returns none severity for empty changes', () => {
    const impact = assessImpact([]);
    expect(impact.severity).toBe('none');
    expect(impact.affectedDomains).toEqual([]);
    expect(impact.affectedComponentCount).toBe(0);
    expect(impact.affectedNetCount).toBe(0);
    expect(impact.notes).toEqual([]);
  });

  it('identifies affected domains', () => {
    const changes: EcoChange[] = [
      {
        id: '1',
        domain: 'schematic',
        changeType: 'modify',
        targetId: 'R1',
        targetLabel: 'R1',
        description: 'test',
        before: null,
        after: null,
      },
      {
        id: '2',
        domain: 'bom',
        changeType: 'modify',
        targetId: 'BOM-1',
        targetLabel: 'BOM-1',
        description: 'test',
        before: null,
        after: null,
      },
    ];
    const impact = assessImpact(changes);
    expect(impact.affectedDomains).toContain('schematic');
    expect(impact.affectedDomains).toContain('bom');
  });

  it('counts component changes (schematic + bom)', () => {
    const changes: EcoChange[] = [
      {
        id: '1',
        domain: 'schematic',
        changeType: 'modify',
        targetId: 'R1',
        targetLabel: 'R1',
        description: 'test',
        before: null,
        after: null,
      },
      {
        id: '2',
        domain: 'pcb',
        changeType: 'modify',
        targetId: 'PAD-1',
        targetLabel: 'PAD-1',
        description: 'test',
        before: null,
        after: null,
      },
    ];
    const impact = assessImpact(changes);
    expect(impact.affectedComponentCount).toBe(1); // only schematic
  });

  it('counts net changes (schematic add/remove only)', () => {
    const changes: EcoChange[] = [
      {
        id: '1',
        domain: 'schematic',
        changeType: 'add',
        targetId: 'NET1',
        targetLabel: 'NET1',
        description: 'test',
        before: null,
        after: null,
      },
      {
        id: '2',
        domain: 'schematic',
        changeType: 'modify',
        targetId: 'NET2',
        targetLabel: 'NET2',
        description: 'test',
        before: null,
        after: null,
      },
    ];
    const impact = assessImpact(changes);
    expect(impact.affectedNetCount).toBe(1); // only add, not modify
  });

  it('adds firmware note when firmware domain present', () => {
    const changes: EcoChange[] = [
      {
        id: '1',
        domain: 'firmware',
        changeType: 'modify',
        targetId: 'FW1',
        targetLabel: 'FW1',
        description: 'test',
        before: null,
        after: null,
      },
    ];
    const impact = assessImpact(changes);
    expect(impact.notes.some((n) => n.includes('Firmware'))).toBe(true);
  });

  it('adds cross-domain note when 3+ domains', () => {
    const changes: EcoChange[] = [
      { id: '1', domain: 'schematic', changeType: 'modify', targetId: 'a', targetLabel: 'a', description: '', before: null, after: null },
      { id: '2', domain: 'pcb', changeType: 'modify', targetId: 'b', targetLabel: 'b', description: '', before: null, after: null },
      { id: '3', domain: 'firmware', changeType: 'modify', targetId: 'c', targetLabel: 'c', description: '', before: null, after: null },
    ];
    const impact = assessImpact(changes);
    expect(impact.notes.some((n) => n.includes('Cross-domain'))).toBe(true);
  });

  it('adds removal note when removals present', () => {
    const changes: EcoChange[] = [
      { id: '1', domain: 'bom', changeType: 'remove', targetId: 'a', targetLabel: 'a', description: '', before: null, after: null },
    ];
    const impact = assessImpact(changes);
    expect(impact.notes.some((n) => n.includes('removals'))).toBe(true);
  });
});
