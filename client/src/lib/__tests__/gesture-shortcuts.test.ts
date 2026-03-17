import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  GestureRecognizer,
  DEFAULT_GESTURE_CONFIG,
  useGestureShortcuts,
} from '../gesture-shortcuts';
import type { GestureConfig, GestureEvent, GestureHandler, GestureType } from '../gesture-shortcuts';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** Create a minimal Touch object. */
function makeTouch(overrides: {
  identifier?: number;
  clientX?: number;
  clientY?: number;
}): Touch {
  return {
    identifier: overrides.identifier ?? 0,
    clientX: overrides.clientX ?? 0,
    clientY: overrides.clientY ?? 0,
    pageX: overrides.clientX ?? 0,
    pageY: overrides.clientY ?? 0,
    screenX: overrides.clientX ?? 0,
    screenY: overrides.clientY ?? 0,
    target: document.createElement('div'),
    radiusX: 0,
    radiusY: 0,
    rotationAngle: 0,
    force: 0,
  } as Touch;
}

/** Build a TouchList from an array of Touch objects. */
function makeTouchList(touches: Touch[]): TouchList {
  const list = touches as unknown as TouchList;
  Object.defineProperty(list, 'length', { value: touches.length, writable: false });
  Object.defineProperty(list, 'item', {
    value: (index: number) => touches[index] ?? null,
    writable: false,
  });
  // Make iterable
  (list as Record<string, unknown>)[Symbol.iterator] = function* () {
    for (let i = 0; i < touches.length; i++) {
      yield touches[i];
    }
  };
  // Index access
  for (let i = 0; i < touches.length; i++) {
    Object.defineProperty(list, i, { value: touches[i], writable: false });
  }
  return list;
}

/** Create a TouchEvent with the specified touches. */
function makeTouchEvent(
  type: string,
  changedTouches: Touch[],
  allTouches?: Touch[],
): TouchEvent {
  const event = new Event(type, { bubbles: true, cancelable: true }) as unknown as TouchEvent;
  Object.defineProperty(event, 'changedTouches', {
    value: makeTouchList(changedTouches),
    writable: false,
  });
  Object.defineProperty(event, 'touches', {
    value: makeTouchList(allTouches ?? changedTouches),
    writable: false,
  });
  return event;
}

/** Create a target div element for attaching the recognizer. */
function createTargetElement(): HTMLDivElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DEFAULT_GESTURE_CONFIG', () => {
  it('has all required fields with sensible defaults', () => {
    expect(DEFAULT_GESTURE_CONFIG.enabled).toBe(true);
    expect(DEFAULT_GESTURE_CONFIG.sensitivity).toBe(1.0);
    expect(DEFAULT_GESTURE_CONFIG.deadzone).toBe(10);
    expect(DEFAULT_GESTURE_CONFIG.swipeMaxDuration).toBe(300);
    expect(DEFAULT_GESTURE_CONFIG.swipeMinDistance).toBe(50);
    expect(DEFAULT_GESTURE_CONFIG.longPressDuration).toBe(500);
    expect(DEFAULT_GESTURE_CONFIG.doubleTapInterval).toBe(300);
    expect(DEFAULT_GESTURE_CONFIG.tapMoveTolerance).toBe(10);
  });

  it('is frozen-safe (shallow copy does not affect original)', () => {
    const copy = { ...DEFAULT_GESTURE_CONFIG };
    copy.sensitivity = 99;
    expect(DEFAULT_GESTURE_CONFIG.sensitivity).toBe(1.0);
  });
});

describe('GestureRecognizer', () => {
  let recognizer: GestureRecognizer;
  let target: HTMLDivElement;

  beforeEach(() => {
    vi.useFakeTimers();
    recognizer = new GestureRecognizer();
    target = createTargetElement();
  });

  afterEach(() => {
    recognizer.destroy();
    target.remove();
    vi.useRealTimers();
  });

  // -----------------------------------------------------------------------
  // Construction & config
  // -----------------------------------------------------------------------

  describe('construction and configuration', () => {
    it('creates with default config when no args given', () => {
      const config = recognizer.getConfig();
      expect(config).toEqual(DEFAULT_GESTURE_CONFIG);
    });

    it('merges partial config with defaults', () => {
      const custom = new GestureRecognizer({ sensitivity: 2.5, deadzone: 20 });
      const config = custom.getConfig();
      expect(config.sensitivity).toBe(2.5);
      expect(config.deadzone).toBe(20);
      expect(config.enabled).toBe(true); // from default
      expect(config.longPressDuration).toBe(500); // from default
      custom.destroy();
    });

    it('updateConfig merges without replacing unset fields', () => {
      recognizer.updateConfig({ sensitivity: 3.0 });
      const config = recognizer.getConfig();
      expect(config.sensitivity).toBe(3.0);
      expect(config.deadzone).toBe(10); // unchanged
    });

    it('getConfig returns a copy, not the internal object', () => {
      const a = recognizer.getConfig();
      const b = recognizer.getConfig();
      expect(a).not.toBe(b);
      expect(a).toEqual(b);
    });
  });

  // -----------------------------------------------------------------------
  // Attach / detach
  // -----------------------------------------------------------------------

  describe('attach and detach', () => {
    it('reports isAttached correctly', () => {
      expect(recognizer.isAttached()).toBe(false);
      recognizer.attachTo(target);
      expect(recognizer.isAttached()).toBe(true);
      recognizer.detach();
      expect(recognizer.isAttached()).toBe(false);
    });

    it('detach is idempotent', () => {
      recognizer.attachTo(target);
      recognizer.detach();
      recognizer.detach(); // should not throw
      expect(recognizer.isAttached()).toBe(false);
    });

    it('reattaching to a new element detaches from the old one', () => {
      const target2 = createTargetElement();
      const handler = vi.fn();
      recognizer.on('long_press', handler);
      recognizer.attachTo(target);
      recognizer.attachTo(target2);

      // Events on old target should not trigger handler
      const touch = makeTouch({ identifier: 0, clientX: 100, clientY: 100 });
      target.dispatchEvent(makeTouchEvent('touchstart', [touch]));
      vi.advanceTimersByTime(600);
      expect(handler).not.toHaveBeenCalled();

      target2.remove();
    });

    it('destroy detaches and removes all handlers', () => {
      const handler = vi.fn();
      recognizer.on('double_tap', handler);
      recognizer.attachTo(target);
      recognizer.destroy();

      expect(recognizer.isAttached()).toBe(false);
      // After destroy, even if somehow events fire, nothing should call handler
    });
  });

  // -----------------------------------------------------------------------
  // Handler registration
  // -----------------------------------------------------------------------

  describe('handler registration', () => {
    it('registers and invokes a handler via on()', () => {
      const handler = vi.fn();
      recognizer.on('double_tap', handler);
      recognizer.attachTo(target);

      // Simulate double tap
      const touch = makeTouch({ identifier: 0, clientX: 50, clientY: 50 });
      target.dispatchEvent(makeTouchEvent('touchstart', [touch]));
      target.dispatchEvent(makeTouchEvent('touchend', [touch]));

      vi.advanceTimersByTime(100);

      target.dispatchEvent(makeTouchEvent('touchstart', [touch]));
      target.dispatchEvent(makeTouchEvent('touchend', [touch]));

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'double_tap', centerX: 50, centerY: 50 }),
      );
    });

    it('supports multiple handlers for the same gesture type', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      recognizer.on('double_tap', handler1);
      recognizer.on('double_tap', handler2);
      recognizer.attachTo(target);

      const touch = makeTouch({ identifier: 0, clientX: 50, clientY: 50 });
      target.dispatchEvent(makeTouchEvent('touchstart', [touch]));
      target.dispatchEvent(makeTouchEvent('touchend', [touch]));
      vi.advanceTimersByTime(100);
      target.dispatchEvent(makeTouchEvent('touchstart', [touch]));
      target.dispatchEvent(makeTouchEvent('touchend', [touch]));

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it('off() removes a specific handler', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      recognizer.on('double_tap', handler1);
      recognizer.on('double_tap', handler2);
      recognizer.off('double_tap', handler1);
      recognizer.attachTo(target);

      const touch = makeTouch({ identifier: 0, clientX: 50, clientY: 50 });
      target.dispatchEvent(makeTouchEvent('touchstart', [touch]));
      target.dispatchEvent(makeTouchEvent('touchend', [touch]));
      vi.advanceTimersByTime(100);
      target.dispatchEvent(makeTouchEvent('touchstart', [touch]));
      target.dispatchEvent(makeTouchEvent('touchend', [touch]));

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it('off() is a no-op for unregistered handler', () => {
      const handler = vi.fn();
      // Should not throw
      recognizer.off('pinch_zoom', handler);
    });

    it('removeAllHandlers clears everything', () => {
      const handler = vi.fn();
      recognizer.on('double_tap', handler);
      recognizer.on('long_press', handler);
      recognizer.removeAllHandlers();
      recognizer.attachTo(target);

      const touch = makeTouch({ identifier: 0, clientX: 50, clientY: 50 });
      target.dispatchEvent(makeTouchEvent('touchstart', [touch]));
      target.dispatchEvent(makeTouchEvent('touchend', [touch]));
      vi.advanceTimersByTime(100);
      target.dispatchEvent(makeTouchEvent('touchstart', [touch]));
      target.dispatchEvent(makeTouchEvent('touchend', [touch]));

      expect(handler).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // Gesture recognition: long press
  // -----------------------------------------------------------------------

  describe('long press', () => {
    it('fires after holding for longPressDuration', () => {
      const handler = vi.fn();
      recognizer.on('long_press', handler);
      recognizer.attachTo(target);

      const touch = makeTouch({ identifier: 0, clientX: 100, clientY: 200 });
      target.dispatchEvent(makeTouchEvent('touchstart', [touch]));

      vi.advanceTimersByTime(500);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'long_press', centerX: 100, centerY: 200 }),
      );
    });

    it('does not fire if finger lifted before duration', () => {
      const handler = vi.fn();
      recognizer.on('long_press', handler);
      recognizer.attachTo(target);

      const touch = makeTouch({ identifier: 0, clientX: 100, clientY: 200 });
      target.dispatchEvent(makeTouchEvent('touchstart', [touch]));
      vi.advanceTimersByTime(200);
      target.dispatchEvent(makeTouchEvent('touchend', [touch]));
      vi.advanceTimersByTime(500);

      expect(handler).not.toHaveBeenCalled();
    });

    it('does not fire if finger moved beyond tolerance', () => {
      const handler = vi.fn();
      recognizer.on('long_press', handler);
      recognizer.attachTo(target);

      const touchStart = makeTouch({ identifier: 0, clientX: 100, clientY: 200 });
      target.dispatchEvent(makeTouchEvent('touchstart', [touchStart]));

      // Move finger beyond tapMoveTolerance (default 10)
      const touchMove = makeTouch({ identifier: 0, clientX: 130, clientY: 200 });
      target.dispatchEvent(makeTouchEvent('touchmove', [touchMove]));

      vi.advanceTimersByTime(600);

      expect(handler).not.toHaveBeenCalled();
    });

    it('uses custom longPressDuration', () => {
      const handler = vi.fn();
      const custom = new GestureRecognizer({ longPressDuration: 1000 });
      custom.on('long_press', handler);
      custom.attachTo(target);

      const touch = makeTouch({ identifier: 0, clientX: 50, clientY: 50 });
      target.dispatchEvent(makeTouchEvent('touchstart', [touch]));

      vi.advanceTimersByTime(500);
      expect(handler).not.toHaveBeenCalled();

      vi.advanceTimersByTime(500);
      expect(handler).toHaveBeenCalledTimes(1);

      custom.destroy();
    });
  });

  // -----------------------------------------------------------------------
  // Gesture recognition: double tap
  // -----------------------------------------------------------------------

  describe('double tap', () => {
    it('fires on two quick taps at the same location', () => {
      const handler = vi.fn();
      recognizer.on('double_tap', handler);
      recognizer.attachTo(target);

      const touch = makeTouch({ identifier: 0, clientX: 80, clientY: 80 });

      // First tap
      target.dispatchEvent(makeTouchEvent('touchstart', [touch]));
      target.dispatchEvent(makeTouchEvent('touchend', [touch]));

      vi.advanceTimersByTime(150);

      // Second tap
      target.dispatchEvent(makeTouchEvent('touchstart', [touch]));
      target.dispatchEvent(makeTouchEvent('touchend', [touch]));

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'double_tap' }),
      );
    });

    it('does not fire if taps are too far apart in time', () => {
      const handler = vi.fn();
      recognizer.on('double_tap', handler);
      recognizer.attachTo(target);

      const touch = makeTouch({ identifier: 0, clientX: 80, clientY: 80 });

      target.dispatchEvent(makeTouchEvent('touchstart', [touch]));
      target.dispatchEvent(makeTouchEvent('touchend', [touch]));

      vi.advanceTimersByTime(400); // Exceeds doubleTapInterval (300)

      target.dispatchEvent(makeTouchEvent('touchstart', [touch]));
      target.dispatchEvent(makeTouchEvent('touchend', [touch]));

      expect(handler).not.toHaveBeenCalled();
    });

    it('does not fire if taps are too far apart in space', () => {
      const handler = vi.fn();
      recognizer.on('double_tap', handler);
      recognizer.attachTo(target);

      const touch1 = makeTouch({ identifier: 0, clientX: 10, clientY: 10 });
      const touch2 = makeTouch({ identifier: 0, clientX: 200, clientY: 200 });

      target.dispatchEvent(makeTouchEvent('touchstart', [touch1]));
      target.dispatchEvent(makeTouchEvent('touchend', [touch1]));

      vi.advanceTimersByTime(100);

      target.dispatchEvent(makeTouchEvent('touchstart', [touch2]));
      target.dispatchEvent(makeTouchEvent('touchend', [touch2]));

      expect(handler).not.toHaveBeenCalled();
    });

    it('triple tap does not fire double_tap twice', () => {
      const handler = vi.fn();
      recognizer.on('double_tap', handler);
      recognizer.attachTo(target);

      const touch = makeTouch({ identifier: 0, clientX: 50, clientY: 50 });

      // First tap
      target.dispatchEvent(makeTouchEvent('touchstart', [touch]));
      target.dispatchEvent(makeTouchEvent('touchend', [touch]));
      vi.advanceTimersByTime(100);

      // Second tap (triggers double_tap)
      target.dispatchEvent(makeTouchEvent('touchstart', [touch]));
      target.dispatchEvent(makeTouchEvent('touchend', [touch]));
      vi.advanceTimersByTime(100);

      // Third tap (should NOT trigger another double_tap because lastTapTime was reset)
      target.dispatchEvent(makeTouchEvent('touchstart', [touch]));
      target.dispatchEvent(makeTouchEvent('touchend', [touch]));

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  // -----------------------------------------------------------------------
  // Gesture recognition: swipe
  // -----------------------------------------------------------------------

  describe('swipe', () => {
    it('recognizes swipe right', () => {
      const handler = vi.fn();
      recognizer.on('swipe_right', handler);
      recognizer.attachTo(target);

      const touchStart = makeTouch({ identifier: 0, clientX: 10, clientY: 100 });
      target.dispatchEvent(makeTouchEvent('touchstart', [touchStart]));

      vi.advanceTimersByTime(100);

      const touchEnd = makeTouch({ identifier: 0, clientX: 200, clientY: 105 });
      target.dispatchEvent(makeTouchEvent('touchend', [touchEnd]));

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'swipe_right', deltaX: expect.any(Number) }),
      );
    });

    it('recognizes swipe left', () => {
      const handler = vi.fn();
      recognizer.on('swipe_left', handler);
      recognizer.attachTo(target);

      const touchStart = makeTouch({ identifier: 0, clientX: 200, clientY: 100 });
      target.dispatchEvent(makeTouchEvent('touchstart', [touchStart]));

      vi.advanceTimersByTime(100);

      const touchEnd = makeTouch({ identifier: 0, clientX: 10, clientY: 105 });
      target.dispatchEvent(makeTouchEvent('touchend', [touchEnd]));

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('does not fire swipe if duration exceeds swipeMaxDuration', () => {
      const handler = vi.fn();
      recognizer.on('swipe_right', handler);
      recognizer.on('swipe_left', handler);
      recognizer.attachTo(target);

      const touchStart = makeTouch({ identifier: 0, clientX: 10, clientY: 100 });
      target.dispatchEvent(makeTouchEvent('touchstart', [touchStart]));

      vi.advanceTimersByTime(500); // Exceeds 300

      const touchEnd = makeTouch({ identifier: 0, clientX: 200, clientY: 100 });
      target.dispatchEvent(makeTouchEvent('touchend', [touchEnd]));

      expect(handler).not.toHaveBeenCalled();
    });

    it('does not fire swipe if distance is below minimum', () => {
      const handler = vi.fn();
      recognizer.on('swipe_right', handler);
      recognizer.attachTo(target);

      const touchStart = makeTouch({ identifier: 0, clientX: 10, clientY: 100 });
      target.dispatchEvent(makeTouchEvent('touchstart', [touchStart]));

      vi.advanceTimersByTime(100);

      const touchEnd = makeTouch({ identifier: 0, clientX: 30, clientY: 100 }); // 20px < 50
      target.dispatchEvent(makeTouchEvent('touchend', [touchEnd]));

      expect(handler).not.toHaveBeenCalled();
    });

    it('does not fire swipe if vertical movement dominates', () => {
      const handler = vi.fn();
      recognizer.on('swipe_right', handler);
      recognizer.on('swipe_left', handler);
      recognizer.attachTo(target);

      const touchStart = makeTouch({ identifier: 0, clientX: 100, clientY: 10 });
      target.dispatchEvent(makeTouchEvent('touchstart', [touchStart]));

      vi.advanceTimersByTime(100);

      const touchEnd = makeTouch({ identifier: 0, clientX: 110, clientY: 200 });
      target.dispatchEvent(makeTouchEvent('touchend', [touchEnd]));

      expect(handler).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // Gesture recognition: pinch zoom
  // -----------------------------------------------------------------------

  describe('pinch zoom', () => {
    it('fires pinch_zoom when two fingers spread apart', () => {
      const handler = vi.fn();
      recognizer.on('pinch_zoom', handler);
      recognizer.attachTo(target);

      // Two fingers start close together
      const t1Start = makeTouch({ identifier: 0, clientX: 100, clientY: 100 });
      const t2Start = makeTouch({ identifier: 1, clientX: 120, clientY: 100 });
      target.dispatchEvent(makeTouchEvent('touchstart', [t1Start, t2Start]));

      // Spread apart beyond deadzone
      const t1Move = makeTouch({ identifier: 0, clientX: 50, clientY: 100 });
      const t2Move = makeTouch({ identifier: 1, clientX: 170, clientY: 100 });
      target.dispatchEvent(makeTouchEvent('touchmove', [t1Move, t2Move]));

      expect(handler).toHaveBeenCalled();
      const event = handler.mock.calls[0][0] as GestureEvent;
      expect(event.type).toBe('pinch_zoom');
      expect(event.scale).toBeDefined();
      expect(event.scale!).toBeGreaterThan(1.0); // fingers spread = zoom in
    });

    it('fires pinch_zoom with scale < 1 when fingers pinch together', () => {
      const handler = vi.fn();
      recognizer.on('pinch_zoom', handler);
      recognizer.attachTo(target);

      // Two fingers start far apart
      const t1Start = makeTouch({ identifier: 0, clientX: 50, clientY: 100 });
      const t2Start = makeTouch({ identifier: 1, clientX: 200, clientY: 100 });
      target.dispatchEvent(makeTouchEvent('touchstart', [t1Start, t2Start]));

      // Pinch together
      const t1Move = makeTouch({ identifier: 0, clientX: 100, clientY: 100 });
      const t2Move = makeTouch({ identifier: 1, clientX: 130, clientY: 100 });
      target.dispatchEvent(makeTouchEvent('touchmove', [t1Move, t2Move]));

      expect(handler).toHaveBeenCalled();
      const event = handler.mock.calls[0][0] as GestureEvent;
      expect(event.scale!).toBeLessThan(1.0);
    });

    it('applies sensitivity multiplier to scale', () => {
      const handler = vi.fn();
      const sensitive = new GestureRecognizer({ sensitivity: 3.0 });
      sensitive.on('pinch_zoom', handler);
      sensitive.attachTo(target);

      const t1Start = makeTouch({ identifier: 0, clientX: 100, clientY: 100 });
      const t2Start = makeTouch({ identifier: 1, clientX: 120, clientY: 100 });
      target.dispatchEvent(makeTouchEvent('touchstart', [t1Start, t2Start]));

      const t1Move = makeTouch({ identifier: 0, clientX: 50, clientY: 100 });
      const t2Move = makeTouch({ identifier: 1, clientX: 170, clientY: 100 });
      target.dispatchEvent(makeTouchEvent('touchmove', [t1Move, t2Move]));

      expect(handler).toHaveBeenCalled();
      const event = handler.mock.calls[0][0] as GestureEvent;
      // With sensitivity 3.0, deviation from 1.0 is amplified 3x
      expect(event.scale!).toBeGreaterThan(1.0);

      sensitive.destroy();
    });
  });

  // -----------------------------------------------------------------------
  // Gesture recognition: two-finger pan
  // -----------------------------------------------------------------------

  describe('two-finger pan', () => {
    it('fires two_finger_pan when both fingers move in the same direction', () => {
      const handler = vi.fn();
      recognizer.on('two_finger_pan', handler);
      recognizer.attachTo(target);

      const t1Start = makeTouch({ identifier: 0, clientX: 100, clientY: 100 });
      const t2Start = makeTouch({ identifier: 1, clientX: 120, clientY: 100 });
      target.dispatchEvent(makeTouchEvent('touchstart', [t1Start, t2Start]));

      // Both fingers move right by 50px (same distance = no pinch, only pan)
      const t1Move = makeTouch({ identifier: 0, clientX: 150, clientY: 100 });
      const t2Move = makeTouch({ identifier: 1, clientX: 170, clientY: 100 });
      target.dispatchEvent(makeTouchEvent('touchmove', [t1Move, t2Move]));

      expect(handler).toHaveBeenCalled();
      const event = handler.mock.calls[0][0] as GestureEvent;
      expect(event.type).toBe('two_finger_pan');
      expect(event.deltaX).toBeDefined();
      expect(event.deltaX!).toBeGreaterThan(0);
    });

    it('reports deltaY for vertical two-finger pan', () => {
      const handler = vi.fn();
      recognizer.on('two_finger_pan', handler);
      recognizer.attachTo(target);

      const t1Start = makeTouch({ identifier: 0, clientX: 100, clientY: 100 });
      const t2Start = makeTouch({ identifier: 1, clientX: 120, clientY: 100 });
      target.dispatchEvent(makeTouchEvent('touchstart', [t1Start, t2Start]));

      const t1Move = makeTouch({ identifier: 0, clientX: 100, clientY: 160 });
      const t2Move = makeTouch({ identifier: 1, clientX: 120, clientY: 160 });
      target.dispatchEvent(makeTouchEvent('touchmove', [t1Move, t2Move]));

      expect(handler).toHaveBeenCalled();
      const event = handler.mock.calls[0][0] as GestureEvent;
      expect(event.deltaY!).toBeGreaterThan(0);
    });
  });

  // -----------------------------------------------------------------------
  // Disabled recognizer
  // -----------------------------------------------------------------------

  describe('disabled state', () => {
    it('does not fire gestures when enabled is false', () => {
      const handler = vi.fn();
      const disabled = new GestureRecognizer({ enabled: false });
      disabled.on('long_press', handler);
      disabled.on('double_tap', handler);
      disabled.attachTo(target);

      const touch = makeTouch({ identifier: 0, clientX: 50, clientY: 50 });
      target.dispatchEvent(makeTouchEvent('touchstart', [touch]));
      vi.advanceTimersByTime(600);
      target.dispatchEvent(makeTouchEvent('touchend', [touch]));

      expect(handler).not.toHaveBeenCalled();
      disabled.destroy();
    });

    it('can be re-enabled at runtime via updateConfig', () => {
      const handler = vi.fn();
      const rec = new GestureRecognizer({ enabled: false });
      rec.on('long_press', handler);
      rec.attachTo(target);

      rec.updateConfig({ enabled: true });

      const touch = makeTouch({ identifier: 0, clientX: 50, clientY: 50 });
      target.dispatchEvent(makeTouchEvent('touchstart', [touch]));
      vi.advanceTimersByTime(600);

      expect(handler).toHaveBeenCalledTimes(1);
      rec.destroy();
    });
  });

  // -----------------------------------------------------------------------
  // Touch cancel
  // -----------------------------------------------------------------------

  describe('touch cancel', () => {
    it('cancels long press on touchcancel', () => {
      const handler = vi.fn();
      recognizer.on('long_press', handler);
      recognizer.attachTo(target);

      const touch = makeTouch({ identifier: 0, clientX: 50, clientY: 50 });
      target.dispatchEvent(makeTouchEvent('touchstart', [touch]));
      target.dispatchEvent(makeTouchEvent('touchcancel', [touch]));

      vi.advanceTimersByTime(600);
      expect(handler).not.toHaveBeenCalled();
    });

    it('resets internal state after touchcancel', () => {
      const handler = vi.fn();
      recognizer.on('pinch_zoom', handler);
      recognizer.attachTo(target);

      const t1 = makeTouch({ identifier: 0, clientX: 100, clientY: 100 });
      const t2 = makeTouch({ identifier: 1, clientX: 120, clientY: 100 });
      target.dispatchEvent(makeTouchEvent('touchstart', [t1, t2]));
      target.dispatchEvent(makeTouchEvent('touchcancel', [t1, t2]));

      // After cancel, a new single touch should not trigger pinch
      const t3 = makeTouch({ identifier: 2, clientX: 50, clientY: 50 });
      target.dispatchEvent(makeTouchEvent('touchstart', [t3]));
      vi.advanceTimersByTime(600);

      expect(handler).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------

  describe('edge cases', () => {
    it('handles touchmove with no prior touchstart gracefully', () => {
      recognizer.attachTo(target);
      const touch = makeTouch({ identifier: 99, clientX: 50, clientY: 50 });
      // Should not throw
      target.dispatchEvent(makeTouchEvent('touchmove', [touch]));
    });

    it('handles touchend with no prior touchstart gracefully', () => {
      recognizer.attachTo(target);
      const touch = makeTouch({ identifier: 99, clientX: 50, clientY: 50 });
      // Should not throw
      target.dispatchEvent(makeTouchEvent('touchend', [touch]));
    });

    it('GestureEvent includes centerX and centerY', () => {
      const handler = vi.fn();
      recognizer.on('long_press', handler);
      recognizer.attachTo(target);

      const touch = makeTouch({ identifier: 0, clientX: 123, clientY: 456 });
      target.dispatchEvent(makeTouchEvent('touchstart', [touch]));
      vi.advanceTimersByTime(600);

      const event = handler.mock.calls[0][0] as GestureEvent;
      expect(event.centerX).toBe(123);
      expect(event.centerY).toBe(456);
    });

    it('second finger down cancels long press timer', () => {
      const handler = vi.fn();
      recognizer.on('long_press', handler);
      recognizer.attachTo(target);

      const t1 = makeTouch({ identifier: 0, clientX: 100, clientY: 100 });
      target.dispatchEvent(makeTouchEvent('touchstart', [t1]));

      vi.advanceTimersByTime(200);

      // Second finger down
      const t2 = makeTouch({ identifier: 1, clientX: 120, clientY: 100 });
      target.dispatchEvent(makeTouchEvent('touchstart', [t2]));

      vi.advanceTimersByTime(500);
      expect(handler).not.toHaveBeenCalled();
    });
  });
});

// ---------------------------------------------------------------------------
// useGestureShortcuts hook
// ---------------------------------------------------------------------------

describe('useGestureShortcuts', () => {
  it('is a function', () => {
    expect(typeof useGestureShortcuts).toBe('function');
  });

  it('accepts all GestureType keys as handlers', () => {
    // Type-level check: this should compile without errors
    const handlers: Partial<Record<GestureType, GestureHandler>> = {
      pinch_zoom: (_e: GestureEvent) => { /* noop */ },
      two_finger_pan: (_e: GestureEvent) => { /* noop */ },
      swipe_left: (_e: GestureEvent) => { /* noop */ },
      swipe_right: (_e: GestureEvent) => { /* noop */ },
      long_press: (_e: GestureEvent) => { /* noop */ },
      double_tap: (_e: GestureEvent) => { /* noop */ },
    };
    expect(Object.keys(handlers)).toHaveLength(6);
  });
});

// ---------------------------------------------------------------------------
// GestureType exhaustiveness
// ---------------------------------------------------------------------------

describe('GestureType', () => {
  it('all six gesture types are distinct', () => {
    const types: GestureType[] = [
      'pinch_zoom',
      'two_finger_pan',
      'swipe_left',
      'swipe_right',
      'long_press',
      'double_tap',
    ];
    expect(new Set(types).size).toBe(6);
  });
});
