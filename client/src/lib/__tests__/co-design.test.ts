import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

import { CoDesignManager } from '../co-design';
import type {
  CoDesignConstraint,
  CoDesignConflict,
  SyncPoint,
  PcbDimensions,
  EnclosureDimensions,
  FitCheckResult,
  EnclosureMaterial,
  FirmwareResource,
} from '../co-design';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConstraint(overrides?: Partial<CoDesignConstraint>): CoDesignConstraint {
  return {
    id: overrides?.id ?? 'c-1',
    name: overrides?.name ?? 'Test Constraint',
    kind: overrides?.kind ?? 'power',
    sourceDomain: overrides?.sourceDomain ?? 'circuit',
    targetDomains: overrides?.targetDomains ?? ['firmware'],
    description: overrides?.description ?? 'A test constraint',
    value: overrides?.value,
    unit: overrides?.unit,
    max: overrides?.max,
    min: overrides?.min,
    satisfied: overrides?.satisfied ?? true,
  };
}

function makePcb(overrides?: Partial<PcbDimensions>): PcbDimensions {
  return {
    widthMm: overrides?.widthMm ?? 50,
    heightMm: overrides?.heightMm ?? 30,
    topClearanceMm: overrides?.topClearanceMm ?? 10,
    bottomClearanceMm: overrides?.bottomClearanceMm ?? 2,
    mountingHoles: overrides?.mountingHoles ?? [
      { x: 5, y: 5, diameterMm: 3 },
      { x: 45, y: 25, diameterMm: 3 },
    ],
  };
}

function makeFwResource(overrides?: Partial<FirmwareResource>): FirmwareResource {
  return {
    id: overrides?.id ?? 'fw-1',
    name: overrides?.name ?? 'LED Pin',
    type: overrides?.type ?? 'pin',
    assignment: overrides?.assignment ?? 'PA5',
    constraintId: overrides?.constraintId,
  };
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

beforeEach(() => {
  CoDesignManager.resetInstance();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-03-21T00:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

describe('CoDesignManager — singleton', () => {
  it('returns the same instance', () => {
    const a = CoDesignManager.getInstance();
    const b = CoDesignManager.getInstance();
    expect(a).toBe(b);
  });

  it('resetInstance clears the singleton', () => {
    const a = CoDesignManager.getInstance();
    CoDesignManager.resetInstance();
    const b = CoDesignManager.getInstance();
    expect(a).not.toBe(b);
  });
});

// ---------------------------------------------------------------------------
// Constraint management
// ---------------------------------------------------------------------------

describe('Constraint management', () => {
  it('adds a constraint', () => {
    const mgr = new CoDesignManager();
    mgr.addConstraint(makeConstraint({ id: 'c-1' }));
    expect(mgr.getConstraint('c-1')).toBeDefined();
  });

  it('updates a constraint', () => {
    const mgr = new CoDesignManager();
    mgr.addConstraint(makeConstraint({ id: 'c-1', name: 'Original' }));
    expect(mgr.updateConstraint('c-1', { name: 'Updated' })).toBe(true);
    expect(mgr.getConstraint('c-1')!.name).toBe('Updated');
  });

  it('rejects updating non-existent constraint', () => {
    const mgr = new CoDesignManager();
    expect(mgr.updateConstraint('nope', { name: 'X' })).toBe(false);
  });

  it('removes a constraint', () => {
    const mgr = new CoDesignManager();
    mgr.addConstraint(makeConstraint({ id: 'c-1' }));
    expect(mgr.removeConstraint('c-1')).toBe(true);
    expect(mgr.getConstraint('c-1')).toBeUndefined();
  });

  it('rejects removing non-existent constraint', () => {
    const mgr = new CoDesignManager();
    expect(mgr.removeConstraint('nope')).toBe(false);
  });

  it('getAllConstraints returns copies', () => {
    const mgr = new CoDesignManager();
    mgr.addConstraint(makeConstraint({ id: 'c-1' }));
    const all = mgr.getAllConstraints();
    all[0].name = 'MODIFIED';
    expect(mgr.getConstraint('c-1')!.name).not.toBe('MODIFIED');
  });

  it('getConstraintsByDomain filters by source domain', () => {
    const mgr = new CoDesignManager();
    mgr.addConstraint(makeConstraint({ id: 'c-1', sourceDomain: 'circuit' }));
    mgr.addConstraint(makeConstraint({ id: 'c-2', sourceDomain: 'firmware' }));
    const circuit = mgr.getConstraintsByDomain('circuit');
    expect(circuit.some((c) => c.id === 'c-1')).toBe(true);
  });

  it('getConstraintsByDomain includes target domain', () => {
    const mgr = new CoDesignManager();
    mgr.addConstraint(makeConstraint({ id: 'c-1', sourceDomain: 'circuit', targetDomains: ['enclosure'] }));
    const enclosure = mgr.getConstraintsByDomain('enclosure');
    expect(enclosure.some((c) => c.id === 'c-1')).toBe(true);
  });

  it('getConstraintsByKind filters correctly', () => {
    const mgr = new CoDesignManager();
    mgr.addConstraint(makeConstraint({ id: 'c-1', kind: 'power' }));
    mgr.addConstraint(makeConstraint({ id: 'c-2', kind: 'thermal' }));
    expect(mgr.getConstraintsByKind('power')).toHaveLength(1);
    expect(mgr.getConstraintsByKind('thermal')).toHaveLength(1);
  });

  it('updates individual constraint fields', () => {
    const mgr = new CoDesignManager();
    mgr.addConstraint(makeConstraint({ id: 'c-1', value: 5, unit: 'W' }));
    mgr.updateConstraint('c-1', { value: 10, unit: 'mW', min: 1, max: 20 });
    const c = mgr.getConstraint('c-1')!;
    expect(c.value).toBe(10);
    expect(c.unit).toBe('mW');
    expect(c.min).toBe(1);
    expect(c.max).toBe(20);
  });
});

// ---------------------------------------------------------------------------
// Conflict detection
// ---------------------------------------------------------------------------

describe('Conflict detection', () => {
  it('detects value exceeding max', () => {
    const mgr = new CoDesignManager();
    mgr.addConstraint(makeConstraint({
      id: 'c-1',
      value: 15,
      max: 10,
      unit: 'W',
      satisfied: false,
    }));
    const conflicts = mgr.getUnresolvedConflicts();
    expect(conflicts.length).toBeGreaterThanOrEqual(1);
    expect(conflicts.some((c) => c.message.includes('exceeds max'))).toBe(true);
  });

  it('detects value below min', () => {
    const mgr = new CoDesignManager();
    mgr.addConstraint(makeConstraint({
      id: 'c-1',
      value: 2,
      min: 5,
      unit: 'V',
      satisfied: false,
    }));
    const conflicts = mgr.getUnresolvedConflicts();
    expect(conflicts.some((c) => c.message.includes('below min'))).toBe(true);
  });

  it('no conflicts when constraint is satisfied', () => {
    const mgr = new CoDesignManager();
    mgr.addConstraint(makeConstraint({
      id: 'c-1',
      value: 5,
      max: 10,
      satisfied: true,
    }));
    expect(mgr.getUnresolvedConflicts()).toHaveLength(0);
  });

  it('detects thermal constraint affecting enclosure', () => {
    const mgr = new CoDesignManager();
    mgr.addConstraint(makeConstraint({
      id: 'c-1',
      kind: 'thermal',
      sourceDomain: 'circuit',
      targetDomains: ['enclosure'],
      satisfied: false,
    }));
    const conflicts = mgr.getUnresolvedConflicts();
    expect(conflicts.some((c) => c.message.includes('overheat'))).toBe(true);
  });

  it('resolves a conflict', () => {
    const mgr = new CoDesignManager();
    const id = mgr.addConflict({
      constraintId: 'c-1',
      severity: 'error',
      message: 'test conflict',
      affectedDomains: ['circuit'],
      suggestion: 'fix it',
    });
    expect(mgr.resolveConflict(id)).toBe(true);
    expect(mgr.getUnresolvedConflicts()).toHaveLength(0);
  });

  it('rejects resolving non-existent conflict', () => {
    const mgr = new CoDesignManager();
    expect(mgr.resolveConflict('nope')).toBe(false);
  });

  it('getAllConflicts returns copies', () => {
    const mgr = new CoDesignManager();
    mgr.addConflict({
      constraintId: 'c-1',
      severity: 'warning',
      message: 'test',
      affectedDomains: ['circuit'],
      suggestion: 'try this',
    });
    const all = mgr.getAllConflicts();
    all[0].message = 'MODIFIED';
    expect(mgr.getAllConflicts()[0].message).not.toBe('MODIFIED');
  });

  it('getConflictsByDomain filters correctly', () => {
    const mgr = new CoDesignManager();
    mgr.addConflict({
      constraintId: 'c-1',
      severity: 'error',
      message: 'circuit issue',
      affectedDomains: ['circuit'],
      suggestion: 'fix',
    });
    mgr.addConflict({
      constraintId: 'c-2',
      severity: 'warning',
      message: 'fw issue',
      affectedDomains: ['firmware'],
      suggestion: 'fix',
    });
    expect(mgr.getConflictsByDomain('circuit')).toHaveLength(1);
    expect(mgr.getConflictsByDomain('firmware')).toHaveLength(1);
  });

  it('removing a constraint also removes its conflicts', () => {
    const mgr = new CoDesignManager();
    mgr.addConstraint(makeConstraint({ id: 'c-1', value: 20, max: 10, satisfied: false }));
    expect(mgr.getAllConflicts().length).toBeGreaterThan(0);
    mgr.removeConstraint('c-1');
    expect(mgr.getAllConflicts()).toHaveLength(0);
  });

  it('re-detection clears stale auto-detected conflicts', () => {
    const mgr = new CoDesignManager();
    mgr.addConstraint(makeConstraint({ id: 'c-1', value: 20, max: 10, satisfied: false }));
    expect(mgr.getUnresolvedConflicts().length).toBeGreaterThan(0);
    mgr.updateConstraint('c-1', { value: 5, satisfied: true });
    expect(mgr.getUnresolvedConflicts()).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Sync points
// ---------------------------------------------------------------------------

describe('Sync points', () => {
  it('initializes with default sync points', () => {
    const mgr = new CoDesignManager();
    expect(mgr.getAllSyncPoints().length).toBe(6);
  });

  it('all default sync points start desynced', () => {
    const mgr = new CoDesignManager();
    mgr.getAllSyncPoints().forEach((sp) => {
      expect(sp.synchronized).toBe(false);
      expect(sp.lastSyncedAt).toBeNull();
    });
  });

  it('marks a sync point as synced', () => {
    const mgr = new CoDesignManager();
    expect(mgr.markSynced('sync-pinout')).toBe(true);
    const sp = mgr.getSyncPoint('sync-pinout')!;
    expect(sp.synchronized).toBe(true);
    expect(sp.lastSyncedAt).toBe(Date.now());
  });

  it('marks a sync point as desynced', () => {
    const mgr = new CoDesignManager();
    mgr.markSynced('sync-pinout');
    expect(mgr.markDesynced('sync-pinout')).toBe(true);
    expect(mgr.getSyncPoint('sync-pinout')!.synchronized).toBe(false);
  });

  it('rejects marking non-existent sync point', () => {
    const mgr = new CoDesignManager();
    expect(mgr.markSynced('nope')).toBe(false);
    expect(mgr.markDesynced('nope')).toBe(false);
  });

  it('adds a custom sync point', () => {
    const mgr = new CoDesignManager();
    mgr.addSyncPoint({
      id: 'sync-custom',
      name: 'Custom Sync',
      description: 'Test',
      domains: ['circuit', 'firmware', 'enclosure'],
    });
    expect(mgr.getSyncPoint('sync-custom')).toBeDefined();
    expect(mgr.getAllSyncPoints()).toHaveLength(7);
  });

  it('getSyncStatus returns correct percentage', () => {
    const mgr = new CoDesignManager();
    mgr.markSynced('sync-pinout');
    mgr.markSynced('sync-power');
    const status = mgr.getSyncStatus();
    expect(status.total).toBe(6);
    expect(status.synced).toBe(2);
    expect(status.percentage).toBe(33);
  });

  it('getSyncPoint returns a copy', () => {
    const mgr = new CoDesignManager();
    const sp = mgr.getSyncPoint('sync-pinout')!;
    sp.name = 'MODIFIED';
    expect(mgr.getSyncPoint('sync-pinout')!.name).not.toBe('MODIFIED');
  });
});

// ---------------------------------------------------------------------------
// Enclosure generation
// ---------------------------------------------------------------------------

describe('Enclosure generation', () => {
  it('generates enclosure from PCB dimensions', () => {
    const mgr = new CoDesignManager();
    const pcb = makePcb();
    const enc = mgr.generateEnclosure(pcb);
    expect(enc.innerWidthMm).toBeGreaterThan(pcb.widthMm);
    expect(enc.innerHeightMm).toBeGreaterThan(pcb.heightMm);
    expect(enc.outerWidthMm).toBeGreaterThan(enc.innerWidthMm);
    expect(enc.wallThicknessMm).toBe(2.0);
  });

  it('respects custom wall thickness', () => {
    const mgr = new CoDesignManager();
    const pcb = makePcb();
    const enc = mgr.generateEnclosure(pcb, { wallThicknessMm: 3.0 });
    expect(enc.wallThicknessMm).toBe(3.0);
    expect(enc.outerWidthMm - enc.innerWidthMm).toBeCloseTo(6.0, 1);
  });

  it('respects custom clearance', () => {
    const mgr = new CoDesignManager();
    const pcb = makePcb({ widthMm: 50, heightMm: 30 });
    const enc = mgr.generateEnclosure(pcb, { clearanceMm: 2.0 });
    expect(enc.innerWidthMm).toBe(54); // 50 + 2*2
    expect(enc.innerHeightMm).toBe(34); // 30 + 2*2
  });

  it('inner depth accounts for PCB thickness + component clearance', () => {
    const mgr = new CoDesignManager();
    const pcb = makePcb({ topClearanceMm: 10, bottomClearanceMm: 2 });
    const enc = mgr.generateEnclosure(pcb, { clearanceMm: 1.0 });
    // 10 + 2 + 1.6 + 2*1.0 = 15.6
    expect(enc.innerDepthMm).toBeCloseTo(15.6, 1);
  });
});

// ---------------------------------------------------------------------------
// Fit checking
// ---------------------------------------------------------------------------

describe('Fit checking', () => {
  it('PCB fits in a matching enclosure', () => {
    const mgr = new CoDesignManager();
    const pcb = makePcb();
    const enc = mgr.generateEnclosure(pcb);
    const result = mgr.checkFit(pcb, enc);
    expect(result.fits).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('detects PCB wider than enclosure', () => {
    const mgr = new CoDesignManager();
    const pcb = makePcb({ widthMm: 100 });
    const enc: EnclosureDimensions = {
      innerWidthMm: 50,
      innerHeightMm: 50,
      innerDepthMm: 20,
      wallThicknessMm: 2,
      outerWidthMm: 54,
      outerHeightMm: 54,
      outerDepthMm: 24,
    };
    const result = mgr.checkFit(pcb, enc);
    expect(result.fits).toBe(false);
    expect(result.violations.some((v) => v.includes('width'))).toBe(true);
  });

  it('detects PCB taller than enclosure', () => {
    const mgr = new CoDesignManager();
    const pcb = makePcb({ heightMm: 100 });
    const enc: EnclosureDimensions = {
      innerWidthMm: 100,
      innerHeightMm: 50,
      innerDepthMm: 20,
      wallThicknessMm: 2,
      outerWidthMm: 104,
      outerHeightMm: 54,
      outerDepthMm: 24,
    };
    const result = mgr.checkFit(pcb, enc);
    expect(result.fits).toBe(false);
    expect(result.violations.some((v) => v.includes('height'))).toBe(true);
  });

  it('detects component height exceeding depth', () => {
    const mgr = new CoDesignManager();
    const pcb = makePcb({ topClearanceMm: 50, bottomClearanceMm: 10 });
    const enc: EnclosureDimensions = {
      innerWidthMm: 100,
      innerHeightMm: 100,
      innerDepthMm: 20,
      wallThicknessMm: 2,
      outerWidthMm: 104,
      outerHeightMm: 104,
      outerDepthMm: 24,
    };
    const result = mgr.checkFit(pcb, enc);
    expect(result.fits).toBe(false);
    expect(result.violations.some((v) => v.includes('stack height'))).toBe(true);
  });

  it('reports clearance values', () => {
    const mgr = new CoDesignManager();
    const pcb = makePcb({ widthMm: 40, heightMm: 20 });
    const enc: EnclosureDimensions = {
      innerWidthMm: 50,
      innerHeightMm: 30,
      innerDepthMm: 20,
      wallThicknessMm: 2,
      outerWidthMm: 54,
      outerHeightMm: 34,
      outerDepthMm: 24,
    };
    const result = mgr.checkFit(pcb, enc);
    expect(result.clearance.x).toBe(10);
    expect(result.clearance.y).toBe(10);
  });

  it('detects mounting holes too close to wall', () => {
    const mgr = new CoDesignManager();
    const pcb = makePcb({
      widthMm: 50,
      heightMm: 30,
      mountingHoles: [{ x: 0.5, y: 0.5, diameterMm: 3 }],
    });
    const enc = mgr.generateEnclosure(pcb);
    const result = mgr.checkFit(pcb, enc);
    expect(result.violations.some((v) => v.includes('mounting hole') || v.includes('Mounting hole'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Enclosure weight estimation
// ---------------------------------------------------------------------------

describe('Enclosure weight estimation', () => {
  it('estimates weight for ABS', () => {
    const mgr = new CoDesignManager();
    const enc: EnclosureDimensions = {
      innerWidthMm: 52,
      innerHeightMm: 32,
      innerDepthMm: 15.6,
      wallThicknessMm: 2,
      outerWidthMm: 56,
      outerHeightMm: 36,
      outerDepthMm: 19.6,
    };
    const weight = mgr.estimateEnclosureWeight(enc, 'abs');
    expect(weight).not.toBeNull();
    expect(weight!).toBeGreaterThan(0);
  });

  it('returns null for unknown material', () => {
    const mgr = new CoDesignManager();
    const enc: EnclosureDimensions = {
      innerWidthMm: 52, innerHeightMm: 32, innerDepthMm: 15,
      wallThicknessMm: 2, outerWidthMm: 56, outerHeightMm: 36, outerDepthMm: 19,
    };
    expect(mgr.estimateEnclosureWeight(enc, 'unobtanium')).toBeNull();
  });

  it('metal is heavier than plastic for same dimensions', () => {
    const mgr = new CoDesignManager();
    const enc: EnclosureDimensions = {
      innerWidthMm: 52, innerHeightMm: 32, innerDepthMm: 15,
      wallThicknessMm: 2, outerWidthMm: 56, outerHeightMm: 36, outerDepthMm: 19,
    };
    const absWeight = mgr.estimateEnclosureWeight(enc, 'abs')!;
    const alWeight = mgr.estimateEnclosureWeight(enc, 'aluminum-6061')!;
    expect(alWeight).toBeGreaterThan(absWeight);
  });
});

// ---------------------------------------------------------------------------
// Materials database
// ---------------------------------------------------------------------------

describe('Materials database', () => {
  it('returns all materials', () => {
    const mgr = new CoDesignManager();
    const mats = mgr.getMaterials();
    expect(mats.length).toBeGreaterThanOrEqual(10);
  });

  it('getMaterial returns a specific material', () => {
    const mgr = new CoDesignManager();
    const abs = mgr.getMaterial('abs');
    expect(abs).toBeDefined();
    expect(abs!.name).toBe('ABS');
  });

  it('getMaterial returns undefined for unknown ID', () => {
    const mgr = new CoDesignManager();
    expect(mgr.getMaterial('unobtanium')).toBeUndefined();
  });

  it('getMaterialsByCategory filters correctly', () => {
    const mgr = new CoDesignManager();
    const metals = mgr.getMaterialsByCategory('metal');
    metals.forEach((m) => expect(m.category).toBe('metal'));
    expect(metals.length).toBeGreaterThanOrEqual(2);
  });

  it('recommendMaterial filters by temperature', () => {
    const mgr = new CoDesignManager();
    const recs = mgr.recommendMaterial(200, false);
    recs.forEach((m) => expect(m.maxTempC).toBeGreaterThanOrEqual(200));
  });

  it('recommendMaterial filters by shielding', () => {
    const mgr = new CoDesignManager();
    const recs = mgr.recommendMaterial(100, true);
    recs.forEach((m) => expect(m.emShielding).toBe(true));
  });

  it('recommendMaterial filters by cost', () => {
    const mgr = new CoDesignManager();
    const recs = mgr.recommendMaterial(50, false, 3.0);
    recs.forEach((m) => expect(m.costPerKgUsd).toBeLessThanOrEqual(3.0));
  });

  it('recommendMaterial sorts by cost ascending', () => {
    const mgr = new CoDesignManager();
    const recs = mgr.recommendMaterial(50, false);
    for (let i = 1; i < recs.length; i++) {
      expect(recs[i].costPerKgUsd).toBeGreaterThanOrEqual(recs[i - 1].costPerKgUsd);
    }
  });
});

// ---------------------------------------------------------------------------
// Firmware resources
// ---------------------------------------------------------------------------

describe('Firmware resources', () => {
  it('adds a firmware resource', () => {
    const mgr = new CoDesignManager();
    mgr.addFirmwareResource(makeFwResource({ id: 'fw-1' }));
    expect(mgr.getFirmwareResource('fw-1')).toBeDefined();
  });

  it('removes a firmware resource', () => {
    const mgr = new CoDesignManager();
    mgr.addFirmwareResource(makeFwResource({ id: 'fw-1' }));
    expect(mgr.removeFirmwareResource('fw-1')).toBe(true);
    expect(mgr.getFirmwareResource('fw-1')).toBeUndefined();
  });

  it('rejects removing non-existent resource', () => {
    const mgr = new CoDesignManager();
    expect(mgr.removeFirmwareResource('nope')).toBe(false);
  });

  it('getAllFirmwareResources returns copies', () => {
    const mgr = new CoDesignManager();
    mgr.addFirmwareResource(makeFwResource({ id: 'fw-1' }));
    const all = mgr.getAllFirmwareResources();
    all[0].name = 'MODIFIED';
    expect(mgr.getFirmwareResource('fw-1')!.name).not.toBe('MODIFIED');
  });

  it('getFirmwareResourcesByType filters correctly', () => {
    const mgr = new CoDesignManager();
    mgr.addFirmwareResource(makeFwResource({ id: 'fw-1', type: 'pin' }));
    mgr.addFirmwareResource(makeFwResource({ id: 'fw-2', type: 'uart' }));
    mgr.addFirmwareResource(makeFwResource({ id: 'fw-3', type: 'pin' }));
    expect(mgr.getFirmwareResourcesByType('pin')).toHaveLength(2);
    expect(mgr.getFirmwareResourcesByType('uart')).toHaveLength(1);
  });

  it('detects pin conflicts (same pin used twice)', () => {
    const mgr = new CoDesignManager();
    mgr.addFirmwareResource(makeFwResource({ id: 'fw-1', type: 'pin', assignment: 'PA5' }));
    mgr.addFirmwareResource(makeFwResource({ id: 'fw-2', type: 'pwm', assignment: 'PA5' }));
    const conflicts = mgr.detectPinConflicts();
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].pin).toBe('PA5');
    expect(conflicts[0].resources).toHaveLength(2);
  });

  it('no pin conflicts when all assignments are unique', () => {
    const mgr = new CoDesignManager();
    mgr.addFirmwareResource(makeFwResource({ id: 'fw-1', assignment: 'PA5' }));
    mgr.addFirmwareResource(makeFwResource({ id: 'fw-2', assignment: 'PA6' }));
    expect(mgr.detectPinConflicts()).toHaveLength(0);
  });

  it('only considers pin/adc/pwm types for conflicts', () => {
    const mgr = new CoDesignManager();
    mgr.addFirmwareResource(makeFwResource({ id: 'fw-1', type: 'uart', assignment: 'UART1' }));
    mgr.addFirmwareResource(makeFwResource({ id: 'fw-2', type: 'uart', assignment: 'UART1' }));
    // UART is not pin/adc/pwm so no pin conflict
    expect(mgr.detectPinConflicts()).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Cross-domain analysis
// ---------------------------------------------------------------------------

describe('Cross-domain analysis', () => {
  it('getDomainHealth returns correct counts', () => {
    const mgr = new CoDesignManager();
    mgr.addConstraint(makeConstraint({ id: 'c-1', sourceDomain: 'circuit', satisfied: true }));
    mgr.addConstraint(makeConstraint({ id: 'c-2', sourceDomain: 'circuit', satisfied: false, value: 20, max: 10 }));
    const health = mgr.getDomainHealth('circuit');
    expect(health.constraintCount).toBe(2);
    expect(health.satisfiedCount).toBe(1);
    expect(health.conflictCount).toBeGreaterThanOrEqual(1);
  });

  it('getDomainHealth tracks sync points', () => {
    const mgr = new CoDesignManager();
    mgr.markSynced('sync-pinout');
    const health = mgr.getDomainHealth('circuit');
    expect(health.syncedCount).toBeGreaterThanOrEqual(1);
    expect(health.totalSyncPoints).toBeGreaterThan(0);
  });

  it('getOverallHealth returns summary', () => {
    const mgr = new CoDesignManager();
    mgr.addConstraint(makeConstraint({ id: 'c-1', satisfied: true }));
    mgr.addConstraint(makeConstraint({ id: 'c-2', satisfied: false }));
    const health = mgr.getOverallHealth();
    expect(health.totalConstraints).toBe(2);
    expect(health.satisfiedConstraints).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Subscribe
// ---------------------------------------------------------------------------

describe('Subscribe', () => {
  it('notifies on constraint add', () => {
    const mgr = new CoDesignManager();
    const fn = vi.fn();
    mgr.subscribe(fn);
    mgr.addConstraint(makeConstraint());
    expect(fn).toHaveBeenCalled();
  });

  it('notifies on constraint update', () => {
    const mgr = new CoDesignManager();
    mgr.addConstraint(makeConstraint({ id: 'c-1' }));
    const fn = vi.fn();
    mgr.subscribe(fn);
    mgr.updateConstraint('c-1', { name: 'Updated' });
    expect(fn).toHaveBeenCalled();
  });

  it('notifies on sync point change', () => {
    const mgr = new CoDesignManager();
    const fn = vi.fn();
    mgr.subscribe(fn);
    mgr.markSynced('sync-pinout');
    expect(fn).toHaveBeenCalled();
  });

  it('notifies on firmware resource add', () => {
    const mgr = new CoDesignManager();
    const fn = vi.fn();
    mgr.subscribe(fn);
    mgr.addFirmwareResource(makeFwResource());
    expect(fn).toHaveBeenCalled();
  });

  it('unsubscribe stops notifications', () => {
    const mgr = new CoDesignManager();
    const fn = vi.fn();
    const unsub = mgr.subscribe(fn);
    unsub();
    mgr.addConstraint(makeConstraint());
    expect(fn).not.toHaveBeenCalled();
  });

  it('notifies on reset', () => {
    const mgr = new CoDesignManager();
    const fn = vi.fn();
    mgr.subscribe(fn);
    mgr.reset();
    expect(fn).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Reset
// ---------------------------------------------------------------------------

describe('Reset', () => {
  it('clears all state but reinitializes sync points', () => {
    const mgr = new CoDesignManager();
    mgr.addConstraint(makeConstraint({ id: 'c-1' }));
    mgr.addFirmwareResource(makeFwResource({ id: 'fw-1' }));
    mgr.markSynced('sync-pinout');

    mgr.reset();

    expect(mgr.getAllConstraints()).toHaveLength(0);
    expect(mgr.getAllConflicts()).toHaveLength(0);
    expect(mgr.getAllFirmwareResources()).toHaveLength(0);
    // Sync points re-initialized
    expect(mgr.getAllSyncPoints()).toHaveLength(6);
    expect(mgr.getSyncPoint('sync-pinout')!.synchronized).toBe(false);
  });
});
