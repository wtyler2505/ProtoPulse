import { describe, expect, it } from 'vitest';
import {
  analyzeSnapshotDomains,
  generateRestorePlan,
  type RestoreDomain,
  type SnapshotDomainInfo,
  type CascadeRestoreConfig,
  type RestorePlan,
  type RestoreStep,
  type SnapshotData,
} from '../snapshot-restore-cascade';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSnapshotData(overrides: Partial<SnapshotData> = {}): SnapshotData {
  return {
    nodes: [],
    edges: [],
    instances: [],
    nets: [],
    wires: [],
    bomItems: [],
    simulationResults: [],
    ...overrides,
  };
}

function makeSnapshot(data: Partial<SnapshotData> = {}, id = 1, projectId = 1) {
  return {
    id,
    projectId,
    name: 'Test Snapshot',
    description: 'A test snapshot',
    nodesJson: data,
    edgesJson: {},
    createdAt: new Date(),
  };
}

// ---------------------------------------------------------------------------
// analyzeSnapshotDomains
// ---------------------------------------------------------------------------

describe('analyzeSnapshotDomains', () => {
  it('returns all four domains', () => {
    const result = analyzeSnapshotDomains(makeSnapshotData());
    const domains = result.map((d) => d.domain);
    expect(domains).toEqual(['architecture', 'schematic', 'bom', 'simulation']);
  });

  it('marks architecture as available when nodes exist', () => {
    const data = makeSnapshotData({
      nodes: [{ id: '1', label: 'MCU', type: 'microcontroller' }],
    });
    const result = analyzeSnapshotDomains(data);
    const arch = result.find((d) => d.domain === 'architecture')!;
    expect(arch.available).toBe(true);
    expect(arch.itemCount).toBe(1);
  });

  it('marks architecture as available when edges exist', () => {
    const data = makeSnapshotData({
      edges: [{ id: 'e1', source: '1', target: '2' }],
    });
    const result = analyzeSnapshotDomains(data);
    const arch = result.find((d) => d.domain === 'architecture')!;
    expect(arch.available).toBe(true);
    expect(arch.itemCount).toBe(1);
  });

  it('counts both nodes and edges for architecture', () => {
    const data = makeSnapshotData({
      nodes: [{ id: '1' }, { id: '2' }],
      edges: [{ id: 'e1' }],
    });
    const result = analyzeSnapshotDomains(data);
    const arch = result.find((d) => d.domain === 'architecture')!;
    expect(arch.itemCount).toBe(3);
  });

  it('marks architecture as unavailable when nodes and edges are empty', () => {
    const data = makeSnapshotData({ nodes: [], edges: [] });
    const result = analyzeSnapshotDomains(data);
    const arch = result.find((d) => d.domain === 'architecture')!;
    expect(arch.available).toBe(false);
    expect(arch.itemCount).toBe(0);
  });

  it('marks schematic as available when instances exist', () => {
    const data = makeSnapshotData({
      instances: [{ id: 'i1', componentId: 'res' }],
    });
    const result = analyzeSnapshotDomains(data);
    const sch = result.find((d) => d.domain === 'schematic')!;
    expect(sch.available).toBe(true);
    expect(sch.itemCount).toBe(1);
  });

  it('marks schematic as available when nets exist', () => {
    const data = makeSnapshotData({
      nets: [{ id: 'n1', name: 'VCC' }],
    });
    const result = analyzeSnapshotDomains(data);
    const sch = result.find((d) => d.domain === 'schematic')!;
    expect(sch.available).toBe(true);
  });

  it('marks schematic as available when wires exist', () => {
    const data = makeSnapshotData({
      wires: [{ id: 'w1', startX: 0, startY: 0, endX: 100, endY: 100 }],
    });
    const result = analyzeSnapshotDomains(data);
    const sch = result.find((d) => d.domain === 'schematic')!;
    expect(sch.available).toBe(true);
  });

  it('counts instances, nets, and wires for schematic', () => {
    const data = makeSnapshotData({
      instances: [{ id: 'i1' }, { id: 'i2' }],
      nets: [{ id: 'n1' }],
      wires: [{ id: 'w1' }, { id: 'w2' }, { id: 'w3' }],
    });
    const result = analyzeSnapshotDomains(data);
    const sch = result.find((d) => d.domain === 'schematic')!;
    expect(sch.itemCount).toBe(6);
  });

  it('marks schematic as unavailable when instances, nets, and wires are empty', () => {
    const data = makeSnapshotData({ instances: [], nets: [], wires: [] });
    const result = analyzeSnapshotDomains(data);
    const sch = result.find((d) => d.domain === 'schematic')!;
    expect(sch.available).toBe(false);
    expect(sch.itemCount).toBe(0);
  });

  it('marks bom as available when bomItems exist', () => {
    const data = makeSnapshotData({
      bomItems: [{ id: 1, name: 'Resistor 10k' }],
    });
    const result = analyzeSnapshotDomains(data);
    const bom = result.find((d) => d.domain === 'bom')!;
    expect(bom.available).toBe(true);
    expect(bom.itemCount).toBe(1);
  });

  it('marks bom as unavailable when bomItems empty', () => {
    const data = makeSnapshotData({ bomItems: [] });
    const result = analyzeSnapshotDomains(data);
    const bom = result.find((d) => d.domain === 'bom')!;
    expect(bom.available).toBe(false);
    expect(bom.itemCount).toBe(0);
  });

  it('marks simulation as available when simulationResults exist', () => {
    const data = makeSnapshotData({
      simulationResults: [{ id: 1, type: 'dc', data: {} }],
    });
    const result = analyzeSnapshotDomains(data);
    const sim = result.find((d) => d.domain === 'simulation')!;
    expect(sim.available).toBe(true);
    expect(sim.itemCount).toBe(1);
  });

  it('marks simulation as unavailable when simulationResults empty', () => {
    const data = makeSnapshotData({ simulationResults: [] });
    const result = analyzeSnapshotDomains(data);
    const sim = result.find((d) => d.domain === 'simulation')!;
    expect(sim.available).toBe(false);
    expect(sim.itemCount).toBe(0);
  });

  it('handles missing keys (undefined) gracefully', () => {
    const data = {} as SnapshotData;
    const result = analyzeSnapshotDomains(data);
    expect(result).toHaveLength(4);
    result.forEach((d) => {
      expect(d.available).toBe(false);
      expect(d.itemCount).toBe(0);
    });
  });

  it('handles null snapshot data gracefully', () => {
    const result = analyzeSnapshotDomains(null as unknown as SnapshotData);
    expect(result).toHaveLength(4);
    result.forEach((d) => {
      expect(d.available).toBe(false);
    });
  });

  it('provides descriptions for each domain', () => {
    const data = makeSnapshotData({
      nodes: [{ id: '1' }],
      instances: [{ id: 'i1' }],
      bomItems: [{ id: 1 }],
      simulationResults: [{ id: 1 }],
    });
    const result = analyzeSnapshotDomains(data);
    result.forEach((d) => {
      expect(d.description).toBeTruthy();
      expect(typeof d.description).toBe('string');
      expect(d.description.length).toBeGreaterThan(0);
    });
  });

  it('handles large item counts correctly', () => {
    const nodes = Array.from({ length: 500 }, (_, i) => ({ id: String(i) }));
    const data = makeSnapshotData({ nodes });
    const result = analyzeSnapshotDomains(data);
    const arch = result.find((d) => d.domain === 'architecture')!;
    expect(arch.itemCount).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// generateRestorePlan
// ---------------------------------------------------------------------------

describe('generateRestorePlan', () => {
  const snapshotData = makeSnapshotData({
    nodes: [{ id: '1' }, { id: '2' }],
    edges: [{ id: 'e1' }],
    instances: [{ id: 'i1' }],
    nets: [{ id: 'n1' }],
    wires: [{ id: 'w1' }],
    bomItems: [{ id: 1, name: 'R1' }, { id: 2, name: 'C1' }],
    simulationResults: [{ id: 1, type: 'dc' }],
  });

  it('returns a RestorePlan with steps matching requested domains', () => {
    const config: CascadeRestoreConfig = {
      snapshotId: 1,
      domains: ['architecture', 'bom'],
      projectId: 1,
    };
    const plan = generateRestorePlan(config, snapshotData);
    expect(plan.steps).toHaveLength(2);
    expect(plan.steps.map((s) => s.domain)).toEqual(['architecture', 'bom']);
  });

  it('sets action to replace by default', () => {
    const config: CascadeRestoreConfig = {
      snapshotId: 1,
      domains: ['architecture'],
      projectId: 1,
    };
    const plan = generateRestorePlan(config, snapshotData);
    expect(plan.steps[0].action).toBe('replace');
  });

  it('calculates estimatedChanges as total items across all steps', () => {
    const config: CascadeRestoreConfig = {
      snapshotId: 1,
      domains: ['architecture', 'bom'],
      projectId: 1,
    };
    const plan = generateRestorePlan(config, snapshotData);
    // architecture: 2 nodes + 1 edge = 3, bom: 2 items = 2 → total 5
    expect(plan.estimatedChanges).toBe(5);
  });

  it('generates warning when restoring schematic without bom', () => {
    const config: CascadeRestoreConfig = {
      snapshotId: 1,
      domains: ['schematic'],
      projectId: 1,
    };
    const plan = generateRestorePlan(config, snapshotData);
    expect(plan.warnings.length).toBeGreaterThan(0);
    expect(plan.warnings.some((w) => w.toLowerCase().includes('bom'))).toBe(true);
  });

  it('generates warning when restoring bom without schematic', () => {
    const config: CascadeRestoreConfig = {
      snapshotId: 1,
      domains: ['bom'],
      projectId: 1,
    };
    const plan = generateRestorePlan(config, snapshotData);
    expect(plan.warnings.some((w) => w.toLowerCase().includes('schematic'))).toBe(true);
  });

  it('generates warning when restoring simulation without schematic', () => {
    const config: CascadeRestoreConfig = {
      snapshotId: 1,
      domains: ['simulation'],
      projectId: 1,
    };
    const plan = generateRestorePlan(config, snapshotData);
    expect(plan.warnings.some((w) => w.toLowerCase().includes('schematic'))).toBe(true);
  });

  it('generates warning when restoring architecture without schematic', () => {
    const config: CascadeRestoreConfig = {
      snapshotId: 1,
      domains: ['architecture'],
      projectId: 1,
    };
    const plan = generateRestorePlan(config, snapshotData);
    expect(plan.warnings.some((w) => w.toLowerCase().includes('schematic'))).toBe(true);
  });

  it('does NOT generate cross-domain warnings when all domains restored together', () => {
    const config: CascadeRestoreConfig = {
      snapshotId: 1,
      domains: ['architecture', 'schematic', 'bom', 'simulation'],
      projectId: 1,
    };
    const plan = generateRestorePlan(config, snapshotData);
    // No cross-domain inconsistency warnings expected
    const crossDomainWarnings = plan.warnings.filter((w) => w.toLowerCase().includes('inconsistency'));
    expect(crossDomainWarnings).toHaveLength(0);
  });

  it('generates warning for domain with zero items in snapshot', () => {
    const emptyArchData = makeSnapshotData({
      nodes: [],
      edges: [],
      bomItems: [{ id: 1 }],
    });
    const config: CascadeRestoreConfig = {
      snapshotId: 1,
      domains: ['architecture'],
      projectId: 1,
    };
    const plan = generateRestorePlan(config, emptyArchData);
    expect(plan.warnings.some((w) => w.toLowerCase().includes('empty') || w.toLowerCase().includes('no data'))).toBe(true);
  });

  it('step descriptions are non-empty strings', () => {
    const config: CascadeRestoreConfig = {
      snapshotId: 1,
      domains: ['architecture', 'schematic', 'bom', 'simulation'],
      projectId: 1,
    };
    const plan = generateRestorePlan(config, snapshotData);
    plan.steps.forEach((step) => {
      expect(step.description).toBeTruthy();
      expect(typeof step.description).toBe('string');
    });
  });

  it('step itemCount matches domain items in snapshot', () => {
    const config: CascadeRestoreConfig = {
      snapshotId: 1,
      domains: ['architecture', 'schematic', 'bom', 'simulation'],
      projectId: 1,
    };
    const plan = generateRestorePlan(config, snapshotData);

    const archStep = plan.steps.find((s) => s.domain === 'architecture')!;
    expect(archStep.itemCount).toBe(3); // 2 nodes + 1 edge

    const schStep = plan.steps.find((s) => s.domain === 'schematic')!;
    expect(schStep.itemCount).toBe(3); // 1 instance + 1 net + 1 wire

    const bomStep = plan.steps.find((s) => s.domain === 'bom')!;
    expect(bomStep.itemCount).toBe(2);

    const simStep = plan.steps.find((s) => s.domain === 'simulation')!;
    expect(simStep.itemCount).toBe(1);
  });

  it('handles empty domains array', () => {
    const config: CascadeRestoreConfig = {
      snapshotId: 1,
      domains: [],
      projectId: 1,
    };
    const plan = generateRestorePlan(config, snapshotData);
    expect(plan.steps).toHaveLength(0);
    expect(plan.estimatedChanges).toBe(0);
    expect(plan.warnings).toHaveLength(0);
  });

  it('handles single domain', () => {
    const config: CascadeRestoreConfig = {
      snapshotId: 1,
      domains: ['bom'],
      projectId: 1,
    };
    const plan = generateRestorePlan(config, snapshotData);
    expect(plan.steps).toHaveLength(1);
    expect(plan.steps[0].domain).toBe('bom');
  });

  it('maintains domain order from config', () => {
    const config: CascadeRestoreConfig = {
      snapshotId: 1,
      domains: ['simulation', 'architecture', 'bom', 'schematic'],
      projectId: 1,
    };
    const plan = generateRestorePlan(config, snapshotData);
    expect(plan.steps.map((s) => s.domain)).toEqual([
      'simulation',
      'architecture',
      'bom',
      'schematic',
    ]);
  });

  it('handles snapshot data with only some domains populated', () => {
    const partialData = makeSnapshotData({
      nodes: [{ id: '1' }],
      bomItems: [{ id: 1 }],
    });
    const config: CascadeRestoreConfig = {
      snapshotId: 1,
      domains: ['architecture', 'schematic', 'bom'],
      projectId: 1,
    };
    const plan = generateRestorePlan(config, partialData);
    expect(plan.steps).toHaveLength(3);

    const schStep = plan.steps.find((s) => s.domain === 'schematic')!;
    expect(schStep.itemCount).toBe(0);
  });

  it('generates warning when restoring schematic without architecture', () => {
    const config: CascadeRestoreConfig = {
      snapshotId: 1,
      domains: ['schematic'],
      projectId: 1,
    };
    const plan = generateRestorePlan(config, snapshotData);
    expect(plan.warnings.some((w) => w.toLowerCase().includes('architecture'))).toBe(true);
  });

  it('does not generate schematic-architecture warning when both included', () => {
    const config: CascadeRestoreConfig = {
      snapshotId: 1,
      domains: ['schematic', 'architecture'],
      projectId: 1,
    };
    const plan = generateRestorePlan(config, snapshotData);
    const archWarnings = plan.warnings.filter(
      (w) => w.toLowerCase().includes('architecture') && w.toLowerCase().includes('inconsistency'),
    );
    expect(archWarnings).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Type checks (compile-time correctness)
// ---------------------------------------------------------------------------

describe('type definitions', () => {
  it('RestoreDomain includes all four domain values', () => {
    const domains: RestoreDomain[] = ['architecture', 'schematic', 'bom', 'simulation'];
    expect(domains).toHaveLength(4);
  });

  it('SnapshotDomainInfo has required shape', () => {
    const info: SnapshotDomainInfo = {
      domain: 'architecture',
      available: true,
      itemCount: 5,
      description: 'Architecture blocks and connections',
    };
    expect(info.domain).toBe('architecture');
    expect(info.available).toBe(true);
    expect(info.itemCount).toBe(5);
    expect(info.description).toBeTruthy();
  });

  it('CascadeRestoreConfig has required shape', () => {
    const config: CascadeRestoreConfig = {
      snapshotId: 42,
      domains: ['architecture', 'bom'],
      projectId: 7,
    };
    expect(config.snapshotId).toBe(42);
    expect(config.domains).toEqual(['architecture', 'bom']);
    expect(config.projectId).toBe(7);
  });

  it('RestorePlan has required shape', () => {
    const plan: RestorePlan = {
      steps: [],
      estimatedChanges: 0,
      warnings: [],
    };
    expect(plan.steps).toEqual([]);
    expect(plan.estimatedChanges).toBe(0);
    expect(plan.warnings).toEqual([]);
  });

  it('RestoreStep has required shape', () => {
    const step: RestoreStep = {
      domain: 'schematic',
      action: 'replace',
      itemCount: 10,
      description: 'Replace schematic data',
    };
    expect(step.action).toBe('replace');
  });

  it('RestoreStep action can be merge', () => {
    const step: RestoreStep = {
      domain: 'bom',
      action: 'merge',
      itemCount: 3,
      description: 'Merge BOM items',
    };
    expect(step.action).toBe('merge');
  });
});

// ---------------------------------------------------------------------------
// Edge cases & robustness
// ---------------------------------------------------------------------------

describe('edge cases', () => {
  it('handles snapshot data where arrays contain non-object items', () => {
    const data = makeSnapshotData({
      nodes: ['invalid' as unknown as Record<string, unknown>],
    });
    const result = analyzeSnapshotDomains(data);
    const arch = result.find((d) => d.domain === 'architecture')!;
    expect(arch.available).toBe(true);
    expect(arch.itemCount).toBe(1);
  });

  it('handles duplicate domains in config gracefully', () => {
    const config: CascadeRestoreConfig = {
      snapshotId: 1,
      domains: ['bom', 'bom'] as RestoreDomain[],
      projectId: 1,
    };
    const data = makeSnapshotData({ bomItems: [{ id: 1 }] });
    const plan = generateRestorePlan(config, data);
    // Deduplicates or handles gracefully
    expect(plan.steps.length).toBeLessThanOrEqual(2);
  });

  it('estimatedChanges is zero when all requested domains are empty', () => {
    const emptyData = makeSnapshotData();
    const config: CascadeRestoreConfig = {
      snapshotId: 1,
      domains: ['architecture', 'schematic', 'bom', 'simulation'],
      projectId: 1,
    };
    const plan = generateRestorePlan(config, emptyData);
    expect(plan.estimatedChanges).toBe(0);
  });

  it('warnings array is always defined (never undefined)', () => {
    const config: CascadeRestoreConfig = {
      snapshotId: 1,
      domains: ['architecture'],
      projectId: 1,
    };
    const plan = generateRestorePlan(config, makeSnapshotData());
    expect(Array.isArray(plan.warnings)).toBe(true);
  });

  it('steps array is always defined (never undefined)', () => {
    const config: CascadeRestoreConfig = {
      snapshotId: 1,
      domains: [],
      projectId: 1,
    };
    const plan = generateRestorePlan(config, makeSnapshotData());
    expect(Array.isArray(plan.steps)).toBe(true);
  });
});
