/**
 * keyboard-resize.ts — Keyboard-operable resize handle utilities (BL-0320)
 *
 * Makes panel resize handles accessible via keyboard (WCAG 2.1 AA):
 *  - Arrow keys adjust width/height by stepSmall (default 10px)
 *  - Shift+Arrow adjusts by stepLarge (default 50px)
 *  - Home/End jump to min/max
 *  - aria-valuenow/min/max for screen readers
 *  - useKeyboardResize hook for attaching to a ref
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';

/** Default step sizes for keyboard resize (in pixels). */
export const STEP_SMALL = 10;
export const STEP_LARGE = 50;

/** Resize direction: horizontal uses Left/Right arrows, vertical uses Up/Down. */
export type ResizeDirection = 'horizontal' | 'vertical';

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
  orientation?: ResizeDirection;
  /**
   * Whether positive arrow direction grows or shrinks the panel.
   * 'grow' (default) — Right/Down arrow increases size.
   * 'shrink' — Right/Down arrow decreases size (used for right-side panels).
   */
  positiveDirection?: 'grow' | 'shrink';
  /**
   * Small step size in pixels (default: STEP_SMALL = 10).
   * Used for plain arrow key presses.
   */
  stepSmall?: number;
  /**
   * Large step size in pixels (default: STEP_LARGE = 50).
   * Used for Shift+Arrow key presses.
   */
  stepLarge?: number;
}

/** Options for the useKeyboardResize hook. */
export interface UseKeyboardResizeOptions {
  /** Minimum allowed width/height in pixels. */
  min: number;
  /** Maximum allowed width/height in pixels. */
  max: number;
  /** Resize direction (default: 'horizontal'). */
  direction?: ResizeDirection;
  /**
   * Whether the positive arrow direction grows or shrinks.
   * Default: 'grow'.
   */
  positiveDirection?: 'grow' | 'shrink';
  /** Small step in px (default 10). */
  stepSmall?: number;
  /** Large step in px (default 50). */
  stepLarge?: number;
  /** Whether the keyboard resize is enabled (default true). */
  enabled?: boolean;
}

/**
 * Returns the delta to apply for a keyboard event, or 0 if the event
 * is not a resize key. Does NOT call preventDefault — the caller decides.
 *
 * Supported keys:
 *  - Arrow keys (direction-aware) — step by stepSmall or stepLarge (Shift)
 *  - Home — jump to min (delta = min - currentValue)
 *  - End — jump to max (delta = max - currentValue)
 */
export function getResizeDelta(
  event: { key: string; shiftKey: boolean },
  config: KeyboardResizeConfig,
): number {
  const orientation = config.orientation ?? 'horizontal';
  const positiveDirection = config.positiveDirection ?? 'grow';
  const stepSmall = config.stepSmall ?? STEP_SMALL;
  const stepLarge = config.stepLarge ?? STEP_LARGE;
  const step = event.shiftKey ? stepLarge : stepSmall;

  // Home/End: jump to min/max regardless of orientation
  if (event.key === 'Home') {
    return config.min - config.currentValue;
  }
  if (event.key === 'End') {
    return config.max - config.currentValue;
  }

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

/**
 * React hook that makes a resize handle element keyboard-operable.
 *
 * Attaches a keydown listener to the provided ref when focused.
 * Returns:
 *  - `handleKeyDown`: keydown event handler
 *  - `ariaProps`: ARIA attributes for the separator role
 *
 * @param ref - React ref to the resize handle element
 * @param currentValue - current panel size in px
 * @param options - resize configuration
 */
export function useKeyboardResize(
  ref: React.RefObject<HTMLElement | null>,
  currentValue: number,
  options: UseKeyboardResizeOptions & { onResize: (delta: number) => void },
): {
  handleKeyDown: (event: React.KeyboardEvent) => void;
  ariaProps: ReturnType<typeof getResizeAriaProps>;
} {
  const {
    min,
    max,
    direction = 'horizontal',
    positiveDirection = 'grow',
    stepSmall,
    stepLarge,
    onResize,
    enabled = true,
  } = options;

  // Stable ref for the onResize callback to avoid re-attaching listeners
  const onResizeRef = useRef(onResize);
  onResizeRef.current = onResize;

  const config: KeyboardResizeConfig = useMemo(
    () => ({
      currentValue,
      min,
      max,
      onResize: (delta: number) => {
        onResizeRef.current(delta);
      },
      orientation: direction,
      positiveDirection,
      stepSmall,
      stepLarge,
    }),
    [currentValue, min, max, direction, positiveDirection, stepSmall, stepLarge],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (!enabled) {
        return;
      }
      const delta = getResizeDelta(event, config);
      if (delta !== 0) {
        event.preventDefault();
        config.onResize(delta);
      }
    },
    [config, enabled],
  );

  // Attach native keydown listener to the ref element for imperative usage
  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) {
      return;
    }

    const nativeHandler = (event: KeyboardEvent) => {
      const delta = getResizeDelta(event, config);
      if (delta !== 0) {
        event.preventDefault();
        config.onResize(delta);
      }
    };

    el.addEventListener('keydown', nativeHandler);
    return () => {
      el.removeEventListener('keydown', nativeHandler);
    };
  }, [ref, config, enabled]);

  const ariaProps = useMemo(() => getResizeAriaProps(config), [config]);

  return { handleKeyDown, ariaProps };
}
