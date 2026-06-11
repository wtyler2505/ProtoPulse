import { describe, expect, it } from 'vitest';
import {
  buildLiveArchitectureMigrationPlan,
  evaluateLiveV3Readiness,
  evaluateV3MetadataRules,
  extractLiveArchitectureBoundaries,
  extractV3BoundaryObjectsFromShapes,
  migrateLiveArchitectureToV3Shapes,
} from '@/lib/v3-architecture-live';
import type { GraphEdge, GraphNode } from '@/lib/graph-types';

const nodes: GraphNode[] = [
  {
    id: 'mega-2560',
    type: 'custom',
    position: { x: 120, y: 160 },
    data: { label: 'Arduino Mega 2560', type: 'controller', partNumber: 'Arduino Mega 2560 R3' },
  },
  {
    id: 'power-5v',
    type: 'custom',
    position: { x: 120, y: 40 },
    data: { label: '5V Rail', type: 'power', voltage: '5V' },
  },
];

const edges: GraphEdge[] = [
  {
    id: 'usb-d-plus',
    source: 'mega-2560',
    target: 'power-5v',
    label: 'USB D+',
    data: { netName: 'net.USB_DP', signalType: 'USB' },
  },
];

describe('v3 live architecture bridge', () => {
  it('migrates live graph nodes and edges into tldraw-style v3 shapes', () => {
    const shapes = migrateLiveArchitectureToV3Shapes(nodes, edges);

    expect(shapes).toHaveLength(3);
    expect(shapes[0].meta.protopulse.provenance).toContain('live-architecture-node:mega-2560');
    expect(shapes[1].meta.protopulse.kind).toBe('power');
    expect(shapes[2].meta.protopulse.kind).toBe('signal');
  });

  it('reports ready when the live graph has hardware and signal boundaries', () => {
    const readiness = evaluateLiveV3Readiness(nodes, edges);

    expect(readiness.status).toBe('ready');
    expect(readiness.tldrawShapeCount).toBe(3);
    expect(readiness.boundaryObjectCount).toBe(3);
    expect(readiness.boundaryKinds).toEqual(['hardware', 'power', 'signal']);
    expect(readiness.missingBoundaryKinds).toEqual(['firmware', 'mechanical']);
    expect(readiness.metadataRules.find((rule) => rule.kind === 'hardware')?.status).toBe('satisfied');
    expect(readiness.metadataRules.find((rule) => rule.kind === 'power')?.status).toBe('satisfied');
    expect(readiness.metadataRules.find((rule) => rule.kind === 'signal')?.status).toBe('satisfied');
    expect(readiness.metadataRules.find((rule) => rule.kind === 'firmware')?.status).toBe('missing');
    expect(readiness.migrationPlan.source).toBe('xyflow');
    expect(readiness.migrationPlan.target).toBe('tldraw-boundaries');
    expect(readiness.blockedReasons).toEqual([]);
  });

  it('extracts typed boundary objects from tldraw-style shape metadata', () => {
    const shapes = migrateLiveArchitectureToV3Shapes(nodes, edges);
    const boundaries = extractV3BoundaryObjectsFromShapes(shapes);

    expect(boundaries).toHaveLength(3);
    expect(boundaries[0]).toEqual(expect.objectContaining({
      id: 'mega-2560',
      shapeId: 'shape:mega-2560',
      kind: 'hardware',
      label: 'Arduino Mega 2560',
      provenance: ['live-architecture-node:mega-2560'],
    }));
    expect(boundaries[2]).toEqual(expect.objectContaining({
      id: 'usb-d-plus',
      kind: 'signal',
      sourceBoundaryId: 'mega-2560',
      targetBoundaryId: 'power-5v',
    }));
  });

  it('extracts live architecture boundaries in one step for downstream compilers', () => {
    const boundaries = extractLiveArchitectureBoundaries(nodes, edges);

    expect(boundaries.map((boundary) => boundary.kind)).toEqual(['hardware', 'power', 'signal']);
    expect(boundaries[2].metadata).toEqual(expect.objectContaining({ net: 'net.USB_DP' }));
  });

  it('builds a concrete xyflow-to-tldraw migration plan', () => {
    const boundaries = extractLiveArchitectureBoundaries(nodes, edges);
    const plan = buildLiveArchitectureMigrationPlan(nodes, edges, boundaries);

    expect(plan.steps.map((step) => step.id)).toEqual([
      'capture-live-graph',
      'create-tldraw-shapes',
      'validate-boundaries',
      'compile-v3',
      'feature-flag-launch',
    ]);
    expect(plan.steps[0]).toEqual(expect.objectContaining({ status: 'done' }));
    expect(plan.steps[2]).toEqual(expect.objectContaining({ status: 'done' }));
    expect(plan.steps[3]).toEqual(expect.objectContaining({ status: 'pending' }));
  });

  it('marks present boundaries incomplete when required metadata is missing', () => {
    const rules = evaluateV3MetadataRules([
      {
        id: 'fw',
        shapeId: 'shape:fw',
        kind: 'firmware',
        label: 'Firmware',
        x: 0,
        y: 0,
        provenance: ['test'],
        metadata: {},
      },
      {
        id: 'sig',
        shapeId: 'shape:sig',
        kind: 'signal',
        label: 'Signal',
        x: 0,
        y: 0,
        sourceBoundaryId: 'a',
        targetBoundaryId: 'b',
        provenance: ['test'],
        metadata: {},
      },
    ]);

    expect(rules.find((rule) => rule.kind === 'firmware')).toEqual(expect.objectContaining({
      status: 'incomplete',
      requiredFields: ['board', 'behavior'],
    }));
    expect(rules.find((rule) => rule.kind === 'signal')).toEqual(expect.objectContaining({
      status: 'incomplete',
      requiredFields: ['source', 'target', 'net'],
    }));
  });

  it('reports blockers for empty architecture graphs', () => {
    const readiness = evaluateLiveV3Readiness([], []);

    expect(readiness.status).toBe('blocked');
    expect(readiness.blockedReasons).toContain('add architecture nodes before v3 migration');
    expect(readiness.blockedReasons).toContain('add at least one architecture connection before compile checks');
  });

  it('keeps sparse live nodes safe during migration', () => {
    const shapes = migrateLiveArchitectureToV3Shapes([
      { id: 'unnamed-node', type: 'custom', position: { x: 0, y: 0 } } as GraphNode,
    ], []);

    expect(shapes[0].props.text).toBe('unnamed-node');
    expect(shapes[0].meta.protopulse.metadata).toEqual({ nodeType: 'hardware' });
  });

  it('classifies firmware and mechanical metadata rules', () => {
    const shapes = migrateLiveArchitectureToV3Shapes([
      { id: 'fw', type: 'custom', position: { x: 0, y: 0 }, data: { type: 'firmware' } },
      { id: 'chassis', type: 'custom', position: { x: 0, y: 0 }, data: { type: 'mechanical chassis' } },
    ], []);

    expect(shapes.map((shape) => shape.meta.protopulse.kind)).toEqual(['firmware', 'mechanical']);
  });
});
