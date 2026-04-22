/* eslint-disable jsx-a11y/no-static-element-interactions --
 * Phase 3 <InteractiveCard> primitive migration will replace `role="button"` on
 * `<div>` elements with real `<button>` elements, at which point these disables
 * can be removed. See docs/superpowers/plans/2026-04-18-e2e-walkthrough/03-a11y-systemic.md
 * Phase 3. Tracked as part of E2E-552 / Plan 03 Phase 4.
 */
import { memo, useState, useRef, useEffect, type ReactNode } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { cn } from '@/lib/utils';
import type { PowerSymbolType } from '@shared/circuit-types';

// ---------------------------------------------------------------------------
// Node data type
// ---------------------------------------------------------------------------

export interface PowerNodeData {
  symbolId: string;
  symbolType: PowerSymbolType;
  netName: string;
  rotation: number;
  customLabel?: string;
  onNetNameChange?: (newNetName: string) => void;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// SVG symbol renderers (IEEE standard power symbols)
// ---------------------------------------------------------------------------

const SYMBOL_SIZE = 36;

function VCCSymbol() {
  return (
    <g>
      {/* Upward arrow / bar for VCC */}
      <line x1={18} y1={36} x2={18} y2={14} stroke="currentColor" strokeWidth={1.5} />
      <line x1={8} y1={14} x2={28} y2={14} stroke="currentColor" strokeWidth={2} />
      <line x1={12} y1={8} x2={24} y2={8} stroke="currentColor" strokeWidth={1.5} />
      <line x1={15} y1={3} x2={21} y2={3} stroke="currentColor" strokeWidth={1} />
    </g>
  );
}

function GNDSymbol() {
  return (
    <g>
      {/* Downward bars for GND */}
      <line x1={18} y1={0} x2={18} y2={22} stroke="currentColor" strokeWidth={1.5} />
      <line x1={6} y1={22} x2={30} y2={22} stroke="currentColor" strokeWidth={2} />
      <line x1={10} y1={27} x2={26} y2={27} stroke="currentColor" strokeWidth={1.5} />
      <line x1={14} y1={32} x2={22} y2={32} stroke="currentColor" strokeWidth={1} />
    </g>
  );
}

function AGNDSymbol() {
  return (
    <g>
      {/* Triangle-shaped analog ground */}
      <line x1={18} y1={0} x2={18} y2={16} stroke="currentColor" strokeWidth={1.5} />
      <polygon
        points="6,16 30,16 18,32"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
      />
      <text
        x={18}
        y={28}
        textAnchor="middle"
        fontSize={6}
        fill="currentColor"
        className="text-muted-foreground"
      >
        A
      </text>
    </g>
  );
}

function DGNDSymbol() {
  return (
    <g>
      {/* Triangle-shaped digital ground */}
      <line x1={18} y1={0} x2={18} y2={16} stroke="currentColor" strokeWidth={1.5} />
      <polygon
        points="6,16 30,16 18,32"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
      />
      <text
        x={18}
        y={28}
        textAnchor="middle"
        fontSize={6}
        fill="currentColor"
        className="text-muted-foreground"
      >
        D
      </text>
    </g>
  );
}

const SYMBOL_RENDERERS: Record<PowerSymbolType, () => ReactNode> = {
  VCC: VCCSymbol,
  VDD: VCCSymbol,
  V3V3: VCCSymbol,
  V5V: VCCSymbol,
  V12V: VCCSymbol,
  GND: GNDSymbol,
  AGND: AGNDSymbol,
  DGND: DGNDSymbol,
  custom: VCCSymbol,
};

/** Returns whether this power type connects at the top (supply) or bottom (ground). */
function isGroundType(type: PowerSymbolType): boolean {
  return type === 'GND' || type === 'AGND' || type === 'DGND';
}

// ---------------------------------------------------------------------------
// Color mapping by power type
// ---------------------------------------------------------------------------

function getColor(type: PowerSymbolType): string {
  if (isGroundType(type)) return '#22c55e';
  return '#ef4444';
}

// ---------------------------------------------------------------------------
// Node component
// ---------------------------------------------------------------------------

function SchematicPowerNode({
  data,
  selected,
}: NodeProps<Node<PowerNodeData>>) {
  const { symbolType, netName, rotation, customLabel, onNetNameChange } = data;

  const SymbolRenderer = SYMBOL_RENDERERS[symbolType] ?? VCCSymbol;
  const color = getColor(symbolType);
  const label = customLabel || netName;
  const ground = isGroundType(symbolType);

  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(label);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const commitEdit = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== label) {
      onNetNameChange?.(trimmed);
    }
    setIsEditing(false);
    setEditValue(label);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditValue(label);
  };

  return (
    <div
      data-testid={`schematic-power-${symbolType.toLowerCase()}`}
      className={cn(
        'relative',
        selected && 'ring-2 ring-primary ring-offset-1 ring-offset-background rounded-sm',
      )}
      style={{
        width: SYMBOL_SIZE,
        height: SYMBOL_SIZE,
        transform: rotation ? `rotate(${rotation}deg)` : undefined,
        color,
      }}
    >
      <svg width={SYMBOL_SIZE} height={SYMBOL_SIZE} className="block">
        <SymbolRenderer />
      </svg>

      {/* Label */}
      {isEditing ? (
        <input
          ref={inputRef}
          data-testid="node-label-input"
          className="absolute left-full ml-1 text-[9px] font-bold bg-transparent border-0 outline-none ring-1 ring-primary rounded px-0.5 py-0 whitespace-nowrap min-w-[30px]"
          style={{ color, top: '50%', transform: 'translateY(-50%)' }}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { commitEdit(); }
            if (e.key === 'Escape') { cancelEdit(); }
            e.stopPropagation();
          }}
          onBlur={commitEdit}
          onMouseDown={(e) => e.stopPropagation()}
        />
      ) : (
        <div
          className="absolute left-full ml-1 text-[9px] font-bold whitespace-nowrap cursor-text"
          style={{ color, top: '50%', transform: 'translateY(-50%)' }}
          onDoubleClick={() => { setEditValue(label); setIsEditing(true); }}
          data-testid="node-label-display"
        >
          {label}
        </div>
      )}

      {/* Single pin handle — connection point */}
      <Handle
        id="power-pin"
        type="source"
        position={ground ? Position.Top : Position.Bottom}
        style={{
          left: SYMBOL_SIZE / 2,
          top: ground ? 0 : SYMBOL_SIZE,
          transform: 'translate(-50%, -50%)',
          position: 'absolute',
        }}
        className="!w-2 !h-2 !bg-primary/60 !border-primary hover:!bg-primary"
      />
    </div>
  );
}

export default memo(SchematicPowerNode);
