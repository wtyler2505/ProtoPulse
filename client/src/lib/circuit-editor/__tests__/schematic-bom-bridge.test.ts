import { describe, it, expect, beforeEach } from 'vitest';
import {
  schematicBomBridge,
} from '../schematic-bom-bridge';
import type {
  BomEntryDraft,
  UnmappedComponent,
  DuplicateMatch,
  SyncPlan,
} from '../schematic-bom-bridge';
import type { CircuitInstanceRow, BomItem, ComponentPart } from '@shared/schema';

// ---------------------------------------------------------------------------
// Test factories
// ---------------------------------------------------------------------------

function makeInstance(overrides: Partial<CircuitInstanceRow> = {}): CircuitInstanceRow {
  return {
    id: 1,
    circuitId: 1,
    partId: 100,
    subDesignId: null,
    referenceDesignator: 'R1',
    schematicX: 0,
    schematicY: 0,
    schematicRotation: 0,
    breadboardX: null,
    breadboardY: null,
    breadboardRotation: 0,
    pcbX: null,
    pcbY: null,
    pcbRotation: 0,
    pcbSide: 'front',
    benchX: null,
    benchY: null,
    properties: {},
    createdAt: new Date(),
    ...overrides,
  } as CircuitInstanceRow;
}

function makePart(overrides: Partial<ComponentPart> = {}): ComponentPart {
  return {
    id: 100,
    projectId: 1,
    nodeId: null,
    meta: {
      title: '10k Resistor',
      family: 'resistor',
      manufacturer: 'Yageo',
      mpn: 'RC0805FR-0710KL',
      description: '10k Ohm 1% 0805 SMD Resistor',
      tags: ['resistor', 'passive'],
      mountingType: 'smd',
      packageType: '0805',
      properties: [{ key: 'resistance', value: '10k' }],
    },
    connectors: [],
    buses: [],
    views: {},
    constraints: [],
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as ComponentPart;
}

function makeBomItem(overrides: Partial<BomItem> = {}): BomItem {
  return {
    id: 1,
    projectId: 1,
    partNumber: 'RC0805FR-0710KL',
    manufacturer: 'Yageo',
    description: '10k Ohm 1% 0805 SMD Resistor',
    quantity: 5,
    unitPrice: '0.0100',
    totalPrice: '0.0500',
    supplier: 'DigiKey',
    stock: 100,
    status: 'In Stock',
    leadTime: null,
    datasheetUrl: null,
    manufacturerUrl: null,
    storageLocation: null,
    quantityOnHand: null,
    minimumStock: null,
    esdSensitive: null,
    assemblyCategory: null,
    version: 1,
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  } as BomItem;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SchematicBomBridge', () => {
  beforeEach(() => {
    schematicBomBridge.reset();
  });

  // =========================================================================
  // analyzeInstances
  // =========================================================================

  describe('analyzeInstances', () => {
    it('returns empty array when all instances have valid parts', () => {
      const inst = makeInstance({ id: 1, partId: 100 });
      const partsById = new Map([[100, makePart({ id: 100 })]]);
      const result = schematicBomBridge.analyzeInstances([inst], partsById);
      expect(result).toEqual([]);
    });

    it('flags instances with null partId as no_part', () => {
      const inst = makeInstance({ id: 1, partId: null });
      const result = schematicBomBridge.analyzeInstances([inst], new Map());
      expect(result).toHaveLength(1);
      expect(result[0].reason).toBe('no_part');
      expect(result[0].instanceId).toBe(1);
    });

    it('flags instances whose partId has no matching part in map as no_part', () => {
      const inst = makeInstance({ id: 1, partId: 999 });
      const result = schematicBomBridge.analyzeInstances([inst], new Map());
      expect(result).toHaveLength(1);
      expect(result[0].reason).toBe('no_part');
    });

    it('flags instances whose part lacks partNumber and description as missing_metadata', () => {
      const part = makePart({
        id: 100,
        meta: { title: '', tags: [], mountingType: '', properties: [] },
      });
      const inst = makeInstance({ id: 1, partId: 100 });
      const result = schematicBomBridge.analyzeInstances([inst], new Map([[100, part]]));
      expect(result).toHaveLength(1);
      expect(result[0].reason).toBe('missing_metadata');
    });

    it('does not flag instances when part has title but no mpn', () => {
      const part = makePart({
        id: 100,
        meta: { title: 'Generic Resistor', tags: [], mountingType: '', properties: [] },
      });
      const inst = makeInstance({ id: 1, partId: 100 });
      const result = schematicBomBridge.analyzeInstances([inst], new Map([[100, part]]));
      // title maps to description, so it should be mappable
      expect(result).toHaveLength(0);
    });

    it('handles empty instances array', () => {
      const result = schematicBomBridge.analyzeInstances([], new Map());
      expect(result).toEqual([]);
    });

    it('handles multiple unmapped instances', () => {
      const instances = [
        makeInstance({ id: 1, partId: null, referenceDesignator: 'R1' }),
        makeInstance({ id: 2, partId: null, referenceDesignator: 'C1' }),
        makeInstance({ id: 3, partId: 100, referenceDesignator: 'U1' }),
      ];
      const partsById = new Map([[100, makePart({ id: 100 })]]);
      const result = schematicBomBridge.analyzeInstances(instances, partsById);
      expect(result).toHaveLength(2);
      expect(result.map((u) => u.referenceDesignator)).toEqual(['R1', 'C1']);
    });

    it('uses instance properties for description when available', () => {
      const inst = makeInstance({
        id: 1,
        partId: null,
        referenceDesignator: 'R1',
        properties: { description: 'Custom Resistor' },
      });
      const result = schematicBomBridge.analyzeInstances([inst], new Map());
      expect(result[0].description).toBe('Custom Resistor');
    });

    it('uses componentType from properties as fallback description', () => {
      const inst = makeInstance({
        id: 1,
        partId: null,
        referenceDesignator: 'R1',
        properties: { componentType: 'resistor' },
      });
      const result = schematicBomBridge.analyzeInstances([inst], new Map());
      expect(result[0].description).toBe('resistor');
    });

    it('falls back to referenceDesignator for description', () => {
      const inst = makeInstance({
        id: 1,
        partId: null,
        referenceDesignator: 'U5',
        properties: {},
      });
      const result = schematicBomBridge.analyzeInstances([inst], new Map());
      expect(result[0].description).toBe('U5');
    });
  });

  // =========================================================================
  // mapToBomEntry
  // =========================================================================

  describe('mapToBomEntry', () => {
    it('maps instance with full part metadata to a draft', () => {
      const inst = makeInstance({ referenceDesignator: 'R1' });
      const part = makePart();
      const draft = schematicBomBridge.mapToBomEntry(inst, part);
      expect(draft).not.toBeNull();
      expect(draft!.partNumber).toBe('RC0805FR-0710KL');
      expect(draft!.manufacturer).toBe('Yageo');
      expect(draft!.description).toBe('10k Ohm 1% 0805 SMD Resistor');
      expect(draft!.quantity).toBe(1);
      expect(draft!.referenceDesignators).toEqual(['R1']);
      expect(draft!.family).toBe('resistor');
      expect(draft!.mountingType).toBe('smd');
      expect(draft!.packageType).toBe('0805');
    });

    it('returns null when part is undefined', () => {
      const inst = makeInstance();
      expect(schematicBomBridge.mapToBomEntry(inst, undefined)).toBeNull();
    });

    it('returns null when part has no usable metadata', () => {
      const part = makePart({
        meta: { title: '', tags: [], mountingType: '', properties: [] },
      });
      const inst = makeInstance();
      expect(schematicBomBridge.mapToBomEntry(inst, part)).toBeNull();
    });

    it('prefers instance properties over part meta', () => {
      const inst = makeInstance({
        properties: {
          partNumber: 'CUSTOM-001',
          manufacturer: 'CustomCorp',
          description: 'Custom Part',
          unitPrice: '1.50',
          supplier: 'Mouser',
        },
      });
      const part = makePart();
      const draft = schematicBomBridge.mapToBomEntry(inst, part);
      expect(draft!.partNumber).toBe('CUSTOM-001');
      expect(draft!.manufacturer).toBe('CustomCorp');
      expect(draft!.description).toBe('Custom Part');
      expect(draft!.unitPrice).toBe('1.50');
      expect(draft!.supplier).toBe('Mouser');
    });

    it('uses mpn from instance properties as partNumber fallback', () => {
      const inst = makeInstance({
        properties: { mpn: 'MPN-FROM-PROPS' },
      });
      const part = makePart({
        meta: { title: 'Test', tags: [], mountingType: '', properties: [] },
      });
      const draft = schematicBomBridge.mapToBomEntry(inst, part);
      expect(draft!.partNumber).toBe('MPN-FROM-PROPS');
    });

    it('uses packageType from instance properties over part meta', () => {
      const inst = makeInstance({
        properties: { packageType: '0603' },
      });
      const part = makePart(); // meta has packageType: '0805'
      const draft = schematicBomBridge.mapToBomEntry(inst, part);
      expect(draft!.packageType).toBe('0603');
    });

    it('generates consistent identity key from manufacturer + partNumber', () => {
      const inst = makeInstance();
      const part = makePart();
      const draft = schematicBomBridge.mapToBomEntry(inst, part);
      expect(draft!.identityKey).toBe('yageo::rc0805fr-0710kl');
    });

    it('uses description for identity key when no partNumber', () => {
      const part = makePart({
        meta: { title: 'LED Red', tags: [], mountingType: '', properties: [] },
      });
      const inst = makeInstance();
      const draft = schematicBomBridge.mapToBomEntry(inst, part);
      expect(draft!.identityKey).toBe('::led red');
    });

    it('handles null properties gracefully', () => {
      const inst = makeInstance({ properties: null as unknown as Record<string, unknown> });
      const part = makePart();
      const draft = schematicBomBridge.mapToBomEntry(inst, part);
      expect(draft).not.toBeNull();
      expect(draft!.partNumber).toBe('RC0805FR-0710KL');
    });
  });

  // =========================================================================
  // aggregateQuantities
  // =========================================================================

  describe('aggregateQuantities', () => {
    it('aggregates drafts with same identity key', () => {
      const drafts: BomEntryDraft[] = [
        {
          identityKey: 'yageo::rc0805fr-0710kl',
          partNumber: 'RC0805FR-0710KL',
          manufacturer: 'Yageo',
          description: '10k Resistor',
          quantity: 1,
          unitPrice: '0.01',
          supplier: 'DigiKey',
          referenceDesignators: ['R1'],
          family: 'resistor',
          mountingType: 'smd',
          packageType: '0805',
        },
        {
          identityKey: 'yageo::rc0805fr-0710kl',
          partNumber: 'RC0805FR-0710KL',
          manufacturer: 'Yageo',
          description: '10k Resistor',
          quantity: 1,
          unitPrice: '0.01',
          supplier: 'DigiKey',
          referenceDesignators: ['R2'],
          family: 'resistor',
          mountingType: 'smd',
          packageType: '0805',
        },
      ];
      const result = schematicBomBridge.aggregateQuantities(drafts);
      expect(result).toHaveLength(1);
      expect(result[0].quantity).toBe(2);
      expect(result[0].referenceDesignators).toEqual(['R1', 'R2']);
    });

    it('keeps different identity keys separate', () => {
      const drafts: BomEntryDraft[] = [
        {
          identityKey: 'yageo::r10k',
          partNumber: 'R10K',
          manufacturer: 'Yageo',
          description: '10k Resistor',
          quantity: 1,
          unitPrice: '0.01',
          supplier: '',
          referenceDesignators: ['R1'],
          family: 'resistor',
          mountingType: 'smd',
          packageType: '0805',
        },
        {
          identityKey: 'murata::c100nf',
          partNumber: 'C100NF',
          manufacturer: 'Murata',
          description: '100nF Capacitor',
          quantity: 1,
          unitPrice: '0.02',
          supplier: '',
          referenceDesignators: ['C1'],
          family: 'capacitor',
          mountingType: 'smd',
          packageType: '0402',
        },
      ];
      const result = schematicBomBridge.aggregateQuantities(drafts);
      expect(result).toHaveLength(2);
    });

    it('returns empty array for empty input', () => {
      expect(schematicBomBridge.aggregateQuantities([])).toEqual([]);
    });

    it('does not duplicate reference designators', () => {
      const drafts: BomEntryDraft[] = [
        {
          identityKey: 'a::b',
          partNumber: 'B',
          manufacturer: 'A',
          description: 'test',
          quantity: 1,
          unitPrice: '0',
          supplier: '',
          referenceDesignators: ['R1'],
          family: '',
          mountingType: '',
          packageType: '',
        },
        {
          identityKey: 'a::b',
          partNumber: 'B',
          manufacturer: 'A',
          description: 'test',
          quantity: 1,
          unitPrice: '0',
          supplier: '',
          referenceDesignators: ['R1'], // duplicate refdes
          family: '',
          mountingType: '',
          packageType: '',
        },
      ];
      const result = schematicBomBridge.aggregateQuantities(drafts);
      expect(result[0].referenceDesignators).toEqual(['R1']);
      expect(result[0].quantity).toBe(2);
    });

    it('prefers non-empty unitPrice and supplier during aggregation', () => {
      const drafts: BomEntryDraft[] = [
        {
          identityKey: 'a::b',
          partNumber: 'B',
          manufacturer: 'A',
          description: 'test',
          quantity: 1,
          unitPrice: '',
          supplier: '',
          referenceDesignators: ['R1'],
          family: '',
          mountingType: '',
          packageType: '',
        },
        {
          identityKey: 'a::b',
          partNumber: 'B',
          manufacturer: 'A',
          description: 'test',
          quantity: 1,
          unitPrice: '0.05',
          supplier: 'DigiKey',
          referenceDesignators: ['R2'],
          family: '',
          mountingType: '',
          packageType: '',
        },
      ];
      const result = schematicBomBridge.aggregateQuantities(drafts);
      expect(result[0].unitPrice).toBe('0.05');
      expect(result[0].supplier).toBe('DigiKey');
    });

    it('aggregates three or more drafts correctly', () => {
      const base: BomEntryDraft = {
        identityKey: 'x::y',
        partNumber: 'Y',
        manufacturer: 'X',
        description: 'test',
        quantity: 1,
        unitPrice: '0.10',
        supplier: '',
        referenceDesignators: [],
        family: '',
        mountingType: '',
        packageType: '',
      };
      const drafts = [
        { ...base, referenceDesignators: ['R1'] },
        { ...base, referenceDesignators: ['R2'] },
        { ...base, referenceDesignators: ['R3'] },
        { ...base, referenceDesignators: ['R4'] },
      ];
      const result = schematicBomBridge.aggregateQuantities(drafts);
      expect(result).toHaveLength(1);
      expect(result[0].quantity).toBe(4);
      expect(result[0].referenceDesignators).toEqual(['R1', 'R2', 'R3', 'R4']);
    });
  });

  // =========================================================================
  // detectDuplicates
  // =========================================================================

  describe('detectDuplicates', () => {
    it('detects exact part number match', () => {
      const draft: BomEntryDraft = {
        identityKey: 'yageo::rc0805fr-0710kl',
        partNumber: 'RC0805FR-0710KL',
        manufacturer: 'Yageo',
        description: '10k Resistor',
        quantity: 3,
        unitPrice: '0.01',
        supplier: '',
        referenceDesignators: ['R1', 'R2', 'R3'],
        family: 'resistor',
        mountingType: 'smd',
        packageType: '0805',
      };
      const bom = makeBomItem({ quantity: 5 });
      const matches = schematicBomBridge.detectDuplicates([draft], [bom]);
      expect(matches).toHaveLength(1);
      expect(matches[0].matchType).toBe('exact_part_number');
      // existing qty 5 >= draft qty 3 → skip
      expect(matches[0].suggestion).toBe('skip');
    });

    it('suggests update_quantity when existing qty is less than draft qty', () => {
      const draft: BomEntryDraft = {
        identityKey: 'yageo::rc0805fr-0710kl',
        partNumber: 'RC0805FR-0710KL',
        manufacturer: 'Yageo',
        description: '10k Resistor',
        quantity: 10,
        unitPrice: '0.01',
        supplier: '',
        referenceDesignators: ['R1'],
        family: 'resistor',
        mountingType: 'smd',
        packageType: '0805',
      };
      const bom = makeBomItem({ quantity: 5 });
      const matches = schematicBomBridge.detectDuplicates([draft], [bom]);
      expect(matches[0].suggestion).toBe('update_quantity');
      expect(matches[0].suggestedQuantity).toBe(15);
    });

    it('detects fuzzy description match', () => {
      const draft: BomEntryDraft = {
        identityKey: '::custom-led',
        partNumber: '',
        manufacturer: '',
        description: 'Red LED 5mm',
        quantity: 2,
        unitPrice: '0',
        supplier: '',
        referenceDesignators: ['D1', 'D2'],
        family: 'led',
        mountingType: '',
        packageType: '',
      };
      const bom = makeBomItem({
        partNumber: 'LED-RED-5MM',
        manufacturer: 'Kingbright',
        description: 'Red LED 5mm Through-Hole',
      });
      const matches = schematicBomBridge.detectDuplicates([draft], [bom]);
      expect(matches).toHaveLength(1);
      expect(matches[0].matchType).toBe('fuzzy_description');
      expect(matches[0].suggestion).toBe('review');
    });

    it('detects same manufacturer + family match', () => {
      const draft: BomEntryDraft = {
        identityKey: 'ti::new-part',
        partNumber: 'NEW-PART',
        manufacturer: 'TI',
        description: 'New Op-Amp',
        quantity: 1,
        unitPrice: '0',
        supplier: '',
        referenceDesignators: ['U1'],
        family: 'opamp',
        mountingType: 'smd',
        packageType: '',
      };
      const bom = makeBomItem({
        partNumber: 'LM358',
        manufacturer: 'TI',
        description: 'Dual OpAmp Low Power',
      });
      const matches = schematicBomBridge.detectDuplicates([draft], [bom]);
      expect(matches).toHaveLength(1);
      expect(matches[0].matchType).toBe('same_manufacturer_family');
      expect(matches[0].suggestion).toBe('review');
    });

    it('returns empty when no duplicates found', () => {
      const draft: BomEntryDraft = {
        identityKey: 'newcorp::new-part',
        partNumber: 'BRAND-NEW',
        manufacturer: 'NewCorp',
        description: 'Brand New Component',
        quantity: 1,
        unitPrice: '0',
        supplier: '',
        referenceDesignators: ['U99'],
        family: 'ic',
        mountingType: '',
        packageType: '',
      };
      const bom = makeBomItem();
      const matches = schematicBomBridge.detectDuplicates([draft], [bom]);
      expect(matches).toEqual([]);
    });

    it('handles empty BOM list', () => {
      const draft: BomEntryDraft = {
        identityKey: 'a::b',
        partNumber: 'B',
        manufacturer: 'A',
        description: 'test',
        quantity: 1,
        unitPrice: '0',
        supplier: '',
        referenceDesignators: ['R1'],
        family: '',
        mountingType: '',
        packageType: '',
      };
      expect(schematicBomBridge.detectDuplicates([draft], [])).toEqual([]);
    });

    it('handles empty drafts list', () => {
      expect(schematicBomBridge.detectDuplicates([], [makeBomItem()])).toEqual([]);
    });

    it('is case-insensitive for part number matching', () => {
      const draft: BomEntryDraft = {
        identityKey: 'yageo::rc0805fr-0710kl',
        partNumber: 'rc0805fr-0710kl', // lowercase
        manufacturer: 'Yageo',
        description: 'test',
        quantity: 1,
        unitPrice: '0',
        supplier: '',
        referenceDesignators: ['R1'],
        family: '',
        mountingType: '',
        packageType: '',
      };
      const bom = makeBomItem({ partNumber: 'RC0805FR-0710KL' }); // uppercase
      const matches = schematicBomBridge.detectDuplicates([draft], [bom]);
      expect(matches).toHaveLength(1);
      expect(matches[0].matchType).toBe('exact_part_number');
    });

    it('skips fuzzy match for very short descriptions', () => {
      const draft: BomEntryDraft = {
        identityKey: '::ab',
        partNumber: '',
        manufacturer: '',
        description: 'AB', // too short (< 3 after normalization)
        quantity: 1,
        unitPrice: '0',
        supplier: '',
        referenceDesignators: ['X1'],
        family: '',
        mountingType: '',
        packageType: '',
      };
      const bom = makeBomItem({ partNumber: 'DIFFERENT', description: 'AB something' });
      const matches = schematicBomBridge.detectDuplicates([draft], [bom]);
      expect(matches).toEqual([]);
    });
  });

  // =========================================================================
  // generateSyncPlan
  // =========================================================================

  describe('generateSyncPlan', () => {
    it('generates a plan with adds for new components', () => {
      const instances = [
        makeInstance({ id: 1, partId: 100, referenceDesignator: 'R1' }),
        makeInstance({ id: 2, partId: 100, referenceDesignator: 'R2' }),
      ];
      const partsById = new Map([[100, makePart({ id: 100 })]]);
      const plan = schematicBomBridge.generateSyncPlan(instances, partsById, []);
      expect(plan.addCount).toBe(1);
      expect(plan.updateCount).toBe(0);
      expect(plan.skipCount).toBe(0);
      expect(plan.unmapped).toEqual([]);
      const addAction = plan.actions.find((a) => a.type === 'add');
      expect(addAction).toBeDefined();
      if (addAction?.type === 'add') {
        expect(addAction.draft.quantity).toBe(2);
        expect(addAction.draft.referenceDesignators).toEqual(['R1', 'R2']);
      }
    });

    it('generates a plan with update_quantity for existing BOM entries', () => {
      const instances = [
        makeInstance({ id: 1, partId: 100, referenceDesignator: 'R1' }),
        makeInstance({ id: 2, partId: 100, referenceDesignator: 'R2' }),
        makeInstance({ id: 3, partId: 100, referenceDesignator: 'R3' }),
        makeInstance({ id: 4, partId: 100, referenceDesignator: 'R4' }),
        makeInstance({ id: 5, partId: 100, referenceDesignator: 'R5' }),
        makeInstance({ id: 6, partId: 100, referenceDesignator: 'R6' }),
      ];
      const partsById = new Map([[100, makePart({ id: 100 })]]);
      const existingBom = [makeBomItem({ quantity: 3 })];
      const plan = schematicBomBridge.generateSyncPlan(instances, partsById, existingBom);
      expect(plan.updateCount).toBe(1);
      const updateAction = plan.actions.find((a) => a.type === 'update_quantity');
      expect(updateAction).toBeDefined();
      if (updateAction?.type === 'update_quantity') {
        expect(updateAction.newQuantity).toBe(9); // 3 existing + 6 from schematic
      }
    });

    it('generates skip actions when BOM already has enough quantity', () => {
      const instances = [
        makeInstance({ id: 1, partId: 100, referenceDesignator: 'R1' }),
      ];
      const partsById = new Map([[100, makePart({ id: 100 })]]);
      const existingBom = [makeBomItem({ quantity: 5 })];
      const plan = schematicBomBridge.generateSyncPlan(instances, partsById, existingBom);
      expect(plan.skipCount).toBe(1);
      expect(plan.addCount).toBe(0);
    });

    it('separates unmapped from mappable instances', () => {
      const instances = [
        makeInstance({ id: 1, partId: 100, referenceDesignator: 'R1' }),
        makeInstance({ id: 2, partId: null, referenceDesignator: 'U1' }),
      ];
      const partsById = new Map([[100, makePart({ id: 100 })]]);
      const plan = schematicBomBridge.generateSyncPlan(instances, partsById, []);
      expect(plan.unmapped).toHaveLength(1);
      expect(plan.unmapped[0].referenceDesignator).toBe('U1');
      expect(plan.addCount).toBe(1);
    });

    it('handles empty instances list', () => {
      const plan = schematicBomBridge.generateSyncPlan([], new Map(), []);
      expect(plan.actions).toEqual([]);
      expect(plan.unmapped).toEqual([]);
      expect(plan.addCount).toBe(0);
      expect(plan.updateCount).toBe(0);
      expect(plan.skipCount).toBe(0);
    });

    it('handles all instances being unmapped', () => {
      const instances = [
        makeInstance({ id: 1, partId: null, referenceDesignator: 'R1' }),
        makeInstance({ id: 2, partId: null, referenceDesignator: 'C1' }),
      ];
      const plan = schematicBomBridge.generateSyncPlan(instances, new Map(), []);
      expect(plan.unmapped).toHaveLength(2);
      expect(plan.actions).toEqual([]);
    });

    it('aggregates across multiple instances of the same part', () => {
      const part200 = makePart({
        id: 200,
        meta: {
          title: '100nF Cap',
          family: 'capacitor',
          manufacturer: 'Murata',
          mpn: 'GRM155R71C104KA88D',
          description: '100nF 16V 0402 MLCC',
          tags: [],
          mountingType: 'smd',
          packageType: '0402',
          properties: [],
        },
      });
      const instances = [
        makeInstance({ id: 1, partId: 100, referenceDesignator: 'R1' }),
        makeInstance({ id: 2, partId: 100, referenceDesignator: 'R2' }),
        makeInstance({ id: 3, partId: 200, referenceDesignator: 'C1' }),
        makeInstance({ id: 4, partId: 200, referenceDesignator: 'C2' }),
        makeInstance({ id: 5, partId: 200, referenceDesignator: 'C3' }),
      ];
      const partsById = new Map([
        [100, makePart({ id: 100 })],
        [200, part200],
      ]);
      const plan = schematicBomBridge.generateSyncPlan(instances, partsById, []);
      expect(plan.addCount).toBe(2);
      const addActions = plan.actions.filter((a) => a.type === 'add');
      expect(addActions).toHaveLength(2);
    });

    it('stores lastPlan after generation', () => {
      expect(schematicBomBridge.lastPlan).toBeNull();
      const plan = schematicBomBridge.generateSyncPlan([], new Map(), []);
      expect(schematicBomBridge.lastPlan).toBe(plan);
    });

    it('increments version after generating plan', () => {
      const v0 = schematicBomBridge.version;
      schematicBomBridge.generateSyncPlan([], new Map(), []);
      expect(schematicBomBridge.version).toBe(v0 + 1);
    });
  });

  // =========================================================================
  // subscribe / notify
  // =========================================================================

  describe('subscribe', () => {
    it('notifies listeners when plan is generated', () => {
      let callCount = 0;
      const unsub = schematicBomBridge.subscribe(() => { callCount++; });
      schematicBomBridge.generateSyncPlan([], new Map(), []);
      expect(callCount).toBe(1);
      unsub();
    });

    it('stops notifying after unsubscribe', () => {
      let callCount = 0;
      const unsub = schematicBomBridge.subscribe(() => { callCount++; });
      schematicBomBridge.generateSyncPlan([], new Map(), []);
      unsub();
      schematicBomBridge.generateSyncPlan([], new Map(), []);
      expect(callCount).toBe(1);
    });

    it('notifies on reset', () => {
      let callCount = 0;
      const unsub = schematicBomBridge.subscribe(() => { callCount++; });
      schematicBomBridge.reset();
      expect(callCount).toBe(1);
      unsub();
    });

    it('supports multiple listeners', () => {
      let count1 = 0;
      let count2 = 0;
      const unsub1 = schematicBomBridge.subscribe(() => { count1++; });
      const unsub2 = schematicBomBridge.subscribe(() => { count2++; });
      schematicBomBridge.generateSyncPlan([], new Map(), []);
      expect(count1).toBe(1);
      expect(count2).toBe(1);
      unsub1();
      unsub2();
    });
  });

  // =========================================================================
  // reset / getSnapshot
  // =========================================================================

  describe('reset', () => {
    it('clears lastPlan', () => {
      schematicBomBridge.generateSyncPlan([], new Map(), []);
      expect(schematicBomBridge.lastPlan).not.toBeNull();
      schematicBomBridge.reset();
      expect(schematicBomBridge.lastPlan).toBeNull();
    });

    it('increments version', () => {
      const v = schematicBomBridge.version;
      schematicBomBridge.reset();
      expect(schematicBomBridge.version).toBe(v + 1);
    });
  });

  describe('getSnapshot', () => {
    it('returns current version', () => {
      const v = schematicBomBridge.version;
      expect(schematicBomBridge.getSnapshot()).toBe(v);
    });
  });
});
