/**
 * ViolationFocusOverlay — SVG overlay that renders a pulsing ring around
 * the target of a violation navigation event.
 *
 * BL-0566: Visual highlight when navigating from Validation view to a canvas.
 *
 * - Red ring for errors, yellow for warnings
 * - Pulsing CSS animation, auto-dismisses after 3 s
 * - Click to dismiss early
 * - Coordinates mapped to the canvas viewport
 */

import { useState, useEffect, useCallback, useSyncExternalStore, useRef } from 'react';
import { ViolationNavigator } from '@/lib/validation/violation-navigator';
import type { NavigationRequest } from '@/lib/validation/violation-navigator';

// ---------------------------------------------------------------------------
// Styles (injected as a <style> element to avoid external CSS dependency)
// ---------------------------------------------------------------------------

const PULSE_KEYFRAMES = `
@keyframes violation-ring-pulse {
  0% {
    opacity: 1;
    r: var(--vfo-radius);
    stroke-width: 3;
  }
  50% {
    opacity: 0.6;
    r: calc(var(--vfo-radius) * 1.4);
    stroke-width: 5;
  }
  100% {
    opacity: 0;
    r: calc(var(--vfo-radius) * 1.8);
    stroke-width: 1;
  }
}
`;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface ViolationFocusOverlayProps {
  /** Width of the SVG viewport (canvas pixel width). */
  width: number;
  /** Height of the SVG viewport (canvas pixel height). */
  height: number;
  /**
   * Optional transform to map canvas coordinates → viewport coordinates.
   * Receives the violation (x, y) and should return the SVG-local (x, y).
   * When omitted the raw coordinates are used as-is.
   */
  transformCoordinates?: (x: number, y: number) => { x: number; y: number };
}

export function ViolationFocusOverlay({
  width,
  height,
  transformCoordinates,
}: ViolationFocusOverlayProps) {
  const navigator = useRef(ViolationNavigator.getInstance());

  // Subscribe to snapshot changes
  const highlight = useSyncExternalStore(
    (cb) => navigator.current.subscribe(cb),
    () => navigator.current.getSnapshot(),
  );

  // Track dismissed state so the user can click to hide
  const [dismissed, setDismissed] = useState(false);

  // Reset dismissed when a new highlight arrives
  useEffect(() => {
    if (highlight) {
      setDismissed(false);
    }
  }, [highlight?.violationId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClick = useCallback(() => {
    setDismissed(true);
    navigator.current.clearHighlight();
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleClick();
      }
    },
    [handleClick],
  );

  if (!highlight || dismissed) {
    return null;
  }

  const { coordinates, radius } = highlight.location;
  const pos = transformCoordinates
    ? transformCoordinates(coordinates.x, coordinates.y)
    : coordinates;
  const r = radius;

  const isError = highlight.severity === 'error';
  const strokeColor = isError ? '#ef4444' : '#eab308'; // red-500 / yellow-500
  const fillColor = isError ? 'rgba(239, 68, 68, 0.10)' : 'rgba(234, 179, 8, 0.10)';
  const glowColor = isError ? 'rgba(239, 68, 68, 0.3)' : 'rgba(234, 179, 8, 0.3)';

  return (
    <svg
      data-testid="violation-focus-overlay"
      className="pointer-events-none absolute inset-0"
      width={width}
      height={height}
      style={{ zIndex: 50 }}
      aria-hidden="true"
    >
      {/* Inject keyframe animation */}
      <defs>
        <style>{PULSE_KEYFRAMES}</style>
      </defs>

      {/* Clickable hit area — pointer-events only on the ring itself */}
      <g
        data-testid="violation-focus-ring"
        role="button"
        tabIndex={0}
        aria-label={`Violation highlight: ${highlight.location.entityType} ${highlight.location.entityId}`}
        style={{ pointerEvents: 'auto', cursor: 'pointer' }}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
      >
        {/* Glow / shadow */}
        <circle
          cx={pos.x}
          cy={pos.y}
          r={r * 1.2}
          fill="none"
          stroke={glowColor}
          strokeWidth={8}
          opacity={0.5}
        />

        {/* Solid ring */}
        <circle
          cx={pos.x}
          cy={pos.y}
          r={r}
          fill={fillColor}
          stroke={strokeColor}
          strokeWidth={3}
          strokeDasharray="6 3"
        />

        {/* Expanding pulse ring */}
        <circle
          cx={pos.x}
          cy={pos.y}
          r={r}
          fill="none"
          stroke={strokeColor}
          strokeWidth={3}
          style={{
            ['--vfo-radius' as string]: `${r}px`,
            animation: 'violation-ring-pulse 1.2s ease-out infinite',
          }}
        />

        {/* Center dot */}
        <circle
          cx={pos.x}
          cy={pos.y}
          r={4}
          fill={strokeColor}
          opacity={0.8}
        />
      </g>
    </svg>
  );
}
