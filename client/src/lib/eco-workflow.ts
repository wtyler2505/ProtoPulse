/**
 * BL-0183 — ECO (Engineering Change Order) Workflow Manager
 *
 * Singleton+subscribe manager implementing a full ECO state machine:
 *   draft → proposed → under_review → approved/rejected → applied → reverted
 *
 * An ECO captures a set of design changes (component swaps, net modifications,
 * parameter tweaks) with impact assessment, review tracking, and rollback support.
 * Persists to localStorage. Integrates with netlist-diff types for change tracking.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** ECO lifecycle states. */
export type EcoState =
  | 'draft'
  | 'proposed'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'applied'
  | 'reverted';

/** Valid state transitions. */
const STATE_TRANSITIONS: Record<EcoState, EcoState[]> = {
  draft: ['proposed'],
  proposed: ['under_review', 'rejected'],
  under_review: ['approved', 'rejected'],
  approved: ['applied', 'rejected'],
  rejected: [],
  applied: ['reverted'],
  reverted: [],
};

/** Impact severity for a single change within an ECO. */
export type ImpactSeverity = 'none' | 'low' | 'medium' | 'high' | 'critical';

/** Domain affected by a change. */
export type ChangeDomain = 'schematic' | 'pcb' | 'bom' | 'firmware' | 'simulation';

/** A single tracked change within an ECO. */
export interface EcoChange {
  id: string;
  domain: ChangeDomain;
  changeType: 'add' | 'remove' | 'modify';
  targetId: string;
  targetLabel: string;
  description: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}

/** Impact assessment for an ECO. */
export interface EcoImpactAssessment {
  severity: ImpactSeverity;
  affectedDomains: ChangeDomain[];
  affectedComponentCount: number;
  affectedNetCount: number;
  estimatedRiskScore: number; // 0-100
  notes: string[];
}

/** A review comment on an ECO. */
export interface EcoReviewComment {
  id: string;
  author: string;
  text: string;
  timestamp: number;
  disposition: 'approve' | 'request_changes' | 'comment';
}

/** Full ECO record. */
export interface EcoRecord {
  id: string;
  projectId: number;
  title: string;
  description: string;
  state: EcoState;
  changes: EcoChange[];
  impact: EcoImpactAssessment;
  reviewComments: EcoReviewComment[];
  designSnapshotId: number | null;
  createdAt: number;
  updatedAt: number;
  proposedAt: number | null;
  reviewedAt: number | null;
  appliedAt: number | null;
  revertedAt: number | null;
}

/** Data required to create a new ECO. */
export interface CreateEcoData {
  projectId: number;
  title: string;
  description: string;
}

/** Snapshot returned by getSnapshot() for subscribe pattern. */
export interface EcoWorkflowSnapshot {
  ecos: EcoRecord[];
  version: number;
}

/** Validation result for a state transition. */
export interface TransitionValidation {
  valid: boolean;
  reason: string | null;
}

type Listener = () => void;

const STORAGE_KEY = 'protopulse-eco-workflows';

// ---------------------------------------------------------------------------
// Impact assessment helpers
// ---------------------------------------------------------------------------

/** Compute impact severity from a risk score. */
export function severityFromRiskScore(score: number): ImpactSeverity {
  if (score <= 0) {
    return 'none';
  }
  if (score <= 20) {
    return 'low';
  }
  if (score <= 50) {
    return 'medium';
  }
  if (score <= 80) {
    return 'high';
  }
  return 'critical';
}

/** Compute a risk score from a set of changes. */
export function computeRiskScore(changes: EcoChange[]): number {
  if (changes.length === 0) {
    return 0;
  }

  const domainWeights: Record<ChangeDomain, number> = {
    schematic: 15,
    pcb: 20,
    bom: 10,
    firmware: 25,
    simulation: 5,
  };

  const typeWeights: Record<string, number> = {
    add: 1.0,
    remove: 1.5,
    modify: 1.2,
  };

  let rawScore = 0;
  const seenDomains = new Set<ChangeDomain>();

  for (const change of changes) {
    seenDomains.add(change.domain);
    const domainWeight = domainWeights[change.domain];
    const typeWeight = typeWeights[change.changeType] ?? 1.0;
    rawScore += domainWeight * typeWeight;
  }

  // Cross-domain penalty: multiple domains affected increases risk
  const crossDomainMultiplier = 1 + (seenDomains.size - 1) * 0.15;

  return Math.min(100, Math.round(rawScore * crossDomainMultiplier));
}

/** Build a full impact assessment from changes. */
export function assessImpact(changes: EcoChange[]): EcoImpactAssessment {
  const affectedDomains = Array.from(new Set(changes.map((c) => c.domain)));
  const componentChanges = changes.filter(
    (c) => c.domain === 'schematic' || c.domain === 'bom',
  );
  const netChanges = changes.filter(
    (c) => c.domain === 'schematic' && (c.changeType === 'add' || c.changeType === 'remove'),
  );

  const riskScore = computeRiskScore(changes);
  const severity = severityFromRiskScore(riskScore);

  const notes: string[] = [];
  if (affectedDomains.length > 2) {
    notes.push(`Cross-domain change spanning ${affectedDomains.length} domains`);
  }
  if (changes.some((c) => c.domain === 'firmware')) {
    notes.push('Firmware changes require re-compilation and re-flash');
  }
  if (changes.filter((c) => c.changeType === 'remove').length > 0) {
    notes.push('Includes removals — verify no dangling references');
  }

  return {
    severity,
    affectedDomains,
    affectedComponentCount: componentChanges.length,
    affectedNetCount: netChanges.length,
    estimatedRiskScore: riskScore,
    notes,
  };
}

// ---------------------------------------------------------------------------
// EcoWorkflowManager
// ---------------------------------------------------------------------------

export class EcoWorkflowManager {
  private static instance: EcoWorkflowManager | null = null;

  private ecos: EcoRecord[] = [];
  private listeners = new Set<Listener>();
  private _version = 0;

  constructor() {
    this.load();
  }

  /** Get or create the singleton instance. */
  static getInstance(): EcoWorkflowManager {
    if (!EcoWorkflowManager.instance) {
      EcoWorkflowManager.instance = new EcoWorkflowManager();
    }
    return EcoWorkflowManager.instance;
  }

  /** Reset the singleton (useful for testing). */
  static resetInstance(): void {
    EcoWorkflowManager.instance = null;
  }

  /** Monotonic version counter for useSyncExternalStore integration. */
  get version(): number {
    return this._version;
  }

  // -----------------------------------------------------------------------
  // Query API
  // -----------------------------------------------------------------------

  /** Get a snapshot for the subscribe pattern. */
  getSnapshot(): EcoWorkflowSnapshot {
    return { ecos: [...this.ecos], version: this._version };
  }

  /** List all ECOs, optionally filtered by project. */
  listEcos(projectId?: number): EcoRecord[] {
    if (projectId !== undefined) {
      return this.ecos.filter((e) => e.projectId === projectId);
    }
    return [...this.ecos];
  }

  /** List ECOs filtered by state. */
  listByState(state: EcoState, projectId?: number): EcoRecord[] {
    return this.listEcos(projectId).filter((e) => e.state === state);
  }

  /** Get a single ECO by ID. */
  getEco(id: string): EcoRecord | undefined {
    return this.ecos.find((e) => e.id === id);
  }

  /** Check if a state transition is valid. */
  validateTransition(ecoId: string, targetState: EcoState): TransitionValidation {
    const eco = this.getEco(ecoId);
    if (!eco) {
      return { valid: false, reason: 'ECO not found' };
    }

    const allowed = STATE_TRANSITIONS[eco.state];
    if (!allowed.includes(targetState)) {
      return {
        valid: false,
        reason: `Cannot transition from '${eco.state}' to '${targetState}'`,
      };
    }

    // Require at least one change before proposing
    if (targetState === 'proposed' && eco.changes.length === 0) {
      return { valid: false, reason: 'ECO must have at least one change before proposing' };
    }

    // Require at least one approval comment before approving
    if (targetState === 'approved') {
      const hasApproval = eco.reviewComments.some((c) => c.disposition === 'approve');
      if (!hasApproval) {
        return { valid: false, reason: 'ECO requires at least one approval before it can be approved' };
      }
    }

    return { valid: true, reason: null };
  }

  /** Get valid next states for an ECO. */
  getValidTransitions(ecoId: string): EcoState[] {
    const eco = this.getEco(ecoId);
    if (!eco) {
      return [];
    }
    return STATE_TRANSITIONS[eco.state].filter(
      (s) => this.validateTransition(ecoId, s).valid,
    );
  }

  /** Check if an ECO is in a terminal state. */
  isTerminal(ecoId: string): boolean {
    const eco = this.getEco(ecoId);
    if (!eco) {
      return false;
    }
    return STATE_TRANSITIONS[eco.state].length === 0;
  }

  // -----------------------------------------------------------------------
  // Mutation API
  // -----------------------------------------------------------------------

  /** Create a new ECO in draft state. */
  createEco(data: CreateEcoData): EcoRecord {
    const now = Date.now();
    const eco: EcoRecord = {
      id: crypto.randomUUID(),
      projectId: data.projectId,
      title: data.title,
      description: data.description,
      state: 'draft',
      changes: [],
      impact: {
        severity: 'none',
        affectedDomains: [],
        affectedComponentCount: 0,
        affectedNetCount: 0,
        estimatedRiskScore: 0,
        notes: [],
      },
      reviewComments: [],
      designSnapshotId: null,
      createdAt: now,
      updatedAt: now,
      proposedAt: null,
      reviewedAt: null,
      appliedAt: null,
      revertedAt: null,
    };
    this.ecos.push(eco);
    this.bump();
    return eco;
  }

  /** Update ECO metadata (title, description). Only allowed in draft state. */
  updateEco(id: string, data: Partial<Pick<EcoRecord, 'title' | 'description'>>): EcoRecord | undefined {
    const eco = this.getEco(id);
    if (!eco || eco.state !== 'draft') {
      return undefined;
    }
    if (data.title !== undefined) {
      eco.title = data.title;
    }
    if (data.description !== undefined) {
      eco.description = data.description;
    }
    eco.updatedAt = Date.now();
    this.bump();
    return { ...eco };
  }

  /** Delete an ECO. Only draft or rejected ECOs can be deleted. */
  deleteEco(id: string): boolean {
    const eco = this.getEco(id);
    if (!eco) {
      return false;
    }
    if (eco.state !== 'draft' && eco.state !== 'rejected') {
      return false;
    }
    this.ecos = this.ecos.filter((e) => e.id !== id);
    this.bump();
    return true;
  }

  /** Add a change to a draft ECO. Re-assesses impact automatically. */
  addChange(ecoId: string, change: Omit<EcoChange, 'id'>): EcoChange | undefined {
    const eco = this.getEco(ecoId);
    if (!eco || eco.state !== 'draft') {
      return undefined;
    }
    const fullChange: EcoChange = {
      ...change,
      id: crypto.randomUUID(),
    };
    eco.changes.push(fullChange);
    eco.impact = assessImpact(eco.changes);
    eco.updatedAt = Date.now();
    this.bump();
    return fullChange;
  }

  /** Remove a change from a draft ECO. Re-assesses impact. */
  removeChange(ecoId: string, changeId: string): boolean {
    const eco = this.getEco(ecoId);
    if (!eco || eco.state !== 'draft') {
      return false;
    }
    const before = eco.changes.length;
    eco.changes = eco.changes.filter((c) => c.id !== changeId);
    if (eco.changes.length === before) {
      return false;
    }
    eco.impact = assessImpact(eco.changes);
    eco.updatedAt = Date.now();
    this.bump();
    return true;
  }

  /** Transition an ECO to a new state. Returns the updated ECO or undefined on failure. */
  transition(ecoId: string, targetState: EcoState): EcoRecord | undefined {
    const validation = this.validateTransition(ecoId, targetState);
    if (!validation.valid) {
      return undefined;
    }

    const eco = this.getEco(ecoId);
    if (!eco) {
      return undefined;
    }

    const now = Date.now();
    eco.state = targetState;
    eco.updatedAt = now;

    // Set domain-specific timestamps
    if (targetState === 'proposed') {
      eco.proposedAt = now;
    } else if (targetState === 'approved' || targetState === 'rejected') {
      eco.reviewedAt = now;
    } else if (targetState === 'applied') {
      eco.appliedAt = now;
    } else if (targetState === 'reverted') {
      eco.revertedAt = now;
    }

    this.bump();
    return { ...eco };
  }

  /** Add a review comment to an ECO that is under review or proposed. */
  addReviewComment(
    ecoId: string,
    comment: Omit<EcoReviewComment, 'id' | 'timestamp'>,
  ): EcoReviewComment | undefined {
    const eco = this.getEco(ecoId);
    if (!eco) {
      return undefined;
    }
    if (eco.state !== 'proposed' && eco.state !== 'under_review') {
      return undefined;
    }
    const fullComment: EcoReviewComment = {
      ...comment,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    };
    eco.reviewComments.push(fullComment);
    eco.updatedAt = Date.now();
    this.bump();
    return fullComment;
  }

  /** Link an ECO to a design snapshot (for rollback). */
  linkSnapshot(ecoId: string, snapshotId: number): boolean {
    const eco = this.getEco(ecoId);
    if (!eco) {
      return false;
    }
    eco.designSnapshotId = snapshotId;
    eco.updatedAt = Date.now();
    this.bump();
    return true;
  }

  /** Get summary statistics for a project's ECOs. */
  getProjectStats(projectId: number): {
    total: number;
    byState: Record<EcoState, number>;
    pendingReview: number;
    averageRiskScore: number;
  } {
    const projectEcos = this.listEcos(projectId);

    const byState: Record<EcoState, number> = {
      draft: 0,
      proposed: 0,
      under_review: 0,
      approved: 0,
      rejected: 0,
      applied: 0,
      reverted: 0,
    };

    let totalRisk = 0;
    for (const eco of projectEcos) {
      byState[eco.state]++;
      totalRisk += eco.impact.estimatedRiskScore;
    }

    return {
      total: projectEcos.length,
      byState,
      pendingReview: byState.proposed + byState.under_review,
      averageRiskScore: projectEcos.length > 0
        ? Math.round(totalRisk / projectEcos.length)
        : 0,
    };
  }

  // -----------------------------------------------------------------------
  // Subscribe pattern
  // -----------------------------------------------------------------------

  /** Subscribe to changes. Returns an unsubscribe function. */
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  // -----------------------------------------------------------------------
  // Persistence
  // -----------------------------------------------------------------------

  private bump(): void {
    this._version++;
    this.persist();
    this.notify();
  }

  private notify(): void {
    this.listeners.forEach((fn) => fn());
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.ecos));
    } catch {
      // Storage quota exceeded or unavailable — silently degrade
    }
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.ecos = parsed as EcoRecord[];
        }
      }
    } catch {
      // Corrupted storage — start fresh
      this.ecos = [];
    }
  }
}
