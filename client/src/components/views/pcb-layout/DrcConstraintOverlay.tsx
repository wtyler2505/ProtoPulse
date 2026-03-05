/**
 * DrcConstraintOverlay — SVG overlay layer rendering DRC constraint zones:
 * clearance rings around components, violation highlights, net highlighting,
 * and board edge clearance indicators.
 *
 * React.memo wrapped for render performance. No interaction logic.
 */

import { memo, useMemo } from 'react';
import type { CircuitInstanceRow } from '@shared/schema';
import type { DRCViolation, DRCRule } from '@shared/component-types';
import type { NetRecord, NetSegment } from './ComponentPlacer';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default clearance radius in SVG units when no rule specifies one. */
const DEFAULT_CLEARANCE_RADIUS = 5;

/** Default board edge clearance in SVG units. */
const DEFAULT_BOARD_EDGE_CLEARANCE = 10;

/** Clearance zone colors. */
const CLEARANCE_FILL = 'rgba(251,191,36,0.15)';
const CLEARANCE_STROKE = 'rgba(251,191,36,0.6)';

/** Violation highlight colors. */
const VIOLATION_FILL = 'rgba(239,68,68,0.3)';
const VIOLATION_STROKE = 'rgb(239,68,68)';

/** Net highlight color (neon cyan). */
const NET_HIGHLIGHT_COLOR = '#00F0FF';
const NET_HIGHLIGHT_OPACITY = 0.4;

/** Board edge clearance colors. */
const EDGE_CLEARANCE_STROKE = 'rgba(251,191,36,0.4)';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ClearanceRule {
  /** Minimum clearance distance in SVG units. */
  clearance: number;
  /** Rule type this clearance corresponds to. */
  ruleType?: string;
}

export interface DrcConstraintOverlayProps {
  instances: CircuitInstanceRow[];
  violations: DRCViolation[];
  selectedInstanceId?: number | null;
  nets?: NetRecord[];
  boardWidth: number;
  boardHeight: number;
  scale: number;
  offsetX: number;
  offsetY: number;
  clearanceRules: ClearanceRule[];
  visible: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Footprint bounding box half-dimensions (matches the 8x12 placeholder in PCBBoardRenderer). */
const FOOTPRINT_HALF_W = 4;
const FOOTPRINT_HALF_H = 6;

function getClearanceRadius(rules: ClearanceRule[]): number {
  if (rules.length === 0) {
    return DEFAULT_CLEARANCE_RADIUS;
  }
  return Math.max(...rules.map((r) => r.clearance));
}

function getViolationsForInstance(violations: DRCViolation[], instanceId: number): DRCViolation[] {
  const idStr = String(instanceId);
  return violations.filter(
    (v) => v.shapeIds.includes(idStr) || (v.location.x !== 0 && v.location.y !== 0),
  );
}

function getViolationsAtLocation(
  violations: DRCViolation[],
  x: number,
  y: number,
  radius: number,
): DRCViolation[] {
  return violations.filter((v) => {
    const dx = v.location.x - x;
    const dy = v.location.y - y;
    return Math.sqrt(dx * dx + dy * dy) <= radius;
  });
}

/** Get all instance IDs connected to the same nets as the selected instance. */
function getNetConnectedInstanceIds(
  selectedInstanceId: number,
  nets: NetRecord[],
): Set<number> {
  const connected = new Set<number>();
  for (const net of nets) {
    const segments = (net.segments ?? []) as NetSegment[];
    const inNet = segments.some(
      (seg) => seg.fromInstanceId === selectedInstanceId || seg.toInstanceId === selectedInstanceId,
    );
    if (inNet) {
      for (const seg of segments) {
        connected.add(seg.fromInstanceId);
        connected.add(seg.toInstanceId);
      }
    }
  }
  connected.delete(selectedInstanceId);
  return connected;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Clearance ring around a single placed component. */
const ClearanceRing = memo(function ClearanceRing({
  x,
  y,
  rotation,
  clearance,
}: {
  x: number;
  y: number;
  rotation: number;
  clearance: number;
}) {
  const halfW = FOOTPRINT_HALF_W + clearance;
  const halfH = FOOTPRINT_HALF_H + clearance;

  return (
    <rect
      x={-halfW}
      y={-halfH}
      width={halfW * 2}
      height={halfH * 2}
      rx={1}
      fill={CLEARANCE_FILL}
      stroke={CLEARANCE_STROKE}
      strokeWidth={0.4}
      strokeDasharray="2,1.5"
      transform={`translate(${x}, ${y}) rotate(${rotation})`}
      data-testid={`drc-clearance-ring`}
    />
  );
});

/** Violation highlight ring around a component. */
const ViolationHighlight = memo(function ViolationHighlight({
  x,
  y,
  rotation,
  severity,
}: {
  x: number;
  y: number;
  rotation: number;
  severity: 'error' | 'warning';
}) {
  const radius = FOOTPRINT_HALF_H + 3;
  const fill = severity === 'error' ? VIOLATION_FILL : 'rgba(251,191,36,0.2)';
  const stroke = severity === 'error' ? VIOLATION_STROKE : 'rgba(251,191,36,0.8)';

  return (
    <rect
      x={-(FOOTPRINT_HALF_W + 3)}
      y={-radius}
      width={(FOOTPRINT_HALF_W + 3) * 2}
      height={radius * 2}
      rx={2}
      fill={fill}
      stroke={stroke}
      strokeWidth={0.6}
      transform={`translate(${x}, ${y}) rotate(${rotation})`}
      data-testid={`drc-violation-highlight`}
    >
      <animate
        attributeName="opacity"
        values="1;0.5;1"
        dur="2s"
        repeatCount="indefinite"
      />
    </rect>
  );
});

/** Net highlight ring around a connected component. */
const NetHighlight = memo(function NetHighlight({
  x,
  y,
  rotation,
}: {
  x: number;
  y: number;
  rotation: number;
}) {
  return (
    <rect
      x={-(FOOTPRINT_HALF_W + 2)}
      y={-(FOOTPRINT_HALF_H + 2)}
      width={(FOOTPRINT_HALF_W + 2) * 2}
      height={(FOOTPRINT_HALF_H + 2) * 2}
      rx={1.5}
      fill={NET_HIGHLIGHT_COLOR}
      fillOpacity={NET_HIGHLIGHT_OPACITY}
      stroke={NET_HIGHLIGHT_COLOR}
      strokeWidth={0.5}
      strokeOpacity={0.7}
      transform={`translate(${x}, ${y}) rotate(${rotation})`}
      data-testid={`drc-net-highlight`}
    />
  );
});

/** Board edge clearance zone — dashed inner border. */
const BoardEdgeClearance = memo(function BoardEdgeClearance({
  boardWidth,
  boardHeight,
  edgeClearance,
}: {
  boardWidth: number;
  boardHeight: number;
  edgeClearance: number;
}) {
  if (edgeClearance <= 0) {
    return null;
  }

  return (
    <rect
      x={edgeClearance}
      y={edgeClearance}
      width={Math.max(0, boardWidth - edgeClearance * 2)}
      height={Math.max(0, boardHeight - edgeClearance * 2)}
      fill="none"
      stroke={EDGE_CLEARANCE_STROKE}
      strokeWidth={0.5}
      strokeDasharray="6,3"
      data-testid="drc-board-edge-clearance"
    />
  );
});

// ---------------------------------------------------------------------------
// Main overlay
// ---------------------------------------------------------------------------

const DrcConstraintOverlay = memo(function DrcConstraintOverlay({
  instances,
  violations,
  selectedInstanceId,
  nets,
  boardWidth,
  boardHeight,
  clearanceRules,
  visible,
}: DrcConstraintOverlayProps) {
  const clearanceRadius = useMemo(() => getClearanceRadius(clearanceRules), [clearanceRules]);

  const edgeClearance = useMemo(() => {
    const edgeRule = clearanceRules.find((r) => r.ruleType === 'board_edge_clearance');
    return edgeRule?.clearance ?? DEFAULT_BOARD_EDGE_CLEARANCE;
  }, [clearanceRules]);

  const placedInstances = useMemo(
    () => instances.filter((inst) => inst.pcbX != null && inst.pcbY != null),
    [instances],
  );

  const violationInstanceIds = useMemo(() => {
    const map = new Map<number, DRCViolation>();
    for (const v of violations) {
      for (const shapeId of v.shapeIds) {
        const id = parseInt(shapeId, 10);
        if (!isNaN(id)) {
          const existing = map.get(id);
          if (!existing || v.severity === 'error') {
            map.set(id, v);
          }
        }
      }
    }
    // Also match by proximity to placed instances
    for (const inst of placedInstances) {
      if (!map.has(inst.id)) {
        const nearby = getViolationsAtLocation(
          violations,
          inst.pcbX!,
          inst.pcbY!,
          FOOTPRINT_HALF_H + clearanceRadius,
        );
        if (nearby.length > 0) {
          map.set(inst.id, nearby[0]);
        }
      }
    }
    return map;
  }, [violations, placedInstances, clearanceRadius]);

  const connectedInstanceIds = useMemo(() => {
    if (selectedInstanceId == null || !nets) {
      return new Set<number>();
    }
    return getNetConnectedInstanceIds(selectedInstanceId, nets);
  }, [selectedInstanceId, nets]);

  if (!visible) {
    return null;
  }

  return (
    <g data-testid="drc-constraint-overlay">
      {/* Board edge clearance zone */}
      <BoardEdgeClearance
        boardWidth={boardWidth}
        boardHeight={boardHeight}
        edgeClearance={edgeClearance}
      />

      {/* Clearance rings for all placed components */}
      {placedInstances.map((inst) => (
        <ClearanceRing
          key={`clearance-${inst.id}`}
          x={inst.pcbX!}
          y={inst.pcbY!}
          rotation={inst.pcbRotation ?? 0}
          clearance={clearanceRadius}
        />
      ))}

      {/* Violation highlights */}
      {placedInstances.map((inst) => {
        const violation = violationInstanceIds.get(inst.id);
        if (!violation) {
          return null;
        }
        return (
          <ViolationHighlight
            key={`violation-${inst.id}`}
            x={inst.pcbX!}
            y={inst.pcbY!}
            rotation={inst.pcbRotation ?? 0}
            severity={violation.severity}
          />
        );
      })}

      {/* Net highlighting for selected component connections */}
      {placedInstances.map((inst) => {
        if (!connectedInstanceIds.has(inst.id)) {
          return null;
        }
        return (
          <NetHighlight
            key={`net-${inst.id}`}
            x={inst.pcbX!}
            y={inst.pcbY!}
            rotation={inst.pcbRotation ?? 0}
          />
        );
      })}
    </g>
  );
});

export { DrcConstraintOverlay };
