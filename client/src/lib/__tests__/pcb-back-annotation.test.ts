import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  BackAnnotationManager,
  generatePcbRefDesAnnotation,
  generatePcbPropertyAnnotation,
  type BackAnnotationPatch,
} from '../back-annotation';

// ===========================================================================
// generatePcbRefDesAnnotation
// ===========================================================================

describe('generatePcbRefDesAnnotation', () => {
  it('generates a patch with sourceType pcb', () => {
    const patch = generatePcbRefDesAnnotation('R1', 'R10', 'inst-001', 5);
    expect(patch.sourceType).toBe('pcb');
  });

  it('uses instanceId as sourceId', () => {
    const patch = generatePcbRefDesAnnotation('R1', 'R10', 'inst-001', 5);
    expect(patch.sourceId).toBe('inst-001');
  });

  it('sets targetInstanceId correctly', () => {
    const patch = generatePcbRefDesAnnotation('R1', 'R10', 'inst-001', 5);
    expect(patch.targetInstanceId).toBe('inst-001');
  });

  it('sets targetDesignId correctly', () => {
    const patch = generatePcbRefDesAnnotation('R1', 'R10', 'inst-001', 42);
    expect(patch.targetDesignId).toBe(42);
  });

  it('includes new referenceDesignator in changes', () => {
    const patch = generatePcbRefDesAnnotation('R1', 'R10', 'inst-001', 5);
    expect(patch.changes.referenceDesignator).toBe('R10');
  });

  it('includes previous referenceDesignator in changes', () => {
    const patch = generatePcbRefDesAnnotation('R1', 'R10', 'inst-001', 5);
    expect(patch.changes.previousReferenceDesignator).toBe('R1');
  });

  it('sets a valid numeric timestamp', () => {
    const before = Date.now();
    const patch = generatePcbRefDesAnnotation('C1', 'C5', 'inst-002', 5);
    const after = Date.now();
    expect(patch.timestamp).toBeGreaterThanOrEqual(before);
    expect(patch.timestamp).toBeLessThanOrEqual(after);
  });

  it('produces different patches for different renames', () => {
    const p1 = generatePcbRefDesAnnotation('R1', 'R10', 'inst-001', 5);
    const p2 = generatePcbRefDesAnnotation('C1', 'C99', 'inst-002', 5);
    expect(p1.changes.referenceDesignator).not.toBe(p2.changes.referenceDesignator);
    expect(p1.changes.previousReferenceDesignator).not.toBe(p2.changes.previousReferenceDesignator);
    expect(p1.targetInstanceId).not.toBe(p2.targetInstanceId);
  });

  it('handles same old and new refDes (no-op rename)', () => {
    const patch = generatePcbRefDesAnnotation('R1', 'R1', 'inst-001', 5);
    expect(patch.changes.referenceDesignator).toBe('R1');
    expect(patch.changes.previousReferenceDesignator).toBe('R1');
  });

  it('handles empty string refDes values', () => {
    const patch = generatePcbRefDesAnnotation('', 'R1', 'inst-001', 5);
    expect(patch.changes.previousReferenceDesignator).toBe('');
    expect(patch.changes.referenceDesignator).toBe('R1');
  });
});

// ===========================================================================
// generatePcbPropertyAnnotation
// ===========================================================================

describe('generatePcbPropertyAnnotation', () => {
  it('generates a patch with sourceType pcb', () => {
    const patch = generatePcbPropertyAnnotation('inst-001', 5, 'pcbX', 100);
    expect(patch.sourceType).toBe('pcb');
  });

  it('uses instanceId as sourceId', () => {
    const patch = generatePcbPropertyAnnotation('inst-001', 5, 'pcbX', 100);
    expect(patch.sourceId).toBe('inst-001');
  });

  it('sets targetInstanceId correctly', () => {
    const patch = generatePcbPropertyAnnotation('inst-001', 5, 'pcbX', 100);
    expect(patch.targetInstanceId).toBe('inst-001');
  });

  it('sets targetDesignId correctly', () => {
    const patch = generatePcbPropertyAnnotation('inst-001', 42, 'pcbX', 100);
    expect(patch.targetDesignId).toBe(42);
  });

  it('puts property name as key in changes', () => {
    const patch = generatePcbPropertyAnnotation('inst-001', 5, 'pcbX', 150.5);
    expect(patch.changes).toHaveProperty('pcbX', 150.5);
  });

  it('handles string property values', () => {
    const patch = generatePcbPropertyAnnotation('inst-001', 5, 'pcbSide', 'back');
    expect(patch.changes.pcbSide).toBe('back');
  });

  it('handles numeric property values', () => {
    const patch = generatePcbPropertyAnnotation('inst-001', 5, 'pcbRotation', 90);
    expect(patch.changes.pcbRotation).toBe(90);
  });

  it('handles boolean property values', () => {
    const patch = generatePcbPropertyAnnotation('inst-001', 5, 'locked', true);
    expect(patch.changes.locked).toBe(true);
  });

  it('handles null property values', () => {
    const patch = generatePcbPropertyAnnotation('inst-001', 5, 'pcbX', null);
    expect(patch.changes.pcbX).toBeNull();
  });

  it('handles object property values', () => {
    const val = { x: 10, y: 20 };
    const patch = generatePcbPropertyAnnotation('inst-001', 5, 'footprint', val);
    expect(patch.changes.footprint).toEqual({ x: 10, y: 20 });
  });

  it('sets a valid numeric timestamp', () => {
    const before = Date.now();
    const patch = generatePcbPropertyAnnotation('inst-001', 5, 'pcbX', 100);
    const after = Date.now();
    expect(patch.timestamp).toBeGreaterThanOrEqual(before);
    expect(patch.timestamp).toBeLessThanOrEqual(after);
  });

  it('produces patches with only the specified property in changes', () => {
    const patch = generatePcbPropertyAnnotation('inst-001', 5, 'pcbRotation', 45);
    const keys = Object.keys(patch.changes);
    expect(keys).toHaveLength(1);
    expect(keys[0]).toBe('pcbRotation');
  });
});

// ===========================================================================
// Integration: PCB patches with BackAnnotationManager
// ===========================================================================

describe('integration: PCB patches with BackAnnotationManager', () => {
  let manager: BackAnnotationManager;

  beforeEach(() => {
    BackAnnotationManager.resetInstance();
    manager = BackAnnotationManager.getInstance();
  });

  it('addPatch accepts refDes annotation', () => {
    const patch = generatePcbRefDesAnnotation('R1', 'R10', 'inst-001', 5);
    manager.addPatch(patch);
    expect(manager.getPending()).toHaveLength(1);
    expect(manager.getPending()[0].sourceType).toBe('pcb');
  });

  it('addPatch accepts property annotation', () => {
    const patch = generatePcbPropertyAnnotation('inst-001', 5, 'pcbRotation', 90);
    manager.addPatch(patch);
    expect(manager.getPending()).toHaveLength(1);
    expect(manager.getPending()[0].changes.pcbRotation).toBe(90);
  });

  it('mixes BOM and PCB patches in correct order', () => {
    const bomPatch: BackAnnotationPatch = {
      sourceType: 'bom',
      sourceId: 1,
      targetInstanceId: 'inst-001',
      targetDesignId: 5,
      changes: { partNumber: 'NEW-PN' },
      timestamp: 1000,
    };
    const pcbPatch = generatePcbRefDesAnnotation('R1', 'R10', 'inst-002', 5);
    manager.addPatch(bomPatch);
    manager.addPatch(pcbPatch);

    const pending = manager.getPending();
    expect(pending).toHaveLength(2);
    expect(pending[0].sourceType).toBe('bom');
    expect(pending[1].sourceType).toBe('pcb');
  });

  it('subscriber fires for PCB patch additions', () => {
    const listener = vi.fn();
    manager.subscribe(listener);
    manager.addPatch(generatePcbRefDesAnnotation('R1', 'R10', 'inst-001', 5));
    manager.addPatch(generatePcbPropertyAnnotation('inst-002', 5, 'pcbX', 200));
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('clearPending removes PCB patches', () => {
    manager.addPatch(generatePcbRefDesAnnotation('R1', 'R10', 'inst-001', 5));
    manager.addPatch(generatePcbPropertyAnnotation('inst-002', 5, 'pcbX', 200));
    expect(manager.getPending()).toHaveLength(2);
    manager.clearPending();
    expect(manager.getPending()).toHaveLength(0);
  });

  it('getSnapshot reflects PCB patches', () => {
    manager.addPatch(generatePcbRefDesAnnotation('U1', 'U5', 'inst-010', 7));
    const snap = manager.getSnapshot();
    expect(snap.pendingCount).toBe(1);
    expect(snap.patches[0].changes.referenceDesignator).toBe('U5');
  });

  it('multiple PCB property patches accumulate', () => {
    manager.addPatch(generatePcbPropertyAnnotation('inst-001', 5, 'pcbX', 100));
    manager.addPatch(generatePcbPropertyAnnotation('inst-001', 5, 'pcbY', 200));
    manager.addPatch(generatePcbPropertyAnnotation('inst-001', 5, 'pcbRotation', 90));
    expect(manager.getSnapshot().pendingCount).toBe(3);
  });
});
