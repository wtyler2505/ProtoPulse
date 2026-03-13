import { memo, useMemo, useState, useCallback } from 'react';
import {
  XCircle,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronRight,
  Filter,
  Lightbulb,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { groupByFile, formatDiagnostic } from '@/lib/arduino/cli-error-parser';
import type { CompileDiagnostic, DiagnosticSeverity } from '@/lib/arduino/cli-error-parser';

// ---------------------------------------------------------------------------
// Severity helpers
// ---------------------------------------------------------------------------

type SeverityFilter = 'all' | 'error' | 'warning';

function severityIcon(severity: DiagnosticSeverity, className?: string) {
  switch (severity) {
    case 'error':
      return <XCircle className={cn('w-3.5 h-3.5 text-destructive shrink-0', className)} />;
    case 'warning':
      return <AlertTriangle className={cn('w-3.5 h-3.5 text-yellow-500 shrink-0', className)} />;
    case 'note':
    case 'info':
      return <Info className={cn('w-3.5 h-3.5 text-blue-400 shrink-0', className)} />;
  }
}

function severityOrder(severity: DiagnosticSeverity): number {
  switch (severity) {
    case 'error':
      return 0;
    case 'warning':
      return 1;
    case 'note':
      return 2;
    case 'info':
      return 3;
  }
}

// ---------------------------------------------------------------------------
// File group header — extract just the filename from a path
// ---------------------------------------------------------------------------

function shortFileName(filePath: string): string {
  if (filePath.startsWith('<')) {
    return filePath;
  }
  const parts = filePath.replace(/\\/g, '/').split('/');
  return parts[parts.length - 1] || filePath;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CompileDiagnosticsPanelProps {
  diagnostics: CompileDiagnostic[];
  onClickDiagnostic?: (d: CompileDiagnostic) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const CompileDiagnosticsPanel = memo(function CompileDiagnosticsPanel({
  diagnostics,
  onClickDiagnostic,
}: CompileDiagnosticsPanelProps) {
  const [filter, setFilter] = useState<SeverityFilter>('all');
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(() => new Set());

  // -----------------------------------------------------------------------
  // Derived data
  // -----------------------------------------------------------------------

  const errorCount = useMemo(
    () => diagnostics.filter((d) => d.severity === 'error').length,
    [diagnostics],
  );
  const warningCount = useMemo(
    () => diagnostics.filter((d) => d.severity === 'warning').length,
    [diagnostics],
  );

  const filteredDiagnostics = useMemo(() => {
    if (filter === 'all') {
      return diagnostics;
    }
    return diagnostics.filter((d) => d.severity === filter);
  }, [diagnostics, filter]);

  const grouped = useMemo(() => {
    const fileGroups = groupByFile(filteredDiagnostics);
    // Sort within each group by line number, then by severity
    for (const [, diags] of Array.from(fileGroups.entries())) {
      diags.sort((a, b) => {
        if (a.line !== b.line) {
          return a.line - b.line;
        }
        return severityOrder(a.severity) - severityOrder(b.severity);
      });
    }
    return fileGroups;
  }, [filteredDiagnostics]);

  // Auto-expand all file groups when diagnostics change
  useMemo(() => {
    setExpandedFiles(new Set(Array.from(grouped.keys())));
  }, [grouped]);

  // -----------------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------------

  const toggleFile = useCallback((file: string) => {
    setExpandedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(file)) {
        next.delete(file);
      } else {
        next.add(file);
      }
      return next;
    });
  }, []);

  const handleClick = useCallback(
    (d: CompileDiagnostic) => {
      onClickDiagnostic?.(d);
    },
    [onClickDiagnostic],
  );

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  if (diagnostics.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2 px-4 text-center"
        data-testid="compile-diagnostics-empty"
      >
        <span className="text-[10px]">No compile diagnostics</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-card/40" data-testid="compile-diagnostics-panel">
      {/* Summary bar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0">
        <div className="flex items-center gap-3 flex-1 text-[10px]">
          {errorCount > 0 && (
            <span className="flex items-center gap-1 text-destructive" data-testid="summary-errors">
              <XCircle className="w-3 h-3" />
              {errorCount} error{errorCount !== 1 ? 's' : ''}
            </span>
          )}
          {warningCount > 0 && (
            <span className="flex items-center gap-1 text-yellow-500" data-testid="summary-warnings">
              <AlertTriangle className="w-3 h-3" />
              {warningCount} warning{warningCount !== 1 ? 's' : ''}
            </span>
          )}
          {errorCount === 0 && warningCount === 0 && (
            <span className="text-muted-foreground" data-testid="summary-notes-only">
              {diagnostics.length} note{diagnostics.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Filter buttons */}
        <div className="flex items-center gap-0.5" data-testid="filter-buttons">
          <button
            data-testid="filter-all"
            onClick={() => setFilter('all')}
            className={cn(
              'px-1.5 py-0.5 rounded text-[9px] font-medium transition-colors',
              filter === 'all'
                ? 'bg-primary/20 text-primary'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent/30',
            )}
            aria-label="Show all diagnostics"
            aria-pressed={filter === 'all'}
          >
            All
          </button>
          <button
            data-testid="filter-errors"
            onClick={() => setFilter('error')}
            className={cn(
              'px-1.5 py-0.5 rounded text-[9px] font-medium transition-colors',
              filter === 'error'
                ? 'bg-destructive/20 text-destructive'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent/30',
            )}
            aria-label="Show errors only"
            aria-pressed={filter === 'error'}
          >
            Errors
          </button>
          <button
            data-testid="filter-warnings"
            onClick={() => setFilter('warning')}
            className={cn(
              'px-1.5 py-0.5 rounded text-[9px] font-medium transition-colors',
              filter === 'warning'
                ? 'bg-yellow-500/20 text-yellow-500'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent/30',
            )}
            aria-label="Show warnings only"
            aria-pressed={filter === 'warning'}
          >
            Warnings
          </button>
        </div>
      </div>

      {/* Diagnostics list grouped by file */}
      <div className="flex-1 overflow-y-auto">
        {filteredDiagnostics.length === 0 ? (
          <div className="flex items-center justify-center h-20 text-[10px] text-muted-foreground">
            <Filter className="w-3 h-3 mr-1.5" />
            No {filter === 'error' ? 'errors' : 'warnings'} found
          </div>
        ) : (
          Array.from(grouped.entries()).map(([file, fileDiags]) => (
            <div key={file} data-testid={`file-group-${shortFileName(file)}`}>
              {/* File header */}
              <button
                className="w-full flex items-center gap-1.5 px-3 py-1.5 hover:bg-accent/30 transition-colors text-left border-b border-border/30"
                onClick={() => toggleFile(file)}
                data-testid={`file-toggle-${shortFileName(file)}`}
                aria-expanded={expandedFiles.has(file)}
                aria-label={`Toggle ${shortFileName(file)} diagnostics`}
              >
                {expandedFiles.has(file) ? (
                  <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
                )}
                <span className="text-[10px] font-medium text-foreground flex-1 truncate font-mono">
                  {shortFileName(file)}
                </span>
                <span className="text-[9px] text-muted-foreground tabular-nums">
                  {fileDiags.length}
                </span>
              </button>

              {/* Diagnostic rows */}
              {expandedFiles.has(file) && (
                <div className="ml-3">
                  {fileDiags.map((diag, idx) => (
                    <button
                      key={`${diag.file}:${diag.line}:${diag.column}:${idx}`}
                      className="w-full flex flex-col gap-0.5 px-2 py-1.5 hover:bg-accent/20 transition-colors text-left rounded-sm"
                      onClick={() => handleClick(diag)}
                      data-testid={`diagnostic-row-${idx}`}
                      title={formatDiagnostic(diag)}
                      aria-label={formatDiagnostic(diag)}
                    >
                      {/* Top row: icon + location + message */}
                      <div className="flex items-start gap-1.5">
                        {severityIcon(diag.severity)}
                        <span className="text-[9px] text-muted-foreground font-mono shrink-0 tabular-nums">
                          {diag.line > 0
                            ? diag.column > 0
                              ? `${diag.line}:${diag.column}`
                              : `${diag.line}`
                            : ''}
                        </span>
                        <span className="text-[10px] text-foreground leading-relaxed flex-1 break-words">
                          {diag.message}
                        </span>
                      </div>

                      {/* Hint badge */}
                      {diag.hint && (
                        <div className="flex items-start gap-1 ml-5" data-testid={`hint-${idx}`}>
                          <Lightbulb className="w-3 h-3 text-cyan-400 shrink-0 mt-0.5" />
                          <span className="text-[9px] text-cyan-400/80 leading-relaxed">
                            {diag.hint}
                          </span>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
});

export default CompileDiagnosticsPanel;
