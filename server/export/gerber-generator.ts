// =============================================================================
// Gerber RS-274X Generator — Orchestrator
// =============================================================================
//
// Generates Gerber RS-274X format files from PCB layout data. Pure function
// library — no Express routes, no database access, no side effects.
//
// Format reference: IPC-2581 / Ucamco "The Gerber Layer Format Specification"
// Coordinate format: FSLAX36Y36 (3 integer digits, 6 decimal digits = micrometers)
// Units: millimeters (MOMM)
//
// Excellon drill format: FMAT,2 with METRIC,TZ (trailing zeros)
//
// Layer generators and shared utilities are in server/export/gerber/.
// This file is the orchestrator and backward-compatible entry point.
// =============================================================================

import {
  type CircuitInstanceData,
  type CircuitWireData,
  type ComponentPartData,
  type ExportResult,
  sanitizeFilename,
} from './types';

// Re-export all public types and layer generators for backward compatibility
export type {
  ApertureDef,
  BuildGerberOptions,
  DrillHit,
  GerberConnector,
  GerberInput,
  GerberInstance,
  GerberLayer,
  GerberOutput,
  GerberVia,
  GerberWire,
  ResolvedPad,
  Segment,
} from './gerber/index';

export {
  generateBoardOutline,
  generateCopperLayer,
  generateDrillFile,
  generateInnerCopperLayer,
  generatePasteLayer,
  generateSilkscreenLayer,
  generateSoldermaskLayer,
} from './gerber/index';

import { generateBoardOutline } from './gerber/outline';
import { generateCopperLayer, generateInnerCopperLayer } from './gerber/copper';
import { generateDrillFile } from './gerber/drill';
import { generatePasteLayer } from './gerber/paste';
import { generateSilkscreenLayer } from './gerber/silkscreen';
import { generateSoldermaskLayer } from './gerber/soldermask';
import type {
  BuildGerberOptions,
  GerberConnector,
  GerberInput,
  GerberInstance,
  GerberLayer,
  GerberOutput,
  GerberWire,
} from './gerber/types';

// ---------------------------------------------------------------------------
// Main Entry Point
// ---------------------------------------------------------------------------

/**
 * Generate a complete set of Gerber manufacturing files from PCB layout data.
 *
 * Returns:
 * - Copper layers: front + inner (if layerCount > 2) + back
 * - Silkscreen, soldermask, paste for front/back
 * - Board outline
 * - 1 Excellon drill file
 *
 * All coordinates in the input are in millimeters.
 * Output uses Gerber RS-274X format (FSLAX36Y36, MOMM) and Excellon FMAT,2 METRIC.
 */
export function generateGerber(input: GerberInput): GerberOutput {
  const layerCount = input.layerCount ?? 2;

  const layers: GerberLayer[] = [
    // Front copper layer
    {
      name: 'F.Cu',
      type: 'copper',
      side: 'front',
      content: generateCopperLayer(input, 'front'),
    },
  ];

  // Inner copper layers (In1.Cu, In2.Cu, ..., InN.Cu)
  for (let i = 1; i < layerCount - 1; i++) {
    const layerName = `In${String(i)}.Cu`;
    layers.push({
      name: layerName,
      type: 'copper',
      side: layerName,
      content: generateInnerCopperLayer(input, layerName, i),
    });
  }

  // Back copper layer
  layers.push({
    name: 'B.Cu',
    type: 'copper',
    side: 'back',
    content: generateCopperLayer(input, 'back'),
  });

  // Non-copper layers
  layers.push(

    // Silkscreen layers
    {
      name: 'F.SilkS',
      type: 'silkscreen',
      side: 'front',
      content: generateSilkscreenLayer(input, 'front'),
    },
    {
      name: 'B.SilkS',
      type: 'silkscreen',
      side: 'back',
      content: generateSilkscreenLayer(input, 'back'),
    },

    // Soldermask layers
    {
      name: 'F.Mask',
      type: 'soldermask',
      side: 'front',
      content: generateSoldermaskLayer(input, 'front'),
    },
    {
      name: 'B.Mask',
      type: 'soldermask',
      side: 'back',
      content: generateSoldermaskLayer(input, 'back'),
    },

    // Paste layers
    {
      name: 'F.Paste',
      type: 'paste',
      side: 'front',
      content: generatePasteLayer(input, 'front'),
    },
    {
      name: 'B.Paste',
      type: 'paste',
      side: 'back',
      content: generatePasteLayer(input, 'back'),
    },

    // Board outline
    {
      name: 'Edge.Cuts',
      type: 'outline',
      side: 'front', // outline has no meaningful side; 'front' is conventional
      content: generateBoardOutline(input),
    },
  );

  const drillFile = generateDrillFile(input);

  return { layers, drillFile };
}

// ---------------------------------------------------------------------------
// Bridge: DB types → GerberInput
// ---------------------------------------------------------------------------

/**
 * Convert raw database types (CircuitInstanceData, CircuitWireData, ComponentPartData)
 * into a typed GerberInput for the pure Gerber generation pipeline.
 *
 * - Filters wires to only PCB-view wires
 * - Maps part connectors to GerberConnector format
 * - Extracts footprint from part meta
 * - Handles null pcbX/pcbY/pcbRotation/pcbSide with sensible defaults
 */
export function buildGerberInput(
  instances: CircuitInstanceData[],
  wires: CircuitWireData[],
  parts: ComponentPartData[],
  options: BuildGerberOptions,
): GerberInput {
  // Build a part lookup map
  const partMap = new Map<number, ComponentPartData>();
  for (let i = 0; i < parts.length; i++) {
    partMap.set(parts[i].id, parts[i]);
  }

  // Convert instances
  const gerberInstances: GerberInstance[] = [];
  for (let i = 0; i < instances.length; i++) {
    const inst = instances[i];
    const part = inst.partId != null ? partMap.get(inst.partId) : undefined;
    const meta = (part?.meta ?? {}) as Record<string, unknown>;
    const rawConnectors = (part?.connectors ?? []) as Array<Record<string, unknown>>;

    const connectors: GerberConnector[] = [];
    for (let j = 0; j < rawConnectors.length; j++) {
      const c = rawConnectors[j];
      connectors.push({
        id: String(c.id ?? `pin${j}`),
        name: String(c.name ?? `PIN${j + 1}`),
        padType: typeof c.padType === 'string' ? c.padType : undefined,
        padWidth: typeof c.padWidth === 'number' ? c.padWidth : undefined,
        padHeight: typeof c.padHeight === 'number' ? c.padHeight : undefined,
        padShape: typeof c.padShape === 'string' ? c.padShape : undefined,
        drill: typeof c.drill === 'number' ? c.drill : undefined,
        offsetX: typeof c.offsetX === 'number' ? c.offsetX : undefined,
        offsetY: typeof c.offsetY === 'number' ? c.offsetY : undefined,
      });
    }

    gerberInstances.push({
      id: inst.id,
      referenceDesignator: inst.referenceDesignator,
      pcbX: inst.pcbX ?? 0,
      pcbY: inst.pcbY ?? 0,
      pcbRotation: inst.pcbRotation ?? 0,
      pcbSide: inst.pcbSide ?? 'front',
      connectors,
      footprint: (typeof meta.package === 'string' ? meta.package : ''),
      bodyWidth: typeof meta.bodyWidth === 'number' ? meta.bodyWidth : undefined,
      bodyHeight: typeof meta.bodyHeight === 'number' ? meta.bodyHeight : undefined,
    });
  }

  // Convert wires — filter to PCB view only
  const gerberWires: GerberWire[] = [];
  for (let i = 0; i < wires.length; i++) {
    const wire = wires[i];
    if (wire.view !== 'pcb') continue;

    const rawPoints = Array.isArray(wire.points) ? wire.points : [];
    const points: Array<{ x: number; y: number }> = [];
    for (let j = 0; j < rawPoints.length; j++) {
      const pt = rawPoints[j];
      if (pt && typeof pt === 'object') {
        const p = pt as Record<string, unknown>;
        if (typeof p.x === 'number' && typeof p.y === 'number') {
          points.push({ x: p.x, y: p.y });
        }
      }
    }

    gerberWires.push({
      layer: wire.layer ?? 'front',
      points,
      width: wire.width,
    });
  }

  return {
    boardWidth: options.boardWidth,
    boardHeight: options.boardHeight,
    instances: gerberInstances,
    wires: gerberWires,
    vias: options.vias,
    boardOutline: options.boardOutline,
  };
}

// ---------------------------------------------------------------------------
// Legacy API — original export-generators.ts signature used by ai-tools.ts
// ---------------------------------------------------------------------------

export function generateLegacyGerber(
  instances: CircuitInstanceData[],
  wires: CircuitWireData[],
  parts: ComponentPartData[],
  projectName: string,
): ExportResult {
  const partMap = new Map<number, ComponentPartData>();
  for (const part of parts) {
    partMap.set(part.id, part);
  }

  // Collect all PCB coordinates to compute board outline
  const allX: number[] = [];
  const allY: number[] = [];

  for (const inst of instances) {
    if (inst.pcbX !== null && inst.pcbY !== null) {
      allX.push(inst.pcbX);
      allY.push(inst.pcbY);
    }
  }

  for (const wire of wires) {
    if (Array.isArray(wire.points)) {
      for (const pt of wire.points) {
        if (pt && typeof pt === 'object') {
          const p = pt as Record<string, unknown>;
          if (typeof p.x === 'number' && typeof p.y === 'number') {
            allX.push(p.x);
            allY.push(p.y);
          }
        }
      }
    }
  }

  // Default board if no coordinates
  const MARGIN = 5; // mm
  const minX = allX.length > 0 ? Math.min(...allX) - MARGIN : 0;
  const minY = allY.length > 0 ? Math.min(...allY) - MARGIN : 0;
  const maxX = allX.length > 0 ? Math.max(...allX) + MARGIN : 100;
  const maxY = allY.length > 0 ? Math.max(...allY) + MARGIN : 100;

  // Convert mm to Gerber integer coords (format 4.6 → multiply by 1e6)
  const g = (mm: number) => Math.round(mm * 1e6);

  // ========================================
  // Layer 1: Board Outline (Edge.Cuts)
  // ========================================
  const outlineLines = [
    `G04 Board Outline - ${projectName}*`,
    '%FSLAX46Y46*%',
    '%MOIN*%',
    '%ADD10C,0.150000*%',
    'D10*',
    `X${g(minX)}Y${g(minY)}D02*`,
    `X${g(maxX)}Y${g(minY)}D01*`,
    `X${g(maxX)}Y${g(maxY)}D01*`,
    `X${g(minX)}Y${g(maxY)}D01*`,
    `X${g(minX)}Y${g(minY)}D01*`,
    'M02*',
  ];

  // ========================================
  // Layer 2: Front Copper (F.Cu)
  // ========================================
  const copperLines = [
    `G04 Front Copper Layer - ${projectName}*`,
    '%FSLAX46Y46*%',
    '%MOIN*%',
    '%ADD11C,0.800000*%', // Round pad aperture
    '%ADD12R,1.600000X1.600000*%', // Rectangular pad aperture
    '%ADD13C,0.254000*%', // Trace aperture
  ];

  // Component pads
  copperLines.push('D11*');
  for (const inst of instances) {
    if (inst.pcbX === null || inst.pcbY === null) continue;

    const part = inst.partId != null ? partMap.get(inst.partId) : undefined;
    const connectorCount = part ? part.connectors.length : 2;
    const padCount = Math.max(connectorCount, 2);

    // Place pads in a row centered on the component position
    const padSpacing = 2.54; // mm, standard 100-mil spacing
    const startOffset = -((padCount - 1) * padSpacing) / 2;

    for (let p = 0; p < padCount; p++) {
      const padX = inst.pcbX + startOffset + p * padSpacing;
      const padY = inst.pcbY;
      copperLines.push(`X${g(padX)}Y${g(padY)}D03*`);
    }
  }

  // PCB traces from wires
  const pcbWires = wires.filter((w) => w.view === 'pcb');
  if (pcbWires.length > 0) {
    copperLines.push('D13*');
    for (const wire of pcbWires) {
      if (!Array.isArray(wire.points) || wire.points.length < 2) continue;
      const pts = wire.points as Array<Record<string, unknown>>;

      for (let i = 0; i < pts.length; i++) {
        const pt = pts[i];
        if (typeof pt.x !== 'number' || typeof pt.y !== 'number') continue;
        const dCode = i === 0 ? 'D02' : 'D01';
        copperLines.push(`X${g(pt.x as number)}Y${g(pt.y as number)}${dCode}*`);
      }
    }
  }

  copperLines.push('M02*');

  // ========================================
  // Layer 3: Drill File (Excellon)
  // ========================================
  const drillLines = [
    `; Drill File - ${projectName}`,
    '; Generated by ProtoPulse',
    'M48',
    ';FORMAT={-:-/ absolute / metric / decimal}',
    'FMAT,2',
    'METRIC,TZ',
    'T01C0.800',
    '%',
    'T01',
  ];

  for (const inst of instances) {
    if (inst.pcbX === null || inst.pcbY === null) continue;

    const part = inst.partId != null ? partMap.get(inst.partId) : undefined;
    const connectorCount = part ? part.connectors.length : 2;
    const padCount = Math.max(connectorCount, 2);
    const padSpacing = 2.54;
    const startOffset = -((padCount - 1) * padSpacing) / 2;

    for (let p = 0; p < padCount; p++) {
      const drillX = inst.pcbX + startOffset + p * padSpacing;
      const drillY = inst.pcbY;
      drillLines.push(`X${drillX.toFixed(3)}Y${drillY.toFixed(3)}`);
    }
  }

  drillLines.push('M30');

  // Concatenate all layers with separator comments
  const content = [
    'G04 === BOARD OUTLINE (Edge.Cuts) ===*',
    ...outlineLines,
    '',
    'G04 === FRONT COPPER (F.Cu) ===*',
    ...copperLines,
    '',
    'G04 === DRILL FILE (Excellon) ===*',
    ...drillLines,
  ].join('\n');

  return {
    content,
    encoding: 'utf8',
    mimeType: 'application/x-gerber',
    filename: `${sanitizeFilename(projectName)}_gerber.gbr`,
  };
}
