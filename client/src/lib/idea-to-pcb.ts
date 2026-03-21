/**
 * BL-0450 — Idea-to-PCB Workflow Manager
 *
 * Orchestrates the complete journey from initial concept to ordered PCB across
 * 8 stages with 18 discrete steps.  Tracks progress, estimates time remaining,
 * and generates per-step recommendations so the user never has to wonder
 * "what do I do next?"
 *
 * Singleton + Subscribe pattern.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WorkflowStage =
  | 'ideation'
  | 'architecture'
  | 'schematic'
  | 'simulation'
  | 'pcb'
  | 'validation'
  | 'manufacturing'
  | 'ordering';

export type StepStatus = 'pending' | 'active' | 'completed' | 'skipped' | 'blocked';

export interface WorkflowStep {
  id: string;
  stage: WorkflowStage;
  name: string;
  description: string;
  status: StepStatus;
  /** Estimated minutes to complete this step. */
  estimatedMinutes: number;
  /** Prerequisites — step IDs that must be completed/skipped first. */
  prerequisites: string[];
  /** IDs of ProtoPulse view modes this step relates to. */
  relatedViews: string[];
  /** Free-form recommendations surfaced to the user. */
  recommendations: string[];
  /** Timestamp (epoch ms) when the step was completed, or null. */
  completedAt: number | null;
}

export interface StageInfo {
  stage: WorkflowStage;
  label: string;
  description: string;
  steps: string[]; // step IDs belonging to this stage
}

export interface WorkflowProgress {
  completedSteps: number;
  totalSteps: number;
  percentage: number;
  currentStage: WorkflowStage;
  estimatedMinutesRemaining: number;
}

export interface WorkflowRecommendation {
  stepId: string;
  priority: 'high' | 'medium' | 'low';
  message: string;
  action: string;
  relatedView?: string;
}

export interface WorkflowConfig {
  projectName: string;
  complexity: 'simple' | 'moderate' | 'complex';
  /** Skip simulation stages for simple projects. */
  skipSimulation: boolean;
  /** Skip ordering stage (design-only flow). */
  skipOrdering: boolean;
}

// ---------------------------------------------------------------------------
// Constants — Stage metadata
// ---------------------------------------------------------------------------

const STAGE_ORDER: WorkflowStage[] = [
  'ideation',
  'architecture',
  'schematic',
  'simulation',
  'pcb',
  'validation',
  'manufacturing',
  'ordering',
];

const STAGE_INFO: Record<WorkflowStage, Omit<StageInfo, 'steps'>> = {
  ideation: {
    stage: 'ideation',
    label: 'Ideation',
    description: 'Define project goals, requirements, and high-level approach',
  },
  architecture: {
    stage: 'architecture',
    label: 'Architecture',
    description: 'Design the system block diagram and select key components',
  },
  schematic: {
    stage: 'schematic',
    label: 'Schematic',
    description: 'Capture the full circuit schematic with component values',
  },
  simulation: {
    stage: 'simulation',
    label: 'Simulation',
    description: 'Verify circuit behavior with DC, AC, and transient analysis',
  },
  pcb: {
    stage: 'pcb',
    label: 'PCB Layout',
    description: 'Place components and route traces on the physical board',
  },
  validation: {
    stage: 'validation',
    label: 'Validation',
    description: 'Run DRC, ERC, and DFM checks to catch issues before fabrication',
  },
  manufacturing: {
    stage: 'manufacturing',
    label: 'Manufacturing Prep',
    description: 'Generate Gerbers, drill files, BOM, and pick-and-place data',
  },
  ordering: {
    stage: 'ordering',
    label: 'Ordering',
    description: 'Submit to a fab house and order components',
  },
};

// ---------------------------------------------------------------------------
// Complexity multipliers for time estimation
// ---------------------------------------------------------------------------

const COMPLEXITY_MULTIPLIERS: Record<WorkflowConfig['complexity'], number> = {
  simple: 0.6,
  moderate: 1.0,
  complex: 1.8,
};

// ---------------------------------------------------------------------------
// Default step definitions
// ---------------------------------------------------------------------------

interface StepDef {
  id: string;
  stage: WorkflowStage;
  name: string;
  description: string;
  estimatedMinutes: number;
  prerequisites: string[];
  relatedViews: string[];
}

const DEFAULT_STEPS: StepDef[] = [
  // ── Ideation ──────────────────────────────────────────────────────────
  {
    id: 'idea-define-goals',
    stage: 'ideation',
    name: 'Define project goals',
    description: 'Write down what the project should do and its key constraints',
    estimatedMinutes: 15,
    prerequisites: [],
    relatedViews: ['architecture'],
  },
  {
    id: 'idea-research',
    stage: 'ideation',
    name: 'Research reference designs',
    description: 'Look at existing designs and datasheets for inspiration',
    estimatedMinutes: 30,
    prerequisites: ['idea-define-goals'],
    relatedViews: ['knowledge'],
  },
  // ── Architecture ──────────────────────────────────────────────────────
  {
    id: 'arch-block-diagram',
    stage: 'architecture',
    name: 'Create block diagram',
    description: 'Add blocks for each subsystem and connect them',
    estimatedMinutes: 20,
    prerequisites: ['idea-define-goals'],
    relatedViews: ['architecture'],
  },
  {
    id: 'arch-select-components',
    stage: 'architecture',
    name: 'Select key components',
    description: 'Choose MCU, power supply, connectors, and other critical parts',
    estimatedMinutes: 45,
    prerequisites: ['arch-block-diagram'],
    relatedViews: ['architecture', 'bom'],
  },
  {
    id: 'arch-bom-initial',
    stage: 'architecture',
    name: 'Build initial BOM',
    description: 'Add all required components to the Bill of Materials',
    estimatedMinutes: 30,
    prerequisites: ['arch-select-components'],
    relatedViews: ['bom'],
  },
  // ── Schematic ─────────────────────────────────────────────────────────
  {
    id: 'sch-capture',
    stage: 'schematic',
    name: 'Capture schematic',
    description: 'Place components and draw all connections in the schematic editor',
    estimatedMinutes: 60,
    prerequisites: ['arch-bom-initial'],
    relatedViews: ['schematic'],
  },
  {
    id: 'sch-power-decoupling',
    stage: 'schematic',
    name: 'Add power and decoupling',
    description: 'Ensure every IC has decoupling caps and power connections',
    estimatedMinutes: 20,
    prerequisites: ['sch-capture'],
    relatedViews: ['schematic'],
  },
  {
    id: 'sch-net-labels',
    stage: 'schematic',
    name: 'Label nets and buses',
    description: 'Name all important signals for readability',
    estimatedMinutes: 10,
    prerequisites: ['sch-capture'],
    relatedViews: ['schematic'],
  },
  // ── Simulation ────────────────────────────────────────────────────────
  {
    id: 'sim-dc-analysis',
    stage: 'simulation',
    name: 'DC operating point',
    description: 'Verify voltages and currents at key nodes',
    estimatedMinutes: 15,
    prerequisites: ['sch-capture'],
    relatedViews: ['simulation'],
  },
  {
    id: 'sim-transient',
    stage: 'simulation',
    name: 'Transient analysis',
    description: 'Check time-domain behavior (startup, switching)',
    estimatedMinutes: 20,
    prerequisites: ['sim-dc-analysis'],
    relatedViews: ['simulation'],
  },
  // ── PCB ───────────────────────────────────────────────────────────────
  {
    id: 'pcb-board-setup',
    stage: 'pcb',
    name: 'Board setup',
    description: 'Define board outline, layer stackup, and design rules',
    estimatedMinutes: 15,
    prerequisites: ['sch-power-decoupling', 'sch-net-labels'],
    relatedViews: ['pcb'],
  },
  {
    id: 'pcb-placement',
    stage: 'pcb',
    name: 'Component placement',
    description: 'Arrange footprints for optimal signal flow and thermal performance',
    estimatedMinutes: 45,
    prerequisites: ['pcb-board-setup'],
    relatedViews: ['pcb'],
  },
  {
    id: 'pcb-routing',
    stage: 'pcb',
    name: 'Trace routing',
    description: 'Route all nets respecting impedance and clearance rules',
    estimatedMinutes: 60,
    prerequisites: ['pcb-placement'],
    relatedViews: ['pcb'],
  },
  {
    id: 'pcb-copper-pour',
    stage: 'pcb',
    name: 'Copper pour / ground planes',
    description: 'Add ground and power planes, thermal relief as needed',
    estimatedMinutes: 15,
    prerequisites: ['pcb-routing'],
    relatedViews: ['pcb'],
  },
  // ── Validation ────────────────────────────────────────────────────────
  {
    id: 'val-drc',
    stage: 'validation',
    name: 'Design Rule Check',
    description: 'Run DRC and fix all violations',
    estimatedMinutes: 20,
    prerequisites: ['pcb-copper-pour'],
    relatedViews: ['validation'],
  },
  {
    id: 'val-dfm',
    stage: 'validation',
    name: 'DFM check',
    description: 'Verify design meets manufacturer capabilities',
    estimatedMinutes: 15,
    prerequisites: ['val-drc'],
    relatedViews: ['validation'],
  },
  // ── Manufacturing ─────────────────────────────────────────────────────
  {
    id: 'mfg-generate',
    stage: 'manufacturing',
    name: 'Generate output files',
    description: 'Export Gerber, drill, BOM CSV, and pick-and-place files',
    estimatedMinutes: 10,
    prerequisites: ['val-dfm'],
    relatedViews: ['output'],
  },
  // ── Ordering ──────────────────────────────────────────────────────────
  {
    id: 'ord-submit',
    stage: 'ordering',
    name: 'Place order',
    description: 'Submit Gerbers to fab house and order components',
    estimatedMinutes: 15,
    prerequisites: ['mfg-generate'],
    relatedViews: ['ordering'],
  },
];

// ---------------------------------------------------------------------------
// IdeaToPcbManager — singleton
// ---------------------------------------------------------------------------

export class IdeaToPcbManager {
  private static instance: IdeaToPcbManager | null = null;

  private steps: Map<string, WorkflowStep> = new Map();
  private stages: StageInfo[] = [];
  private config: WorkflowConfig;
  private subscribers = new Set<() => void>();
  private createdAt: number;

  constructor(config?: Partial<WorkflowConfig>) {
    this.config = {
      projectName: config?.projectName ?? 'Untitled Project',
      complexity: config?.complexity ?? 'moderate',
      skipSimulation: config?.skipSimulation ?? false,
      skipOrdering: config?.skipOrdering ?? false,
    };
    this.createdAt = Date.now();
    this.initSteps();
  }

  static getInstance(config?: Partial<WorkflowConfig>): IdeaToPcbManager {
    if (!IdeaToPcbManager.instance) {
      IdeaToPcbManager.instance = new IdeaToPcbManager(config);
    }
    return IdeaToPcbManager.instance;
  }

  static resetInstance(): void {
    IdeaToPcbManager.instance = null;
  }

  // -----------------------------------------------------------------------
  // Subscribe
  // -----------------------------------------------------------------------

  subscribe(fn: () => void): () => void {
    this.subscribers.add(fn);
    return () => {
      this.subscribers.delete(fn);
    };
  }

  private notify(): void {
    this.subscribers.forEach((fn) => fn());
  }

  // -----------------------------------------------------------------------
  // Initialization
  // -----------------------------------------------------------------------

  private initSteps(): void {
    const multiplier = COMPLEXITY_MULTIPLIERS[this.config.complexity];

    DEFAULT_STEPS.forEach((def) => {
      const shouldSkip =
        (this.config.skipSimulation && def.stage === 'simulation') ||
        (this.config.skipOrdering && def.stage === 'ordering');

      const step: WorkflowStep = {
        id: def.id,
        stage: def.stage,
        name: def.name,
        description: def.description,
        status: shouldSkip ? 'skipped' : 'pending',
        estimatedMinutes: Math.round(def.estimatedMinutes * multiplier),
        prerequisites: def.prerequisites,
        relatedViews: def.relatedViews,
        recommendations: [],
        completedAt: null,
      };
      this.steps.set(def.id, step);
    });

    // Rebuild stage info
    this.stages = STAGE_ORDER.map((stage) => {
      const stepIds: string[] = [];
      this.steps.forEach((s) => {
        if (s.stage === stage) {
          stepIds.push(s.id);
        }
      });
      return { ...STAGE_INFO[stage], steps: stepIds };
    });

    this.updateBlockedStatuses();
    this.generateRecommendations();
  }

  // -----------------------------------------------------------------------
  // Step transitions
  // -----------------------------------------------------------------------

  completeStep(stepId: string): boolean {
    const step = this.steps.get(stepId);
    if (!step) { return false; }
    if (step.status === 'blocked') { return false; }
    if (step.status === 'completed') { return false; }
    if (step.status === 'skipped') { return false; }

    step.status = 'completed';
    step.completedAt = Date.now();

    this.updateBlockedStatuses();
    this.generateRecommendations();
    this.notify();
    return true;
  }

  skipStep(stepId: string): boolean {
    const step = this.steps.get(stepId);
    if (!step) { return false; }
    if (step.status === 'completed') { return false; }
    if (step.status === 'blocked') { return false; }

    step.status = 'skipped';
    step.completedAt = null;

    this.updateBlockedStatuses();
    this.generateRecommendations();
    this.notify();
    return true;
  }

  activateStep(stepId: string): boolean {
    const step = this.steps.get(stepId);
    if (!step) { return false; }
    if (step.status !== 'pending') { return false; }

    step.status = 'active';
    this.notify();
    return true;
  }

  resetStep(stepId: string): boolean {
    const step = this.steps.get(stepId);
    if (!step) { return false; }
    if (step.status === 'pending') { return false; }

    step.status = 'pending';
    step.completedAt = null;

    this.updateBlockedStatuses();
    this.generateRecommendations();
    this.notify();
    return true;
  }

  // -----------------------------------------------------------------------
  // Blocked-status propagation
  // -----------------------------------------------------------------------

  private updateBlockedStatuses(): void {
    this.steps.forEach((step) => {
      if (step.status === 'completed' || step.status === 'skipped') { return; }

      const unmetPrereqs = step.prerequisites.filter((preId) => {
        const pre = this.steps.get(preId);
        return pre && pre.status !== 'completed' && pre.status !== 'skipped';
      });

      if (unmetPrereqs.length > 0 && step.status !== 'blocked') {
        step.status = 'blocked';
      } else if (unmetPrereqs.length === 0 && step.status === 'blocked') {
        step.status = 'pending';
      }
    });
  }

  // -----------------------------------------------------------------------
  // Recommendations
  // -----------------------------------------------------------------------

  private generateRecommendations(): void {
    this.steps.forEach((step) => {
      step.recommendations = [];
    });

    // Find the first pending/active step per stage
    STAGE_ORDER.forEach((stage) => {
      const stageSteps = this.getStepsForStage(stage);
      const next = stageSteps.find((s) => s.status === 'pending' || s.status === 'active');
      if (next) {
        next.recommendations.push(`Start "${next.name}" to progress in ${STAGE_INFO[stage].label}`);
      }
    });

    // Warn about skipped simulation when complexity is high
    if (this.config.skipSimulation && this.config.complexity === 'complex') {
      const simSteps = this.getStepsForStage('simulation');
      simSteps.forEach((s) => {
        s.recommendations.push('Consider enabling simulation for complex designs to catch issues early');
      });
    }
  }

  getRecommendations(): WorkflowRecommendation[] {
    const recs: WorkflowRecommendation[] = [];

    // Active steps get high priority
    this.steps.forEach((step) => {
      if (step.status === 'active') {
        recs.push({
          stepId: step.id,
          priority: 'high',
          message: `Continue working on: ${step.name}`,
          action: `Open ${step.relatedViews[0] ?? 'architecture'} view`,
          relatedView: step.relatedViews[0],
        });
      }
    });

    // First pending step in current stage gets medium priority
    const progress = this.getProgress();
    const currentStageSteps = this.getStepsForStage(progress.currentStage);
    const nextPending = currentStageSteps.find((s) => s.status === 'pending');
    if (nextPending) {
      recs.push({
        stepId: nextPending.id,
        priority: 'medium',
        message: `Next step: ${nextPending.name}`,
        action: nextPending.description,
        relatedView: nextPending.relatedViews[0],
      });
    }

    // Remaining pending steps in later stages get low priority
    const currentIdx = STAGE_ORDER.indexOf(progress.currentStage);
    STAGE_ORDER.slice(currentIdx + 1).forEach((stage) => {
      const stageSteps = this.getStepsForStage(stage);
      const pending = stageSteps.find((s) => s.status === 'pending');
      if (pending) {
        recs.push({
          stepId: pending.id,
          priority: 'low',
          message: `Upcoming: ${pending.name}`,
          action: pending.description,
          relatedView: pending.relatedViews[0],
        });
      }
    });

    return recs;
  }

  // -----------------------------------------------------------------------
  // Progress
  // -----------------------------------------------------------------------

  getProgress(): WorkflowProgress {
    let completed = 0;
    let total = 0;
    let remainingMinutes = 0;

    this.steps.forEach((step) => {
      if (step.status === 'skipped') { return; }
      total++;
      if (step.status === 'completed') {
        completed++;
      } else {
        remainingMinutes += step.estimatedMinutes;
      }
    });

    const percentage = total === 0 ? 100 : Math.round((completed / total) * 100);

    // Current stage = first stage with incomplete steps
    let currentStage: WorkflowStage = 'ordering';
    for (const stage of STAGE_ORDER) {
      const stageSteps = this.getStepsForStage(stage);
      const hasIncomplete = stageSteps.some(
        (s) => s.status !== 'completed' && s.status !== 'skipped',
      );
      if (hasIncomplete) {
        currentStage = stage;
        break;
      }
    }

    return { completedSteps: completed, totalSteps: total, percentage, currentStage, estimatedMinutesRemaining: remainingMinutes };
  }

  // -----------------------------------------------------------------------
  // Time estimation
  // -----------------------------------------------------------------------

  getEstimatedTotalMinutes(): number {
    let total = 0;
    this.steps.forEach((step) => {
      if (step.status !== 'skipped') {
        total += step.estimatedMinutes;
      }
    });
    return total;
  }

  getElapsedMinutes(): number {
    return Math.round((Date.now() - this.createdAt) / 60_000);
  }

  // -----------------------------------------------------------------------
  // Queries
  // -----------------------------------------------------------------------

  getStep(stepId: string): WorkflowStep | undefined {
    const s = this.steps.get(stepId);
    return s ? { ...s, recommendations: [...s.recommendations] } : undefined;
  }

  getAllSteps(): WorkflowStep[] {
    const result: WorkflowStep[] = [];
    this.steps.forEach((s) => {
      result.push({ ...s, recommendations: [...s.recommendations] });
    });
    return result;
  }

  getStepsForStage(stage: WorkflowStage): WorkflowStep[] {
    const result: WorkflowStep[] = [];
    this.steps.forEach((s) => {
      if (s.stage === stage) {
        result.push({ ...s, recommendations: [...s.recommendations] });
      }
    });
    return result;
  }

  getStages(): StageInfo[] {
    return this.stages.map((s) => ({ ...s, steps: [...s.steps] }));
  }

  getConfig(): Readonly<WorkflowConfig> {
    return { ...this.config };
  }

  getCreatedAt(): number {
    return this.createdAt;
  }

  isComplete(): boolean {
    let allDone = true;
    this.steps.forEach((step) => {
      if (step.status !== 'completed' && step.status !== 'skipped') {
        allDone = false;
      }
    });
    return allDone;
  }

  // -----------------------------------------------------------------------
  // Bulk operations
  // -----------------------------------------------------------------------

  completeStage(stage: WorkflowStage): number {
    let count = 0;
    this.steps.forEach((step) => {
      if (step.stage === stage && step.status !== 'completed' && step.status !== 'skipped') {
        if (step.status !== 'blocked') {
          step.status = 'completed';
          step.completedAt = Date.now();
          count++;
        }
      }
    });
    this.updateBlockedStatuses();
    this.generateRecommendations();
    if (count > 0) { this.notify(); }
    return count;
  }

  skipStage(stage: WorkflowStage): number {
    let count = 0;
    this.steps.forEach((step) => {
      if (step.stage === stage && step.status !== 'completed') {
        step.status = 'skipped';
        step.completedAt = null;
        count++;
      }
    });
    this.updateBlockedStatuses();
    this.generateRecommendations();
    if (count > 0) { this.notify(); }
    return count;
  }

  resetAll(): void {
    this.initSteps();
    this.createdAt = Date.now();
    this.notify();
  }

  // -----------------------------------------------------------------------
  // Configuration updates
  // -----------------------------------------------------------------------

  updateConfig(updates: Partial<WorkflowConfig>): void {
    const oldSkipSim = this.config.skipSimulation;
    const oldSkipOrd = this.config.skipOrdering;
    const oldComplexity = this.config.complexity;

    if (updates.projectName !== undefined) { this.config.projectName = updates.projectName; }
    if (updates.complexity !== undefined) { this.config.complexity = updates.complexity; }
    if (updates.skipSimulation !== undefined) { this.config.skipSimulation = updates.skipSimulation; }
    if (updates.skipOrdering !== undefined) { this.config.skipOrdering = updates.skipOrdering; }

    // Re-apply skip statuses if toggles changed
    if (updates.skipSimulation !== undefined && updates.skipSimulation !== oldSkipSim) {
      this.steps.forEach((step) => {
        if (step.stage === 'simulation') {
          step.status = updates.skipSimulation ? 'skipped' : 'pending';
          step.completedAt = null;
        }
      });
    }
    if (updates.skipOrdering !== undefined && updates.skipOrdering !== oldSkipOrd) {
      this.steps.forEach((step) => {
        if (step.stage === 'ordering') {
          step.status = updates.skipOrdering ? 'skipped' : 'pending';
          step.completedAt = null;
        }
      });
    }

    // Re-calc time estimates if complexity changed
    if (updates.complexity !== undefined && updates.complexity !== oldComplexity) {
      const newMultiplier = COMPLEXITY_MULTIPLIERS[this.config.complexity];
      const oldMultiplier = COMPLEXITY_MULTIPLIERS[oldComplexity];
      this.steps.forEach((step) => {
        step.estimatedMinutes = Math.round((step.estimatedMinutes / oldMultiplier) * newMultiplier);
      });
    }

    this.updateBlockedStatuses();
    this.generateRecommendations();
    this.notify();
  }

  // -----------------------------------------------------------------------
  // Serialization
  // -----------------------------------------------------------------------

  serialize(): string {
    const stepArr: WorkflowStep[] = [];
    this.steps.forEach((s) => stepArr.push(s));
    return JSON.stringify({
      config: this.config,
      steps: stepArr,
      createdAt: this.createdAt,
    });
  }

  static deserialize(json: string): IdeaToPcbManager {
    const data = JSON.parse(json) as {
      config: WorkflowConfig;
      steps: WorkflowStep[];
      createdAt: number;
    };
    const mgr = new IdeaToPcbManager(data.config);
    mgr.createdAt = data.createdAt;

    data.steps.forEach((s) => {
      if (mgr.steps.has(s.id)) {
        const existing = mgr.steps.get(s.id)!;
        existing.status = s.status;
        existing.completedAt = s.completedAt;
        existing.recommendations = s.recommendations;
      }
    });

    mgr.updateBlockedStatuses();
    mgr.generateRecommendations();
    return mgr;
  }

  // -----------------------------------------------------------------------
  // Dependency graph
  // -----------------------------------------------------------------------

  getDependencyGraph(): Array<{ from: string; to: string }> {
    const edges: Array<{ from: string; to: string }> = [];
    this.steps.forEach((step) => {
      step.prerequisites.forEach((preId) => {
        edges.push({ from: preId, to: step.id });
      });
    });
    return edges;
  }

  getBlockersFor(stepId: string): string[] {
    const step = this.steps.get(stepId);
    if (!step) { return []; }
    return step.prerequisites.filter((preId) => {
      const pre = this.steps.get(preId);
      return pre && pre.status !== 'completed' && pre.status !== 'skipped';
    });
  }

  getDependentsOf(stepId: string): string[] {
    const deps: string[] = [];
    this.steps.forEach((step) => {
      if (step.prerequisites.includes(stepId)) {
        deps.push(step.id);
      }
    });
    return deps;
  }

  /**
   * Returns the critical path — the longest chain of pending/active steps.
   */
  getCriticalPath(): string[] {
    const memo = new Map<string, string[]>();

    const longestFrom = (id: string): string[] => {
      if (memo.has(id)) { return memo.get(id)!; }
      const step = this.steps.get(id);
      if (!step || step.status === 'completed' || step.status === 'skipped') {
        memo.set(id, []);
        return [];
      }

      const dependents = this.getDependentsOf(id);
      let best: string[] = [];
      dependents.forEach((depId) => {
        const path = longestFrom(depId);
        if (path.length > best.length) {
          best = path;
        }
      });

      const result = [id, ...best];
      memo.set(id, result);
      return result;
    };

    let criticalPath: string[] = [];
    this.steps.forEach((_step, id) => {
      const path = longestFrom(id);
      if (path.length > criticalPath.length) {
        criticalPath = path;
      }
    });

    return criticalPath;
  }
}
