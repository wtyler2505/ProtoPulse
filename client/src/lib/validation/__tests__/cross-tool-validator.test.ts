import { describe, it, expect, beforeEach } from 'vitest';
import {
  validateCrossToolConsistency,
  resetIssueCounter,
} from '../cross-tool-validator';
import type {
  SchematicData,
  PcbData,
  BomData,
  SchematicInstance,
  SchematicNet,
  PcbInstance,
  PcbWire,
  BomItemInput,
  CrossToolIssue,
  CrossToolCategory,
} from '../cross-tool-validator';

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

function makeSchematicInstance(overrides: Partial<SchematicInstance> = {}): SchematicInstance {
  return {
    id: 1,
    referenceDesignator: 'R1',
    partId: null,
    properties: {},
    ...overrides,
  };
}

function makeSchematicNet(overrides: Partial<SchematicNet> = {}): SchematicNet {
  return {
    id: 1,
    name: 'NET1',
    netType: 'signal',
    segments: [{ x1: 0, y1: 0, x2: 10, y2: 10 }],
    ...overrides,
  };
}

function makePcbInstance(overrides: Partial<PcbInstance> = {}): PcbInstance {
  return {
    id: 1,
    referenceDesignator: 'R1',
    pcbX: 10,
    pcbY: 20,
    pcbSide: 'front',
    properties: {},
    ...overrides,
  };
}

function makePcbWire(overrides: Partial<PcbWire> = {}): PcbWire {
  return {
    id: 1,
    netId: 1,
    layer: 'F.Cu',
    view: 'pcb',
    ...overrides,
  };
}

function makeBomItem(overrides: Partial<BomItemInput> = {}): BomItemInput {
  return {
    id: 1,
    partNumber: 'RC0805JR-07100RL',
    description: '100 ohm resistor',
    quantity: 1,
    manufacturer: 'Yageo',
    ...overrides,
  };
}

function emptySchematic(): SchematicData {
  return { instances: [], nets: [] };
}

function emptyPcb(): PcbData {
  return { instances: [], wires: [] };
}

function emptyBom(): BomData {
  return { items: [] };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CrossToolValidator', () => {
  beforeEach(() => {
    resetIssueCounter();
  });

  // -----------------------------------------------------------------------
  // Fully consistent design — no issues
  // -----------------------------------------------------------------------

  describe('fully consistent design', () => {
    it('should return zero issues when schematic, PCB, and BOM are consistent', () => {
      const schematic: SchematicData = {
        instances: [
          makeSchematicInstance({ id: 1, referenceDesignator: 'R1', partId: 100 }),
          makeSchematicInstance({ id: 2, referenceDesignator: 'C1', partId: 200 }),
        ],
        nets: [
          makeSchematicNet({ id: 1, name: 'VCC' }),
          makeSchematicNet({ id: 2, name: 'GND' }),
        ],
      };
      const pcb: PcbData = {
        instances: [
          makePcbInstance({ id: 1, referenceDesignator: 'R1' }),
          makePcbInstance({ id: 2, referenceDesignator: 'C1' }),
        ],
        wires: [
          makePcbWire({ id: 1, netId: 1, layer: 'F.Cu' }),
          makePcbWire({ id: 2, netId: 2, layer: 'B.Cu' }),
        ],
      };
      const bom: BomData = {
        items: [
          makeBomItem({ id: 100, quantity: 1 }),
          makeBomItem({ id: 200, partNumber: 'GRM21BR71C104KA01', description: '100nF cap', quantity: 1 }),
        ],
      };

      const result = validateCrossToolConsistency(schematic, pcb, bom);
      expect(result.passed).toBe(true);
      expect(result.issues).toHaveLength(0);
      expect(result.summary.total).toBe(0);
      expect(result.summary.errors).toBe(0);
      expect(result.summary.warnings).toBe(0);
      expect(result.summary.info).toBe(0);
    });

    it('should return passed=true when all domains are empty', () => {
      const result = validateCrossToolConsistency(emptySchematic(), emptyPcb(), emptyBom());
      expect(result.passed).toBe(true);
      expect(result.issues).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // Schematic → PCB instance mapping
  // -----------------------------------------------------------------------

  describe('schematic to PCB instance mapping', () => {
    it('should report error when schematic instance has no PCB placement', () => {
      const schematic: SchematicData = {
        instances: [makeSchematicInstance({ referenceDesignator: 'U1' })],
        nets: [],
      };
      const result = validateCrossToolConsistency(schematic, emptyPcb(), emptyBom());

      const issue = result.issues.find((i) => i.referenceDesignator === 'U1' && i.category === 'missing-mapping');
      expect(issue).toBeDefined();
      expect(issue!.severity).toBe('error');
      expect(issue!.source).toBe('schematic');
      expect(issue!.target).toBe('pcb');
      expect(result.passed).toBe(false);
    });

    it('should report multiple missing PCB placements', () => {
      const schematic: SchematicData = {
        instances: [
          makeSchematicInstance({ id: 1, referenceDesignator: 'R1' }),
          makeSchematicInstance({ id: 2, referenceDesignator: 'R2' }),
          makeSchematicInstance({ id: 3, referenceDesignator: 'R3' }),
        ],
        nets: [],
      };
      const result = validateCrossToolConsistency(schematic, emptyPcb(), emptyBom());

      const missingMappings = result.issues.filter(
        (i) => i.category === 'missing-mapping' && i.source === 'schematic' && i.target === 'pcb',
      );
      expect(missingMappings).toHaveLength(3);
    });

    it('should not report when schematic and PCB instances match', () => {
      const schematic: SchematicData = {
        instances: [makeSchematicInstance({ referenceDesignator: 'R1' })],
        nets: [],
      };
      const pcb: PcbData = {
        instances: [makePcbInstance({ referenceDesignator: 'R1' })],
        wires: [],
      };
      const result = validateCrossToolConsistency(schematic, pcb, emptyBom());

      const missingMappings = result.issues.filter(
        (i) => i.category === 'missing-mapping' && i.source === 'schematic' && i.target === 'pcb',
      );
      expect(missingMappings).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // PCB → Schematic orphan instances
  // -----------------------------------------------------------------------

  describe('PCB to schematic orphan instances', () => {
    it('should report error when PCB instance has no schematic counterpart', () => {
      const pcb: PcbData = {
        instances: [makePcbInstance({ referenceDesignator: 'Q1' })],
        wires: [],
      };
      const result = validateCrossToolConsistency(emptySchematic(), pcb, emptyBom());

      const orphan = result.issues.find((i) => i.category === 'orphan' && i.source === 'pcb');
      expect(orphan).toBeDefined();
      expect(orphan!.severity).toBe('error');
      expect(orphan!.referenceDesignator).toBe('Q1');
      expect(result.passed).toBe(false);
    });

    it('should not report orphan when PCB and schematic match', () => {
      const schematic: SchematicData = {
        instances: [makeSchematicInstance({ referenceDesignator: 'R1' })],
        nets: [],
      };
      const pcb: PcbData = {
        instances: [makePcbInstance({ referenceDesignator: 'R1' })],
        wires: [],
      };
      const result = validateCrossToolConsistency(schematic, pcb, emptyBom());

      const orphans = result.issues.filter((i) => i.category === 'orphan' && i.source === 'pcb');
      expect(orphans).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // Unplaced PCB instances
  // -----------------------------------------------------------------------

  describe('unplaced PCB instances', () => {
    it('should warn when PCB instance has null coordinates', () => {
      const pcb: PcbData = {
        instances: [makePcbInstance({ referenceDesignator: 'R1', pcbX: null, pcbY: null })],
        wires: [],
      };
      const schematic: SchematicData = {
        instances: [makeSchematicInstance({ referenceDesignator: 'R1' })],
        nets: [],
      };
      const result = validateCrossToolConsistency(schematic, pcb, emptyBom());

      const unplaced = result.issues.find(
        (i) => i.referenceDesignator === 'R1' && i.message.includes('no placement coordinates'),
      );
      expect(unplaced).toBeDefined();
      expect(unplaced!.severity).toBe('warning');
    });

    it('should warn when only pcbX is null', () => {
      const pcb: PcbData = {
        instances: [makePcbInstance({ referenceDesignator: 'C1', pcbX: null, pcbY: 10 })],
        wires: [],
      };
      const schematic: SchematicData = {
        instances: [makeSchematicInstance({ referenceDesignator: 'C1' })],
        nets: [],
      };
      const result = validateCrossToolConsistency(schematic, pcb, emptyBom());

      const unplaced = result.issues.find((i) => i.referenceDesignator === 'C1' && i.message.includes('no placement'));
      expect(unplaced).toBeDefined();
    });

    it('should not warn when PCB instance has valid coordinates', () => {
      const pcb: PcbData = {
        instances: [makePcbInstance({ referenceDesignator: 'R1', pcbX: 50, pcbY: 100 })],
        wires: [],
      };
      const schematic: SchematicData = {
        instances: [makeSchematicInstance({ referenceDesignator: 'R1' })],
        nets: [],
      };
      const result = validateCrossToolConsistency(schematic, pcb, emptyBom());

      const unplaced = result.issues.filter((i) => i.message.includes('no placement'));
      expect(unplaced).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // Schematic net → PCB wire mapping
  // -----------------------------------------------------------------------

  describe('schematic nets to PCB wires', () => {
    it('should warn when a wired schematic net has no PCB trace', () => {
      const schematic: SchematicData = {
        instances: [],
        nets: [makeSchematicNet({ id: 5, name: 'SDA', segments: [{ from: 'a', to: 'b' }] })],
      };
      const result = validateCrossToolConsistency(schematic, emptyPcb(), emptyBom());

      const netIssue = result.issues.find((i) => i.category === 'net-mismatch' && i.netName === 'SDA');
      expect(netIssue).toBeDefined();
      expect(netIssue!.severity).toBe('warning');
      expect(netIssue!.source).toBe('schematic');
      expect(netIssue!.target).toBe('pcb');
    });

    it('should not warn when schematic net has a corresponding PCB wire', () => {
      const schematic: SchematicData = {
        instances: [],
        nets: [makeSchematicNet({ id: 3, name: 'CLK' })],
      };
      const pcb: PcbData = {
        instances: [],
        wires: [makePcbWire({ netId: 3, view: 'pcb' })],
      };
      const result = validateCrossToolConsistency(schematic, pcb, emptyBom());

      const netIssues = result.issues.filter((i) => i.category === 'net-mismatch');
      expect(netIssues).toHaveLength(0);
    });

    it('should skip nets with no segments (unwired)', () => {
      const schematic: SchematicData = {
        instances: [],
        nets: [makeSchematicNet({ id: 7, name: 'UNUSED', segments: [] })],
      };
      const result = validateCrossToolConsistency(schematic, emptyPcb(), emptyBom());

      const netMismatches = result.issues.filter((i) => i.category === 'net-mismatch');
      expect(netMismatches).toHaveLength(0);
    });

    it('should ignore non-pcb view wires', () => {
      const schematic: SchematicData = {
        instances: [],
        nets: [makeSchematicNet({ id: 1, name: 'NET1' })],
      };
      const pcb: PcbData = {
        instances: [],
        wires: [makePcbWire({ netId: 1, view: 'schematic' })], // Not a PCB wire
      };
      const result = validateCrossToolConsistency(schematic, pcb, emptyBom());

      const netIssues = result.issues.filter((i) => i.category === 'net-mismatch');
      expect(netIssues).toHaveLength(1);
    });
  });

  // -----------------------------------------------------------------------
  // BOM ↔ Schematic count matching
  // -----------------------------------------------------------------------

  describe('BOM to schematic count matching', () => {
    it('should warn when BOM quantity does not match schematic instance count', () => {
      const schematic: SchematicData = {
        instances: [
          makeSchematicInstance({ id: 1, referenceDesignator: 'R1', partId: 50 }),
          makeSchematicInstance({ id: 2, referenceDesignator: 'R2', partId: 50 }),
          makeSchematicInstance({ id: 3, referenceDesignator: 'R3', partId: 50 }),
        ],
        nets: [],
      };
      const bom: BomData = {
        items: [makeBomItem({ id: 50, quantity: 2 })], // BOM says 2, schematic has 3
      };
      // Need PCB instances to avoid missing-mapping errors
      const pcb: PcbData = {
        instances: [
          makePcbInstance({ referenceDesignator: 'R1' }),
          makePcbInstance({ referenceDesignator: 'R2' }),
          makePcbInstance({ referenceDesignator: 'R3' }),
        ],
        wires: [],
      };

      const result = validateCrossToolConsistency(schematic, pcb, bom);
      const countIssue = result.issues.find((i) => i.category === 'count-mismatch');
      expect(countIssue).toBeDefined();
      expect(countIssue!.severity).toBe('warning');
      expect(countIssue!.message).toContain('2');
      expect(countIssue!.message).toContain('3');
    });

    it('should not warn when BOM quantity matches schematic count', () => {
      const schematic: SchematicData = {
        instances: [
          makeSchematicInstance({ id: 1, referenceDesignator: 'R1', partId: 10 }),
          makeSchematicInstance({ id: 2, referenceDesignator: 'R2', partId: 10 }),
        ],
        nets: [],
      };
      const bom: BomData = {
        items: [makeBomItem({ id: 10, quantity: 2 })],
      };
      const pcb: PcbData = {
        instances: [
          makePcbInstance({ referenceDesignator: 'R1' }),
          makePcbInstance({ referenceDesignator: 'R2' }),
        ],
        wires: [],
      };

      const result = validateCrossToolConsistency(schematic, pcb, bom);
      const countIssues = result.issues.filter((i) => i.category === 'count-mismatch');
      expect(countIssues).toHaveLength(0);
    });

    it('should report info when BOM item has no schematic instances', () => {
      const bom: BomData = {
        items: [makeBomItem({ id: 99, partNumber: 'ORPHAN-PART' })],
      };
      const result = validateCrossToolConsistency(emptySchematic(), emptyPcb(), bom);

      const orphanBom = result.issues.find(
        (i) => i.source === 'bom' && i.target === 'schematic' && i.category === 'missing-mapping',
      );
      expect(orphanBom).toBeDefined();
      expect(orphanBom!.severity).toBe('info');
    });
  });

  // -----------------------------------------------------------------------
  // Schematic → BOM coverage
  // -----------------------------------------------------------------------

  describe('schematic to BOM coverage', () => {
    it('should warn when schematic instances reference a partId not in BOM', () => {
      const schematic: SchematicData = {
        instances: [
          makeSchematicInstance({ id: 1, referenceDesignator: 'U1', partId: 999 }),
        ],
        nets: [],
      };
      const pcb: PcbData = {
        instances: [makePcbInstance({ referenceDesignator: 'U1' })],
        wires: [],
      };
      const result = validateCrossToolConsistency(schematic, pcb, emptyBom());

      const coverageIssue = result.issues.find(
        (i) => i.category === 'missing-mapping' && i.source === 'schematic' && i.target === 'bom',
      );
      expect(coverageIssue).toBeDefined();
      expect(coverageIssue!.severity).toBe('warning');
      expect(coverageIssue!.message).toContain('U1');
    });

    it('should group multiple instances referencing the same missing partId', () => {
      const schematic: SchematicData = {
        instances: [
          makeSchematicInstance({ id: 1, referenceDesignator: 'R1', partId: 42 }),
          makeSchematicInstance({ id: 2, referenceDesignator: 'R2', partId: 42 }),
          makeSchematicInstance({ id: 3, referenceDesignator: 'R3', partId: 42 }),
        ],
        nets: [],
      };
      const pcb: PcbData = {
        instances: [
          makePcbInstance({ referenceDesignator: 'R1' }),
          makePcbInstance({ referenceDesignator: 'R2' }),
          makePcbInstance({ referenceDesignator: 'R3' }),
        ],
        wires: [],
      };
      const result = validateCrossToolConsistency(schematic, pcb, emptyBom());

      const coverageIssues = result.issues.filter(
        (i) => i.category === 'missing-mapping' && i.source === 'schematic' && i.target === 'bom',
      );
      // Should be one issue grouping all three
      expect(coverageIssues).toHaveLength(1);
      expect(coverageIssues[0].message).toContain('R1');
      expect(coverageIssues[0].message).toContain('R2');
      expect(coverageIssues[0].message).toContain('R3');
    });

    it('should not warn when schematic instances have null partId', () => {
      const schematic: SchematicData = {
        instances: [makeSchematicInstance({ referenceDesignator: 'J1', partId: null })],
        nets: [],
      };
      const pcb: PcbData = {
        instances: [makePcbInstance({ referenceDesignator: 'J1' })],
        wires: [],
      };
      const result = validateCrossToolConsistency(schematic, pcb, emptyBom());

      const coverageIssues = result.issues.filter(
        (i) => i.category === 'missing-mapping' && i.source === 'schematic' && i.target === 'bom',
      );
      expect(coverageIssues).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // Footprint / package consistency
  // -----------------------------------------------------------------------

  describe('footprint consistency', () => {
    it('should report error when schematic and PCB have different packageType', () => {
      const schematic: SchematicData = {
        instances: [
          makeSchematicInstance({
            referenceDesignator: 'R1',
            properties: { packageType: 'SMD-0805' },
          }),
        ],
        nets: [],
      };
      const pcb: PcbData = {
        instances: [
          makePcbInstance({
            referenceDesignator: 'R1',
            properties: { packageType: 'THT-Axial' },
          }),
        ],
        wires: [],
      };
      const result = validateCrossToolConsistency(schematic, pcb, emptyBom());

      const fpIssue = result.issues.find((i) => i.category === 'footprint-mismatch');
      expect(fpIssue).toBeDefined();
      expect(fpIssue!.severity).toBe('error');
      expect(fpIssue!.message).toContain('SMD-0805');
      expect(fpIssue!.message).toContain('THT-Axial');
      expect(result.passed).toBe(false);
    });

    it('should not report when packageTypes match', () => {
      const schematic: SchematicData = {
        instances: [
          makeSchematicInstance({
            referenceDesignator: 'C1',
            properties: { packageType: 'SMD-0603' },
          }),
        ],
        nets: [],
      };
      const pcb: PcbData = {
        instances: [
          makePcbInstance({
            referenceDesignator: 'C1',
            properties: { packageType: 'SMD-0603' },
          }),
        ],
        wires: [],
      };
      const result = validateCrossToolConsistency(schematic, pcb, emptyBom());

      const fpIssues = result.issues.filter((i) => i.category === 'footprint-mismatch');
      expect(fpIssues).toHaveLength(0);
    });

    it('should not report when neither side has a packageType', () => {
      const schematic: SchematicData = {
        instances: [makeSchematicInstance({ referenceDesignator: 'R1', properties: {} })],
        nets: [],
      };
      const pcb: PcbData = {
        instances: [makePcbInstance({ referenceDesignator: 'R1', properties: {} })],
        wires: [],
      };
      const result = validateCrossToolConsistency(schematic, pcb, emptyBom());

      const fpIssues = result.issues.filter((i) => i.category === 'footprint-mismatch');
      expect(fpIssues).toHaveLength(0);
    });

    it('should use footprint property as fallback for packageType', () => {
      const schematic: SchematicData = {
        instances: [
          makeSchematicInstance({
            referenceDesignator: 'U1',
            properties: { footprint: 'QFP-44' },
          }),
        ],
        nets: [],
      };
      const pcb: PcbData = {
        instances: [
          makePcbInstance({
            referenceDesignator: 'U1',
            properties: { footprint: 'TQFP-44' },
          }),
        ],
        wires: [],
      };
      const result = validateCrossToolConsistency(schematic, pcb, emptyBom());

      const fpIssue = result.issues.find((i) => i.category === 'footprint-mismatch');
      expect(fpIssue).toBeDefined();
      expect(fpIssue!.message).toContain('QFP-44');
      expect(fpIssue!.message).toContain('TQFP-44');
    });

    it('should not report when only one side has packageType', () => {
      const schematic: SchematicData = {
        instances: [
          makeSchematicInstance({
            referenceDesignator: 'R1',
            properties: { packageType: 'SMD-0805' },
          }),
        ],
        nets: [],
      };
      const pcb: PcbData = {
        instances: [makePcbInstance({ referenceDesignator: 'R1', properties: {} })],
        wires: [],
      };
      const result = validateCrossToolConsistency(schematic, pcb, emptyBom());

      const fpIssues = result.issues.filter((i) => i.category === 'footprint-mismatch');
      expect(fpIssues).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // Orphan nets
  // -----------------------------------------------------------------------

  describe('orphan nets', () => {
    it('should report info for nets with no segments', () => {
      const schematic: SchematicData = {
        instances: [],
        nets: [makeSchematicNet({ id: 1, name: 'FLOATING', segments: [] })],
      };
      const result = validateCrossToolConsistency(schematic, emptyPcb(), emptyBom());

      const orphan = result.issues.find((i) => i.category === 'orphan' && i.netName === 'FLOATING');
      expect(orphan).toBeDefined();
      expect(orphan!.severity).toBe('info');
      expect(orphan!.source).toBe('schematic');
    });

    it('should not report nets that have segments', () => {
      const schematic: SchematicData = {
        instances: [],
        nets: [makeSchematicNet({ id: 1, name: 'WIRED', segments: [{ a: 1 }] })],
      };
      const pcb: PcbData = {
        instances: [],
        wires: [makePcbWire({ netId: 1 })],
      };
      const result = validateCrossToolConsistency(schematic, pcb, emptyBom());

      const orphans = result.issues.filter((i) => i.category === 'orphan' && i.source === 'schematic');
      expect(orphans).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // Layer assignment validation
  // -----------------------------------------------------------------------

  describe('layer assignment validation', () => {
    it('should warn when PCB wire has an invalid layer', () => {
      const pcb: PcbData = {
        instances: [],
        wires: [makePcbWire({ layer: 'InvalidLayer', view: 'pcb' })],
      };
      const result = validateCrossToolConsistency(emptySchematic(), pcb, emptyBom());

      const layerIssue = result.issues.find((i) => i.category === 'layer-mismatch');
      expect(layerIssue).toBeDefined();
      expect(layerIssue!.severity).toBe('warning');
      expect(layerIssue!.message).toContain('InvalidLayer');
    });

    it('should accept valid PCB layers', () => {
      const validLayers = ['F.Cu', 'B.Cu', 'In1.Cu', 'front', 'back', 'F.SilkS', 'Edge.Cuts'];
      const pcb: PcbData = {
        instances: [],
        wires: validLayers.map((layer, idx) => makePcbWire({ id: idx + 1, layer, view: 'pcb' })),
      };
      const result = validateCrossToolConsistency(emptySchematic(), pcb, emptyBom());

      const layerIssues = result.issues.filter((i) => i.category === 'layer-mismatch');
      expect(layerIssues).toHaveLength(0);
    });

    it('should deduplicate invalid layer warnings', () => {
      const pcb: PcbData = {
        instances: [],
        wires: [
          makePcbWire({ id: 1, layer: 'BadLayer', view: 'pcb' }),
          makePcbWire({ id: 2, layer: 'BadLayer', view: 'pcb' }),
          makePcbWire({ id: 3, layer: 'BadLayer', view: 'pcb' }),
        ],
      };
      const result = validateCrossToolConsistency(emptySchematic(), pcb, emptyBom());

      const layerIssues = result.issues.filter((i) => i.category === 'layer-mismatch');
      expect(layerIssues).toHaveLength(1); // Deduplicated
    });

    it('should skip wires that are not PCB view', () => {
      const pcb: PcbData = {
        instances: [],
        wires: [makePcbWire({ layer: 'InvalidLayer', view: 'schematic' })],
      };
      const result = validateCrossToolConsistency(emptySchematic(), pcb, emptyBom());

      const layerIssues = result.issues.filter((i) => i.category === 'layer-mismatch');
      expect(layerIssues).toHaveLength(0);
    });

    it('should accept null layer without warning', () => {
      const pcb: PcbData = {
        instances: [],
        wires: [makePcbWire({ layer: null, view: 'pcb' })],
      };
      const result = validateCrossToolConsistency(emptySchematic(), pcb, emptyBom());

      const layerIssues = result.issues.filter((i) => i.category === 'layer-mismatch');
      expect(layerIssues).toHaveLength(0);
    });

    it('should warn when PCB instance has invalid pcbSide', () => {
      const pcb: PcbData = {
        instances: [makePcbInstance({ referenceDesignator: 'R1', pcbSide: 'top' })],
        wires: [],
      };
      const schematic: SchematicData = {
        instances: [makeSchematicInstance({ referenceDesignator: 'R1' })],
        nets: [],
      };
      const result = validateCrossToolConsistency(schematic, pcb, emptyBom());

      const sideIssue = result.issues.find(
        (i) => i.category === 'layer-mismatch' && i.referenceDesignator === 'R1',
      );
      expect(sideIssue).toBeDefined();
      expect(sideIssue!.message).toContain('top');
    });

    it('should accept valid pcbSide values', () => {
      const pcb: PcbData = {
        instances: [
          makePcbInstance({ id: 1, referenceDesignator: 'R1', pcbSide: 'front' }),
          makePcbInstance({ id: 2, referenceDesignator: 'R2', pcbSide: 'back' }),
        ],
        wires: [],
      };
      const schematic: SchematicData = {
        instances: [
          makeSchematicInstance({ id: 1, referenceDesignator: 'R1' }),
          makeSchematicInstance({ id: 2, referenceDesignator: 'R2' }),
        ],
        nets: [],
      };
      const result = validateCrossToolConsistency(schematic, pcb, emptyBom());

      const sideIssues = result.issues.filter(
        (i) => i.category === 'layer-mismatch' && i.referenceDesignator !== undefined,
      );
      expect(sideIssues).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // Duplicate reference designators
  // -----------------------------------------------------------------------

  describe('duplicate reference designators', () => {
    it('should report error for duplicate refdes in schematic', () => {
      const schematic: SchematicData = {
        instances: [
          makeSchematicInstance({ id: 1, referenceDesignator: 'R1' }),
          makeSchematicInstance({ id: 2, referenceDesignator: 'R1' }),
        ],
        nets: [],
      };
      const pcb: PcbData = {
        instances: [makePcbInstance({ referenceDesignator: 'R1' })],
        wires: [],
      };
      const result = validateCrossToolConsistency(schematic, pcb, emptyBom());

      const dupIssue = result.issues.find(
        (i) => i.source === 'schematic' && i.message.includes('Duplicate'),
      );
      expect(dupIssue).toBeDefined();
      expect(dupIssue!.severity).toBe('error');
      expect(dupIssue!.message).toContain('2 instances');
    });

    it('should report error for duplicate refdes in PCB', () => {
      const schematic: SchematicData = {
        instances: [makeSchematicInstance({ referenceDesignator: 'C1' })],
        nets: [],
      };
      const pcb: PcbData = {
        instances: [
          makePcbInstance({ id: 1, referenceDesignator: 'C1' }),
          makePcbInstance({ id: 2, referenceDesignator: 'C1' }),
        ],
        wires: [],
      };
      const result = validateCrossToolConsistency(schematic, pcb, emptyBom());

      const dupIssue = result.issues.find(
        (i) => i.source === 'pcb' && i.message.includes('Duplicate'),
      );
      expect(dupIssue).toBeDefined();
      expect(dupIssue!.severity).toBe('error');
    });

    it('should not report when all refdes are unique', () => {
      const schematic: SchematicData = {
        instances: [
          makeSchematicInstance({ id: 1, referenceDesignator: 'R1' }),
          makeSchematicInstance({ id: 2, referenceDesignator: 'R2' }),
        ],
        nets: [],
      };
      const pcb: PcbData = {
        instances: [
          makePcbInstance({ id: 1, referenceDesignator: 'R1' }),
          makePcbInstance({ id: 2, referenceDesignator: 'R2' }),
        ],
        wires: [],
      };
      const result = validateCrossToolConsistency(schematic, pcb, emptyBom());

      const dupIssues = result.issues.filter((i) => i.message.includes('Duplicate'));
      expect(dupIssues).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // Summary and result structure
  // -----------------------------------------------------------------------

  describe('result structure and summary', () => {
    it('should produce correct summary counts', () => {
      const schematic: SchematicData = {
        instances: [
          makeSchematicInstance({ id: 1, referenceDesignator: 'R1', partId: 999 }),
          makeSchematicInstance({ id: 2, referenceDesignator: 'U1' }),
        ],
        nets: [
          makeSchematicNet({ id: 1, name: 'ORPHAN', segments: [] }),
          makeSchematicNet({ id: 2, name: 'UNROUTED', segments: [{ a: 1 }] }),
        ],
      };
      const pcb: PcbData = {
        instances: [
          makePcbInstance({ referenceDesignator: 'R1' }),
          makePcbInstance({ referenceDesignator: 'U1' }),
        ],
        wires: [],
      };
      const result = validateCrossToolConsistency(schematic, pcb, emptyBom());

      expect(result.summary.total).toBe(result.issues.length);
      expect(result.summary.errors + result.summary.warnings + result.summary.info).toBe(result.summary.total);
    });

    it('should set passed=true when no errors exist', () => {
      const result = validateCrossToolConsistency(emptySchematic(), emptyPcb(), emptyBom());
      expect(result.passed).toBe(true);
    });

    it('should set passed=false when errors exist', () => {
      const schematic: SchematicData = {
        instances: [makeSchematicInstance({ referenceDesignator: 'MISSING' })],
        nets: [],
      };
      const result = validateCrossToolConsistency(schematic, emptyPcb(), emptyBom());
      expect(result.passed).toBe(false);
      expect(result.summary.errors).toBeGreaterThan(0);
    });

    it('should set passed=true when only warnings and info exist', () => {
      const schematic: SchematicData = {
        instances: [],
        nets: [makeSchematicNet({ id: 1, name: 'ORPHAN', segments: [] })],
      };
      const result = validateCrossToolConsistency(schematic, emptyPcb(), emptyBom());

      expect(result.passed).toBe(true);
      expect(result.summary.warnings + result.summary.info).toBeGreaterThan(0);
    });

    it('should have all category keys in byCategory even when zero', () => {
      const result = validateCrossToolConsistency(emptySchematic(), emptyPcb(), emptyBom());

      const expectedCategories: CrossToolCategory[] = [
        'net-mismatch',
        'layer-mismatch',
        'footprint-mismatch',
        'missing-mapping',
        'orphan',
        'count-mismatch',
      ];
      expectedCategories.forEach((cat) => {
        expect(result.summary.byCategory[cat]).toBeDefined();
        expect(result.summary.byCategory[cat]).toBe(0);
      });
    });

    it('should generate unique issue IDs', () => {
      const schematic: SchematicData = {
        instances: [
          makeSchematicInstance({ id: 1, referenceDesignator: 'R1' }),
          makeSchematicInstance({ id: 2, referenceDesignator: 'R2' }),
          makeSchematicInstance({ id: 3, referenceDesignator: 'R3' }),
        ],
        nets: [],
      };
      const result = validateCrossToolConsistency(schematic, emptyPcb(), emptyBom());

      const ids = result.issues.map((i) => i.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should include suggestion on every issue', () => {
      const schematic: SchematicData = {
        instances: [makeSchematicInstance({ referenceDesignator: 'U1', partId: 42 })],
        nets: [makeSchematicNet({ id: 1, name: 'NET1' })],
      };
      const pcb: PcbData = {
        instances: [
          makePcbInstance({ referenceDesignator: 'ORPHAN_PCB' }),
        ],
        wires: [makePcbWire({ layer: 'BadLayer', view: 'pcb' })],
      };
      const bom: BomData = {
        items: [makeBomItem({ id: 99 })],
      };
      const result = validateCrossToolConsistency(schematic, pcb, bom);

      result.issues.forEach((issue) => {
        expect(issue.suggestion).toBeTruthy();
        expect(issue.suggestion.length).toBeGreaterThan(0);
      });
    });
  });

  // -----------------------------------------------------------------------
  // Complex mixed scenario
  // -----------------------------------------------------------------------

  describe('complex mixed scenario', () => {
    it('should detect multiple issue types in a single validation run', () => {
      const schematic: SchematicData = {
        instances: [
          makeSchematicInstance({ id: 1, referenceDesignator: 'R1', partId: 10, properties: { packageType: 'SMD-0805' } }),
          makeSchematicInstance({ id: 2, referenceDesignator: 'R2', partId: 10, properties: { packageType: 'SMD-0805' } }),
          makeSchematicInstance({ id: 3, referenceDesignator: 'U1', partId: 20 }), // No PCB placement
          makeSchematicInstance({ id: 4, referenceDesignator: 'C1', partId: 30, properties: { packageType: 'SMD-0603' } }),
        ],
        nets: [
          makeSchematicNet({ id: 1, name: 'VCC', segments: [{ a: 1 }] }),
          makeSchematicNet({ id: 2, name: 'GND', segments: [{ a: 1 }] }),
          makeSchematicNet({ id: 3, name: 'UNUSED', segments: [] }), // Orphan
        ],
      };

      const pcb: PcbData = {
        instances: [
          makePcbInstance({ id: 1, referenceDesignator: 'R1', properties: { packageType: 'SMD-0805' } }),
          makePcbInstance({ id: 2, referenceDesignator: 'R2', pcbX: null, pcbY: null, properties: { packageType: 'SMD-0805' } }), // Unplaced
          makePcbInstance({ id: 3, referenceDesignator: 'C1', properties: { packageType: 'SMD-0402' } }), // Footprint mismatch!
          makePcbInstance({ id: 4, referenceDesignator: 'D1' }), // Orphan (not in schematic)
        ],
        wires: [
          makePcbWire({ id: 1, netId: 1, layer: 'F.Cu', view: 'pcb' }),
          // GND not routed
        ],
      };

      const bom: BomData = {
        items: [
          makeBomItem({ id: 10, partNumber: 'RESISTOR', quantity: 3 }), // Count mismatch (2 in schematic, BOM says 3)
          makeBomItem({ id: 30, partNumber: 'CAP', quantity: 1 }),
        ],
      };

      const result = validateCrossToolConsistency(schematic, pcb, bom);

      // Should detect all these issue types
      const categories = new Set(result.issues.map((i) => i.category));
      expect(categories.has('missing-mapping')).toBe(true); // U1 missing from PCB
      expect(categories.has('orphan')).toBe(true); // D1 orphan on PCB, UNUSED orphan net
      expect(categories.has('footprint-mismatch')).toBe(true); // C1 0603 vs 0402
      expect(categories.has('net-mismatch')).toBe(true); // GND unrouted
      expect(categories.has('count-mismatch')).toBe(true); // RESISTOR 3 vs 2

      // Should fail (errors present)
      expect(result.passed).toBe(false);
      expect(result.summary.errors).toBeGreaterThan(0);
      expect(result.summary.total).toBeGreaterThan(5);
    });
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------

  describe('edge cases', () => {
    it('should handle large number of instances', () => {
      const count = 200;
      const schInstances: SchematicInstance[] = [];
      const pcbInstances: PcbInstance[] = [];
      for (let i = 0; i < count; i++) {
        schInstances.push(makeSchematicInstance({ id: i, referenceDesignator: `R${i}` }));
        pcbInstances.push(makePcbInstance({ id: i, referenceDesignator: `R${i}` }));
      }

      const schematic: SchematicData = { instances: schInstances, nets: [] };
      const pcb: PcbData = { instances: pcbInstances, wires: [] };
      const result = validateCrossToolConsistency(schematic, pcb, emptyBom());

      // No missing-mapping or orphan errors
      const mappingIssues = result.issues.filter(
        (i) => i.category === 'missing-mapping' || i.category === 'orphan',
      );
      expect(mappingIssues).toHaveLength(0);
    });

    it('should handle instances with empty properties', () => {
      const schematic: SchematicData = {
        instances: [makeSchematicInstance({ referenceDesignator: 'R1', properties: {} })],
        nets: [],
      };
      const pcb: PcbData = {
        instances: [makePcbInstance({ referenceDesignator: 'R1', properties: {} })],
        wires: [],
      };
      const result = validateCrossToolConsistency(schematic, pcb, emptyBom());

      const fpIssues = result.issues.filter((i) => i.category === 'footprint-mismatch');
      expect(fpIssues).toHaveLength(0);
    });

    it('resetIssueCounter should reset to predictable IDs', () => {
      resetIssueCounter();
      const schematic: SchematicData = {
        instances: [makeSchematicInstance({ referenceDesignator: 'X1' })],
        nets: [],
      };
      const result = validateCrossToolConsistency(schematic, emptyPcb(), emptyBom());

      expect(result.issues[0].id).toBe('xtv-1');
    });
  });
});
