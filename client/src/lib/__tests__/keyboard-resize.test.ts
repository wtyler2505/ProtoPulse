import { describe, it, expect, vi } from 'vitest';
import {
  getResizeDelta,
  createResizeKeyHandler,
  getResizeAriaProps,
  STEP_SMALL,
  STEP_LARGE,
} from '../keyboard-resize';
import type { KeyboardResizeConfig } from '../keyboard-resize';

function makeConfig(overrides: Partial<KeyboardResizeConfig> = {}): KeyboardResizeConfig {
  return {
    currentValue: 300,
    min: 180,
    max: 480,
    onResize: vi.fn(),
    ...overrides,
  };
}

function makeKeyEvent(key: string, shiftKey = false) {
  return { key, shiftKey };
}

describe('keyboard-resize', () => {
  describe('STEP constants', () => {
    it('exports small step of 10px', () => {
      expect(STEP_SMALL).toBe(10);
    });

    it('exports large step of 50px', () => {
      expect(STEP_LARGE).toBe(50);
    });
  });

  describe('getResizeDelta', () => {
    it('returns positive delta for ArrowRight (horizontal grow)', () => {
      const config = makeConfig();
      const delta = getResizeDelta(makeKeyEvent('ArrowRight'), config);
      expect(delta).toBe(STEP_SMALL);
    });

    it('returns negative delta for ArrowLeft (horizontal grow)', () => {
      const config = makeConfig();
      const delta = getResizeDelta(makeKeyEvent('ArrowLeft'), config);
      expect(delta).toBe(-STEP_SMALL);
    });

    it('uses STEP_LARGE when shift is held', () => {
      const config = makeConfig();
      const delta = getResizeDelta(makeKeyEvent('ArrowRight', true), config);
      expect(delta).toBe(STEP_LARGE);
    });

    it('uses STEP_LARGE for shrink when shift is held', () => {
      const config = makeConfig();
      const delta = getResizeDelta(makeKeyEvent('ArrowLeft', true), config);
      expect(delta).toBe(-STEP_LARGE);
    });

    it('returns 0 for non-resize keys', () => {
      const config = makeConfig();
      expect(getResizeDelta(makeKeyEvent('Enter'), config)).toBe(0);
      expect(getResizeDelta(makeKeyEvent('Tab'), config)).toBe(0);
      expect(getResizeDelta(makeKeyEvent('a'), config)).toBe(0);
      expect(getResizeDelta(makeKeyEvent(' '), config)).toBe(0);
    });

    it('ignores ArrowUp/ArrowDown in horizontal orientation', () => {
      const config = makeConfig({ orientation: 'horizontal' });
      expect(getResizeDelta(makeKeyEvent('ArrowUp'), config)).toBe(0);
      expect(getResizeDelta(makeKeyEvent('ArrowDown'), config)).toBe(0);
    });

    it('uses ArrowDown/ArrowUp in vertical orientation', () => {
      const config = makeConfig({ orientation: 'vertical' });
      expect(getResizeDelta(makeKeyEvent('ArrowDown'), config)).toBe(STEP_SMALL);
      expect(getResizeDelta(makeKeyEvent('ArrowUp'), config)).toBe(-STEP_SMALL);
    });

    it('ignores ArrowLeft/ArrowRight in vertical orientation', () => {
      const config = makeConfig({ orientation: 'vertical' });
      expect(getResizeDelta(makeKeyEvent('ArrowLeft'), config)).toBe(0);
      expect(getResizeDelta(makeKeyEvent('ArrowRight'), config)).toBe(0);
    });

    it('reverses direction when positiveDirection is shrink', () => {
      const config = makeConfig({ positiveDirection: 'shrink' });
      const deltaRight = getResizeDelta(makeKeyEvent('ArrowRight'), config);
      expect(deltaRight).toBe(-STEP_SMALL);
      const deltaLeft = getResizeDelta(makeKeyEvent('ArrowLeft'), config);
      expect(deltaLeft).toBe(STEP_SMALL);
    });

    it('clamps delta to not exceed max', () => {
      const config = makeConfig({ currentValue: 475, max: 480 });
      const delta = getResizeDelta(makeKeyEvent('ArrowRight'), config);
      expect(delta).toBe(5); // 475 + 5 = 480 (max)
    });

    it('clamps delta to not go below min', () => {
      const config = makeConfig({ currentValue: 185, min: 180 });
      const delta = getResizeDelta(makeKeyEvent('ArrowLeft'), config);
      expect(delta).toBe(-5); // 185 - 5 = 180 (min)
    });

    it('clamps shift-step to max boundary', () => {
      const config = makeConfig({ currentValue: 460, max: 480 });
      // Shift+Right would be +50 → 510, but clamped to 480 → delta = 20
      const delta = getResizeDelta(makeKeyEvent('ArrowRight', true), config);
      expect(delta).toBe(20);
    });

    it('clamps shift-step to min boundary', () => {
      const config = makeConfig({ currentValue: 200, min: 180 });
      // Shift+Left would be -50 → 150, but clamped to 180 → delta = -20
      const delta = getResizeDelta(makeKeyEvent('ArrowLeft', true), config);
      expect(delta).toBe(-20);
    });

    it('returns 0 delta when already at max and growing', () => {
      const config = makeConfig({ currentValue: 480, max: 480 });
      const delta = getResizeDelta(makeKeyEvent('ArrowRight'), config);
      expect(delta).toBe(0);
    });

    it('returns 0 delta when already at min and shrinking', () => {
      const config = makeConfig({ currentValue: 180, min: 180 });
      const delta = getResizeDelta(makeKeyEvent('ArrowLeft'), config);
      expect(delta).toBe(0);
    });
  });

  describe('createResizeKeyHandler', () => {
    it('calls onResize with delta and prevents default', () => {
      const onResize = vi.fn();
      const config = makeConfig({ onResize });
      const handler = createResizeKeyHandler(config);

      const event = {
        key: 'ArrowRight',
        shiftKey: false,
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent;

      handler(event);
      expect(onResize).toHaveBeenCalledWith(STEP_SMALL);
      expect(event.preventDefault).toHaveBeenCalled();
    });

    it('does not call onResize or preventDefault for non-resize keys', () => {
      const onResize = vi.fn();
      const config = makeConfig({ onResize });
      const handler = createResizeKeyHandler(config);

      const event = {
        key: 'Enter',
        shiftKey: false,
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent;

      handler(event);
      expect(onResize).not.toHaveBeenCalled();
      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    it('does not call onResize when at boundary (delta = 0)', () => {
      const onResize = vi.fn();
      const config = makeConfig({ onResize, currentValue: 480, max: 480 });
      const handler = createResizeKeyHandler(config);

      const event = {
        key: 'ArrowRight',
        shiftKey: false,
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent;

      handler(event);
      expect(onResize).not.toHaveBeenCalled();
      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    it('passes shift step to onResize', () => {
      const onResize = vi.fn();
      const config = makeConfig({ onResize });
      const handler = createResizeKeyHandler(config);

      const event = {
        key: 'ArrowLeft',
        shiftKey: true,
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent;

      handler(event);
      expect(onResize).toHaveBeenCalledWith(-STEP_LARGE);
    });
  });

  describe('getResizeAriaProps', () => {
    it('returns correct role and tabIndex', () => {
      const config = makeConfig();
      const props = getResizeAriaProps(config);
      expect(props.role).toBe('separator');
      expect(props.tabIndex).toBe(0);
    });

    it('returns aria-valuenow matching currentValue', () => {
      const config = makeConfig({ currentValue: 256 });
      const props = getResizeAriaProps(config);
      expect(props['aria-valuenow']).toBe(256);
    });

    it('rounds aria-valuenow for fractional values', () => {
      const config = makeConfig({ currentValue: 256.7 });
      const props = getResizeAriaProps(config);
      expect(props['aria-valuenow']).toBe(257);
    });

    it('returns aria-valuemin and aria-valuemax from config', () => {
      const config = makeConfig({ min: 180, max: 480 });
      const props = getResizeAriaProps(config);
      expect(props['aria-valuemin']).toBe(180);
      expect(props['aria-valuemax']).toBe(480);
    });

    it('returns vertical aria-orientation for horizontal resize', () => {
      // A horizontal resize (left/right drag) uses a vertical separator bar
      const config = makeConfig({ orientation: 'horizontal' });
      const props = getResizeAriaProps(config);
      expect(props['aria-orientation']).toBe('vertical');
    });

    it('returns horizontal aria-orientation for vertical resize', () => {
      const config = makeConfig({ orientation: 'vertical' });
      const props = getResizeAriaProps(config);
      expect(props['aria-orientation']).toBe('horizontal');
    });

    it('defaults to horizontal orientation (vertical separator)', () => {
      const config = makeConfig();
      const props = getResizeAriaProps(config);
      expect(props['aria-orientation']).toBe('vertical');
    });

    it('includes descriptive aria-label with current width', () => {
      const config = makeConfig({ currentValue: 350 });
      const props = getResizeAriaProps(config);
      expect(props['aria-label']).toContain('350');
      expect(props['aria-label']).toContain('pixels');
    });
  });
});
