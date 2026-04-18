import { computeShapesBounds } from '@/components/circuit-editor/PartSymbolRenderer';
import { shouldPreferExactBreadboardView } from '@shared/component-trust';
import type { Connector, Shape } from '@shared/component-types';
import type { CircuitInstanceRow, ComponentPart } from '@shared/schema';

export interface BenchConnectorAnchorPosition {
  instanceId: number;
  connectorId: string;
  pinId: string;
  x: number;
  y: number;
  localX: number;
  localY: number;
}

function rotatePoint(point: { x: number; y: number }, degrees: number): { x: number; y: number } {
  if (degrees === 0) {
    return point;
  }

  const radians = (degrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);

  return {
    x: point.x * cos - point.y * sin,
    y: point.x * sin + point.y * cos,
  };
}

export function getBenchConnectorAnchorPositions(
  instance: CircuitInstanceRow,
  part?: ComponentPart,
): BenchConnectorAnchorPosition[] {
  if (instance.benchX == null || instance.benchY == null) {
    return [];
  }

  const meta = (part?.meta as Record<string, unknown> | undefined) ?? {};
  const exactShapes = (((part?.views as { breadboard?: { shapes?: unknown[] } } | undefined)?.breadboard?.shapes ?? []) as unknown[])
    .filter((shape): shape is Shape => shape != null && typeof shape === 'object' && 'type' in shape);
  const renderExactView = part != null && shouldPreferExactBreadboardView(meta, part.views) && exactShapes.length > 0;
  const exactBounds = renderExactView ? computeShapesBounds(exactShapes) : null;
  const rotation = instance.breadboardRotation ?? 0;
  const connectors = (((part?.connectors ?? []) as Connector[]) ?? []).filter((connector) => connector.terminalPositions?.breadboard);

  return connectors.map((connector, index) => {
    const breadboardAnchor = connector.terminalPositions.breadboard;
    const localPoint = exactBounds
      ? {
          x: breadboardAnchor.x - (exactBounds.x + exactBounds.width / 2),
          y: breadboardAnchor.y - (exactBounds.y + exactBounds.height / 2),
        }
      : {
          x: index < 4 ? -28 : 28,
          y: -10 + (index % 4) * 7,
        };
    const rotated = rotatePoint(localPoint, rotation);

    return {
      instanceId: instance.id,
      connectorId: connector.id,
      pinId: connector.id,
      x: instance.benchX! + rotated.x,
      y: instance.benchY! + rotated.y,
      localX: localPoint.x,
      localY: localPoint.y,
    };
  });
}
