import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  MilestoneTracker,
  emptyProjectProgress,
  getCategoryLabel,
  getAllCategories,
} from '../progress-milestones';
import type {
  ProjectProgress,
  MilestoneId,
  MilestoneCategory,
} from '../progress-milestones';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function emptyData(): ProjectProgress {
  return emptyProjectProgress();
}

/** Returns a ProjectProgress that satisfies every milestone criterion. */
function fullData(): ProjectProgress {
  return {
    hasNodes: true,
    nodeCount: 10,
    hasEdges: true,
    edgeCount: 8,
    hasBom: true,
    bomItemCount: 7,
    bomItemsWithPartNumbers: 7,
    bomItemsWithPrices: 7,
    hasCircuit: true,
    circuitInstanceCount: 5,
    circuitWireCount: 4,
    hasDrc: true,
    drcErrors: 0,
    drcCleanRunCount: 5,
    drcTotalRunCount: 8,
    hasSimulation: true,
    hasExport: true,
    exportFormats: ['kicad', 'gerber', 'pdf'],
    hasPcbLayout: true,
    pcbTraceCount: 6,
    hasFabOrder: true,
    hasDesignVariables: true,
    sheetCount: 3,
    ercClean: true,
    hasGerberExport: true,
    projectCount: 12,
    hasCommunityContribution: true,
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

  it('has 18 milestones defined', () => {
    const tracker = MilestoneTracker.getInstance();
    expect(tracker.getAllMilestones()).toHaveLength(18);
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
    expect(next!.id).toBe('first_node');
  });

  it('every milestone has a category from the five allowed categories', () => {
    const tracker = MilestoneTracker.getInstance();
    const validCategories: MilestoneCategory[] = [
      'getting_started',
      'design',
      'validation',
      'manufacturing',
      'advanced',
    ];
    for (const m of tracker.getAllMilestones()) {
      expect(validCategories).toContain(m.category);
    }
  });

  it('every milestone has a non-empty name, description, icon, reward, and checkFn', () => {
    const tracker = MilestoneTracker.getInstance();
    for (const m of tracker.getAllMilestones()) {
      expect(m.name.length).toBeGreaterThan(0);
      expect(m.description.length).toBeGreaterThan(0);
      expect(m.icon.length).toBeGreaterThan(0);
      expect(m.reward.length).toBeGreaterThan(0);
      expect(typeof m.criteria.checkFn).toBe('function');
    }
  });

  // ---- Category distribution ----------------------------------------------

  it('has 4 getting_started milestones', () => {
    const tracker = MilestoneTracker.getInstance();
    expect(tracker.getMilestonesByCategory('getting_started')).toHaveLength(4);
  });

  it('has 4 design milestones', () => {
    const tracker = MilestoneTracker.getInstance();
    expect(tracker.getMilestonesByCategory('design')).toHaveLength(4);
  });

  it('has 3 validation milestones', () => {
    const tracker = MilestoneTracker.getInstance();
    expect(tracker.getMilestonesByCategory('validation')).toHaveLength(3);
  });

  it('has 4 manufacturing milestones', () => {
    const tracker = MilestoneTracker.getInstance();
    expect(tracker.getMilestonesByCategory('manufacturing')).toHaveLength(4);
  });

  it('has 3 advanced milestones', () => {
    const tracker = MilestoneTracker.getInstance();
    expect(tracker.getMilestonesByCategory('advanced')).toHaveLength(3);
  });

  // ---- checkMilestones: getting_started -----------------------------------

  it('unlocks first_node when hasNodes and nodeCount >= 1', () => {
    const tracker = MilestoneTracker.getInstance();
    const data = emptyData();
    data.hasNodes = true;
    data.nodeCount = 1;

    const unlocked = tracker.checkMilestones(data);
    expect(unlocked).toContain('first_node');
    expect(tracker.isUnlocked('first_node')).toBe(true);
  });

  it('does NOT unlock first_node when nodeCount is 0', () => {
    const tracker = MilestoneTracker.getInstance();
    const data = emptyData();
    data.hasNodes = false;
    data.nodeCount = 0;

    const unlocked = tracker.checkMilestones(data);
    expect(unlocked).not.toContain('first_node');
  });

  it('unlocks first_edge when hasEdges and nodeCount >= 2', () => {
    const tracker = MilestoneTracker.getInstance();
    const data = emptyData();
    data.hasNodes = true;
    data.nodeCount = 2;
    data.hasEdges = true;
    data.edgeCount = 1;

    const unlocked = tracker.checkMilestones(data);
    expect(unlocked).toContain('first_edge');
  });

  it('does NOT unlock first_edge with only 1 node', () => {
    const tracker = MilestoneTracker.getInstance();
    const data = emptyData();
    data.hasNodes = true;
    data.nodeCount = 1;
    data.hasEdges = true;
    data.edgeCount = 1;

    const unlocked = tracker.checkMilestones(data);
    expect(unlocked).not.toContain('first_edge');
  });

  it('unlocks first_circuit with circuit instances and wires', () => {
    const tracker = MilestoneTracker.getInstance();
    const data = emptyData();
    data.circuitInstanceCount = 2;
    data.circuitWireCount = 1;

    const unlocked = tracker.checkMilestones(data);
    expect(unlocked).toContain('first_circuit');
    expect(tracker.isUnlocked('first_circuit')).toBe(true);
  });

  it('unlocks first_circuit with architecture nodes and edges', () => {
    const tracker = MilestoneTracker.getInstance();
    const data = emptyData();
    data.nodeCount = 3;
    data.edgeCount = 2;

    const unlocked = tracker.checkMilestones(data);
    expect(unlocked).toContain('first_circuit');
  });

  it('does NOT unlock first_circuit with only 1 instance and no wires', () => {
    const tracker = MilestoneTracker.getInstance();
    const data = emptyData();
    data.circuitInstanceCount = 1;
    data.circuitWireCount = 0;

    const unlocked = tracker.checkMilestones(data);
    expect(unlocked).not.toContain('first_circuit');
  });

  it('unlocks first_bom_item when hasBom and bomItemCount >= 1', () => {
    const tracker = MilestoneTracker.getInstance();
    const data = emptyData();
    data.hasBom = true;
    data.bomItemCount = 1;

    const unlocked = tracker.checkMilestones(data);
    expect(unlocked).toContain('first_bom_item');
  });

  // ---- checkMilestones: design --------------------------------------------

  it('unlocks first_simulation when hasSimulation is true', () => {
    const tracker = MilestoneTracker.getInstance();
    const data = emptyData();
    data.hasSimulation = true;

    const unlocked = tracker.checkMilestones(data);
    expect(unlocked).toContain('first_simulation');
  });

  it('unlocks first_pcb with PCB layout and traces', () => {
    const tracker = MilestoneTracker.getInstance();
    const data = emptyData();
    data.hasPcbLayout = true;
    data.pcbTraceCount = 2;

    const unlocked = tracker.checkMilestones(data);
    expect(unlocked).toContain('first_pcb');
  });

  it('does NOT unlock first_pcb with layout but no traces', () => {
    const tracker = MilestoneTracker.getInstance();
    const data = emptyData();
    data.hasPcbLayout = true;
    data.pcbTraceCount = 0;

    const unlocked = tracker.checkMilestones(data);
    expect(unlocked).not.toContain('first_pcb');
  });

  it('unlocks multi_sheet when sheetCount >= 2', () => {
    const tracker = MilestoneTracker.getInstance();
    const data = emptyData();
    data.sheetCount = 2;

    const unlocked = tracker.checkMilestones(data);
    expect(unlocked).toContain('multi_sheet');
  });

  it('does NOT unlock multi_sheet with only 1 sheet', () => {
    const tracker = MilestoneTracker.getInstance();
    const data = emptyData();
    data.sheetCount = 1;

    const unlocked = tracker.checkMilestones(data);
    expect(unlocked).not.toContain('multi_sheet');
  });

  it('unlocks design_variables when hasDesignVariables is true', () => {
    const tracker = MilestoneTracker.getInstance();
    const data = emptyData();
    data.hasDesignVariables = true;

    const unlocked = tracker.checkMilestones(data);
    expect(unlocked).toContain('design_variables');
  });

  // ---- checkMilestones: validation ----------------------------------------

  it('unlocks first_drc_run when hasDrc and drcTotalRunCount >= 1', () => {
    const tracker = MilestoneTracker.getInstance();
    const data = emptyData();
    data.hasDrc = true;
    data.drcTotalRunCount = 1;

    const unlocked = tracker.checkMilestones(data);
    expect(unlocked).toContain('first_drc_run');
  });

  it('does NOT unlock first_drc_run with hasDrc false', () => {
    const tracker = MilestoneTracker.getInstance();
    const data = emptyData();
    data.hasDrc = false;
    data.drcTotalRunCount = 1;

    const unlocked = tracker.checkMilestones(data);
    expect(unlocked).not.toContain('first_drc_run');
  });

  it('unlocks drc_master with 3+ clean DRC runs', () => {
    const tracker = MilestoneTracker.getInstance();
    const data = emptyData();
    data.drcCleanRunCount = 3;
    data.drcTotalRunCount = 5;

    const unlocked = tracker.checkMilestones(data);
    expect(unlocked).toContain('drc_master');
  });

  it('does NOT unlock drc_master with only 2 clean runs', () => {
    const tracker = MilestoneTracker.getInstance();
    const data = emptyData();
    data.drcCleanRunCount = 2;
    data.drcTotalRunCount = 4;

    const unlocked = tracker.checkMilestones(data);
    expect(unlocked).not.toContain('drc_master');
  });

  it('unlocks erc_clean when ercClean is true', () => {
    const tracker = MilestoneTracker.getInstance();
    const data = emptyData();
    data.ercClean = true;

    const unlocked = tracker.checkMilestones(data);
    expect(unlocked).toContain('erc_clean');
  });

  // ---- checkMilestones: manufacturing -------------------------------------

  it('unlocks first_export when hasExport is true', () => {
    const tracker = MilestoneTracker.getInstance();
    const data = emptyData();
    data.hasExport = true;

    const unlocked = tracker.checkMilestones(data);
    expect(unlocked).toContain('first_export');
  });

  it('unlocks bom_complete with 5+ fully specified BOM items', () => {
    const tracker = MilestoneTracker.getInstance();
    const data = emptyData();
    data.bomItemCount = 6;
    data.bomItemsWithPartNumbers = 6;
    data.bomItemsWithPrices = 6;

    const unlocked = tracker.checkMilestones(data);
    expect(unlocked).toContain('bom_complete');
  });

  it('does NOT unlock bom_complete when items lack part numbers', () => {
    const tracker = MilestoneTracker.getInstance();
    const data = emptyData();
    data.bomItemCount = 5;
    data.bomItemsWithPartNumbers = 3;
    data.bomItemsWithPrices = 5;

    const unlocked = tracker.checkMilestones(data);
    expect(unlocked).not.toContain('bom_complete');
  });

  it('unlocks gerber_ready when hasGerberExport is true', () => {
    const tracker = MilestoneTracker.getInstance();
    const data = emptyData();
    data.hasGerberExport = true;

    const unlocked = tracker.checkMilestones(data);
    expect(unlocked).toContain('gerber_ready');
  });

  it('unlocks first_fab_order when hasFabOrder is true', () => {
    const tracker = MilestoneTracker.getInstance();
    const data = emptyData();
    data.hasFabOrder = true;

    const unlocked = tracker.checkMilestones(data);
    expect(unlocked).toContain('first_fab_order');
  });

  // ---- checkMilestones: advanced ------------------------------------------

  it('unlocks ten_projects when projectCount >= 10', () => {
    const tracker = MilestoneTracker.getInstance();
    const data = emptyData();
    data.projectCount = 10;

    const unlocked = tracker.checkMilestones(data);
    expect(unlocked).toContain('ten_projects');
  });

  it('does NOT unlock ten_projects with only 9 projects', () => {
    const tracker = MilestoneTracker.getInstance();
    const data = emptyData();
    data.projectCount = 9;

    const unlocked = tracker.checkMilestones(data);
    expect(unlocked).not.toContain('ten_projects');
  });

  it('unlocks community_contributor when hasCommunityContribution is true', () => {
    const tracker = MilestoneTracker.getInstance();
    const data = emptyData();
    data.hasCommunityContribution = true;

    const unlocked = tracker.checkMilestones(data);
    expect(unlocked).toContain('community_contributor');
  });

  // ---- checkMilestones: full_stack_designer (capstone) --------------------

  it('unlocks full_stack_designer when all 15 prerequisites are met in one check', () => {
    const tracker = MilestoneTracker.getInstance();
    const data = fullData();
    const unlocked = tracker.checkMilestones(data);

    // All 18 milestones should unlock (15 prereqs + ten_projects + community_contributor + full_stack_designer)
    expect(unlocked).toHaveLength(18);
    expect(unlocked).toContain('full_stack_designer');
    expect(tracker.getProgress()).toBe(1);
  });

  it('does NOT unlock full_stack_designer when one prerequisite is missing', () => {
    const tracker = MilestoneTracker.getInstance();
    // Manually unlock 14 of 15 prerequisites
    const prereqs: MilestoneId[] = [
      'first_node',
      'first_edge',
      'first_circuit',
      'first_bom_item',
      'first_simulation',
      'first_pcb',
      'multi_sheet',
      'design_variables',
      'first_drc_run',
      'drc_master',
      'erc_clean',
      'first_export',
      'bom_complete',
      'gerber_ready',
      // Missing: first_fab_order
    ];
    for (const id of prereqs) {
      tracker.manualUnlock(id);
    }

    const data = emptyData();
    const unlocked = tracker.checkMilestones(data);
    expect(unlocked).not.toContain('full_stack_designer');
  });

  it('unlocks full_stack_designer when last prerequisite is provided', () => {
    const tracker = MilestoneTracker.getInstance();
    // Manually unlock 14 of 15 prerequisites
    const prereqs: MilestoneId[] = [
      'first_node',
      'first_edge',
      'first_circuit',
      'first_bom_item',
      'first_simulation',
      'first_pcb',
      'multi_sheet',
      'design_variables',
      'first_drc_run',
      'drc_master',
      'erc_clean',
      'first_export',
      'bom_complete',
      'gerber_ready',
    ];
    for (const id of prereqs) {
      tracker.manualUnlock(id);
    }

    // Now unlock the last one via checkMilestones
    const data = emptyData();
    data.hasFabOrder = true;
    const unlocked = tracker.checkMilestones(data);
    expect(unlocked).toContain('first_fab_order');
    expect(unlocked).toContain('full_stack_designer');
  });

  // ---- Idempotent checks --------------------------------------------------

  it('does not re-unlock already unlocked milestones', () => {
    const tracker = MilestoneTracker.getInstance();
    const data = emptyData();
    data.hasSimulation = true;

    const first = tracker.checkMilestones(data);
    expect(first).toContain('first_simulation');

    const second = tracker.checkMilestones(data);
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
    tracker.manualUnlock('first_node');
    const next = tracker.getNext();
    expect(next).toBeDefined();
    expect(next!.id).toBe('first_edge');
  });

  it('getNext returns undefined when all milestones are unlocked', () => {
    const tracker = MilestoneTracker.getInstance();
    const data = fullData();
    tracker.checkMilestones(data);
    expect(tracker.getNext()).toBeUndefined();
  });

  // ---- getNextMilestone (data-aware) --------------------------------------

  it('getNextMilestone returns the first locked non-capstone milestone', () => {
    const tracker = MilestoneTracker.getInstance();
    const data = emptyData();
    const next = tracker.getNextMilestone(data);
    expect(next).toBeDefined();
    expect(next!.id).toBe('first_node');
  });

  it('getNextMilestone advances past unlocked milestones', () => {
    const tracker = MilestoneTracker.getInstance();
    tracker.manualUnlock('first_node');
    tracker.manualUnlock('first_edge');
    const data = emptyData();
    const next = tracker.getNextMilestone(data);
    expect(next).toBeDefined();
    expect(next!.id).toBe('first_circuit');
  });

  it('getNextMilestone returns capstone when only it remains', () => {
    const tracker = MilestoneTracker.getInstance();
    // Unlock all 17 non-capstone milestones
    const allIds: MilestoneId[] = [
      'first_node', 'first_edge', 'first_circuit', 'first_bom_item',
      'first_simulation', 'first_pcb', 'multi_sheet', 'design_variables',
      'first_drc_run', 'drc_master', 'erc_clean',
      'first_export', 'bom_complete', 'gerber_ready', 'first_fab_order',
      'ten_projects', 'community_contributor',
    ];
    for (const id of allIds) {
      tracker.manualUnlock(id);
    }
    const data = emptyData();
    const next = tracker.getNextMilestone(data);
    expect(next).toBeDefined();
    expect(next!.id).toBe('full_stack_designer');
  });

  it('getNextMilestone returns undefined when all milestones are unlocked', () => {
    const tracker = MilestoneTracker.getInstance();
    const data = fullData();
    tracker.checkMilestones(data);
    expect(tracker.getNextMilestone(data)).toBeUndefined();
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

  it('handles corrupted localStorage gracefully', () => {
    localStorage.setItem('protopulse-milestone-unlocks', '{{invalid json}}');
    MilestoneTracker.resetForTesting();
    const tracker = MilestoneTracker.getInstance();
    expect(tracker.getUnlockedCount()).toBe(0);
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

    tracker.checkMilestones(emptyData());
    expect(listener).not.toHaveBeenCalled();
  });

  it('notifies on resetAll', () => {
    const tracker = MilestoneTracker.getInstance();
    tracker.manualUnlock('first_circuit');
    const listener = vi.fn();
    tracker.subscribe(listener);

    tracker.resetAll();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('supports multiple concurrent listeners', () => {
    const tracker = MilestoneTracker.getInstance();
    const listener1 = vi.fn();
    const listener2 = vi.fn();
    tracker.subscribe(listener1);
    tracker.subscribe(listener2);

    tracker.manualUnlock('first_node');
    expect(listener1).toHaveBeenCalledTimes(1);
    expect(listener2).toHaveBeenCalledTimes(1);
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

  it('records multiple events from a single checkMilestones call', () => {
    const tracker = MilestoneTracker.getInstance();
    const data = emptyData();
    data.hasSimulation = true;
    data.hasExport = true;
    data.ercClean = true;

    tracker.checkMilestones(data);
    const events = tracker.getRecentEvents();
    expect(events.length).toBeGreaterThanOrEqual(3);
    const ids = events.map((e) => e.milestoneId);
    expect(ids).toContain('first_simulation');
    expect(ids).toContain('first_export');
    expect(ids).toContain('erc_clean');
  });

  it('getRecentEvents returns a copy (not a reference)', () => {
    const tracker = MilestoneTracker.getInstance();
    tracker.manualUnlock('first_circuit');
    const events1 = tracker.getRecentEvents();
    const events2 = tracker.getRecentEvents();
    expect(events1).not.toBe(events2);
    expect(events1).toEqual(events2);
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
    expect(m!.category).toBe('validation');
  });

  it('getMilestone returns milestone with correct category', () => {
    const tracker = MilestoneTracker.getInstance();
    const m = tracker.getMilestone('first_node');
    expect(m).toBeDefined();
    expect(m!.category).toBe('getting_started');
  });

  // ---- getMilestonesByCategory --------------------------------------------

  it('getMilestonesByCategory returns milestones sorted by order', () => {
    const tracker = MilestoneTracker.getInstance();
    const design = tracker.getMilestonesByCategory('design');
    for (let i = 1; i < design.length; i++) {
      expect(design[i].order).toBeGreaterThan(design[i - 1].order);
    }
  });

  it('getMilestonesByCategory returns empty array for unknown category', () => {
    const tracker = MilestoneTracker.getInstance();
    const result = tracker.getMilestonesByCategory('unknown' as MilestoneCategory);
    expect(result).toHaveLength(0);
  });

  // ---- Progress fraction + percentage -------------------------------------

  it('getProgress returns correct fraction', () => {
    const tracker = MilestoneTracker.getInstance();
    tracker.manualUnlock('first_circuit');
    tracker.manualUnlock('first_simulation');
    // 2 out of 18
    expect(tracker.getProgress()).toBeCloseTo(2 / 18);
  });

  it('getProgressPercentage returns 0 initially', () => {
    const tracker = MilestoneTracker.getInstance();
    expect(tracker.getProgressPercentage()).toBe(0);
  });

  it('getProgressPercentage returns 100 when all unlocked', () => {
    const tracker = MilestoneTracker.getInstance();
    const data = fullData();
    tracker.checkMilestones(data);
    expect(tracker.getProgressPercentage()).toBe(100);
  });

  it('getProgressPercentage rounds to nearest integer', () => {
    const tracker = MilestoneTracker.getInstance();
    tracker.manualUnlock('first_node');
    // 1/18 = 5.555...% -> rounds to 6
    expect(tracker.getProgressPercentage()).toBe(Math.round((1 / 18) * 100));
  });

  // ---- Category progress --------------------------------------------------

  it('getCategoryProgress returns 0 for a category with no unlocks', () => {
    const tracker = MilestoneTracker.getInstance();
    expect(tracker.getCategoryProgress('getting_started')).toBe(0);
  });

  it('getCategoryProgress returns correct fraction for partial category', () => {
    const tracker = MilestoneTracker.getInstance();
    tracker.manualUnlock('first_node');
    tracker.manualUnlock('first_edge');
    // 2 of 4 getting_started milestones
    expect(tracker.getCategoryProgress('getting_started')).toBeCloseTo(0.5);
  });

  it('getCategoryProgress returns 1 when all milestones in category are unlocked', () => {
    const tracker = MilestoneTracker.getInstance();
    tracker.manualUnlock('first_node');
    tracker.manualUnlock('first_edge');
    tracker.manualUnlock('first_circuit');
    tracker.manualUnlock('first_bom_item');
    expect(tracker.getCategoryProgress('getting_started')).toBe(1);
  });

  it('getCategoryProgress returns 0 for unknown category', () => {
    const tracker = MilestoneTracker.getInstance();
    expect(tracker.getCategoryProgress('unknown' as MilestoneCategory)).toBe(0);
  });

  // ---- getTotal -----------------------------------------------------------

  it('getTotal returns 18', () => {
    const tracker = MilestoneTracker.getInstance();
    expect(tracker.getTotal()).toBe(18);
  });

  // ---- emptyProjectProgress -----------------------------------------------

  it('emptyProjectProgress returns all-zero/false state', () => {
    const data = emptyProjectProgress();
    expect(data.hasNodes).toBe(false);
    expect(data.nodeCount).toBe(0);
    expect(data.hasEdges).toBe(false);
    expect(data.bomItemCount).toBe(0);
    expect(data.hasCircuit).toBe(false);
    expect(data.hasDrc).toBe(false);
    expect(data.drcErrors).toBe(0);
    expect(data.hasSimulation).toBe(false);
    expect(data.hasExport).toBe(false);
    expect(data.exportFormats).toEqual([]);
    expect(data.hasFabOrder).toBe(false);
    expect(data.projectCount).toBe(0);
    expect(data.hasCommunityContribution).toBe(false);
  });

  // ---- Category helpers ---------------------------------------------------

  it('getCategoryLabel returns human-readable labels', () => {
    expect(getCategoryLabel('getting_started')).toBe('Getting Started');
    expect(getCategoryLabel('design')).toBe('Design');
    expect(getCategoryLabel('validation')).toBe('Validation');
    expect(getCategoryLabel('manufacturing')).toBe('Manufacturing');
    expect(getCategoryLabel('advanced')).toBe('Advanced');
  });

  it('getAllCategories returns 5 categories in order', () => {
    const cats = getAllCategories();
    expect(cats).toHaveLength(5);
    expect(cats).toEqual([
      'getting_started',
      'design',
      'validation',
      'manufacturing',
      'advanced',
    ]);
  });
});
