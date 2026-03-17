import { describe, it, expect } from 'vitest';
import {
  calculateTooltipPosition,
  isOffScreen,
  getOptimalPosition,
} from '../tooltip-placement';
import type { Rect, TooltipPosition } from '../tooltip-placement';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

/** Standard 1920x1080 viewport starting at (0, 0). */
const viewport: Rect = { x: 0, y: 0, width: 1920, height: 1080 };

/** A 100x40 tooltip (typical small label). */
const tooltip: Rect = { x: 0, y: 0, width: 100, height: 40 };

/** A trigger element roughly centered in the viewport. */
const centeredTrigger: Rect = { x: 910, y: 520, width: 100, height: 40 };

// ---------------------------------------------------------------------------
// isOffScreen
// ---------------------------------------------------------------------------

describe('isOffScreen', () => {
  it('returns false when fully inside the viewport', () => {
    const rect: Rect = { x: 100, y: 100, width: 200, height: 200 };
    expect(isOffScreen(rect, viewport)).toBe(false);
  });

  it('returns false when exactly touching the viewport edges', () => {
    const rect: Rect = { x: 0, y: 0, width: 1920, height: 1080 };
    expect(isOffScreen(rect, viewport)).toBe(false);
  });

  it('returns true when overflowing the left edge', () => {
    const rect: Rect = { x: -1, y: 100, width: 200, height: 200 };
    expect(isOffScreen(rect, viewport)).toBe(true);
  });

  it('returns true when overflowing the top edge', () => {
    const rect: Rect = { x: 100, y: -1, width: 200, height: 200 };
    expect(isOffScreen(rect, viewport)).toBe(true);
  });

  it('returns true when overflowing the right edge', () => {
    const rect: Rect = { x: 1800, y: 100, width: 200, height: 200 };
    expect(isOffScreen(rect, viewport)).toBe(true);
  });

  it('returns true when overflowing the bottom edge', () => {
    const rect: Rect = { x: 100, y: 950, width: 200, height: 200 };
    expect(isOffScreen(rect, viewport)).toBe(true);
  });

  it('returns true when rect is completely outside the viewport', () => {
    const rect: Rect = { x: 2000, y: 2000, width: 100, height: 100 };
    expect(isOffScreen(rect, viewport)).toBe(true);
  });

  it('handles viewport with non-zero origin', () => {
    const vp: Rect = { x: 100, y: 100, width: 800, height: 600 };
    const inside: Rect = { x: 150, y: 150, width: 50, height: 50 };
    const outside: Rect = { x: 50, y: 50, width: 30, height: 30 };
    expect(isOffScreen(inside, vp)).toBe(false);
    expect(isOffScreen(outside, vp)).toBe(true);
  });

  it('returns true when only a single pixel overflows', () => {
    const rect: Rect = { x: 0, y: 0, width: 1921, height: 1080 };
    expect(isOffScreen(rect, viewport)).toBe(true);
  });

  it('handles zero-size rect', () => {
    const rect: Rect = { x: 500, y: 500, width: 0, height: 0 };
    expect(isOffScreen(rect, viewport)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// calculateTooltipPosition — preferred position fits
// ---------------------------------------------------------------------------

describe('calculateTooltipPosition — preferred fits', () => {
  it('places tooltip above trigger when "top" fits', () => {
    const result = calculateTooltipPosition(centeredTrigger, tooltip, 'top', viewport);
    expect(result.position).toBe('top');
    // Centered horizontally: trigger center (960) - tooltip half-width (50) = 910
    expect(result.x).toBe(910);
    // Above trigger: trigger.y (520) - tooltip.height (40) - offset (8) = 472
    expect(result.y).toBe(472);
  });

  it('places tooltip below trigger when "bottom" fits', () => {
    const result = calculateTooltipPosition(centeredTrigger, tooltip, 'bottom', viewport);
    expect(result.position).toBe('bottom');
    expect(result.x).toBe(910);
    // Below trigger: trigger.y (520) + trigger.height (40) + offset (8) = 568
    expect(result.y).toBe(568);
  });

  it('places tooltip to the left of trigger when "left" fits', () => {
    const result = calculateTooltipPosition(centeredTrigger, tooltip, 'left', viewport);
    expect(result.position).toBe('left');
    // Left of trigger: trigger.x (910) - tooltip.width (100) - offset (8) = 802
    expect(result.x).toBe(802);
    // Vertically centered: trigger center Y (540) - tooltip half-height (20) = 520
    expect(result.y).toBe(520);
  });

  it('places tooltip to the right of trigger when "right" fits', () => {
    const result = calculateTooltipPosition(centeredTrigger, tooltip, 'right', viewport);
    expect(result.position).toBe('right');
    // Right of trigger: trigger.x (910) + trigger.width (100) + offset (8) = 1018
    expect(result.x).toBe(1018);
    expect(result.y).toBe(520);
  });

  it('respects custom offset', () => {
    const result = calculateTooltipPosition(centeredTrigger, tooltip, 'top', viewport, 20);
    expect(result.position).toBe('top');
    // Above: 520 - 40 - 20 = 460
    expect(result.y).toBe(460);
  });

  it('uses default offset of 8 when not specified', () => {
    const result = calculateTooltipPosition(centeredTrigger, tooltip, 'bottom', viewport);
    // Below: 520 + 40 + 8 = 568
    expect(result.y).toBe(568);
  });
});

// ---------------------------------------------------------------------------
// calculateTooltipPosition — flip to opposite side
// ---------------------------------------------------------------------------

describe('calculateTooltipPosition — flip logic', () => {
  it('flips from top to bottom when trigger is near the top edge', () => {
    const topTrigger: Rect = { x: 500, y: 10, width: 100, height: 40 };
    const result = calculateTooltipPosition(topTrigger, tooltip, 'top', viewport);
    expect(result.position).toBe('bottom');
    // Below: 10 + 40 + 8 = 58
    expect(result.y).toBe(58);
  });

  it('flips from bottom to top when trigger is near the bottom edge', () => {
    const bottomTrigger: Rect = { x: 500, y: 1050, width: 100, height: 40 };
    const result = calculateTooltipPosition(bottomTrigger, tooltip, 'bottom', viewport);
    // bottom would be at y=1098, overflows 1080. Top: 1050 - 40 - 8 = 1002
    expect(result.position).toBe('top');
    expect(result.y).toBe(1002);
  });

  it('flips from left to right when trigger is near the left edge', () => {
    const leftTrigger: Rect = { x: 10, y: 500, width: 100, height: 40 };
    const result = calculateTooltipPosition(leftTrigger, tooltip, 'left', viewport);
    // left would be at x = 10 - 100 - 8 = -98, overflows. Right: 10 + 100 + 8 = 118
    expect(result.position).toBe('right');
    expect(result.x).toBe(118);
  });

  it('flips from right to left when trigger is near the right edge', () => {
    const rightTrigger: Rect = { x: 1850, y: 500, width: 60, height: 40 };
    const result = calculateTooltipPosition(rightTrigger, tooltip, 'right', viewport);
    // right: 1850 + 60 + 8 = 1918, + tooltip.width = 2018, overflows.
    // left: 1850 - 100 - 8 = 1742
    expect(result.position).toBe('left');
    expect(result.x).toBe(1742);
  });
});

// ---------------------------------------------------------------------------
// calculateTooltipPosition — cascade through perpendicular sides
// ---------------------------------------------------------------------------

describe('calculateTooltipPosition — cascade fallback', () => {
  it('cascades from top → bottom → left when both top and bottom overflow', () => {
    // Very tall viewport-filling trigger with tiny vertical viewport
    const tinyVp: Rect = { x: 0, y: 0, width: 800, height: 100 };
    const tallTrigger: Rect = { x: 300, y: 30, width: 100, height: 40 };
    // top: 30 - 40 - 8 = -18 (overflows top)
    // bottom: 30 + 40 + 8 = 78, 78 + 40 = 118 > 100 (overflows bottom)
    // left: 300 - 100 - 8 = 192 (fits horizontally), vertically centered: 30+20-20 = 30 (fits)
    const result = calculateTooltipPosition(tallTrigger, tooltip, 'top', tinyVp);
    expect(result.position).toBe('left');
  });

  it('cascades from left → right → top when both left and right overflow', () => {
    const narrowVp: Rect = { x: 0, y: 0, width: 150, height: 800 };
    const wideTrigger: Rect = { x: 25, y: 400, width: 100, height: 40 };
    // left: 25 - 100 - 8 = -83 (overflows)
    // right: 25 + 100 + 8 = 133, + 100 = 233 > 150 (overflows)
    // top: center x = 75 - 50 = 25, y = 400 - 40 - 8 = 352 (fits)
    const result = calculateTooltipPosition(wideTrigger, tooltip, 'left', narrowVp);
    expect(result.position).toBe('top');
  });

  it('cascades to right when top, bottom, and left all overflow', () => {
    const tightVp: Rect = { x: 0, y: 0, width: 800, height: 100 };
    // Trigger near top-left corner
    const trigger: Rect = { x: 5, y: 10, width: 80, height: 80 };
    // top: 10 - 40 - 8 = -38 (overflows)
    // bottom: 10 + 80 + 8 = 98, 98 + 40 = 138 > 100 (overflows)
    // left: 5 - 100 - 8 = -103 (overflows)
    // right: 5 + 80 + 8 = 93, 93 + 100 = 193 < 800 (fits). Y center = 50 - 20 = 30, 30 + 40 = 70 < 100 (fits)
    const result = calculateTooltipPosition(trigger, tooltip, 'top', tightVp);
    expect(result.position).toBe('right');
  });
});

// ---------------------------------------------------------------------------
// calculateTooltipPosition — clamp as last resort
// ---------------------------------------------------------------------------

describe('calculateTooltipPosition — clamping', () => {
  it('clamps to viewport when no side has enough room', () => {
    // Viewport smaller than the tooltip in BOTH dimensions and trigger fills it,
    // so every side overflows: top/bottom (no vertical space), left/right (no horizontal space).
    const tinyVp: Rect = { x: 0, y: 0, width: 50, height: 30 };
    const bigTooltip: Rect = { x: 0, y: 0, width: 100, height: 80 };
    const trigger: Rect = { x: 5, y: 5, width: 40, height: 20 };
    const result = calculateTooltipPosition(trigger, bigTooltip, 'top', tinyVp);
    // All four sides overflow; clamp fires. Position stays as preferred.
    expect(result.position).toBe('top');
    // Clamped x: max(0, min(x, 50-100)) = max(0, -50) = 0
    expect(result.x).toBe(0);
    // Clamped y: max(0, min(y, 30-80)) = max(0, -50) = 0
    expect(result.y).toBe(0);
  });

  it('clamps x when tooltip is wider than viewport', () => {
    // Viewport 60px wide, tooltip 100px wide. Trigger centered.
    // Every side overflows horizontally (tooltip can never fit width-wise).
    const narrowVp: Rect = { x: 0, y: 0, width: 60, height: 30 };
    const bigTooltip: Rect = { x: 0, y: 0, width: 100, height: 50 };
    const trigger: Rect = { x: 10, y: 5, width: 40, height: 20 };
    const result = calculateTooltipPosition(trigger, bigTooltip, 'top', narrowVp);
    // clampToViewport: x = max(0, min(_, 60-100)) = 0
    expect(result.position).toBe('top');
    expect(result.x).toBe(0);
  });

  it('clamps y to top edge when tooltip would go above viewport', () => {
    const trigger: Rect = { x: 500, y: 5, width: 100, height: 20 };
    const shortVp: Rect = { x: 0, y: 0, width: 1920, height: 50 };
    const result = calculateTooltipPosition(trigger, tooltip, 'top', shortVp);
    expect(result.y).toBeGreaterThanOrEqual(0);
  });

  it('clamps coordinates to non-zero viewport origin', () => {
    // Viewport and tooltip both small, trigger fills it — no side has room.
    const offsetVp: Rect = { x: 100, y: 100, width: 30, height: 20 };
    const bigTooltip: Rect = { x: 0, y: 0, width: 80, height: 60 };
    const trigger: Rect = { x: 105, y: 105, width: 20, height: 10 };
    const result = calculateTooltipPosition(trigger, bigTooltip, 'top', offsetVp);
    // Clamped: x = max(100, min(_, 100+30-80)) = max(100, 50) = 100
    expect(result.x).toBe(100);
    // Clamped: y = max(100, min(_, 100+20-60)) = max(100, 60) = 100
    expect(result.y).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// calculateTooltipPosition — edge cases
// ---------------------------------------------------------------------------

describe('calculateTooltipPosition — edge cases', () => {
  it('handles zero offset', () => {
    const result = calculateTooltipPosition(centeredTrigger, tooltip, 'top', viewport, 0);
    expect(result.position).toBe('top');
    // 520 - 40 - 0 = 480
    expect(result.y).toBe(480);
  });

  it('handles large offset', () => {
    const result = calculateTooltipPosition(centeredTrigger, tooltip, 'top', viewport, 100);
    expect(result.position).toBe('top');
    // 520 - 40 - 100 = 380
    expect(result.y).toBe(380);
  });

  it('handles trigger at exact viewport origin', () => {
    const trigger: Rect = { x: 0, y: 0, width: 50, height: 50 };
    const result = calculateTooltipPosition(trigger, tooltip, 'top', viewport);
    // top: y = 0 - 40 - 8 = -48 (overflows). Should flip.
    expect(result.position).not.toBe('top');
  });

  it('handles trigger at bottom-right corner of viewport', () => {
    const trigger: Rect = { x: 1870, y: 1040, width: 50, height: 40 };
    const result = calculateTooltipPosition(trigger, tooltip, 'bottom', viewport);
    // bottom: y=1088 > 1080 (overflows).
    // top: x=1870+25-50=1845, 1845+100=1945 > 1920 (overflows right).
    // left: x=1870-100-8=1762, y=1040+20-20=1040, 1040+40=1080 (fits exactly).
    expect(result.position).toBe('left');
    expect(result.x).toBe(1762);
    expect(result.y).toBe(1040);
  });

  it('handles zero-size trigger', () => {
    const trigger: Rect = { x: 500, y: 500, width: 0, height: 0 };
    const result = calculateTooltipPosition(trigger, tooltip, 'bottom', viewport);
    expect(result.position).toBe('bottom');
    // x = 500 - 50 = 450, y = 500 + 0 + 8 = 508
    expect(result.x).toBe(450);
    expect(result.y).toBe(508);
  });

  it('handles zero-size tooltip', () => {
    const zeroTooltip: Rect = { x: 0, y: 0, width: 0, height: 0 };
    const result = calculateTooltipPosition(centeredTrigger, zeroTooltip, 'top', viewport);
    expect(result.position).toBe('top');
    // x = 960 - 0 = 960, y = 520 - 0 - 8 = 512
    expect(result.x).toBe(960);
    expect(result.y).toBe(512);
  });

  it('preserves preferred position name in clamp fallback', () => {
    const tinyVp: Rect = { x: 0, y: 0, width: 10, height: 10 };
    const trigger: Rect = { x: 2, y: 2, width: 6, height: 6 };
    const result = calculateTooltipPosition(trigger, tooltip, 'right', tinyVp);
    // Nothing fits; clamp uses preferred position
    expect(result.position).toBe('right');
  });
});

// ---------------------------------------------------------------------------
// getOptimalPosition
// ---------------------------------------------------------------------------

describe('getOptimalPosition', () => {
  it('returns "top" for a centered trigger (first zero-overflow candidate)', () => {
    const result = getOptimalPosition(centeredTrigger, tooltip, viewport);
    expect(result).toBe('top');
  });

  it('returns "bottom" when trigger is near the top edge', () => {
    const topTrigger: Rect = { x: 500, y: 5, width: 100, height: 30 };
    const result = getOptimalPosition(topTrigger, tooltip, viewport);
    // top: 5 - 40 - 8 = -43 (overflow). bottom: 5+30+8 = 43, fits. bottom wins.
    expect(result).toBe('bottom');
  });

  it('returns "top" when trigger is near the bottom edge', () => {
    const bottomTrigger: Rect = { x: 500, y: 1050, width: 100, height: 30 };
    const result = getOptimalPosition(bottomTrigger, tooltip, viewport);
    // bottom: 1050+30+8 = 1088+40 = overflow. top: 1050-40-8 = 1002, fits.
    expect(result).toBe('top');
  });

  it('returns "right" when trigger is near the left edge and top/bottom overflow', () => {
    const tightVp: Rect = { x: 0, y: 0, width: 800, height: 60 };
    const trigger: Rect = { x: 5, y: 10, width: 40, height: 40 };
    // top: 10-40-8 = -38 (overflow). bottom: 10+40+8=58, 58+40=98>60 (overflow).
    // left: 5-100-8 = -103 (overflow). right: 5+40+8=53, 53+100=153<800, vertically 30-20=10, 10+40=50<60 (fits).
    const result = getOptimalPosition(trigger, tooltip, tightVp);
    expect(result).toBe('right');
  });

  it('returns "left" when trigger is near the right edge and top/bottom overflow', () => {
    const tightVp: Rect = { x: 0, y: 0, width: 800, height: 60 };
    const trigger: Rect = { x: 750, y: 10, width: 40, height: 40 };
    // top overflows, bottom overflows, left: 750-100-8=642 (fits), right: 750+40+8=798+100>800 (overflow)
    const result = getOptimalPosition(trigger, tooltip, tightVp);
    expect(result).toBe('left');
  });

  it('picks the position with least overflow when none fully fit', () => {
    const tinyVp: Rect = { x: 0, y: 0, width: 120, height: 60 };
    const trigger: Rect = { x: 30, y: 10, width: 60, height: 40 };
    // All positions overflow in this cramped viewport.
    // The function should still return a valid TooltipPosition.
    const result = getOptimalPosition(trigger, tooltip, tinyVp);
    const validPositions: TooltipPosition[] = ['top', 'bottom', 'left', 'right'];
    expect(validPositions).toContain(result);
  });

  it('respects custom offset parameter', () => {
    // With a huge offset, top won't fit for a trigger fairly close to the top
    const trigger: Rect = { x: 500, y: 60, width: 100, height: 30 };
    const resultSmallOffset = getOptimalPosition(trigger, tooltip, viewport, 8);
    const resultLargeOffset = getOptimalPosition(trigger, tooltip, viewport, 100);
    // Small offset: top = 60-40-8 = 12, fits. Large offset: top = 60-40-100 = -80, overflow.
    expect(resultSmallOffset).toBe('top');
    expect(resultLargeOffset).toBe('bottom');
  });

  it('handles viewport with non-zero origin', () => {
    const offsetVp: Rect = { x: 200, y: 200, width: 600, height: 400 };
    const trigger: Rect = { x: 450, y: 380, width: 100, height: 40 };
    const result = getOptimalPosition(trigger, tooltip, offsetVp);
    // Trigger is roughly centered in the offset viewport; top should fit.
    expect(result).toBe('top');
  });
});

// ---------------------------------------------------------------------------
// Integration: calculateTooltipPosition + getOptimalPosition agree
// ---------------------------------------------------------------------------

describe('integration — calculateTooltipPosition and getOptimalPosition consistency', () => {
  it('optimal position matches the position returned by calculate with that preference', () => {
    const trigger: Rect = { x: 500, y: 10, width: 100, height: 30 };
    const optimal = getOptimalPosition(trigger, tooltip, viewport);
    const result = calculateTooltipPosition(trigger, tooltip, optimal, viewport);
    expect(result.position).toBe(optimal);
  });

  it('result coordinates are always within viewport for centered triggers', () => {
    const positions: TooltipPosition[] = ['top', 'bottom', 'left', 'right'];
    for (const pos of positions) {
      const result = calculateTooltipPosition(centeredTrigger, tooltip, pos, viewport);
      expect(result.x).toBeGreaterThanOrEqual(viewport.x);
      expect(result.y).toBeGreaterThanOrEqual(viewport.y);
      expect(result.x + tooltip.width).toBeLessThanOrEqual(viewport.x + viewport.width);
      expect(result.y + tooltip.height).toBeLessThanOrEqual(viewport.y + viewport.height);
    }
  });
});
