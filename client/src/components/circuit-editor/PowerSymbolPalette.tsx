import { useCallback, useState } from 'react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { StyledTooltip } from '@/components/ui/styled-tooltip';
import { GripVertical, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PowerSymbolType } from '@shared/circuit-types';

// ---------------------------------------------------------------------------
// Drag data type — shared with SchematicCanvas onDrop handler
// ---------------------------------------------------------------------------

export const POWER_SYMBOL_DRAG_TYPE = 'application/x-protopulse-power';

export interface PowerSymbolDragData {
  symbolType: PowerSymbolType;
  netName: string;
  customLabel?: string;
}

// ---------------------------------------------------------------------------
// Power symbol definitions
// ---------------------------------------------------------------------------

interface PowerSymbolDef {
  type: PowerSymbolType;
  label: string;
  netName: string;
  group: 'supply' | 'ground';
  color: string;
  description: string;
}

const POWER_SYMBOLS: PowerSymbolDef[] = [
  { type: 'VCC', label: 'VCC', netName: 'VCC', group: 'supply', color: '#ef4444', description: 'Positive supply (generic)' },
  { type: 'VDD', label: 'VDD', netName: 'VDD', group: 'supply', color: '#ef4444', description: 'Positive supply (CMOS)' },
  { type: 'V3V3', label: '3.3V', netName: '+3V3', group: 'supply', color: '#ef4444', description: '3.3V supply rail' },
  { type: 'V5V', label: '5V', netName: '+5V', group: 'supply', color: '#ef4444', description: '5V supply rail' },
  { type: 'V12V', label: '12V', netName: '+12V', group: 'supply', color: '#ef4444', description: '12V supply rail' },
  { type: 'GND', label: 'GND', netName: 'GND', group: 'ground', color: '#22c55e', description: 'Signal ground' },
  { type: 'AGND', label: 'AGND', netName: 'AGND', group: 'ground', color: '#22c55e', description: 'Analog ground' },
  { type: 'DGND', label: 'DGND', netName: 'DGND', group: 'ground', color: '#22c55e', description: 'Digital ground' },
];

// ---------------------------------------------------------------------------
// Draggable symbol item
// ---------------------------------------------------------------------------

function SymbolItem({ def }: { def: PowerSymbolDef }) {
  const onDragStart = useCallback(
    (e: React.DragEvent) => {
      const dragData: PowerSymbolDragData = {
        symbolType: def.type,
        netName: def.netName,
      };
      e.dataTransfer.setData(POWER_SYMBOL_DRAG_TYPE, JSON.stringify(dragData));
      e.dataTransfer.effectAllowed = 'copy';
    },
    [def],
  );

  return (
    <StyledTooltip content={def.description} side="right">
      <div
        draggable
        onDragStart={onDragStart}
        data-testid={`power-symbol-${def.type.toLowerCase()}`}
        className={cn(
          'flex items-center gap-2 px-2 py-1.5 rounded-sm cursor-grab active:cursor-grabbing',
          'hover:bg-muted/60 transition-colors group',
        )}
      >
        <GripVertical className="w-3 h-3 text-muted-foreground/40 group-hover:text-muted-foreground shrink-0" />
        <Zap className="w-3.5 h-3.5 shrink-0" style={{ color: def.color }} />
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium" style={{ color: def.color }}>
            {def.label}
          </div>
          <div className="text-[10px] text-muted-foreground truncate">
            {def.netName}
          </div>
        </div>
      </div>
    </StyledTooltip>
  );
}

// ---------------------------------------------------------------------------
// Custom power symbol input
// ---------------------------------------------------------------------------

function CustomSymbolInput({
  onDragStart,
}: {
  onDragStart: (data: PowerSymbolDragData) => void;
}) {
  const [customNet, setCustomNet] = useState('');

  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      if (!customNet.trim()) {
        e.preventDefault();
        return;
      }
      const data: PowerSymbolDragData = {
        symbolType: 'custom',
        netName: customNet.trim(),
        customLabel: customNet.trim(),
      };
      onDragStart(data);
      e.dataTransfer.setData(POWER_SYMBOL_DRAG_TYPE, JSON.stringify(data));
      e.dataTransfer.effectAllowed = 'copy';
    },
    [customNet, onDragStart],
  );

  return (
    <div className="px-2 py-1.5">
      <div className="text-[10px] text-muted-foreground mb-1">Custom Power Net</div>
      <div className="flex gap-1">
        <Input
          data-testid="power-symbol-custom-input"
          value={customNet}
          onChange={(e) => setCustomNet(e.target.value)}
          placeholder="Net name..."
          className="h-6 text-xs flex-1"
        />
        <div
          draggable={!!customNet.trim()}
          onDragStart={handleDragStart}
          className={cn(
            'h-6 px-2 flex items-center rounded-sm text-[10px] font-medium',
            customNet.trim()
              ? 'bg-primary/20 text-primary cursor-grab active:cursor-grabbing'
              : 'bg-muted/30 text-muted-foreground/40 cursor-not-allowed',
          )}
        >
          Drag
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Power Symbol Palette
// ---------------------------------------------------------------------------

export default function PowerSymbolPalette() {
  const supplySymbols = POWER_SYMBOLS.filter((s) => s.group === 'supply');
  const groundSymbols = POWER_SYMBOLS.filter((s) => s.group === 'ground');

  // No-op callback for CustomSymbolInput (drag data is set in onDragStart)
  const handleCustomDragStart = useCallback(() => {}, []);

  return (
    <div
      className="flex flex-col h-full bg-card/40 border-r border-border"
      data-testid="power-symbol-palette"
    >
      <div className="px-3 py-2 border-b border-border shrink-0">
        <h3 className="text-xs font-semibold text-foreground">Power Symbols</h3>
      </div>

      <ScrollArea className="flex-1">
        <div className="py-1">
          {/* Supply group */}
          <div className="px-2 py-1">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
              Supply Rails
            </span>
          </div>
          {supplySymbols.map((def) => (
            <SymbolItem key={def.type} def={def} />
          ))}

          {/* Ground group */}
          <div className="px-2 py-1 mt-1">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
              Ground
            </span>
          </div>
          {groundSymbols.map((def) => (
            <SymbolItem key={def.type} def={def} />
          ))}

          {/* Custom */}
          <div className="mt-2 border-t border-border pt-1">
            <CustomSymbolInput onDragStart={handleCustomDragStart} />
          </div>
        </div>
      </ScrollArea>

      <div className="px-3 py-1.5 border-t border-border text-[10px] text-muted-foreground/60 shrink-0">
        Drag a power symbol onto the canvas
      </div>
    </div>
  );
}
