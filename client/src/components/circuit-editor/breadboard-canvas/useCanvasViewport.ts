/**
 * useCanvasViewport — zoom/pan state + coordinate-space math for the breadboard canvas.
 *
 * Extracted from breadboard-canvas/index.tsx (audit #32, phase 2 — W1.12b).
 *
 * Owns:
 *   - zoom / panOffset state
 *   - container + svg refs
 *   - center-on-mount effect (BB-01)
 *   - wheel-to-zoom handler
 *   - centerOnBoardPixel — recenters the viewport on a board-pixel
 *   - clientToBoardPixel — converts a client mouse position to board-pixel coords
 *   - resetView — restores the default 3x / {20, 20} view
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getBoardDimensions,
  type PixelPos,
} from '@/lib/circuit-editor/breadboard-model';

export interface CanvasViewport {
  zoom: number;
  panOffset: PixelPos;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
  setPanOffset: React.Dispatch<React.SetStateAction<PixelPos>>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  svgRef: React.RefObject<SVGSVGElement | null>;
  centerOnBoardPixel: (pixel: PixelPos) => void;
  clientToBoardPixel: (clientX: number, clientY: number) => PixelPos | null;
  zoomIn: () => void;
  zoomOut: () => void;
  resetView: () => void;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 8;
const DEFAULT_ZOOM = 3;
const DEFAULT_PAN: PixelPos = { x: 20, y: 20 };
const ZOOM_STEP = 0.5;
const WHEEL_STEP = 0.3;

export function useCanvasViewport(): CanvasViewport {
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [panOffset, setPanOffset] = useState<PixelPos>(DEFAULT_PAN);
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const centerOnBoardPixel = useCallback(
    (pixel: PixelPos) => {
      const container = containerRef.current;
      if (!container) {
        return;
      }
      const rect = container.getBoundingClientRect();
      setPanOffset({
        x: rect.width / 2 - pixel.x * zoom,
        y: rect.height / 2 - pixel.y * zoom,
      });
    },
    [zoom],
  );

  // BB-01: Center the breadboard on mount.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const { width: containerW, height: containerH } = container.getBoundingClientRect();
    const board = getBoardDimensions();
    const boardPixelW = board.width * zoom;
    const boardPixelH = board.height * zoom;
    setPanOffset({
      x: Math.max(20, (containerW - boardPixelW) / 2),
      y: Math.max(20, (containerH - boardPixelH) / 2),
    });
    // Only run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Wheel-to-zoom handler (non-passive so we can preventDefault).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setZoom((prev) =>
        Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev + (e.deltaY > 0 ? -WHEEL_STEP : WHEEL_STEP))),
      );
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const clientToBoardPixel = useCallback(
    (clientX: number, clientY: number): PixelPos | null => {
      const svg = svgRef.current;
      if (!svg) return null;
      const rect = svg.getBoundingClientRect();
      return {
        x: (clientX - rect.left - panOffset.x) / zoom,
        y: (clientY - rect.top - panOffset.y) / zoom,
      };
    },
    [panOffset, zoom],
  );

  const zoomIn = useCallback(() => {
    setZoom((z) => Math.min(MAX_ZOOM, z + ZOOM_STEP));
  }, []);

  const zoomOut = useCallback(() => {
    setZoom((z) => Math.max(MIN_ZOOM, z - ZOOM_STEP));
  }, []);

  const resetView = useCallback(() => {
    setZoom(DEFAULT_ZOOM);
    setPanOffset(DEFAULT_PAN);
  }, []);

  return {
    zoom,
    panOffset,
    setZoom,
    setPanOffset,
    containerRef,
    svgRef,
    centerOnBoardPixel,
    clientToBoardPixel,
    zoomIn,
    zoomOut,
    resetView,
  };
}
