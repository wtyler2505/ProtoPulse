/**
 * Pure helpers for the breadboard canvas.
 *
 * Extracted from breadboard-canvas/index.tsx (audit #32, phase 2 — W1.12b).
 * Zero React deps. Zero state. Deterministic, unit-testable.
 */

import {
  BB,
  checkCollision,
  coordToPixel,
  type BreadboardCoord,
  type ColumnLetter,
  type ComponentPlacement,
  type PixelPos,
  type TiePoint,
} from '@/lib/circuit-editor/breadboard-model';
import type { CircuitInstanceRow, ComponentPart } from '@shared/schema';
import type { PartMeta } from '@shared/component-types';
import {
  getBreadboardInstancePlacement,
  type BreadboardInstanceProvenance,
} from '@/lib/breadboard-instance-provenance';

// ---------------------------------------------------------------------------
// Types (canvas-local)
// ---------------------------------------------------------------------------

export type Tool = 'select' | 'wire' | 'delete';

export interface WireInProgress {
  netId: number;
  points: PixelPos[];
  coordPath: import('@/lib/circuit-editor/breadboard-model').BreadboardCoord[];
  endpointPath: Array<import('@/lib/circuit-editor/bench-surface-model').WireEndpoint | null>;
  color: string;
}

export interface AutoPlacementPlan {
  id: number;
  breadboardX: number;
  breadboardY: number;
}

type CanvasDropProvenance = Extract<BreadboardInstanceProvenance, 'project' | 'starter'>;

export interface BreadboardCanvasDropProperties extends Record<string, string> {
  breadboardProvenance: CanvasDropProvenance;
  label: string;
  type: string;
}

export type BreadboardCanvasInstanceDraft = {
  circuitId: number;
  partId: number | null;
  referenceDesignator: string;
  properties: BreadboardCanvasDropProperties;
} & (
  | { benchX: number; benchY: number }
  | { breadboardX: number; breadboardY: number }
);

interface BuildProjectDropInstanceDraftInput {
  circuitId: number;
  partId: number;
  referenceDesignator: string;
  label: string;
  type: string;
  placementMode: 'bench' | 'board';
  pixel: PixelPos;
}

interface BuildStarterDropInstanceDraftInput {
  circuitId: number;
  referenceDesignator: string;
  label: string;
  type: string;
  pixel: PixelPos;
}

interface ResolveBoardDropPlacementInput {
  coord: BreadboardCoord | null | undefined;
  type: string;
  pinCount: number;
  existingPlacements: ComponentPlacement[];
}

export interface BoardDropPlacementResolution {
  placement: ComponentPlacement;
  snapPx: PixelPos;
}

interface DragTypeList {
  includes(type: string): boolean;
}

interface DragDataReader {
  getData(type: string): string;
}

export interface BreadboardDropMimeTypes {
  projectPart: string;
  starterType: string;
  starterLabel: string;
}

export interface BreadboardProjectPartDropData {
  partId: number;
}

export interface BreadboardStarterDropData {
  nodeType: string;
  label: string;
}

// ---------------------------------------------------------------------------
// Drag payload parsing
// ---------------------------------------------------------------------------

export function hasBreadboardDropPayloadType(
  types: DragTypeList,
  mimeTypes: Pick<BreadboardDropMimeTypes, 'projectPart' | 'starterType'>,
): boolean {
  return types.includes(mimeTypes.projectPart) || types.includes(mimeTypes.starterType);
}

export function readProjectPartDropData(
  dataTransfer: DragDataReader,
  mimeType: string,
): BreadboardProjectPartDropData | null {
  const raw = dataTransfer.getData(mimeType);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as { partId?: unknown };
    return typeof parsed.partId === 'number' && Number.isFinite(parsed.partId)
      ? { partId: parsed.partId }
      : null;
  } catch {
    return null;
  }
}

export function readStarterDropData(
  dataTransfer: DragDataReader,
  mimeTypes: Pick<BreadboardDropMimeTypes, 'starterType' | 'starterLabel'>,
): BreadboardStarterDropData | null {
  const nodeType = dataTransfer.getData(mimeTypes.starterType);
  if (!nodeType) {
    return null;
  }

  return {
    nodeType,
    label: dataTransfer.getData(mimeTypes.starterLabel),
  };
}

// ---------------------------------------------------------------------------
// Instance classification
// ---------------------------------------------------------------------------

export function getCanvasBenchInstances(
  instances: CircuitInstanceRow[] | undefined | null,
): CircuitInstanceRow[] {
  return (instances ?? []).filter((instance) => getBreadboardInstancePlacement(instance) === 'bench');
}

// ---------------------------------------------------------------------------
// Auto-placement template building
// ---------------------------------------------------------------------------

export function buildAutoPlacementTemplate(
  inst: CircuitInstanceRow,
  part?: ComponentPart,
): ComponentPlacement {
  const meta = (part?.meta as Record<string, unknown> | null) ?? null;
  const properties = (inst.properties as Record<string, unknown> | null) ?? null;
  const rawType = String(meta?.type ?? properties?.type ?? '').toLowerCase();
  const pinCount = (part?.connectors as unknown[])?.length ?? 2;
  const isDipLike = rawType === 'ic' || rawType === 'mcu' || inst.referenceDesignator.startsWith('U');
  const rowSpan = isDipLike
    ? Math.max(2, Math.ceil(pinCount / 2))
    : Math.max(1, Math.ceil(pinCount / 2));

  return {
    refDes: inst.referenceDesignator,
    startCol: isDipLike ? 'e' : 'a',
    startRow: 1,
    rowSpan,
    crossesChannel: isDipLike,
  };
}

export function findAutoPlacement(
  template: ComponentPlacement,
  existingPlacements: ComponentPlacement[],
): ComponentPlacement | null {
  const maxStartRow = BB.ROWS - template.rowSpan + 1;

  for (let startRow = 1; startRow <= maxStartRow; startRow += 1) {
    const candidate: ComponentPlacement = { ...template, startRow };
    if (!checkCollision(candidate, existingPlacements)) {
      return candidate;
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Drop-target placement
// ---------------------------------------------------------------------------

export function isDipLikeType(type: string): boolean {
  const lower = type.toLowerCase();
  return lower === 'ic' || lower === 'mcu' || lower === 'microcontroller';
}

export function buildPlacementForDrop(
  coord: TiePoint,
  type: string,
  pinCount: number,
): ComponentPlacement {
  const dipLike = isDipLikeType(type);
  const rowSpan = dipLike
    ? Math.max(2, Math.ceil(Math.max(pinCount, 4) / 2))
    : Math.max(1, Math.ceil(Math.max(pinCount, 2) / 2));
  const maxStartRow = Math.max(1, BB.ROWS - rowSpan + 1);

  return {
    refDes: `${type}-${coord.row}`,
    startCol: dipLike ? 'e' : coord.col,
    startRow: Math.min(coord.row, maxStartRow),
    rowSpan,
    crossesChannel: dipLike,
  };
}

export function resolveBoardDropPlacement({
  coord,
  type,
  pinCount,
  existingPlacements,
}: ResolveBoardDropPlacementInput): BoardDropPlacementResolution | null {
  if (!coord || coord.type !== 'terminal') {
    return null;
  }

  const placement = buildPlacementForDrop(coord, type, pinCount);
  if (checkCollision(placement, existingPlacements)) {
    return null;
  }

  return {
    placement,
    snapPx: coordToPixel({
      type: 'terminal',
      col: placement.startCol,
      row: placement.startRow,
    }),
  };
}

// ---------------------------------------------------------------------------
// Part → drop-type resolution
// (Moved here from BreadboardView.tsx to break the circular import.)
// ---------------------------------------------------------------------------

export function getDropTypeFromPart(
  part: ComponentPart | undefined,
  fallbackType: string,
): string {
  const meta = (part?.meta ?? {}) as Partial<PartMeta> & Record<string, unknown>;
  const candidate = meta.type ?? meta.family ?? fallbackType;
  return typeof candidate === 'string' && candidate.trim().length > 0 ? candidate : fallbackType;
}

// ---------------------------------------------------------------------------
// Drop mutation draft building
// ---------------------------------------------------------------------------

export function buildProjectDropInstanceDraft({
  circuitId,
  partId,
  referenceDesignator,
  label,
  type,
  placementMode,
  pixel,
}: BuildProjectDropInstanceDraftInput): BreadboardCanvasInstanceDraft {
  const base = {
    circuitId,
    partId,
    referenceDesignator,
    properties: {
      breadboardProvenance: 'project',
      label,
      type,
    },
  } satisfies Omit<BreadboardCanvasInstanceDraft, 'benchX' | 'benchY' | 'breadboardX' | 'breadboardY'>;

  if (placementMode === 'bench') {
    return {
      ...base,
      benchX: pixel.x,
      benchY: pixel.y,
    };
  }

  return {
    ...base,
    breadboardX: pixel.x,
    breadboardY: pixel.y,
  };
}

export function buildStarterDropInstanceDraft({
  circuitId,
  referenceDesignator,
  label,
  type,
  pixel,
}: BuildStarterDropInstanceDraftInput): BreadboardCanvasInstanceDraft {
  return {
    circuitId,
    partId: null,
    referenceDesignator,
    breadboardX: pixel.x,
    breadboardY: pixel.y,
    properties: {
      breadboardProvenance: 'starter',
      type,
      label: label || type,
    },
  };
}

// ---------------------------------------------------------------------------
// Anchor pixel for a placement's starting tie-point
// ---------------------------------------------------------------------------

export function placementAnchorPixel(placement: ComponentPlacement): PixelPos {
  return coordToPixel({
    type: 'terminal',
    col: placement.startCol as ColumnLetter,
    row: placement.startRow,
  });
}

// ---------------------------------------------------------------------------
// Wire color palette (general purpose)
// ---------------------------------------------------------------------------

export const WIRE_COLORS = [
  '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6',
  '#1abc9c', '#e67e22', '#34495e', '#e91e63', '#00bcd4',
] as const;
