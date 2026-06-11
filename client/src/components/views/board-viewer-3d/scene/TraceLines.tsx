import { Line } from '@react-three/drei';
import type * as THREE from 'three';
import type { BoardScene, Trace3D } from '@/lib/board-viewer-3d';
import {
  getLayerOpacity,
  isLayerVisible,
  type WebGLLayerSettings,
} from '../layer-settings';
import { getBottomLayerY, getTopLayerY, toSceneX, toSceneZ } from './coordinates';

function TraceLine({
  board,
  trace,
  visible,
  opacity,
  clippingPlanes,
  explodeOffset,
}: {
  board: BoardScene['board'];
  trace: Trace3D;
  visible: boolean;
  opacity: number;
  clippingPlanes: THREE.Plane[];
  explodeOffset: number;
}) {
  if (!visible || trace.points.length < 2) {
    return null;
  }

  const y =
    trace.layer === 'bottom-copper' ? getBottomLayerY(board) - explodeOffset : getTopLayerY(board) + explodeOffset;
  const points = trace.points.map(
    (point) => [toSceneX(point.x, board.width), y, toSceneZ(point.y, board.height)] as [number, number, number],
  );

  return (
    <Line
      data-testid={`viewer-3d-webgl-trace-${trace.id}`}
      points={points}
      color={trace.layer === 'bottom-copper' ? '#9fb9ff' : '#d99057'}
      lineWidth={Math.max(1.5, trace.width * 5)}
      transparent={opacity < 1}
      opacity={opacity}
      clippingPlanes={clippingPlanes.length > 0 ? clippingPlanes : undefined}
    />
  );
}

export function TraceLines({
  board,
  traces,
  layerSettings,
  clippingPlanes,
  explodeOffset,
}: {
  board: BoardScene['board'];
  traces: readonly Trace3D[];
  layerSettings: WebGLLayerSettings;
  clippingPlanes: THREE.Plane[];
  explodeOffset: number;
}) {
  return (
    <>
      {traces.map((trace) => (
        <TraceLine
          key={trace.id}
          board={board}
          trace={trace}
          visible={isLayerVisible(layerSettings, trace.layer)}
          opacity={getLayerOpacity(layerSettings, trace.layer)}
          clippingPlanes={clippingPlanes}
          explodeOffset={explodeOffset}
        />
      ))}
    </>
  );
}
