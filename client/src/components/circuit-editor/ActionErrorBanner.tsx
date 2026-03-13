import { useState, useSyncExternalStore, useCallback } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ActionErrorTracker } from '@/lib/ai/action-error-tracker';
import type { ActionError } from '@/lib/ai/action-error-tracker';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTimestamp(ts: number): string {
  const date = new Date(ts);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

// ---------------------------------------------------------------------------
// ErrorRow
// ---------------------------------------------------------------------------

interface ErrorRowProps {
  error: ActionError;
  onDismiss: (id: string) => void;
  onRetry: (id: string) => void;
}

function ErrorRow({ error, onDismiss, onRetry }: ErrorRowProps) {
  return (
    <div
      className={cn(
        'flex items-start gap-2 rounded-md border px-3 py-2 text-sm',
        error.retryable
          ? 'border-amber-500/30 bg-amber-950/20'
          : 'border-red-500/30 bg-red-950/20',
      )}
      data-testid="action-error-row"
    >
      <AlertTriangle
        className={cn(
          'mt-0.5 h-4 w-4 shrink-0',
          error.retryable ? 'text-amber-400' : 'text-red-400',
        )}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={cn(
              'shrink-0 text-xs',
              error.retryable
                ? 'border-amber-500/40 text-amber-300'
                : 'border-red-500/40 text-red-300',
            )}
            data-testid="action-error-tool-badge"
          >
            {error.toolName}
          </Badge>
          <span className="text-muted-foreground text-xs">
            {formatTimestamp(error.timestamp)}
          </span>
          {error.retryCount > 0 && (
            <span className="text-muted-foreground text-xs">
              (retried {error.retryCount}x)
            </span>
          )}
        </div>
        <p className="text-foreground/80 mt-1 truncate text-xs">
          {error.errorMessage}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {error.retryable && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-amber-400 hover:text-amber-300"
            onClick={() => { onRetry(error.id); }}
            data-testid="action-error-retry"
            aria-label="Retry action"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-foreground"
          onClick={() => { onDismiss(error.id); }}
          data-testid="action-error-dismiss"
          aria-label="Dismiss error"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ActionErrorBanner
// ---------------------------------------------------------------------------

interface ActionErrorBannerProps {
  /** Maximum number of errors to show in the expanded list. Defaults to 5. */
  maxVisible?: number;
  /** Called when the user clicks Retry on a retryable error. */
  onRetry?: (error: ActionError) => void;
}

export function ActionErrorBanner({ maxVisible = 5, onRetry }: ActionErrorBannerProps) {
  const tracker = ActionErrorTracker.getInstance();

  const subscribe = useCallback(
    (cb: () => void) => tracker.subscribe(cb),
    [tracker],
  );
  const getSnapshot = useCallback(() => tracker.getErrorCount(), [tracker]);

  const errorCount = useSyncExternalStore(subscribe, getSnapshot);
  const [expanded, setExpanded] = useState(false);

  const handleDismiss = useCallback(
    (errorId: string) => {
      tracker.dismissError(errorId);
    },
    [tracker],
  );

  const handleDismissAll = useCallback(() => {
    tracker.dismissAll();
    setExpanded(false);
  }, [tracker]);

  const handleRetry = useCallback(
    (errorId: string) => {
      const errors = tracker.getErrors();
      const error = errors.find((e) => e.id === errorId);
      if (error) {
        tracker.markRetried(errorId);
        onRetry?.(error);
      }
    },
    [tracker, onRetry],
  );

  if (errorCount === 0) {
    return null;
  }

  const errors = tracker.getRecentErrors(maxVisible);

  return (
    <div
      className="border-destructive/30 bg-destructive/5 border-b"
      data-testid="action-error-banner"
    >
      {/* Collapsed header */}
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-red-950/20"
        onClick={() => { setExpanded((prev) => !prev); }}
        data-testid="action-error-toggle"
        aria-expanded={expanded}
        aria-label={`${errorCount} action error${errorCount === 1 ? '' : 's'}`}
      >
        <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
        <span className="text-red-300">
          {errorCount} action{errorCount === 1 ? '' : 's'} failed
        </span>
        <Badge
          variant="destructive"
          className="ml-1 h-5 min-w-[20px] px-1.5 text-xs"
          data-testid="action-error-count"
        >
          {errorCount}
        </Badge>
        <span className="flex-1" />
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {/* Expanded error list */}
      {expanded && (
        <div className="space-y-1.5 px-3 pb-3">
          {errors.map((error) => (
            <ErrorRow
              key={error.id}
              error={error}
              onDismiss={handleDismiss}
              onRetry={handleRetry}
            />
          ))}
          {errorCount > maxVisible && (
            <p className="text-muted-foreground text-center text-xs">
              +{errorCount - maxVisible} more error{errorCount - maxVisible === 1 ? '' : 's'}
            </p>
          )}
          <div className="flex justify-end pt-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-red-400 hover:text-red-300"
              onClick={handleDismissAll}
              data-testid="action-error-dismiss-all"
            >
              Dismiss All
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
