/**
 * Tests for useCanvasViewport.
 * Covers the pure/semipure behavior that doesn't require a live DOM:
 *   - default state
 *   - zoomIn/zoomOut clamp to [1, 8]
 *   - resetView restores defaults
 *   - clientToBoardPixel returns null without an svg ref (the ref is internal
 *     so we can't attach; we verify the null-guard path)
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCanvasViewport } from '../useCanvasViewport';

describe('useCanvasViewport', () => {
  it('starts at zoom=3, pan={20,20}', () => {
    const { result } = renderHook(() => useCanvasViewport());
    expect(result.current.zoom).toBe(3);
    expect(result.current.panOffset).toEqual({ x: 20, y: 20 });
  });

  it('zoomIn increments zoom by 0.5 up to 8', () => {
    const { result } = renderHook(() => useCanvasViewport());
    act(() => { result.current.zoomIn(); });
    expect(result.current.zoom).toBe(3.5);
  });

  it('zoomOut decrements zoom by 0.5 down to 1', () => {
    const { result } = renderHook(() => useCanvasViewport());
    act(() => { result.current.zoomOut(); });
    expect(result.current.zoom).toBe(2.5);
  });

  it('clamps zoom at the max bound (8)', () => {
    const { result } = renderHook(() => useCanvasViewport());
    // Start at 3; 11 zoomIn steps of 0.5 would land at 8.5 without clamping.
    act(() => {
      for (let i = 0; i < 11; i += 1) {
        result.current.zoomIn();
      }
    });
    expect(result.current.zoom).toBe(8);
  });

  it('clamps zoom at the min bound (1)', () => {
    const { result } = renderHook(() => useCanvasViewport());
    act(() => {
      for (let i = 0; i < 11; i += 1) {
        result.current.zoomOut();
      }
    });
    expect(result.current.zoom).toBe(1);
  });

  it('resetView restores zoom=3 and pan={20,20}', () => {
    const { result } = renderHook(() => useCanvasViewport());
    act(() => {
      result.current.zoomIn();
      result.current.setPanOffset({ x: 100, y: 200 });
    });
    expect(result.current.zoom).toBe(3.5);
    expect(result.current.panOffset).toEqual({ x: 100, y: 200 });
    act(() => { result.current.resetView(); });
    expect(result.current.zoom).toBe(3);
    expect(result.current.panOffset).toEqual({ x: 20, y: 20 });
  });

  it('clientToBoardPixel returns null when svgRef is not attached', () => {
    const { result } = renderHook(() => useCanvasViewport());
    expect(result.current.clientToBoardPixel(100, 200)).toBeNull();
  });

  it('centerOnBoardPixel is a no-op when containerRef is not attached', () => {
    const { result } = renderHook(() => useCanvasViewport());
    const before = result.current.panOffset;
    act(() => { result.current.centerOnBoardPixel({ x: 50, y: 50 }); });
    expect(result.current.panOffset).toEqual(before);
  });
});
