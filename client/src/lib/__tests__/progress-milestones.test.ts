import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  MilestoneTracker,
  type ProjectState,
  type MilestoneId,
} from '../progress-milestones';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function emptyState(): ProjectState {
  return {
    architectureNodeCount: 0,
    architectureEdgeCount: 0,
    circuitInstanceCount: 0,
    circuitWireCount: 0,
    bomItemCount: 0,
    bomItemsWithPartNumbers: 0,
    bomItemsWithPrices: 0,
    hasRunSimulation: false,
    hasPcbLayout: false,
    pcbTraceCount: 0,
    hasExported: false,
    hasFabOrder: false,
    drcCleanRunCount: 0,
    drcTotalRunCount: 0,
    validationErrorCount: 0,
  };
}

function fullState(): ProjectState {
  return {
    architectureNodeCount: 10,
    architectureEdgeCount: 8,
    circuitInstanceCount: 5,
    circuitWireCount: 4,
    bomItemCount: 7,
    bomItemsWithPartNumbers: 7,
    bomItemsWithPrices: 7,
    hasRunSimulation: true,
    hasPcbLayout: true,
    pcbTraceCount: 6,
    hasExported: true,
    hasFabOrder: true,
    drcCleanRunCount: 5,
    drcTotalRunCount: 8,
    validationErrorCount: 0,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MilestoneTracker', () => {
  beforeEach(() => {
    MilestoneTracker.resetForTesting();
    localStorage.clear();
  });

  // ---- Singleton ----------------------------------------------------------

  it('returns the same instance on multiple getInstance calls', () => {
    const a = MilestoneTracker.getInstance();
    const b = MilestoneTracker.getInstance();
    expect(a).toBe(b);
  });

  it('returns a fresh instance after resetForTesting', () => {
    const a = MilestoneTracker.getInstance();
    MilestoneTracker.resetForTesting();
    const b = MilestoneTracker.getInstance();
    expect(a).not.toBe(b);
  });

  // ---- Initial state ------------------------------------------------------

  it('has 8 milestones defined', () => {
    const tracker = MilestoneTracker.getInstance();
    expect(tracker.getAllMilestones()).toHaveLength(8);
  });

  it('starts with zero unlocked milestones', () => {
    const tracker = MilestoneTracker.getInstance();
    expect(tracker.getUnlocked()).toHaveLength(0);
    expect(tracker.getUnlockedCount()).toBe(0);
    expect(tracker.getProgress()).toBe(0);
  });

  it('returns milestones sorted by order', () => {
    const tracker = MilestoneTracker.getInstance();
    const milestones = tracker.getAllMilestones();
    for (let i = 1; i < milestones.length; i++) {
      expect(milestones[i].order).toBeGreaterThan(milestones[i - 1].order);
    }
  });

  it('getNext returns the first milestone when none are unlocked', () => {
    const tracker = MilestoneTracker.getInstance();
    const next = tracker.getNext();
    expect(next).toBeDefined();
    expect(next!.id).toBe('first_circuit');
  });

  // ---- checkMilestones: first_circuit -------------------------------------

  it('unlocks first_circuit with circuit instances and wires', () => {
    const tracker = MilestoneTracker.getInstance();
    const state = emptyState();
    state.circuitInstanceCount = 2;
    state.circuitWireCount = 1;

    const unlocked = tracker.checkMilestones(state);
    expect(unlocked).toContain('first_circuit');
    expect(tracker.isUnlocked('first_circuit')).toBe(true);
  });

  it('unlocks first_circuit with architecture nodes and edges', () => {
    const tracker = MilestoneTracker.getInstance();
    const state = emptyState();
    state.architectureNodeCount = 3;
    state.architectureEdgeCount = 2;

    const unlocked = tracker.checkMilestones(state);
    expect(unlocked).toContain('first_circuit');
  });

  it('does NOT unlock first_circuit with only 1 instance and no wires', () => {
    const tracker = MilestoneTracker.getInstance();
    const state = emptyState();
    state.circuitInstanceCount = 1;
    state.circuitWireCount = 0;

    const unlocked = tracker.checkMilestones(state);
    expect(unlocked).not.toContain('first_circuit');
  });

  // ---- checkMilestones: first_simulation ----------------------------------

  it('unlocks first_simulation when hasRunSimulation is true', () => {
    const tracker = MilestoneTracker.getInstance();
    const state = emptyState();
    state.hasRunSimulation = true;

    const unlocked = tracker.checkMilestones(state);
    expect(unlocked).toContain('first_simulation');
  });

  // ---- checkMilestones: first_pcb -----------------------------------------

  it('unlocks first_pcb with PCB layout and traces', () => {
    const tracker = MilestoneTracker.getInstance();
    const state = emptyState();
    state.hasPcbLayout = true;
    state.pcbTraceCount = 2;

    const unlocked = tracker.checkMilestones(state);
    expect(unlocked).toContain('first_pcb');
  });

  it('does NOT unlock first_pcb with layout but no traces', () => {
    const tracker = MilestoneTracker.getInstance();
    const state = emptyState();
    state.hasPcbLayout = true;
    state.pcbTraceCount = 0;

    const unlocked = tracker.checkMilestones(state);
    expect(unlocked).not.toContain('first_pcb');
  });

  // ---- checkMilestones: first_export --------------------------------------

  it('unlocks first_export when hasExported is true', () => {
    const tracker = MilestoneTracker.getInstance();
    const state = emptyState();
    state.hasExported = true;

    const unlocked = tracker.checkMilestones(state);
    expect(unlocked).toContain('first_export');
  });

  // ---- checkMilestones: drc_master ----------------------------------------

  it('unlocks drc_master with 3+ clean DRC runs', () => {
    const tracker = MilestoneTracker.getInstance();
    const state = emptyState();
    state.drcCleanRunCount = 3;
    state.drcTotalRunCount = 5;

    const unlocked = tracker.checkMilestones(state);
    expect(unlocked).toContain('drc_master');
  });

  it('does NOT unlock drc_master with only 2 clean runs', () => {
    const tracker = MilestoneTracker.getInstance();
    const state = emptyState();
    state.drcCleanRunCount = 2;
    state.drcTotalRunCount = 4;

    const unlocked = tracker.checkMilestones(state);
    expect(unlocked).not.toContain('drc_master');
  });

  // ---- checkMilestones: bom_complete --------------------------------------

  it('unlocks bom_complete with 5+ fully specified BOM items', () => {
    const tracker = MilestoneTracker.getInstance();
    const state = emptyState();
    state.bomItemCount = 6;
    state.bomItemsWithPartNumbers = 6;
    state.bomItemsWithPrices = 6;

    const unlocked = tracker.checkMilestones(state);
    expect(unlocked).toContain('bom_complete');
  });

  it('does NOT unlock bom_complete when items lack part numbers', () => {
    const tracker = MilestoneTracker.getInstance();
    const state = emptyState();
    state.bomItemCount = 5;
    state.bomItemsWithPartNumbers = 3;
    state.bomItemsWithPrices = 5;

    const unlocked = tracker.checkMilestones(state);
    expect(unlocked).not.toContain('bom_complete');
  });

  // ---- checkMilestones: first_fab_order -----------------------------------

  it('unlocks first_fab_order when hasFabOrder is true', () => {
    const tracker = MilestoneTracker.getInstance();
    const state = emptyState();
    state.hasFabOrder = true;

    const unlocked = tracker.checkMilestones(state);
    expect(unlocked).toContain('first_fab_order');
  });

  // ---- checkMilestones: full_stack_designer -------------------------------

  it('does NOT unlock full_stack_designer without all prerequisites', () => {
    const tracker = MilestoneTracker.getInstance();
    const state = fullState();
    // Only check once — some prerequisites will unlock, but not all yet
    // (full_stack requires all 7 others to be unlocked first)
    tracker.checkMilestones(state);
    // After first check, all 7 prerequisites + full_stack should unlock
    expect(tracker.isUnlocked('full_stack_designer')).toBe(true);
  });

  it('unlocks full_stack_designer when all prerequisites are met in one check', () => {
    const tracker = MilestoneTracker.getInstance();
    const state = fullState();
    const unlocked = tracker.checkMilestones(state);

    // All 8 milestones should unlock
    expect(unlocked).toHaveLength(8);
    expect(unlocked).toContain('full_stack_designer');
    expect(tracker.getProgress()).toBe(1);
  });

  it('does NOT unlock full_stack_designer when one prerequisite is missing', () => {
    const tracker = MilestoneTracker.getInstance();
    // Manually unlock 6 of 7 prerequisites
    tracker.manualUnlock('first_circuit');
    tracker.manualUnlock('first_simulation');
    tracker.manualUnlock('first_pcb');
    tracker.manualUnlock('first_export');
    tracker.manualUnlock('drc_master');
    tracker.manualUnlock('bom_complete');
    // Missing: first_fab_order

    const state = emptyState();
    const unlocked = tracker.checkMilestones(state);
    expect(unlocked).not.toContain('full_stack_designer');
  });

  // ---- Idempotent checks --------------------------------------------------

  it('does not re-unlock already unlocked milestones', () => {
    const tracker = MilestoneTracker.getInstance();
    const state = emptyState();
    state.hasRunSimulation = true;

    const first = tracker.checkMilestones(state);
    expect(first).toContain('first_simulation');

    const second = tracker.checkMilestones(state);
    expect(second).not.toContain('first_simulation');
    expect(second).toHaveLength(0);
  });

  // ---- manualUnlock -------------------------------------------------------

  it('manually unlocks a milestone', () => {
    const tracker = MilestoneTracker.getInstance();
    const result = tracker.manualUnlock('first_export');
    expect(result).toBe(true);
    expect(tracker.isUnlocked('first_export')).toBe(true);
  });

  it('returns false when manually unlocking an already unlocked milestone', () => {
    const tracker = MilestoneTracker.getInstance();
    tracker.manualUnlock('first_export');
    const result = tracker.manualUnlock('first_export');
    expect(result).toBe(false);
  });

  it('returns false when manually unlocking an invalid milestone ID', () => {
    const tracker = MilestoneTracker.getInstance();
    const result = tracker.manualUnlock('nonexistent' as MilestoneId);
    expect(result).toBe(false);
  });

  // ---- getNext after partial unlocks --------------------------------------

  it('getNext advances after unlocking milestones', () => {
    const tracker = MilestoneTracker.getInstance();
    tracker.manualUnlock('first_circuit');
    const next = tracker.getNext();
    expect(next).toBeDefined();
    expect(next!.id).toBe('first_simulation');
  });

  it('getNext returns undefined when all milestones are unlocked', () => {
    const tracker = MilestoneTracker.getInstance();
    const state = fullState();
    tracker.checkMilestones(state);
    expect(tracker.getNext()).toBeUndefined();
  });

  // ---- Persistence --------------------------------------------------------

  it('persists unlocks to localStorage', () => {
    const tracker = MilestoneTracker.getInstance();
    tracker.manualUnlock('first_circuit');

    const raw = localStorage.getItem('protopulse-milestone-unlocks');
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!) as Record<string, unknown>;
    expect(parsed).toHaveProperty('first_circuit');
  });

  it('restores unlocks from localStorage on new instance', () => {
    const tracker1 = MilestoneTracker.getInstance();
    tracker1.manualUnlock('first_simulation');
    tracker1.manualUnlock('first_pcb');

    MilestoneTracker.resetForTesting();
    const tracker2 = MilestoneTracker.getInstance();
    expect(tracker2.isUnlocked('first_simulation')).toBe(true);
    expect(tracker2.isUnlocked('first_pcb')).toBe(true);
    expect(tracker2.getUnlockedCount()).toBe(2);
  });

  // ---- resetAll -----------------------------------------------------------

  it('resetAll clears all unlocks and localStorage', () => {
    const tracker = MilestoneTracker.getInstance();
    tracker.manualUnlock('first_circuit');
    tracker.manualUnlock('first_simulation');
    expect(tracker.getUnlockedCount()).toBe(2);

    tracker.resetAll();
    expect(tracker.getUnlockedCount()).toBe(0);
    expect(tracker.getUnlocked()).toHaveLength(0);
    expect(localStorage.getItem('protopulse-milestone-unlocks')).toBeNull();
  });

  // ---- Subscribe + notify -------------------------------------------------

  it('notifies listeners on milestone unlock', () => {
    const tracker = MilestoneTracker.getInstance();
    const listener = vi.fn();
    tracker.subscribe(listener);

    tracker.manualUnlock('first_circuit');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('unsubscribe stops notifications', () => {
    const tracker = MilestoneTracker.getInstance();
    const listener = vi.fn();
    const unsub = tracker.subscribe(listener);

    tracker.manualUnlock('first_circuit');
    expect(listener).toHaveBeenCalledTimes(1);

    unsub();
    tracker.manualUnlock('first_simulation');
    expect(listener).toHaveBeenCalledTimes(1); // no additional call
  });

  it('does not notify when no milestones are unlocked', () => {
    const tracker = MilestoneTracker.getInstance();
    const listener = vi.fn();
    tracker.subscribe(listener);

    tracker.checkMilestones(emptyState());
    expect(listener).not.toHaveBeenCalled();
  });

  // ---- Events -------------------------------------------------------------

  it('records events for newly unlocked milestones', () => {
    const tracker = MilestoneTracker.getInstance();
    tracker.manualUnlock('first_circuit');

    const events = tracker.getRecentEvents();
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('milestone-unlocked');
    expect(events[0].milestoneId).toBe('first_circuit');
    expect(events[0].timestamp).toBeGreaterThan(0);
  });

  it('clearEvents empties the event log', () => {
    const tracker = MilestoneTracker.getInstance();
    tracker.manualUnlock('first_circuit');
    expect(tracker.getRecentEvents()).toHaveLength(1);

    tracker.clearEvents();
    expect(tracker.getRecentEvents()).toHaveLength(0);
  });

  // ---- getMilestone -------------------------------------------------------

  it('getMilestone returns undefined for unknown ID', () => {
    const tracker = MilestoneTracker.getInstance();
    expect(tracker.getMilestone('nonexistent' as MilestoneId)).toBeUndefined();
  });

  it('getMilestone returns correct milestone', () => {
    const tracker = MilestoneTracker.getInstance();
    const m = tracker.getMilestone('drc_master');
    expect(m).toBeDefined();
    expect(m!.name).toBe('DRC Master');
    expect(m!.order).toBe(4);
  });

  // ---- Progress fraction --------------------------------------------------

  it('getProgress returns correct fraction', () => {
    const tracker = MilestoneTracker.getInstance();
    tracker.manualUnlock('first_circuit');
    tracker.manualUnlock('first_simulation');
    // 2 out of 8
    expect(tracker.getProgress()).toBeCloseTo(0.25);
  });

  // ---- getTotal -----------------------------------------------------------

  it('getTotal returns 8', () => {
    const tracker = MilestoneTracker.getInstance();
    expect(tracker.getTotal()).toBe(8);
  });
});
