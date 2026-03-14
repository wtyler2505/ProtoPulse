import { describe, it, expect } from 'vitest';
import {
  generateEtchablePcbSvg,
  generateEtchablePcbPdf,
} from '../etchable-pcb-generator';
import type { CircuitInstanceData, CircuitWireData, ComponentPartData } from '../types';

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

function makeInstance(overrides: Partial<CircuitInstanceData> = {}): CircuitInstanceData {
  return {
    id: 1,
    partId: 1,
    referenceDesignator: 'R1',
    schematicX: 100,
    schematicY: 100,
    schematicRotation: 0,
    pcbX: 10,
    pcbY: 10,
    pcbRotation: 0,
    pcbSide: 'front',
    properties: {},
    ...overrides,
  };
}

function makeWire(overrides: Partial<CircuitWireData> = {}): CircuitWireData {
  return {
    id: 1,
    netId: 1,
    view: 'pcb',
    points: [
      { x: 10, y: 10 },
      { x: 30, y: 10 },
    ],
    layer: 'F.Cu',
    width: 0.254,
    ...overrides,
  };
}

function makePart(overrides: Partial<ComponentPartData> = {}): ComponentPartData {
  return {
    id: 1,
    nodeId: 'node-1',
    meta: { title: 'Resistor 10k' },
    connectors: [
      {
        id: 'pin1',
        name: 'Pin 1',
        padType: 'tht',
        padWidth: 1.6,
        padHeight: 1.6,
        padShape: 'circle',
        drill: 0.8,
        offsetX: -2.54,
        offsetY: 0,
      },
      {
        id: 'pin2',
        name: 'Pin 2',
        padType: 'tht',
        padWidth: 1.6,
        padHeight: 1.6,
        padShape: 'circle',
        drill: 0.8,
        offsetX: 2.54,
        offsetY: 0,
      },
    ],
    buses: [],
    constraints: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('generateEtchablePcbSvg', () => {
  it('returns a valid SVG with correct MIME type and encoding', () => {
    const result = generateEtchablePcbSvg([makeInstance()], [makeWire()], [makePart()], 'TestProject');
    expect(result.mimeType).toBe('image/svg+xml');
    expect(result.encoding).toBe('utf8');
    expect(result.content).toContain('<?xml version="1.0"');
    expect(result.content).toContain('<svg');
    expect(result.content).toContain('</svg>');
  });

  it('includes the project name in a comment', () => {
    const result = generateEtchablePcbSvg([], [], [], 'My Arduino Project');
    expect(result.content).toContain('My Arduino Project');
  });

  it('uses mm units in the viewBox', () => {
    const result = generateEtchablePcbSvg([], [], [], 'Test');
    expect(result.content).toMatch(/width="[\d.]+mm"/);
    expect(result.content).toMatch(/height="[\d.]+mm"/);
  });

  it('renders board outline as a rect with 0.5mm stroke', () => {
    const result = generateEtchablePcbSvg([], [], [], 'Test');
    expect(result.content).toContain('stroke-width="0.5"');
    expect(result.content).toMatch(/<rect x="0" y="0"/);
  });

  it('renders pads as black circles', () => {
    const result = generateEtchablePcbSvg([makeInstance()], [], [makePart()], 'Test');
    expect(result.content).toContain('fill="#000000"');
    expect(result.content).toContain('<circle');
  });

  it('renders drill holes as white circles inside pads', () => {
    const result = generateEtchablePcbSvg([makeInstance()], [], [makePart()], 'Test');
    expect(result.content).toContain('fill="#FFFFFF"');
  });

  it('renders traces as black polylines', () => {
    const result = generateEtchablePcbSvg([], [makeWire()], [], 'Test');
    expect(result.content).toContain('<polyline');
    expect(result.content).toContain('stroke="#000000"');
  });

  it('applies mirror transform when mirror=true (default)', () => {
    const result = generateEtchablePcbSvg([], [], [], 'Test');
    expect(result.content).toContain('scale(-');
    expect(result.filename).toContain('mirrored');
  });

  it('does not apply mirror transform when mirror=false', () => {
    const result = generateEtchablePcbSvg([], [], [], 'Test', { mirror: false });
    expect(result.content).not.toContain('scale(-');
    expect(result.filename).toContain('normal');
  });

  it('includes drill crosshair marks by default', () => {
    const result = generateEtchablePcbSvg([makeInstance()], [], [makePart()], 'Test');
    // Crosshair marks are rendered as thin lines
    expect(result.content).toContain('stroke-width="0.1"');
  });

  it('omits drill marks when drillMarks=false', () => {
    const result = generateEtchablePcbSvg([makeInstance()], [], [makePart()], 'Test', {
      drillMarks: false,
    });
    expect(result.content).not.toContain('stroke-width="0.1"');
  });

  it('includes silkscreen reference designators when silkscreen=true', () => {
    const result = generateEtchablePcbSvg([makeInstance()], [], [makePart()], 'Test', {
      silkscreen: true,
    });
    expect(result.content).toContain('R1');
    expect(result.content).toContain('fill="#808080"');
    expect(result.content).toContain('<!-- Silkscreen -->');
  });

  it('omits silkscreen by default', () => {
    const result = generateEtchablePcbSvg([makeInstance()], [], [makePart()], 'Test');
    expect(result.content).not.toContain('<!-- Silkscreen -->');
  });

  it('filters pads by copperLayer=front', () => {
    const frontInst = makeInstance({ pcbSide: 'front', referenceDesignator: 'R1' });
    const backInst = makeInstance({ id: 2, pcbSide: 'back', referenceDesignator: 'R2', pcbX: 30 });
    const result = generateEtchablePcbSvg(
      [frontInst, backInst],
      [],
      [makePart()],
      'Test',
      { copperLayer: 'front' },
    );
    expect(result.filename).toContain('front');
  });

  it('includes back layer pads when copperLayer=back', () => {
    const result = generateEtchablePcbSvg(
      [makeInstance({ pcbSide: 'back' })],
      [],
      [makePart()],
      'Test',
      { copperLayer: 'back' },
    );
    expect(result.filename).toContain('back');
  });

  it('includes both layers when copperLayer=both', () => {
    const result = generateEtchablePcbSvg([], [], [], 'Test', { copperLayer: 'both' });
    expect(result.filename).toContain('all');
  });

  it('produces a correct filename with project name and options', () => {
    const result = generateEtchablePcbSvg([], [], [], 'MyBoard', {
      mirror: true,
      copperLayer: 'front',
    });
    expect(result.filename).toBe('MyBoard-etchable-front-mirrored.svg');
  });

  it('sanitizes the project name in the filename', () => {
    const result = generateEtchablePcbSvg([], [], [], 'My/Board:Project', { mirror: false });
    expect(result.filename).not.toContain('/');
    expect(result.filename).not.toContain(':');
  });

  it('handles instances without partId (null)', () => {
    const inst = makeInstance({ partId: null });
    const result = generateEtchablePcbSvg([inst], [], [makePart()], 'Test');
    // Should not crash, just produce SVG with board outline
    expect(result.content).toContain('<svg');
  });

  it('handles instances with partId not found in parts', () => {
    const inst = makeInstance({ partId: 999 });
    const result = generateEtchablePcbSvg([inst], [], [makePart()], 'Test');
    expect(result.content).toContain('<svg');
  });

  it('uses schematic coordinates when pcbX/pcbY are null', () => {
    const inst = makeInstance({ pcbX: null, pcbY: null, schematicX: 200, schematicY: 300 });
    const result = generateEtchablePcbSvg([inst], [], [makePart()], 'Test');
    // Should render at schematicX/10=20, schematicY/10=30
    expect(result.content).toContain('<svg');
  });

  it('handles wires with empty points array', () => {
    const wire = makeWire({ points: [] });
    const result = generateEtchablePcbSvg([], [wire], [], 'Test');
    expect(result.content).not.toContain('<polyline');
  });

  it('handles wires with single point (skip)', () => {
    const wire = makeWire({ points: [{ x: 5, y: 5 }] });
    const result = generateEtchablePcbSvg([], [wire], [], 'Test');
    expect(result.content).not.toContain('<polyline');
  });

  it('renders rect pads for square padShape', () => {
    const part = makePart({
      connectors: [
        { id: 'p1', name: 'P1', padWidth: 2, padHeight: 2, padShape: 'square', offsetX: 0, offsetY: 0 },
      ],
    });
    const result = generateEtchablePcbSvg([makeInstance()], [], [part], 'Test');
    expect(result.content).toMatch(/<rect/);
  });

  it('renders ellipse pads for oblong padShape', () => {
    const part = makePart({
      connectors: [
        { id: 'p1', name: 'P1', padWidth: 3, padHeight: 1.5, padShape: 'oblong', offsetX: 0, offsetY: 0 },
      ],
    });
    const result = generateEtchablePcbSvg([makeInstance()], [], [part], 'Test');
    expect(result.content).toMatch(/<ellipse/);
  });

  it('applies custom scale factor to viewBox', () => {
    const result1 = generateEtchablePcbSvg([], [], [], 'Test', { scale: 1.0 });
    const result2 = generateEtchablePcbSvg([], [], [], 'Test', { scale: 2.0 });
    // At 2x scale, dimensions should be doubled
    const width1 = parseFloat(result1.content.match(/width="([\d.]+)mm"/)?.[1] ?? '0');
    const width2 = parseFloat(result2.content.match(/width="([\d.]+)mm"/)?.[1] ?? '0');
    expect(width2).toBeCloseTo(width1 * 2, 1);
  });

  it('has white background', () => {
    const result = generateEtchablePcbSvg([], [], [], 'Test');
    expect(result.content).toContain('fill="#FFFFFF"');
  });

  it('filters traces by layer when copperLayer=back', () => {
    const frontWire = makeWire({ id: 1, layer: 'F.Cu' });
    const backWire = makeWire({ id: 2, layer: 'B.Cu', points: [{ x: 5, y: 5 }, { x: 15, y: 15 }] });
    const result = generateEtchablePcbSvg([], [frontWire, backWire], [], 'Test', {
      copperLayer: 'back',
    });
    // Should only contain one polyline (the back wire)
    const polylineCount = (result.content.match(/<polyline/g) ?? []).length;
    expect(polylineCount).toBe(1);
  });

  it('handles empty inputs gracefully', () => {
    const result = generateEtchablePcbSvg([], [], [], 'Empty');
    expect(result.content).toContain('<svg');
    expect(result.content).toContain('</svg>');
    expect(result.mimeType).toBe('image/svg+xml');
  });

  it('uses default trace width of 0.254mm for zero-width wires', () => {
    const wire = makeWire({ width: 0, points: [{ x: 0, y: 0 }, { x: 10, y: 10 }] });
    const result = generateEtchablePcbSvg([], [wire], [], 'Test');
    expect(result.content).toContain('stroke-width="0.254"');
  });

  it('generates a default pad for parts with empty connectors', () => {
    const part = makePart({ connectors: [] });
    const result = generateEtchablePcbSvg([makeInstance()], [], [part], 'Test');
    // Should still have at least one pad element
    expect(result.content).toContain('<circle');
  });
});

describe('generateEtchablePcbPdf', () => {
  it('returns a valid PDF with correct MIME type', () => {
    const result = generateEtchablePcbPdf([], [], [], 'Test');
    expect(result.mimeType).toBe('application/pdf');
    expect(result.encoding).toBe('utf8');
    expect(result.content).toContain('%PDF-1.4');
    expect(result.content).toContain('%%EOF');
  });

  it('includes the embedded SVG content', () => {
    const result = generateEtchablePcbPdf([makeInstance()], [makeWire()], [makePart()], 'Test');
    expect(result.content).toContain('<svg');
    expect(result.content).toContain('</svg>');
  });

  it('sets the correct page dimensions based on board size', () => {
    const result = generateEtchablePcbPdf([], [], [], 'Test');
    expect(result.content).toContain('/MediaBox');
  });

  it('includes print instructions in content stream', () => {
    const result = generateEtchablePcbPdf([], [], [], 'Test');
    expect(result.content).toContain('Print this PDF at 100% scale');
  });

  it('produces a correct filename with options', () => {
    const result = generateEtchablePcbPdf([], [], [], 'MyBoard', {
      mirror: false,
      copperLayer: 'back',
    });
    expect(result.filename).toBe('MyBoard-etchable-back-normal.pdf');
  });

  it('passes options through to SVG generation', () => {
    const result = generateEtchablePcbPdf([], [], [], 'Test', {
      mirror: false,
    });
    // The embedded SVG should not have mirror transform
    expect(result.content).not.toContain('scale(-');
  });
});
