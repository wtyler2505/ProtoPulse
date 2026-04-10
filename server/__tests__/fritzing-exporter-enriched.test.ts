/**
 * Enriched Fritzing Exporter Tests
 *
 * Tests the expanded generateFritzingProject() function that now produces
 * a complete .fzz archive with wire routing, net connectivity, embedded
 * parts, color data, and proper multi-view coordinates.
 */

import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { generateFritzingProject } from '../export/fritzing-exporter';
import type { CircuitInstanceRow, CircuitNetRow, CircuitWireRow, ComponentPart } from '@shared/schema';
import type { NetSegment } from '@shared/circuit-types';

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

function makeInstance(overrides: Partial<CircuitInstanceRow> = {}): CircuitInstanceRow {
  return {
    id: 1,
    circuitId: 1,
    partId: null,
    referenceDesignator: 'R1',
    breadboardX: 100,
    breadboardY: 200,
    schematicX: 50,
    schematicY: 60,
    rotation: 0,
    properties: null,
    createdAt: new Date(),
    ...(overrides as Record<string, unknown>),
  } as CircuitInstanceRow;
}

function makeNet(overrides: Partial<CircuitNetRow> & { segments?: NetSegment[] } = {}): CircuitNetRow {
  const { segments: segs, ...rest } = overrides;
  return {
    id: 1,
    circuitId: 1,
    name: 'GND',
    netType: 'signal',
    voltage: null,
    busWidth: null,
    segments: segs ?? [],
    labels: null,
    style: null,
    createdAt: new Date(),
    ...(rest as Record<string, unknown>),
  } as CircuitNetRow;
}

function makeWire(overrides: Partial<CircuitWireRow> = {}): CircuitWireRow {
  return {
    id: 1,
    circuitId: 1,
    netId: 1,
    view: 'breadboard',
    points: [
      { x: 100, y: 200 },
      { x: 300, y: 200 },
    ],
    layer: null,
    width: null,
    color: null,
    wireType: 'wire',
    endpointMeta: null,
    provenance: 'manual',
    createdAt: new Date(),
    ...(overrides as Record<string, unknown>),
  } as CircuitWireRow;
}

function makePart(overrides: Partial<ComponentPart> = {}): ComponentPart {
  return {
    id: 1,
    libraryId: null,
    name: 'Resistor',
    category: 'passive',
    description: null,
    connectors: [],
    svgData: null,
    meta: { title: 'Resistor', family: 'resistor' },
    createdAt: new Date(),
    ...(overrides as Record<string, unknown>),
  } as ComponentPart;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('generateFritzingProject — enriched', () => {
  it('returns a valid ZIP buffer with expected files', async () => {
    const result = await generateFritzingProject({
      projectName: 'TestProject',
      instances: [makeInstance({ id: 1 })],
      nets: [],
      parts: [makePart({ id: 1 })],
      wires: [],
    });

    expect(result.filename).toBe('TestProject.fzz');
    expect(result.mimeType).toBe('application/x-fritzing-fz');
    expect(result.encoding).toBe('base64');

    // Decode and verify ZIP contents
    const buf = Buffer.from(result.content, 'base64');
    const zip = await JSZip.loadAsync(buf);
    const fileNames = Object.keys(zip.files);

    // Should have the main .fz file
    expect(fileNames.some((f) => f.endsWith('.fz'))).toBe(true);
  });

  it('includes instance elements with breadboard and schematic geometry', async () => {
    const result = await generateFritzingProject({
      projectName: 'GeoTest',
      instances: [
        makeInstance({ id: 1, breadboardX: 50, breadboardY: 100, schematicX: 200, schematicY: 300, rotation: 90 }),
      ],
      nets: [],
      parts: [makePart({ id: 1 })],
      wires: [],
    });

    const buf = Buffer.from(result.content, 'base64');
    const zip = await JSZip.loadAsync(buf);
    const fzFile = Object.keys(zip.files).find((f) => f.endsWith('.fz'));
    expect(fzFile).toBeDefined();

    const fzContent = await zip.files[fzFile!].async('string');

    // Instance should have both views with coordinates
    expect(fzContent).toContain('breadboardView');
    expect(fzContent).toContain('schematicView');
    expect(fzContent).toContain('x="50"');
    expect(fzContent).toContain('y="100"');
  });

  it('includes wire elements for breadboard wires', async () => {
    const result = await generateFritzingProject({
      projectName: 'WireTest',
      instances: [
        makeInstance({ id: 1, breadboardX: 0, breadboardY: 0 }),
        makeInstance({ id: 2, breadboardX: 100, breadboardY: 0 }),
      ],
      nets: [makeNet({ id: 1 })],
      parts: [makePart({ id: 1 })],
      wires: [
        makeWire({
          id: 10,
          netId: 1,
          view: 'breadboard',
          points: [
            { x: 0, y: 0 },
            { x: 100, y: 0 },
          ],
          color: '#FF0000',
        }),
      ],
    });

    const buf = Buffer.from(result.content, 'base64');
    const zip = await JSZip.loadAsync(buf);
    const fzFile = Object.keys(zip.files).find((f) => f.endsWith('.fz'));
    const fzContent = await zip.files[fzFile!].async('string');

    // Should contain wire geometry
    expect(fzContent).toContain('WireModuleID');
  });

  it('includes net connectivity information', async () => {
    const result = await generateFritzingProject({
      projectName: 'NetTest',
      instances: [
        makeInstance({ id: 1 }),
        makeInstance({ id: 2 }),
      ],
      nets: [
        makeNet({
          id: 1,
          name: 'VCC',
          segments: [
            { fromInstanceId: 1, fromPin: 'pin1', toInstanceId: 2, toPin: 'pin1', waypoints: [] },
          ],
        }),
      ],
      parts: [makePart({ id: 1 })],
      wires: [],
    });

    const buf = Buffer.from(result.content, 'base64');
    const zip = await JSZip.loadAsync(buf);
    const fzFile = Object.keys(zip.files).find((f) => f.endsWith('.fz'));
    const fzContent = await zip.files[fzFile!].async('string');

    expect(fzContent).toContain('VCC');
  });

  it('handles empty inputs without crashing', async () => {
    const result = await generateFritzingProject({
      projectName: 'EmptyProject',
      instances: [],
      nets: [],
      parts: [],
      wires: [],
    });

    expect(result.filename).toBe('EmptyProject.fzz');
    const buf = Buffer.from(result.content, 'base64');
    const zip = await JSZip.loadAsync(buf);
    expect(Object.keys(zip.files).length).toBeGreaterThan(0);
  });

  it('handles instances without parts gracefully', async () => {
    const result = await generateFritzingProject({
      projectName: 'NoParts',
      instances: [makeInstance({ id: 1, partId: null })],
      nets: [],
      parts: [],
      wires: [],
    });

    const buf = Buffer.from(result.content, 'base64');
    const zip = await JSZip.loadAsync(buf);
    const fzFile = Object.keys(zip.files).find((f) => f.endsWith('.fz'));
    const fzContent = await zip.files[fzFile!].async('string');

    // Should still generate valid XML with generic part reference
    expect(fzContent).toContain('generic_part');
  });

  it('includes PCB view data when available', async () => {
    const result = await generateFritzingProject({
      projectName: 'PcbTest',
      instances: [makeInstance({ id: 1 })],
      nets: [],
      parts: [makePart({ id: 1 })],
      wires: [],
    });

    const buf = Buffer.from(result.content, 'base64');
    const zip = await JSZip.loadAsync(buf);
    const fzFile = Object.keys(zip.files).find((f) => f.endsWith('.fz'));
    const fzContent = await zip.files[fzFile!].async('string');

    expect(fzContent).toContain('pcbView');
  });

  it('generates metadata in the archive', async () => {
    const result = await generateFritzingProject({
      projectName: 'MetaTest',
      instances: [],
      nets: [],
      parts: [],
      wires: [],
    });

    const buf = Buffer.from(result.content, 'base64');
    const zip = await JSZip.loadAsync(buf);
    const fzFile = Object.keys(zip.files).find((f) => f.endsWith('.fz'));
    const fzContent = await zip.files[fzFile!].async('string');

    expect(fzContent).toContain('fritzingVersion');
    expect(fzContent).toContain('MetaTest');
  });

  it('preserves wire color data', async () => {
    const result = await generateFritzingProject({
      projectName: 'ColorTest',
      instances: [],
      nets: [makeNet({ id: 1 })],
      parts: [],
      wires: [
        makeWire({ id: 1, netId: 1, view: 'breadboard', color: '#00FF00' }),
      ],
    });

    const buf = Buffer.from(result.content, 'base64');
    const zip = await JSZip.loadAsync(buf);
    const fzFile = Object.keys(zip.files).find((f) => f.endsWith('.fz'));
    const fzContent = await zip.files[fzFile!].async('string');

    expect(fzContent).toContain('#00FF00');
  });

  it('handles multiple nets with many wires', async () => {
    const wires = Array.from({ length: 10 }, (_, i) =>
      makeWire({
        id: i + 1,
        netId: (i % 3) + 1,
        view: 'breadboard',
        points: [
          { x: i * 20, y: 0 },
          { x: i * 20 + 10, y: 0 },
        ],
      }),
    );

    const nets = [
      makeNet({ id: 1, name: 'GND' }),
      makeNet({ id: 2, name: 'VCC' }),
      makeNet({ id: 3, name: 'SIG' }),
    ];

    const result = await generateFritzingProject({
      projectName: 'MultiNet',
      instances: [],
      nets,
      parts: [],
      wires,
    });

    const buf = Buffer.from(result.content, 'base64');
    const zip = await JSZip.loadAsync(buf);
    const fzFile = Object.keys(zip.files).find((f) => f.endsWith('.fz'));
    const fzContent = await zip.files[fzFile!].async('string');

    // All wire elements should be present
    expect(fzContent).toContain('WireModuleID');
  });

  it('sanitizes project name in filename', async () => {
    const result = await generateFritzingProject({
      projectName: 'My Project (v2)',
      instances: [],
      nets: [],
      parts: [],
      wires: [],
    });

    expect(result.filename).toBe('My_Project__v2_.fzz');
  });
});
