import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { CircuitInstanceRow, CircuitViaRow, CircuitWireRow } from '@shared/schema';
import type { Footprint } from '@/lib/pcb/footprint-library';
import { buildSceneModel, generatePinsFromFootprint, mapInstanceTo3DComponent } from '../buildSceneModel';

const board = {
  width: 100,
  height: 80,
  thickness: 1.6,
  cornerRadius: 2,
};

const renderOptions = {
  boardColor: '#234f1e',
  solderMaskColor: '#176a2f',
  copperColor: '#d09a3a',
  silkscreenColor: '#f7f7f7',
};

function makeInstance(overrides: Partial<CircuitInstanceRow> = {}): CircuitInstanceRow {
  return {
    id: 1,
    circuitId: 1,
    partId: null,
    subDesignId: null,
    referenceDesignator: 'U1',
    schematicX: 5,
    schematicY: 6,
    schematicRotation: 0,
    breadboardX: null,
    breadboardY: null,
    breadboardRotation: 0,
    benchX: null,
    benchY: null,
    pcbX: 24,
    pcbY: 28,
    pcbRotation: 90,
    pcbSide: 'front',
    properties: {},
    createdAt: new Date('2026-06-07T00:00:00Z'),
    ...overrides,
  } as CircuitInstanceRow;
}

function makeWire(overrides: Partial<CircuitWireRow> = {}): CircuitWireRow {
  return {
    id: 7,
    circuitId: 1,
    netId: 2,
    view: 'pcb',
    points: [
      { x: 10, y: 12 },
      { x: 20, y: 22 },
    ],
    layer: 'front',
    width: 0.25,
    color: null,
    wireType: 'trace',
    endpointMeta: null,
    provenance: 'manual',
    createdAt: new Date('2026-06-07T00:00:00Z'),
    ...overrides,
  } as CircuitWireRow;
}

function makeVia(overrides: Partial<CircuitViaRow> = {}): CircuitViaRow {
  return {
    id: 4,
    circuitId: 1,
    netId: 2,
    x: 30,
    y: 34,
    outerDiameter: 0.8,
    drillDiameter: 0.35,
    viaType: 'through',
    layerStart: 'front',
    layerEnd: 'back',
    tented: true,
    createdAt: new Date('2026-06-07T00:00:00Z'),
    ...overrides,
  } as CircuitViaRow;
}

const soicFootprint: Footprint = {
  packageType: 'SOIC-8',
  description: 'Test SOIC-8',
  boundingBox: { x: 0, y: 0, width: 5.2, height: 4.1 },
  courtyard: { x: 0, y: 0, width: 5.8, height: 4.7 },
  mountingType: 'smd',
  pinCount: 2,
  silkscreen: [],
  pads: [
    { number: 1, type: 'smd', shape: 'rect', position: { x: -2, y: -1 }, width: 0.6, height: 1.4, layer: 'front' },
    { number: 2, type: 'smd', shape: 'rect', position: { x: 2, y: -1 }, width: 0.6, height: 1.4, layer: 'front' },
  ],
};

describe('buildSceneModel', () => {
  it('returns an empty but renderable board shell', () => {
    const result = buildSceneModel({
      board,
      instances: [],
      wires: [],
      vias: [],
      renderOptions,
      visibleLayers: ['substrate', 'top-copper'],
    });

    expect(result.scene.board).toEqual(board);
    expect(result.scene.components).toEqual([]);
    expect(result.scene.traces).toEqual([]);
    expect(result.scene.vias).toEqual([]);
    expect(result.scene.layers.some((layer) => layer.type === 'substrate' && layer.visible)).toBe(true);
    expect(result.stats.totalSceneItemCount).toBe(0);
  });

  it('maps placed project instances with deterministic ids, footprint size, package height, side, and pins', () => {
    const result = buildSceneModel({
      board,
      instances: [
        makeInstance({
          id: 42,
          referenceDesignator: 'U42',
          pcbX: 50,
          pcbY: 35,
          pcbRotation: 180,
          pcbSide: 'back',
          properties: { packageType: 'SOIC-8' },
        }),
      ],
      wires: [],
      vias: [],
      renderOptions,
      footprintResolver: () => soicFootprint,
    });

    expect(result.scene.components).toHaveLength(1);
    expect(result.scene.components[0]).toMatchObject({
      id: 'component-42',
      refDes: 'U42',
      package: 'SOIC-8',
      position: { x: 50, y: 35, z: 0 },
      rotation: 180,
      side: 'bottom',
      bodyWidth: 5.2,
      bodyHeight: 4.1,
      bodyDepth: 1.75,
    });
    expect(result.scene.components[0].pins).toEqual([
      { id: 'pin-0', position: { x: -2, y: -1 }, diameter: 1.4, type: 'smd' },
      { id: 'pin-1', position: { x: 2, y: -1 }, diameter: 1.4, type: 'smd' },
    ]);
    expect(result.componentInputs[0]).toMatchObject({ refDes: 'U42', package: 'SOIC-8', bodyDepth: 1.75 });
  });

  it('ignores unplaced instances while preserving traces and vias', () => {
    const result = buildSceneModel({
      board,
      instances: [makeInstance({ pcbX: null, pcbY: null })],
      wires: [makeWire({ id: 9, layer: 'back' }), makeWire({ id: 10, view: 'breadboard' })],
      vias: [makeVia({ id: 11, layerStart: 'inner-1', layerEnd: 'back' })],
      renderOptions,
    });

    expect(result.scene.components).toHaveLength(0);
    expect(result.scene.traces).toEqual([
      {
        id: 'trace-9',
        points: [
          { x: 10, y: 12 },
          { x: 20, y: 22 },
        ],
        width: 0.25,
        layer: 'bottom-copper',
      },
    ]);
    expect(result.scene.vias).toEqual([
      {
        id: 'via-11',
        position: { x: 30, y: 34 },
        outerDiameter: 0.8,
        drillDiameter: 0.35,
        startLayer: 'inner-1',
        endLayer: 'back',
      },
    ]);
    expect(result.stats).toMatchObject({ placedComponentCount: 0, traceCount: 1, viaCount: 1, totalSceneItemCount: 2 });
  });

  it('creates an N-layer stack with internal copper entries and real visibility state', () => {
    const result = buildSceneModel({
      board,
      instances: [],
      wires: [],
      vias: [],
      renderOptions,
      layerCount: 4,
      visibleLayers: ['top-copper', 'bottom-copper', 'internal'],
    });

    const internalLayers = result.scene.layers.filter((layer) => layer.type === 'internal');
    expect(internalLayers).toHaveLength(2);
    expect(internalLayers.every((layer) => layer.visible && layer.color === renderOptions.copperColor)).toBe(true);
    expect(result.scene.layers.find((layer) => layer.type === 'substrate')?.visible).toBe(false);
  });

  it('generates deterministic fallback pins when footprint pads are absent', () => {
    expect(generatePinsFromFootprint(null, 5, 5)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'pin-0', type: 'smd', diameter: 1 }),
        expect.objectContaining({ id: 'pin-3', type: 'smd', diameter: 1 }),
      ]),
    );
  });

  it('keeps the pure model transform free of Three.js imports', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '../buildSceneModel.ts'), 'utf8');
    expect(source).not.toMatch(/from ['"]three['"]/);
    expect(source).not.toMatch(/@react-three/);
    expect(mapInstanceTo3DComponent(makeInstance()).id).toBe('component-1');
  });
});
