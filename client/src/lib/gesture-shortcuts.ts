/**
 * Touch Gesture Recognition Engine
 *
 * Recognizes multi-touch gestures (pinch-zoom, two-finger pan, swipes,
 * long-press, double-tap) and maps them to configurable handler callbacks.
 * Designed for use on touch-enabled canvases (schematic, PCB, architecture).
 *
 * Usage:
 *   const recognizer = new GestureRecognizer(config);
 *   recognizer.on('pinch_zoom', ({ scale }) => { ... });
 *   recognizer.attachTo(element);
 *
 *   // React hook:
 *   useGestureShortcuts(ref, { pinch_zoom: (e) => { ... } });
 */

import { useEffect, useRef } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Supported gesture types. */
export type GestureType =
  | 'pinch_zoom'
  | 'two_finger_pan'
  | 'swipe_left'
  | 'swipe_right'
  | 'long_press'
  | 'double_tap';

/** Data payload emitted with a recognized gesture. */
export interface GestureEvent {
  /** The recognized gesture type. */
  type: GestureType;
  /** Pinch scale factor (1.0 = no change). Present for pinch_zoom. */
  scale?: number;
  /** Delta X in pixels. Present for two_finger_pan and swipes. */
  deltaX?: number;
  /** Delta Y in pixels. Present for two_finger_pan. */
  deltaY?: number;
  /** Center X of the gesture (viewport coordinates). */
  centerX: number;
  /** Center Y of the gesture (viewport coordinates). */
  centerY: number;
  /** Original TouchEvent that triggered the gesture. */
  originalEvent?: TouchEvent;
}

/** Callback type for gesture handlers. */
export type GestureHandler = (event: GestureEvent) => void;

/** Configuration for gesture recognition thresholds. */
export interface GestureConfig {
  /** Whether gesture recognition is enabled. */
  enabled: boolean;
  /**
   * Sensitivity multiplier for pinch zoom (higher = more responsive).
   * Range: 0.1 – 5.0. Default: 1.0.
   */
  sensitivity: number;
  /**
   * Minimum movement in pixels before a gesture is recognized (deadzone).
   * Prevents accidental gestures from micro-movements.
   * Range: 1 – 50. Default: 10.
   */
  deadzone: number;
  /**
   * Maximum time in ms for a swipe gesture (start → end).
   * Default: 300.
   */
  swipeMaxDuration: number;
  /**
   * Minimum swipe distance in pixels.
   * Default: 50.
   */
  swipeMinDistance: number;
  /**
   * Duration in ms a finger must be held for a long press.
   * Default: 500.
   */
  longPressDuration: number;
  /**
   * Maximum interval in ms between two taps for a double-tap.
   * Default: 300.
   */
  doubleTapInterval: number;
  /**
   * Maximum movement in pixels allowed during a tap (prevents tap on drag).
   * Default: 10.
   */
  tapMoveTolerance: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default gesture configuration with sensible thresholds. */
export const DEFAULT_GESTURE_CONFIG: GestureConfig = {
  enabled: true,
  sensitivity: 1.0,
  deadzone: 10,
  swipeMaxDuration: 300,
  swipeMinDistance: 50,
  longPressDuration: 500,
  doubleTapInterval: 300,
  tapMoveTolerance: 10,
};

// ---------------------------------------------------------------------------
// Internal tracking state
// ---------------------------------------------------------------------------

interface TouchPoint {
  id: number;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  startTime: number;
}

// ---------------------------------------------------------------------------
// GestureRecognizer
// ---------------------------------------------------------------------------

/**
 * Stateful gesture recognizer that attaches to a DOM element, tracks
 * touch events, and emits recognized gestures to registered handlers.
 */
export class GestureRecognizer {
  private config: GestureConfig;
  private handlers = new Map<GestureType, GestureHandler[]>();
  private element: HTMLElement | null = null;

  // Touch tracking state
  private activeTouches = new Map<number, TouchPoint>();
  private initialPinchDistance: number | null = null;
  private initialPinchCenter: { x: number; y: number } | null = null;
  private lastPanCenter: { x: number; y: number } | null = null;
  private longPressTimer: ReturnType<typeof setTimeout> | null = null;
  private lastTapTime = 0;
  private lastTapX = 0;
  private lastTapY = 0;
  private gestureActive = false;

  // Bound event handlers for proper cleanup
  private boundTouchStart: (e: TouchEvent) => void;
  private boundTouchMove: (e: TouchEvent) => void;
  private boundTouchEnd: (e: TouchEvent) => void;
  private boundTouchCancel: (e: TouchEvent) => void;

  constructor(config: Partial<GestureConfig> = {}) {
    this.config = { ...DEFAULT_GESTURE_CONFIG, ...config };

    this.boundTouchStart = this.handleTouchStart.bind(this);
    this.boundTouchMove = this.handleTouchMove.bind(this);
    this.boundTouchEnd = this.handleTouchEnd.bind(this);
    this.boundTouchCancel = this.handleTouchCancel.bind(this);
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /** Register a handler for a gesture type. Multiple handlers per type allowed. */
  on(type: GestureType, handler: GestureHandler): void {
    const existing = this.handlers.get(type) ?? [];
    existing.push(handler);
    this.handlers.set(type, existing);
  }

  /** Remove a specific handler for a gesture type. */
  off(type: GestureType, handler: GestureHandler): void {
    const existing = this.handlers.get(type);
    if (!existing) {
      return;
    }
    const index = existing.indexOf(handler);
    if (index !== -1) {
      existing.splice(index, 1);
    }
    if (existing.length === 0) {
      this.handlers.delete(type);
    }
  }

  /** Remove all handlers for all gesture types. */
  removeAllHandlers(): void {
    this.handlers.clear();
  }

  /** Attach touch event listeners to a DOM element. */
  attachTo(element: HTMLElement): void {
    this.detach();
    this.element = element;
    element.addEventListener('touchstart', this.boundTouchStart, { passive: false });
    element.addEventListener('touchmove', this.boundTouchMove, { passive: false });
    element.addEventListener('touchend', this.boundTouchEnd, { passive: false });
    element.addEventListener('touchcancel', this.boundTouchCancel, { passive: false });
  }

  /** Detach all touch event listeners and reset internal state. */
  detach(): void {
    if (this.element) {
      this.element.removeEventListener('touchstart', this.boundTouchStart);
      this.element.removeEventListener('touchmove', this.boundTouchMove);
      this.element.removeEventListener('touchend', this.boundTouchEnd);
      this.element.removeEventListener('touchcancel', this.boundTouchCancel);
      this.element = null;
    }
    this.resetState();
  }

  /** Update configuration at runtime. */
  updateConfig(config: Partial<GestureConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /** Get a copy of the current configuration. */
  getConfig(): GestureConfig {
    return { ...this.config };
  }

  /** Whether the recognizer is currently attached to an element. */
  isAttached(): boolean {
    return this.element !== null;
  }

  /** Destroy the recognizer: detach and remove all handlers. */
  destroy(): void {
    this.detach();
    this.removeAllHandlers();
  }

  // -----------------------------------------------------------------------
  // Touch event handlers
  // -----------------------------------------------------------------------

  private handleTouchStart(e: TouchEvent): void {
    if (!this.config.enabled) {
      return;
    }

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      this.activeTouches.set(touch.identifier, {
        id: touch.identifier,
        startX: touch.clientX,
        startY: touch.clientY,
        currentX: touch.clientX,
        currentY: touch.clientY,
        startTime: Date.now(),
      });
    }

    const touchCount = this.activeTouches.size;

    if (touchCount === 1) {
      // Start long-press timer for single touch
      this.startLongPressTimer(e);
    } else if (touchCount === 2) {
      // Two fingers down — initialize pinch/pan tracking
      this.cancelLongPressTimer();
      const points = Array.from(this.activeTouches.values());
      this.initialPinchDistance = this.distanceBetween(points[0], points[1]);
      this.initialPinchCenter = this.centerOf(points[0], points[1]);
      this.lastPanCenter = { ...this.initialPinchCenter };
      this.gestureActive = false;
    }
  }

  private handleTouchMove(e: TouchEvent): void {
    if (!this.config.enabled) {
      return;
    }

    // Update tracked positions
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      const tracked = this.activeTouches.get(touch.identifier);
      if (tracked) {
        tracked.currentX = touch.clientX;
        tracked.currentY = touch.clientY;
      }
    }

    const touchCount = this.activeTouches.size;

    if (touchCount === 1) {
      // Check if movement exceeds tap tolerance — cancel long press
      const point = Array.from(this.activeTouches.values())[0];
      const dx = point.currentX - point.startX;
      const dy = point.currentY - point.startY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > this.config.tapMoveTolerance) {
        this.cancelLongPressTimer();
      }
    } else if (touchCount === 2) {
      this.cancelLongPressTimer();
      const points = Array.from(this.activeTouches.values());
      const currentDistance = this.distanceBetween(points[0], points[1]);
      const currentCenter = this.centerOf(points[0], points[1]);

      if (this.initialPinchDistance !== null && this.initialPinchCenter !== null && this.lastPanCenter !== null) {
        const distanceDelta = Math.abs(currentDistance - this.initialPinchDistance);
        const panDeltaX = currentCenter.x - this.lastPanCenter.x;
        const panDeltaY = currentCenter.y - this.lastPanCenter.y;
        const panDistance = Math.sqrt(panDeltaX * panDeltaX + panDeltaY * panDeltaY);

        // Determine if the dominant gesture is pinch or pan based on which
        // exceeds the deadzone first (or by magnitude if both do)
        if (distanceDelta > this.config.deadzone || panDistance > this.config.deadzone || this.gestureActive) {
          this.gestureActive = true;
          e.preventDefault();

          // Pinch zoom: distance between fingers changed significantly
          if (distanceDelta > this.config.deadzone * 0.5) {
            const rawScale = currentDistance / this.initialPinchDistance;
            // Apply sensitivity: amplify the deviation from 1.0
            const scale = 1 + (rawScale - 1) * this.config.sensitivity;
            this.emit({
              type: 'pinch_zoom',
              scale,
              centerX: currentCenter.x,
              centerY: currentCenter.y,
              originalEvent: e,
            });
            this.initialPinchDistance = currentDistance;
          }

          // Two-finger pan: center moved significantly
          if (panDistance > this.config.deadzone * 0.5) {
            this.emit({
              type: 'two_finger_pan',
              deltaX: panDeltaX,
              deltaY: panDeltaY,
              centerX: currentCenter.x,
              centerY: currentCenter.y,
              originalEvent: e,
            });
            this.lastPanCenter = { ...currentCenter };
          }
        }
      }
    }
  }

  private handleTouchEnd(e: TouchEvent): void {
    if (!this.config.enabled) {
      return;
    }

    const now = Date.now();

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      const tracked = this.activeTouches.get(touch.identifier);

      if (tracked && this.activeTouches.size === 1) {
        // Single finger lifted — check for swipe, double-tap, or end of long press
        const dx = touch.clientX - tracked.startX;
        const dy = touch.clientY - tracked.startY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const duration = now - tracked.startTime;

        this.cancelLongPressTimer();

        if (dist < this.config.tapMoveTolerance) {
          // It was a tap (minimal movement)
          const timeSinceLastTap = now - this.lastTapTime;
          const distFromLastTap = Math.sqrt(
            (touch.clientX - this.lastTapX) ** 2 + (touch.clientY - this.lastTapY) ** 2,
          );

          if (timeSinceLastTap < this.config.doubleTapInterval && distFromLastTap < this.config.tapMoveTolerance * 3) {
            // Double tap
            this.emit({
              type: 'double_tap',
              centerX: touch.clientX,
              centerY: touch.clientY,
              originalEvent: e,
            });
            // Reset to prevent triple-tap triggering another double-tap
            this.lastTapTime = 0;
          } else {
            this.lastTapTime = now;
            this.lastTapX = touch.clientX;
            this.lastTapY = touch.clientY;
          }
        } else if (duration <= this.config.swipeMaxDuration && dist >= this.config.swipeMinDistance) {
          // Horizontal swipe (only if horizontal component dominates)
          if (Math.abs(dx) > Math.abs(dy)) {
            const type: GestureType = dx > 0 ? 'swipe_right' : 'swipe_left';
            this.emit({
              type,
              deltaX: dx,
              centerX: touch.clientX,
              centerY: touch.clientY,
              originalEvent: e,
            });
          }
        }
      }

      this.activeTouches.delete(touch.identifier);
    }

    // Reset multi-touch state when all fingers are lifted
    if (this.activeTouches.size === 0) {
      this.initialPinchDistance = null;
      this.initialPinchCenter = null;
      this.lastPanCenter = null;
      this.gestureActive = false;
    }
  }

  private handleTouchCancel(e: TouchEvent): void {
    for (let i = 0; i < e.changedTouches.length; i++) {
      this.activeTouches.delete(e.changedTouches[i].identifier);
    }
    this.cancelLongPressTimer();
    if (this.activeTouches.size === 0) {
      this.resetState();
    }
  }

  // -----------------------------------------------------------------------
  // Internal helpers
  // -----------------------------------------------------------------------

  private emit(event: GestureEvent): void {
    const handlers = this.handlers.get(event.type);
    if (handlers) {
      for (const handler of handlers) {
        handler(event);
      }
    }
  }

  private distanceBetween(a: TouchPoint, b: TouchPoint): number {
    const dx = a.currentX - b.currentX;
    const dy = a.currentY - b.currentY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private centerOf(a: TouchPoint, b: TouchPoint): { x: number; y: number } {
    return {
      x: (a.currentX + b.currentX) / 2,
      y: (a.currentY + b.currentY) / 2,
    };
  }

  private startLongPressTimer(e: TouchEvent): void {
    this.cancelLongPressTimer();
    const touch = e.changedTouches[0];
    const x = touch.clientX;
    const y = touch.clientY;
    this.longPressTimer = setTimeout(() => {
      this.longPressTimer = null;
      // Only fire if the touch is still active and hasn't moved
      const tracked = this.activeTouches.get(touch.identifier);
      if (tracked && this.activeTouches.size === 1) {
        const dx = tracked.currentX - tracked.startX;
        const dy = tracked.currentY - tracked.startY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= this.config.tapMoveTolerance) {
          this.emit({
            type: 'long_press',
            centerX: x,
            centerY: y,
          });
        }
      }
    }, this.config.longPressDuration);
  }

  private cancelLongPressTimer(): void {
    if (this.longPressTimer !== null) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
  }

  private resetState(): void {
    this.activeTouches.clear();
    this.initialPinchDistance = null;
    this.initialPinchCenter = null;
    this.lastPanCenter = null;
    this.gestureActive = false;
    this.cancelLongPressTimer();
  }
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

/**
 * Hook that attaches a GestureRecognizer to a ref'd DOM element.
 *
 * @param ref - React ref to the target element
 * @param handlers - Map of gesture type to handler callback
 * @param config - Optional partial config overrides
 */
export function useGestureShortcuts(
  ref: React.RefObject<HTMLElement | null>,
  handlers: Partial<Record<GestureType, GestureHandler>>,
  config?: Partial<GestureConfig>,
): void {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const configRef = useRef(config);
  configRef.current = config;

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }

    const recognizer = new GestureRecognizer(configRef.current);

    // Register handlers from the current ref
    const gestureTypes: GestureType[] = [
      'pinch_zoom',
      'two_finger_pan',
      'swipe_left',
      'swipe_right',
      'long_press',
      'double_tap',
    ];

    for (const type of gestureTypes) {
      recognizer.on(type, (event) => {
        const handler = handlersRef.current[type];
        if (handler) {
          handler(event);
        }
      });
    }

    recognizer.attachTo(element);

    return () => {
      recognizer.destroy();
    };
    // Re-attach when the element ref changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref]);
}
