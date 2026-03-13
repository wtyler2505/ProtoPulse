import { memo } from 'react';
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
  Magnet,
  Eye,
  Type,
} from 'lucide-react';
import type { SchematicTool } from '@shared/circuit-types';
import { cn } from '@/lib/utils';
import { StyledTooltip } from '@/components/ui/styled-tooltip';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

export type AngleConstraint = 'free' | '45' | '90';

interface SchematicToolbarProps {
  activeTool: SchematicTool;
  onToolChange: (tool: SchematicTool) => void;
  snapEnabled: boolean;
  onToggleSnap: () => void;
  gridVisible?: boolean;
  onToggleGridVisible?: () => void;
  angleConstraint?: AngleConstraint;
  onAngleConstraintChange?: (angle: AngleConstraint) => void;
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
  { id: 'place-annotation', icon: Type, label: 'Place Annotation (T) — click to add text note', enabled: true },
];

const SchematicToolbar = memo(function SchematicToolbar({
  activeTool,
  onToolChange,
  snapEnabled,
  onToggleSnap,
  gridVisible = true,
  onToggleGridVisible,
  angleConstraint = 'free',
  onAngleConstraintChange,
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

      {/* Snap / Grid / Angle compact strip (UX-037) */}
      <StyledTooltip content="Snap to grid (G)" side="bottom">
        <button
          data-testid="schematic-tool-snap"
          aria-label="Toggle snap to grid"
          className={cn(
            'p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors',
            snapEnabled && 'bg-primary/20 text-primary border border-primary/40',
          )}
          onClick={onToggleSnap}
        >
          <Magnet className="w-5 h-5" />
        </button>
      </StyledTooltip>
      <StyledTooltip content="Toggle grid visibility" side="bottom">
        <button
          data-testid="schematic-tool-grid-visible"
          aria-label="Toggle grid visibility"
          className={cn(
            'p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors',
            gridVisible && 'bg-primary/20 text-primary border border-primary/40',
          )}
          onClick={onToggleGridVisible}
        >
          <Grid3x3 className="w-5 h-5" />
        </button>
      </StyledTooltip>
      {onAngleConstraintChange && (
        <ToggleGroup
          type="single"
          value={angleConstraint}
          onValueChange={(val) => {
            if (val) {
              onAngleConstraintChange(val as AngleConstraint);
            }
          }}
          size="sm"
          data-testid="schematic-angle-constraint"
        >
          <StyledTooltip content="Free angle" side="bottom">
            <ToggleGroupItem
              value="free"
              aria-label="Free angle routing"
              data-testid="angle-free"
              className="px-1.5 py-1 text-xs"
            >
              <Eye className="w-4 h-4" />
            </ToggleGroupItem>
          </StyledTooltip>
          <StyledTooltip content="45 degree" side="bottom">
            <ToggleGroupItem
              value="45"
              aria-label="45 degree angle constraint"
              data-testid="angle-45"
              className="px-1.5 py-1 text-xs font-mono"
            >
              45
            </ToggleGroupItem>
          </StyledTooltip>
          <StyledTooltip content="90 degree" side="bottom">
            <ToggleGroupItem
              value="90"
              aria-label="90 degree angle constraint"
              data-testid="angle-90"
              className="px-1.5 py-1 text-xs font-mono"
            >
              90
            </ToggleGroupItem>
          </StyledTooltip>
        </ToggleGroup>
      )}

      <div className="w-px h-5 bg-border mx-0.5" />
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
});

export default SchematicToolbar;
