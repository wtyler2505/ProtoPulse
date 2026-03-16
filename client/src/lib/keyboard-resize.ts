/**
 * keyboard-resize.ts — Keyboard-operable resize handle utilities (BL-0320)
 *
 * Makes panel resize handles accessible via keyboard:
 *  - Arrow keys adjust width/height by STEP_SMALL (10px)
 *  - Shift+Arrow adjusts by STEP_LARGE (50px)
 *  - aria-valuenow/min/max for screen readers
 */

/** Default step sizes for keyboard resize (in pixels). */
export const STEP_SMALL = 10;
export const STEP_LARGE = 50;

/** Configuration for a keyboard-resizable panel. */
export interface KeyboardResizeConfig {
  /** Current panel width/height in pixels. */
  currentValue: number;
  /** Minimum allowed width/height. */
  min: number;
  /** Maximum allowed width/height. */
  max: number;
  /**
   * Callback to apply the new clamped value.
   * Receives the delta (positive = grow, negative = shrink).
   */
  onResize: (delta: number) => void;
  /**
   * Orientation of the resize handle.
   * 'horizontal' (default) — Left/Right arrows resize.
   * 'vertical' — Up/Down arrows resize.
   */
  orientation?: 'horizontal' | 'vertical';
  /**
   * Whether positive arrow direction grows or shrinks the panel.
   * 'grow' (default) — Right/Down arrow increases size.
   * 'shrink' — Right/Down arrow decreases size (used for right-side panels).
   */
  positiveDirection?: 'grow' | 'shrink';
}

/**
 * Returns the delta to apply for a keyboard event, or 0 if the event
 * is not a resize key. Does NOT call preventDefault — the caller decides.
 */
export function getResizeDelta(
  event: { key: string; shiftKey: boolean },
  config: KeyboardResizeConfig,
): number {
  const orientation = config.orientation ?? 'horizontal';
  const positiveDirection = config.positiveDirection ?? 'grow';
  const step = event.shiftKey ? STEP_LARGE : STEP_SMALL;

  const growKeys = orientation === 'horizontal' ? ['ArrowRight'] : ['ArrowDown'];
  const shrinkKeys = orientation === 'horizontal' ? ['ArrowLeft'] : ['ArrowUp'];

  const isGrow = growKeys.includes(event.key);
  const isShrink = shrinkKeys.includes(event.key);

  if (!isGrow && !isShrink) {
    return 0;
  }

  // Determine raw direction
  let delta: number;
  if (isGrow) {
    delta = positiveDirection === 'grow' ? step : -step;
  } else {
    delta = positiveDirection === 'grow' ? -step : step;
  }

  // Clamp: ensure the resulting value stays within [min, max]
  const projected = config.currentValue + delta;
  if (projected < config.min) {
    delta = config.min - config.currentValue;
  } else if (projected > config.max) {
    delta = config.max - config.currentValue;
  }

  return delta;
}

/**
 * Creates a keydown handler for a resize handle element.
 * Calls `config.onResize(delta)` and prevents default for handled keys.
 */
export function createResizeKeyHandler(
  config: KeyboardResizeConfig,
): (event: React.KeyboardEvent) => void {
  return (event: React.KeyboardEvent) => {
    const delta = getResizeDelta(event, config);
    if (delta !== 0) {
      event.preventDefault();
      config.onResize(delta);
    }
  };
}

/**
 * Returns ARIA attributes for a resize handle separator element.
 * Implements the WAI-ARIA separator (focusable) pattern.
 */
export function getResizeAriaProps(config: KeyboardResizeConfig): {
  role: 'separator';
  tabIndex: 0;
  'aria-orientation': 'horizontal' | 'vertical';
  'aria-valuenow': number;
  'aria-valuemin': number;
  'aria-valuemax': number;
  'aria-label': string;
} {
  const orientation = config.orientation ?? 'horizontal';
  // For a separator, aria-orientation is perpendicular to the resize direction.
  // A horizontal resize (left/right) uses a vertical separator bar.
  const ariaOrientation: 'horizontal' | 'vertical' =
    orientation === 'horizontal' ? 'vertical' : 'horizontal';

  return {
    role: 'separator',
    tabIndex: 0,
    'aria-orientation': ariaOrientation,
    'aria-valuenow': Math.round(config.currentValue),
    'aria-valuemin': config.min,
    'aria-valuemax': config.max,
    'aria-label': `Resize panel, current width ${Math.round(config.currentValue)} pixels`,
  };
}
