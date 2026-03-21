/**
 * BL-0451 — Circuit + Firmware + Enclosure Co-Design Manager
 *
 * Manages cross-domain synchronization between circuit design, firmware, and
 * enclosure/mechanical domains.  Provides constraint linking, conflict
 * detection, enclosure generation from PCB dimensions, fit checking, and a
 * materials database.
 *
 * Singleton + Subscribe pattern.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CoDesignDomain = 'circuit' | 'firmware' | 'enclosure';

export type ConstraintKind =
  | 'power'
  | 'thermal'
  | 'dimension'
  | 'pin_assignment'
  | 'communication'
  | 'timing'
  | 'weight'
  | 'custom';

export type ConflictSeverity = 'error' | 'warning' | 'info';

export interface CoDesignConstraint {
  id: string;
  name: string;
  kind: ConstraintKind;
  /** Domain that owns/drives this constraint. */
  sourceDomain: CoDesignDomain;
  /** Domains that must respect this constraint. */
  targetDomains: CoDesignDomain[];
  /** Human-readable description. */
  description: string;
  /** Numeric value if applicable (watts, mm, ms, etc.). */
  value?: number;
  /** Unit label. */
  unit?: string;
  /** Upper bound. */
  max?: number;
  /** Lower bound. */
  min?: number;
  /** Whether this constraint is currently satisfied. */
  satisfied: boolean;
}

export interface CoDesignConflict {
  id: string;
  constraintId: string;
  severity: ConflictSeverity;
  message: string;
  affectedDomains: CoDesignDomain[];
  suggestion: string;
  /** Timestamp (epoch ms). */
  detectedAt: number;
  resolved: boolean;
}

export interface SyncPoint {
  id: string;
  name: string;
  description: string;
  domains: CoDesignDomain[];
  /** True when all domains have acknowledged / are aligned. */
  synchronized: boolean;
  lastSyncedAt: number | null;
}

// ---------------------------------------------------------------------------
// Enclosure types
// ---------------------------------------------------------------------------

export interface PcbDimensions {
  widthMm: number;
  heightMm: number;
  /** Max component height above PCB (mm). */
  topClearanceMm: number;
  /** Max component height below PCB (mm). */
  bottomClearanceMm: number;
  /** Mounting hole positions (mm from bottom-left). */
  mountingHoles: Array<{ x: number; y: number; diameterMm: number }>;
}

export interface EnclosureDimensions {
  innerWidthMm: number;
  innerHeightMm: number;
  innerDepthMm: number;
  wallThicknessMm: number;
  outerWidthMm: number;
  outerHeightMm: number;
  outerDepthMm: number;
}

export interface FitCheckResult {
  fits: boolean;
  clearance: {
    x: number;
    y: number;
    top: number;
    bottom: number;
  };
  violations: string[];
}

export interface EnclosureMaterial {
  id: string;
  name: string;
  category: 'plastic' | 'metal' | 'composite';
  densityGPerCm3: number;
  thermalConductivityWPerMK: number;
  maxTempC: number;
  costPerKgUsd: number;
  /** Whether it provides electromagnetic shielding. */
  emShielding: boolean;
  notes: string;
}

// ---------------------------------------------------------------------------
// Firmware types
// ---------------------------------------------------------------------------

export interface FirmwareResource {
  id: string;
  name: string;
  type: 'pin' | 'timer' | 'uart' | 'spi' | 'i2c' | 'adc' | 'pwm' | 'interrupt' | 'dma';
  /** Physical pin or peripheral instance (e.g. "PA5", "UART2"). */
  assignment: string;
  /** Domain constraint ID linking to circuit pin. */
  constraintId?: string;
}

// ---------------------------------------------------------------------------
// Materials database
// ---------------------------------------------------------------------------

const MATERIALS_DB: EnclosureMaterial[] = [
  {
    id: 'abs',
    name: 'ABS',
    category: 'plastic',
    densityGPerCm3: 1.05,
    thermalConductivityWPerMK: 0.17,
    maxTempC: 100,
    costPerKgUsd: 2.5,
    emShielding: false,
    notes: 'Common 3D printing material, good impact resistance',
  },
  {
    id: 'pla',
    name: 'PLA',
    category: 'plastic',
    densityGPerCm3: 1.24,
    thermalConductivityWPerMK: 0.13,
    maxTempC: 60,
    costPerKgUsd: 2.0,
    emShielding: false,
    notes: 'Easy to print but low heat resistance',
  },
  {
    id: 'petg',
    name: 'PETG',
    category: 'plastic',
    densityGPerCm3: 1.27,
    thermalConductivityWPerMK: 0.15,
    maxTempC: 80,
    costPerKgUsd: 3.0,
    emShielding: false,
    notes: 'Good balance of printability and durability',
  },
  {
    id: 'nylon',
    name: 'Nylon (PA12)',
    category: 'plastic',
    densityGPerCm3: 1.01,
    thermalConductivityWPerMK: 0.25,
    maxTempC: 150,
    costPerKgUsd: 30.0,
    emShielding: false,
    notes: 'Strong and flexible, good for functional parts',
  },
  {
    id: 'polycarbonate',
    name: 'Polycarbonate',
    category: 'plastic',
    densityGPerCm3: 1.2,
    thermalConductivityWPerMK: 0.2,
    maxTempC: 130,
    costPerKgUsd: 5.0,
    emShielding: false,
    notes: 'High impact strength, optically clear variants available',
  },
  {
    id: 'aluminum-6061',
    name: 'Aluminum 6061',
    category: 'metal',
    densityGPerCm3: 2.7,
    thermalConductivityWPerMK: 167,
    maxTempC: 300,
    costPerKgUsd: 4.0,
    emShielding: true,
    notes: 'Excellent heat dissipation, provides EMI shielding',
  },
  {
    id: 'steel-304',
    name: 'Stainless Steel 304',
    category: 'metal',
    densityGPerCm3: 8.0,
    thermalConductivityWPerMK: 16.2,
    maxTempC: 870,
    costPerKgUsd: 3.0,
    emShielding: true,
    notes: 'Corrosion resistant, heavy but strong',
  },
  {
    id: 'carbon-fiber',
    name: 'Carbon Fiber Composite',
    category: 'composite',
    densityGPerCm3: 1.6,
    thermalConductivityWPerMK: 7.0,
    maxTempC: 200,
    costPerKgUsd: 50.0,
    emShielding: true,
    notes: 'Lightweight and strong, partial EMI shielding',
  },
  {
    id: 'fr4-enclosure',
    name: 'FR-4 Panel',
    category: 'composite',
    densityGPerCm3: 1.85,
    thermalConductivityWPerMK: 0.3,
    maxTempC: 130,
    costPerKgUsd: 8.0,
    emShielding: false,
    notes: 'Can double as structural element in PCB-as-enclosure designs',
  },
  {
    id: 'acrylic',
    name: 'Acrylic (PMMA)',
    category: 'plastic',
    densityGPerCm3: 1.18,
    thermalConductivityWPerMK: 0.19,
    maxTempC: 80,
    costPerKgUsd: 3.5,
    emShielding: false,
    notes: 'Transparent, good for display windows',
  },
];

// ---------------------------------------------------------------------------
// Default sync points
// ---------------------------------------------------------------------------

const DEFAULT_SYNC_POINTS: Array<Omit<SyncPoint, 'synchronized' | 'lastSyncedAt'>> = [
  {
    id: 'sync-pinout',
    name: 'Pin Assignment Sync',
    description: 'MCU pin assignments match between schematic and firmware',
    domains: ['circuit', 'firmware'],
  },
  {
    id: 'sync-power',
    name: 'Power Budget Sync',
    description: 'Circuit power supply matches firmware power consumption model',
    domains: ['circuit', 'firmware'],
  },
  {
    id: 'sync-pcb-enclosure',
    name: 'PCB ↔ Enclosure Fit',
    description: 'PCB dimensions and mounting holes match enclosure interior',
    domains: ['circuit', 'enclosure'],
  },
  {
    id: 'sync-thermal',
    name: 'Thermal Budget Sync',
    description: 'Component heat dissipation within enclosure thermal limits',
    domains: ['circuit', 'enclosure'],
  },
  {
    id: 'sync-connectors',
    name: 'Connector Placement Sync',
    description: 'External connector positions align with enclosure cutouts',
    domains: ['circuit', 'enclosure'],
  },
  {
    id: 'sync-comm',
    name: 'Communication Protocol Sync',
    description: 'Firmware serial/I2C/SPI config matches circuit wiring',
    domains: ['circuit', 'firmware'],
  },
];

// ---------------------------------------------------------------------------
// CoDesignManager — singleton
// ---------------------------------------------------------------------------

export class CoDesignManager {
  private static instance: CoDesignManager | null = null;

  private constraints: Map<string, CoDesignConstraint> = new Map();
  private conflicts: Map<string, CoDesignConflict> = new Map();
  private syncPoints: Map<string, SyncPoint> = new Map();
  private firmwareResources: Map<string, FirmwareResource> = new Map();
  private subscribers = new Set<() => void>();
  private nextConflictId = 1;

  constructor() {
    this.initSyncPoints();
  }

  static getInstance(): CoDesignManager {
    if (!CoDesignManager.instance) {
      CoDesignManager.instance = new CoDesignManager();
    }
    return CoDesignManager.instance;
  }

  static resetInstance(): void {
    CoDesignManager.instance = null;
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

  private initSyncPoints(): void {
    DEFAULT_SYNC_POINTS.forEach((sp) => {
      this.syncPoints.set(sp.id, {
        ...sp,
        synchronized: false,
        lastSyncedAt: null,
      });
    });
  }

  // -----------------------------------------------------------------------
  // Constraint management
  // -----------------------------------------------------------------------

  addConstraint(constraint: CoDesignConstraint): void {
    this.constraints.set(constraint.id, { ...constraint });
    this.detectConflicts();
    this.notify();
  }

  updateConstraint(id: string, updates: Partial<Omit<CoDesignConstraint, 'id'>>): boolean {
    const c = this.constraints.get(id);
    if (!c) { return false; }

    if (updates.name !== undefined) { c.name = updates.name; }
    if (updates.kind !== undefined) { c.kind = updates.kind; }
    if (updates.sourceDomain !== undefined) { c.sourceDomain = updates.sourceDomain; }
    if (updates.targetDomains !== undefined) { c.targetDomains = [...updates.targetDomains]; }
    if (updates.description !== undefined) { c.description = updates.description; }
    if (updates.value !== undefined) { c.value = updates.value; }
    if (updates.unit !== undefined) { c.unit = updates.unit; }
    if (updates.max !== undefined) { c.max = updates.max; }
    if (updates.min !== undefined) { c.min = updates.min; }
    if (updates.satisfied !== undefined) { c.satisfied = updates.satisfied; }

    this.detectConflicts();
    this.notify();
    return true;
  }

  removeConstraint(id: string): boolean {
    const removed = this.constraints.delete(id);
    if (removed) {
      // Remove conflicts tied to this constraint
      const toDelete: string[] = [];
      this.conflicts.forEach((conflict, cid) => {
        if (conflict.constraintId === id) {
          toDelete.push(cid);
        }
      });
      toDelete.forEach((cid) => this.conflicts.delete(cid));
      this.notify();
    }
    return removed;
  }

  getConstraint(id: string): CoDesignConstraint | undefined {
    const c = this.constraints.get(id);
    return c ? { ...c, targetDomains: [...c.targetDomains] } : undefined;
  }

  getAllConstraints(): CoDesignConstraint[] {
    const result: CoDesignConstraint[] = [];
    this.constraints.forEach((c) => {
      result.push({ ...c, targetDomains: [...c.targetDomains] });
    });
    return result;
  }

  getConstraintsByDomain(domain: CoDesignDomain): CoDesignConstraint[] {
    const result: CoDesignConstraint[] = [];
    this.constraints.forEach((c) => {
      if (c.sourceDomain === domain || c.targetDomains.includes(domain)) {
        result.push({ ...c, targetDomains: [...c.targetDomains] });
      }
    });
    return result;
  }

  getConstraintsByKind(kind: ConstraintKind): CoDesignConstraint[] {
    const result: CoDesignConstraint[] = [];
    this.constraints.forEach((c) => {
      if (c.kind === kind) {
        result.push({ ...c, targetDomains: [...c.targetDomains] });
      }
    });
    return result;
  }

  // -----------------------------------------------------------------------
  // Conflict detection
  // -----------------------------------------------------------------------

  private detectConflicts(): void {
    // Clear non-resolved auto-detected conflicts
    const toDelete: string[] = [];
    this.conflicts.forEach((conflict, cid) => {
      if (!conflict.resolved) {
        toDelete.push(cid);
      }
    });
    toDelete.forEach((cid) => this.conflicts.delete(cid));

    this.constraints.forEach((constraint) => {
      if (constraint.satisfied) { return; }

      // Range violation
      if (constraint.value !== undefined) {
        if (constraint.max !== undefined && constraint.value > constraint.max) {
          this.addConflictInternal({
            constraintId: constraint.id,
            severity: 'error',
            message: `${constraint.name}: value ${constraint.value}${constraint.unit ?? ''} exceeds max ${constraint.max}${constraint.unit ?? ''}`,
            affectedDomains: [constraint.sourceDomain, ...constraint.targetDomains],
            suggestion: `Reduce ${constraint.name} to within ${constraint.max}${constraint.unit ?? ''} limit`,
          });
        }
        if (constraint.min !== undefined && constraint.value < constraint.min) {
          this.addConflictInternal({
            constraintId: constraint.id,
            severity: 'error',
            message: `${constraint.name}: value ${constraint.value}${constraint.unit ?? ''} below min ${constraint.min}${constraint.unit ?? ''}`,
            affectedDomains: [constraint.sourceDomain, ...constraint.targetDomains],
            suggestion: `Increase ${constraint.name} to at least ${constraint.min}${constraint.unit ?? ''}`,
          });
        }
      }

      // Thermal + enclosure cross-check
      if (constraint.kind === 'thermal' && !constraint.satisfied) {
        const affectsEnclosure = constraint.targetDomains.includes('enclosure');
        if (affectsEnclosure) {
          this.addConflictInternal({
            constraintId: constraint.id,
            severity: 'warning',
            message: `Thermal constraint "${constraint.name}" not met — enclosure may overheat`,
            affectedDomains: ['circuit', 'enclosure'],
            suggestion: 'Add ventilation, heat sinks, or use a material with higher thermal conductivity',
          });
        }
      }
    });
  }

  private addConflictInternal(data: Omit<CoDesignConflict, 'id' | 'detectedAt' | 'resolved'>): void {
    const id = `conflict-${this.nextConflictId++}`;
    this.conflicts.set(id, {
      ...data,
      id,
      detectedAt: Date.now(),
      resolved: false,
    });
  }

  addConflict(data: Omit<CoDesignConflict, 'id' | 'detectedAt' | 'resolved'>): string {
    const id = `conflict-${this.nextConflictId++}`;
    this.conflicts.set(id, {
      ...data,
      id,
      detectedAt: Date.now(),
      resolved: false,
    });
    this.notify();
    return id;
  }

  resolveConflict(id: string): boolean {
    const c = this.conflicts.get(id);
    if (!c) { return false; }
    c.resolved = true;
    this.notify();
    return true;
  }

  getAllConflicts(): CoDesignConflict[] {
    const result: CoDesignConflict[] = [];
    this.conflicts.forEach((c) => {
      result.push({ ...c, affectedDomains: [...c.affectedDomains] });
    });
    return result;
  }

  getUnresolvedConflicts(): CoDesignConflict[] {
    return this.getAllConflicts().filter((c) => !c.resolved);
  }

  getConflictsByDomain(domain: CoDesignDomain): CoDesignConflict[] {
    return this.getAllConflicts().filter((c) => c.affectedDomains.includes(domain));
  }

  // -----------------------------------------------------------------------
  // Sync points
  // -----------------------------------------------------------------------

  markSynced(syncPointId: string): boolean {
    const sp = this.syncPoints.get(syncPointId);
    if (!sp) { return false; }
    sp.synchronized = true;
    sp.lastSyncedAt = Date.now();
    this.notify();
    return true;
  }

  markDesynced(syncPointId: string): boolean {
    const sp = this.syncPoints.get(syncPointId);
    if (!sp) { return false; }
    sp.synchronized = false;
    this.notify();
    return true;
  }

  getSyncPoint(id: string): SyncPoint | undefined {
    const sp = this.syncPoints.get(id);
    return sp ? { ...sp, domains: [...sp.domains] } : undefined;
  }

  getAllSyncPoints(): SyncPoint[] {
    const result: SyncPoint[] = [];
    this.syncPoints.forEach((sp) => {
      result.push({ ...sp, domains: [...sp.domains] });
    });
    return result;
  }

  addSyncPoint(data: Omit<SyncPoint, 'synchronized' | 'lastSyncedAt'>): void {
    this.syncPoints.set(data.id, {
      ...data,
      domains: [...data.domains],
      synchronized: false,
      lastSyncedAt: null,
    });
    this.notify();
  }

  getSyncStatus(): { total: number; synced: number; percentage: number } {
    let total = 0;
    let synced = 0;
    this.syncPoints.forEach((sp) => {
      total++;
      if (sp.synchronized) { synced++; }
    });
    return { total, synced, percentage: total === 0 ? 100 : Math.round((synced / total) * 100) };
  }

  // -----------------------------------------------------------------------
  // Enclosure generation from PCB dimensions
  // -----------------------------------------------------------------------

  generateEnclosure(
    pcb: PcbDimensions,
    options?: {
      wallThicknessMm?: number;
      clearanceMm?: number;
      materialId?: string;
    },
  ): EnclosureDimensions {
    const wall = options?.wallThicknessMm ?? 2.0;
    const clearance = options?.clearanceMm ?? 1.0;

    const innerW = pcb.widthMm + 2 * clearance;
    const innerH = pcb.heightMm + 2 * clearance;
    const innerD = pcb.topClearanceMm + pcb.bottomClearanceMm + 1.6 + 2 * clearance; // 1.6mm PCB thickness

    return {
      innerWidthMm: round2(innerW),
      innerHeightMm: round2(innerH),
      innerDepthMm: round2(innerD),
      wallThicknessMm: wall,
      outerWidthMm: round2(innerW + 2 * wall),
      outerHeightMm: round2(innerH + 2 * wall),
      outerDepthMm: round2(innerD + 2 * wall),
    };
  }

  // -----------------------------------------------------------------------
  // Fit checking
  // -----------------------------------------------------------------------

  checkFit(pcb: PcbDimensions, enclosure: EnclosureDimensions): FitCheckResult {
    const pcbThickness = 1.6;
    const totalHeight = pcb.topClearanceMm + pcb.bottomClearanceMm + pcbThickness;

    const clearanceX = round2(enclosure.innerWidthMm - pcb.widthMm);
    const clearanceY = round2(enclosure.innerHeightMm - pcb.heightMm);
    const clearanceTop = round2(enclosure.innerDepthMm - totalHeight);
    const clearanceBottom = 0; // PCB sits on standoffs at bottom

    const violations: string[] = [];
    if (clearanceX < 0) {
      violations.push(`PCB width (${pcb.widthMm}mm) exceeds enclosure inner width (${enclosure.innerWidthMm}mm) by ${Math.abs(clearanceX)}mm`);
    }
    if (clearanceY < 0) {
      violations.push(`PCB height (${pcb.heightMm}mm) exceeds enclosure inner height (${enclosure.innerHeightMm}mm) by ${Math.abs(clearanceY)}mm`);
    }
    if (clearanceTop < 0) {
      violations.push(`Component stack height (${round2(totalHeight)}mm) exceeds enclosure inner depth (${enclosure.innerDepthMm}mm) by ${Math.abs(clearanceTop)}mm`);
    }

    // Check mounting hole clearance from walls
    pcb.mountingHoles.forEach((hole, i) => {
      const minEdgeDist = enclosure.wallThicknessMm;
      if (hole.x < minEdgeDist || hole.y < minEdgeDist ||
          hole.x > pcb.widthMm - minEdgeDist || hole.y > pcb.heightMm - minEdgeDist) {
        violations.push(`Mounting hole ${i + 1} at (${hole.x}, ${hole.y})mm is too close to enclosure wall`);
      }
    });

    return {
      fits: violations.length === 0,
      clearance: { x: clearanceX, y: clearanceY, top: clearanceTop, bottom: clearanceBottom },
      violations,
    };
  }

  // -----------------------------------------------------------------------
  // Enclosure weight estimation
  // -----------------------------------------------------------------------

  estimateEnclosureWeight(enclosure: EnclosureDimensions, materialId: string): number | null {
    const mat = MATERIALS_DB.find((m) => m.id === materialId);
    if (!mat) { return null; }

    // Volume = outer box - inner box (shell volume)
    const outerVol =
      (enclosure.outerWidthMm / 10) *
      (enclosure.outerHeightMm / 10) *
      (enclosure.outerDepthMm / 10); // cm³
    const innerVol =
      (enclosure.innerWidthMm / 10) *
      (enclosure.innerHeightMm / 10) *
      (enclosure.innerDepthMm / 10);

    const shellVol = outerVol - innerVol;
    const weightG = round2(shellVol * mat.densityGPerCm3);
    return weightG;
  }

  // -----------------------------------------------------------------------
  // Materials database
  // -----------------------------------------------------------------------

  getMaterials(): EnclosureMaterial[] {
    return MATERIALS_DB.map((m) => ({ ...m }));
  }

  getMaterial(id: string): EnclosureMaterial | undefined {
    const m = MATERIALS_DB.find((mat) => mat.id === id);
    return m ? { ...m } : undefined;
  }

  getMaterialsByCategory(category: EnclosureMaterial['category']): EnclosureMaterial[] {
    return MATERIALS_DB.filter((m) => m.category === category).map((m) => ({ ...m }));
  }

  recommendMaterial(
    maxTempC: number,
    needsShielding: boolean,
    maxCostPerKgUsd?: number,
  ): EnclosureMaterial[] {
    return MATERIALS_DB
      .filter((m) => m.maxTempC >= maxTempC)
      .filter((m) => !needsShielding || m.emShielding)
      .filter((m) => maxCostPerKgUsd === undefined || m.costPerKgUsd <= maxCostPerKgUsd)
      .sort((a, b) => a.costPerKgUsd - b.costPerKgUsd)
      .map((m) => ({ ...m }));
  }

  // -----------------------------------------------------------------------
  // Firmware resources
  // -----------------------------------------------------------------------

  addFirmwareResource(resource: FirmwareResource): void {
    this.firmwareResources.set(resource.id, { ...resource });
    this.notify();
  }

  removeFirmwareResource(id: string): boolean {
    const removed = this.firmwareResources.delete(id);
    if (removed) { this.notify(); }
    return removed;
  }

  getFirmwareResource(id: string): FirmwareResource | undefined {
    const r = this.firmwareResources.get(id);
    return r ? { ...r } : undefined;
  }

  getAllFirmwareResources(): FirmwareResource[] {
    const result: FirmwareResource[] = [];
    this.firmwareResources.forEach((r) => {
      result.push({ ...r });
    });
    return result;
  }

  getFirmwareResourcesByType(type: FirmwareResource['type']): FirmwareResource[] {
    return this.getAllFirmwareResources().filter((r) => r.type === type);
  }

  /** Detect firmware resource assignment conflicts (same pin used twice). */
  detectPinConflicts(): Array<{ pin: string; resources: FirmwareResource[] }> {
    const pinMap = new Map<string, FirmwareResource[]>();
    this.firmwareResources.forEach((r) => {
      if (r.type === 'pin' || r.type === 'adc' || r.type === 'pwm') {
        const existing = pinMap.get(r.assignment) ?? [];
        existing.push({ ...r });
        pinMap.set(r.assignment, existing);
      }
    });

    const conflicts: Array<{ pin: string; resources: FirmwareResource[] }> = [];
    pinMap.forEach((resources, pin) => {
      if (resources.length > 1) {
        conflicts.push({ pin, resources });
      }
    });
    return conflicts;
  }

  // -----------------------------------------------------------------------
  // Cross-domain analysis
  // -----------------------------------------------------------------------

  getDomainHealth(domain: CoDesignDomain): {
    constraintCount: number;
    satisfiedCount: number;
    conflictCount: number;
    syncedCount: number;
    totalSyncPoints: number;
  } {
    let constraintCount = 0;
    let satisfiedCount = 0;

    this.constraints.forEach((c) => {
      if (c.sourceDomain === domain || c.targetDomains.includes(domain)) {
        constraintCount++;
        if (c.satisfied) { satisfiedCount++; }
      }
    });

    const conflictCount = this.getConflictsByDomain(domain).filter((c) => !c.resolved).length;

    let syncedCount = 0;
    let totalSyncPoints = 0;
    this.syncPoints.forEach((sp) => {
      if (sp.domains.includes(domain)) {
        totalSyncPoints++;
        if (sp.synchronized) { syncedCount++; }
      }
    });

    return { constraintCount, satisfiedCount, conflictCount, syncedCount, totalSyncPoints };
  }

  getOverallHealth(): {
    totalConstraints: number;
    satisfiedConstraints: number;
    unresolvedConflicts: number;
    syncPercentage: number;
  } {
    let totalConstraints = 0;
    let satisfiedConstraints = 0;

    this.constraints.forEach((c) => {
      totalConstraints++;
      if (c.satisfied) { satisfiedConstraints++; }
    });

    const unresolvedConflicts = this.getUnresolvedConflicts().length;
    const syncStatus = this.getSyncStatus();

    return {
      totalConstraints,
      satisfiedConstraints,
      unresolvedConflicts,
      syncPercentage: syncStatus.percentage,
    };
  }

  // -----------------------------------------------------------------------
  // Reset
  // -----------------------------------------------------------------------

  reset(): void {
    this.constraints.clear();
    this.conflicts.clear();
    this.firmwareResources.clear();
    this.syncPoints.clear();
    this.nextConflictId = 1;
    this.initSyncPoints();
    this.notify();
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
