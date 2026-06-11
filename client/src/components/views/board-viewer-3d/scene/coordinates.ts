import type { BoardDimensions } from '@/lib/board-viewer-3d';

export const BOARD_LAYER_Y_OFFSET = 0.04;

export function toSceneX(x: number, width: number): number {
  return x - width / 2;
}

export function toSceneZ(y: number, height: number): number {
  return height / 2 - y;
}

export function getTopLayerY(board: BoardDimensions): number {
  return board.thickness / 2 + BOARD_LAYER_Y_OFFSET;
}

export function getBottomLayerY(board: BoardDimensions): number {
  return -board.thickness / 2 - BOARD_LAYER_Y_OFFSET;
}
