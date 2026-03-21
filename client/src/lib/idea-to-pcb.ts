/**
 * BL-0450 — Idea-to-PCB Workflow Manager
 *
 * Orchestrates the complete journey from initial concept to ordered PCB across
 * 8 stages with 18 discrete steps.  Tracks progress, estimates time remaining,
 * generates per-step recommendations, and exports a markdown session report.
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
  | 'pcb_layout'
  | 'validation'
  | 'manufacturing'
  | 'ordering';

export type StepStatus = 'pending' | 'active' | 'completed' | 'skipped' | 'blocked';

export interface StepResult {
  success: boolean;
  artifacts: string[];
  warnings: string[];
  blockers: string[];
  completedAt: number;
}

export interface WorkflowStep {
  id: string;
  stage: WorkflowStage;
  title: string;
  description: string;
  status: StepStatus;
  order: number;
  estimatedMinutes: number;
  automatable: boolean;
  completionCriteria: string[];
  result?: StepResult;
}

export interface IdeaToPcbSession {
  id: string;
  projectName: string;
  description: string;
  startedAt: number;
  currentStage: WorkflowStage;
  steps: WorkflowStep[];
  totalEstimatedMinutes: number;
  elapsedMinutes: number;
  completionPercent: number;
}

export interface WorkflowRecommendation {
  stepId: string;
  priority: 'high' | 'medium' | 'low';
  message: string;
  action: string;
  relatedView?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STAGE_ORDER: WorkflowStage[] = [
  'ideation',
  'architecture',
  'schematic',
  'simulation',
  'pcb_layout',
  'validation',
  'manufacturing',
  'ordering',
];

const STAGE_LABELS: Record<WorkflowStage, string> = {
  ideation: 'Ideation',
  architecture: 'Architecture',
  schematic: 'Schematic',
  simulation: 'Simulation',
  pcb_layout: 'PCB Layout',
  validation: 'Validation',
  manufacturing: 'Manufacturing Prep',
  ordering: 'Ordering',
};

// ---------------------------------------------------------------------------
// Step template
// ---------------------------------------------------------------------------

interface StepDef {
  id: string;
  stage: WorkflowStage;
  title: string;
  description: string;
  estimatedMinutes: number;
  automatable: boolean;
  completionCriteria: string[];
  /** Step IDs that must be completed/skipped before this step can start. */
  prerequisites: string[];
  relatedView?: string;
}

const STEP_DEFS: StepDef[] = [
  // ── Ideation ──────────────────────────────────────────────────────────
  {
    id: 'idea-define-goals',
    stage: 'ideation',
    title: 'Define project goals',
    description: 'Write down what the project should do and its key constraints',
    estimatedMinutes: 15,
    automatable: false,
    completionCriteria: ['Project goals documented', 'Key constraints identified'],
    prerequisites: [],
    relatedView: 'architecture',
  },
  {
    id: 'idea-research',
    stage: 'ideation',
    title: 'Research reference designs',
    description: 'Look at existing designs and datasheets for inspiration',
    estimatedMinutes: 30,
    automatable: false,
    completionCriteria: ['Reference designs reviewed', 'Key datasheets collected'],
    prerequisites: ['idea-define-goals'],
    relatedView: 'knowledge',
  },
  // ── Architecture ──────────────────────────────────────────────────────
  {
    id: 'arch-block-diagram',
    stage: 'architecture',
    title: 'Create block diagram',
    description: 'Add blocks for each subsystem and connect them',
    estimatedMinutes: 20,
    automatable: false,
    completionCriteria: ['All subsystems represented', 'Connections drawn'],
    prerequisites: ['idea-define-goals'],
    relatedView: 'architecture',
  },
  {
    id: 'arch-select-components',
    stage: 'architecture',
    title: 'Select key components',
    description: 'Choose MCU, power supply, connectors, and other critical parts',
    estimatedMinutes: 45,
    automatable: true,
    completionCriteria: ['MCU selected', 'Power solution chosen', 'Connectors specified'],
    prerequisites: ['arch-block-diagram'],
    relatedView: 'architecture',
  },
  {
    id: 'arch-bom-initial',
    stage: 'architecture',
    title: 'Build initial BOM',
    description: 'Add all required components to the Bill of Materials',
    estimatedMinutes: 30,
    automatable: true,
    completionCriteria: ['All components in BOM', 'Quantities specified'],
    prerequisites: ['arch-select-components'],
    relatedView: 'bom',
  },
  // ── Schematic ─────────────────────────────────────────────────────────
  {
    id: 'sch-capture',
    stage: 'schematic',
    title: 'Capture schematic',
    description: 'Place components and draw all connections in the schematic editor',
    estimatedMinutes: 60,
    automatable: false,
    completionCriteria: ['All components placed', 'All connections made'],
    prerequisites: ['arch-bom-initial'],
    relatedView: 'schematic',
  },
  {
    id: 'sch-power-decoupling',
    stage: 'schematic',
    title: 'Add power and decoupling',
    description: 'Ensure every IC has decoupling caps and power connections',
    estimatedMinutes: 20,
    automatable: true,
    completionCriteria: ['Decoupling caps on all ICs', 'Power rails connected'],
    prerequisites: ['sch-capture'],
    relatedView: 'schematic',
  },
  {
    id: 'sch-net-labels',
    stage: 'schematic',
    title: 'Label nets and buses',
    description: 'Name all important signals for readability',
    estimatedMinutes: 10,
    automatable: true,
    completionCriteria: ['All nets named', 'Bus labels applied'],
    prerequisites: ['sch-capture'],
    relatedView: 'schematic',
  },
  // ── Simulation ────────────────────────────────────────────────────────
  {
    id: 'sim-dc-analysis',
    stage: 'simulation',
    title: 'DC operating point',
    description: 'Verify voltages and currents at key nodes',
    estimatedMinutes: 15,
    automatable: true,
    completionCriteria: ['DC operating point converges', 'Key voltages verified'],
    prerequisites: ['sch-capture'],
    relatedView: 'simulation',
  },
  {
    id: 'sim-transient',
    stage: 'simulation',
    title: 'Transient analysis',
    description: 'Check time-domain behavior (startup, switching)',
    estimatedMinutes: 20,
    automatable: true,
    completionCriteria: ['Startup behavior verified', 'No oscillations detected'],
    prerequisites: ['sim-dc-analysis'],
    relatedView: 'simulation',
  },
  // ── PCB Layout ────────────────────────────────────────────────────────
  {
    id: 'pcb-board-setup',
    stage: 'pcb_layout',
    title: 'Board setup',
    description: 'Define board outline, layer stackup, and design rules',
    estimatedMinutes: 15,
    automatable: false,
    completionCriteria: ['Board outline defined', 'Layer stackup configured', 'Design rules set'],
    prerequisites: ['sch-power-decoupling', 'sch-net-labels'],
    relatedView: 'pcb',
  },
  {
    id: 'pcb-placement',
    stage: 'pcb_layout',
    title: 'Component placement',
    description: 'Arrange footprints for optimal signal flow and thermal performance',
    estimatedMinutes: 45,
    automatable: false,
    completionCriteria: ['All components placed', 'No courtyard violations'],
    prerequisites: ['pcb-board-setup'],
    relatedView: 'pcb',
  },
  {
    id: 'pcb-routing',
    stage: 'pcb_layout',
    title: 'Trace routing',
    description: 'Route all nets respecting impedance and clearance rules',
    estimatedMinutes: 60,
    automatable: true,
    completionCriteria: ['All nets routed', 'Impedance targets met'],
    prerequisites: ['pcb-placement'],
    relatedView: 'pcb',
  },
  {
    id: 'pcb-copper-pour',
    stage: 'pcb_layout',
    title: 'Copper pour / ground planes',
    description: 'Add ground and power planes, thermal relief as needed',
    estimatedMinutes: 15,
    automatable: true,
    completionCriteria: ['Ground plane filled', 'Thermal relief configured'],
    prerequisites: ['pcb-routing'],
    relatedView: 'pcb',
  },
  // ── Validation ────────────────────────────────────────────────────────
  {
    id: 'val-drc',
    stage: 'validation',
    title: 'Design Rule Check',
    description: 'Run DRC and fix all violations',
    estimatedMinutes: 20,
    automatable: true,
    completionCriteria: ['DRC passes with zero violations'],
    prerequisites: ['pcb-copper-pour'],
    relatedView: 'validation',
  },
  {
    id: 'val-dfm',
    stage: 'validation',
    title: 'DFM check',
    description: 'Verify design meets manufacturer capabilities',
    estimatedMinutes: 15,
    automatable: true,
    completionCriteria: ['DFM rules pass for target fab house'],
    prerequisites: ['val-drc'],
    relatedView: 'validation',
  },
  // ── Manufacturing ─────────────────────────────────────────────────────
  {
    id: 'mfg-generate',
    stage: 'manufacturing',
    title: 'Generate output files',
    description: 'Export Gerber, drill, BOM CSV, and pick-and-place files',
    estimatedMinutes: 10,
    automatable: true,
    completionCriteria: ['Gerber files generated', 'Drill file generated', 'BOM CSV exported', 'Pick-and-place file exported'],
    prerequisites: ['val-dfm'],
    relatedView: 'output',
  },
  // ── Ordering ──────────────────────────────────────────────────────────
  {
    id: 'ord-submit',
    stage: 'ordering',
    title: 'Place order',
    description: 'Submit Gerbers to fab house and order components',
    estimatedMinutes: 15,
    automatable: false,
    completionCriteria: ['PCB order submitted', 'Component order placed'],
    prerequisites: ['mfg-generate'],
    relatedView: 'ordering',
  },
];

// ---------------------------------------------------------------------------
// Prerequisite index — built once at module load
// ---------------------------------------------------------------------------

const STEP_PREREQS = new Map<string, string[]>();
const STEP_RELATED_VIEWS = new Map<string, string | undefined>();
STEP_DEFS.forEach((def) => {
  STEP_PREREQS.set(def.id, def.prerequisites);
  STEP_RELATED_VIEWS.set(def.id, def.relatedView);
});

// ---------------------------------------------------------------------------
// IdeaToPcbManager — singleton
// ---------------------------------------------------------------------------

export class IdeaToPcbManager {
  private static instance: IdeaToPcbManager | null = null;

  private sessions = new Map<string, IdeaToPcbSession>();
  private subscribers = new Set<() => void>();
  private nextSessionNum = 1;

  constructor() {
    // No-op — call startSession to begin a workflow
  }

  static getInstance(): IdeaToPcbManager {
    if (!IdeaToPcbManager.instance) {
      IdeaToPcbManager.instance = new IdeaToPcbManager();
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
  // Session management
  // -----------------------------------------------------------------------

  startSession(projectName: string, description: string): IdeaToPcbSession {
    const id = `session-${this.nextSessionNum++}`;
    const steps = this.buildSteps();
    const totalEstimatedMinutes = steps.reduce((sum, s) => sum + s.estimatedMinutes, 0);

    const session: IdeaToPcbSession = {
      id,
      projectName,
      description,
      startedAt: Date.now(),
      currentStage: 'ideation',
      steps,
      totalEstimatedMinutes,
      elapsedMinutes: 0,
      completionPercent: 0,
    };

    this.updateBlockedStatuses(session);
    this.sessions.set(id, session);
    this.notify();
    return this.cloneSession(session);
  }

  getSession(sessionId: string): IdeaToPcbSession | undefined {
    const s = this.sessions.get(sessionId);
    if (!s) { return undefined; }
    this.refreshSession(s);
    return this.cloneSession(s);
  }

  getAllSessions(): IdeaToPcbSession[] {
    const result: IdeaToPcbSession[] = [];
    this.sessions.forEach((s) => {
      this.refreshSession(s);
      result.push(this.cloneSession(s));
    });
    return result;
  }

  // -----------------------------------------------------------------------
  // Step generation
  // -----------------------------------------------------------------------

  getStepsForSession(): WorkflowStep[] {
    return this.buildSteps();
  }

  private buildSteps(): WorkflowStep[] {
    return STEP_DEFS.map((def, index) => ({
      id: def.id,
      stage: def.stage,
      title: def.title,
      description: def.description,
      status: 'pending' as StepStatus,
      order: index + 1,
      estimatedMinutes: def.estimatedMinutes,
      automatable: def.automatable,
      completionCriteria: [...def.completionCriteria],
    }));
  }

  // -----------------------------------------------------------------------
  // Step transitions
  // -----------------------------------------------------------------------

  advanceStep(sessionId: string): WorkflowStep {
    const session = this.sessions.get(sessionId);
    if (!session) { throw new Error(`Session not found: ${sessionId}`); }

    // Find first pending step
    const next = session.steps.find((s) => s.status === 'pending');
    if (!next) { throw new Error('No pending steps available to advance'); }

    next.status = 'active';
    this.updateSessionState(session);
    this.notify();
    return { ...next, completionCriteria: [...next.completionCriteria] };
  }

  completeStep(sessionId: string, result: StepResult): void {
    const session = this.sessions.get(sessionId);
    if (!session) { throw new Error(`Session not found: ${sessionId}`); }

    const active = session.steps.find((s) => s.status === 'active');
    if (!active) { throw new Error('No active step to complete'); }

    active.status = 'completed';
    active.result = { ...result, artifacts: [...result.artifacts], warnings: [...result.warnings], blockers: [...result.blockers] };

    this.updateBlockedStatuses(session);
    this.updateSessionState(session);
    this.notify();
  }

  skipStep(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) { throw new Error(`Session not found: ${sessionId}`); }

    // Skip the first active step, or the first pending step if none is active
    const target = session.steps.find((s) => s.status === 'active') ??
                   session.steps.find((s) => s.status === 'pending');
    if (!target) { throw new Error('No step available to skip'); }

    target.status = 'skipped';

    this.updateBlockedStatuses(session);
    this.updateSessionState(session);
    this.notify();
  }

  // -----------------------------------------------------------------------
  // Progress & advance checks
  // -----------------------------------------------------------------------

  getProgress(sessionId: string): { stage: string; percent: number; estimated: number; elapsed: number } {
    const session = this.sessions.get(sessionId);
    if (!session) { throw new Error(`Session not found: ${sessionId}`); }

    this.refreshSession(session);

    return {
      stage: STAGE_LABELS[session.currentStage],
      percent: session.completionPercent,
      estimated: this.estimateTimeRemaining(sessionId),
      elapsed: session.elapsedMinutes,
    };
  }

  canAdvance(sessionId: string): { ok: boolean; blockers: string[] } {
    const session = this.sessions.get(sessionId);
    if (!session) { return { ok: false, blockers: ['Session not found'] }; }

    // If there's already an active step, can't advance until it's completed
    const active = session.steps.find((s) => s.status === 'active');
    if (active) {
      return { ok: false, blockers: [`Step "${active.title}" is currently active — complete or skip it first`] };
    }

    // Find next pending step and check prerequisites
    const next = session.steps.find((s) => s.status === 'pending');
    if (!next) {
      return { ok: false, blockers: ['No more steps to advance'] };
    }

    const prereqs = STEP_PREREQS.get(next.id) ?? [];
    const unmet = prereqs.filter((preId) => {
      const pre = session.steps.find((s) => s.id === preId);
      return pre && pre.status !== 'completed' && pre.status !== 'skipped';
    });

    if (unmet.length > 0) {
      const blockerNames = unmet.map((id) => {
        const step = session.steps.find((s) => s.id === id);
        return step ? step.title : id;
      });
      return { ok: false, blockers: blockerNames.map((n) => `Prerequisite not met: ${n}`) };
    }

    return { ok: true, blockers: [] };
  }

  estimateTimeRemaining(sessionId: string): number {
    const session = this.sessions.get(sessionId);
    if (!session) { return 0; }

    let remaining = 0;
    session.steps.forEach((step) => {
      if (step.status !== 'completed' && step.status !== 'skipped') {
        remaining += step.estimatedMinutes;
      }
    });
    return remaining;
  }

  // -----------------------------------------------------------------------
  // Recommendations
  // -----------------------------------------------------------------------

  getRecommendations(sessionId: string): string[] {
    const session = this.sessions.get(sessionId);
    if (!session) { return []; }

    const recs: string[] = [];

    // Active step guidance
    const active = session.steps.find((s) => s.status === 'active');
    if (active) {
      recs.push(`Focus on completing: ${active.title}`);
      if (active.automatable) {
        recs.push(`Tip: "${active.title}" can be automated — try the AI assistant`);
      }
      active.completionCriteria.forEach((c) => {
        recs.push(`Criteria: ${c}`);
      });
    }

    // Next pending step preview
    const nextPending = session.steps.find((s) => s.status === 'pending');
    if (nextPending && !active) {
      recs.push(`Next step: ${nextPending.title} — ${nextPending.description}`);
    }

    // Stage transition hints
    const currentStageIdx = STAGE_ORDER.indexOf(session.currentStage);
    const stepsInStage = session.steps.filter((s) => s.stage === session.currentStage);
    const allDone = stepsInStage.every((s) => s.status === 'completed' || s.status === 'skipped');
    if (allDone && currentStageIdx < STAGE_ORDER.length - 1) {
      const nextStage = STAGE_ORDER[currentStageIdx + 1];
      recs.push(`Stage "${STAGE_LABELS[session.currentStage]}" complete — moving to "${STAGE_LABELS[nextStage]}"`);
    }

    // Warn about skipped simulation
    const simSteps = session.steps.filter((s) => s.stage === 'simulation');
    const allSimSkipped = simSteps.length > 0 && simSteps.every((s) => s.status === 'skipped');
    if (allSimSkipped) {
      recs.push('Warning: Simulation was skipped — consider running at least a DC check before manufacturing');
    }

    // Warn about unresolved blockers in results
    session.steps.forEach((s) => {
      if (s.result && s.result.blockers.length > 0) {
        recs.push(`Unresolved blocker from "${s.title}": ${s.result.blockers[0]}`);
      }
    });

    return recs;
  }

  // -----------------------------------------------------------------------
  // Session report
  // -----------------------------------------------------------------------

  exportSessionReport(sessionId: string): string {
    const session = this.sessions.get(sessionId);
    if (!session) { return '# Session not found'; }

    this.refreshSession(session);

    const lines: string[] = [];
    lines.push(`# Idea-to-PCB Report: ${session.projectName}`);
    lines.push('');
    lines.push(`**Description:** ${session.description}`);
    lines.push(`**Started:** ${new Date(session.startedAt).toISOString()}`);
    lines.push(`**Elapsed:** ${session.elapsedMinutes} minutes`);
    lines.push(`**Completion:** ${session.completionPercent}%`);
    lines.push(`**Current Stage:** ${STAGE_LABELS[session.currentStage]}`);
    lines.push('');

    // Steps grouped by stage
    STAGE_ORDER.forEach((stage) => {
      const stageSteps = session.steps.filter((s) => s.stage === stage);
      if (stageSteps.length === 0) { return; }

      lines.push(`## ${STAGE_LABELS[stage]}`);
      lines.push('');

      stageSteps.forEach((step) => {
        const statusIcon = step.status === 'completed' ? '[x]' :
          step.status === 'skipped' ? '[-]' :
          step.status === 'active' ? '[>]' : '[ ]';
        lines.push(`- ${statusIcon} **${step.title}** (${step.estimatedMinutes} min est.)`);

        if (step.result) {
          if (step.result.artifacts.length > 0) {
            lines.push(`  - Artifacts: ${step.result.artifacts.join(', ')}`);
          }
          if (step.result.warnings.length > 0) {
            lines.push(`  - Warnings: ${step.result.warnings.join(', ')}`);
          }
          if (step.result.blockers.length > 0) {
            lines.push(`  - Blockers: ${step.result.blockers.join(', ')}`);
          }
        }
      });
      lines.push('');
    });

    // Summary
    const completed = session.steps.filter((s) => s.status === 'completed').length;
    const skipped = session.steps.filter((s) => s.status === 'skipped').length;
    const total = session.steps.length;
    lines.push('## Summary');
    lines.push('');
    lines.push(`- **Total steps:** ${total}`);
    lines.push(`- **Completed:** ${completed}`);
    lines.push(`- **Skipped:** ${skipped}`);
    lines.push(`- **Remaining:** ${total - completed - skipped}`);
    lines.push(`- **Estimated time remaining:** ${this.estimateTimeRemaining(sessionId)} minutes`);

    return lines.join('\n');
  }

  // -----------------------------------------------------------------------
  // Blocked-status propagation
  // -----------------------------------------------------------------------

  private updateBlockedStatuses(session: IdeaToPcbSession): void {
    session.steps.forEach((step) => {
      if (step.status === 'completed' || step.status === 'skipped' || step.status === 'active') { return; }

      const prereqs = STEP_PREREQS.get(step.id) ?? [];
      const unmet = prereqs.filter((preId) => {
        const pre = session.steps.find((s) => s.id === preId);
        return pre && pre.status !== 'completed' && pre.status !== 'skipped';
      });

      if (unmet.length > 0) {
        step.status = 'blocked';
      } else if (step.status === 'blocked') {
        step.status = 'pending';
      }
    });
  }

  // -----------------------------------------------------------------------
  // Session state refresh
  // -----------------------------------------------------------------------

  private updateSessionState(session: IdeaToPcbSession): void {
    this.refreshSession(session);
  }

  private refreshSession(session: IdeaToPcbSession): void {
    // Elapsed time
    session.elapsedMinutes = Math.round((Date.now() - session.startedAt) / 60_000);

    // Completion percent (skipped steps count as done for percentage)
    const actionable = session.steps.length;
    const done = session.steps.filter((s) => s.status === 'completed' || s.status === 'skipped').length;
    session.completionPercent = actionable === 0 ? 100 : Math.round((done / actionable) * 100);

    // Current stage = first stage with incomplete steps
    session.currentStage = 'ordering';
    for (const stage of STAGE_ORDER) {
      const stageSteps = session.steps.filter((s) => s.stage === stage);
      const hasIncomplete = stageSteps.some(
        (s) => s.status !== 'completed' && s.status !== 'skipped',
      );
      if (hasIncomplete) {
        session.currentStage = stage;
        break;
      }
    }
  }

  // -----------------------------------------------------------------------
  // Clone helpers
  // -----------------------------------------------------------------------

  private cloneSession(s: IdeaToPcbSession): IdeaToPcbSession {
    return {
      ...s,
      steps: s.steps.map((step) => this.cloneStep(step)),
    };
  }

  private cloneStep(s: WorkflowStep): WorkflowStep {
    return {
      ...s,
      completionCriteria: [...s.completionCriteria],
      result: s.result ? {
        ...s.result,
        artifacts: [...s.result.artifacts],
        warnings: [...s.result.warnings],
        blockers: [...s.result.blockers],
      } : undefined,
    };
  }

  // -----------------------------------------------------------------------
  // Reset
  // -----------------------------------------------------------------------

  reset(): void {
    this.sessions.clear();
    this.nextSessionNum = 1;
    this.notify();
  }
}
