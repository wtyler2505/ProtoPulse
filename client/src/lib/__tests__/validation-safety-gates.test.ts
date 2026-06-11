import { describe, expect, it } from 'vitest';
import { buildValidationSafetyGateData } from '@/lib/validation-safety-gates';
import type { BomItem } from '@/lib/project-context';
import type { CircuitInstanceRow, ComponentPart } from '@shared/schema';

function circuitInstance(overrides: Partial<CircuitInstanceRow>): CircuitInstanceRow {
  return {
    id: 1,
    circuitId: 1,
    partId: null,
    subDesignId: null,
    referenceDesignator: 'U1',
    schematicX: 0,
    schematicY: 0,
    schematicRotation: 0,
    breadboardX: null,
    breadboardY: null,
    breadboardRotation: 0,
    benchX: null,
    benchY: null,
    pcbX: null,
    pcbY: null,
    pcbRotation: 0,
    pcbSide: 'front',
    properties: {},
    createdAt: new Date('2026-05-24T00:00:00.000Z'),
    ...overrides,
  };
}

function componentPart(overrides: Partial<ComponentPart>): ComponentPart {
  return {
    id: 1,
    projectId: 1,
    nodeId: null,
    meta: {},
    connectors: [],
    buses: [],
    views: {},
    constraints: [],
    version: 1,
    createdAt: new Date('2026-05-24T00:00:00.000Z'),
    updatedAt: new Date('2026-05-24T00:00:00.000Z'),
    ...overrides,
  };
}

function bomItem(overrides: Partial<BomItem>): BomItem {
  return {
    id: 'bom-1',
    partNumber: 'PP-001',
    manufacturer: 'ProtoPulse',
    description: 'Test part',
    quantity: 1,
    unitPrice: 0,
    totalPrice: 0,
    supplier: 'Unknown',
    stock: 0,
    status: 'In Stock',
    ...overrides,
  };
}

describe('buildValidationSafetyGateData', () => {
  it('counts unverified AI-generated instances and linked red breadboard health', () => {
    const result = buildValidationSafetyGateData({
      circuitInstances: [
        circuitInstance({
          id: 10,
          partId: 7,
          pcbX: 12,
          pcbY: 24,
          properties: { generatedFrom: 'generative-design' },
        }),
      ],
      componentParts: [
        componentPart({
          id: 7,
          meta: {
            verificationStatus: 'candidate',
            breadboardHealth: { status: 'red' },
          },
        }),
      ],
      bomItems: [],
    });

    expect(result.aiGeneratedCircuitInstanceCount).toBe(1);
    expect(result.unverifiedAiGeneratedCircuitInstanceCount).toBe(1);
    expect(result.placedPartCount).toBe(1);
    expect(result.verifiedExactPartCount).toBe(0);
    expect(result.redBreadboardHealthCount).toBe(1);
  });

  it('counts verified exact parts and verified mechanical models', () => {
    const result = buildValidationSafetyGateData({
      circuitInstances: [
        circuitInstance({
          id: 20,
          partId: 8,
          pcbX: 5,
          pcbY: 6,
          properties: {
            aiGenerated: true,
            exactPartTrust: { status: 'verified' },
          },
        }),
      ],
      componentParts: [
        componentPart({
          id: 8,
          meta: {
            verificationStatus: 'verified',
            mechanicalModelQuality: 'verified',
          },
        }),
      ],
      bomItems: [],
    });

    expect(result.aiGeneratedCircuitInstanceCount).toBe(1);
    expect(result.unverifiedAiGeneratedCircuitInstanceCount).toBe(0);
    expect(result.verifiedExactPartCount).toBe(1);
    expect(result.verifiedMechanicalModelCount).toBe(1);
  });

  it('counts lifecycle blockers and ignores stock status as lifecycle', () => {
    const result = buildValidationSafetyGateData({
      circuitInstances: [
        circuitInstance({ id: 30, partId: 9, pcbX: 1, pcbY: 2 }),
        circuitInstance({ id: 31, partId: 10, pcbX: 3, pcbY: 4 }),
      ],
      componentParts: [
        componentPart({ id: 9, meta: { lifecycleStatus: 'EOL' } }),
        componentPart({ id: 10, meta: { lifecycleStatus: 'obsolete', replacementPartNumber: 'PP-ALT' } }),
      ],
      bomItems: [
        bomItem({ id: 'stock-only', status: 'Out of Stock' }),
        bomItem({ id: 'nrnd-line', partNumber: 'PP-NRND', lifecycleStatus: 'nrnd' } as Partial<BomItem>),
      ],
    });

    expect(result.eolPartCount).toBe(1);
    expect(result.obsoletePartCount).toBe(1);
    expect(result.nrndPartCount).toBe(1);
    expect(result.lifecycleNoAlternateCount).toBe(1);
  });

  it('counts estimated inventory confidence from unverified trust metadata', () => {
    const result = buildValidationSafetyGateData({
      circuitInstances: [],
      componentParts: [],
      bomItems: [
        bomItem({
          id: 'estimated-price',
          pricingTrust: {
            verified: false,
            value: 0,
            source: 'historical_estimate',
            isMock: true,
          },
        }),
        bomItem({
          id: 'live-price',
          pricingTrust: {
            verified: true,
            value: 2.5,
            source: 'live_supplier_api',
          },
        }),
      ],
    });

    expect(result.estimatedInventoryLineCount).toBe(1);
  });
});
