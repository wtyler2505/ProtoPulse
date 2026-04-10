import { describe, expect, it } from 'vitest';

import { buildBreadboardSelectedPartModel } from '@/lib/breadboard-part-inspector';
import type { BreadboardBenchInsight } from '@/lib/breadboard-bench';
import type { ComponentPart, CircuitInstanceRow } from '@shared/schema';

const exactPart = {
  id: 17,
  projectId: 1,
  nodeId: null,
  meta: {
    title: 'ATmega328P DIP',
    family: 'mcu',
    manufacturer: 'Microchip',
    mpn: 'ATMEGA328P-PU',
    mountingType: 'tht',
    packageType: 'DIP-28',
    properties: [],
    tags: ['microcontroller'],
    type: 'mcu',
    breadboardFit: 'native',
    breadboardModelQuality: 'verified',
  },
  connectors: Array.from({ length: 4 }, (_, index) => ({
    id: `pin-${String(index + 1)}`,
    name: ['PB0', 'GND', 'VCC', 'RESET'][index] ?? `PB${String(index)}`,
    description: ['GPIO 0', 'Ground return', 'Main supply', 'Reset control'][index] ?? `GPIO ${String(index)}`,
    connectorType: 'pad',
    shapeIds: {},
    terminalPositions: {
      breadboard: {
        x: index < 2 ? 0 : 30,
        y: index % 2 === 0 ? 0 : 10,
      },
    },
  })),
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

function makeInstance(overrides: Partial<CircuitInstanceRow> = {}): CircuitInstanceRow {
  return {
    id: 4,
    circuitId: 1,
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
    ...overrides,
  } as CircuitInstanceRow;
}

const placedInstance = makeInstance();

const insight = {
  partId: 17,
  bomItemId: 'bom-1',
  title: 'ATmega328P DIP',
  family: 'mcu',
  benchCategory: 'Microcontrollers',
  pinCount: 4,
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
  mpn: 'ATMEGA328P-PU',
} satisfies BreadboardBenchInsight;

describe('buildBreadboardSelectedPartModel', () => {
  it('builds an exact connector-backed pin map when breadboard connector positions exist', () => {
    const result = buildBreadboardSelectedPartModel(placedInstance, exactPart, insight);

    expect(result).not.toBeNull();
    expect(result?.pinMapConfidence).toBe('exact');
    expect(result?.pins[0]).toMatchObject({
      label: 'PB0',
      coordLabel: 'e1',
      confidence: 'exact',
      source: 'connector',
    });
    expect(result?.pins[2]).toMatchObject({
      coordLabel: 'f1',
      confidence: 'exact',
    });
    expect(result?.pins[1]).toMatchObject({
      role: 'ground',
      isCritical: true,
    });
    expect(result?.pins[2]).toMatchObject({
      role: 'power',
      isCritical: true,
    });
    expect(result?.exactPinCount).toBe(4);
    expect(result?.heuristicPinCount).toBe(0);
    expect(result?.criticalPinCount).toBe(3);
    expect(result?.coach.supportParts).toContain('100 nF decoupling capacitor');
    expect(result?.coach.nextMoves.join(' ')).toContain('power and ground');
    expect(result?.inventorySummary).toContain('build-ready');
  });

  it('falls back to heuristic bench mapping when no connector positions exist', () => {
    const heuristicPart = {
      ...exactPart,
      connectors: exactPart.connectors.map((connector) => ({
        ...connector,
        terminalPositions: {},
      })),
    } satisfies ComponentPart;

    const result = buildBreadboardSelectedPartModel(placedInstance, heuristicPart, insight);

    expect(result).not.toBeNull();
    expect(result?.pinMapConfidence).toBe('heuristic');
    expect(result?.pins[0]).toMatchObject({
      coordLabel: 'e1',
      confidence: 'heuristic',
      source: 'layout',
    });
    expect(result?.heuristicPinCount).toBe(4);
    expect(result?.coach.cautions.join(' ')).toContain('inferred');
  });

  it('falls back to heuristic bench mapping when connector pixels do not land on tie-points', () => {
    const offGridPart = {
      ...exactPart,
      connectors: exactPart.connectors.map((connector, index) => ({
        ...connector,
        terminalPositions: {
          breadboard: {
            x: index < 2 ? 20 : 180,
            y: 35 + index * 70,
          },
        },
      })),
    } satisfies ComponentPart;

    const result = buildBreadboardSelectedPartModel(placedInstance, offGridPart, insight);

    expect(result).not.toBeNull();
    expect(result?.pinMapConfidence).toBe('heuristic');
    expect(result?.exactPinCount).toBe(0);
    expect(result?.heuristicPinCount).toBe(4);
    expect(result?.pins.every((pin) => pin.coord != null)).toBe(true);
    expect(result?.pins.some((pin) => pin.coordLabel === 'Unmapped')).toBe(false);
  });

  it('blocks authoritative wiring for candidate board modules until they are verified', () => {
    const boardModulePart = {
      ...exactPart,
      meta: {
        ...exactPart.meta,
        title: 'Arduino Mega 2560 R3',
        tags: ['arduino', 'module'],
        partFamily: 'board-module',
        verificationStatus: 'candidate',
        verificationLevel: 'mixed-source',
      },
    } satisfies ComponentPart;

    const result = buildBreadboardSelectedPartModel(placedInstance, boardModulePart, insight);

    expect(result).not.toBeNull();
    expect(result?.requiresVerification).toBe(true);
    expect(result?.authoritativeWiringAllowed).toBe(false);
    expect(result?.verificationStatus).toBe('candidate');
    expect(result?.trustSummary).toContain('authoritative wiring');
  });
});
