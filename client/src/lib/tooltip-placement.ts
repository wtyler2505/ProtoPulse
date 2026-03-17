/**
 * Tooltip Placement Engine
 *
 * Calculates optimal tooltip positioning relative to a trigger element,
 * respecting viewport boundaries. Supports four cardinal positions with
 * automatic flip-to-opposite-side logic when the preferred position would
 * cause overflow. Falls back to clamping against viewport edges as a
 * last resort when no side has enough room.
 *
 * Usage:
 *   const result = calculateTooltipPosition(triggerRect, tooltipRect, 'top', viewportRect);
 *   // result => { position: 'top', x: 120, y: 5 }
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TooltipPlacementResult {
  position: TooltipPosition;
  x: number;
  y: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_OFFSET = 8;

/**
 * The order in which positions are tried when the preferred side overflows.
 * Opposite side first, then the two perpendicular sides.
 */
const FLIP_ORDER: Record<TooltipPosition, readonly TooltipPosition[]> = {
  top: ['bottom', 'left', 'right'],
  bottom: ['top', 'left', 'right'],
  left: ['right', 'top', 'bottom'],
  right: ['left', 'top', 'bottom'],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Compute the raw (x, y) for a tooltip placed on a given side of the trigger,
 * centered on the perpendicular axis.
 */
function computeCoords(
  trigger: Rect,
  tooltip: Rect,
  position: TooltipPosition,
  offset: number,
): { x: number; y: number } {
  const triggerCenterX = trigger.x + trigger.width / 2;
  const triggerCenterY = trigger.y + trigger.height / 2;

  switch (position) {
    case 'top':
      return {
        x: triggerCenterX - tooltip.width / 2,
        y: trigger.y - tooltip.height - offset,
      };
    case 'bottom':
      return {
        x: triggerCenterX - tooltip.width / 2,
        y: trigger.y + trigger.height + offset,
      };
    case 'left':
      return {
        x: trigger.x - tooltip.width - offset,
        y: triggerCenterY - tooltip.height / 2,
      };
    case 'right':
      return {
        x: trigger.x + trigger.width + offset,
        y: triggerCenterY - tooltip.height / 2,
      };
  }
}

/**
 * Returns true when the given rect extends beyond the viewport bounds.
 */
export function isOffScreen(rect: Rect, viewport: Rect): boolean {
  if (rect.x < viewport.x) {
    return true;
  }
  if (rect.y < viewport.y) {
    return true;
  }
  if (rect.x + rect.width > viewport.x + viewport.width) {
    return true;
  }
  if (rect.y + rect.height > viewport.y + viewport.height) {
    return true;
  }
  return false;
}

/**
 * Checks whether a tooltip placed at (x, y) with the given dimensions would
 * be fully contained within the viewport.
 */
function fitsInViewport(
  x: number,
  y: number,
  tooltip: Rect,
  viewport: Rect,
): boolean {
  return !isOffScreen({ x, y, width: tooltip.width, height: tooltip.height }, viewport);
}

/**
 * Clamp a point so the tooltip rect stays within the viewport. This is the
 * last-resort fallback when no cardinal position fits cleanly.
 */
function clampToViewport(
  x: number,
  y: number,
  tooltip: Rect,
  viewport: Rect,
): { x: number; y: number } {
  const minX = viewport.x;
  const minY = viewport.y;
  const maxX = viewport.x + viewport.width - tooltip.width;
  const maxY = viewport.y + viewport.height - tooltip.height;

  return {
    x: Math.min(Math.max(x, minX), maxX),
    y: Math.min(Math.max(y, minY), maxY),
  };
}

// ---------------------------------------------------------------------------
// Overflow measurement (for getOptimalPosition)
// ---------------------------------------------------------------------------

/**
 * Measure how many pixels of the tooltip would overflow the viewport if
 * placed at the given position. Returns 0 when fully contained.
 */
function overflowAmount(
  trigger: Rect,
  tooltip: Rect,
  position: TooltipPosition,
  viewport: Rect,
  offset: number,
): number {
  const { x, y } = computeCoords(trigger, tooltip, position, offset);

  let overflow = 0;

  // Left edge
  if (x < viewport.x) {
    overflow += viewport.x - x;
  }
  // Top edge
  if (y < viewport.y) {
    overflow += viewport.y - y;
  }
  // Right edge
  const rightOverflow = x + tooltip.width - (viewport.x + viewport.width);
  if (rightOverflow > 0) {
    overflow += rightOverflow;
  }
  // Bottom edge
  const bottomOverflow = y + tooltip.height - (viewport.y + viewport.height);
  if (bottomOverflow > 0) {
    overflow += bottomOverflow;
  }

  return overflow;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Calculate the best position and coordinates for a tooltip.
 *
 * 1. Try the preferred position.
 * 2. If it overflows, cascade through: opposite side, then the two
 *    perpendicular sides.
 * 3. If nothing fits, use the preferred position but clamp coordinates
 *    to the viewport edges.
 *
 * @param trigger   Bounding rect of the element that triggers the tooltip.
 * @param tooltip   Dimensions of the tooltip itself (width/height; x/y ignored).
 * @param preferred The desired placement side.
 * @param viewport  The containing viewport rect.
 * @param offset    Gap between the trigger and tooltip edge. Default 8px.
 */
export function calculateTooltipPosition(
  trigger: Rect,
  tooltip: Rect,
  preferred: TooltipPosition,
  viewport: Rect,
  offset: number = DEFAULT_OFFSET,
): TooltipPlacementResult {
  // 1. Try the preferred position
  const preferredCoords = computeCoords(trigger, tooltip, preferred, offset);
  if (fitsInViewport(preferredCoords.x, preferredCoords.y, tooltip, viewport)) {
    return { position: preferred, ...preferredCoords };
  }

  // 2. Cascade through fallback positions
  const fallbacks = FLIP_ORDER[preferred];
  for (const fallbackPosition of fallbacks) {
    const coords = computeCoords(trigger, tooltip, fallbackPosition, offset);
    if (fitsInViewport(coords.x, coords.y, tooltip, viewport)) {
      return { position: fallbackPosition, ...coords };
    }
  }

  // 3. Nothing fits cleanly — clamp the preferred position to viewport edges
  const clamped = clampToViewport(preferredCoords.x, preferredCoords.y, tooltip, viewport);
  return { position: preferred, ...clamped };
}

/**
 * Determine the single best position for a tooltip by measuring overflow on
 * all four sides and returning the one with the least overflow. Ties are
 * broken in the order: top, bottom, left, right.
 */
export function getOptimalPosition(
  trigger: Rect,
  tooltip: Rect,
  viewport: Rect,
  offset: number = DEFAULT_OFFSET,
): TooltipPosition {
  const candidates: TooltipPosition[] = ['top', 'bottom', 'left', 'right'];

  let bestPosition: TooltipPosition = 'top';
  let bestOverflow = Infinity;

  for (const position of candidates) {
    const ov = overflowAmount(trigger, tooltip, position, viewport, offset);
    if (ov < bestOverflow) {
      bestOverflow = ov;
      bestPosition = position;
    }
    // Zero overflow means it fits perfectly — no need to check further
    if (bestOverflow === 0) {
      break;
    }
  }

  return bestPosition;
}
