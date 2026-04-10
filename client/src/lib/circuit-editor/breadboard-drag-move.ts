/**
 * Breadboard drag-to-move logic.
 *
 * Pure utility that determines whether a component can be moved to a new
 * breadboard coordinate. Separated from the React component to make it
 * independently testable.
 */

import {
  type BreadboardCoord,
  type ComponentPlacement,
  type PixelPos,
  type TiePoint,
  BB,
  coordToPixel,
  checkCollision,
} from './breadboard-model';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MoveResult {
  /** Whether the target position is a valid drop. */
  valid: boolean;
  /** The placement that would be created at the target (null if invalid). */
  placement: ComponentPlacement | null;
  /** Board-local pixel position of the snap target (null if invalid). */
  snapPixel: PixelPos | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DIP_TYPES = new Set(['ic', 'mcu', 'microcontroller']);

function isDipLike(componentType: string): boolean {
  return DIP_TYPES.has(componentType.toLowerCase());
}

function buildMovePlacement(
  coord: TiePoint,
  componentType: string,
  pinCount: number,
): ComponentPlacement {
  const dipLike = isDipLike(componentType);
  const rowSpan = dipLike
    ? Math.max(2, Math.ceil(Math.max(pinCount, 4) / 2))
    : Math.max(1, Math.ceil(Math.max(pinCount, 2) / 2));
  const maxStartRow = Math.max(1, BB.ROWS - rowSpan + 1);

  return {
    refDes: `move-preview`,
    startCol: dipLike ? 'e' : coord.col,
    startRow: Math.min(coord.row, maxStartRow),
    rowSpan,
    crossesChannel: dipLike,
  };
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

/**
 * Compute whether moving a component to a target coordinate is valid.
 *
 * @param targetCoord     - The breadboard coordinate the user is dragging to
 * @param componentType   - Type of the component being moved ('resistor', 'ic', etc.)
 * @param pinCount        - Pin count of the component
 * @param existing        - All current placements on the board
 * @param movingInstanceId - The instance ID being moved (excluded from collision)
 * @param instanceIds     - Parallel array mapping existing placements to instance IDs
 */
export function computeMoveResult(
  targetCoord: BreadboardCoord,
  componentType: string,
  pinCount: number,
  existing: ComponentPlacement[],
  movingInstanceId: number,
  instanceIds?: number[],
): MoveResult {
  // Only terminal coordinates are valid move targets
  if (targetCoord.type !== 'terminal') {
    return { valid: false, placement: null, snapPixel: null };
  }

  const placement = buildMovePlacement(targetCoord, componentType, pinCount);

  // Exclude the component being moved from the collision set
  const filteredExisting = instanceIds
    ? existing.filter((_, i) => instanceIds[i] !== movingInstanceId)
    : existing;

  if (checkCollision(placement, filteredExisting)) {
    return { valid: false, placement, snapPixel: null };
  }

  const snapPixel = coordToPixel({
    type: 'terminal',
    col: placement.startCol,
    row: placement.startRow,
  });

  return { valid: true, placement, snapPixel };
}
