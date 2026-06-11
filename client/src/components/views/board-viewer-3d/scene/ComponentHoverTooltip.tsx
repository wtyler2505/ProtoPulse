import { Html } from '@react-three/drei';
import type { BoardScene, Component3D } from '@/lib/board-viewer-3d';
import { toSceneX, toSceneZ } from './coordinates';

function getComponentTooltipY(board: BoardScene['board'], component: Component3D, explodeOffset: number): number {
  const depth = Math.max(component.bodyDepth, 0.2);
  return component.side === 'bottom'
    ? -board.thickness / 2 - depth - 2 - explodeOffset
    : board.thickness / 2 + depth + 2 + explodeOffset;
}

export function ComponentHoverTooltip({
  board,
  component,
  explodeOffset,
}: {
  board: BoardScene['board'];
  component: Component3D | null;
  explodeOffset: number;
}) {
  if (!component) {
    return null;
  }

  return (
    <Html
      center
      occlude
      distanceFactor={18}
      position={[
        toSceneX(component.position.x, board.width),
        getComponentTooltipY(board, component, explodeOffset),
        toSceneZ(component.position.y, board.height),
      ]}
      zIndexRange={[80, 20]}
    >
      <div
        data-testid="viewer-3d-webgl-tooltip"
        data-refdes={component.refDes}
        className="pointer-events-none max-w-44 rounded border border-cyan-300/50 bg-background/95 px-2.5 py-1.5 text-[11px] leading-tight text-foreground shadow-lg backdrop-blur"
      >
        <div className="truncate font-semibold">{component.refDes}</div>
        <div className="truncate font-mono text-[10px] text-muted-foreground">{component.package}</div>
        {component.label && <div className="mt-0.5 truncate text-[10px] text-muted-foreground">{component.label}</div>}
      </div>
    </Html>
  );
}
