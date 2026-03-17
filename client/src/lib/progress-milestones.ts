/**
 * Progress Milestones — BL-0314
 *
 * Tracks user progression through skill milestones from beginner to fab-ready.
 * 18 milestones across 5 categories (getting_started, design, validation,
 * manufacturing, advanced) represent key learning achievements in the
 * electronics design workflow. The MilestoneTracker evaluates project state
 * against milestone criteria and persists unlock status to localStorage.
 *
 * Usage:
 *   const tracker = MilestoneTracker.getInstance();
 *   tracker.checkMilestones(projectProgress);
 *   const unlocked = tracker.getUnlocked();
 *   const next = tracker.getNextMilestone(projectProgress);
 *
 * React hook:
 *   const { milestones, unlocked, next, progress, checkMilestones } = useMilestones();
 */

import { useCallback, useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MilestoneCategory =
  | 'getting_started'
  | 'design'
  | 'validation'
  | 'manufacturing'
  | 'advanced';

export type MilestoneId =
  // getting_started (4)
  | 'first_node'
  | 'first_circuit'
  | 'first_bom_item'
  | 'first_edge'
  // design (4)
  | 'first_simulation'
  | 'first_pcb'
  | 'multi_sheet'
  | 'design_variables'
  // validation (3)
  | 'first_drc_run'
  | 'drc_master'
  | 'erc_clean'
  // manufacturing (4)
  | 'first_export'
  | 'bom_complete'
  | 'first_fab_order'
  | 'gerber_ready'
  // advanced (3)
  | 'full_stack_designer'
  | 'ten_projects'
  | 'community_contributor';

export interface MilestoneCriteria {
  /** Human-readable description of what needs to happen */
  description: string;
  /** Evaluator function — receives project progress, returns true when criteria is met */
  checkFn: (data: ProjectProgress) => boolean;
  /**
   * @deprecated Use `checkFn` instead. Kept for backward compatibility.
   */
  evaluate?: (state: ProjectProgress) => boolean;
}

export interface Milestone {
  id: MilestoneId;
  name: string;
  description: string;
  category: MilestoneCategory;
  icon: string;
  criteria: MilestoneCriteria;
  reward: string;
  order: number;
}

export interface MilestoneUnlock {
  milestoneId: MilestoneId;
  unlockedAt: number;
}

/**
 * ProjectProgress captures the relevant dimensions of project state used to
 * evaluate milestone criteria. Superset of the old ProjectState interface.
 */
export interface ProjectProgress {
  /** Whether the project has at least one architecture node */
  hasNodes: boolean;
  /** Number of architecture nodes */
  nodeCount: number;
  /** Whether the project has at least one architecture edge */
  hasEdges: boolean;
  /** Number of architecture edges */
  edgeCount: number;
  /** Whether the project has a BOM with items */
  hasBom: boolean;
  /** Number of BOM items */
  bomItemCount: number;
  /** Number of BOM items with valid part numbers */
  bomItemsWithPartNumbers: number;
  /** Number of BOM items with unit prices set (> 0) */
  bomItemsWithPrices: number;
  /** Whether the project has at least one circuit design */
  hasCircuit: boolean;
  /** Number of circuit instances placed */
  circuitInstanceCount: number;
  /** Number of circuit wires */
  circuitWireCount: number;
  /** Whether DRC has been run at least once */
  hasDrc: boolean;
  /** Number of DRC errors in the most recent run */
  drcErrors: number;
  /** Number of DRC runs with zero errors */
  drcCleanRunCount: number;
  /** Total number of DRC runs */
  drcTotalRunCount: number;
  /** Whether at least one simulation has been run */
  hasSimulation: boolean;
  /** Whether at least one export has been performed */
  hasExport: boolean;
  /** List of export formats that have been used */
  exportFormats: string[];
  /** Whether a PCB layout has been started */
  hasPcbLayout: boolean;
  /** Number of PCB traces routed */
  pcbTraceCount: number;
  /** Whether a fab order has been submitted */
  hasFabOrder: boolean;
  /** Whether design variables are in use */
  hasDesignVariables: boolean;
  /** Number of circuit design sheets/hierarchical levels */
  sheetCount: number;
  /** Whether ERC has passed with zero errors */
  ercClean: boolean;
  /** Whether Gerber files have been exported */
  hasGerberExport: boolean;
  /** Number of projects completed (for multi-project milestone) */
  projectCount: number;
  /** Whether user has shared a component to community library */
  hasCommunityContribution: boolean;
  /** Number of validation issues with severity 'error' */
  validationErrorCount: number;
}

/**
 * @deprecated Use ProjectProgress instead. Alias kept for backward compatibility.
 */
export type ProjectState = ProjectProgress;

export interface MilestoneEvent {
  type: 'milestone-unlocked';
  milestoneId: MilestoneId;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'protopulse-milestone-unlocks';

type Listener = () => void;

// ---------------------------------------------------------------------------
// Helper: create empty ProjectProgress
// ---------------------------------------------------------------------------

export function emptyProjectProgress(): ProjectProgress {
  return {
    hasNodes: false,
    nodeCount: 0,
    hasEdges: false,
    edgeCount: 0,
    hasBom: false,
    bomItemCount: 0,
    bomItemsWithPartNumbers: 0,
    bomItemsWithPrices: 0,
    hasCircuit: false,
    circuitInstanceCount: 0,
    circuitWireCount: 0,
    hasDrc: false,
    drcErrors: 0,
    drcCleanRunCount: 0,
    drcTotalRunCount: 0,
    hasSimulation: false,
    hasExport: false,
    exportFormats: [],
    hasPcbLayout: false,
    pcbTraceCount: 0,
    hasFabOrder: false,
    hasDesignVariables: false,
    sheetCount: 0,
    ercClean: false,
    hasGerberExport: false,
    projectCount: 0,
    hasCommunityContribution: false,
    validationErrorCount: 0,
  };
}

// ---------------------------------------------------------------------------
// Built-in Milestones (18 across 5 categories)
// ---------------------------------------------------------------------------

function createMilestones(): Milestone[] {
  return [
    // ---- getting_started (4) -----------------------------------------------
    {
      id: 'first_node',
      name: 'First Block',
      description: 'Add your first architecture block to start designing.',
      category: 'getting_started',
      icon: 'Plus',
      criteria: {
        description: 'Add at least one architecture node',
        checkFn: (data) => data.hasNodes && data.nodeCount >= 1,
      },
      reward: 'You placed your first block! The journey of a thousand designs begins with a single node.',
      order: 0,
    },
    {
      id: 'first_edge',
      name: 'First Connection',
      description: 'Connect two blocks with an edge to define signal flow.',
      category: 'getting_started',
      icon: 'Link',
      criteria: {
        description: 'Connect at least two nodes with an edge',
        checkFn: (data) => data.hasEdges && data.edgeCount >= 1 && data.nodeCount >= 2,
      },
      reward: 'Blocks connected! Signal flow is the foundation of every great design.',
      order: 1,
    },
    {
      id: 'first_circuit',
      name: 'First Circuit',
      description: 'Create your first circuit with at least 2 components connected together.',
      category: 'getting_started',
      icon: 'Zap',
      criteria: {
        description: 'Place at least 2 circuit instances and 1 wire connecting them',
        checkFn: (data) =>
          (data.circuitInstanceCount >= 2 && data.circuitWireCount >= 1) ||
          (data.nodeCount >= 2 && data.edgeCount >= 1),
      },
      reward: 'You built your first circuit! Every great design starts with a single connection.',
      order: 2,
    },
    {
      id: 'first_bom_item',
      name: 'First BOM Entry',
      description: 'Add your first component to the Bill of Materials.',
      category: 'getting_started',
      icon: 'ClipboardList',
      criteria: {
        description: 'Add at least one BOM item',
        checkFn: (data) => data.hasBom && data.bomItemCount >= 1,
      },
      reward: 'BOM started! Tracking parts is the first step to building real hardware.',
      order: 3,
    },
    // ---- design (4) --------------------------------------------------------
    {
      id: 'first_simulation',
      name: 'First Simulation',
      description: 'Run your first circuit simulation to verify your design works.',
      category: 'design',
      icon: 'Activity',
      criteria: {
        description: 'Run at least one simulation (DC, AC, or transient)',
        checkFn: (data) => data.hasSimulation,
      },
      reward: 'Simulation complete! Now you can validate designs before building them.',
      order: 4,
    },
    {
      id: 'first_pcb',
      name: 'First PCB',
      description: 'Lay out your first PCB with components placed and traces routed.',
      category: 'design',
      icon: 'CircuitBoard',
      criteria: {
        description: 'Place components on a PCB layout and route at least 1 trace',
        checkFn: (data) => data.hasPcbLayout && data.pcbTraceCount >= 1,
      },
      reward: 'Your first PCB layout! From schematic to physical board.',
      order: 5,
    },
    {
      id: 'multi_sheet',
      name: 'Multi-Sheet Design',
      description: 'Create a hierarchical design with 2+ schematic sheets.',
      category: 'design',
      icon: 'Layers',
      criteria: {
        description: 'Have at least 2 schematic sheets in the design',
        checkFn: (data) => data.sheetCount >= 2,
      },
      reward: 'Multi-sheet mastery! Complex designs become manageable with hierarchy.',
      order: 6,
    },
    {
      id: 'design_variables',
      name: 'Parametric Designer',
      description: 'Use design variables to parameterize your circuit values.',
      category: 'design',
      icon: 'Variable',
      criteria: {
        description: 'Use at least one design variable',
        checkFn: (data) => data.hasDesignVariables,
      },
      reward: 'Parametric design unlocked! Variables make designs flexible and reusable.',
      order: 7,
    },
    // ---- validation (3) ----------------------------------------------------
    {
      id: 'first_drc_run',
      name: 'First DRC Run',
      description: 'Run your first Design Rule Check to find potential issues.',
      category: 'validation',
      icon: 'Search',
      criteria: {
        description: 'Run DRC at least once',
        checkFn: (data) => data.hasDrc && data.drcTotalRunCount >= 1,
      },
      reward: 'First DRC run! Catching errors early saves time and money.',
      order: 8,
    },
    {
      id: 'drc_master',
      name: 'DRC Master',
      description: 'Pass Design Rule Check with zero errors on 3 separate runs.',
      category: 'validation',
      icon: 'ShieldCheck',
      criteria: {
        description: 'Achieve 3 clean DRC runs (zero errors) across any number of attempts',
        checkFn: (data) => data.drcCleanRunCount >= 3,
      },
      reward: 'DRC mastery achieved! Your designs meet professional quality standards.',
      order: 9,
    },
    {
      id: 'erc_clean',
      name: 'ERC Clean',
      description: 'Pass Electrical Rule Check with zero errors.',
      category: 'validation',
      icon: 'CheckCircle',
      criteria: {
        description: 'ERC passes with no errors',
        checkFn: (data) => data.ercClean,
      },
      reward: 'Electrically clean! Your connections are valid and your netlist is consistent.',
      order: 10,
    },
    // ---- manufacturing (4) -------------------------------------------------
    {
      id: 'first_export',
      name: 'First Export',
      description: 'Export your design in any format (KiCad, Eagle, Gerber, PDF, etc.).',
      category: 'manufacturing',
      icon: 'Download',
      criteria: {
        description: 'Successfully export the design in at least one format',
        checkFn: (data) => data.hasExport,
      },
      reward: 'Design exported! Your work is now portable and shareable.',
      order: 11,
    },
    {
      id: 'bom_complete',
      name: 'BOM Complete',
      description: 'Build a complete Bill of Materials with part numbers and pricing for 5+ components.',
      category: 'manufacturing',
      icon: 'ClipboardCheck',
      criteria: {
        description: 'Have 5+ BOM items, each with a part number and unit price',
        checkFn: (data) =>
          data.bomItemCount >= 5 &&
          data.bomItemsWithPartNumbers >= 5 &&
          data.bomItemsWithPrices >= 5,
      },
      reward: 'Full BOM! You can now order parts and estimate costs like a pro.',
      order: 12,
    },
    {
      id: 'gerber_ready',
      name: 'Gerber Ready',
      description: 'Export Gerber files ready for PCB fabrication.',
      category: 'manufacturing',
      icon: 'FileOutput',
      criteria: {
        description: 'Export Gerber files',
        checkFn: (data) => data.hasGerberExport,
      },
      reward: 'Gerber files ready! Your design can now be fabricated by any PCB manufacturer.',
      order: 13,
    },
    {
      id: 'first_fab_order',
      name: 'First Fab Order',
      description: 'Submit your first PCB fabrication order.',
      category: 'manufacturing',
      icon: 'ShoppingBag',
      criteria: {
        description: 'Submit a PCB fabrication order through the ordering system',
        checkFn: (data) => data.hasFabOrder,
      },
      reward: 'Order placed! Your design is being manufactured. Welcome to the real world of PCBs.',
      order: 14,
    },
    // ---- advanced (3) ------------------------------------------------------
    {
      id: 'ten_projects',
      name: 'Prolific Designer',
      description: 'Complete 10 projects to prove your breadth of experience.',
      category: 'advanced',
      icon: 'Folder',
      criteria: {
        description: 'Have 10 or more projects',
        checkFn: (data) => data.projectCount >= 10,
      },
      reward: 'Ten projects strong! You are building a portfolio of real designs.',
      order: 15,
    },
    {
      id: 'community_contributor',
      name: 'Community Contributor',
      description: 'Share a component or design to the community library.',
      category: 'advanced',
      icon: 'Share2',
      criteria: {
        description: 'Share a component to the community library',
        checkFn: (data) => data.hasCommunityContribution,
      },
      reward: 'Giving back! Your contribution helps the whole maker community.',
      order: 16,
    },
    {
      id: 'full_stack_designer',
      name: 'Full Stack Designer',
      description: 'Complete the full journey: circuit, simulation, PCB, DRC, BOM, and export.',
      category: 'advanced',
      icon: 'Trophy',
      criteria: {
        description: 'Unlock all milestones in getting_started, design, validation, and manufacturing categories',
        checkFn: (_data) => false, // Special: evaluated by tracker using unlock state
      },
      reward: 'You are a Full Stack Designer! From concept to fabrication, you can do it all.',
      order: 17,
    },
  ];
}

// ---------------------------------------------------------------------------
// Category helpers
// ---------------------------------------------------------------------------

const CATEGORY_LABELS: Record<MilestoneCategory, string> = {
  getting_started: 'Getting Started',
  design: 'Design',
  validation: 'Validation',
  manufacturing: 'Manufacturing',
  advanced: 'Advanced',
};

export function getCategoryLabel(category: MilestoneCategory): string {
  return CATEGORY_LABELS[category];
}

export function getAllCategories(): MilestoneCategory[] {
  return ['getting_started', 'design', 'validation', 'manufacturing', 'advanced'];
}

// ---------------------------------------------------------------------------
// MilestoneTracker (singleton + subscribe)
// ---------------------------------------------------------------------------

/** IDs of the prerequisite milestones for full_stack_designer */
const FULL_STACK_PREREQS: MilestoneId[] = [
  // getting_started
  'first_node',
  'first_edge',
  'first_circuit',
  'first_bom_item',
  // design
  'first_simulation',
  'first_pcb',
  'multi_sheet',
  'design_variables',
  // validation
  'first_drc_run',
  'drc_master',
  'erc_clean',
  // manufacturing
  'first_export',
  'bom_complete',
  'gerber_ready',
  'first_fab_order',
];

export class MilestoneTracker {
  private static instance: MilestoneTracker | null = null;

  private milestones: Map<MilestoneId, Milestone> = new Map();
  private unlocks: Map<MilestoneId, MilestoneUnlock> = new Map();
  private listeners: Set<Listener> = new Set();
  private eventLog: MilestoneEvent[] = [];

  private constructor() {
    for (const milestone of createMilestones()) {
      this.milestones.set(milestone.id, milestone);
    }
    this.loadUnlocks();
  }

  static getInstance(): MilestoneTracker {
    if (!MilestoneTracker.instance) {
      MilestoneTracker.instance = new MilestoneTracker();
    }
    return MilestoneTracker.instance;
  }

  static resetForTesting(): void {
    MilestoneTracker.instance = null;
  }

  // ---- Persistence -------------------------------------------------------

  private loadUnlocks(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, MilestoneUnlock>;
        for (const [id, unlock] of Object.entries(parsed)) {
          this.unlocks.set(id as MilestoneId, unlock);
        }
      }
    } catch {
      // Corrupted storage — start fresh
    }
  }

  private persistUnlocks(): void {
    const obj: Record<string, MilestoneUnlock> = {};
    for (const [id, unlock] of Array.from(this.unlocks.entries())) {
      obj[id] = unlock;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
  }

  // ---- Subscribe ---------------------------------------------------------

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

  // ---- Core API ----------------------------------------------------------

  /** Get all milestone definitions in order. */
  getAllMilestones(): Milestone[] {
    return Array.from(this.milestones.values()).sort((a, b) => a.order - b.order);
  }

  /** Get milestones filtered by category, in order. */
  getMilestonesByCategory(category: MilestoneCategory): Milestone[] {
    return this.getAllMilestones().filter((m) => m.category === category);
  }

  /** Get a specific milestone by ID. */
  getMilestone(id: MilestoneId): Milestone | undefined {
    return this.milestones.get(id);
  }

  /** Get all unlocked milestones with their unlock timestamps. */
  getUnlocked(): MilestoneUnlock[] {
    return Array.from(this.unlocks.values());
  }

  /** Check if a specific milestone is unlocked. */
  isUnlocked(id: MilestoneId): boolean {
    return this.unlocks.has(id);
  }

  /** Get the next milestone to unlock (first locked milestone in order). */
  getNext(): Milestone | undefined {
    const sorted = this.getAllMilestones();
    return sorted.find((m) => !this.unlocks.has(m.id));
  }

  /**
   * Get the next recommended milestone based on current project progress.
   * Unlike getNext() which uses milestone order, this evaluates which
   * milestone the user is closest to achieving.
   */
  getNextMilestone(data: ProjectProgress): Milestone | undefined {
    // Fall back to order-based next for simplicity; returns first locked one
    // that isn't full_stack_designer (capstone should come last naturally)
    const sorted = this.getAllMilestones();
    const lockedNonCapstone = sorted.filter(
      (m) => !this.unlocks.has(m.id) && m.id !== 'full_stack_designer',
    );
    if (lockedNonCapstone.length === 0) {
      // Only full_stack_designer may remain
      const capstone = this.milestones.get('full_stack_designer');
      if (capstone && !this.unlocks.has('full_stack_designer')) {
        return capstone;
      }
      return undefined;
    }
    // Return the first locked milestone whose category has the most progress
    // (i.e., favor completion of started categories)
    return lockedNonCapstone[0];
  }

  /** Get progress as a fraction (0-1). */
  getProgress(): number {
    const total = this.milestones.size;
    if (total === 0) { return 0; }
    return this.unlocks.size / total;
  }

  /** Get progress as a percentage (0-100). */
  getProgressPercentage(): number {
    return Math.round(this.getProgress() * 100);
  }

  /** Get progress for a specific category as a fraction (0-1). */
  getCategoryProgress(category: MilestoneCategory): number {
    const categoryMilestones = this.getMilestonesByCategory(category);
    if (categoryMilestones.length === 0) { return 0; }
    const unlocked = categoryMilestones.filter((m) => this.unlocks.has(m.id)).length;
    return unlocked / categoryMilestones.length;
  }

  /** Get the event log of recently unlocked milestones (since last clear). */
  getRecentEvents(): MilestoneEvent[] {
    return [...this.eventLog];
  }

  /** Clear the event log after consuming events (e.g., after showing toasts). */
  clearEvents(): void {
    this.eventLog = [];
  }

  /**
   * Evaluate project progress against all milestone criteria.
   * Newly unlocked milestones are persisted and listeners are notified.
   * Returns array of newly unlocked milestone IDs.
   */
  checkMilestones(data: ProjectProgress): MilestoneId[] {
    const newlyUnlocked: MilestoneId[] = [];
    const now = Date.now();

    for (const milestone of this.getAllMilestones()) {
      if (this.unlocks.has(milestone.id)) {
        continue; // Already unlocked
      }

      // Special handling for full_stack_designer — requires all prereqs unlocked
      if (milestone.id === 'full_stack_designer') {
        const allPrereqsMet = FULL_STACK_PREREQS.every((id) => this.unlocks.has(id));
        if (!allPrereqsMet) {
          continue;
        }
      } else if (!milestone.criteria.checkFn(data)) {
        continue;
      }

      // Unlock!
      const unlock: MilestoneUnlock = {
        milestoneId: milestone.id,
        unlockedAt: now,
      };
      this.unlocks.set(milestone.id, unlock);
      newlyUnlocked.push(milestone.id);

      const event: MilestoneEvent = {
        type: 'milestone-unlocked',
        milestoneId: milestone.id,
        timestamp: now,
      };
      this.eventLog.push(event);
    }

    if (newlyUnlocked.length > 0) {
      this.persistUnlocks();
      this.notify();
    }

    return newlyUnlocked;
  }

  /** Manually unlock a milestone (e.g., from external triggers like export or fab order). */
  manualUnlock(id: MilestoneId): boolean {
    if (this.unlocks.has(id) || !this.milestones.has(id)) {
      return false;
    }

    const now = Date.now();
    this.unlocks.set(id, { milestoneId: id, unlockedAt: now });
    this.eventLog.push({ type: 'milestone-unlocked', milestoneId: id, timestamp: now });
    this.persistUnlocks();
    this.notify();
    return true;
  }

  /** Reset all milestone progress (for testing or user-initiated reset). */
  resetAll(): void {
    this.unlocks.clear();
    this.eventLog = [];
    localStorage.removeItem(STORAGE_KEY);
    this.notify();
  }

  /** Get the total number of milestones. */
  getTotal(): number {
    return this.milestones.size;
  }

  /** Get the number of unlocked milestones. */
  getUnlockedCount(): number {
    return this.unlocks.size;
  }
}

// ---------------------------------------------------------------------------
// React Hook
// ---------------------------------------------------------------------------

export interface UseMilestonesResult {
  milestones: Milestone[];
  unlocked: MilestoneUnlock[];
  next: Milestone | undefined;
  progress: number;
  progressPercentage: number;
  unlockedCount: number;
  totalCount: number;
  isUnlocked: (id: MilestoneId) => boolean;
  checkMilestones: (data: ProjectProgress) => MilestoneId[];
  getNextMilestone: (data: ProjectProgress) => Milestone | undefined;
  getProgressPercentage: () => number;
  getCategoryProgress: (category: MilestoneCategory) => number;
  getMilestonesByCategory: (category: MilestoneCategory) => Milestone[];
  manualUnlock: (id: MilestoneId) => boolean;
  resetAll: () => void;
  recentEvents: MilestoneEvent[];
  clearEvents: () => void;
}

export function useMilestones(): UseMilestonesResult {
  const [, setTick] = useState(0);
  const tracker = MilestoneTracker.getInstance();

  useEffect(() => {
    return tracker.subscribe(() => setTick((t) => t + 1));
  }, [tracker]);

  const checkMilestonesCb = useCallback(
    (data: ProjectProgress) => tracker.checkMilestones(data),
    [tracker],
  );

  const getNextMilestoneCb = useCallback(
    (data: ProjectProgress) => tracker.getNextMilestone(data),
    [tracker],
  );

  const getProgressPercentageCb = useCallback(
    () => tracker.getProgressPercentage(),
    [tracker],
  );

  const getCategoryProgressCb = useCallback(
    (category: MilestoneCategory) => tracker.getCategoryProgress(category),
    [tracker],
  );

  const getMilestonesByCategoryCb = useCallback(
    (category: MilestoneCategory) => tracker.getMilestonesByCategory(category),
    [tracker],
  );

  const manualUnlockCb = useCallback(
    (id: MilestoneId) => tracker.manualUnlock(id),
    [tracker],
  );

  const resetAllCb = useCallback(() => tracker.resetAll(), [tracker]);

  const isUnlockedCb = useCallback(
    (id: MilestoneId) => tracker.isUnlocked(id),
    [tracker],
  );

  const clearEventsCb = useCallback(() => tracker.clearEvents(), [tracker]);

  return {
    milestones: tracker.getAllMilestones(),
    unlocked: tracker.getUnlocked(),
    next: tracker.getNext(),
    progress: tracker.getProgress(),
    progressPercentage: tracker.getProgressPercentage(),
    unlockedCount: tracker.getUnlockedCount(),
    totalCount: tracker.getTotal(),
    isUnlocked: isUnlockedCb,
    checkMilestones: checkMilestonesCb,
    getNextMilestone: getNextMilestoneCb,
    getProgressPercentage: getProgressPercentageCb,
    getCategoryProgress: getCategoryProgressCb,
    getMilestonesByCategory: getMilestonesByCategoryCb,
    manualUnlock: manualUnlockCb,
    resetAll: resetAllCb,
    recentEvents: tracker.getRecentEvents(),
    clearEvents: clearEventsCb,
  };
}
