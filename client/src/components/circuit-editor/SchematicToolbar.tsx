import {
  MousePointer2,
  Move,
  Grid3x3,
  Maximize,
  Cable,
  Zap,
  Component,
  Undo2,
  Redo2,
  Keyboard,
} from 'lucide-react';
import type { SchematicTool } from '@shared/circuit-types';
import { cn } from '@/lib/utils';
import { StyledTooltip } from '@/components/ui/styled-tooltip';

interface SchematicToolbarProps {
  activeTool: SchematicTool;
  onToolChange: (tool: SchematicTool) => void;
  snapEnabled: boolean;
  onToggleSnap: () => void;
  onFitView: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onOpenShortcuts?: () => void;
}

const tools: {
  id: SchematicTool;
  icon: typeof MousePointer2;
  label: string;
  enabled: boolean;
}[] = [
  { id: 'select', icon: MousePointer2, label: 'Select (V)', enabled: true },
  { id: 'pan', icon: Move, label: 'Pan (H)', enabled: true },
  { id: 'draw-net', icon: Cable, label: 'Draw Net (W) — drag between pins', enabled: true },
  { id: 'place-component', icon: Component, label: 'Place Component — drag from Parts panel', enabled: false },
  { id: 'place-power', icon: Zap, label: 'Place Power — drag from Power panel', enabled: false },
];

export default function SchematicToolbar({
  activeTool,
  onToolChange,
  snapEnabled,
  onToggleSnap,
  onFitView,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  onOpenShortcuts,
}: SchematicToolbarProps) {
  return (
    <div
      className="absolute top-3 left-60 z-10 flex items-center gap-1 bg-card/80 backdrop-blur-xl border border-border p-1 shadow-lg"
      data-testid="schematic-toolbar"
    >
      {tools.map((tool) => (
        <StyledTooltip key={tool.id} content={tool.label} side="bottom">
          <button
            data-testid={`schematic-tool-${tool.id}`}
            disabled={!tool.enabled}
            aria-label={tool.label}
            className={cn(
              'p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors',
              activeTool === tool.id && tool.enabled && 'bg-primary/20 text-primary border border-primary/40',
              !tool.enabled && 'opacity-40 cursor-not-allowed hover:bg-transparent hover:text-muted-foreground',
            )}
            onClick={() => tool.enabled && onToolChange(tool.id)}
          >
            <tool.icon className="w-5 h-5" />
          </button>
        </StyledTooltip>
      ))}
      <div className="w-px h-5 bg-border mx-0.5" />
      <StyledTooltip content="Undo (Ctrl+Z)" side="bottom">
        <button
          data-testid="button-undo"
          disabled={!canUndo}
          aria-label="Undo (Ctrl+Z)"
          className={cn(
            'p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors',
            !canUndo && 'opacity-40 cursor-not-allowed hover:bg-transparent hover:text-muted-foreground',
          )}
          onClick={onUndo}
        >
          <Undo2 className="w-5 h-5" />
        </button>
      </StyledTooltip>
      <StyledTooltip content="Redo (Ctrl+Shift+Z)" side="bottom">
        <button
          data-testid="button-redo"
          disabled={!canRedo}
          aria-label="Redo (Ctrl+Shift+Z)"
          className={cn(
            'p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors',
            !canRedo && 'opacity-40 cursor-not-allowed hover:bg-transparent hover:text-muted-foreground',
          )}
          onClick={onRedo}
        >
          <Redo2 className="w-5 h-5" />
        </button>
      </StyledTooltip>
      <div className="w-px h-5 bg-border mx-0.5" />
      <StyledTooltip content="Toggle grid snap (G)" side="bottom">
        <button
          data-testid="schematic-tool-grid"
          aria-label="Toggle grid snap"
          className={cn(
            'p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors',
            snapEnabled && 'bg-primary/20 text-primary border border-primary/40',
          )}
          onClick={onToggleSnap}
        >
          <Grid3x3 className="w-5 h-5" />
        </button>
      </StyledTooltip>
      <StyledTooltip content="Fit view (F)" side="bottom">
        <button
          data-testid="schematic-tool-fit"
          aria-label="Fit view"
          className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          onClick={onFitView}
        >
          <Maximize className="w-5 h-5" />
        </button>
      </StyledTooltip>
      <div className="w-px h-5 bg-border mx-0.5" />
      <StyledTooltip content="Keyboard Shortcuts (?)" side="bottom">
        <button
          data-testid="button-keyboard-shortcuts"
          aria-label="Keyboard Shortcuts"
          className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          onClick={onOpenShortcuts}
        >
          <Keyboard className="w-5 h-5" />
        </button>
      </StyledTooltip>
    </div>
  );
}
