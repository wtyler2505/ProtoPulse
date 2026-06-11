import { Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import type { BoardScene } from '@/lib/board-viewer-3d';
import { getTopLayerY } from './coordinates';
import {
  formatMeasurementDistance,
  getMeasurementMidpoint,
  type MeasurePoint3D,
  type WebGLMeasureSegment,
} from './measurement';

function toBoardMeasurePoint(board: BoardScene['board'], point: THREE.Vector3): MeasurePoint3D {
  return [point.x, getTopLayerY(board) + 0.55, point.z];
}

export function MeasureTool({
  board,
  active,
  pendingPoint,
  segments,
  onMeasurePoint,
}: {
  board: BoardScene['board'];
  active: boolean;
  pendingPoint: MeasurePoint3D | null;
  segments: readonly WebGLMeasureSegment[];
  onMeasurePoint: (point: MeasurePoint3D) => void;
}) {
  const captureY = getTopLayerY(board) + 6;

  return (
    <>
      {segments.map((segment) => {
        const midpoint = getMeasurementMidpoint(segment.start, segment.end);
        return (
          <group key={segment.id}>
            <Line
              data-testid={`viewer-3d-webgl-measure-line-${segment.id}`}
              points={[segment.start, segment.end]}
              color="#67e8f9"
              lineWidth={2.5}
            />
            <Html center distanceFactor={18} position={[midpoint[0], midpoint[1] + 1, midpoint[2]]} zIndexRange={[70, 15]}>
              <div
                data-testid="viewer-3d-webgl-measure-label"
                data-distance-mm={segment.distanceMm.toFixed(2)}
                className="pointer-events-none rounded border border-cyan-300/50 bg-background/95 px-2 py-1 font-mono text-[10px] leading-none text-cyan-100 shadow-lg backdrop-blur"
              >
                {formatMeasurementDistance(segment.distanceMm)}
              </div>
            </Html>
          </group>
        );
      })}
      {pendingPoint && (
        <mesh data-testid="viewer-3d-webgl-measure-start" position={pendingPoint} raycast={() => null}>
          <sphereGeometry args={[0.38, 12, 12]} />
          <meshBasicMaterial color="#67e8f9" />
        </mesh>
      )}
      {active && (
        <mesh
          data-testid="viewer-3d-webgl-measure-capture"
          position={[0, captureY, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          onClick={(event) => {
            event.stopPropagation();
            onMeasurePoint(toBoardMeasurePoint(board, event.point));
          }}
        >
          <planeGeometry args={[board.width, board.height]} />
          <meshBasicMaterial
            color="#67e8f9"
            colorWrite={false}
            depthWrite={false}
            opacity={0}
            side={THREE.DoubleSide}
            transparent
          />
        </mesh>
      )}
    </>
  );
}
