import { useState, useRef, useCallback } from 'react';
import { Bot, CheckCircle, AlertCircle, Loader2, ChevronDown, ChevronUp, Play, RotateCcw, Wrench, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { resilientStreamFetch, StreamServerError } from '@/lib/stream-resilience';

// ---------------------------------------------------------------------------
// Types — local definitions to avoid importing server-only modules
// ---------------------------------------------------------------------------

interface AgentToolResult {
  success: boolean;
  message: string;
  data?: unknown;
}

interface AgentSSEEvent {
  step: number;
  type: 'thinking' | 'tool_call' | 'tool_result' | 'text' | 'complete' | 'error';
  message: string;
  toolName?: string;
  result?: AgentToolResult;
  summary?: string;
  stepsUsed?: number;
}

interface StepEntry {
  step: number;
  type: AgentSSEEvent['type'];
  message: string;
  toolName?: string;
  result?: AgentToolResult;
}

interface DesignAgentPanelProps {
  projectId: number;
  apiKey: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DesignAgentPanel({ projectId, apiKey }: DesignAgentPanelProps) {
  const [description, setDescription] = useState('');
  const [maxSteps, setMaxSteps] = useState(8);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [steps, setSteps] = useState<StepEntry[]>([]);
  const [completeSummary, setCompleteSummary] = useState<string | null>(null);
  const [stepsUsed, setStepsUsed] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, []);

  const runAgent = useCallback(async () => {
    if (!description.trim() || isRunning) { return; }

    setIsRunning(true);
    setIsReconnecting(false);
    setReconnectAttempt(0);
    setSteps([]);
    setCompleteSummary(null);
    setStepsUsed(null);
    setError(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await resilientStreamFetch({
        url: `/api/projects/${String(projectId)}/agent`,
        fetchInit: {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Session-Id': localStorage.getItem('protopulse-session-id') ?? '',
          },
          body: JSON.stringify({
            description: description.trim(),
            maxSteps,
            apiKey,
          }),
        },
        signal: controller.signal,
        onData: (parsed) => {
          const event = parsed as AgentSSEEvent;

          if (event.type === 'complete') {
            setCompleteSummary(event.summary ?? 'Design complete');
            setStepsUsed(event.stepsUsed ?? null);
          } else if (event.type === 'error') {
            setError(event.message);
          } else {
            setSteps((prev) => [...prev, {
              step: event.step,
              type: event.type,
              message: event.message,
              toolName: event.toolName,
              result: event.result,
            }]);
          }
          // Auto-scroll
          setTimeout(scrollToBottom, 50);
        },
        lifecycle: {
          onReconnecting: (attempt, maxRetries) => {
            setIsReconnecting(true);
            setReconnectAttempt(attempt);
            setSteps((prev) => [...prev, {
              step: 0,
              type: 'thinking',
              message: `Connection lost. Reconnecting... (attempt ${String(attempt)}/${String(maxRetries)})`,
            }]);
            setTimeout(scrollToBottom, 50);
          },
          onReconnected: () => {
            setIsReconnecting(false);
            setReconnectAttempt(0);
            setSteps((prev) => [...prev, {
              step: 0,
              type: 'text',
              message: 'Reconnected successfully.',
            }]);
            setTimeout(scrollToBottom, 50);
          },
          onRetriesExhausted: (lastError) => {
            setIsReconnecting(false);
            setError(`Connection lost: ${lastError.message}. The partial results above may still be useful.`);
          },
        },
        retryConfig: {
          maxRetries: 3,
          initialDelayMs: 1000,
          maxDelayMs: 30_000,
          idleTimeoutMs: 120_000,
        },
      });
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setError('Agent run cancelled.');
      } else if (err instanceof StreamServerError) {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setIsRunning(false);
      setIsReconnecting(false);
      abortRef.current = null;
    }
  }, [description, maxSteps, isRunning, projectId, apiKey, scrollToBottom]);

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const stepIcon = (type: StepEntry['type']) => {
    switch (type) {
      case 'thinking':
        return <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />;
      case 'tool_call':
        return <Wrench className="w-3.5 h-3.5 text-amber-400" />;
      case 'tool_result':
        return <CheckCircle className="w-3.5 h-3.5 text-green-400" />;
      case 'text':
        return <Bot className="w-3.5 h-3.5 text-primary" />;
      default:
        return <Bot className="w-3.5 h-3.5 text-muted-foreground" />;
    }
  };

  return (
    <div className="flex flex-col gap-3 p-4 h-full overflow-y-auto" data-testid="design-agent-panel">
      <div className="flex items-center gap-2 mb-1">
        <Bot className="w-5 h-5 text-primary" />
        <h3 className="font-display font-bold text-sm tracking-wider">Design Agent</h3>
      </div>

      <textarea
        data-testid="agent-description-input"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Describe your circuit: e.g. 'Arduino-based motor controller with H-bridge, power regulation, and serial debug'"
        className="w-full min-h-[80px] max-h-[160px] bg-muted/30 border border-border text-sm p-3 placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary resize-y"
        disabled={isRunning}
      />

      {/* Advanced settings */}
      <button
        data-testid="agent-advanced-toggle"
        type="button"
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors self-start"
      >
        {showAdvanced ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        Advanced
      </button>

      {showAdvanced && (
        <div className="flex items-center gap-3 text-xs" data-testid="agent-advanced-section">
          <label htmlFor="agent-max-steps" className="text-muted-foreground whitespace-nowrap">Max steps:</label>
          <input
            id="agent-max-steps"
            data-testid="agent-max-steps"
            type="range"
            min={1}
            max={15}
            value={maxSteps}
            onChange={(e) => setMaxSteps(Number(e.target.value))}
            className="flex-1 accent-primary"
            disabled={isRunning}
          />
          <span className="text-foreground font-mono w-5 text-center">{maxSteps}</span>
        </div>
      )}

      {/* Run / Cancel button */}
      <div className="flex gap-2">
        {!isRunning ? (
          <button
            data-testid="agent-run-button"
            type="button"
            onClick={() => { void runAgent(); }}
            disabled={!description.trim() || !apiKey}
            className={cn(
              'flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors',
              'bg-primary text-primary-foreground hover:bg-primary/90',
              'disabled:opacity-50 disabled:cursor-not-allowed',
            )}
          >
            <Play className="w-4 h-4" />
            Run Design Agent
          </button>
        ) : (
          <button
            data-testid="agent-cancel-button"
            type="button"
            onClick={handleCancel}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
          >
            Cancel
          </button>
        )}
      </div>

      {/* Reconnecting indicator */}
      {isReconnecting && (
        <div
          className="flex items-center gap-2 px-3 py-2 border border-amber-500/30 bg-amber-500/10 text-xs text-amber-300"
          data-testid="agent-reconnecting"
        >
          <WifiOff className="w-3.5 h-3.5 animate-pulse" />
          Reconnecting... (attempt {reconnectAttempt}/3)
        </div>
      )}

      {/* Progress log */}
      {steps.length > 0 && (
        <div
          ref={logRef}
          className="flex flex-col gap-1.5 mt-2 max-h-[300px] overflow-y-auto border border-border bg-muted/20 p-2"
          data-testid="agent-progress-log"
        >
          {steps.map((entry, i) => (
            <div key={`${String(entry.step)}-${entry.type}-${String(i)}`} className="flex items-start gap-2 text-xs">
              <div className="mt-0.5 shrink-0">{stepIcon(entry.type)}</div>
              <div className="flex-1 min-w-0">
                <span className="text-muted-foreground">Step {entry.step}</span>
                {entry.toolName && (
                  <span className="ml-1 text-amber-400 font-mono">{entry.toolName}</span>
                )}
                <p className="text-foreground/80 break-words">{entry.message}</p>
              </div>
            </div>
          ))}
          {isRunning && !isReconnecting && (
            <div className="flex items-center gap-2 text-xs text-primary">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Running...
            </div>
          )}
        </div>
      )}

      {/* Complete summary */}
      {completeSummary && (
        <div className="flex items-start gap-2 p-3 border border-green-500/30 bg-green-500/10 text-xs" data-testid="agent-complete">
          <CheckCircle className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-green-300">
              Design complete in {stepsUsed ?? '?'} step{stepsUsed === 1 ? '' : 's'}
            </p>
            <p className="text-foreground/70 mt-1 whitespace-pre-wrap">{completeSummary}</p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 p-3 border border-destructive/30 bg-destructive/10 text-xs" data-testid="agent-error">
          <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-destructive">{error}</p>
            <button
              data-testid="agent-retry-button"
              type="button"
              onClick={() => { setError(null); void runAgent(); }}
              className="flex items-center gap-1 mt-2 text-primary hover:text-primary/80 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              Retry
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
