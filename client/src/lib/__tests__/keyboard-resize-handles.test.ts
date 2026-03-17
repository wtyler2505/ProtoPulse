import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRef } from 'react';
import {
  getResizeDelta,
  createResizeKeyHandler,
  getResizeAriaProps,
  useKeyboardResize,
  STEP_SMALL,
  STEP_LARGE,
} from '../keyboard-resize';
import type {
  KeyboardResizeConfig,
  ResizeDirection,
  UseKeyboardResizeOptions,
} from '../keyboard-resize';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfig(overrides: Partial<KeyboardResizeConfig> = {}): KeyboardResizeConfig {
  return {
    currentValue: 300,
    min: 100,
    max: 600,
    onResize: vi.fn(),
    ...overrides,
  };
}

function makeKeyEvent(key: string, shiftKey = false) {
  return { key, shiftKey };
}

function makeReactKeyEvent(key: string, shiftKey = false) {
  return {
    key,
    shiftKey,
    preventDefault: vi.fn(),
  } as unknown as React.KeyboardEvent;
}

// ---------------------------------------------------------------------------
// ResizeDirection type
// ---------------------------------------------------------------------------

describe('ResizeDirection type', () => {
  it('accepts horizontal as a valid direction', () => {
    const dir: ResizeDirection = 'horizontal';
    expect(dir).toBe('horizontal');
  });

  it('accepts vertical as a valid direction', () => {
    const dir: ResizeDirection = 'vertical';
    expect(dir).toBe('vertical');
  });

  it('is used as the orientation field in KeyboardResizeConfig', () => {
    const config = makeConfig({ orientation: 'vertical' });
    expect(config.orientation).toBe('vertical');
  });
});

// ---------------------------------------------------------------------------
// Home / End key support
// ---------------------------------------------------------------------------

describe('getResizeDelta — Home/End keys', () => {
  it('Home jumps to min from mid-range', () => {
    const config = makeConfig({ currentValue: 400, min: 100 });
    const delta = getResizeDelta(makeKeyEvent('Home'), config);
    expect(delta).toBe(-300); // 100 - 400
  });

  it('Home returns 0 when already at min', () => {
    const config = makeConfig({ currentValue: 100, min: 100 });
    const delta = getResizeDelta(makeKeyEvent('Home'), config);
    expect(delta).toBe(0);
  });

  it('End jumps to max from mid-range', () => {
    const config = makeConfig({ currentValue: 300, max: 600 });
    const delta = getResizeDelta(makeKeyEvent('End'), config);
    expect(delta).toBe(300); // 600 - 300
  });

  it('End returns 0 when already at max', () => {
    const config = makeConfig({ currentValue: 600, max: 600 });
    const delta = getResizeDelta(makeKeyEvent('End'), config);
    expect(delta).toBe(0);
  });

  it('Home works in vertical orientation', () => {
    const config = makeConfig({ currentValue: 250, min: 50, orientation: 'vertical' });
    const delta = getResizeDelta(makeKeyEvent('Home'), config);
    expect(delta).toBe(-200);
  });

  it('End works in vertical orientation', () => {
    const config = makeConfig({ currentValue: 250, max: 500, orientation: 'vertical' });
    const delta = getResizeDelta(makeKeyEvent('End'), config);
    expect(delta).toBe(250);
  });

  it('Home ignores shiftKey modifier (always jumps to min)', () => {
    const config = makeConfig({ currentValue: 400, min: 100 });
    const delta = getResizeDelta(makeKeyEvent('Home', true), config);
    expect(delta).toBe(-300);
  });

  it('End ignores shiftKey modifier (always jumps to max)', () => {
    const config = makeConfig({ currentValue: 300, max: 600 });
    const delta = getResizeDelta(makeKeyEvent('End', true), config);
    expect(delta).toBe(300);
  });

  it('Home is unaffected by positiveDirection setting', () => {
    const config = makeConfig({ currentValue: 400, min: 100, positiveDirection: 'shrink' });
    const delta = getResizeDelta(makeKeyEvent('Home'), config);
    expect(delta).toBe(-300);
  });

  it('End is unaffected by positiveDirection setting', () => {
    const config = makeConfig({ currentValue: 300, max: 600, positiveDirection: 'shrink' });
    const delta = getResizeDelta(makeKeyEvent('End'), config);
    expect(delta).toBe(300);
  });
});

// ---------------------------------------------------------------------------
// Custom step sizes (stepSmall / stepLarge)
// ---------------------------------------------------------------------------

describe('getResizeDelta — custom step sizes', () => {
  it('uses custom stepSmall for plain arrow key', () => {
    const config = makeConfig({ stepSmall: 5 });
    const delta = getResizeDelta(makeKeyEvent('ArrowRight'), config);
    expect(delta).toBe(5);
  });

  it('uses custom stepLarge for Shift+Arrow', () => {
    const config = makeConfig({ stepLarge: 100 });
    const delta = getResizeDelta(makeKeyEvent('ArrowRight', true), config);
    expect(delta).toBe(100);
  });

  it('custom stepSmall clamps to max', () => {
    const config = makeConfig({ currentValue: 598, max: 600, stepSmall: 5 });
    const delta = getResizeDelta(makeKeyEvent('ArrowRight'), config);
    expect(delta).toBe(2);
  });

  it('custom stepLarge clamps to min', () => {
    const config = makeConfig({ currentValue: 130, min: 100, stepLarge: 100 });
    const delta = getResizeDelta(makeKeyEvent('ArrowLeft', true), config);
    expect(delta).toBe(-30);
  });

  it('defaults to STEP_SMALL when stepSmall is undefined', () => {
    const config = makeConfig({ stepSmall: undefined });
    const delta = getResizeDelta(makeKeyEvent('ArrowRight'), config);
    expect(delta).toBe(STEP_SMALL);
  });

  it('defaults to STEP_LARGE when stepLarge is undefined', () => {
    const config = makeConfig({ stepLarge: undefined });
    const delta = getResizeDelta(makeKeyEvent('ArrowRight', true), config);
    expect(delta).toBe(STEP_LARGE);
  });
});

// ---------------------------------------------------------------------------
// createResizeKeyHandler — Home/End integration
// ---------------------------------------------------------------------------

describe('createResizeKeyHandler — Home/End', () => {
  it('calls onResize with Home delta and prevents default', () => {
    const onResize = vi.fn();
    const config = makeConfig({ onResize, currentValue: 400, min: 100 });
    const handler = createResizeKeyHandler(config);
    const event = makeReactKeyEvent('Home');

    handler(event);
    expect(onResize).toHaveBeenCalledWith(-300);
    expect(event.preventDefault).toHaveBeenCalled();
  });

  it('calls onResize with End delta and prevents default', () => {
    const onResize = vi.fn();
    const config = makeConfig({ onResize, currentValue: 300, max: 600 });
    const handler = createResizeKeyHandler(config);
    const event = makeReactKeyEvent('End');

    handler(event);
    expect(onResize).toHaveBeenCalledWith(300);
    expect(event.preventDefault).toHaveBeenCalled();
  });

  it('does not call onResize for Home when at min', () => {
    const onResize = vi.fn();
    const config = makeConfig({ onResize, currentValue: 100, min: 100 });
    const handler = createResizeKeyHandler(config);
    const event = makeReactKeyEvent('Home');

    handler(event);
    expect(onResize).not.toHaveBeenCalled();
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it('does not call onResize for End when at max', () => {
    const onResize = vi.fn();
    const config = makeConfig({ onResize, currentValue: 600, max: 600 });
    const handler = createResizeKeyHandler(config);
    const event = makeReactKeyEvent('End');

    handler(event);
    expect(onResize).not.toHaveBeenCalled();
    expect(event.preventDefault).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// getResizeAriaProps — additional edge cases
// ---------------------------------------------------------------------------

describe('getResizeAriaProps — edge cases', () => {
  it('aria-valuenow equals min when currentValue is at min', () => {
    const props = getResizeAriaProps(makeConfig({ currentValue: 100, min: 100 }));
    expect(props['aria-valuenow']).toBe(100);
  });

  it('aria-valuenow equals max when currentValue is at max', () => {
    const props = getResizeAriaProps(makeConfig({ currentValue: 600, max: 600 }));
    expect(props['aria-valuenow']).toBe(600);
  });

  it('aria-label includes rounded value for fractional currentValue', () => {
    const props = getResizeAriaProps(makeConfig({ currentValue: 123.456 }));
    expect(props['aria-label']).toContain('123');
    expect(props['aria-valuenow']).toBe(123);
  });

  it('custom stepSmall/stepLarge do not affect ARIA output', () => {
    const props = getResizeAriaProps(makeConfig({ stepSmall: 3, stepLarge: 77 }));
    // ARIA props only reflect value/min/max, not step sizes
    expect(props['aria-valuemin']).toBe(100);
    expect(props['aria-valuemax']).toBe(600);
    expect(props.role).toBe('separator');
  });
});

// ---------------------------------------------------------------------------
// useKeyboardResize hook
// ---------------------------------------------------------------------------

describe('useKeyboardResize', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    container.tabIndex = 0;
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  function renderResizeHook(
    currentValue: number,
    onResize: (delta: number) => void,
    opts: Partial<UseKeyboardResizeOptions> = {},
  ) {
    return renderHook(
      ({ val, resize, hookOpts }) =>
        useKeyboardResize(
          { current: container } as React.RefObject<HTMLElement>,
          val,
          {
            min: opts.min ?? 100,
            max: opts.max ?? 600,
            onResize: resize,
            ...hookOpts,
          },
        ),
      {
        initialProps: {
          val: currentValue,
          resize: onResize,
          hookOpts: opts,
        },
      },
    );
  }

  it('returns handleKeyDown function and ariaProps', () => {
    const onResize = vi.fn();
    const { result } = renderResizeHook(300, onResize);

    expect(typeof result.current.handleKeyDown).toBe('function');
    expect(result.current.ariaProps).toBeDefined();
    expect(result.current.ariaProps.role).toBe('separator');
  });

  it('ariaProps reflect current value, min, and max', () => {
    const onResize = vi.fn();
    const { result } = renderResizeHook(350, onResize, { min: 100, max: 600 });

    expect(result.current.ariaProps['aria-valuenow']).toBe(350);
    expect(result.current.ariaProps['aria-valuemin']).toBe(100);
    expect(result.current.ariaProps['aria-valuemax']).toBe(600);
  });

  it('handleKeyDown invokes onResize for ArrowRight', () => {
    const onResize = vi.fn();
    const { result } = renderResizeHook(300, onResize);
    const event = makeReactKeyEvent('ArrowRight');

    act(() => {
      result.current.handleKeyDown(event);
    });

    expect(onResize).toHaveBeenCalledWith(STEP_SMALL);
    expect(event.preventDefault).toHaveBeenCalled();
  });

  it('handleKeyDown does nothing for unrelated keys', () => {
    const onResize = vi.fn();
    const { result } = renderResizeHook(300, onResize);
    const event = makeReactKeyEvent('Escape');

    act(() => {
      result.current.handleKeyDown(event);
    });

    expect(onResize).not.toHaveBeenCalled();
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it('handleKeyDown supports Home key', () => {
    const onResize = vi.fn();
    const { result } = renderResizeHook(400, onResize, { min: 100 });
    const event = makeReactKeyEvent('Home');

    act(() => {
      result.current.handleKeyDown(event);
    });

    expect(onResize).toHaveBeenCalledWith(-300);
  });

  it('handleKeyDown supports End key', () => {
    const onResize = vi.fn();
    const { result } = renderResizeHook(300, onResize, { max: 600 });
    const event = makeReactKeyEvent('End');

    act(() => {
      result.current.handleKeyDown(event);
    });

    expect(onResize).toHaveBeenCalledWith(300);
  });

  it('attaches native keydown listener to ref element', () => {
    const onResize = vi.fn();
    renderResizeHook(300, onResize);

    // Dispatch a native KeyboardEvent on the container
    act(() => {
      container.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowLeft', shiftKey: false, bubbles: true }),
      );
    });

    expect(onResize).toHaveBeenCalledWith(-STEP_SMALL);
  });

  it('native listener uses Shift for large step', () => {
    const onResize = vi.fn();
    renderResizeHook(300, onResize);

    act(() => {
      container.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', shiftKey: true, bubbles: true }),
      );
    });

    expect(onResize).toHaveBeenCalledWith(STEP_LARGE);
  });

  it('respects enabled=false and does not fire', () => {
    const onResize = vi.fn();
    renderResizeHook(300, onResize, { enabled: false });

    act(() => {
      container.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', shiftKey: false, bubbles: true }),
      );
    });

    expect(onResize).not.toHaveBeenCalled();
  });

  it('handleKeyDown does nothing when enabled is false', () => {
    const onResize = vi.fn();
    const { result } = renderResizeHook(300, onResize, { enabled: false });
    const event = makeReactKeyEvent('ArrowRight');

    act(() => {
      result.current.handleKeyDown(event);
    });

    expect(onResize).not.toHaveBeenCalled();
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it('cleans up native listener on unmount', () => {
    const onResize = vi.fn();
    const { unmount } = renderResizeHook(300, onResize);

    unmount();

    act(() => {
      container.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', shiftKey: false, bubbles: true }),
      );
    });

    expect(onResize).not.toHaveBeenCalled();
  });

  it('uses custom step sizes passed through options', () => {
    const onResize = vi.fn();
    renderResizeHook(300, onResize, { stepSmall: 7, stepLarge: 35 });

    act(() => {
      container.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', shiftKey: false, bubbles: true }),
      );
    });

    expect(onResize).toHaveBeenCalledWith(7);

    onResize.mockClear();

    act(() => {
      container.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', shiftKey: true, bubbles: true }),
      );
    });

    expect(onResize).toHaveBeenCalledWith(35);
  });

  it('supports vertical direction via options', () => {
    const onResize = vi.fn();
    renderResizeHook(300, onResize, { direction: 'vertical' });

    act(() => {
      container.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowDown', shiftKey: false, bubbles: true }),
      );
    });

    expect(onResize).toHaveBeenCalledWith(STEP_SMALL);

    onResize.mockClear();

    // ArrowRight should be ignored in vertical mode
    act(() => {
      container.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', shiftKey: false, bubbles: true }),
      );
    });

    expect(onResize).not.toHaveBeenCalled();
  });

  it('ariaProps use vertical orientation for horizontal direction separator', () => {
    const onResize = vi.fn();
    const { result } = renderResizeHook(300, onResize, { direction: 'horizontal' });
    expect(result.current.ariaProps['aria-orientation']).toBe('vertical');
  });

  it('ariaProps use horizontal orientation for vertical direction separator', () => {
    const onResize = vi.fn();
    const { result } = renderResizeHook(300, onResize, { direction: 'vertical' });
    expect(result.current.ariaProps['aria-orientation']).toBe('horizontal');
  });
});
