/**
 * BL-0184 + BL-0185 — Design Branching & Merge Manager
 *
 * Singleton+subscribe manager implementing design branch lifecycle:
 *   - Create branches from current design state
 *   - Track changes per domain (architecture, schematic, bom, simulation, pcb)
 *   - Compute diffs between branch and target
 *   - Detect and resolve merge conflicts (same-entity changes)
 *   - Review workflow (request → approve/reject)
 *   - Merge with pre-checks and conflict resolution
 *   - Abandon branches
 *
 * Persists to localStorage. Pure module — no React/DOM dependencies.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Listener = () => void;

/** Domains that can be independently tracked in a branch. */
export type BranchDomain = 'architecture' | 'schematic' | 'bom' | 'simulation' | 'pcb';

/** All possible branch domains. */
export const ALL_BRANCH_DOMAINS: readonly BranchDomain[] = Object.freeze([
  'architecture',
  'schematic',
  'bom',
  'simulation',
  'pcb',
] as const);

/** Branch lifecycle states. */
export type BranchState = 'active' | 'review_requested' | 'approved' | 'rejected' | 'merged' | 'abandoned';

/** Valid state transitions for branches. */
const BRANCH_STATE_TRANSITIONS: Record<BranchState, BranchState[]> = {
  active: ['review_requested', 'abandoned'],
  review_requested: ['approved', 'rejected', 'abandoned'],
  approved: ['merged', 'abandoned'],
  rejected: ['active', 'abandoned'],
  merged: [],
  abandoned: [],
};

/** A single tracked change within a branch. */
export interface BranchChange {
  id: string;
  domain: BranchDomain;
  changeType: 'add' | 'remove' | 'modify';
  entityId: string;
  entityLabel: string;
  description: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  timestamp: number;
}

/** A field-level difference between source and target values. */
export interface FieldDiff {
  field: string;
  sourceValue: unknown;
  targetValue: unknown;
}

/** A diff entry for a single entity between source branch and target. */
export interface BranchDiffEntry {
  entityId: string;
  domain: BranchDomain;
  type: 'added' | 'removed' | 'modified';
  sourceLabel: string;
  fieldDiffs: FieldDiff[];
}

/** Result of computing a full diff between branch and target. */
export interface BranchDiff {
  branchId: string;
  targetBranchId: string;
  entries: BranchDiffEntry[];
  summary: BranchDiffSummary;
}

/** Summary statistics for a branch diff. */
export interface BranchDiffSummary {
  added: number;
  removed: number;
  modified: number;
  domainsAffected: BranchDomain[];
}

/** A merge conflict where both source and target modified the same entity. */
export interface MergeConflict {
  entityId: string;
  domain: BranchDomain;
  entityLabel: string;
  sourceChange: BranchChange;
  targetChange: BranchChange;
  conflictingFields: string[];
  resolution: ConflictResolution | null;
}

/** How to resolve a merge conflict. */
export type ConflictResolution = 'keep_source' | 'keep_target';

/** Review comment on a branch. */
export interface BranchReviewComment {
  id: string;
  author: string;
  text: string;
  timestamp: number;
  disposition: 'approve' | 'request_changes' | 'comment';
}

/** Review summary for a branch. */
export interface BranchReview {
  requestedAt: number;
  requestedBy: string;
  comments: BranchReviewComment[];
  resolvedAt: number | null;
  resolution: 'approved' | 'rejected' | null;
  resolvedBy: string | null;
}

/** Pre-check result before merging. */
export interface MergePreCheck {
  canMerge: boolean;
  unresolvedConflicts: number;
  warnings: string[];
  errors: string[];
}

/** Result of a merge operation. */
export interface MergeResult {
  success: boolean;
  mergedAt: number;
  changesApplied: number;
  conflictsResolved: number;
  errors: string[];
}

/** Full branch record. */
export interface DesignBranch {
  id: string;
  projectId: number;
  name: string;
  description: string;
  state: BranchState;
  parentBranchId: string | null;
  createdAt: number;
  createdBy: string;
  updatedAt: number;
  changes: BranchChange[];
  review: BranchReview | null;
}

/** Snapshot of manager state for subscribers. */
export interface BranchManagerSnapshot {
  branches: DesignBranch[];
  activeBranchId: string | null;
  currentProjectId: number | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let idCounter = 0;

/** Generate a unique ID. Uses crypto.randomUUID when available, fallback for tests. */
function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  idCounter += 1;
  return `branch-id-${Date.now()}-${idCounter}`;
}

const STORAGE_KEY = 'protopulse:design-branches';

/** Compute which fields differ between two records. */
function computeFieldDiffs(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): FieldDiff[] {
  if (!before && !after) {
    return [];
  }
  if (!before) {
    return Object.keys(after!).map((field) => ({
      field,
      sourceValue: undefined,
      targetValue: (after as Record<string, unknown>)[field],
    }));
  }
  if (!after) {
    return Object.keys(before).map((field) => ({
      field,
      sourceValue: before[field],
      targetValue: undefined,
    }));
  }

  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const diffs: FieldDiff[] = [];
  allKeys.forEach((field) => {
    const bVal = before[field];
    const aVal = after[field];
    if (JSON.stringify(bVal) !== JSON.stringify(aVal)) {
      diffs.push({ field, sourceValue: bVal, targetValue: aVal });
    }
  });
  return diffs;
}

/** Find overlapping fields between two change records. */
function findConflictingFields(source: BranchChange, target: BranchChange): string[] {
  const sourceFields = new Set<string>();
  const targetFields = new Set<string>();

  if (source.before && source.after) {
    Object.keys(source.after).forEach((k) => {
      if (JSON.stringify(source.before![k]) !== JSON.stringify(source.after![k])) {
        sourceFields.add(k);
      }
    });
  } else if (source.after) {
    Object.keys(source.after).forEach((k) => sourceFields.add(k));
  }

  if (target.before && target.after) {
    Object.keys(target.after).forEach((k) => {
      if (JSON.stringify(target.before![k]) !== JSON.stringify(target.after![k])) {
        targetFields.add(k);
      }
    });
  } else if (target.after) {
    Object.keys(target.after).forEach((k) => targetFields.add(k));
  }

  const conflicts: string[] = [];
  sourceFields.forEach((f) => {
    if (targetFields.has(f)) {
      conflicts.push(f);
    }
  });
  return conflicts.sort();
}

// ---------------------------------------------------------------------------
// DesignBranchManager
// ---------------------------------------------------------------------------

export class DesignBranchManager {
  private static instance: DesignBranchManager | null = null;

  private branches: Map<string, DesignBranch>;
  private activeBranchId: string | null;
  private currentProjectId: number | null;
  private subscribers: Set<Listener>;

  constructor() {
    this.branches = new Map();
    this.activeBranchId = null;
    this.currentProjectId = null;
    this.subscribers = new Set();
    this.load();
  }

  /** Get or create the singleton instance. */
  static getInstance(): DesignBranchManager {
    if (!DesignBranchManager.instance) {
      DesignBranchManager.instance = new DesignBranchManager();
    }
    return DesignBranchManager.instance;
  }

  /** Reset singleton (for testing). */
  static resetInstance(): void {
    DesignBranchManager.instance = null;
  }

  // -------------------------------------------------------------------------
  // Subscribe
  // -------------------------------------------------------------------------

  /** Subscribe to state changes. Returns unsubscribe function. */
  subscribe(listener: Listener): () => void {
    this.subscribers.add(listener);
    return () => {
      this.subscribers.delete(listener);
    };
  }

  /** Get current snapshot. */
  getSnapshot(): BranchManagerSnapshot {
    return {
      branches: Array.from(this.branches.values()),
      activeBranchId: this.activeBranchId,
      currentProjectId: this.currentProjectId,
    };
  }

  // -------------------------------------------------------------------------
  // Project scope
  // -------------------------------------------------------------------------

  /** Set the current project. Filters branches to this project. */
  setProject(projectId: number): void {
    this.currentProjectId = projectId;
    this.notify();
  }

  // -------------------------------------------------------------------------
  // Branch CRUD
  // -------------------------------------------------------------------------

  /** Create a new branch. */
  createBranch(opts: {
    projectId: number;
    name: string;
    description?: string;
    createdBy: string;
    parentBranchId?: string;
  }): DesignBranch {
    const name = opts.name.trim();
    if (!name) {
      throw new Error('Branch name cannot be empty');
    }

    // Check for duplicate names within the same project (active branches only)
    const existing = this.getBranchesForProject(opts.projectId);
    const duplicate = existing.find(
      (b) => b.name === name && b.state !== 'merged' && b.state !== 'abandoned',
    );
    if (duplicate) {
      throw new Error(`Branch "${name}" already exists in project ${opts.projectId}`);
    }

    const now = Date.now();
    const branch: DesignBranch = {
      id: generateId(),
      projectId: opts.projectId,
      name,
      description: opts.description ?? '',
      state: 'active',
      parentBranchId: opts.parentBranchId ?? null,
      createdAt: now,
      createdBy: opts.createdBy,
      updatedAt: now,
      changes: [],
      review: null,
    };

    this.branches.set(branch.id, branch);
    this.activeBranchId = branch.id;
    this.currentProjectId = opts.projectId;
    this.save();
    this.notify();
    return branch;
  }

  /** Get a branch by ID. */
  getBranch(branchId: string): DesignBranch | null {
    return this.branches.get(branchId) ?? null;
  }

  /** Get all branches for a project. */
  getBranchesForProject(projectId: number): DesignBranch[] {
    const result: DesignBranch[] = [];
    this.branches.forEach((b) => {
      if (b.projectId === projectId) {
        result.push(b);
      }
    });
    return result;
  }

  /** Switch to a different branch. */
  switchBranch(branchId: string): void {
    const branch = this.branches.get(branchId);
    if (!branch) {
      throw new Error(`Branch "${branchId}" not found`);
    }
    if (branch.state === 'merged' || branch.state === 'abandoned') {
      throw new Error(`Cannot switch to ${branch.state} branch "${branch.name}"`);
    }
    this.activeBranchId = branchId;
    this.currentProjectId = branch.projectId;
    this.save();
    this.notify();
  }

  /** Abandon a branch (terminal state). */
  abandonBranch(branchId: string): void {
    const branch = this.branches.get(branchId);
    if (!branch) {
      throw new Error(`Branch "${branchId}" not found`);
    }
    this.validateTransition(branch.state, 'abandoned');
    branch.state = 'abandoned';
    branch.updatedAt = Date.now();

    if (this.activeBranchId === branchId) {
      this.activeBranchId = null;
    }

    this.save();
    this.notify();
  }

  // -------------------------------------------------------------------------
  // Change tracking
  // -------------------------------------------------------------------------

  /** Record a change on a branch. */
  recordChange(branchId: string, change: Omit<BranchChange, 'id' | 'timestamp'>): BranchChange {
    const branch = this.branches.get(branchId);
    if (!branch) {
      throw new Error(`Branch "${branchId}" not found`);
    }
    if (branch.state !== 'active') {
      throw new Error(`Cannot record changes on branch in "${branch.state}" state`);
    }

    const fullChange: BranchChange = {
      ...change,
      id: generateId(),
      timestamp: Date.now(),
    };

    branch.changes.push(fullChange);
    branch.updatedAt = Date.now();
    this.save();
    this.notify();
    return fullChange;
  }

  /** Get all changes for a branch, optionally filtered by domain. */
  getChanges(branchId: string, domain?: BranchDomain): BranchChange[] {
    const branch = this.branches.get(branchId);
    if (!branch) {
      return [];
    }
    if (domain) {
      return branch.changes.filter((c) => c.domain === domain);
    }
    return [...branch.changes];
  }

  /** Get the latest change for each entity on a branch (deduplication). */
  getLatestChangesByEntity(branchId: string): Map<string, BranchChange> {
    const branch = this.branches.get(branchId);
    if (!branch) {
      return new Map();
    }
    const latest = new Map<string, BranchChange>();
    branch.changes.forEach((c) => {
      const key = `${c.domain}:${c.entityId}`;
      const existing = latest.get(key);
      if (!existing || c.timestamp >= existing.timestamp) {
        latest.set(key, c);
      }
    });
    return latest;
  }

  /** Get domains that have changes on a branch. */
  getAffectedDomains(branchId: string): BranchDomain[] {
    const branch = this.branches.get(branchId);
    if (!branch) {
      return [];
    }
    const domains = new Set<BranchDomain>();
    branch.changes.forEach((c) => domains.add(c.domain));
    return Array.from(domains).sort() as BranchDomain[];
  }

  // -------------------------------------------------------------------------
  // Diff computation
  // -------------------------------------------------------------------------

  /** Compute the diff between a source branch and a target branch. */
  computeDiff(sourceBranchId: string, targetBranchId: string): BranchDiff {
    const source = this.branches.get(sourceBranchId);
    const target = this.branches.get(targetBranchId);

    if (!source) {
      throw new Error(`Source branch "${sourceBranchId}" not found`);
    }
    if (!target) {
      throw new Error(`Target branch "${targetBranchId}" not found`);
    }

    const sourceLatest = this.getLatestChangesByEntity(sourceBranchId);
    const targetLatest = this.getLatestChangesByEntity(targetBranchId);

    const entries: BranchDiffEntry[] = [];
    const domainsAffected = new Set<BranchDomain>();

    // Changes in source not in target, or differing from target
    sourceLatest.forEach((sourceChange, key) => {
      const targetChange = targetLatest.get(key);
      domainsAffected.add(sourceChange.domain);

      if (!targetChange) {
        // Only in source
        entries.push({
          entityId: sourceChange.entityId,
          domain: sourceChange.domain,
          type: sourceChange.changeType === 'remove' ? 'removed' : sourceChange.changeType === 'add' ? 'added' : 'modified',
          sourceLabel: sourceChange.entityLabel,
          fieldDiffs: computeFieldDiffs(sourceChange.before, sourceChange.after),
        });
      } else {
        // Both have changes — compute field-level diff between the two after states
        const fieldDiffs = computeFieldDiffs(targetChange.after, sourceChange.after);
        if (fieldDiffs.length > 0) {
          entries.push({
            entityId: sourceChange.entityId,
            domain: sourceChange.domain,
            type: 'modified',
            sourceLabel: sourceChange.entityLabel,
            fieldDiffs,
          });
        }
      }
    });

    // Changes only in target (not in source)
    targetLatest.forEach((targetChange, key) => {
      if (!sourceLatest.has(key)) {
        domainsAffected.add(targetChange.domain);
        entries.push({
          entityId: targetChange.entityId,
          domain: targetChange.domain,
          type: targetChange.changeType === 'remove' ? 'removed' : targetChange.changeType === 'add' ? 'added' : 'modified',
          sourceLabel: targetChange.entityLabel,
          fieldDiffs: computeFieldDiffs(targetChange.before, targetChange.after),
        });
      }
    });

    const summary: BranchDiffSummary = {
      added: entries.filter((e) => e.type === 'added').length,
      removed: entries.filter((e) => e.type === 'removed').length,
      modified: entries.filter((e) => e.type === 'modified').length,
      domainsAffected: Array.from(domainsAffected).sort() as BranchDomain[],
    };

    return {
      branchId: sourceBranchId,
      targetBranchId,
      entries,
      summary,
    };
  }

  // -------------------------------------------------------------------------
  // Conflict detection & resolution
  // -------------------------------------------------------------------------

  /** Detect merge conflicts between source and target branches. */
  detectConflicts(sourceBranchId: string, targetBranchId: string): MergeConflict[] {
    const sourceLatest = this.getLatestChangesByEntity(sourceBranchId);
    const targetLatest = this.getLatestChangesByEntity(targetBranchId);
    const conflicts: MergeConflict[] = [];

    sourceLatest.forEach((sourceChange, key) => {
      const targetChange = targetLatest.get(key);
      if (!targetChange) {
        return;
      }

      // Both branches modified the same entity
      const conflictingFields = findConflictingFields(sourceChange, targetChange);
      if (conflictingFields.length > 0) {
        conflicts.push({
          entityId: sourceChange.entityId,
          domain: sourceChange.domain,
          entityLabel: sourceChange.entityLabel,
          sourceChange,
          targetChange,
          conflictingFields,
          resolution: null,
        });
      }
    });

    return conflicts;
  }

  /** Resolve a conflict with the given strategy. Returns updated conflicts. */
  resolveConflict(
    conflicts: MergeConflict[],
    entityId: string,
    domain: BranchDomain,
    resolution: ConflictResolution,
  ): MergeConflict[] {
    return conflicts.map((c) => {
      if (c.entityId === entityId && c.domain === domain) {
        return { ...c, resolution };
      }
      return c;
    });
  }

  /** Resolve all conflicts with the same strategy. */
  resolveAllConflicts(
    conflicts: MergeConflict[],
    resolution: ConflictResolution,
  ): MergeConflict[] {
    return conflicts.map((c) => ({ ...c, resolution }));
  }

  // -------------------------------------------------------------------------
  // Review workflow
  // -------------------------------------------------------------------------

  /** Request a review on a branch. */
  requestReview(branchId: string, requestedBy: string): BranchReview {
    const branch = this.branches.get(branchId);
    if (!branch) {
      throw new Error(`Branch "${branchId}" not found`);
    }
    this.validateTransition(branch.state, 'review_requested');

    if (branch.changes.length === 0) {
      throw new Error('Cannot request review on a branch with no changes');
    }

    const review: BranchReview = {
      requestedAt: Date.now(),
      requestedBy,
      comments: [],
      resolvedAt: null,
      resolution: null,
      resolvedBy: null,
    };

    branch.review = review;
    branch.state = 'review_requested';
    branch.updatedAt = Date.now();
    this.save();
    this.notify();
    return review;
  }

  /** Add a review comment. */
  addReviewComment(
    branchId: string,
    comment: Omit<BranchReviewComment, 'id' | 'timestamp'>,
  ): BranchReviewComment {
    const branch = this.branches.get(branchId);
    if (!branch) {
      throw new Error(`Branch "${branchId}" not found`);
    }
    if (!branch.review) {
      throw new Error('No review in progress');
    }
    if (branch.state !== 'review_requested') {
      throw new Error(`Cannot add comments in "${branch.state}" state`);
    }

    const fullComment: BranchReviewComment = {
      ...comment,
      id: generateId(),
      timestamp: Date.now(),
    };

    branch.review.comments.push(fullComment);
    branch.updatedAt = Date.now();
    this.save();
    this.notify();
    return fullComment;
  }

  /** Approve a branch review. */
  approveReview(branchId: string, approvedBy: string): void {
    const branch = this.branches.get(branchId);
    if (!branch) {
      throw new Error(`Branch "${branchId}" not found`);
    }
    this.validateTransition(branch.state, 'approved');

    if (!branch.review) {
      throw new Error('No review in progress');
    }

    branch.review.resolvedAt = Date.now();
    branch.review.resolution = 'approved';
    branch.review.resolvedBy = approvedBy;
    branch.state = 'approved';
    branch.updatedAt = Date.now();
    this.save();
    this.notify();
  }

  /** Reject a branch review. */
  rejectReview(branchId: string, rejectedBy: string, reason?: string): void {
    const branch = this.branches.get(branchId);
    if (!branch) {
      throw new Error(`Branch "${branchId}" not found`);
    }
    this.validateTransition(branch.state, 'rejected');

    if (!branch.review) {
      throw new Error('No review in progress');
    }

    branch.review.resolvedAt = Date.now();
    branch.review.resolution = 'rejected';
    branch.review.resolvedBy = rejectedBy;

    if (reason) {
      branch.review.comments.push({
        id: generateId(),
        author: rejectedBy,
        text: reason,
        timestamp: Date.now(),
        disposition: 'request_changes',
      });
    }

    branch.state = 'rejected';
    branch.updatedAt = Date.now();
    this.save();
    this.notify();
  }

  /** Move a rejected branch back to active for rework. */
  reopenBranch(branchId: string): void {
    const branch = this.branches.get(branchId);
    if (!branch) {
      throw new Error(`Branch "${branchId}" not found`);
    }
    this.validateTransition(branch.state, 'active');

    branch.state = 'active';
    branch.review = null;
    branch.updatedAt = Date.now();
    this.save();
    this.notify();
  }

  // -------------------------------------------------------------------------
  // Merge
  // -------------------------------------------------------------------------

  /** Run pre-merge checks. */
  runMergePreCheck(
    sourceBranchId: string,
    targetBranchId: string,
    resolvedConflicts?: MergeConflict[],
  ): MergePreCheck {
    const source = this.branches.get(sourceBranchId);
    const target = this.branches.get(targetBranchId);
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!source) {
      errors.push(`Source branch "${sourceBranchId}" not found`);
      return { canMerge: false, unresolvedConflicts: 0, warnings, errors };
    }
    if (!target) {
      errors.push(`Target branch "${targetBranchId}" not found`);
      return { canMerge: false, unresolvedConflicts: 0, warnings, errors };
    }

    if (source.state !== 'approved' && source.state !== 'active') {
      errors.push(`Source branch must be in "active" or "approved" state (currently "${source.state}")`);
    }

    if (target.state === 'merged' || target.state === 'abandoned') {
      errors.push(`Target branch is "${target.state}" and cannot receive merges`);
    }

    if (source.changes.length === 0) {
      warnings.push('Source branch has no changes to merge');
    }

    // Detect conflicts
    const conflicts = this.detectConflicts(sourceBranchId, targetBranchId);
    let unresolvedConflicts = conflicts.length;

    if (resolvedConflicts) {
      const resolvedCount = resolvedConflicts.filter((c) => c.resolution !== null).length;
      unresolvedConflicts = conflicts.length - resolvedCount;
    }

    if (unresolvedConflicts > 0) {
      errors.push(`${unresolvedConflicts} unresolved conflict(s) must be resolved before merging`);
    }

    // Cross-domain warnings
    const domains = this.getAffectedDomains(sourceBranchId);
    if (domains.includes('schematic') && !domains.includes('bom')) {
      warnings.push('Schematic changes without corresponding BOM updates — verify BOM is in sync');
    }
    if (domains.includes('pcb') && !domains.includes('schematic')) {
      warnings.push('PCB changes without schematic updates — verify netlist consistency');
    }

    return {
      canMerge: errors.length === 0,
      unresolvedConflicts,
      warnings,
      errors,
    };
  }

  /** Merge a source branch into a target branch. */
  mergeBranch(
    sourceBranchId: string,
    targetBranchId: string,
    resolvedConflicts?: MergeConflict[],
  ): MergeResult {
    const preCheck = this.runMergePreCheck(sourceBranchId, targetBranchId, resolvedConflicts);
    if (!preCheck.canMerge) {
      return {
        success: false,
        mergedAt: Date.now(),
        changesApplied: 0,
        conflictsResolved: 0,
        errors: preCheck.errors,
      };
    }

    const source = this.branches.get(sourceBranchId)!;
    const target = this.branches.get(targetBranchId)!;
    const conflicts = this.detectConflicts(sourceBranchId, targetBranchId);

    // Build a set of conflicting entity keys that are resolved
    const resolvedKeys = new Set<string>();
    let conflictsResolved = 0;
    if (resolvedConflicts) {
      resolvedConflicts.forEach((rc) => {
        if (rc.resolution !== null) {
          resolvedKeys.add(`${rc.domain}:${rc.entityId}`);
          conflictsResolved += 1;
        }
      });
    }

    // Apply source changes to target, respecting conflict resolutions
    const sourceLatest = this.getLatestChangesByEntity(sourceBranchId);
    let changesApplied = 0;
    const now = Date.now();

    sourceLatest.forEach((change, key) => {
      // Check if this entity has a conflict
      const conflict = conflicts.find(
        (c) => `${c.domain}:${c.entityId}` === key,
      );

      if (conflict) {
        const resolution = resolvedConflicts?.find(
          (rc) => rc.entityId === conflict.entityId && rc.domain === conflict.domain,
        );
        if (resolution?.resolution === 'keep_target') {
          // Skip source change, keep target's version
          return;
        }
        // keep_source: apply source change (fall through)
      }

      // Apply source change to target
      target.changes.push({
        ...change,
        id: generateId(),
        timestamp: now,
      });
      changesApplied += 1;
    });

    // Update states
    source.state = 'merged';
    source.updatedAt = now;
    target.updatedAt = now;

    if (this.activeBranchId === sourceBranchId) {
      this.activeBranchId = targetBranchId;
    }

    this.save();
    this.notify();

    return {
      success: true,
      mergedAt: now,
      changesApplied,
      conflictsResolved,
      errors: [],
    };
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  /** Validate a state transition. */
  private validateTransition(current: BranchState, target: BranchState): void {
    const allowed = BRANCH_STATE_TRANSITIONS[current];
    if (!allowed.includes(target)) {
      throw new Error(`Invalid state transition: "${current}" → "${target}"`);
    }
  }

  /** Notify all subscribers. */
  private notify(): void {
    this.subscribers.forEach((listener) => listener());
  }

  /** Save state to localStorage. */
  private save(): void {
    try {
      const data = {
        branches: Array.from(this.branches.entries()),
        activeBranchId: this.activeBranchId,
        currentProjectId: this.currentProjectId,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // localStorage not available (SSR/tests)
    }
  }

  /** Load state from localStorage. */
  private load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return;
      }
      const data = JSON.parse(raw) as {
        branches: [string, DesignBranch][];
        activeBranchId: string | null;
        currentProjectId: number | null;
      };
      this.branches = new Map(data.branches);
      this.activeBranchId = data.activeBranchId;
      this.currentProjectId = data.currentProjectId;
    } catch {
      // Invalid data or localStorage not available
    }
  }
}
