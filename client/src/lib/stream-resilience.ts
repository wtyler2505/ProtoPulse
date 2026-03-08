/**
 * stream-resilience.ts — SSE stream fetch with mid-stream reconnection
 *
 * Wraps fetch + getReader() with:
 * - Exponential backoff retry on network failures (both initial and mid-stream)
 * - Heartbeat detection to reset idle timers
 * - "Reconnecting..." state callback for UI indicators
 * - Partial content preservation on final failure
 */

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Default retry configuration */
export interface StreamRetryConfig {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries: number;
  /** Initial retry delay in ms (default: 1000) */
  initialDelayMs: number;
  /** Maximum delay between retries in ms (default: 30000) */
  maxDelayMs: number;
  /** Idle timeout in ms — if no data or heartbeat received (default: 120000) */
  idleTimeoutMs: number;
}

const DEFAULT_RETRY_CONFIG: StreamRetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30_000,
  idleTimeoutMs: 120_000,
};

// ---------------------------------------------------------------------------
// Event types
// ---------------------------------------------------------------------------

/** Callback for SSE data lines (after "data: " prefix is stripped) */
export type OnSSEData = (parsed: unknown) => void;

/** Callback for stream lifecycle events */
export interface StreamLifecycleCallbacks {
  /** Called when a reconnection attempt starts */
  onReconnecting?: (attempt: number, maxRetries: number) => void;
  /** Called when reconnection succeeds */
  onReconnected?: () => void;
  /** Called when all retries are exhausted */
  onRetriesExhausted?: (lastError: Error) => void;
  /** Called on each heartbeat received */
  onHeartbeat?: () => void;
}

// ---------------------------------------------------------------------------
// Core: resilientStreamFetch
// ---------------------------------------------------------------------------

export interface ResilientStreamOptions {
  /** The URL to fetch */
  url: string;
  /** Fetch init options (method, headers, body, etc.) */
  fetchInit: RequestInit;
  /** AbortController signal — caller controls cancellation */
  signal: AbortSignal;
  /** Called for each parsed SSE data event (non-heartbeat) */
  onData: OnSSEData;
  /** Lifecycle callbacks for reconnection state */
  lifecycle?: StreamLifecycleCallbacks;
  /** Retry configuration overrides */
  retryConfig?: Partial<StreamRetryConfig>;
}

export interface ResilientStreamResult {
  /** Whether the stream completed normally (vs. errored/aborted) */
  completed: boolean;
  /** Total number of reconnection attempts that were made */
  reconnectAttempts: number;
}

/**
 * Performs a streaming SSE fetch with automatic retry on mid-stream failures.
 *
 * Retry behavior:
 * - Initial connection failures: retry with exponential backoff
 * - Mid-stream drops (reader throws): retry with exponential backoff
 * - Server errors (non-2xx): NO retry (throw immediately)
 * - AbortError: NO retry (throw immediately)
 * - Heartbeat events reset the idle timeout
 *
 * The caller is responsible for providing an AbortController signal and
 * for managing overall timeout (e.g., a 150s hard cap).
 */
export async function resilientStreamFetch(
  options: ResilientStreamOptions,
): Promise<ResilientStreamResult> {
  const config: StreamRetryConfig = { ...DEFAULT_RETRY_CONFIG, ...options.retryConfig };
  let reconnectAttempts = 0;
  let attempt = 0;

  while (attempt <= config.maxRetries) {
    if (options.signal.aborted) {
      throw new DOMException('The operation was aborted.', 'AbortError');
    }

    try {
      const response = await fetch(options.url, {
        ...options.fetchInit,
        signal: options.signal,
      });

      // Don't retry server errors — they indicate a logic/auth problem, not a network issue
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' })) as { message?: string };
        throw new StreamServerError(
          errorData.message ?? `Server error: ${String(response.status)}`,
          response.status,
        );
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      // If this is a reconnection, notify the caller
      if (attempt > 0) {
        options.lifecycle?.onReconnected?.();
      }

      // Read the stream with idle timeout
      await readStreamWithHeartbeat(reader, config, options);

      // Stream completed normally
      return { completed: true, reconnectAttempts };

    } catch (err: unknown) {
      // Never retry aborts
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw err;
      }
      if (options.signal.aborted) {
        throw new DOMException('The operation was aborted.', 'AbortError');
      }

      // Never retry server errors (4xx, 5xx)
      if (err instanceof StreamServerError) {
        throw err;
      }

      // Network error or mid-stream drop — retry with backoff
      attempt++;
      reconnectAttempts++;

      if (attempt > config.maxRetries) {
        const lastError = err instanceof Error ? err : new Error(String(err));
        options.lifecycle?.onRetriesExhausted?.(lastError);
        throw lastError;
      }

      const delay = Math.min(
        config.initialDelayMs * Math.pow(2, attempt - 1),
        config.maxDelayMs,
      );

      options.lifecycle?.onReconnecting?.(attempt, config.maxRetries);

      await sleep(delay, options.signal);
    }
  }

  // Should not reach here, but satisfy TypeScript
  return { completed: false, reconnectAttempts };
}

// ---------------------------------------------------------------------------
// Internal: stream reader with heartbeat-based idle detection
// ---------------------------------------------------------------------------

async function readStreamWithHeartbeat(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  config: StreamRetryConfig,
  options: ResilientStreamOptions,
): Promise<void> {
  const decoder = new TextDecoder();
  let buffer = '';
  let idleTimer: ReturnType<typeof setTimeout> | undefined;

  const resetIdleTimer = () => {
    if (idleTimer !== undefined) {
      clearTimeout(idleTimer);
    }
    idleTimer = setTimeout(() => {
      // Cancel the reader to trigger a mid-stream retry
      void reader.cancel('idle timeout');
    }, config.idleTimeoutMs);
  };

  resetIdleTimer();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      // Any data from the server resets the idle timer
      resetIdleTimer();

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        // SSE comment heartbeat (":heartbeat")
        if (line.startsWith(':')) {
          options.lifecycle?.onHeartbeat?.();
          continue;
        }

        // SSE data lines
        if (line.startsWith('data: ')) {
          try {
            const parsed: unknown = JSON.parse(line.slice(6));

            // Data-format heartbeat: {"type":"heartbeat"}
            if (
              typeof parsed === 'object' &&
              parsed !== null &&
              'type' in parsed &&
              (parsed as Record<string, unknown>).type === 'heartbeat'
            ) {
              options.lifecycle?.onHeartbeat?.();
              continue;
            }

            options.onData(parsed);
          } catch {
            // Ignore JSON parse errors for malformed lines
          }
        }
      }
    }
  } finally {
    if (idleTimer !== undefined) {
      clearTimeout(idleTimer);
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Custom error for server (non-network) errors — should not be retried */
export class StreamServerError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'StreamServerError';
  }
}

/** Abortable sleep */
function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('The operation was aborted.', 'AbortError'));
      return;
    }

    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);

    function onAbort() {
      clearTimeout(timer);
      reject(new DOMException('The operation was aborted.', 'AbortError'));
    }

    signal.addEventListener('abort', onAbort, { once: true });
  });
}
