import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import {
  AlertTriangle,
  CheckCircle2,
  Cpu,
  HardDrive,
  Loader2,
  RotateCcw,
  Upload,
  Wifi,
  XCircle,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { FlashStage, FlashProgress, FlashDiagnostic } from '@/lib/arduino/flash-diagnostics';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface FlashProgressBarProps {
  /** Current flash progress state. */
  readonly progress: FlashProgress;
  /** Diagnostic information when stage === 'error'. */
  readonly diagnostic?: FlashDiagnostic;
  /** Callback when the user clicks "Retry". */
  readonly onRetry?: () => void;
  /** Callback when the user clicks "Dismiss". */
  readonly onDismiss?: () => void;
  /** Additional CSS classes. */
  readonly className?: string;
}

// ---------------------------------------------------------------------------
// Stage icon mapping
// ---------------------------------------------------------------------------

function StageIcon({ stage, className }: { readonly stage: FlashStage; readonly className?: string }) {
  switch (stage) {
    case 'connecting':
      return <Wifi className={cn('animate-pulse', className)} />;
    case 'erasing':
      return <HardDrive className={cn('animate-pulse', className)} />;
    case 'writing':
      return <Upload className={cn('animate-bounce', className)} />;
    case 'verifying':
      return <Cpu className={cn('animate-pulse', className)} />;
    case 'resetting':
      return <RotateCcw className={cn('animate-spin', className)} />;
    case 'done':
      return <CheckCircle2 className={className} />;
    case 'error':
      return <XCircle className={className} />;
  }
}

// ---------------------------------------------------------------------------
// Stage color mapping
// ---------------------------------------------------------------------------

function getStageColor(stage: FlashStage): string {
  switch (stage) {
    case 'connecting':
      return 'bg-blue-500';
    case 'erasing':
      return 'bg-amber-500';
    case 'writing':
      return 'bg-cyan-500';
    case 'verifying':
      return 'bg-indigo-500';
    case 'resetting':
      return 'bg-purple-500';
    case 'done':
      return 'bg-emerald-500';
    case 'error':
      return 'bg-red-500';
  }
}

function getStageTextColor(stage: FlashStage): string {
  switch (stage) {
    case 'connecting':
      return 'text-blue-400';
    case 'erasing':
      return 'text-amber-400';
    case 'writing':
      return 'text-cyan-400';
    case 'verifying':
      return 'text-indigo-400';
    case 'resetting':
      return 'text-purple-400';
    case 'done':
      return 'text-emerald-400';
    case 'error':
      return 'text-red-400';
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function FlashProgressBar({
  progress,
  diagnostic,
  onRetry,
  onDismiss,
  className,
}: FlashProgressBarProps) {
  const [showRawOutput, setShowRawOutput] = useState(false);

  const handleToggleRaw = useCallback(() => {
    setShowRawOutput((prev) => !prev);
  }, []);

  const isError = progress.stage === 'error';
  const isDone = progress.stage === 'done';
  const isActive = !isError && !isDone;

  return (
    <div
      className={cn(
        'rounded-lg border p-3',
        isError && 'border-red-500/40 bg-red-950/20',
        isDone && 'border-emerald-500/40 bg-emerald-950/20',
        isActive && 'border-border bg-card/50',
        className,
      )}
      data-testid="flash-progress-bar"
    >
      {/* Header: icon + stage label + percentage */}
      <div className="flex items-center gap-2">
        <StageIcon
          stage={progress.stage}
          className={cn('w-4 h-4 shrink-0', getStageTextColor(progress.stage))}
        />
        <span
          className={cn('text-sm font-medium', getStageTextColor(progress.stage))}
          data-testid="flash-stage-label"
        >
          {progress.stageLabel}
        </span>

        {isActive && (
          <span
            className="ml-auto text-xs text-muted-foreground tabular-nums"
            data-testid="flash-percent"
          >
            {progress.percent}%
          </span>
        )}

        {isDone && onDismiss && (
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-6 px-2 text-xs"
            onClick={onDismiss}
            data-testid="flash-dismiss"
          >
            Dismiss
          </Button>
        )}
      </div>

      {/* Progress bar — visible when actively flashing */}
      {isActive && (
        <div className="mt-2 h-2 w-full rounded-full bg-muted/50 overflow-hidden" data-testid="flash-progress-track">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-300 ease-out',
              getStageColor(progress.stage),
            )}
            style={{ width: `${progress.percent}%` }}
            data-testid="flash-progress-fill"
          />
        </div>
      )}

      {/* Bytes info — visible during writing/verifying when totalBytes known */}
      {isActive && progress.totalBytes > 0 && (progress.stage === 'writing' || progress.stage === 'verifying') && (
        <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
          <Zap className="w-3 h-3" />
          <span data-testid="flash-bytes-info">
            {formatBytes(progress.bytesWritten)} / {formatBytes(progress.totalBytes)}
          </span>
        </div>
      )}

      {/* Done bar — 100% green */}
      {isDone && (
        <div className="mt-2 h-2 w-full rounded-full bg-emerald-500" data-testid="flash-progress-complete" />
      )}

      {/* Error state — diagnostic + suggestions + retry */}
      {isError && diagnostic && (
        <div className="mt-2 space-y-2">
          <p className="text-sm text-red-300" data-testid="flash-error-message">
            {diagnostic.message}
          </p>

          {diagnostic.suggestions.length > 0 && (
            <div className="rounded border border-red-500/20 bg-red-950/30 p-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-red-400/70 mb-1">
                Things to try
              </p>
              <ul className="space-y-0.5" data-testid="flash-error-suggestions">
                {diagnostic.suggestions.map((suggestion, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex gap-1.5">
                    <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0 text-amber-500/60" />
                    <span>{suggestion}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex items-center gap-2">
            {diagnostic.isRetryable && onRetry && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1.5 text-xs border-red-500/30 hover:bg-red-950/40"
                onClick={onRetry}
                data-testid="flash-retry-button"
              >
                <Loader2 className="w-3 h-3" />
                Retry Upload
              </Button>
            )}

            {onDismiss && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={onDismiss}
                data-testid="flash-dismiss-error"
              >
                Dismiss
              </Button>
            )}

            {diagnostic.rawOutput && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs ml-auto"
                onClick={handleToggleRaw}
                data-testid="flash-toggle-raw"
              >
                {showRawOutput ? 'Hide' : 'Show'} raw output
              </Button>
            )}
          </div>

          {showRawOutput && diagnostic.rawOutput && (
            <pre
              className="mt-1 max-h-32 overflow-auto rounded bg-black/40 p-2 text-[10px] text-muted-foreground font-mono whitespace-pre-wrap"
              data-testid="flash-raw-output"
            >
              {diagnostic.rawOutput}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
