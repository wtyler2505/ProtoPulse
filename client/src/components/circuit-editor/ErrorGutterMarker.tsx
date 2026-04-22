/* eslint-disable jsx-a11y/no-static-element-interactions --
 * Phase 3 <InteractiveCard> primitive migration will replace `role="button"` on
 * `<div>` elements with real `<button>` elements, at which point these disables
 * can be removed. See docs/superpowers/plans/2026-04-18-e2e-walkthrough/03-a11y-systemic.md
 * Phase 3. Tracked as part of E2E-552 / Plan 03 Phase 4.
 */
/**
 * ErrorGutterMarker — Renders gutter decorations alongside a code editor.
 *
 * Displays red circles (errors), yellow triangles (warnings), or blue info
 * icons (notes) at each marked line. Lines with multiple diagnostics show
 * a count badge. Hovering reveals all messages for that line. Clicking a
 * mark fires the onClickMark callback for navigation.
 *
 * Designed as a position-absolute overlay that sits inside the same container
 * as a CodeMirror editor, aligned with the gutter column.
 */

import { useState, useCallback, useRef, useEffect } from 'react';

import { cn } from '@/lib/utils';
import type { GutterMark } from '@/lib/arduino/error-line-linker';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default CodeMirror line height — matches protoPulseTheme lineHeight 1.6 * 13px ≈ 20.8px */
const LINE_HEIGHT_PX = 20.8;

/** Width of the gutter marker column. */
const GUTTER_WIDTH_PX = 24;

/** Vertical offset for the first line (CodeMirror default top padding). */
const TOP_OFFSET_PX = 4;

// ---------------------------------------------------------------------------
// Severity styling
// ---------------------------------------------------------------------------

const SEVERITY_STYLES: Record<
  GutterMark['severity'],
  { bg: string; text: string; border: string; icon: string }
> = {
  error: {
    bg: 'bg-red-500/20',
    text: 'text-red-400',
    border: 'border-red-500/40',
    icon: '●',
  },
  warning: {
    bg: 'bg-yellow-500/20',
    text: 'text-yellow-400',
    border: 'border-yellow-500/40',
    icon: '▲',
  },
  note: {
    bg: 'bg-blue-500/20',
    text: 'text-blue-400',
    border: 'border-blue-500/40',
    icon: 'ℹ',
  },
};

const TOOLTIP_SEVERITY_STYLES: Record<GutterMark['severity'], string> = {
  error: 'text-red-400',
  warning: 'text-yellow-400',
  note: 'text-blue-400',
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ErrorGutterMarkerProps {
  marks: GutterMark[];
  onClickMark?: (mark: GutterMark) => void;
  lineHeight?: number;
  topOffset?: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ErrorGutterMarker({
  marks,
  onClickMark,
  lineHeight = LINE_HEIGHT_PX,
  topOffset = TOP_OFFSET_PX,
}: ErrorGutterMarkerProps) {
  const [hoveredLine, setHoveredLine] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up tooltip timer on unmount
  useEffect(() => {
    return () => {
      if (tooltipTimerRef.current !== null) {
        clearTimeout(tooltipTimerRef.current);
      }
    };
  }, []);

  const handleMouseEnter = useCallback(
    (mark: GutterMark, event: React.MouseEvent<HTMLButtonElement>) => {
      if (tooltipTimerRef.current !== null) {
        clearTimeout(tooltipTimerRef.current);
      }
      setHoveredLine(mark.line);
      const rect = event.currentTarget.getBoundingClientRect();
      const containerRect = containerRef.current?.getBoundingClientRect();
      if (containerRect) {
        setTooltipPos({
          top: rect.top - containerRect.top,
          left: GUTTER_WIDTH_PX + 4,
        });
      }
    },
    [],
  );

  const handleMouseLeave = useCallback(() => {
    tooltipTimerRef.current = setTimeout(() => {
      setHoveredLine(null);
      setTooltipPos(null);
    }, 150);
  }, []);

  const handleClick = useCallback(
    (mark: GutterMark) => {
      onClickMark?.(mark);
    },
    [onClickMark],
  );

  if (marks.length === 0) {
    return null;
  }

  const hoveredMark = hoveredLine !== null ? marks.find((m) => m.line === hoveredLine) : null;

  return (
    <div
      ref={containerRef}
      className="absolute left-0 top-0 z-10 pointer-events-none"
      style={{ width: GUTTER_WIDTH_PX }}
      data-testid="error-gutter-container"
    >
      {marks.map((mark) => {
        const style = SEVERITY_STYLES[mark.severity];
        const yPos = topOffset + (mark.line - 1) * lineHeight;

        return (
          <button
            key={`gutter-${mark.line}`}
            type="button"
            className={cn(
              'absolute flex items-center justify-center pointer-events-auto',
              'cursor-pointer rounded-sm transition-opacity',
              'hover:opacity-100 opacity-80',
              style.text,
            )}
            style={{
              top: yPos,
              left: 2,
              width: GUTTER_WIDTH_PX - 4,
              height: lineHeight,
              fontSize: mark.count > 1 ? '9px' : '11px',
              lineHeight: `${lineHeight}px`,
            }}
            onClick={() => {
              handleClick(mark);
            }}
            onMouseEnter={(e) => {
              handleMouseEnter(mark, e);
            }}
            onMouseLeave={handleMouseLeave}
            data-testid={`gutter-mark-${mark.severity}-line-${mark.line}`}
            aria-label={`${mark.severity}: line ${mark.line}, ${mark.count} diagnostic${mark.count !== 1 ? 's' : ''}`}
            title={mark.messages[0]}
          >
            <span className="relative flex items-center justify-center">
              <span data-testid={`gutter-icon-${mark.line}`}>{style.icon}</span>
              {mark.count > 1 && (
                <span
                  className={cn(
                    'absolute -top-1.5 -right-2.5 min-w-[14px] h-[14px]',
                    'flex items-center justify-center rounded-full',
                    'text-[9px] font-bold leading-none',
                    style.bg,
                    style.text,
                    'border',
                    style.border,
                  )}
                  data-testid={`gutter-badge-${mark.line}`}
                >
                  {mark.count}
                </span>
              )}
            </span>
          </button>
        );
      })}

      {/* Tooltip */}
      {hoveredMark && tooltipPos && (
        <div
          className={cn(
            'absolute z-50 pointer-events-auto',
            'bg-card/95 backdrop-blur border border-border rounded-md shadow-lg',
            'px-3 py-2 max-w-[320px] min-w-[180px]',
          )}
          style={{
            top: tooltipPos.top,
            left: tooltipPos.left,
          }}
          onMouseEnter={() => {
            if (tooltipTimerRef.current !== null) {
              clearTimeout(tooltipTimerRef.current);
            }
          }}
          onMouseLeave={handleMouseLeave}
          data-testid={`gutter-tooltip-line-${hoveredMark.line}`}
        >
          <div className="text-[10px] font-medium text-muted-foreground mb-1">
            Line {hoveredMark.line}
            <span className={cn('ml-1.5', TOOLTIP_SEVERITY_STYLES[hoveredMark.severity])}>
              {hoveredMark.count} {hoveredMark.severity}
              {hoveredMark.count !== 1 ? 's' : ''}
            </span>
          </div>
          <ul className="space-y-1" data-testid={`gutter-tooltip-messages-${hoveredMark.line}`}>
            {hoveredMark.messages.map((msg, idx) => (
              <li
                key={`msg-${hoveredMark.line}-${idx}`}
                className="text-xs text-foreground/90 leading-tight pl-2 border-l-2"
                style={{
                  borderColor:
                    hoveredMark.severity === 'error'
                      ? 'rgb(239 68 68 / 0.5)'
                      : hoveredMark.severity === 'warning'
                        ? 'rgb(234 179 8 / 0.5)'
                        : 'rgb(59 130 246 / 0.5)',
                }}
              >
                {msg}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
