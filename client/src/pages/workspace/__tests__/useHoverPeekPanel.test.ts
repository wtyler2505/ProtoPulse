import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  useHoverPeekPanel,
  WORKSPACE_PANEL_HOVER_HIDE_DELAY_MS,
} from '@/pages/workspace/useHoverPeekPanel';

describe('useHoverPeekPanel', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('opens immediately when a collapsed desktop panel is hovered', () => {
    const { result } = renderHook(() =>
      useHoverPeekPanel({
        collapsed: true,
        isMobile: false,
      }),
    );

    expect(result.current.peekVisible).toBe(false);

    act(() => {
      result.current.openPeek();
    });

    expect(result.current.peekVisible).toBe(true);
  });

  it('ignores hover-open requests on mobile', () => {
    const { result } = renderHook(() =>
      useHoverPeekPanel({
        collapsed: true,
        isMobile: true,
      }),
    );

    act(() => {
      result.current.openPeek();
    });

    expect(result.current.peekVisible).toBe(false);
  });

  it('hides after the configured delay when the pointer leaves', () => {
    const { result } = renderHook(() =>
      useHoverPeekPanel({
        collapsed: true,
        isMobile: false,
      }),
    );

    act(() => {
      result.current.openPeek();
      result.current.closePeek();
    });

    expect(result.current.peekVisible).toBe(true);

    act(() => {
      vi.advanceTimersByTime(WORKSPACE_PANEL_HOVER_HIDE_DELAY_MS - 1);
    });

    expect(result.current.peekVisible).toBe(true);

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(result.current.peekVisible).toBe(false);
  });

  it('cancels a scheduled hide when the pointer re-enters', () => {
    const { result } = renderHook(() =>
      useHoverPeekPanel({
        collapsed: true,
        isMobile: false,
      }),
    );

    act(() => {
      result.current.openPeek();
      result.current.closePeek();
      vi.advanceTimersByTime(WORKSPACE_PANEL_HOVER_HIDE_DELAY_MS / 2);
      result.current.openPeek();
      vi.advanceTimersByTime(WORKSPACE_PANEL_HOVER_HIDE_DELAY_MS);
    });

    expect(result.current.peekVisible).toBe(true);
  });

  it('resets the hover peek when the panel becomes permanently expanded', () => {
    const { result, rerender } = renderHook(
      ({ collapsed, isMobile }) =>
        useHoverPeekPanel({
          collapsed,
          isMobile,
        }),
      {
        initialProps: {
          collapsed: true,
          isMobile: false,
        },
      },
    );

    act(() => {
      result.current.openPeek();
    });

    expect(result.current.peekVisible).toBe(true);

    rerender({
      collapsed: false,
      isMobile: false,
    });

    expect(result.current.peekVisible).toBe(false);
  });
});
