import { useState, useEffect, useCallback, useRef, memo } from 'react';
import {
  ChevronDown,
  ChevronRight,
  X,
  FileText,
  CheckCircle2,
  AlertCircle,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useExportResults, formatFileSize } from '@/lib/export-results';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Auto-collapse after 30 seconds of inactivity. */
const AUTO_COLLAPSE_MS = 30_000;

// ---------------------------------------------------------------------------
// ExportResultsPanel
// ---------------------------------------------------------------------------

function ExportResultsPanel() {
  const {
    results,
    resultCount,
    totalFileCount,
    totalSize,
    removeResult,
    clearResults,
  } = useExportResults();

  const [isOpen, setIsOpen] = useState(true);
  const [expandedIndices, setExpandedIndices] = useState<Set<number>>(new Set());
  const autoCollapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // -----------------------------------------------------------------------
  // Auto-collapse timer
  // -----------------------------------------------------------------------

  const resetAutoCollapse = useCallback(() => {
    if (autoCollapseTimer.current) {
      clearTimeout(autoCollapseTimer.current);
    }
    autoCollapseTimer.current = setTimeout(() => {
      setIsOpen(false);
    }, AUTO_COLLAPSE_MS);
  }, []);

  // Re-open + reset timer whenever new results come in
  useEffect(() => {
    if (resultCount > 0) {
      setIsOpen(true);
      resetAutoCollapse();
    }
    return () => {
      if (autoCollapseTimer.current) {
        clearTimeout(autoCollapseTimer.current);
      }
    };
  }, [resultCount, resetAutoCollapse]);

  // -----------------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------------

  const handleToggle = useCallback(() => {
    setIsOpen((prev) => !prev);
    resetAutoCollapse();
  }, [resetAutoCollapse]);

  const handleToggleResultExpand = useCallback((index: number) => {
    setExpandedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  const handleDismiss = useCallback(() => {
    clearResults();
    setIsOpen(false);
    setExpandedIndices(new Set());
  }, [clearResults]);

  const handleRemoveResult = useCallback(
    (index: number) => {
      removeResult(index);
      setExpandedIndices((prev) => {
        const next = new Set<number>();
        for (const i of Array.from(prev)) {
          if (i < index) {
            next.add(i);
          } else if (i > index) {
            next.add(i - 1);
          }
          // Skip the removed index
        }
        return next;
      });
    },
    [removeResult],
  );

  // Don't render anything if there are no results
  if (resultCount === 0) {
    return null;
  }

  return (
    <div
      className="border border-border/50 bg-card/30 backdrop-blur"
      data-testid="export-results-panel"
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button
          data-testid="export-results-toggle"
          className="flex items-center gap-2 flex-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors focus-ring"
          onClick={handleToggle}
          aria-expanded={isOpen}
          aria-label={`${isOpen ? 'Collapse' : 'Expand'} export results`}
        >
          {isOpen ? (
            <ChevronDown className="w-3.5 h-3.5 shrink-0" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 shrink-0" />
          )}
          <FileText className="w-3.5 h-3.5 shrink-0 text-primary/70" />
          <span className="flex-1 text-left">Export Results</span>
        </button>
        <Badge
          variant="outline"
          className="text-[10px] font-mono text-muted-foreground border-border pointer-events-none select-none"
          data-testid="export-results-file-count"
        >
          {totalFileCount} file{totalFileCount !== 1 ? 's' : ''}
        </Badge>
        <span
          className="text-[10px] font-mono text-muted-foreground/60"
          data-testid="export-results-total-size"
        >
          {formatFileSize(totalSize)}
        </span>
        <button
          data-testid="export-results-dismiss"
          className="p-1 text-muted-foreground hover:text-destructive transition-colors shrink-0 focus-ring"
          onClick={handleDismiss}
          aria-label="Dismiss export results"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Collapsible content */}
      {isOpen && (
        <div className="border-t border-border/30 divide-y divide-border/20">
          {results.map((result, index) => {
            const isExpanded = expandedIndices.has(index);
            const resultSize = result.files.reduce((sum, f) => sum + f.sizeBytes, 0);

            return (
              <div key={`${result.formatId}-${String(result.timestamp)}`} data-testid={`export-result-${String(index)}`}>
                <div className="flex items-center gap-2 px-3 py-2 group">
                  {/* Expand/collapse for file details */}
                  <button
                    data-testid={`export-result-toggle-${String(index)}`}
                    className="flex items-center gap-2 flex-1 min-w-0 text-left focus-ring"
                    onClick={() => handleToggleResultExpand(index)}
                    aria-expanded={isExpanded}
                    aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${result.formatLabel} export details`}
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-3 h-3 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="w-3 h-3 shrink-0 text-muted-foreground" />
                    )}
                    {result.success ? (
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-green-400" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 text-destructive" />
                    )}
                    <span className="text-xs font-medium text-foreground truncate">
                      {result.formatLabel}
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground/60 shrink-0">
                      {result.files.length} file{result.files.length !== 1 ? 's' : ''}
                    </span>
                  </button>
                  <span
                    className="text-[10px] font-mono text-muted-foreground/60 shrink-0"
                    data-testid={`export-result-size-${String(index)}`}
                  >
                    {formatFileSize(resultSize)}
                  </span>
                  <button
                    data-testid={`export-result-remove-${String(index)}`}
                    className={cn(
                      'p-0.5 text-muted-foreground/40 hover:text-destructive transition-colors shrink-0 focus-ring',
                      'opacity-0 group-hover:opacity-100',
                    )}
                    onClick={() => handleRemoveResult(index)}
                    aria-label={`Remove ${result.formatLabel} export result`}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>

                {/* Expanded file list */}
                {isExpanded && result.files.length > 0 && (
                  <div className="px-3 pb-2 pl-10">
                    {result.files.map((file) => (
                      <div
                        key={file.name}
                        className="flex items-center justify-between py-0.5"
                        data-testid={`export-file-${file.name}`}
                      >
                        <span className="text-[10px] text-muted-foreground font-mono truncate mr-2">
                          {file.name}
                        </span>
                        <span
                          className="text-[10px] text-muted-foreground/50 font-mono shrink-0"
                          data-testid={`file-size-display-${file.name}`}
                        >
                          {formatFileSize(file.sizeBytes)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default memo(ExportResultsPanel);
