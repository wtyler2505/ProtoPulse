/**
 * useBreadboardCoachPlan — custom hook extracting all coach plan resolution
 * logic from BreadboardCanvas into a focused, testable module.
 *
 * Pure extraction from BreadboardView.tsx — no behavior changes.
 */

import { useMemo } from 'react';
import {
  buildBreadboardCoachPlan,
  type BreadboardCoachHookup,
  type BreadboardCoachRailBridge,
  type BreadboardCoachSuggestion,
} from '@/lib/breadboard-coach-plan';
import { calculateBreadboardLayoutQuality } from '@/lib/breadboard-layout-quality';
import type { BreadboardLayoutQualityResult } from '@/lib/breadboard-layout-quality';
import type { BreadboardCoachActionItem } from './BreadboardPartInspector';
import type { BreadboardSelectedPartModel } from '@/lib/breadboard-part-inspector';
import {
  BB,
  type BreadboardCoord,
  type PixelPos,
  type TiePoint,
  type ComponentPlacement,
  coordToPixel,
  pixelToCoord,
  areConnected,
  checkCollision,
} from '@/lib/circuit-editor/breadboard-model';
import type { CircuitInstanceRow, CircuitNetRow, CircuitWireRow } from '@shared/schema';

// ---------------------------------------------------------------------------
// Exported interface types
// ---------------------------------------------------------------------------

export interface ResolvedCoachSuggestion extends BreadboardCoachSuggestion {
  anchor: TiePoint;
  placement: ComponentPlacement;
  pixel: PixelPos;
  targetPixels: PixelPos[];
}

export interface StagedCoachSuggestion extends BreadboardCoachSuggestion {
  instanceId: number;
  pixel: PixelPos;
  referenceDesignator: string;
  targetPixels: PixelPos[];
}

export interface ResolvedCoachHookup extends BreadboardCoachHookup {
  isRouted: boolean;
  netId: number | null;
  path: PixelPos[];
  railPixel: PixelPos;
  targetPixel: PixelPos;
}

export interface ResolvedCoachBridge extends BreadboardCoachRailBridge {
  isRouted: boolean;
  netId: number | null;
  path: PixelPos[];
  fromPixel: PixelPos;
  toPixel: PixelPos;
}

// ---------------------------------------------------------------------------
// Helper functions (only used by coach plan logic)
// ---------------------------------------------------------------------------

export function getCoachToneColor(tone: 'power' | 'communication' | 'control' | 'analog'): string {
  switch (tone) {
    case 'power':
      return '#fb7185';
    case 'communication':
      return '#22d3ee';
    case 'control':
      return '#f59e0b';
    case 'analog':
    default:
      return '#a3e635';
  }
}

export function getCoachHookupColor(netType: 'power' | 'ground'): string {
  return netType === 'power' ? '#fb7185' : '#38bdf8';
}

export function buildCoachHookupPath(railPixel: PixelPos, targetPixel: PixelPos): PixelPos[] {
  const elbowX = railPixel.x < targetPixel.x ? railPixel.x + 10 : railPixel.x - 10;
  const rawPath = [
    railPixel,
    { x: elbowX, y: railPixel.y },
    targetPixel,
  ];

  if (railPixel.y !== targetPixel.y) {
    rawPath.splice(2, 0, { x: elbowX, y: targetPixel.y });
  }

  return rawPath.filter((point, index) => index === 0 || point.x !== rawPath[index - 1]?.x || point.y !== rawPath[index - 1]?.y);
}

export function buildCoachRailBridgePath(fromPixel: PixelPos, toPixel: PixelPos): PixelPos[] {
  return (fromPixel.x <= toPixel.x ? [fromPixel, toPixel] : [toPixel, fromPixel]).filter(
    (point, index, points) => index === 0 || point.x !== points[index - 1]?.x || point.y !== points[index - 1]?.y,
  );
}

function pointsMatch(left: PixelPos[], right: PixelPos[]): boolean {
  return left.length === right.length && left.every((point, index) => point.x === right[index]?.x && point.y === right[index]?.y);
}

function reversePoints(points: PixelPos[]): PixelPos[] {
  return [...points].reverse();
}

function getWireEndpointCoords(points: PixelPos[]): [BreadboardCoord | null, BreadboardCoord | null] {
  if (points.length < 2) {
    return [null, null];
  }

  return [pixelToCoord(points[0]), pixelToCoord(points[points.length - 1])];
}

function wireMatchesCoachConnection(
  wire: CircuitWireRow,
  expectedNetId: number | null,
  endpointA: BreadboardCoord,
  endpointB: BreadboardCoord,
): boolean {
  if (expectedNetId == null || wire.netId !== expectedNetId) {
    return false;
  }

  const points = ((wire.points as Array<{ x: number; y: number }> | null) ?? []).map((point) => ({
    x: point.x,
    y: point.y,
  }));
  const [startCoord, endCoord] = getWireEndpointCoords(points);
  if (!startCoord || !endCoord) {
    return false;
  }

  return (
    (areConnected(startCoord, endpointA) && areConnected(endCoord, endpointB))
    || (areConnected(startCoord, endpointB) && areConnected(endCoord, endpointA))
  );
}

export function normalizeCoachNetName(name: string): string {
  return name.trim().toUpperCase();
}

export function findCoachNetId(
  nets: CircuitNetRow[] | undefined,
  hookup: Pick<BreadboardCoachHookup, 'netName' | 'netType'>,
): number | null {
  if (!nets || nets.length === 0) {
    return null;
  }

  const exactMatch = nets.find((net) => normalizeCoachNetName(net.name) === normalizeCoachNetName(hookup.netName));
  if (exactMatch) {
    return exactMatch.id;
  }

  const typedMatch = nets.find((net) => net.netType === hookup.netType);
  return typedMatch?.id ?? null;
}

export function getStarterRefDesPrefix(type: string): string {
  const lower = type.toLowerCase();
  if (lower === 'mcu' || lower === 'ic' || lower === 'microcontroller') {
    return 'U';
  }
  if (lower === 'resistor') {
    return 'R';
  }
  if (lower === 'capacitor') {
    return 'C';
  }
  if (lower === 'diode') {
    return 'D';
  }
  if (lower === 'transistor') {
    return 'Q';
  }
  if (lower === 'led') {
    return 'LED';
  }
  if (lower === 'switch') {
    return 'SW';
  }
  return lower.charAt(0).toUpperCase() || 'X';
}

function clampBreadboardRow(row: number, maxRow: number = BB.ROWS): number {
  return Math.max(1, Math.min(maxRow, row));
}

function buildPlacementForDrop(
  coord: TiePoint,
  type: string,
  pinCount: number,
): ComponentPlacement {
  const lower = type.toLowerCase();
  const dipLike = lower === 'ic' || lower === 'mcu' || lower === 'microcontroller';
  const rowSpan = dipLike ? Math.max(2, Math.ceil(Math.max(pinCount, 4) / 2)) : Math.max(1, Math.ceil(Math.max(pinCount, 2) / 2));
  const maxStartRow = Math.max(1, BB.ROWS - rowSpan + 1);

  return {
    refDes: `${type}-${coord.row}`,
    startCol: dipLike ? 'e' : coord.col,
    startRow: Math.min(coord.row, maxStartRow),
    rowSpan,
    crossesChannel: dipLike,
  };
}

export function resolveCoachSuggestionPlacement(
  suggestion: BreadboardCoachSuggestion,
  placements: ComponentPlacement[],
  targetPixels: PixelPos[],
): ResolvedCoachSuggestion | null {
  const rowOffsets = [0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5];

  for (const offset of rowOffsets) {
    for (const col of suggestion.preferredColumns) {
      const anchor: TiePoint = {
        type: 'terminal',
        col,
        row: clampBreadboardRow(
          suggestion.desiredAnchor.row + offset,
          suggestion.type === 'capacitor' ? BB.ROWS - 1 : BB.ROWS,
        ),
      };
      const placement = buildPlacementForDrop(anchor, suggestion.type, 2);
      const candidatePlacement = {
        ...placement,
        refDes: suggestion.id,
      };
      if (checkCollision(candidatePlacement, placements)) {
        continue;
      }

      return {
        ...suggestion,
        anchor,
        placement: candidatePlacement,
        pixel: coordToPixel({
          type: 'terminal',
          col: candidatePlacement.startCol,
          row: candidatePlacement.startRow,
        }),
        targetPixels,
      };
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Hook input / output types
// ---------------------------------------------------------------------------

interface UseBreadboardCoachPlanInput {
  selectedInstanceModel: BreadboardSelectedPartModel | null;
  selectedPlacedInstance: CircuitInstanceRow | null;
  instances: CircuitInstanceRow[] | undefined;
  instancePlacements: Array<{ instanceId: number; placement: ComponentPlacement }>;
  breadboardWires: CircuitWireRow[];
  nets: CircuitNetRow[] | undefined;
  projectName: string;
}

interface UseBreadboardCoachPlanResult {
  coachPlan: ReturnType<typeof buildBreadboardCoachPlan> | null;
  existingCoachPlanKeys: Set<string>;
  resolvedCoachSuggestions: ResolvedCoachSuggestion[];
  stagedCoachSuggestions: StagedCoachSuggestion[];
  preparedCoachHookups: ResolvedCoachHookup[];
  resolvedCoachHookups: ResolvedCoachHookup[];
  preparedCoachBridges: ResolvedCoachBridge[];
  resolvedCoachBridges: ResolvedCoachBridge[];
  nearbyBenchContext: { nearbyForeignPartCount: number; nearbyWireCount: number };
  benchLayoutQuality: BreadboardLayoutQualityResult | null;
  coachActionCount: number;
  coachActionItems: BreadboardCoachActionItem[];
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useBreadboardCoachPlan({
  selectedInstanceModel,
  selectedPlacedInstance,
  instances,
  instancePlacements,
  breadboardWires,
  nets,
}: UseBreadboardCoachPlanInput): UseBreadboardCoachPlanResult {
  const coachPlan = useMemo(
    () => (selectedInstanceModel ? buildBreadboardCoachPlan(selectedInstanceModel) : null),
    [selectedInstanceModel],
  );

  const existingCoachPlanKeys = useMemo(() => {
    if (!instances || !selectedInstanceModel) {
      return new Set<string>();
    }

    return new Set(
      instances
        .map((instance) => instance.properties as Record<string, unknown> | null)
        .filter((properties) => properties?.coachPlanFor === selectedInstanceModel.refDes)
        .map((properties) => String(properties?.coachPlanKey ?? ''))
        .filter((value) => value.length > 0),
    );
  }, [instances, selectedInstanceModel]);

  const resolvedCoachSuggestions = useMemo(() => {
    if (!coachPlan || !selectedInstanceModel) {
      return [];
    }

    const placements = [...instancePlacements.map((entry) => entry.placement)];
    const targetPixelMap = new Map(selectedInstanceModel.pins.map((pin) => [pin.id, pin.pixel]));
    const resolved: ResolvedCoachSuggestion[] = [];

    for (const suggestion of coachPlan.suggestions) {
      if (existingCoachPlanKeys.has(suggestion.id)) {
        continue;
      }
      const targetPixels = suggestion.targetPinIds
        .map((pinId) => targetPixelMap.get(pinId))
        .filter((pixel): pixel is PixelPos => Boolean(pixel));
      const candidate = resolveCoachSuggestionPlacement(suggestion, placements, targetPixels);
      if (!candidate) {
        continue;
      }
      placements.push(candidate.placement);
      resolved.push(candidate);
    }

    return resolved;
  }, [coachPlan, existingCoachPlanKeys, instancePlacements, selectedInstanceModel]);

  const stagedCoachSuggestions = useMemo((): StagedCoachSuggestion[] => {
    if (!coachPlan || !instances || !selectedInstanceModel) {
      return [];
    }

    const targetPixelMap = new Map(selectedInstanceModel.pins.map((pin) => [pin.id, pin.pixel]));

    return coachPlan.suggestions.flatMap((suggestion) => {
      if (!existingCoachPlanKeys.has(suggestion.id)) {
        return [];
      }

      const stagedInstance = instances.find((instance) => {
        const properties = instance.properties as Record<string, unknown> | null;
        return (
          properties?.coachPlanFor === selectedInstanceModel.refDes
          && properties?.coachPlanKey === suggestion.id
          && instance.breadboardX != null
          && instance.breadboardY != null
        );
      });

      if (!stagedInstance || stagedInstance.breadboardX == null || stagedInstance.breadboardY == null) {
        return [];
      }

      const targetPixels = suggestion.targetPinIds
        .map((pinId) => targetPixelMap.get(pinId))
        .filter((pixel): pixel is PixelPos => Boolean(pixel));

      return [{
        ...suggestion,
        instanceId: stagedInstance.id,
        pixel: {
          x: stagedInstance.breadboardX,
          y: stagedInstance.breadboardY,
        },
        referenceDesignator: stagedInstance.referenceDesignator,
        targetPixels,
      }];
    });
  }, [coachPlan, existingCoachPlanKeys, instances, selectedInstanceModel]);

  const preparedCoachHookups = useMemo((): ResolvedCoachHookup[] => {
    if (!coachPlan || !selectedInstanceModel) {
      return [];
    }

    const pinPixelMap = new Map(selectedInstanceModel.pins.map((pin) => [pin.id, pin.pixel]));

    return coachPlan.hookups
      .map((hookup) => {
        const targetPixel = pinPixelMap.get(hookup.targetPinId);
        if (!targetPixel) {
          return null;
        }

        const railPixel = coordToPixel(hookup.railPoint);
        const path = buildCoachHookupPath(railPixel, targetPixel);
        const targetCoord = selectedInstanceModel.pins.find((pin) => pin.id === hookup.targetPinId)?.coord;
        const resolvedNetId = findCoachNetId(nets, hookup);
        const alreadyRouted = breadboardWires.some((wire) => {
          const points = ((wire.points as Array<{ x: number; y: number }> | null) ?? []).map((point) => ({
            x: point.x,
            y: point.y,
          }));
          return (
            pointsMatch(points, path)
            || pointsMatch(points, reversePoints(path))
            || (
              targetCoord != null
              && wireMatchesCoachConnection(wire, resolvedNetId, hookup.railPoint, targetCoord)
            )
          );
        });

        return {
          ...hookup,
          isRouted: alreadyRouted,
          netId: resolvedNetId,
          path,
          railPixel,
          targetPixel,
        };
      })
      .filter((hookup): hookup is ResolvedCoachHookup => Boolean(hookup));
  }, [breadboardWires, coachPlan, nets, selectedInstanceModel]);

  const resolvedCoachHookups = useMemo(
    () => preparedCoachHookups.filter((hookup) => !hookup.isRouted),
    [preparedCoachHookups],
  );

  const preparedCoachBridges = useMemo((): ResolvedCoachBridge[] => {
    if (!coachPlan) {
      return [];
    }

    return coachPlan.bridges
      .map((bridge) => {
        const fromPixel = coordToPixel(bridge.fromRail);
        const toPixel = coordToPixel(bridge.toRail);
        const path = buildCoachRailBridgePath(fromPixel, toPixel);
        const resolvedNetId = findCoachNetId(nets, bridge);
        const alreadyRouted = breadboardWires.some((wire) => {
          const points = ((wire.points as Array<{ x: number; y: number }> | null) ?? []).map((point) => ({
            x: point.x,
            y: point.y,
          }));
          return (
            pointsMatch(points, path)
            || pointsMatch(points, reversePoints(path))
            || wireMatchesCoachConnection(wire, resolvedNetId, bridge.fromRail, bridge.toRail)
          );
        });

        return {
          ...bridge,
          isRouted: alreadyRouted,
          netId: resolvedNetId,
          path,
          fromPixel,
          toPixel,
        };
      })
      .filter((bridge): bridge is ResolvedCoachBridge => Boolean(bridge));
  }, [breadboardWires, coachPlan, nets]);

  const resolvedCoachBridges = useMemo(
    () => preparedCoachBridges.filter((bridge) => !bridge.isRouted),
    [preparedCoachBridges],
  );

  const nearbyBenchContext = useMemo(() => {
    if (!instances || !selectedInstanceModel || !selectedPlacedInstance) {
      return { nearbyForeignPartCount: 0, nearbyWireCount: 0 };
    }

    const anchorX = selectedPlacedInstance.breadboardX ?? selectedInstanceModel.pins[0]?.pixel.x ?? 0;
    const anchorY = selectedPlacedInstance.breadboardY ?? selectedInstanceModel.pins[0]?.pixel.y ?? 0;
    const partRadiusX = 42;
    const partRadiusY = 24;
    const wireRadiusX = 48;
    const wireRadiusY = 28;

    const nearbyForeignPartCount = instances.filter((instance) => {
      if (instance.id === selectedPlacedInstance.id || instance.breadboardX == null || instance.breadboardY == null) {
        return false;
      }

      const properties = (instance.properties as Record<string, unknown> | null) ?? null;
      const isCoachSupport =
        properties?.coachPlanFor === selectedInstanceModel.refDes
        && typeof properties.coachPlanKey === 'string'
        && properties.coachPlanKey.startsWith('support-');
      if (isCoachSupport) {
        return false;
      }

      return (
        Math.abs(instance.breadboardX - anchorX) <= partRadiusX
        && Math.abs(instance.breadboardY - anchorY) <= partRadiusY
      );
    }).length;

    const nearbyWireCount = breadboardWires.filter((wire) => {
      const points = ((wire.points as Array<{ x: number; y: number }> | null) ?? []);
      return points.some((point) => (
        Math.abs(point.x - anchorX) <= wireRadiusX
        && Math.abs(point.y - anchorY) <= wireRadiusY
      ));
    }).length;

    return {
      nearbyForeignPartCount,
      nearbyWireCount,
    };
  }, [breadboardWires, instances, selectedInstanceModel, selectedPlacedInstance]);

  const benchLayoutQuality = useMemo(
    () => (
      selectedInstanceModel
        ? calculateBreadboardLayoutQuality({
            expectedBridgeCount: preparedCoachBridges.length,
            expectedHookupCount: preparedCoachHookups.length,
            expectedSupportCount: coachPlan?.suggestions.length ?? 0,
            model: selectedInstanceModel,
            nearbyForeignPartCount: nearbyBenchContext.nearbyForeignPartCount,
            nearbyWireCount: nearbyBenchContext.nearbyWireCount,
            stagedBridgeCount: preparedCoachBridges.filter((bridge) => bridge.isRouted).length,
            stagedHookupCount: preparedCoachHookups.filter((hookup) => hookup.isRouted).length,
            stagedSupportCount: stagedCoachSuggestions.length,
          })
        : null
    ),
    [coachPlan, nearbyBenchContext, preparedCoachBridges, preparedCoachHookups, selectedInstanceModel, stagedCoachSuggestions],
  );

  const coachActionCount = resolvedCoachSuggestions.length + resolvedCoachHookups.length + resolvedCoachBridges.length;

  const coachActionItems = useMemo((): BreadboardCoachActionItem[] => {
    if (!coachPlan || !selectedInstanceModel) {
      return [];
    }

    const pinLabelMap = new Map(selectedInstanceModel.pins.map((pin) => [pin.id, pin.label]));
    const pendingSupportIds = new Set(resolvedCoachSuggestions.map((suggestion) => suggestion.id));

    const supportActions = coachPlan.suggestions.flatMap((suggestion): BreadboardCoachActionItem[] => {
      const targetLabels = suggestion.targetPinIds
        .map((pinId) => pinLabelMap.get(pinId))
        .filter((label): label is string => Boolean(label));
      const detail = targetLabels.length > 0
        ? `${suggestion.reason} Targets: ${targetLabels.join(' + ')}.`
        : suggestion.reason;

      if (existingCoachPlanKeys.has(suggestion.id)) {
        return [{
          id: suggestion.id,
          detail,
          label: suggestion.label,
          status: 'staged',
          tone: suggestion.id === 'support-control-pull' ? 'control' : 'support',
        }];
      }

      if (!pendingSupportIds.has(suggestion.id)) {
        return [];
      }

      return [{
        id: suggestion.id,
        detail,
        label: suggestion.label,
        status: 'pending',
        tone: suggestion.id === 'support-control-pull' ? 'control' : 'support',
      }];
    });

    const hookupActions = preparedCoachHookups.map((hookup) => ({
      id: hookup.id,
      detail: `${hookup.reason} Target pin: ${pinLabelMap.get(hookup.targetPinId) ?? hookup.targetPinId}.`,
      label: `${hookup.netName} rail jumper`,
      status: hookup.isRouted ? 'staged' as const : 'pending' as const,
      tone: hookup.netType === 'power' ? 'power' as const : 'ground' as const,
    }));

    const bridgeActions = preparedCoachBridges.map((bridge) => ({
      id: bridge.id,
      detail: `${bridge.reason} Bridge row: ${String(bridge.fromRail.index + 1)}.`,
      label: `${bridge.netName} rail bridge`,
      status: bridge.isRouted ? 'staged' as const : 'pending' as const,
      tone: bridge.netType === 'power' ? 'power' as const : 'ground' as const,
    }));

    const corridorActions = coachPlan.corridorHints.map((hint) => ({
      id: hint.id,
      detail: `${hint.label} across rows ${String(hint.rows[0])}–${String(hint.rows[1])} on the ${hint.side} bench lane.`,
      label: hint.label,
      status: 'advisory' as const,
      tone: hint.tone,
    }));

    const statusRank = { pending: 0, staged: 1, advisory: 2 } as const;
    return [...hookupActions, ...bridgeActions, ...supportActions, ...corridorActions].sort((left, right) => {
      const statusDelta = statusRank[left.status] - statusRank[right.status];
      if (statusDelta !== 0) {
        return statusDelta;
      }
      return left.label.localeCompare(right.label);
    });
  }, [
    coachPlan,
    existingCoachPlanKeys,
    preparedCoachBridges,
    preparedCoachHookups,
    resolvedCoachSuggestions,
    selectedInstanceModel,
  ]);

  return {
    coachPlan,
    existingCoachPlanKeys,
    resolvedCoachSuggestions,
    stagedCoachSuggestions,
    preparedCoachHookups,
    resolvedCoachHookups,
    preparedCoachBridges,
    resolvedCoachBridges,
    nearbyBenchContext,
    benchLayoutQuality,
    coachActionCount,
    coachActionItems,
  };
}
