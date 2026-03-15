/**
 * Progress Milestones — BL-0314
 *
 * Tracks user progression through skill milestones from beginner to fab-ready.
 * Eight milestones represent key learning achievements in the electronics
 * design workflow. The MilestoneTracker evaluates project state against
 * milestone criteria and persists unlock status to localStorage.
 *
 * Usage:
 *   const tracker = MilestoneTracker.getInstance();
 *   tracker.checkMilestones(projectState);
 *   const unlocked = tracker.getUnlocked();
 *   const next = tracker.getNext();
 *
 * React hook:
 *   const { milestones, unlocked, next, progress, checkMilestones } = useMilestones();
 */

import { useCallback, useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MilestoneId =
  | 'first_circuit'
  | 'first_simulation'
  | 'first_pcb'
  | 'first_export'
  | 'first_fab_order'
  | 'drc_master'
  | 'bom_complete'
  | 'full_stack_designer';

export interface MilestoneCriteria {
  /** Human-readable description of what needs to happen */
  description: string;
  /** Evaluator function — receives project state, returns true when criteria is met */
  evaluate: (state: ProjectState) => boolean;
}

export interface Milestone {
  id: MilestoneId;
  name: string;
  description: string;
  icon: string;
  criteria: MilestoneCriteria;
  reward: string;
  order: number;
}

export interface MilestoneUnlock {
  milestoneId: MilestoneId;
  unlockedAt: number;
}

export interface ProjectState {
  /** Number of architecture nodes in the project */
  architectureNodeCount: number;
  /** Number of architecture edges (connections) */
  architectureEdgeCount: number;
  /** Number of circuit instances placed */
  circuitInstanceCount: number;
  /** Number of circuit wires */
  circuitWireCount: number;
  /** Number of BOM items */
  bomItemCount: number;
  /** Number of BOM items with valid part numbers (non-empty) */
  bomItemsWithPartNumbers: number;
  /** Number of BOM items with unit prices set (> 0) */
  bomItemsWithPrices: number;
  /** Whether at least one simulation has been run */
  hasRunSimulation: boolean;
  /** Whether a PCB layout has been started (instances placed on PCB) */
  hasPcbLayout: boolean;
  /** Number of PCB traces routed */
  pcbTraceCount: number;
  /** Whether at least one export has been performed */
  hasExported: boolean;
  /** Whether a fab order has been submitted */
  hasFabOrder: boolean;
  /** Number of DRC runs with zero errors */
  drcCleanRunCount: number;
  /** Total number of DRC runs */
  drcTotalRunCount: number;
  /** Number of validation issues with severity 'error' */
  validationErrorCount: number;
}

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
// Built-in Milestones
// ---------------------------------------------------------------------------

function createMilestones(): Milestone[] {
  return [
    {
      id: 'first_circuit',
      name: 'First Circuit',
      description: 'Create your first circuit with at least 2 components connected together.',
      icon: 'Zap',
      criteria: {
        description: 'Place at least 2 circuit instances and 1 wire connecting them',
        evaluate: (state) =>
          (state.circuitInstanceCount >= 2 && state.circuitWireCount >= 1) ||
          (state.architectureNodeCount >= 2 && state.architectureEdgeCount >= 1),
      },
      reward: 'You built your first circuit! Every great design starts with a single connection.',
      order: 0,
    },
    {
      id: 'first_simulation',
      name: 'First Simulation',
      description: 'Run your first circuit simulation to verify your design works.',
      icon: 'Activity',
      criteria: {
        description: 'Run at least one simulation (DC, AC, or transient)',
        evaluate: (state) => state.hasRunSimulation,
      },
      reward: 'Simulation complete! Now you can validate designs before building them.',
      order: 1,
    },
    {
      id: 'first_pcb',
      name: 'First PCB',
      description: 'Lay out your first PCB with components placed and traces routed.',
      icon: 'CircuitBoard',
      criteria: {
        description: 'Place components on a PCB layout and route at least 1 trace',
        evaluate: (state) => state.hasPcbLayout && state.pcbTraceCount >= 1,
      },
      reward: 'Your first PCB layout! From schematic to physical board.',
      order: 2,
    },
    {
      id: 'first_export',
      name: 'First Export',
      description: 'Export your design in any format (KiCad, Eagle, Gerber, PDF, etc.).',
      icon: 'Download',
      criteria: {
        description: 'Successfully export the design in at least one format',
        evaluate: (state) => state.hasExported,
      },
      reward: 'Design exported! Your work is now portable and shareable.',
      order: 3,
    },
    {
      id: 'drc_master',
      name: 'DRC Master',
      description: 'Pass Design Rule Check with zero errors on 3 separate runs.',
      icon: 'ShieldCheck',
      criteria: {
        description: 'Achieve 3 clean DRC runs (zero errors) across any number of attempts',
        evaluate: (state) => state.drcCleanRunCount >= 3,
      },
      reward: 'DRC mastery achieved! Your designs meet professional quality standards.',
      order: 4,
    },
    {
      id: 'bom_complete',
      name: 'BOM Complete',
      description: 'Build a complete Bill of Materials with part numbers and pricing for 5+ components.',
      icon: 'ClipboardList',
      criteria: {
        description: 'Have 5+ BOM items, each with a part number and unit price',
        evaluate: (state) =>
          state.bomItemCount >= 5 &&
          state.bomItemsWithPartNumbers >= 5 &&
          state.bomItemsWithPrices >= 5,
      },
      reward: 'Full BOM! You can now order parts and estimate costs like a pro.',
      order: 5,
    },
    {
      id: 'first_fab_order',
      name: 'First Fab Order',
      description: 'Submit your first PCB fabrication order.',
      icon: 'ShoppingBag',
      criteria: {
        description: 'Submit a PCB fabrication order through the ordering system',
        evaluate: (state) => state.hasFabOrder,
      },
      reward: 'Order placed! Your design is being manufactured. Welcome to the real world of PCBs.',
      order: 6,
    },
    {
      id: 'full_stack_designer',
      name: 'Full Stack Designer',
      description: 'Complete the full journey: circuit, simulation, PCB, DRC, BOM, and export.',
      icon: 'Trophy',
      criteria: {
        description: 'Unlock all previous milestones',
        evaluate: (_state) => false, // Special: evaluated by tracker using unlock state
      },
      reward: 'You are a Full Stack Designer! From concept to fabrication, you can do it all.',
      order: 7,
    },
  ];
}

// ---------------------------------------------------------------------------
// MilestoneTracker (singleton + subscribe)
// ---------------------------------------------------------------------------

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

  /** Get progress as a fraction (0-1). */
  getProgress(): number {
    const total = this.milestones.size;
    if (total === 0) { return 0; }
    return this.unlocks.size / total;
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
   * Evaluate project state against all milestone criteria.
   * Newly unlocked milestones are persisted and listeners are notified.
   * Returns array of newly unlocked milestone IDs.
   */
  checkMilestones(state: ProjectState): MilestoneId[] {
    const newlyUnlocked: MilestoneId[] = [];
    const now = Date.now();

    for (const milestone of this.getAllMilestones()) {
      if (this.unlocks.has(milestone.id)) {
        continue; // Already unlocked
      }

      // Special handling for full_stack_designer — requires all others unlocked
      if (milestone.id === 'full_stack_designer') {
        const prerequisiteIds: MilestoneId[] = [
          'first_circuit',
          'first_simulation',
          'first_pcb',
          'first_export',
          'drc_master',
          'bom_complete',
          'first_fab_order',
        ];
        const allPrereqsMet = prerequisiteIds.every((id) => this.unlocks.has(id));
        if (!allPrereqsMet) {
          continue;
        }
      } else if (!milestone.criteria.evaluate(state)) {
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
  unlockedCount: number;
  totalCount: number;
  isUnlocked: (id: MilestoneId) => boolean;
  checkMilestones: (state: ProjectState) => MilestoneId[];
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
    (state: ProjectState) => tracker.checkMilestones(state),
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
    unlockedCount: tracker.getUnlockedCount(),
    totalCount: tracker.getTotal(),
    isUnlocked: isUnlockedCb,
    checkMilestones: checkMilestonesCb,
    manualUnlock: manualUnlockCb,
    resetAll: resetAllCb,
    recentEvents: tracker.getRecentEvents(),
    clearEvents: clearEventsCb,
  };
}
