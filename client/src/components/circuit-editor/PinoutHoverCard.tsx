/**
 * PinoutHoverCard — Component pinout hover reference card
 *
 * Displays a visual pinout diagram and pin table for electronic components.
 * Shows on hover, dismisses on Escape or click-outside.
 */

import { useCallback, useEffect, useRef } from 'react';
import type { Connector, PartMeta } from '@shared/component-types';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { lookupPinout, getGenericPinout } from '@/lib/pinout-data';
import { isSafeUrl } from '@shared/url-validation';
import type { PinInfo, PinoutEntry } from '@/lib/pinout-data';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PinoutHoverCardProps {
  componentName: string;
  connectors?: Connector[];
  partMeta?: PartMeta;
  position: { x: number; y: number };
  onClose: () => void;
  className?: string;
}

// ---------------------------------------------------------------------------
// Pin type → color mapping
// ---------------------------------------------------------------------------

const PIN_TYPE_COLORS: Record<PinInfo['type'], string> = {
  power: 'text-red-400',
  ground: 'text-zinc-400',
  io: 'text-[#00F0FF]',
  analog: 'text-yellow-400',
  special: 'text-purple-400',
  nc: 'text-zinc-600',
};

const PIN_TYPE_BG_COLORS: Record<PinInfo['type'], string> = {
  power: 'bg-red-400',
  ground: 'bg-zinc-400',
  io: 'bg-[#00F0FF]',
  analog: 'bg-yellow-400',
  special: 'bg-purple-400',
  nc: 'bg-zinc-600',
};

const PIN_TYPE_LABELS: Record<PinInfo['type'], string> = {
  power: 'PWR',
  ground: 'GND',
  io: 'I/O',
  analog: 'ANA',
  special: 'SPL',
  nc: 'NC',
};

// ---------------------------------------------------------------------------
// SVG Renderers for different package types
// ---------------------------------------------------------------------------

function DipPinDiagram({ entry }: { entry: PinoutEntry }) {
  const leftPins = entry.pins.filter((p) => p.side === 'left');
  const rightPins = entry.pins.filter((p) => p.side === 'right');
  const maxSidePins = Math.max(leftPins.length, rightPins.length, 1);
  const pinSpacing = 18;
  const bodyHeight = maxSidePins * pinSpacing + 10;
  const bodyWidth = 80;
  const pinStub = 24;
  const svgWidth = bodyWidth + pinStub * 2 + 60;
  const svgHeight = bodyHeight + 20;
  const bodyX = pinStub + 30;
  const bodyY = 10;

  return (
    <svg
      width={svgWidth}
      height={svgHeight}
      viewBox={`0 0 ${svgWidth} ${svgHeight}`}
      className="block mx-auto"
      data-testid="pinout-diagram-svg"
    >
      {/* IC body */}
      <rect
        x={bodyX}
        y={bodyY}
        width={bodyWidth}
        height={bodyHeight}
        fill="none"
        stroke="#71717a"
        strokeWidth={1.5}
        rx={2}
      />
      {/* Notch */}
      <path
        d={`M ${bodyX + bodyWidth / 2 - 6} ${bodyY} A 6 6 0 0 1 ${bodyX + bodyWidth / 2 + 6} ${bodyY}`}
        fill="none"
        stroke="#71717a"
        strokeWidth={1.5}
      />
      {/* Pin 1 dot */}
      <circle
        cx={bodyX + 8}
        cy={bodyY + 12}
        r={2.5}
        fill="#a1a1aa"
      />

      {/* Left pins */}
      {leftPins.map((pin, i) => {
        const y = bodyY + 10 + i * pinSpacing;
        return (
          <g key={`left-${pin.number}`} data-testid={`diagram-pin-${pin.number}`}>
            <line x1={bodyX - pinStub} y1={y} x2={bodyX} y2={y} stroke="#71717a" strokeWidth={1} />
            <text
              x={bodyX - pinStub - 2}
              y={y + 3}
              textAnchor="end"
              fontSize={8}
              fontFamily="monospace"
              className={PIN_TYPE_COLORS[pin.type]}
              fill="currentColor"
            >
              {pin.name}
            </text>
            <text
              x={bodyX - 2}
              y={y + 3}
              textAnchor="end"
              fontSize={7}
              fontFamily="monospace"
              fill="#a1a1aa"
            >
              {pin.number}
            </text>
          </g>
        );
      })}

      {/* Right pins */}
      {rightPins.map((pin, i) => {
        const y = bodyY + 10 + i * pinSpacing;
        return (
          <g key={`right-${pin.number}`} data-testid={`diagram-pin-${pin.number}`}>
            <line x1={bodyX + bodyWidth} y1={y} x2={bodyX + bodyWidth + pinStub} y2={y} stroke="#71717a" strokeWidth={1} />
            <text
              x={bodyX + bodyWidth + pinStub + 2}
              y={y + 3}
              textAnchor="start"
              fontSize={8}
              fontFamily="monospace"
              className={PIN_TYPE_COLORS[pin.type]}
              fill="currentColor"
            >
              {pin.name}
            </text>
            <text
              x={bodyX + bodyWidth + 2}
              y={y + 3}
              textAnchor="start"
              fontSize={7}
              fontFamily="monospace"
              fill="#a1a1aa"
            >
              {pin.number}
            </text>
          </g>
        );
      })}

      {/* Component name inside body */}
      <text
        x={bodyX + bodyWidth / 2}
        y={bodyY + bodyHeight / 2 + 4}
        textAnchor="middle"
        fontSize={9}
        fontFamily="sans-serif"
        fill="#e4e4e7"
      >
        {entry.name}
      </text>
    </svg>
  );
}

function SmallPackagePinDiagram({ entry }: { entry: PinoutEntry }) {
  const svgWidth = 160;
  const svgHeight = 80;
  const bodyW = 50;
  const bodyH = 40;
  const bodyX = (svgWidth - bodyW) / 2;
  const bodyY = 8;
  const pinSpacing = bodyW / (entry.pinCount + 1);

  return (
    <svg
      width={svgWidth}
      height={svgHeight}
      viewBox={`0 0 ${svgWidth} ${svgHeight}`}
      className="block mx-auto"
      data-testid="pinout-diagram-svg"
    >
      {/* Package body */}
      <rect
        x={bodyX}
        y={bodyY}
        width={bodyW}
        height={bodyH}
        fill="none"
        stroke="#71717a"
        strokeWidth={1.5}
        rx={2}
      />
      {/* Tab */}
      <rect
        x={bodyX + bodyW / 2 - 8}
        y={bodyY - 4}
        width={16}
        height={8}
        fill="none"
        stroke="#71717a"
        strokeWidth={1}
        rx={1}
      />

      {/* Bottom pins */}
      {entry.pins.map((pin, i) => {
        const x = bodyX + (i + 1) * pinSpacing;
        return (
          <g key={`pin-${pin.number}`} data-testid={`diagram-pin-${pin.number}`}>
            <line x1={x} y1={bodyY + bodyH} x2={x} y2={bodyY + bodyH + 16} stroke="#71717a" strokeWidth={1} />
            <text
              x={x}
              y={bodyY + bodyH + 28}
              textAnchor="middle"
              fontSize={8}
              fontFamily="monospace"
              className={PIN_TYPE_COLORS[pin.type]}
              fill="currentColor"
            >
              {pin.name}
            </text>
            <text
              x={x}
              y={bodyY + bodyH + 12}
              textAnchor="middle"
              fontSize={7}
              fontFamily="monospace"
              fill="#a1a1aa"
            >
              {pin.number}
            </text>
          </g>
        );
      })}

      {/* Component name inside body */}
      <text
        x={bodyX + bodyW / 2}
        y={bodyY + bodyH / 2 + 4}
        textAnchor="middle"
        fontSize={8}
        fontFamily="sans-serif"
        fill="#e4e4e7"
      >
        {entry.name}
      </text>
    </svg>
  );
}

function ModulePinDiagram({ entry }: { entry: PinoutEntry }) {
  const leftPins = entry.pins.filter((p) => p.side === 'left');
  const rightPins = entry.pins.filter((p) => p.side === 'right');
  const maxSidePins = Math.max(leftPins.length, rightPins.length, 1);
  const pinSpacing = 14;
  const bodyHeight = maxSidePins * pinSpacing + 10;
  const bodyWidth = 60;
  const pinStub = 16;
  const svgWidth = bodyWidth + pinStub * 2 + 80;
  const svgHeight = bodyHeight + 20;
  const bodyX = pinStub + 40;
  const bodyY = 10;

  return (
    <svg
      width={svgWidth}
      height={svgHeight}
      viewBox={`0 0 ${svgWidth} ${svgHeight}`}
      className="block mx-auto"
      data-testid="pinout-diagram-svg"
    >
      {/* Module body */}
      <rect
        x={bodyX}
        y={bodyY}
        width={bodyWidth}
        height={bodyHeight}
        fill="none"
        stroke="#71717a"
        strokeWidth={1.5}
        rx={3}
      />

      {/* Left pins */}
      {leftPins.map((pin, i) => {
        const y = bodyY + 8 + i * pinSpacing;
        return (
          <g key={`left-${pin.number}`} data-testid={`diagram-pin-${pin.number}`}>
            <line x1={bodyX - pinStub} y1={y} x2={bodyX} y2={y} stroke="#71717a" strokeWidth={1} />
            <text
              x={bodyX - pinStub - 2}
              y={y + 3}
              textAnchor="end"
              fontSize={7}
              fontFamily="monospace"
              className={PIN_TYPE_COLORS[pin.type]}
              fill="currentColor"
            >
              {pin.name}
            </text>
          </g>
        );
      })}

      {/* Right pins */}
      {rightPins.map((pin, i) => {
        const y = bodyY + 8 + i * pinSpacing;
        return (
          <g key={`right-${pin.number}`} data-testid={`diagram-pin-${pin.number}`}>
            <line x1={bodyX + bodyWidth} y1={y} x2={bodyX + bodyWidth + pinStub} y2={y} stroke="#71717a" strokeWidth={1} />
            <text
              x={bodyX + bodyWidth + pinStub + 2}
              y={y + 3}
              textAnchor="start"
              fontSize={7}
              fontFamily="monospace"
              className={PIN_TYPE_COLORS[pin.type]}
              fill="currentColor"
            >
              {pin.name}
            </text>
          </g>
        );
      })}

      {/* Component name inside body */}
      <text
        x={bodyX + bodyWidth / 2}
        y={bodyY + bodyHeight / 2 + 3}
        textAnchor="middle"
        fontSize={8}
        fontFamily="sans-serif"
        fill="#e4e4e7"
      >
        {entry.name.length > 10 ? entry.name.slice(0, 10) + '...' : entry.name}
      </text>
    </svg>
  );
}

function PinDiagram({ entry }: { entry: PinoutEntry }) {
  const pkg = entry.package.toUpperCase();
  const isSmall = entry.pinCount <= 3 || pkg.startsWith('TO-');
  const isDip = pkg.startsWith('DIP');

  if (isSmall) {
    return <SmallPackagePinDiagram entry={entry} />;
  }
  if (isDip) {
    return <DipPinDiagram entry={entry} />;
  }
  return <ModulePinDiagram entry={entry} />;
}

// ---------------------------------------------------------------------------
// Pin table
// ---------------------------------------------------------------------------

function PinTable({ pins }: { pins: PinInfo[] }) {
  return (
    <div data-testid="pinout-pin-table" className="text-xs">
      <div className="grid grid-cols-[40px_1fr_1fr_50px] gap-x-2 px-2 py-1 text-zinc-500 font-semibold border-b border-zinc-700/50">
        <span data-testid="pin-table-header-pin">#</span>
        <span data-testid="pin-table-header-name">Name</span>
        <span data-testid="pin-table-header-function">Function</span>
        <span data-testid="pin-table-header-type">Type</span>
      </div>
      {pins.map((pin) => (
        <div
          key={pin.number}
          data-testid={`pin-row-${pin.number}`}
          className="grid grid-cols-[40px_1fr_1fr_50px] gap-x-2 px-2 py-0.5 hover:bg-zinc-800/50 border-b border-zinc-800/30"
        >
          <span className="text-zinc-400 font-mono">{pin.number}</span>
          <span className={cn('font-mono font-medium', PIN_TYPE_COLORS[pin.type])}>
            {pin.name}
          </span>
          <span className="text-zinc-400 truncate" title={pin.functions.join(', ')}>
            {pin.functions.join(', ')}
          </span>
          <Badge
            variant="outline"
            className={cn(
              'text-[10px] px-1 py-0 h-4 justify-center font-mono',
              PIN_TYPE_COLORS[pin.type],
            )}
            data-testid={`pin-type-badge-${pin.number}`}
          >
            {PIN_TYPE_LABELS[pin.type]}
          </Badge>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Key specs section
// ---------------------------------------------------------------------------

function KeySpecs({ partMeta }: { partMeta?: PartMeta }) {
  if (!partMeta?.properties || partMeta.properties.length === 0) {
    return null;
  }

  return (
    <div data-testid="pinout-key-specs" className="px-3 py-2 border-t border-zinc-700/50">
      <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">
        Key Specs
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
        {partMeta.properties.slice(0, 6).map((prop) => (
          <div key={prop.key} className="flex justify-between" data-testid={`spec-${prop.key}`}>
            <span className="text-zinc-500">{prop.key}:</span>
            <span className="text-zinc-300 font-mono">{prop.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Legend
// ---------------------------------------------------------------------------

function PinTypeLegend() {
  const types: Array<PinInfo['type']> = ['power', 'ground', 'io', 'analog', 'special', 'nc'];
  return (
    <div data-testid="pinout-legend" className="flex flex-wrap gap-2 px-3 py-1.5 border-t border-zinc-700/50">
      {types.map((t) => (
        <div key={t} className="flex items-center gap-1 text-[10px]">
          <div className={cn('w-2 h-2 rounded-full', PIN_TYPE_BG_COLORS[t])} />
          <span className="text-zinc-400 capitalize">{t}</span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function PinoutHoverCard({
  componentName,
  connectors,
  partMeta,
  position,
  onClose,
  className,
}: PinoutHoverCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  // Resolve pinout data
  const pinout: PinoutEntry = (() => {
    // Try matching by component name
    const match = lookupPinout(componentName);
    if (match) {
      return match;
    }

    // Try matching by part meta title or mpn
    if (partMeta?.title) {
      const titleMatch = lookupPinout(partMeta.title);
      if (titleMatch) {
        return titleMatch;
      }
    }
    if (partMeta?.mpn) {
      const mpnMatch = lookupPinout(partMeta.mpn);
      if (mpnMatch) {
        return mpnMatch;
      }
    }

    // Fallback to generic
    const pinCount = connectors?.length ?? 2;
    return getGenericPinout(pinCount, partMeta?.packageType);
  })();

  // Escape to dismiss
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose],
  );

  // Click outside to dismiss
  const handleClickOutside = useCallback(
    (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        onClose();
      }
    },
    [onClose],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [handleKeyDown, handleClickOutside]);

  // Auto-reposition to stay in viewport
  const adjustedPosition = (() => {
    const cardWidth = 380;
    const cardMaxHeight = 500;
    let x = position.x + 12;
    let y = position.y + 12;

    if (typeof window !== 'undefined') {
      if (x + cardWidth > window.innerWidth - 16) {
        x = position.x - cardWidth - 12;
      }
      if (x < 16) {
        x = 16;
      }
      if (y + cardMaxHeight > window.innerHeight - 16) {
        y = Math.max(16, window.innerHeight - cardMaxHeight - 16);
      }
    }

    return { x, y };
  })();

  const datasheetUrl = partMeta?.datasheetUrl ?? pinout.datasheetUrl;

  return (
    <div
      ref={cardRef}
      data-testid="pinout-hover-card"
      className={cn(
        'fixed z-50 w-[380px] max-h-[500px] flex flex-col',
        'rounded-lg border border-zinc-700 shadow-xl',
        'bg-zinc-900/95 backdrop-blur-sm text-zinc-100',
        'animate-in fade-in-0 zoom-in-95 duration-150',
        className,
      )}
      style={{
        left: adjustedPosition.x,
        top: adjustedPosition.y,
      }}
    >
      {/* Header */}
      <div
        data-testid="pinout-header"
        className="px-3 py-2 border-b border-zinc-700/50 flex items-center justify-between"
      >
        <div className="flex flex-col gap-0.5">
          <span data-testid="pinout-component-name" className="text-sm font-semibold text-zinc-100">
            {pinout.name}
          </span>
          <div className="flex items-center gap-2 text-[10px] text-zinc-500">
            <span data-testid="pinout-package">{pinout.package}</span>
            <span>|</span>
            <span data-testid="pinout-family">{pinout.family}</span>
            <span>|</span>
            <span data-testid="pinout-pin-count">{pinout.pinCount} pins</span>
          </div>
        </div>
        <button
          data-testid="pinout-close-button"
          onClick={onClose}
          className="text-zinc-500 hover:text-zinc-300 transition-colors p-1"
          aria-label="Close pinout card"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3 3L11 11M11 3L3 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Description */}
      {pinout.description && (
        <div data-testid="pinout-description" className="px-3 py-1.5 text-[11px] text-zinc-400 border-b border-zinc-700/50">
          {pinout.description}
        </div>
      )}

      {/* Pin diagram */}
      <div data-testid="pinout-diagram" className="px-2 py-2 border-b border-zinc-700/50 overflow-x-auto">
        <PinDiagram entry={pinout} />
      </div>

      {/* Legend */}
      <PinTypeLegend />

      {/* Scrollable pin table */}
      <ScrollArea className="flex-1 min-h-0 max-h-[200px]" data-testid="pinout-pin-table-scroll">
        <PinTable pins={pinout.pins} />
      </ScrollArea>

      {/* Key specs */}
      <KeySpecs partMeta={partMeta} />

      {/* Datasheet link */}
      {datasheetUrl && isSafeUrl(datasheetUrl) && (
        <div data-testid="pinout-datasheet" className="px-3 py-1.5 border-t border-zinc-700/50">
          <a
            href={datasheetUrl}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="pinout-datasheet-link"
            className="text-[11px] text-[#00F0FF] hover:text-[#00F0FF]/80 underline underline-offset-2 transition-colors"
          >
            View Datasheet
          </a>
        </div>
      )}
    </div>
  );
}

export default PinoutHoverCard;
