import { describe, expect, it } from 'vitest';

import { buildBreadboardCoachPlan } from '@/lib/breadboard-coach-plan';
import { buildBreadboardSelectedPartModel } from '@/lib/breadboard-part-inspector';
import type { BreadboardBenchInsight } from '@/lib/breadboard-bench';
import type { CircuitInstanceRow, ComponentPart } from '@shared/schema';

const part = {
  id: 17,
  projectId: 1,
  nodeId: null,
  meta: {
    title: 'ATtiny85',
    family: 'mcu',
    manufacturer: 'Microchip',
    mpn: 'ATTINY85-20PU',
    mountingType: 'tht',
    packageType: 'DIP-8',
    properties: [],
    tags: ['microcontroller'],
    type: 'mcu',
    breadboardFit: 'native',
    breadboardModelQuality: 'verified',
  },
  connectors: [
    {
      id: 'pin1',
      name: 'RESET',
      description: 'Reset control',
      connectorType: 'pad',
      shapeIds: {},
      terminalPositions: { breadboard: { x: 0, y: 0 } },
    },
    {
      id: 'pin2',
      name: 'PB3',
      description: 'GPIO',
      connectorType: 'pad',
      shapeIds: {},
      terminalPositions: { breadboard: { x: 0, y: 10 } },
    },
    {
      id: 'pin3',
      name: 'GND',
      description: 'Ground return',
      connectorType: 'pad',
      shapeIds: {},
      terminalPositions: { breadboard: { x: 0, y: 20 } },
    },
    {
      id: 'pin4',
      name: 'PB4',
      description: 'GPIO',
      connectorType: 'pad',
      shapeIds: {},
      terminalPositions: { breadboard: { x: 0, y: 30 } },
    },
    {
      id: 'pin5',
      name: 'PB0',
      description: 'MOSI',
      connectorType: 'pad',
      shapeIds: {},
      terminalPositions: { breadboard: { x: 30, y: 30 } },
    },
    {
      id: 'pin6',
      name: 'PB1',
      description: 'MISO',
      connectorType: 'pad',
      shapeIds: {},
      terminalPositions: { breadboard: { x: 30, y: 20 } },
    },
    {
      id: 'pin7',
      name: 'PB2',
      description: 'Clock line',
      connectorType: 'pad',
      shapeIds: {},
      terminalPositions: { breadboard: { x: 30, y: 10 } },
    },
    {
      id: 'pin8',
      name: 'VCC',
      description: 'Main supply',
      connectorType: 'pad',
      shapeIds: {},
      terminalPositions: { breadboard: { x: 30, y: 0 } },
    },
  ],
  buses: [],
  views: {
    breadboard: { shapes: [{ type: 'rect' }] },
    schematic: { shapes: [] },
    pcb: { shapes: [] },
  },
  constraints: null,
  version: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
} satisfies ComponentPart;

const insight = {
  partId: 17,
  bomItemId: 'bom-1',
  title: 'ATtiny85',
  family: 'mcu',
  benchCategory: 'Microcontrollers',
  pinCount: 8,
  fit: 'native',
  modelQuality: 'verified',
  hasPreciseArtwork: true,
  isTracked: true,
  isOwned: true,
  ownedQuantity: 2,
  requiredQuantity: 1,
  missingQuantity: 0,
  storageLocation: 'Bench Drawer C3',
  lowStock: false,
  readyNow: true,
  starterFriendly: true,
  manufacturer: 'Microchip',
  mpn: 'ATTINY85-20PU',
} satisfies BreadboardBenchInsight;

const instance = {
  id: 9,
  circuitId: 2,
  partId: 17,
  subDesignId: null,
  referenceDesignator: 'U1',
  schematicX: 0,
  schematicY: 0,
  schematicRotation: 0,
  breadboardX: 70,
  breadboardY: 50,
  breadboardRotation: 0,
  pcbX: null,
  pcbY: null,
  pcbRotation: 0,
  pcbSide: 'front',
  benchX: null,
  benchY: null,
  properties: { type: 'mcu' },
  createdAt: new Date(),
} as CircuitInstanceRow;

describe('buildBreadboardCoachPlan', () => {
  it('creates support suggestions and corridor hints for a bench-ready microcontroller', () => {
    const selected = buildBreadboardSelectedPartModel(instance, part, insight);
    expect(selected).not.toBeNull();

    const plan = buildBreadboardCoachPlan(selected!);

    expect(plan.bridges).toHaveLength(2);
    expect(plan.bridges[0]).toMatchObject({
      id: 'bridge-power-rails',
      netName: 'VCC',
      netType: 'power',
    });
    expect(plan.bridges[1]).toMatchObject({
      id: 'bridge-ground-rails',
      netName: 'GND',
      netType: 'ground',
    });
    expect(plan.hookups).toHaveLength(2);
    expect(plan.hookups[0]).toMatchObject({
      id: 'hookup-power-pin8',
      netName: 'VCC',
      netType: 'power',
    });
    expect(plan.hookups[1]).toMatchObject({
      id: 'hookup-ground-pin3',
      netName: 'GND',
      netType: 'ground',
    });
    expect(plan.suggestions).toHaveLength(2);
    expect(plan.suggestions[0]).toMatchObject({
      id: 'support-decoupler',
      type: 'capacitor',
      label: '100 nF decoupler',
      priority: 'critical',
    });
    expect(plan.suggestions[1]).toMatchObject({
      id: 'support-control-pull',
      type: 'resistor',
      label: '10 kΩ pull resistor',
    });
    expect(plan.highlightedPinIds).toContain('pin8');
    expect(plan.highlightedPinIds).toContain('pin3');
    expect(plan.corridorHints.map((hint) => hint.id)).toContain('power-corridor');
    expect(plan.corridorHints.map((hint) => hint.id)).toContain('control-corridor');
    expect(plan.corridorHints.map((hint) => hint.id)).toContain('comm-corridor');
  });

  it('decoupling suggestion includes remediation with place-component action', () => {
    const selected = buildBreadboardSelectedPartModel(instance, part, insight);
    expect(selected).not.toBeNull();

    const plan = buildBreadboardCoachPlan(selected!);
    const decoupSuggestion = plan.suggestions.find((s) => s.type === 'capacitor');
    expect(decoupSuggestion).toBeDefined();
    expect(decoupSuggestion!.remediation).toBeDefined();
    expect(decoupSuggestion!.remediation!.action).toBe('place-component');
    expect(decoupSuggestion!.remediation!.componentType).toBe('capacitor');
    expect(decoupSuggestion!.remediation!.componentValue).toBe('100nF');
    expect(decoupSuggestion!.remediation!.coords).toBeDefined();
  });

  it('pull resistor suggestion includes remediation with place-component action', () => {
    const selected = buildBreadboardSelectedPartModel(instance, part, insight);
    expect(selected).not.toBeNull();

    const plan = buildBreadboardCoachPlan(selected!);
    const pullSuggestion = plan.suggestions.find((s) => s.type === 'resistor');
    expect(pullSuggestion).toBeDefined();
    expect(pullSuggestion!.remediation).toBeDefined();
    expect(pullSuggestion!.remediation!.action).toBe('place-component');
    expect(pullSuggestion!.remediation!.componentType).toBe('resistor');
    expect(pullSuggestion!.remediation!.componentValue).toBe('10kΩ');
  });

  it('remediation coords have col and row fields', () => {
    const selected = buildBreadboardSelectedPartModel(instance, part, insight);
    expect(selected).not.toBeNull();

    const plan = buildBreadboardCoachPlan(selected!);
    const withRemediation = plan.suggestions.filter((s) => s.remediation?.coords);
    expect(withRemediation.length).toBeGreaterThan(0);
    for (const s of withRemediation) {
      expect(s.remediation!.coords!.col).toEqual(expect.any(String));
      expect(s.remediation!.coords!.row).toEqual(expect.any(Number));
    }
  });

  it('still plans decoupling when connector artwork pixels are off-grid', () => {
    const offGridPart = {
      ...part,
      connectors: part.connectors.map((connector) => ({
        ...connector,
        terminalPositions: {
          breadboard: connector.terminalPositions?.breadboard
            ? {
                x: connector.terminalPositions.breadboard.x + 20,
                y: connector.terminalPositions.breadboard.y + 35,
              }
            : undefined,
        },
      })),
    } satisfies ComponentPart;

    const selected = buildBreadboardSelectedPartModel(instance, offGridPart, insight);
    expect(selected).not.toBeNull();
    expect(selected?.pinMapConfidence).not.toBe('exact');

    const plan = buildBreadboardCoachPlan(selected!);

    expect(plan.suggestions.some((suggestion) => suggestion.id === 'support-decoupler')).toBe(true);
  });
});
