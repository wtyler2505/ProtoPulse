import { memo } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import type { Connector, Shape, TerminalPosition } from '@shared/component-types';
import PartSymbolRenderer, { computeShapesBounds } from './PartSymbolRenderer';
import { cn } from '@/lib/utils';

export interface InstanceNodeData {
  instanceId: number;
  referenceDesignator: string;
  rotation: number;
  partTitle: string;
  connectors: Connector[];
  schematicShapes: Shape[];
  [key: string]: unknown; // Required by @xyflow/react — all node data types must be indexable
}

const PIN_SPACING = 20;
const PIN_STUB = 18;
const BODY_MIN_WIDTH = 60;
const BODY_PADDING = 6;
/** Approximate character width for monospace pin labels at fontSize 9 */
const CHAR_WIDTH = 5.5;

function SchematicInstanceNode({
  data,
  selected,
}: NodeProps<Node<InstanceNodeData>>) {
  const { connectors, schematicShapes, referenceDesignator, partTitle, rotation } =
    data;
  const hasCustomShapes = schematicShapes.length > 0;

  if (hasCustomShapes) {
    return (
      <CustomShapeSymbol
        shapes={schematicShapes}
        connectors={connectors}
        referenceDesignator={referenceDesignator}
        partTitle={partTitle}
        rotation={rotation}
        selected={selected}
      />
    );
  }

  return (
    <GenericICSymbol
      connectors={connectors}
      referenceDesignator={referenceDesignator}
      partTitle={partTitle}
      rotation={rotation}
      selected={selected}
    />
  );
}

// ---------------------------------------------------------------------------
// Custom shape rendering — uses part's schematic SVG shapes
// ---------------------------------------------------------------------------

function CustomShapeSymbol({
  shapes,
  connectors,
  referenceDesignator,
  partTitle,
  rotation,
  selected,
}: {
  shapes: Shape[];
  connectors: Connector[];
  referenceDesignator: string;
  partTitle: string;
  rotation: number;
  selected: boolean;
}) {
  const bounds = computeShapesBounds(shapes);
  const svgW = Math.max(bounds.width, 60);
  const svgH = Math.max(bounds.height, 40);

  return (
    <div
      data-testid={`schematic-instance-custom`}
      className={cn(
        'relative',
        selected && 'ring-2 ring-primary ring-offset-1 ring-offset-background rounded-sm',
      )}
      style={{ transform: rotation ? `rotate(${rotation}deg)` : undefined }}
    >
      <div className="absolute -top-5 left-0 text-[10px] font-bold text-primary whitespace-nowrap">
        {referenceDesignator}
      </div>
      <PartSymbolRenderer
        shapes={shapes}
        width={svgW}
        height={svgH}
        viewBox={`${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`}
      />
      <div className="absolute -bottom-4 left-0 text-[9px] text-muted-foreground whitespace-nowrap">
        {partTitle}
      </div>
      {connectors.map((conn, connIdx) => {
        const pos: TerminalPosition | undefined =
          conn.terminalPositions?.['schematic'];
        if (!pos) return null;
        const px =
          bounds.width > 0
            ? ((pos.x - bounds.x) / bounds.width) * svgW
            : svgW / 2;
        const py =
          bounds.height > 0
            ? ((pos.y - bounds.y) / bounds.height) * svgH
            : svgH / 2;
        const isLeft = px < svgW / 2;
        return (
          <div key={conn.id} data-testid={`pin-custom-${conn.id}`}>
            {/* Internal pin name label */}
            <div
              className="absolute text-[8px] font-mono text-foreground font-medium pointer-events-none whitespace-nowrap"
              style={{
                left: isLeft ? px + 8 : px - 8,
                top: py - 5,
                transform: isLeft ? 'none' : 'translateX(-100%)',
              }}
              data-testid={`pin-label-${conn.id}`}
            >
              {conn.name}
            </div>
            {/* External pin number */}
            <div
              className="absolute text-[7px] font-mono text-muted-foreground pointer-events-none whitespace-nowrap"
              style={{
                left: isLeft ? px - 4 : px + 4,
                top: py - 10,
                transform: isLeft ? 'translateX(-100%)' : 'none',
              }}
              data-testid={`pin-number-${conn.id}`}
            >
              {connIdx + 1}
            </div>
            <Handle
              id={`pin-${conn.id}`}
              type="source"
              position={isLeft ? Position.Left : Position.Right}
              style={{
                left: px,
                top: py,
                transform: 'translate(-50%, -50%)',
                position: 'absolute',
              }}
              className="!w-2 !h-2 !bg-primary/60 !border-primary hover:!bg-primary"
            />
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Generic IC box — auto-generated for parts without schematic shapes
// ---------------------------------------------------------------------------

function GenericICSymbol({
  connectors,
  referenceDesignator,
  partTitle,
  rotation,
  selected,
}: {
  connectors: Connector[];
  referenceDesignator: string;
  partTitle: string;
  rotation: number;
  selected: boolean;
}) {
  const halfIndex = Math.ceil(connectors.length / 2);
  const leftPins = connectors.slice(0, halfIndex);
  const rightPins = connectors.slice(halfIndex);
  const maxPins = Math.max(leftPins.length, rightPins.length, 1);

  const bodyH = maxPins * PIN_SPACING + BODY_PADDING * 2;
  // Compute body width from longest pin name on each side so labels fit inside
  const maxLeftLen = leftPins.reduce((m, c) => Math.max(m, c.name.length), 0);
  const maxRightLen = rightPins.reduce((m, c) => Math.max(m, c.name.length), 0);
  const labelWidth = (maxLeftLen + maxRightLen) * CHAR_WIDTH + 24; // 24 = inner margins
  const bodyW = Math.max(BODY_MIN_WIDTH, labelWidth);
  const totalW = bodyW + PIN_STUB * 2;
  const totalH = bodyH;

  const pinY = (index: number, count: number) =>
    count <= 1
      ? bodyH / 2
      : BODY_PADDING + (index + 0.5) * ((bodyH - BODY_PADDING * 2) / count);

  return (
    <div
      data-testid={`schematic-instance-generic`}
      className={cn(
        'relative',
        selected && 'ring-2 ring-primary ring-offset-1 ring-offset-background rounded-sm',
      )}
      style={{
        width: totalW,
        height: totalH,
        transform: rotation ? `rotate(${rotation}deg)` : undefined,
      }}
    >
      <div className="absolute -top-5 left-0 text-[10px] font-bold text-primary whitespace-nowrap">
        {referenceDesignator}
      </div>

      <svg
        width={totalW}
        height={totalH}
        className="block"
        data-testid="schematic-instance-svg"
      >
        {/* IC body rectangle */}
        <rect
          x={PIN_STUB}
          y={0}
          width={bodyW}
          height={bodyH}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          className="text-foreground"
        />

        {/* Left pin stubs + internal name labels + external pin numbers */}
        {leftPins.map((conn, i) => {
          const y = pinY(i, leftPins.length);
          return (
            <g key={`left-${conn.id}`} data-testid={`pin-left-${conn.id}`}>
              <line
                x1={0}
                y1={y}
                x2={PIN_STUB}
                y2={y}
                stroke="currentColor"
                strokeWidth={1}
                className="text-muted-foreground"
              />
              {/* Pin name inside body */}
              <text
                x={PIN_STUB + 6}
                y={y + 3}
                fill="currentColor"
                fontSize={9}
                fontFamily="monospace"
                className="text-foreground"
                data-testid={`pin-label-${conn.id}`}
              >
                {conn.name}
              </text>
              {/* Pin number outside body */}
              <text
                x={PIN_STUB - 3}
                y={y - 4}
                fill="currentColor"
                fontSize={7}
                fontFamily="monospace"
                textAnchor="end"
                className="text-muted-foreground"
                data-testid={`pin-number-${conn.id}`}
              >
                {i + 1}
              </text>
            </g>
          );
        })}

        {/* Right pin stubs + internal name labels + external pin numbers */}
        {rightPins.map((conn, i) => {
          const y = pinY(i, rightPins.length);
          return (
            <g key={`right-${conn.id}`} data-testid={`pin-right-${conn.id}`}>
              <line
                x1={PIN_STUB + bodyW}
                y1={y}
                x2={totalW}
                y2={y}
                stroke="currentColor"
                strokeWidth={1}
                className="text-muted-foreground"
              />
              {/* Pin name inside body */}
              <text
                x={PIN_STUB + bodyW - 6}
                y={y + 3}
                fill="currentColor"
                fontSize={9}
                fontFamily="monospace"
                textAnchor="end"
                className="text-foreground"
                data-testid={`pin-label-${conn.id}`}
              >
                {conn.name}
              </text>
              {/* Pin number outside body */}
              <text
                x={PIN_STUB + bodyW + 3}
                y={y - 4}
                fill="currentColor"
                fontSize={7}
                fontFamily="monospace"
                className="text-muted-foreground"
                data-testid={`pin-number-${conn.id}`}
              >
                {leftPins.length + i + 1}
              </text>
            </g>
          );
        })}

        {/* Part title centered */}
        <text
          x={PIN_STUB + bodyW / 2}
          y={bodyH / 2 + 4}
          textAnchor="middle"
          fill="currentColor"
          fontSize={10}
          fontFamily="sans-serif"
          className="text-foreground"
        >
          {partTitle || 'Part'}
        </text>
      </svg>

      {/* Left pin handles */}
      {leftPins.map((conn, i) => {
        const y = pinY(i, leftPins.length);
        return (
          <Handle
            key={conn.id}
            id={`pin-${conn.id}`}
            type="source"
            position={Position.Left}
            style={{
              left: 0,
              top: y,
              transform: 'translate(-50%, -50%)',
              position: 'absolute',
            }}
            className="!w-2 !h-2 !bg-primary/60 !border-primary hover:!bg-primary"
          />
        );
      })}

      {/* Right pin handles */}
      {rightPins.map((conn, i) => {
        const y = pinY(i, rightPins.length);
        return (
          <Handle
            key={conn.id}
            id={`pin-${conn.id}`}
            type="source"
            position={Position.Right}
            style={{
              left: totalW,
              top: y,
              transform: 'translate(-50%, -50%)',
              position: 'absolute',
            }}
            className="!w-2 !h-2 !bg-primary/60 !border-primary hover:!bg-primary"
          />
        );
      })}
    </div>
  );
}

export default memo(SchematicInstanceNode);
