/**
 * BL-0273 verification: Component Editor auto-save is properly debounced.
 *
 * The auto-save effect in ComponentEditorView depends on [state.ui.isDirty, state.present, partId, handleSave].
 * During active drawing (mouse-move dispatching MOVE_SHAPES), state.present changes on every frame,
 * but the cleanup function (clearTimeout) resets the 2s timer each time.
 * The save only fires 2 seconds after the LAST state change — standard debounce behavior.
 *
 * Verdict: FALSE POSITIVE / WONTFIX — the debounce works correctly.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useReducer, useEffect, useCallback, useRef } from 'react';
import type { PartState } from '@shared/component-types';
import { createDefaultPartState } from '@shared/component-types';

/**
 * Minimal reproduction of the auto-save debounce logic from ComponentEditorView.
 * We isolate the debounce behavior to prove it works correctly without needing
 * the full component tree (which requires many providers).
 */
function useAutoSaveDebounce(partId: number | null) {
  const isDirtyRef = useRef(false);
  const presentRef = useRef<PartState>(createDefaultPartState());
  const saveCount = useRef(0);

  const [state, setState] = useReducer(
    (
      prev: { isDirty: boolean; present: PartState },
      action: { type: 'MOVE' } | { type: 'MARK_CLEAN' },
    ) => {
      if (action.type === 'MOVE') {
        // Simulate MOVE_SHAPES: new present object, isDirty = true
        return {
          isDirty: true,
          present: {
            ...prev.present,
            meta: { ...prev.present.meta, title: `moved-${Date.now()}` },
          },
        };
      }
      if (action.type === 'MARK_CLEAN') {
        return { ...prev, isDirty: false };
      }
      return prev;
    },
    { isDirty: false, present: createDefaultPartState() },
  );

  isDirtyRef.current = state.isDirty;
  presentRef.current = state.present;

  const handleSave = useCallback(() => {
    saveCount.current += 1;
  }, []);

  // Exact replica of the auto-save effect from ComponentEditorView lines 311-317
  useEffect(() => {
    if (!state.isDirty || !partId) return;
    const timer = setTimeout(() => {
      handleSave();
    }, 2000);
    return () => clearTimeout(timer);
  }, [state.isDirty, state.present, partId, handleSave]);

  return {
    dispatch: setState,
    getSaveCount: () => saveCount.current,
    isDirty: state.isDirty,
  };
}

describe('BL-0273: Component Editor auto-save debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not save during rapid state changes (simulating mouse-move drag)', () => {
    const { result } = renderHook(() => useAutoSaveDebounce(1));

    // Simulate 50 rapid MOVE_SHAPES dispatches (like dragging a shape)
    for (let i = 0; i < 50; i++) {
      act(() => {
        result.current.dispatch({ type: 'MOVE' });
      });
      // Advance 30ms between moves (simulating ~33fps mouse events)
      act(() => {
        vi.advanceTimersByTime(30);
      });
    }

    // Total time elapsed: 50 * 30ms = 1500ms — still within the 2s debounce window
    expect(result.current.getSaveCount()).toBe(0);
    expect(result.current.isDirty).toBe(true);
  });

  it('saves exactly once 2 seconds after the last state change', () => {
    const { result } = renderHook(() => useAutoSaveDebounce(1));

    // Simulate a few moves then stop
    for (let i = 0; i < 5; i++) {
      act(() => {
        result.current.dispatch({ type: 'MOVE' });
      });
      act(() => {
        vi.advanceTimersByTime(100);
      });
    }

    // No save yet (only 500ms since first move, but timer resets each time)
    expect(result.current.getSaveCount()).toBe(0);

    // Advance past the 2s debounce after the last move
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(result.current.getSaveCount()).toBe(1);
  });

  it('resets the debounce timer when new moves arrive', () => {
    const { result } = renderHook(() => useAutoSaveDebounce(1));

    // First move
    act(() => {
      result.current.dispatch({ type: 'MOVE' });
    });

    // Wait 1900ms (almost at the save threshold)
    act(() => {
      vi.advanceTimersByTime(1900);
    });
    expect(result.current.getSaveCount()).toBe(0);

    // Another move resets the timer
    act(() => {
      result.current.dispatch({ type: 'MOVE' });
    });

    // Wait 1900ms again — still shouldn't save (only 1900ms since last move)
    act(() => {
      vi.advanceTimersByTime(1900);
    });
    expect(result.current.getSaveCount()).toBe(0);

    // Wait the remaining 100ms — now it should save
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current.getSaveCount()).toBe(1);
  });

  it('does not save when partId is null', () => {
    const { result } = renderHook(() => useAutoSaveDebounce(null));

    act(() => {
      result.current.dispatch({ type: 'MOVE' });
    });

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(result.current.getSaveCount()).toBe(0);
  });

  it('does not save when state is not dirty', () => {
    const { result } = renderHook(() => useAutoSaveDebounce(1));

    // No moves dispatched — not dirty
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(result.current.getSaveCount()).toBe(0);
  });
});
