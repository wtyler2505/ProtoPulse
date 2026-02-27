import {
  MousePointer2,
  Move,
  Grid3x3,
  Maximize,
  Cable,
  Zap,
  XCircle,
  Tag,
  Component,
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
}

const tools: {
  id: SchematicTool;
  icon: typeof MousePointer2;
  label: string;
  enabled: boolean;
}[] = [
  { id: 'select', icon: MousePointer2, label: 'Select (V)', enabled: true },
  { id: 'pan', icon: Move, label: 'Pan (H)', enabled: true },
  { id: 'place-component', icon: Component, label: 'Place Component — coming soon', enabled: false },
  { id: 'draw-net', icon: Cable, label: 'Draw Net — drag between pins (W)', enabled: true },
  { id: 'place-power', icon: Zap, label: 'Place Power Symbol — coming soon', enabled: false },
  { id: 'place-no-connect', icon: XCircle, label: 'No Connect — coming soon', enabled: false },
  { id: 'place-label', icon: Tag, label: 'Net Label — coming soon', enabled: false },
];

export default function SchematicToolbar({
  activeTool,
  onToolChange,
  snapEnabled,
  onToggleSnap,
  onFitView,
}: SchematicToolbarProps) {
  return (
    <div
      className="absolute top-4 left-4 z-10 flex items-center gap-1 bg-card/50 backdrop-blur-xl border border-border p-1 shadow-lg"
      data-testid="schematic-toolbar"
    >
      {tools.map((tool) => (
        <StyledTooltip key={tool.id} content={tool.label} side="bottom">
          <button
            data-testid={`schematic-tool-${tool.id}`}
            disabled={!tool.enabled}
            className={cn(
              'p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors',
              activeTool === tool.id && tool.enabled && 'bg-primary/20 text-primary',
              !tool.enabled && 'opacity-40 cursor-not-allowed hover:bg-transparent hover:text-muted-foreground',
            )}
            onClick={() => tool.enabled && onToolChange(tool.id)}
          >
            <tool.icon className="w-4 h-4" />
          </button>
        </StyledTooltip>
      ))}
      <div className="w-px h-5 bg-border mx-0.5" />
      <StyledTooltip content="Toggle grid snap (G)" side="bottom">
        <button
          data-testid="schematic-tool-grid"
          className={cn(
            'p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors',
            snapEnabled && 'bg-primary/20 text-primary',
          )}
          onClick={onToggleSnap}
        >
          <Grid3x3 className="w-4 h-4" />
        </button>
      </StyledTooltip>
      <StyledTooltip content="Fit view (F)" side="bottom">
        <button
          data-testid="schematic-tool-fit"
          className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          onClick={onFitView}
        >
          <Maximize className="w-4 h-4" />
        </button>
      </StyledTooltip>
    </div>
  );
}
