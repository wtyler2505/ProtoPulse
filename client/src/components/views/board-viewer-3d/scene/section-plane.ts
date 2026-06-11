import type { BoardScene } from '@/lib/board-viewer-3d';

export interface SectionPlaneRange {
  min: number;
  max: number;
}

export function getSectionPlaneRange(board: BoardScene['board']): SectionPlaneRange {
  const halfWidth = Math.max(board.width / 2, 1);
  return { min: -halfWidth, max: halfWidth };
}

export function clampSectionPlaneConstant(value: number, board: BoardScene['board']): number {
  const range = getSectionPlaneRange(board);
  return Math.min(range.max, Math.max(range.min, value));
}

export function getSectionPlaneX(constant: number): number {
  return -constant;
}
