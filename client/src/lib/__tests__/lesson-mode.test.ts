import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { LessonMode, useLessonMode } from '../lesson-mode';

describe('LessonMode', () => {
  beforeEach(() => {
    LessonMode.resetInstance();
  });

  // ---------------------------------------------------------------------------
  // Singleton
  // ---------------------------------------------------------------------------

  describe('singleton', () => {
    it('returns the same instance on repeated calls', () => {
      const a = LessonMode.getInstance();
      const b = LessonMode.getInstance();
      expect(a).toBe(b);
    });

    it('returns a fresh instance after resetInstance()', () => {
      const a = LessonMode.getInstance();
      LessonMode.resetInstance();
      const b = LessonMode.getInstance();
      expect(a).not.toBe(b);
    });
  });

  // ---------------------------------------------------------------------------
  // Initial state
  // ---------------------------------------------------------------------------

  describe('initial state', () => {
    it('starts inactive', () => {
      const lm = LessonMode.getInstance();
      expect(lm.isActive()).toBe(false);
    });

    it('has empty allowed selectors', () => {
      const lm = LessonMode.getInstance();
      expect(lm.getAllowedSelectors()).toEqual([]);
    });

    it('has null hint', () => {
      const lm = LessonMode.getInstance();
      expect(lm.getHint()).toBeNull();
    });

    it('getState() returns all fields', () => {
      const lm = LessonMode.getInstance();
      expect(lm.getState()).toEqual({
        active: false,
        allowedSelectors: [],
        hint: null,
      });
    });
  });

  // ---------------------------------------------------------------------------
  // enable / disable
  // ---------------------------------------------------------------------------

  describe('enable', () => {
    it('activates lesson mode with given selectors', () => {
      const lm = LessonMode.getInstance();
      lm.enable(['[data-testid="btn-a"]', '.sidebar']);
      expect(lm.isActive()).toBe(true);
      expect(lm.getAllowedSelectors()).toEqual([
        '[data-testid="btn-a"]',
        '.sidebar',
      ]);
    });

    it('accepts an optional hint', () => {
      const lm = LessonMode.getInstance();
      lm.enable(['.foo'], 'Click the foo button');
      expect(lm.getHint()).toBe('Click the foo button');
    });

    it('sets hint to null when no hint provided', () => {
      const lm = LessonMode.getInstance();
      lm.enable(['.foo']);
      expect(lm.getHint()).toBeNull();
    });

    it('copies the selectors array (no external mutation)', () => {
      const lm = LessonMode.getInstance();
      const selectors = ['.a', '.b'];
      lm.enable(selectors);
      selectors.push('.c');
      expect(lm.getAllowedSelectors()).toEqual(['.a', '.b']);
    });
  });

  describe('disable', () => {
    it('deactivates lesson mode', () => {
      const lm = LessonMode.getInstance();
      lm.enable(['.foo']);
      lm.disable();
      expect(lm.isActive()).toBe(false);
      expect(lm.getAllowedSelectors()).toEqual([]);
      expect(lm.getHint()).toBeNull();
    });

    it('is a no-op when already inactive', () => {
      const lm = LessonMode.getInstance();
      const listener = vi.fn();
      lm.subscribe(listener);
      lm.disable(); // already inactive
      expect(listener).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // setAllowedControls
  // ---------------------------------------------------------------------------

  describe('setAllowedControls', () => {
    it('updates selectors while active', () => {
      const lm = LessonMode.getInstance();
      lm.enable(['.a']);
      lm.setAllowedControls(['.b', '.c']);
      expect(lm.getAllowedSelectors()).toEqual(['.b', '.c']);
      expect(lm.isActive()).toBe(true);
    });

    it('preserves existing hint when no new hint given', () => {
      const lm = LessonMode.getInstance();
      lm.enable(['.a'], 'Step 1');
      lm.setAllowedControls(['.b']);
      expect(lm.getHint()).toBe('Step 1');
    });

    it('updates hint when provided', () => {
      const lm = LessonMode.getInstance();
      lm.enable(['.a'], 'Step 1');
      lm.setAllowedControls(['.b'], 'Step 2');
      expect(lm.getHint()).toBe('Step 2');
    });

    it('is a no-op when not active', () => {
      const lm = LessonMode.getInstance();
      const listener = vi.fn();
      lm.subscribe(listener);
      lm.setAllowedControls(['.b']);
      expect(listener).not.toHaveBeenCalled();
      expect(lm.getAllowedSelectors()).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // isControlAllowed
  // ---------------------------------------------------------------------------

  describe('isControlAllowed', () => {
    it('returns true for any selector when inactive', () => {
      const lm = LessonMode.getInstance();
      expect(lm.isControlAllowed('.anything')).toBe(true);
    });

    it('returns true for an allowed selector', () => {
      const lm = LessonMode.getInstance();
      lm.enable(['.a', '.b']);
      expect(lm.isControlAllowed('.a')).toBe(true);
      expect(lm.isControlAllowed('.b')).toBe(true);
    });

    it('returns false for a disallowed selector', () => {
      const lm = LessonMode.getInstance();
      lm.enable(['.a']);
      expect(lm.isControlAllowed('.c')).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // isElementAllowed
  // ---------------------------------------------------------------------------

  describe('isElementAllowed', () => {
    it('returns true for any element when inactive', () => {
      const lm = LessonMode.getInstance();
      const el = document.createElement('div');
      expect(lm.isElementAllowed(el)).toBe(true);
    });

    it('returns true when element matches an allowed selector', () => {
      const lm = LessonMode.getInstance();
      const el = document.createElement('button');
      el.setAttribute('data-testid', 'target');
      document.body.appendChild(el);
      lm.enable(['[data-testid="target"]']);
      expect(lm.isElementAllowed(el)).toBe(true);
      document.body.removeChild(el);
    });

    it('returns true when element is a child of an allowed selector', () => {
      const lm = LessonMode.getInstance();
      const parent = document.createElement('div');
      parent.className = 'sidebar';
      const child = document.createElement('span');
      parent.appendChild(child);
      document.body.appendChild(parent);
      lm.enable(['.sidebar']);
      expect(lm.isElementAllowed(child)).toBe(true);
      document.body.removeChild(parent);
    });

    it('returns false when element does not match any allowed selector', () => {
      const lm = LessonMode.getInstance();
      const el = document.createElement('div');
      el.className = 'other';
      document.body.appendChild(el);
      lm.enable(['.sidebar']);
      expect(lm.isElementAllowed(el)).toBe(false);
      document.body.removeChild(el);
    });

    it('handles invalid selectors gracefully', () => {
      const lm = LessonMode.getInstance();
      const el = document.createElement('div');
      lm.enable(['[[[invalid']);
      expect(lm.isElementAllowed(el)).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // subscribe / notify
  // ---------------------------------------------------------------------------

  describe('subscribe', () => {
    it('notifies listeners on enable', () => {
      const lm = LessonMode.getInstance();
      const listener = vi.fn();
      lm.subscribe(listener);
      lm.enable(['.a']);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('notifies listeners on disable', () => {
      const lm = LessonMode.getInstance();
      lm.enable(['.a']);
      const listener = vi.fn();
      lm.subscribe(listener);
      lm.disable();
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('notifies listeners on setAllowedControls', () => {
      const lm = LessonMode.getInstance();
      lm.enable(['.a']);
      const listener = vi.fn();
      lm.subscribe(listener);
      lm.setAllowedControls(['.b']);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('returns an unsubscribe function', () => {
      const lm = LessonMode.getInstance();
      const listener = vi.fn();
      const unsub = lm.subscribe(listener);
      unsub();
      lm.enable(['.a']);
      expect(listener).not.toHaveBeenCalled();
    });

    it('supports multiple listeners', () => {
      const lm = LessonMode.getInstance();
      const a = vi.fn();
      const b = vi.fn();
      lm.subscribe(a);
      lm.subscribe(b);
      lm.enable(['.x']);
      expect(a).toHaveBeenCalledTimes(1);
      expect(b).toHaveBeenCalledTimes(1);
    });
  });

  // ---------------------------------------------------------------------------
  // useLessonMode hook
  // ---------------------------------------------------------------------------

  describe('useLessonMode', () => {
    it('returns initial inactive state', () => {
      const { result } = renderHook(() => useLessonMode());
      expect(result.current.active).toBe(false);
      expect(result.current.allowedSelectors).toEqual([]);
      expect(result.current.hint).toBeNull();
    });

    it('reflects enable() changes', () => {
      const { result } = renderHook(() => useLessonMode());
      act(() => {
        result.current.enable(['.a', '.b'], 'Do this');
      });
      expect(result.current.active).toBe(true);
      expect(result.current.allowedSelectors).toEqual(['.a', '.b']);
      expect(result.current.hint).toBe('Do this');
    });

    it('reflects disable() changes', () => {
      const { result } = renderHook(() => useLessonMode());
      act(() => {
        result.current.enable(['.a']);
      });
      act(() => {
        result.current.disable();
      });
      expect(result.current.active).toBe(false);
      expect(result.current.allowedSelectors).toEqual([]);
    });

    it('reflects setAllowedControls() changes', () => {
      const { result } = renderHook(() => useLessonMode());
      act(() => {
        result.current.enable(['.a'], 'Step 1');
      });
      act(() => {
        result.current.setAllowedControls(['.b', '.c'], 'Step 2');
      });
      expect(result.current.allowedSelectors).toEqual(['.b', '.c']);
      expect(result.current.hint).toBe('Step 2');
    });

    it('isControlAllowed returns correct values', () => {
      const { result } = renderHook(() => useLessonMode());
      // Inactive — everything allowed
      expect(result.current.isControlAllowed('.anything')).toBe(true);
      act(() => {
        result.current.enable(['.a']);
      });
      expect(result.current.isControlAllowed('.a')).toBe(true);
      expect(result.current.isControlAllowed('.b')).toBe(false);
    });

    it('unsubscribes on unmount', () => {
      const { unmount } = renderHook(() => useLessonMode());
      unmount();
      // Should not throw or cause errors
      const lm = LessonMode.getInstance();
      lm.enable(['.x']);
      expect(lm.isActive()).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------

  describe('edge cases', () => {
    it('enable with empty selectors array', () => {
      const lm = LessonMode.getInstance();
      lm.enable([]);
      expect(lm.isActive()).toBe(true);
      expect(lm.getAllowedSelectors()).toEqual([]);
      expect(lm.isControlAllowed('.anything')).toBe(false);
    });

    it('re-enable overwrites previous state', () => {
      const lm = LessonMode.getInstance();
      lm.enable(['.a'], 'Hint A');
      lm.enable(['.b'], 'Hint B');
      expect(lm.getAllowedSelectors()).toEqual(['.b']);
      expect(lm.getHint()).toBe('Hint B');
    });

    it('setAllowedControls with explicit null hint clears the hint', () => {
      const lm = LessonMode.getInstance();
      lm.enable(['.a'], 'Old hint');
      // Pass undefined — hint is preserved
      lm.setAllowedControls(['.b']);
      expect(lm.getHint()).toBe('Old hint');
    });

    it('multiple enable/disable cycles work correctly', () => {
      const lm = LessonMode.getInstance();
      lm.enable(['.a']);
      lm.disable();
      lm.enable(['.b']);
      expect(lm.isActive()).toBe(true);
      expect(lm.getAllowedSelectors()).toEqual(['.b']);
      lm.disable();
      expect(lm.isActive()).toBe(false);
    });
  });
});
