/**
 * PCB Geometry Bridge — Extracts routed trace geometry and converts it
 * to input formats consumed by PDN and SI analysis engines.
 *
 * This module bridges the gap between the schematic/PCB editor's wire data
 * and the simulation engines that need physical trace parameters. Instead
 * of hardcoded defaults, PDN and SI analysis can read actual routed geometry.
 *
 * Usage:
 *   const traces = extractTraceGeometries(wires, nets);
 *   const pdnInput = traceGeometryToPdnInput(traces, stackup);
 *   const siInput  = traceGeometryToSiInput(traces, stackup);
 */

import type { StackupLayer } from '@/lib/board-stackup';
import { milToMm, mmToMeter } from '@shared/units';
import type { PowerNet, PowerVia } from './pdn-analysis';
import type { TraceInfo, StackupLayerInfo } from './si-advisor';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Per-net trace geometry extracted from routed PCB wires. */
export interface TraceGeometry {
  /** Net identifier. */
  netId: number;
  /** Human-readable net name. */
  netName: string;
  /** Total routed length in mm (Euclidean sum of all segments). */
  totalLength: number;
  /** Average trace width in mm across all segments. */
  avgWidth: number;
  /** Minimum trace width in mm (bottleneck). */
  minWidth: number;
  /** Primary layer name (layer with the most total length). */
  layer: string;
  /** Total number of wire segments. */
  segmentCount: number;
  /** Estimated via count (number of distinct layers minus one). */
  viaCount: number;
}

/** A wire from the circuit editor's data model. */
export interface CircuitWireData {
  id: number;
  netId: number;
  points: Array<{ x: number; y: number }>;
  width: number;
  layer: string | null;
}

/** A net from the circuit editor's data model. */
export interface CircuitNetData {
  id: number;
  name: string;
}

/** Input shape for PDN analysis derived from trace geometry. */
export interface PdnTraceInput {
  powerNet: PowerNet;
  vias: PowerVia[];
  planeArea: number;
  stackup: StackupLayer[];
}

/** Input shape for SI analysis derived from trace geometry. */
export interface SiTraceInput {
  traces: TraceInfo[];
}

// ---------------------------------------------------------------------------
// Default constants
// ---------------------------------------------------------------------------

/** Default via drill diameter in mm. */
const DEFAULT_VIA_DIAMETER = 0.3;

/** Default antipad diameter in mm. */
const DEFAULT_ANTIPAD_DIAMETER = 0.6;

/** Default plating thickness in mm. */
const DEFAULT_PLATING_THICKNESS = 0.025;

/** Default target impedance in ohms. */
const DEFAULT_TARGET_Z0 = 50;

/** Default trace spacing in mm (when unknown). */
const DEFAULT_SPACING = 0.2;

/** Default supply voltage in V. */
const DEFAULT_VOLTAGE = 3.3;

/** Default max current in A. */
const DEFAULT_MAX_CURRENT = 1.0;

/** Default ripple target in mV. */
const DEFAULT_RIPPLE_TARGET = 50;

/** Resistivity of copper (ohm·m). */
const RHO_CU = 1.724e-8;

/** Permeability of free space (H/m). */
const MU_0 = 4 * Math.PI * 1e-7;

// ---------------------------------------------------------------------------
// Extract trace geometries
// ---------------------------------------------------------------------------

/**
 * Extract per-net trace geometry statistics from raw circuit wires and nets.
 *
 * Groups wires by netId, computes total routed length (Euclidean sum of
 * segments), average and minimum width, primary layer, segment count,
 * and estimated via count (distinct layers − 1).
 */
export function extractTraceGeometries(
  wires: CircuitWireData[],
  nets: CircuitNetData[],
): TraceGeometry[] {
  if (wires.length === 0) {
    return [];
  }

  // Build net name lookup
  const netNameMap = new Map<number, string>();
  for (const net of nets) {
    netNameMap.set(net.id, net.name);
  }

  // Group wires by netId
  const wiresByNet = new Map<number, CircuitWireData[]>();
  for (const wire of wires) {
    const existing = wiresByNet.get(wire.netId);
    if (existing) {
      existing.push(wire);
    } else {
      wiresByNet.set(wire.netId, [wire]);
    }
  }

  const results: TraceGeometry[] = [];

  for (const [netId, netWires] of Array.from(wiresByNet.entries())) {
    let totalLength = 0;
    let segmentCount = 0;
    let widthSum = 0;
    let widthCount = 0;
    let minWidth = Infinity;
    const layerLengths = new Map<string, number>();
    const distinctLayers = new Set<string>();

    for (const wire of netWires) {
      const resolvedLayer = wire.layer ?? 'F.Cu';
      distinctLayers.add(resolvedLayer);

      // Compute segment lengths
      const pts = wire.points;
      let wireLength = 0;
      let wireSegments = 0;

      for (let i = 0; i < pts.length - 1; i++) {
        const dx = pts[i + 1].x - pts[i].x;
        const dy = pts[i + 1].y - pts[i].y;
        const segLen = Math.sqrt(dx * dx + dy * dy);
        wireLength += segLen;
        wireSegments++;
      }

      totalLength += wireLength;
      segmentCount += wireSegments;

      // Track width stats per segment
      if (wireSegments > 0) {
        widthSum += wire.width * wireSegments;
        widthCount += wireSegments;
        if (wire.width < minWidth) {
          minWidth = wire.width;
        }
      }

      // Track length per layer for primary layer determination
      const existing = layerLengths.get(resolvedLayer) ?? 0;
      layerLengths.set(resolvedLayer, existing + wireLength);
    }

    // Determine primary layer (longest total length)
    let primaryLayer = 'F.Cu';
    let maxLayerLength = -1;
    for (const [layer, length] of Array.from(layerLengths.entries())) {
      if (length > maxLayerLength) {
        maxLayerLength = length;
        primaryLayer = layer;
      }
    }

    // Via count: distinct layers - 1 (each new layer requires a via)
    const viaCount = Math.max(0, distinctLayers.size - 1);

    const avgWidth = widthCount > 0 ? widthSum / widthCount : 0;
    if (minWidth === Infinity) {
      minWidth = 0;
    }

    results.push({
      netId,
      netName: netNameMap.get(netId) ?? `net-${netId}`,
      totalLength,
      avgWidth,
      minWidth,
      layer: primaryLayer,
      segmentCount,
      viaCount,
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// PDN conversion
// ---------------------------------------------------------------------------

/**
 * Convert extracted trace geometries into the input format expected by
 * {@link PDNAnalyzer}. Creates a PowerNet from the first trace's net name,
 * generates PowerVia entries from via counts, and estimates plane area.
 */
export function traceGeometryToPdnInput(
  traces: TraceGeometry[],
  stackup: StackupLayer[],
): PdnTraceInput {
  // Build power net from first trace or defaults
  const firstTrace = traces[0];
  const powerNet: PowerNet = {
    name: firstTrace?.netName ?? 'POWER',
    voltage: DEFAULT_VOLTAGE,
    maxCurrent: DEFAULT_MAX_CURRENT,
    rippleTarget: DEFAULT_RIPPLE_TARGET,
  };

  // Generate vias from all traces' via counts
  const vias: PowerVia[] = [];
  for (const trace of traces) {
    for (let i = 0; i < trace.viaCount; i++) {
      // Estimate via position along the trace (evenly spaced)
      const fraction = trace.viaCount > 1 ? i / (trace.viaCount - 1) : 0.5;
      const x = fraction * trace.totalLength;
      const y = 0;

      // Calculate via parasitics
      const layerSeparation = estimateLayerSeparation(stackup);
      const inductance = calculateViaInductance(layerSeparation, DEFAULT_VIA_DIAMETER, DEFAULT_ANTIPAD_DIAMETER);
      const resistance = calculateViaResistance(layerSeparation, DEFAULT_VIA_DIAMETER, DEFAULT_PLATING_THICKNESS);

      vias.push({
        position: { x, y },
        diameter: DEFAULT_VIA_DIAMETER,
        fromLayer: 'F.Cu',
        toLayer: 'B.Cu',
        inductance,
        resistance,
      });
    }
  }

  // Estimate plane area from trace coverage
  let totalTraceArea = 0;
  for (const trace of traces) {
    totalTraceArea += trace.totalLength * trace.avgWidth;
  }
  // Rough estimate: traces cover ~10% of the plane area
  const planeArea = totalTraceArea > 0 ? totalTraceArea * 10 : 0;

  return {
    powerNet,
    vias,
    planeArea,
    stackup,
  };
}

// ---------------------------------------------------------------------------
// SI conversion
// ---------------------------------------------------------------------------

/**
 * Convert extracted trace geometries into the {@link TraceInfo} array
 * expected by {@link generateReport} from si-advisor.ts.
 */
export function traceGeometryToSiInput(
  traces: TraceGeometry[],
  stackup: StackupLayer[],
): SiTraceInput {
  const siTraces: TraceInfo[] = traces.map((trace) => {
    const layerInfo = findStackupLayerInfo(trace.layer, stackup);

    return {
      name: trace.netName,
      width: trace.avgWidth,
      length: trace.totalLength,
      spacing: DEFAULT_SPACING,
      layer: layerInfo,
      targetZ0: DEFAULT_TARGET_Z0,
      netClass: 'Default',
    };
  });

  return { traces: siTraces };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Find the matching stackup layer and convert to StackupLayerInfo for SI.
 * Falls back to sensible FR4 defaults if the layer isn't found.
 */
function findStackupLayerInfo(layerName: string, stackup: StackupLayer[]): StackupLayerInfo {
  // Try to match by name
  const matched = stackup.find((l) => l.name === layerName);

  if (matched) {
    // Find the nearest reference plane (ground or power) for height
    const sorted = [...stackup].sort((a, b) => a.order - b.order);
    const matchedIdx = sorted.findIndex((l) => l.id === matched.id);
    let height = 0.1; // default 0.1mm = ~4 mil

    // Look for nearest ground/power plane
    for (let i = matchedIdx + 1; i < sorted.length; i++) {
      if (sorted[i].type === 'ground' || sorted[i].type === 'power') {
        // stackup.thickness is in mils (see client/src/lib/board-stackup.ts);
        // simulation consumes mm. Use shared units contract (BL-0126).
        height = milToMm(sorted[i].thickness);
        break;
      }
    }
    if (height <= 0) {
      height = 0.1;
    }

    return {
      er: matched.dielectricConstant,
      height,
      thickness: copperWeightToMm(matched.copperWeight),
      tanD: matched.lossTangent,
    };
  }

  // Fallback: typical FR4
  return {
    er: 4.4,
    height: 0.1,
    thickness: 0.035,
    tanD: 0.02,
  };
}

/** Convert copper weight string to thickness in mm. */
function copperWeightToMm(weight: string): number {
  switch (weight) {
    case '0.5oz': return 0.0175;
    case '1oz': return 0.035;
    case '2oz': return 0.070;
    case '3oz': return 0.105;
    case '4oz': return 0.140;
    default: return 0.035;
  }
}

/**
 * Estimate layer separation in mm from stackup.
 * Uses the average thickness of all layers, or a default of 1.6mm / 4 layers.
 */
function estimateLayerSeparation(stackup: StackupLayer[]): number {
  if (stackup.length < 2) {
    return 0.4; // default ~0.4mm
  }

  // Sum all layer thicknesses (in mils) and convert to mm via shared
  // unit contract (BL-0126) — formerly an inline `* 0.0254` magic number.
  let totalThicknessMils = 0;
  for (const layer of stackup) {
    totalThicknessMils += layer.thickness;
  }
  const totalMm = milToMm(totalThicknessMils);
  return totalMm / Math.max(1, stackup.length - 1);
}

/**
 * Calculate via inductance in nH.
 * L = (mu0 * h / 2*pi) * ln(D_antipad / D_via)
 */
function calculateViaInductance(heightMm: number, viaDiameterMm: number, antipadDiameterMm: number): number {
  if (heightMm <= 0 || viaDiameterMm <= 0 || antipadDiameterMm <= viaDiameterMm) {
    return 0;
  }
  const h = heightMm * 1e-3; // mm to m
  const ratio = antipadDiameterMm / viaDiameterMm;
  const inductanceH = (MU_0 * h) / (2 * Math.PI) * Math.log(ratio);
  return inductanceH * 1e9; // H to nH
}

/**
 * Calculate via resistance in milliohms.
 * R = rho_Cu * h / (pi * (r_outer^2 - r_inner^2))
 */
function calculateViaResistance(heightMm: number, drillDiameterMm: number, platingThicknessMm: number): number {
  if (heightMm <= 0 || drillDiameterMm <= 0 || platingThicknessMm <= 0) {
    return 0;
  }
  const h = heightMm * 1e-3; // m
  const rOuter = (drillDiameterMm / 2) * 1e-3; // m
  const rInner = rOuter - platingThicknessMm * 1e-3; // m
  if (rInner <= 0) {
    const area = Math.PI * rOuter * rOuter;
    return (RHO_CU * h / area) * 1e3; // ohm to milliohm
  }
  const area = Math.PI * (rOuter * rOuter - rInner * rInner);
  return (RHO_CU * h / area) * 1e3;
}
