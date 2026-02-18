import { useMemo } from 'react';
import { AlertTriangle, XCircle, PlayCircle, Eye, EyeOff, Shield } from 'lucide-react';
import type { DRCViolation } from '@shared/component-types';

interface DRCPanelProps {
  violations: DRCViolation[];
  onRunDRC: () => void;
  showOverlays: boolean;
  onToggleOverlays: () => void;
  onHighlight: (shapeIds: string[]) => void;
}

export default function DRCPanel({ violations, onRunDRC, showOverlays, onToggleOverlays, onHighlight }: DRCPanelProps) {
  const grouped = useMemo(() => {
    const errors = violations.filter(v => v.severity === 'error');
    const warnings = violations.filter(v => v.severity === 'warning');
    return { errors, warnings };
  }, [violations]);

  const summary = useMemo(() => {
    const parts: string[] = [];
    if (grouped.errors.length > 0) parts.push(`${grouped.errors.length} error${grouped.errors.length !== 1 ? 's' : ''}`);
    if (grouped.warnings.length > 0) parts.push(`${grouped.warnings.length} warning${grouped.warnings.length !== 1 ? 's' : ''}`);
    return parts.join(', ');
  }, [grouped]);

  const sortedViolations = useMemo(() => [...grouped.errors, ...grouped.warnings], [grouped]);

  return (
    <div
      className="w-60 border-l border-border bg-[#0a0a0a] flex flex-col"
      data-testid="drc-panel"
    >
      <div className="px-3 py-2 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-medium text-foreground">DRC</span>
        </div>
      </div>

      <div className="px-3 py-2 border-b border-border flex flex-col gap-2">
        <button
          data-testid="button-run-drc"
          onClick={onRunDRC}
          className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium bg-[#00F0FF]/10 text-[#00F0FF] hover:bg-[#00F0FF]/20 transition-colors w-full justify-center"
        >
          <PlayCircle className="w-3.5 h-3.5" />
          Run DRC
        </button>
        <button
          data-testid="button-toggle-drc-overlays"
          onClick={onToggleOverlays}
          className="flex items-center gap-1.5 px-2 py-1 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors w-full"
        >
          {showOverlays ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          Show overlays on canvas
        </button>
      </div>

      {summary && (
        <div
          className="px-3 py-1.5 border-b border-border"
          data-testid="drc-summary"
        >
          <span className="text-[10px] text-muted-foreground">{summary}</span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {sortedViolations.length === 0 ? (
          <div className="p-4 text-center text-xs text-muted-foreground">
            No DRC violations found
          </div>
        ) : (
          <div className="py-1">
            {sortedViolations.map(v => (
              <button
                key={v.id}
                data-testid={`drc-violation-${v.id}`}
                onClick={() => onHighlight(v.shapeIds)}
                className="w-full text-left px-3 py-1.5 flex items-start gap-2 hover:bg-muted/50 transition-colors cursor-pointer"
              >
                {v.severity === 'error' ? (
                  <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                )}
                <span className="text-[11px] text-foreground/80 leading-tight">{v.message}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
