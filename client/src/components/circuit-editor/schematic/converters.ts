/**
 * Converters: DB rows to React Flow elements, clipboard bundle types, and
 * React Flow type registrations for the schematic canvas.
 */
import type { Node, Edge } from '@xyflow/react';
import type { CircuitDesignRow, CircuitInstanceRow, CircuitNetRow, ComponentPart, HierarchicalPortRow } from '@shared/schema';
import type { Connector, Shape, PartMeta, PartViews } from '@shared/component-types';
import type { PowerSymbol, SchematicNetLabel, SchematicAnnotation, NoConnectMarker } from '@shared/circuit-types';
import type { InstanceNodeData } from '../SchematicInstanceNode';
import type { PowerNodeData } from '../SchematicPowerNode';
import type { NetLabelNodeData } from '../SchematicNetLabelNode';
import type { NoConnectNodeData } from '../SchematicNoConnectNode';
import type { SheetNodeData } from '../SchematicSheetNode';
import type { AnnotationNodeData } from '../SchematicAnnotationNode';
import SchematicInstanceNode from '../SchematicInstanceNode';
import SchematicPowerNode from '../SchematicPowerNode';
import SchematicNetLabelNode from '../SchematicNetLabelNode';
import SchematicNoConnectNode from '../SchematicNoConnectNode';
import SchematicSheetNode from '../SchematicSheetNode';
import SchematicAnnotationNode from '../SchematicAnnotationNode';
import SchematicNetEdge from '../SchematicNetEdge';

// ---------------------------------------------------------------------------
// Clipboard bundle types (used by copy/paste)
// ---------------------------------------------------------------------------

export interface ClipboardInstance {
  partId: number | null;
  referenceDesignator: string;
  schematicX: number;
  schematicY: number;
  schematicRotation: number;
  properties: unknown;
  oldId: number;
}

export interface ClipboardNetSegment {
  fromInstanceId: number;
  fromPin: string;
  toInstanceId: number;
  toPin: string;
  waypoints?: Array<{ x: number; y: number }>;
}

export interface ClipboardNet {
  name: string;
  netType: string;
  style: unknown;
  segments: ClipboardNetSegment[];
}

export interface SchematicClipboardBundle {
  type: 'protopulse-schematic-bundle';
  instances: ClipboardInstance[];
  powerSymbols: PowerSymbol[];
  netLabels: SchematicNetLabel[];
  noConnectMarkers: NoConnectMarker[];
  nets: ClipboardNet[];
}

// ---------------------------------------------------------------------------
// React Flow type registrations
// ---------------------------------------------------------------------------

export const nodeTypes = {
  'schematic-instance': SchematicInstanceNode,
  'schematic-power': SchematicPowerNode,
  'schematic-net-label': SchematicNetLabelNode,
  'schematic-no-connect': SchematicNoConnectNode,
  'schematic-sheet': SchematicSheetNode,
  'schematic-annotation': SchematicAnnotationNode,
};
export const edgeTypes = { 'schematic-net': SchematicNetEdge };

// ---------------------------------------------------------------------------
// Net segment JSON shape (from DB JSONB column)
// ---------------------------------------------------------------------------

export interface NetSegmentJSON {
  fromInstanceId: number;
  fromPin: string;
  toInstanceId: number;
  toPin: string;
  waypoints?: Array<{ x: number; y: number }>;
}

// ---------------------------------------------------------------------------
// Converters: DB rows -> React Flow elements
// ---------------------------------------------------------------------------

/**
 * Resolve a pin reference to a connector ID. If the pin reference is already
 * a valid connector ID, return it. Otherwise, try matching by connector name
 * (case-insensitive) — this handles AI/import-generated nets that use pin
 * names (e.g. "PB0") instead of connector IDs (e.g. "pin1"). (BL-0014)
 */
export function resolvePinId(
  pin: string,
  instanceId: number,
  connectorsByInstance: Map<number, Connector[]>,
): string {
  const connectors = connectorsByInstance.get(instanceId);
  if (!connectors) { return pin; }
  // Direct match by ID — already correct
  if (connectors.some((c) => c.id === pin)) { return pin; }
  // Fallback: match by name (case-insensitive)
  const byName = connectors.find((c) => c.name.toLowerCase() === pin.toLowerCase());
  if (byName) { return byName.id; }
  // No match found — return as-is (will cause React Flow warning)
  return pin;
}

export function instanceToNode(
  row: CircuitInstanceRow,
  part: ComponentPart | undefined,
  subDesigns?: CircuitDesignRow[],
  portsByDesign?: Map<number, HierarchicalPortRow[]>,
  onEnterSheet?: (id: number) => void,
  onRefdesChange?: (newRefdes: string) => void,
): Node<InstanceNodeData | SheetNodeData> {
  // 1. Check if this is a hierarchical sub-sheet
  if (row.subDesignId) {
    const subDesign = subDesigns?.find(d => d.id === row.subDesignId);
    const ports = portsByDesign?.get(row.subDesignId) || [];

    return {
      id: `instance-${row.id}`,
      type: 'schematic-sheet',
      position: { x: row.schematicX, y: row.schematicY },
      data: {
        instanceId: row.id,
        subDesignId: row.subDesignId,
        referenceDesignator: row.referenceDesignator,
        sheetName: subDesign?.name || 'Sub-sheet',
        ports,
        onEnterSheet,
      },
    };
  }

  // 2. Otherwise it's a standard component instance
  const meta = (part?.meta ?? {}) as Partial<PartMeta>;
  const connectors = (part?.connectors ?? []) as Connector[];
  const views = (part?.views ?? {}) as Partial<PartViews>;
  const schematicShapes = (views.schematic?.shapes ?? []) as Shape[];

  return {
    id: `instance-${row.id}`,
    type: 'schematic-instance',
    position: { x: row.schematicX, y: row.schematicY },
    data: {
      instanceId: row.id,
      referenceDesignator: row.referenceDesignator,
      rotation: row.schematicRotation,
      partTitle: meta.title || 'Untitled',
      connectors,
      schematicShapes,
      onRefdesChange,
    },
  } as Node<InstanceNodeData>;
}

export function netToEdges(
  net: CircuitNetRow,
  connectorsByInstance: Map<number, Connector[]>,
  onNetNameChange?: (netId: number, newName: string) => void,
): Edge[] {
  const segments = (net.segments ?? []) as NetSegmentJSON[];
  const style = (net.style ?? {}) as { color?: string };

  return segments.map((seg) => {
    const fromPin = resolvePinId(seg.fromPin, seg.fromInstanceId, connectorsByInstance);
    const toPin = resolvePinId(seg.toPin, seg.toInstanceId, connectorsByInstance);
    return {
      // Stable ID derived from segment endpoints — survives reordering
      id: `net-${net.id}-${seg.fromInstanceId}:${seg.fromPin}-${seg.toInstanceId}:${seg.toPin}`,
      type: 'schematic-net',
      source: `instance-${seg.fromInstanceId}`,
      sourceHandle: `pin-${fromPin}`,
      target: `instance-${seg.toInstanceId}`,
      targetHandle: `pin-${toPin}`,
      data: {
        netName: net.name,
        netType: net.netType,
        color: style.color,
        busWidth: net.busWidth ?? undefined,
        netId: net.id,
        onNetNameChange,
      },
    };
  });
}

export function powerSymbolToNode(ps: PowerSymbol): Node<PowerNodeData> {
  return {
    id: `power-${ps.id}`,
    type: 'schematic-power',
    position: { x: ps.x, y: ps.y },
    data: {
      symbolId: ps.id,
      symbolType: ps.type,
      netName: ps.netName,
      rotation: ps.rotation,
      customLabel: ps.customLabel,
    },
  };
}

export function netLabelToNode(
  label: SchematicNetLabel,
  onNetNameChange?: (labelId: string, newName: string) => void,
): Node<NetLabelNodeData> {
  return {
    id: `netlabel-${label.id}`,
    type: 'schematic-net-label',
    position: { x: label.x, y: label.y },
    data: {
      labelId: label.id,
      netName: label.netName,
      rotation: label.rotation,
      onNetNameChange,
    },
  };
}

export function noConnectToNode(nc: NoConnectMarker): Node<NoConnectNodeData> {
  return {
    id: `noconnect-${nc.id}`,
    type: 'schematic-no-connect',
    position: { x: nc.x, y: nc.y },
    data: {
      markerId: nc.id,
      instanceId: nc.instanceId,
      pin: nc.pin,
    },
  };
}

export function annotationToNode(
  ann: SchematicAnnotation,
  onTextChange?: (id: string, text: string) => void,
  onFontSizeChange?: (id: string, fontSize: number) => void,
  onColorChange?: (id: string, color: string) => void,
): Node<AnnotationNodeData> {
  return {
    id: `annotation-${ann.id}`,
    type: 'schematic-annotation',
    position: { x: ann.x, y: ann.y },
    data: {
      annotationId: ann.id,
      text: ann.text,
      fontSize: ann.fontSize,
      color: ann.color,
      onTextChange,
      onFontSizeChange,
      onColorChange,
    },
  };
}
