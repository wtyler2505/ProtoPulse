import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Stub globals before importing the module
// ---------------------------------------------------------------------------

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

let uuidCounter = 0;
vi.stubGlobal('crypto', {
  randomUUID: vi.fn(() => `uuid-${uuidCounter++}`),
});

import {
  MissionModeManager,
  MISSION_PHASES,
  MISSION_PHASE_LABELS,
  MISSION_PHASE_DESCRIPTIONS,
  riskScore,
  phaseIndex,
  nextPhase,
  previousPhase,
  calculateCostBreakdown,
  bomCostForQuantity,
  useMissionMode,
} from '../mission-mode';
import type {
  MissionPhase,
  Mission,
  MissionRisk,
  MissionMilestone,
  CostLineItem,
  CostBreakdown,
  RiskSeverity,
  RiskLikelihood,
  CreateMilestoneInput,
  CreateRiskInput,
  CreateCostInput,
  BomCostItem,
  PackingListItem,
} from '../mission-mode';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clearStore(): void {
  for (const k of Object.keys(store)) {
    delete store[k];
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MissionModeManager', () => {
  let mgr: MissionModeManager;

  beforeEach(() => {
    uuidCounter = 0;
    clearStore();
    MissionModeManager.resetForTesting();
    mgr = MissionModeManager.getInstance();
  });

  afterEach(() => {
    MissionModeManager.resetForTesting();
  });

  // -----------------------------------------------------------------------
  // Singleton
  // -----------------------------------------------------------------------

  describe('singleton', () => {
    it('returns the same instance', () => {
      expect(MissionModeManager.getInstance()).toBe(mgr);
    });

    it('returns new instance after resetForTesting', () => {
      MissionModeManager.resetForTesting();
      expect(MissionModeManager.getInstance()).not.toBe(mgr);
    });
  });

  // -----------------------------------------------------------------------
  // Subscription
  // -----------------------------------------------------------------------

  describe('subscribe', () => {
    it('calls listener on state changes', () => {
      const listener = vi.fn();
      mgr.subscribe(listener);
      mgr.createMission('test');
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('unsubscribes correctly', () => {
      const listener = vi.fn();
      const unsub = mgr.subscribe(listener);
      unsub();
      mgr.createMission('test');
      expect(listener).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // Helper functions
  // -----------------------------------------------------------------------

  describe('helper functions', () => {
    it('riskScore computes severity * likelihood', () => {
      expect(riskScore('low', 'unlikely')).toBe(1);
      expect(riskScore('critical', 'certain')).toBe(16);
      expect(riskScore('high', 'possible')).toBe(6);
    });

    it('phaseIndex returns correct index', () => {
      expect(phaseIndex('concept')).toBe(0);
      expect(phaseIndex('ship')).toBe(6);
    });

    it('nextPhase returns next or null', () => {
      expect(nextPhase('concept')).toBe('design');
      expect(nextPhase('ship')).toBeNull();
    });

    it('previousPhase returns previous or null', () => {
      expect(previousPhase('concept')).toBeNull();
      expect(previousPhase('design')).toBe('concept');
    });

    it('MISSION_PHASES has 7 phases', () => {
      expect(MISSION_PHASES).toHaveLength(7);
    });

    it('MISSION_PHASE_LABELS has labels for all phases', () => {
      MISSION_PHASES.forEach((p) => {
        expect(MISSION_PHASE_LABELS[p]).toBeDefined();
      });
    });

    it('MISSION_PHASE_DESCRIPTIONS has descriptions for all phases', () => {
      MISSION_PHASES.forEach((p) => {
        expect(MISSION_PHASE_DESCRIPTIONS[p]).toBeDefined();
      });
    });
  });

  // -----------------------------------------------------------------------
  // Mission CRUD
  // -----------------------------------------------------------------------

  describe('createMission', () => {
    it('creates a mission in concept phase', () => {
      const id = mgr.createMission('Board v1');
      const m = mgr.getMission(id);
      expect(m).not.toBeNull();
      expect(m!.name).toBe('Board v1');
      expect(m!.currentPhase).toBe('concept');
      expect(m!.targetQuantity).toBe(1);
    });

    it('creates with description and target quantity', () => {
      const id = mgr.createMission('Board v2', 'Production run', 100);
      const m = mgr.getMission(id)!;
      expect(m.description).toBe('Production run');
      expect(m.targetQuantity).toBe(100);
    });

    it('sets first mission as active', () => {
      const id = mgr.createMission('First');
      expect(mgr.getActiveMissionId()).toBe(id);
    });

    it('does not change active on second create', () => {
      const id1 = mgr.createMission('First');
      mgr.createMission('Second');
      expect(mgr.getActiveMissionId()).toBe(id1);
    });
  });

  describe('getMission', () => {
    it('returns null for unknown id', () => {
      expect(mgr.getMission('nope')).toBeNull();
    });

    it('returns a clone', () => {
      const id = mgr.createMission('Test');
      const m1 = mgr.getMission(id)!;
      m1.name = 'modified';
      expect(mgr.getMission(id)!.name).toBe('Test');
    });
  });

  describe('getAllMissions', () => {
    it('returns all missions', () => {
      mgr.createMission('A');
      mgr.createMission('B');
      expect(mgr.getAllMissions()).toHaveLength(2);
    });
  });

  describe('deleteMission', () => {
    it('deletes a mission', () => {
      const id = mgr.createMission('Delete me');
      expect(mgr.deleteMission(id)).toBe(true);
      expect(mgr.getMission(id)).toBeNull();
    });

    it('updates active mission when active is deleted', () => {
      const id1 = mgr.createMission('First');
      const id2 = mgr.createMission('Second');
      expect(mgr.getActiveMissionId()).toBe(id1);
      mgr.deleteMission(id1);
      expect(mgr.getActiveMissionId()).toBe(id2);
    });

    it('sets active to null when last mission deleted', () => {
      const id = mgr.createMission('Only');
      mgr.deleteMission(id);
      expect(mgr.getActiveMissionId()).toBeNull();
    });

    it('returns false for unknown id', () => {
      expect(mgr.deleteMission('nope')).toBe(false);
    });
  });

  describe('renameMission', () => {
    it('renames a mission', () => {
      const id = mgr.createMission('Old');
      expect(mgr.renameMission(id, 'New')).toBe(true);
      expect(mgr.getMission(id)!.name).toBe('New');
    });

    it('returns false for unknown id', () => {
      expect(mgr.renameMission('nope', 'test')).toBe(false);
    });
  });

  describe('setActiveMission', () => {
    it('sets active mission', () => {
      mgr.createMission('A');
      const id2 = mgr.createMission('B');
      expect(mgr.setActiveMission(id2)).toBe(true);
      expect(mgr.getActiveMissionId()).toBe(id2);
    });

    it('returns false for unknown id', () => {
      expect(mgr.setActiveMission('nope')).toBe(false);
    });
  });

  describe('setTargetQuantity', () => {
    it('sets target quantity', () => {
      const id = mgr.createMission('Test');
      expect(mgr.setTargetQuantity(id, 50)).toBe(true);
      expect(mgr.getMission(id)!.targetQuantity).toBe(50);
    });

    it('floors decimal quantities', () => {
      const id = mgr.createMission('Test');
      mgr.setTargetQuantity(id, 10.7);
      expect(mgr.getMission(id)!.targetQuantity).toBe(10);
    });

    it('returns false for qty < 1', () => {
      const id = mgr.createMission('Test');
      expect(mgr.setTargetQuantity(id, 0)).toBe(false);
    });

    it('returns false for unknown id', () => {
      expect(mgr.setTargetQuantity('nope', 5)).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Phase management
  // -----------------------------------------------------------------------

  describe('advancePhase', () => {
    it('advances to next phase', () => {
      const id = mgr.createMission('Test');
      expect(mgr.advancePhase(id)).toBe(true);
      expect(mgr.getMission(id)!.currentPhase).toBe('design');
    });

    it('records phase completion timestamp', () => {
      const id = mgr.createMission('Test');
      mgr.advancePhase(id);
      const m = mgr.getMission(id)!;
      expect(m.phaseCompletedAt['concept']).toBeDefined();
    });

    it('returns false at ship (last phase)', () => {
      const id = mgr.createMission('Test');
      for (let i = 0; i < 6; i++) {
        mgr.advancePhase(id);
      }
      expect(mgr.getMission(id)!.currentPhase).toBe('ship');
      expect(mgr.advancePhase(id)).toBe(false);
    });

    it('returns false for unknown id', () => {
      expect(mgr.advancePhase('nope')).toBe(false);
    });
  });

  describe('revertPhase', () => {
    it('reverts to previous phase', () => {
      const id = mgr.createMission('Test');
      mgr.advancePhase(id);
      expect(mgr.revertPhase(id)).toBe(true);
      expect(mgr.getMission(id)!.currentPhase).toBe('concept');
    });

    it('clears phase completion on revert', () => {
      const id = mgr.createMission('Test');
      mgr.advancePhase(id); // concept → design
      mgr.revertPhase(id); // design → concept
      expect(mgr.getMission(id)!.phaseCompletedAt['concept']).toBeUndefined();
    });

    it('returns false at concept (first phase)', () => {
      const id = mgr.createMission('Test');
      expect(mgr.revertPhase(id)).toBe(false);
    });
  });

  describe('setPhase', () => {
    it('jumps to any phase', () => {
      const id = mgr.createMission('Test');
      expect(mgr.setPhase(id, 'test')).toBe(true);
      expect(mgr.getMission(id)!.currentPhase).toBe('test');
    });

    it('returns false for unknown id', () => {
      expect(mgr.setPhase('nope', 'test')).toBe(false);
    });
  });

  describe('completeMission', () => {
    it('marks mission as completed', () => {
      const id = mgr.createMission('Test');
      expect(mgr.completeMission(id)).toBe(true);
      expect(mgr.getMission(id)!.completedAt).toBeDefined();
    });

    it('returns false for unknown id', () => {
      expect(mgr.completeMission('nope')).toBe(false);
    });
  });

  describe('getPhaseProgress', () => {
    it('returns progress', () => {
      const id = mgr.createMission('Test');
      mgr.advancePhase(id);
      mgr.advancePhase(id);
      const p = mgr.getPhaseProgress(id)!;
      expect(p.completed).toBe(2);
      expect(p.total).toBe(7);
      expect(p.percentage).toBe(29);
    });

    it('returns null for unknown id', () => {
      expect(mgr.getPhaseProgress('nope')).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // Milestones
  // -----------------------------------------------------------------------

  describe('milestones', () => {
    it('adds a milestone', () => {
      const id = mgr.createMission('Test');
      const msId = mgr.addMilestone(id, { name: 'Schematic done', phase: 'design' });
      expect(msId).not.toBeNull();
      const m = mgr.getMission(id)!;
      expect(m.milestones).toHaveLength(1);
      expect(m.milestones[0].name).toBe('Schematic done');
      expect(m.milestones[0].completed).toBe(false);
    });

    it('completes a milestone', () => {
      const id = mgr.createMission('Test');
      const msId = mgr.addMilestone(id, { name: 'Done', phase: 'concept' })!;
      expect(mgr.completeMilestone(id, msId)).toBe(true);
      expect(mgr.getMission(id)!.milestones[0].completed).toBe(true);
      expect(mgr.getMission(id)!.milestones[0].completedAt).toBeDefined();
    });

    it('uncompletes a milestone', () => {
      const id = mgr.createMission('Test');
      const msId = mgr.addMilestone(id, { name: 'Done', phase: 'concept' })!;
      mgr.completeMilestone(id, msId);
      expect(mgr.uncompleteMilestone(id, msId)).toBe(true);
      expect(mgr.getMission(id)!.milestones[0].completed).toBe(false);
    });

    it('removes a milestone', () => {
      const id = mgr.createMission('Test');
      const msId = mgr.addMilestone(id, { name: 'Remove me', phase: 'concept' })!;
      expect(mgr.removeMilestone(id, msId)).toBe(true);
      expect(mgr.getMission(id)!.milestones).toHaveLength(0);
    });

    it('gets milestones for phase', () => {
      const id = mgr.createMission('Test');
      mgr.addMilestone(id, { name: 'MS1', phase: 'concept' });
      mgr.addMilestone(id, { name: 'MS2', phase: 'design' });
      mgr.addMilestone(id, { name: 'MS3', phase: 'concept' });
      expect(mgr.getMilestonesForPhase(id, 'concept')).toHaveLength(2);
      expect(mgr.getMilestonesForPhase(id, 'design')).toHaveLength(1);
    });

    it('returns null when adding to unknown mission', () => {
      expect(mgr.addMilestone('nope', { name: 'x', phase: 'concept' })).toBeNull();
    });

    it('returns false when completing unknown milestone', () => {
      const id = mgr.createMission('Test');
      expect(mgr.completeMilestone(id, 'nope')).toBe(false);
    });

    it('returns false when removing unknown milestone', () => {
      const id = mgr.createMission('Test');
      expect(mgr.removeMilestone(id, 'nope')).toBe(false);
    });

    it('returns empty for unknown mission getMilestonesForPhase', () => {
      expect(mgr.getMilestonesForPhase('nope', 'concept')).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // Risks
  // -----------------------------------------------------------------------

  describe('risks', () => {
    it('adds a risk', () => {
      const id = mgr.createMission('Test');
      const riskId = mgr.addRisk(id, {
        description: 'Supply chain',
        severity: 'high',
        likelihood: 'possible',
      });
      expect(riskId).not.toBeNull();
      const m = mgr.getMission(id)!;
      expect(m.risks).toHaveLength(1);
      expect(m.risks[0].status).toBe('open');
    });

    it('uses current phase when phase not specified', () => {
      const id = mgr.createMission('Test');
      mgr.advancePhase(id); // now design
      mgr.addRisk(id, { description: 'Test', severity: 'low', likelihood: 'unlikely' });
      expect(mgr.getMission(id)!.risks[0].phase).toBe('design');
    });

    it('uses specified phase', () => {
      const id = mgr.createMission('Test');
      mgr.addRisk(id, { description: 'Test', severity: 'low', likelihood: 'unlikely', phase: 'produce' });
      expect(mgr.getMission(id)!.risks[0].phase).toBe('produce');
    });

    it('updates risk status', () => {
      const id = mgr.createMission('Test');
      const riskId = mgr.addRisk(id, { description: 'Test', severity: 'medium', likelihood: 'likely' })!;
      expect(mgr.updateRiskStatus(id, riskId, 'mitigated')).toBe(true);
      expect(mgr.getMission(id)!.risks[0].status).toBe('mitigated');
    });

    it('removes a risk', () => {
      const id = mgr.createMission('Test');
      const riskId = mgr.addRisk(id, { description: 'Test', severity: 'low', likelihood: 'unlikely' })!;
      expect(mgr.removeRisk(id, riskId)).toBe(true);
      expect(mgr.getMission(id)!.risks).toHaveLength(0);
    });

    it('returns null when adding to unknown mission', () => {
      expect(mgr.addRisk('nope', { description: 'x', severity: 'low', likelihood: 'unlikely' })).toBeNull();
    });

    it('returns false for unknown risk update', () => {
      const id = mgr.createMission('Test');
      expect(mgr.updateRiskStatus(id, 'nope', 'resolved')).toBe(false);
    });

    it('returns false for unknown risk remove', () => {
      const id = mgr.createMission('Test');
      expect(mgr.removeRisk(id, 'nope')).toBe(false);
    });
  });

  describe('getRiskAssessment', () => {
    it('calculates risk assessment', () => {
      const id = mgr.createMission('Test');
      mgr.addRisk(id, { description: 'R1', severity: 'high', likelihood: 'likely' });
      mgr.addRisk(id, { description: 'R2', severity: 'critical', likelihood: 'possible' });
      const riskId3 = mgr.addRisk(id, { description: 'R3', severity: 'low', likelihood: 'unlikely' })!;
      mgr.updateRiskStatus(id, riskId3, 'resolved');

      const assessment = mgr.getRiskAssessment(id)!;
      expect(assessment.openRisks).toBe(2);
      expect(assessment.criticalRisks).toBe(1);
      // high(3)*likely(3) + critical(4)*possible(2) = 9 + 8 = 17
      expect(assessment.totalScore).toBe(17);
    });

    it('returns null for unknown id', () => {
      expect(mgr.getRiskAssessment('nope')).toBeNull();
    });

    it('tracks risks by phase', () => {
      const id = mgr.createMission('Test');
      mgr.addRisk(id, { description: 'R1', severity: 'low', likelihood: 'unlikely', phase: 'concept' });
      mgr.addRisk(id, { description: 'R2', severity: 'low', likelihood: 'unlikely', phase: 'concept' });
      mgr.addRisk(id, { description: 'R3', severity: 'low', likelihood: 'unlikely', phase: 'test' });
      const assessment = mgr.getRiskAssessment(id)!;
      expect(assessment.risksByPhase['concept']).toBe(2);
      expect(assessment.risksByPhase['test']).toBe(1);
      expect(assessment.risksByPhase['design']).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // Cost Management
  // -----------------------------------------------------------------------

  describe('costs', () => {
    it('adds a cost item', () => {
      const id = mgr.createMission('Test');
      const costId = mgr.addCost(id, { category: 'pcb', description: 'PCB fab', unitCost: 5.00 });
      expect(costId).not.toBeNull();
      expect(mgr.getMission(id)!.costs).toHaveLength(1);
    });

    it('removes a cost item', () => {
      const id = mgr.createMission('Test');
      const costId = mgr.addCost(id, { category: 'pcb', description: 'PCB fab', unitCost: 5.00 })!;
      expect(mgr.removeCost(id, costId)).toBe(true);
      expect(mgr.getMission(id)!.costs).toHaveLength(0);
    });

    it('returns null for unknown mission', () => {
      expect(mgr.addCost('nope', { category: 'pcb', description: 'x', unitCost: 1 })).toBeNull();
    });

    it('returns false for unknown cost remove', () => {
      const id = mgr.createMission('Test');
      expect(mgr.removeCost(id, 'nope')).toBe(false);
    });
  });

  describe('calculateCostBreakdown', () => {
    it('calculates fixed + per-unit costs', () => {
      const costs: CostLineItem[] = [
        { id: '1', category: 'tooling', description: 'Stencil', unitCost: 50, quantity: 1, isPerUnit: false, phase: 'produce' },
        { id: '2', category: 'pcb', description: 'PCB', unitCost: 2, quantity: 1, isPerUnit: true, phase: 'produce' },
        { id: '3', category: 'components', description: 'Parts', unitCost: 10, quantity: 1, isPerUnit: true, phase: 'produce' },
      ];
      const bd = calculateCostBreakdown(costs, 10);
      expect(bd.totalFixed).toBe(50);
      expect(bd.totalPerUnit).toBe(12); // 2 + 10
      expect(bd.totalForQuantity).toBe(170); // 50 + 12*10
      expect(bd.costPerUnit).toBe(17); // 170/10
      expect(bd.byCategory['tooling']).toBe(50);
      expect(bd.byCategory['pcb']).toBe(20); // 2*10
      expect(bd.byCategory['components']).toBe(100); // 10*10
    });

    it('handles zero quantity', () => {
      const bd = calculateCostBreakdown([], 0);
      expect(bd.costPerUnit).toBe(0);
    });

    it('handles multiple quantities per cost item', () => {
      const costs: CostLineItem[] = [
        { id: '1', category: 'components', description: 'Resistors', unitCost: 0.01, quantity: 20, isPerUnit: true, phase: 'produce' },
      ];
      const bd = calculateCostBreakdown(costs, 5);
      expect(bd.totalPerUnit).toBe(0.2); // 0.01 * 20
      expect(bd.totalForQuantity).toBe(1); // 0.2 * 5
    });
  });

  describe('getCostBreakdown', () => {
    it('returns cost breakdown for mission', () => {
      const id = mgr.createMission('Test', '', 10);
      mgr.addCost(id, { category: 'pcb', description: 'PCB', unitCost: 3, isPerUnit: true });
      const bd = mgr.getCostBreakdown(id)!;
      expect(bd.totalForQuantity).toBe(30); // 3*10
    });

    it('accepts custom quantity override', () => {
      const id = mgr.createMission('Test', '', 10);
      mgr.addCost(id, { category: 'pcb', description: 'PCB', unitCost: 3, isPerUnit: true });
      const bd = mgr.getCostBreakdown(id, 5)!;
      expect(bd.totalForQuantity).toBe(15); // 3*5
    });

    it('returns null for unknown id', () => {
      expect(mgr.getCostBreakdown('nope')).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // BOM Integration
  // -----------------------------------------------------------------------

  describe('BOM integration', () => {
    it('sets BOM items', () => {
      const id = mgr.createMission('Test');
      const items: BomCostItem[] = [
        { partNumber: 'R100K', description: '100K resistor', unitPrice: 0.01, quantity: 10 },
        { partNumber: 'C100N', description: '100nF cap', unitPrice: 0.02, quantity: 5 },
      ];
      expect(mgr.setBomItems(id, items)).toBe(true);
      expect(mgr.getMission(id)!.bomItems).toHaveLength(2);
    });

    it('returns false for unknown mission', () => {
      expect(mgr.setBomItems('nope', [])).toBe(false);
    });

    it('clones BOM items', () => {
      const id = mgr.createMission('Test');
      const items: BomCostItem[] = [
        { partNumber: 'R1', description: 'res', unitPrice: 0.01, quantity: 1 },
      ];
      mgr.setBomItems(id, items);
      items[0].partNumber = 'modified';
      expect(mgr.getMission(id)!.bomItems[0].partNumber).toBe('R1');
    });
  });

  describe('bomCostForQuantity', () => {
    it('calculates total BOM cost', () => {
      const items: BomCostItem[] = [
        { partNumber: 'R1', description: 'res', unitPrice: 0.01, quantity: 10 },
        { partNumber: 'C1', description: 'cap', unitPrice: 0.05, quantity: 5 },
      ];
      // (0.01*10 + 0.05*5) * 3 = (0.10 + 0.25) * 3 = 1.05
      expect(bomCostForQuantity(items, 3)).toBe(1.05);
    });

    it('handles empty BOM', () => {
      expect(bomCostForQuantity([], 100)).toBe(0);
    });
  });

  describe('getBomCost', () => {
    it('returns BOM cost for mission', () => {
      const id = mgr.createMission('Test', '', 5);
      mgr.setBomItems(id, [
        { partNumber: 'R1', description: 'res', unitPrice: 1, quantity: 2 },
      ]);
      expect(mgr.getBomCost(id)).toBe(10); // 1*2*5
    });

    it('returns null for unknown id', () => {
      expect(mgr.getBomCost('nope')).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // Packing List
  // -----------------------------------------------------------------------

  describe('packing list', () => {
    it('adds a packing list item', () => {
      const id = mgr.createMission('Test');
      expect(mgr.addPackingListItem(id, { item: 'Board', category: 'board' })).toBe(true);
      expect(mgr.getMission(id)!.packingList).toHaveLength(1);
      expect(mgr.getMission(id)!.packingList[0].quantity).toBe(1); // default
    });

    it('adds with custom quantity and notes', () => {
      const id = mgr.createMission('Test');
      mgr.addPackingListItem(id, { item: 'USB cable', category: 'cable', quantity: 2, notes: 'Type-C' });
      const pl = mgr.getMission(id)!.packingList[0];
      expect(pl.quantity).toBe(2);
      expect(pl.notes).toBe('Type-C');
    });

    it('removes a packing list item', () => {
      const id = mgr.createMission('Test');
      mgr.addPackingListItem(id, { item: 'Board', category: 'board' });
      expect(mgr.removePackingListItem(id, 0)).toBe(true);
      expect(mgr.getMission(id)!.packingList).toHaveLength(0);
    });

    it('returns false for out-of-bounds remove', () => {
      const id = mgr.createMission('Test');
      expect(mgr.removePackingListItem(id, 5)).toBe(false);
      expect(mgr.removePackingListItem(id, -1)).toBe(false);
    });

    it('returns false for unknown mission', () => {
      expect(mgr.addPackingListItem('nope', { item: 'x', category: 'board' })).toBe(false);
    });
  });

  describe('generatePackingList', () => {
    it('scales packing list by quantity', () => {
      const id = mgr.createMission('Test', '', 10);
      mgr.addPackingListItem(id, { item: 'Board', category: 'board', quantity: 1 });
      mgr.addPackingListItem(id, { item: 'Screws', category: 'accessory', quantity: 4 });
      const pl = mgr.generatePackingList(id)!;
      expect(pl[0].quantity).toBe(10); // 1 * 10
      expect(pl[1].quantity).toBe(40); // 4 * 10
    });

    it('accepts custom quantity override', () => {
      const id = mgr.createMission('Test', '', 10);
      mgr.addPackingListItem(id, { item: 'Board', category: 'board', quantity: 1 });
      const pl = mgr.generatePackingList(id, 5)!;
      expect(pl[0].quantity).toBe(5);
    });

    it('returns null for unknown id', () => {
      expect(mgr.generatePackingList('nope')).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // Summary
  // -----------------------------------------------------------------------

  describe('getMissionSummary', () => {
    it('generates markdown summary', () => {
      const id = mgr.createMission('Board v1', '', 10);
      mgr.addMilestone(id, { name: 'Schematic', phase: 'design' });
      mgr.addRisk(id, { description: 'Supply risk', severity: 'high', likelihood: 'possible' });
      mgr.addCost(id, { category: 'pcb', description: 'PCB', unitCost: 5, isPerUnit: true });
      mgr.setBomItems(id, [{ partNumber: 'R1', description: 'res', unitPrice: 0.5, quantity: 10 }]);
      mgr.addPackingListItem(id, { item: 'Board', category: 'board' });

      const summary = mgr.getMissionSummary(id)!;
      expect(summary).toContain('Board v1');
      expect(summary).toContain('Concept');
      expect(summary).toContain('Target Quantity:** 10');
      expect(summary).toContain('0/1 completed');
      expect(summary).toContain('Open risks: 1');
      expect(summary).toContain('Packing List');
    });

    it('returns null for unknown id', () => {
      expect(mgr.getMissionSummary('nope')).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // Persistence
  // -----------------------------------------------------------------------

  describe('persistence', () => {
    it('loads missions from localStorage', () => {
      mgr.createMission('Saved');
      MissionModeManager.resetForTesting();
      const mgr2 = MissionModeManager.getInstance();
      expect(mgr2.getAllMissions()).toHaveLength(1);
      expect(mgr2.getAllMissions()[0].name).toBe('Saved');
    });

    it('persists active mission ID', () => {
      const id1 = mgr.createMission('A');
      const id2 = mgr.createMission('B');
      mgr.setActiveMission(id2);
      MissionModeManager.resetForTesting();
      const mgr2 = MissionModeManager.getInstance();
      expect(mgr2.getActiveMissionId()).toBe(id2);
    });

    it('handles corrupt localStorage', () => {
      store['protopulse-mission-mode'] = 'not json';
      MissionModeManager.resetForTesting();
      const mgr2 = MissionModeManager.getInstance();
      expect(mgr2.getAllMissions()).toHaveLength(0);
    });

    it('handles non-object localStorage', () => {
      store['protopulse-mission-mode'] = '"string"';
      MissionModeManager.resetForTesting();
      const mgr2 = MissionModeManager.getInstance();
      expect(mgr2.getAllMissions()).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // useMissionMode hook
  // -----------------------------------------------------------------------

  describe('useMissionMode', () => {
    it('is exported as a function', () => {
      expect(typeof useMissionMode).toBe('function');
    });
  });
});
