import { memo, useCallback } from 'react';
import { History, RotateCcw, Trash2, Clock, FileInput } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StyledTooltip } from '@/components/ui/styled-tooltip';
import { cn } from '@/lib/utils';
import { useImportHistory } from '@/lib/import-history';
import { formatPreviewSummary } from '@/lib/import-preview';
import type { ImportHistoryEntry } from '@/lib/import-history';

// ---------------------------------------------------------------------------
// Format label mapping
// ---------------------------------------------------------------------------

const FORMAT_LABELS: Record<string, string> = {
  'kicad-schematic': 'KiCad',
  'kicad-pcb': 'KiCad PCB',
  'kicad-symbol': 'KiCad Sym',
  'eagle-schematic': 'Eagle',
  'eagle-board': 'Eagle BRD',
  'eagle-library': 'Eagle LBR',
  'altium-schematic': 'Altium',
  'altium-pcb': 'Altium PCB',
  'geda-schematic': 'gEDA',
  'ltspice-schematic': 'LTspice',
  'proteus-schematic': 'Proteus',
  'orcad-schematic': 'OrCAD',
};

function getFormatLabel(format: string): string {
  return FORMAT_LABELS[format] ?? format;
}

// ---------------------------------------------------------------------------
// Timestamp formatting
// ---------------------------------------------------------------------------

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (isNaN(date.getTime())) {
    return 'Unknown';
  }
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHr = Math.floor(diffMs / 3_600_000);
  const diffDay = Math.floor(diffMs / 86_400_000);

  if (diffMin < 1) {
    return 'Just now';
  }
  if (diffMin < 60) {
    return `${String(diffMin)}m ago`;
  }
  if (diffHr < 24) {
    return `${String(diffHr)}h ago`;
  }
  if (diffDay < 7) {
    return `${String(diffDay)}d ago`;
  }
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ImportHistoryPanelProps {
  onRestore?: (entry: ImportHistoryEntry) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function ImportHistoryPanel({ onRestore }: ImportHistoryPanelProps) {
  const { entries, deleteEntry, clear, count } = useImportHistory();

  const handleRestore = useCallback(
    (entry: ImportHistoryEntry) => {
      onRestore?.(entry);
    },
    [onRestore],
  );

  if (count === 0) {
    return (
      <div className="px-3 py-4 text-center" data-testid="import-history-empty">
        <FileInput className="w-5 h-5 mx-auto mb-1.5 text-muted-foreground/40" />
        <p className="text-[10px] text-muted-foreground/60">No import history yet.</p>
        <p className="text-[10px] text-muted-foreground/40 mt-0.5">
          Import a design file to see it here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1" data-testid="import-history-panel">
      {/* Header with clear button */}
      <div className="flex items-center justify-between px-3 py-1">
        <span className="text-[10px] text-muted-foreground/60 font-mono tabular-nums">
          {String(count)} import{count !== 1 ? 's' : ''}
        </span>
        <StyledTooltip content="Clear all import history" side="left">
          <button
            data-testid="import-history-clear"
            className="p-1 text-muted-foreground/50 hover:text-destructive transition-colors focus-ring"
            onClick={clear}
            aria-label="Clear all import history"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </StyledTooltip>
      </div>

      {/* Entry list */}
      <div className="flex flex-col divide-y divide-border/20">
        {entries.map((entry) => (
          <div
            key={entry.id}
            data-testid={`import-history-entry-${entry.id}`}
            className={cn(
              'px-3 py-2 flex flex-col gap-1.5 hover:bg-muted/20 transition-colors group',
            )}
          >
            {/* Top row: filename + format badge */}
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="text-xs font-medium text-foreground truncate flex-1"
                data-testid={`import-history-filename-${entry.id}`}
                title={entry.fileName}
              >
                {entry.fileName}
              </span>
              <Badge
                variant="outline"
                className="text-[9px] font-mono shrink-0 px-1.5 py-0 border-primary/30 text-primary/80"
                data-testid={`import-history-format-${entry.id}`}
              >
                {getFormatLabel(entry.sourceFormat)}
              </Badge>
            </div>

            {/* Diff summary */}
            <p
              className="text-[10px] text-muted-foreground/70 leading-tight line-clamp-2"
              data-testid={`import-history-summary-${entry.id}`}
            >
              {formatPreviewSummary(entry.preview)}
            </p>

            {/* Bottom row: timestamp + actions */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground/50">
                <Clock className="w-3 h-3" />
                <time
                  dateTime={entry.timestamp}
                  data-testid={`import-history-time-${entry.id}`}
                >
                  {formatTimestamp(entry.timestamp)}
                </time>
              </div>

              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <StyledTooltip content="Restore this import" side="left">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-[10px] text-primary hover:text-primary hover:bg-primary/10"
                    data-testid={`import-history-restore-${entry.id}`}
                    onClick={() => handleRestore(entry)}
                    aria-label={`Restore import from ${entry.fileName}`}
                  >
                    <RotateCcw className="w-3 h-3 mr-1" />
                    Restore
                  </Button>
                </StyledTooltip>
                <StyledTooltip content="Remove from history" side="left">
                  <button
                    data-testid={`import-history-delete-${entry.id}`}
                    className="p-1 text-muted-foreground/40 hover:text-destructive transition-colors focus-ring"
                    onClick={() => deleteEntry(entry.id)}
                    aria-label={`Delete import history for ${entry.fileName}`}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </StyledTooltip>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default memo(ImportHistoryPanel);
