import { memo, useState, useRef, useEffect } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { FileStack, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { HierarchicalPortRow } from '@shared/schema';

export interface SheetNodeData {
  instanceId: number;
  subDesignId: number;
  referenceDesignator: string;
  sheetName: string;
  ports: HierarchicalPortRow[];
  onEnterSheet?: (subDesignId: number) => void;
  [key: string]: unknown;
}

const PIN_SPACING = 20;
const PIN_STUB = 15;
const BODY_MIN_WIDTH = 100;
const BODY_MIN_HEIGHT = 60;
const BODY_PADDING = 8;
const CHAR_WIDTH = 5.5;

function SchematicSheetNode({
  data,
  selected,
}: NodeProps<Node<SheetNodeData>>) {
  const { sheetName, ports, referenceDesignator, onEnterSheet, subDesignId } = data;

  // Split ports into left and right based on their name or index for now
  // In a more advanced implementation, port position would be defined in the sub-sheet
  const halfIndex = Math.ceil(ports.length / 2);
  const leftPorts = ports.slice(0, halfIndex);
  const rightPorts = ports.slice(halfIndex);
  const maxPorts = Math.max(leftPorts.length, rightPorts.length, 1);

  const bodyH = Math.max(BODY_MIN_HEIGHT, maxPorts * PIN_SPACING + BODY_PADDING * 2);
  
  const maxLeftLen = leftPorts.reduce((m, p) => Math.max(m, p.portName.length), 0);
  const maxRightLen = rightPorts.reduce((m, p) => Math.max(m, p.portName.length), 0);
  const labelWidth = (maxLeftLen + maxRightLen) * CHAR_WIDTH + 40;
  const bodyW = Math.max(BODY_MIN_WIDTH, labelWidth);
  
  const totalW = bodyW + PIN_STUB * 2;
  const totalH = bodyH;

  const portY = (index: number, count: number) =>
    count <= 1
      ? bodyH / 2
      : BODY_PADDING + (index + 0.5) * ((bodyH - BODY_PADDING * 2) / count);

  return (
    <div
      data-testid={`schematic-sheet-${subDesignId}`}
      className={cn(
        'relative bg-background/80 backdrop-blur-sm group',
        selected && 'ring-2 ring-primary ring-offset-1 ring-offset-background rounded-sm',
      )}
      style={{ width: totalW, height: totalH }}
    >
      {/* Reference Designator (Sheet Name) */}
      <div className="absolute -top-5 left-0 text-[10px] font-bold text-primary uppercase tracking-wider whitespace-nowrap">
        {referenceDesignator}
      </div>

      {/* Enter Sheet Button (Visible on hover or selection) */}
      <button
        onClick={() => onEnterSheet?.(subDesignId)}
        className={cn(
          "absolute -top-6 right-0 flex items-center gap-1 px-1.5 py-0.5 bg-primary text-primary-foreground text-[9px] font-bold rounded shadow-lg transition-all opacity-0 group-hover:opacity-100",
          selected && "opacity-100"
        )}
      >
        <span>Open Sheet</span>
        <ArrowUpRight className="w-2.5 h-2.5" />
      </button>

      <svg width={totalW} height={totalH} className="block overflow-visible">
        {/* Sheet body rectangle - dashed to distinguish from parts */}
        <rect
          x={PIN_STUB}
          y={0}
          width={bodyW}
          height={bodyH}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeDasharray="4 2"
          className="text-primary/60"
        />

        {/* Port stubs and labels */}
        {leftPorts.map((port, i) => {
          const y = portY(i, leftPorts.length);
          return (
            <g key={`port-left-${port.id}`} data-testid={`port-left-${port.id}`}>
              <line
                x1={0} y1={y} x2={PIN_STUB} y2={y}
                stroke="currentColor" strokeWidth={1}
                className="text-primary/40"
              />
              <text
                x={PIN_STUB + 4} y={y + 3}
                fill="currentColor" fontSize={8} fontFamily="monospace"
                className="text-primary font-medium"
              >
                {port.portName}
              </text>
            </g>
          );
        })}

        {rightPorts.map((port, i) => {
          const y = portY(i, rightPorts.length);
          return (
            <g key={`port-right-${port.id}`} data-testid={`port-right-${port.id}`}>
              <line
                x1={PIN_STUB + bodyW} y1={y} x2={totalW} y2={y}
                stroke="currentColor" strokeWidth={1}
                className="text-primary/40"
              />
              <text
                x={PIN_STUB + bodyW - 4} y={y + 3}
                fill="currentColor" fontSize={8} fontFamily="monospace"
                textAnchor="end"
                className="text-primary font-medium"
              >
                {port.portName}
              </text>
            </g>
          );
        })}

        {/* Sheet name centered */}
        <g className="opacity-40">
          <FileStack x={PIN_STUB + bodyW / 2 - 8} y={bodyH / 2 - 12} width={16} height={16} className="text-primary" />
        </g>
        <text
          x={PIN_STUB + bodyW / 2}
          y={bodyH / 2 + 8}
          textAnchor="middle"
          fill="currentColor"
          fontSize={10}
          fontFamily="sans-serif"
          className="text-foreground font-bold"
        >
          {sheetName}
        </text>
      </svg>

      {/* Handles */}
      {leftPorts.map((port, i) => (
        <Handle
          key={port.id}
          id={`port-${port.id}`}
          type="source"
          position={Position.Left}
          style={{ left: 0, top: portY(i, leftPorts.length), transform: 'translate(-50%, -50%)', position: 'absolute' }}
          className="!w-2 !h-2 !bg-primary/60 !border-primary hover:!bg-primary"
        />
      ))}
      {rightPorts.map((port, i) => (
        <Handle
          key={port.id}
          id={`port-${port.id}`}
          type="source"
          position={Position.Right}
          style={{ left: totalW, top: portY(i, rightPorts.length), transform: 'translate(-50%, -50%)', position: 'absolute' }}
          className="!w-2 !h-2 !bg-primary/60 !border-primary hover:!bg-primary"
        />
      ))}
    </div>
  );
}

export default memo(SchematicSheetNode);
