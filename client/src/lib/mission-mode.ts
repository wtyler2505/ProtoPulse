/**
 * BL-0467 — ProtoPulse Mission Mode: Concept to Shipping Kit
 *
 * Guides a project through 7 lifecycle phases: concept → design → prototype →
 * test → iterate → produce → ship. Tracks milestones, risk assessment,
 * cost breakdowns, packing list generation, and quantity-based BOM costing.
 *
 * Singleton + Subscribe pattern. Persists mission state to localStorage.
 *
 * Usage:
 *   const mission = MissionModeManager.getInstance();
 *   const id = mission.createMission('My Board v1');
 *   mission.advancePhase(id);
 *   mission.addMilestone(id, { name: 'Schematic review', phase: 'design' });
 *   mission.addRisk(id, { description: 'Supply chain delay', severity: 'high', likelihood: 'medium' });
 *   mission.generatePackingList(id, 10);
 *
 * React hook:
 *   const { missions, activeMission, advancePhase, addMilestone, ... } = useMissionMode();
 */

import { useCallback, useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MissionPhase = 'concept' | 'design' | 'prototype' | 'test' | 'iterate' | 'produce' | 'ship';

export const MISSION_PHASES: MissionPhase[] = ['concept', 'design', 'prototype', 'test', 'iterate', 'produce', 'ship'];

export const MISSION_PHASE_LABELS: Record<MissionPhase, string> = {
  concept: 'Concept',
  design: 'Design',
  prototype: 'Prototype',
  test: 'Test',
  iterate: 'Iterate',
  produce: 'Produce',
  ship: 'Ship',
};

export const MISSION_PHASE_DESCRIPTIONS: Record<MissionPhase, string> = {
  concept: 'Define requirements, sketch ideas, and identify key components.',
  design: 'Create schematic, layout PCB, select components, and validate design.',
  prototype: 'Order PCBs, assemble first board, write initial firmware.',
  test: 'Run electrical tests, verify functionality, measure performance.',
  iterate: 'Fix issues found in testing, optimize design, update BOM.',
  produce: 'Prepare for production: finalize BOM, create test fixtures, set up assembly.',
  ship: 'Package units, create documentation, ship to customers or deploy.',
};

export type RiskSeverity = 'low' | 'medium' | 'high' | 'critical';
export type RiskLikelihood = 'unlikely' | 'possible' | 'likely' | 'certain';
export type RiskStatus = 'open' | 'mitigated' | 'accepted' | 'resolved';

export interface MissionRisk {
  id: string;
  description: string;
  severity: RiskSeverity;
  likelihood: RiskLikelihood;
  status: RiskStatus;
  mitigation?: string;
  phase: MissionPhase;
  createdAt: number;
  updatedAt: number;
}

export interface MissionMilestone {
  id: string;
  name: string;
  description: string;
  phase: MissionPhase;
  completed: boolean;
  completedAt?: number;
  dueDate?: number;
  createdAt: number;
}

export type CostCategory = 'pcb' | 'components' | 'assembly' | 'testing' | 'packaging' | 'shipping' | 'tooling' | 'other';

export interface CostLineItem {
  id: string;
  category: CostCategory;
  description: string;
  unitCost: number;
  quantity: number;
  isPerUnit: boolean;
  phase: MissionPhase;
}

export interface CostBreakdown {
  totalFixed: number;
  totalPerUnit: number;
  totalForQuantity: number;
  quantity: number;
  costPerUnit: number;
  byCategory: Record<CostCategory, number>;
}

export interface BomCostItem {
  partNumber: string;
  description: string;
  unitPrice: number;
  quantity: number;
}

export interface PackingListItem {
  item: string;
  quantity: number;
  category: 'board' | 'cable' | 'accessory' | 'documentation' | 'packaging';
  notes?: string;
}

export interface Mission {
  id: string;
  name: string;
  description: string;
  currentPhase: MissionPhase;
  milestones: MissionMilestone[];
  risks: MissionRisk[];
  costs: CostLineItem[];
  packingList: PackingListItem[];
  bomItems: BomCostItem[];
  targetQuantity: number;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  /** Phase completion timestamps. */
  phaseCompletedAt: Partial<Record<MissionPhase, number>>;
}

export interface CreateMilestoneInput {
  name: string;
  description?: string;
  phase: MissionPhase;
  dueDate?: number;
}

export interface CreateRiskInput {
  description: string;
  severity: RiskSeverity;
  likelihood: RiskLikelihood;
  mitigation?: string;
  phase?: MissionPhase;
}

export interface CreateCostInput {
  category: CostCategory;
  description: string;
  unitCost: number;
  quantity?: number;
  isPerUnit?: boolean;
  phase?: MissionPhase;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'protopulse-mission-mode';

const RISK_SEVERITY_SCORES: Record<RiskSeverity, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

const RISK_LIKELIHOOD_SCORES: Record<RiskLikelihood, number> = {
  unlikely: 1,
  possible: 2,
  likely: 3,
  certain: 4,
};

const COST_CATEGORIES: CostCategory[] = ['pcb', 'components', 'assembly', 'testing', 'packaging', 'shipping', 'tooling', 'other'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function riskScore(severity: RiskSeverity, likelihood: RiskLikelihood): number {
  return RISK_SEVERITY_SCORES[severity] * RISK_LIKELIHOOD_SCORES[likelihood];
}

export function phaseIndex(phase: MissionPhase): number {
  return MISSION_PHASES.indexOf(phase);
}

export function nextPhase(phase: MissionPhase): MissionPhase | null {
  const idx = MISSION_PHASES.indexOf(phase);
  if (idx === -1 || idx >= MISSION_PHASES.length - 1) {
    return null;
  }
  return MISSION_PHASES[idx + 1];
}

export function previousPhase(phase: MissionPhase): MissionPhase | null {
  const idx = MISSION_PHASES.indexOf(phase);
  if (idx <= 0) {
    return null;
  }
  return MISSION_PHASES[idx - 1];
}

export function calculateCostBreakdown(costs: CostLineItem[], quantity: number): CostBreakdown {
  let totalFixed = 0;
  let totalPerUnit = 0;
  const byCategory: Record<CostCategory, number> = {
    pcb: 0,
    components: 0,
    assembly: 0,
    testing: 0,
    packaging: 0,
    shipping: 0,
    tooling: 0,
    other: 0,
  };

  for (const item of costs) {
    const itemTotal = item.unitCost * item.quantity;
    if (item.isPerUnit) {
      totalPerUnit += itemTotal;
      byCategory[item.category] += itemTotal * quantity;
    } else {
      totalFixed += itemTotal;
      byCategory[item.category] += itemTotal;
    }
  }

  const totalForQuantity = totalFixed + totalPerUnit * quantity;
  const costPerUnit = quantity > 0 ? Math.round((totalForQuantity / quantity) * 100) / 100 : 0;

  return {
    totalFixed,
    totalPerUnit,
    totalForQuantity,
    quantity,
    costPerUnit,
    byCategory,
  };
}

export function bomCostForQuantity(bomItems: BomCostItem[], quantity: number): number {
  let total = 0;
  for (const item of bomItems) {
    total += item.unitPrice * item.quantity * quantity;
  }
  return Math.round(total * 100) / 100;
}

// ---------------------------------------------------------------------------
// Listener type
// ---------------------------------------------------------------------------

type Listener = () => void;

// ---------------------------------------------------------------------------
// MissionModeManager
// ---------------------------------------------------------------------------

export class MissionModeManager {
  private static instance: MissionModeManager | null = null;

  private missions: Mission[] = [];
  private activeMissionId: string | null = null;
  private listeners = new Set<Listener>();

  constructor() {
    this.load();
  }

  static getInstance(): MissionModeManager {
    if (!MissionModeManager.instance) {
      MissionModeManager.instance = new MissionModeManager();
    }
    return MissionModeManager.instance;
  }

  static resetForTesting(): void {
    MissionModeManager.instance = null;
  }

  // -----------------------------------------------------------------------
  // Subscription
  // -----------------------------------------------------------------------

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    this.listeners.forEach((l) => {
      l();
    });
  }

  // -----------------------------------------------------------------------
  // Mission CRUD
  // -----------------------------------------------------------------------

  createMission(name: string, description = '', targetQuantity = 1): string {
    const id = crypto.randomUUID();
    const now = Date.now();
    const mission: Mission = {
      id,
      name,
      description,
      currentPhase: 'concept',
      milestones: [],
      risks: [],
      costs: [],
      packingList: [],
      bomItems: [],
      targetQuantity,
      createdAt: now,
      updatedAt: now,
      phaseCompletedAt: {},
    };
    this.missions.push(mission);
    if (!this.activeMissionId) {
      this.activeMissionId = id;
    }
    this.save();
    this.notify();
    return id;
  }

  getMission(id: string): Mission | null {
    const m = this.missions.find((m) => m.id === id);
    return m ? this.cloneMission(m) : null;
  }

  getAllMissions(): Mission[] {
    return this.missions.map((m) => this.cloneMission(m));
  }

  deleteMission(id: string): boolean {
    const idx = this.missions.findIndex((m) => m.id === id);
    if (idx === -1) {
      return false;
    }
    this.missions.splice(idx, 1);
    if (this.activeMissionId === id) {
      this.activeMissionId = this.missions.length > 0 ? this.missions[0].id : null;
    }
    this.save();
    this.notify();
    return true;
  }

  renameMission(id: string, name: string): boolean {
    const m = this.missions.find((m) => m.id === id);
    if (!m) {
      return false;
    }
    m.name = name;
    m.updatedAt = Date.now();
    this.save();
    this.notify();
    return true;
  }

  setActiveMission(id: string): boolean {
    if (!this.missions.some((m) => m.id === id)) {
      return false;
    }
    this.activeMissionId = id;
    this.save();
    this.notify();
    return true;
  }

  getActiveMissionId(): string | null {
    return this.activeMissionId;
  }

  setTargetQuantity(id: string, qty: number): boolean {
    const m = this.missions.find((m) => m.id === id);
    if (!m || qty < 1) {
      return false;
    }
    m.targetQuantity = Math.floor(qty);
    m.updatedAt = Date.now();
    this.save();
    this.notify();
    return true;
  }

  // -----------------------------------------------------------------------
  // Phase management
  // -----------------------------------------------------------------------

  advancePhase(id: string): boolean {
    const m = this.missions.find((m) => m.id === id);
    if (!m) {
      return false;
    }
    const next = nextPhase(m.currentPhase);
    if (!next) {
      return false;
    }
    m.phaseCompletedAt[m.currentPhase] = Date.now();
    m.currentPhase = next;
    m.updatedAt = Date.now();
    if (next === 'ship') {
      // Mark ship phase immediately as we're entering it
    }
    this.save();
    this.notify();
    return true;
  }

  revertPhase(id: string): boolean {
    const m = this.missions.find((m) => m.id === id);
    if (!m) {
      return false;
    }
    const prev = previousPhase(m.currentPhase);
    if (!prev) {
      return false;
    }
    delete m.phaseCompletedAt[prev];
    m.currentPhase = prev;
    m.updatedAt = Date.now();
    this.save();
    this.notify();
    return true;
  }

  setPhase(id: string, phase: MissionPhase): boolean {
    const m = this.missions.find((m) => m.id === id);
    if (!m) {
      return false;
    }
    m.currentPhase = phase;
    m.updatedAt = Date.now();
    this.save();
    this.notify();
    return true;
  }

  completeMission(id: string): boolean {
    const m = this.missions.find((m) => m.id === id);
    if (!m) {
      return false;
    }
    m.phaseCompletedAt[m.currentPhase] = Date.now();
    m.completedAt = Date.now();
    m.updatedAt = Date.now();
    this.save();
    this.notify();
    return true;
  }

  getPhaseProgress(id: string): { completed: number; total: number; percentage: number } | null {
    const m = this.missions.find((m) => m.id === id);
    if (!m) {
      return null;
    }
    const total = MISSION_PHASES.length;
    const completed = Object.keys(m.phaseCompletedAt).length;
    const percentage = Math.round((completed / total) * 100);
    return { completed, total, percentage };
  }

  // -----------------------------------------------------------------------
  // Milestones
  // -----------------------------------------------------------------------

  addMilestone(missionId: string, input: CreateMilestoneInput): string | null {
    const m = this.missions.find((m) => m.id === missionId);
    if (!m) {
      return null;
    }
    const id = crypto.randomUUID();
    const milestone: MissionMilestone = {
      id,
      name: input.name,
      description: input.description ?? '',
      phase: input.phase,
      completed: false,
      dueDate: input.dueDate,
      createdAt: Date.now(),
    };
    m.milestones.push(milestone);
    m.updatedAt = Date.now();
    this.save();
    this.notify();
    return id;
  }

  completeMilestone(missionId: string, milestoneId: string): boolean {
    const m = this.missions.find((m) => m.id === missionId);
    if (!m) {
      return false;
    }
    const ms = m.milestones.find((ms) => ms.id === milestoneId);
    if (!ms) {
      return false;
    }
    ms.completed = true;
    ms.completedAt = Date.now();
    m.updatedAt = Date.now();
    this.save();
    this.notify();
    return true;
  }

  uncompleteMilestone(missionId: string, milestoneId: string): boolean {
    const m = this.missions.find((m) => m.id === missionId);
    if (!m) {
      return false;
    }
    const ms = m.milestones.find((ms) => ms.id === milestoneId);
    if (!ms) {
      return false;
    }
    ms.completed = false;
    ms.completedAt = undefined;
    m.updatedAt = Date.now();
    this.save();
    this.notify();
    return true;
  }

  removeMilestone(missionId: string, milestoneId: string): boolean {
    const m = this.missions.find((m) => m.id === missionId);
    if (!m) {
      return false;
    }
    const idx = m.milestones.findIndex((ms) => ms.id === milestoneId);
    if (idx === -1) {
      return false;
    }
    m.milestones.splice(idx, 1);
    m.updatedAt = Date.now();
    this.save();
    this.notify();
    return true;
  }

  getMilestonesForPhase(missionId: string, phase: MissionPhase): MissionMilestone[] {
    const m = this.missions.find((m) => m.id === missionId);
    if (!m) {
      return [];
    }
    return m.milestones.filter((ms) => ms.phase === phase);
  }

  // -----------------------------------------------------------------------
  // Risks
  // -----------------------------------------------------------------------

  addRisk(missionId: string, input: CreateRiskInput): string | null {
    const m = this.missions.find((m) => m.id === missionId);
    if (!m) {
      return null;
    }
    const id = crypto.randomUUID();
    const now = Date.now();
    const risk: MissionRisk = {
      id,
      description: input.description,
      severity: input.severity,
      likelihood: input.likelihood,
      status: 'open',
      mitigation: input.mitigation,
      phase: input.phase ?? m.currentPhase,
      createdAt: now,
      updatedAt: now,
    };
    m.risks.push(risk);
    m.updatedAt = Date.now();
    this.save();
    this.notify();
    return id;
  }

  updateRiskStatus(missionId: string, riskId: string, status: RiskStatus): boolean {
    const m = this.missions.find((m) => m.id === missionId);
    if (!m) {
      return false;
    }
    const risk = m.risks.find((r) => r.id === riskId);
    if (!risk) {
      return false;
    }
    risk.status = status;
    risk.updatedAt = Date.now();
    m.updatedAt = Date.now();
    this.save();
    this.notify();
    return true;
  }

  removeRisk(missionId: string, riskId: string): boolean {
    const m = this.missions.find((m) => m.id === missionId);
    if (!m) {
      return false;
    }
    const idx = m.risks.findIndex((r) => r.id === riskId);
    if (idx === -1) {
      return false;
    }
    m.risks.splice(idx, 1);
    m.updatedAt = Date.now();
    this.save();
    this.notify();
    return true;
  }

  getRiskAssessment(missionId: string): { totalScore: number; openRisks: number; criticalRisks: number; risksByPhase: Record<MissionPhase, number> } | null {
    const m = this.missions.find((m) => m.id === missionId);
    if (!m) {
      return null;
    }
    const openRisks = m.risks.filter((r) => r.status === 'open');
    const criticalRisks = openRisks.filter((r) => r.severity === 'critical').length;
    let totalScore = 0;
    for (const r of openRisks) {
      totalScore += riskScore(r.severity, r.likelihood);
    }

    const risksByPhase = {} as Record<MissionPhase, number>;
    MISSION_PHASES.forEach((p) => {
      risksByPhase[p] = m.risks.filter((r) => r.phase === p && r.status === 'open').length;
    });

    return { totalScore, openRisks: openRisks.length, criticalRisks, risksByPhase };
  }

  // -----------------------------------------------------------------------
  // Cost Management
  // -----------------------------------------------------------------------

  addCost(missionId: string, input: CreateCostInput): string | null {
    const m = this.missions.find((m) => m.id === missionId);
    if (!m) {
      return null;
    }
    const id = crypto.randomUUID();
    const item: CostLineItem = {
      id,
      category: input.category,
      description: input.description,
      unitCost: input.unitCost,
      quantity: input.quantity ?? 1,
      isPerUnit: input.isPerUnit ?? false,
      phase: input.phase ?? m.currentPhase,
    };
    m.costs.push(item);
    m.updatedAt = Date.now();
    this.save();
    this.notify();
    return id;
  }

  removeCost(missionId: string, costId: string): boolean {
    const m = this.missions.find((m) => m.id === missionId);
    if (!m) {
      return false;
    }
    const idx = m.costs.findIndex((c) => c.id === costId);
    if (idx === -1) {
      return false;
    }
    m.costs.splice(idx, 1);
    m.updatedAt = Date.now();
    this.save();
    this.notify();
    return true;
  }

  getCostBreakdown(missionId: string, quantity?: number): CostBreakdown | null {
    const m = this.missions.find((m) => m.id === missionId);
    if (!m) {
      return null;
    }
    return calculateCostBreakdown(m.costs, quantity ?? m.targetQuantity);
  }

  // -----------------------------------------------------------------------
  // BOM Integration
  // -----------------------------------------------------------------------

  setBomItems(missionId: string, items: BomCostItem[]): boolean {
    const m = this.missions.find((m) => m.id === missionId);
    if (!m) {
      return false;
    }
    m.bomItems = items.map((i) => ({ ...i }));
    m.updatedAt = Date.now();
    this.save();
    this.notify();
    return true;
  }

  getBomCost(missionId: string, quantity?: number): number | null {
    const m = this.missions.find((m) => m.id === missionId);
    if (!m) {
      return null;
    }
    return bomCostForQuantity(m.bomItems, quantity ?? m.targetQuantity);
  }

  // -----------------------------------------------------------------------
  // Packing List
  // -----------------------------------------------------------------------

  addPackingListItem(missionId: string, item: Omit<PackingListItem, 'quantity'> & { quantity?: number }): boolean {
    const m = this.missions.find((m) => m.id === missionId);
    if (!m) {
      return false;
    }
    m.packingList.push({
      item: item.item,
      quantity: item.quantity ?? 1,
      category: item.category,
      notes: item.notes,
    });
    m.updatedAt = Date.now();
    this.save();
    this.notify();
    return true;
  }

  removePackingListItem(missionId: string, index: number): boolean {
    const m = this.missions.find((m) => m.id === missionId);
    if (!m || index < 0 || index >= m.packingList.length) {
      return false;
    }
    m.packingList.splice(index, 1);
    m.updatedAt = Date.now();
    this.save();
    this.notify();
    return true;
  }

  /**
   * Generate a packing list scaled to a quantity.
   * Each item's quantity is multiplied by the target quantity.
   */
  generatePackingList(missionId: string, quantity?: number): PackingListItem[] | null {
    const m = this.missions.find((m) => m.id === missionId);
    if (!m) {
      return null;
    }
    const qty = quantity ?? m.targetQuantity;
    return m.packingList.map((p) => ({
      ...p,
      quantity: p.quantity * qty,
    }));
  }

  // -----------------------------------------------------------------------
  // Summary / Export
  // -----------------------------------------------------------------------

  getMissionSummary(missionId: string): string | null {
    const m = this.missions.find((m) => m.id === missionId);
    if (!m) {
      return null;
    }

    const progress = this.getPhaseProgress(missionId)!;
    const risks = this.getRiskAssessment(missionId)!;
    const costs = this.getCostBreakdown(missionId)!;
    const bomCost = this.getBomCost(missionId)!;

    const milestoneDone = m.milestones.filter((ms) => ms.completed).length;
    const milestoneTotal = m.milestones.length;

    const lines: string[] = [
      `# Mission: ${m.name}`,
      '',
      `**Phase:** ${MISSION_PHASE_LABELS[m.currentPhase]} (${progress.completed}/${progress.total})`,
      `**Target Quantity:** ${m.targetQuantity}`,
      '',
      '## Milestones',
      `${milestoneDone}/${milestoneTotal} completed`,
      '',
      '## Risk Assessment',
      `Open risks: ${risks.openRisks} | Critical: ${risks.criticalRisks} | Score: ${risks.totalScore}`,
      '',
      '## Cost Summary',
      `Fixed costs: $${costs.totalFixed.toFixed(2)}`,
      `Per-unit costs: $${costs.totalPerUnit.toFixed(2)}`,
      `BOM cost (x${m.targetQuantity}): $${bomCost.toFixed(2)}`,
      `Total (x${m.targetQuantity}): $${(costs.totalForQuantity + bomCost).toFixed(2)}`,
      `Cost per unit: $${((costs.totalForQuantity + bomCost) / Math.max(m.targetQuantity, 1)).toFixed(2)}`,
    ];

    if (m.packingList.length > 0) {
      lines.push('', '## Packing List');
      m.packingList.forEach((p) => {
        lines.push(`- ${p.item} x${p.quantity} (${p.category})${p.notes ? ` — ${p.notes}` : ''}`);
      });
    }

    return lines.join('\n');
  }

  // -----------------------------------------------------------------------
  // Persistence
  // -----------------------------------------------------------------------

  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        missions: this.missions,
        activeMissionId: this.activeMissionId,
      }));
    } catch {
      // localStorage might be full or unavailable
    }
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { missions: Mission[]; activeMissionId: string | null };
        if (parsed && Array.isArray(parsed.missions)) {
          this.missions = parsed.missions;
          this.activeMissionId = parsed.activeMissionId;
        }
      }
    } catch {
      this.missions = [];
      this.activeMissionId = null;
    }
  }

  private cloneMission(m: Mission): Mission {
    return {
      ...m,
      milestones: m.milestones.map((ms) => ({ ...ms })),
      risks: m.risks.map((r) => ({ ...r })),
      costs: m.costs.map((c) => ({ ...c })),
      packingList: m.packingList.map((p) => ({ ...p })),
      bomItems: m.bomItems.map((b) => ({ ...b })),
      phaseCompletedAt: { ...m.phaseCompletedAt },
    };
  }
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

export function useMissionMode(): {
  missions: Mission[];
  activeMission: Mission | null;
  activeMissionId: string | null;
  createMission: (name: string, description?: string, targetQuantity?: number) => string;
  deleteMission: (id: string) => boolean;
  renameMission: (id: string, name: string) => boolean;
  setActiveMission: (id: string) => boolean;
  setTargetQuantity: (id: string, qty: number) => boolean;
  advancePhase: (id: string) => boolean;
  revertPhase: (id: string) => boolean;
  setPhase: (id: string, phase: MissionPhase) => boolean;
  completeMission: (id: string) => boolean;
  getPhaseProgress: (id: string) => ReturnType<MissionModeManager['getPhaseProgress']>;
  addMilestone: (missionId: string, input: CreateMilestoneInput) => string | null;
  completeMilestone: (missionId: string, milestoneId: string) => boolean;
  removeMilestone: (missionId: string, milestoneId: string) => boolean;
  addRisk: (missionId: string, input: CreateRiskInput) => string | null;
  updateRiskStatus: (missionId: string, riskId: string, status: RiskStatus) => boolean;
  removeRisk: (missionId: string, riskId: string) => boolean;
  getRiskAssessment: (missionId: string) => ReturnType<MissionModeManager['getRiskAssessment']>;
  addCost: (missionId: string, input: CreateCostInput) => string | null;
  removeCost: (missionId: string, costId: string) => boolean;
  getCostBreakdown: (missionId: string, quantity?: number) => CostBreakdown | null;
  setBomItems: (missionId: string, items: BomCostItem[]) => boolean;
  getBomCost: (missionId: string, quantity?: number) => number | null;
  addPackingListItem: (missionId: string, item: Omit<PackingListItem, 'quantity'> & { quantity?: number }) => boolean;
  removePackingListItem: (missionId: string, index: number) => boolean;
  generatePackingList: (missionId: string, quantity?: number) => PackingListItem[] | null;
  getMissionSummary: (missionId: string) => string | null;
} {
  const mgr = MissionModeManager.getInstance();
  const [, setTick] = useState(0);

  useEffect(() => {
    return mgr.subscribe(() => {
      setTick((t) => t + 1);
    });
  }, [mgr]);

  const activeMissionId = mgr.getActiveMissionId();

  return {
    missions: mgr.getAllMissions(),
    activeMission: activeMissionId ? mgr.getMission(activeMissionId) : null,
    activeMissionId,
    createMission: useCallback((name: string, desc?: string, qty?: number) => mgr.createMission(name, desc, qty), [mgr]),
    deleteMission: useCallback((id: string) => mgr.deleteMission(id), [mgr]),
    renameMission: useCallback((id: string, name: string) => mgr.renameMission(id, name), [mgr]),
    setActiveMission: useCallback((id: string) => mgr.setActiveMission(id), [mgr]),
    setTargetQuantity: useCallback((id: string, qty: number) => mgr.setTargetQuantity(id, qty), [mgr]),
    advancePhase: useCallback((id: string) => mgr.advancePhase(id), [mgr]),
    revertPhase: useCallback((id: string) => mgr.revertPhase(id), [mgr]),
    setPhase: useCallback((id: string, phase: MissionPhase) => mgr.setPhase(id, phase), [mgr]),
    completeMission: useCallback((id: string) => mgr.completeMission(id), [mgr]),
    getPhaseProgress: useCallback((id: string) => mgr.getPhaseProgress(id), [mgr]),
    addMilestone: useCallback((mid: string, input: CreateMilestoneInput) => mgr.addMilestone(mid, input), [mgr]),
    completeMilestone: useCallback((mid: string, msId: string) => mgr.completeMilestone(mid, msId), [mgr]),
    removeMilestone: useCallback((mid: string, msId: string) => mgr.removeMilestone(mid, msId), [mgr]),
    addRisk: useCallback((mid: string, input: CreateRiskInput) => mgr.addRisk(mid, input), [mgr]),
    updateRiskStatus: useCallback((mid: string, rId: string, s: RiskStatus) => mgr.updateRiskStatus(mid, rId, s), [mgr]),
    removeRisk: useCallback((mid: string, rId: string) => mgr.removeRisk(mid, rId), [mgr]),
    getRiskAssessment: useCallback((mid: string) => mgr.getRiskAssessment(mid), [mgr]),
    addCost: useCallback((mid: string, input: CreateCostInput) => mgr.addCost(mid, input), [mgr]),
    removeCost: useCallback((mid: string, cId: string) => mgr.removeCost(mid, cId), [mgr]),
    getCostBreakdown: useCallback((mid: string, qty?: number) => mgr.getCostBreakdown(mid, qty), [mgr]),
    setBomItems: useCallback((mid: string, items: BomCostItem[]) => mgr.setBomItems(mid, items), [mgr]),
    getBomCost: useCallback((mid: string, qty?: number) => mgr.getBomCost(mid, qty), [mgr]),
    addPackingListItem: useCallback((mid: string, item: Omit<PackingListItem, 'quantity'> & { quantity?: number }) => mgr.addPackingListItem(mid, item), [mgr]),
    removePackingListItem: useCallback((mid: string, idx: number) => mgr.removePackingListItem(mid, idx), [mgr]),
    generatePackingList: useCallback((mid: string, qty?: number) => mgr.generatePackingList(mid, qty), [mgr]),
    getMissionSummary: useCallback((mid: string) => mgr.getMissionSummary(mid), [mgr]),
  };
}
