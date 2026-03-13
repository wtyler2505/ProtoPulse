/**
 * ActionErrorTracker — Tracks failed AI action executions with retry
 * classification, auto-expiry, and FIFO eviction.
 *
 * Singleton + subscribe pattern (useSyncExternalStore compatible).
 * Pure class, no React/DOM dependencies.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Listener = () => void;
type ErrorCallback = (error: ActionError) => void;

export interface ActionError {
  id: string;
  actionId: string;
  toolName: string;
  errorMessage: string;
  timestamp: number;
  retryable: boolean;
  retryCount: number;
  dismissed: boolean;
}

export interface ErrorSummary {
  toolName: string;
  count: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_ERRORS = 50;
const DEFAULT_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

// ---------------------------------------------------------------------------
// Retryable heuristics
// ---------------------------------------------------------------------------

const RETRYABLE_PATTERNS: ReadonlyArray<RegExp> = [
  /network/i,
  /timeout/i,
  /timed?\s*out/i,
  /ECONNREFUSED/,
  /ECONNRESET/,
  /ENOTFOUND/,
  /fetch\s+failed/i,
  /503/,
  /502/,
  /429/,
  /rate\s*limit/i,
  /temporarily\s+unavailable/i,
  /server\s+error/i,
  /ETIMEDOUT/,
  /socket\s+hang\s+up/i,
];

const NOT_RETRYABLE_PATTERNS: ReadonlyArray<RegExp> = [
  /validation/i,
  /invalid/i,
  /permission/i,
  /forbidden/i,
  /unauthorized/i,
  /not\s+found/i,
  /404/,
  /403/,
  /401/,
  /malformed/i,
  /schema/i,
  /type\s+error/i,
  /syntax\s+error/i,
  /missing\s+required/i,
];

// ---------------------------------------------------------------------------
// ActionErrorTracker
// ---------------------------------------------------------------------------

export class ActionErrorTracker {
  private errors: ActionError[] = [];
  private listeners = new Set<Listener>();
  private errorCallbacks = new Set<ErrorCallback>();
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private expiryMs: number;

  private static instance: ActionErrorTracker | null = null;

  private constructor(expiryMs = DEFAULT_EXPIRY_MS) {
    this.expiryMs = expiryMs;
  }

  static getInstance(): ActionErrorTracker {
    if (!ActionErrorTracker.instance) {
      ActionErrorTracker.instance = new ActionErrorTracker();
    }
    return ActionErrorTracker.instance;
  }

  /** Reset singleton — primarily for testing. */
  static resetInstance(): void {
    if (ActionErrorTracker.instance) {
      ActionErrorTracker.instance.destroy();
    }
    ActionErrorTracker.instance = null;
  }

  /**
   * Create a standalone instance (for testing).
   * Does NOT replace the singleton.
   */
  static createInstance(expiryMs = DEFAULT_EXPIRY_MS): ActionErrorTracker {
    return new ActionErrorTracker(expiryMs);
  }

  // -----------------------------------------------------------------------
  // Subscription (useSyncExternalStore compatible)
  // -----------------------------------------------------------------------

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    Array.from(this.listeners).forEach((l) => {
      l();
    });
  }

  // -----------------------------------------------------------------------
  // Error callbacks (for toast integration)
  // -----------------------------------------------------------------------

  onError(callback: ErrorCallback): () => void {
    this.errorCallbacks.add(callback);
    return () => {
      this.errorCallbacks.delete(callback);
    };
  }

  private fireErrorCallbacks(error: ActionError): void {
    Array.from(this.errorCallbacks).forEach((cb) => {
      cb(error);
    });
  }

  // -----------------------------------------------------------------------
  // Core API
  // -----------------------------------------------------------------------

  trackError(actionId: string, toolName: string, error: string | Error): ActionError {
    const errorMessage = typeof error === 'string' ? error : error.message;
    const retryable = this.isRetryable(toolName, errorMessage);
    const actionError: ActionError = {
      id: crypto.randomUUID(),
      actionId,
      toolName,
      errorMessage,
      timestamp: Date.now(),
      retryable,
      retryCount: 0,
      dismissed: false,
    };

    this.errors.push(actionError);

    // FIFO eviction when over limit
    while (this.errors.length > MAX_ERRORS) {
      const evicted = this.errors.shift();
      if (evicted) {
        this.clearTimer(evicted.id);
      }
    }

    // Schedule auto-expiry
    this.scheduleExpiry(actionError.id);

    this.fireErrorCallbacks(actionError);
    this.notify();

    return actionError;
  }

  getErrors(): ActionError[] {
    return this.errors
      .filter((e) => !e.dismissed)
      .slice()
      .reverse();
  }

  getRecentErrors(count: number): ActionError[] {
    return this.getErrors().slice(0, count);
  }

  dismissError(errorId: string): void {
    const error = this.errors.find((e) => e.id === errorId);
    if (error) {
      error.dismissed = true;
      this.clearTimer(errorId);
      this.notify();
    }
  }

  dismissAll(): void {
    let changed = false;
    for (const error of this.errors) {
      if (!error.dismissed) {
        error.dismissed = true;
        this.clearTimer(error.id);
        changed = true;
      }
    }
    if (changed) {
      this.notify();
    }
  }

  markRetried(errorId: string): void {
    const error = this.errors.find((e) => e.id === errorId);
    if (error) {
      error.retryCount += 1;
      this.notify();
    }
  }

  getErrorCount(): number {
    return this.errors.filter((e) => !e.dismissed).length;
  }

  getErrorSummary(): ErrorSummary[] {
    const counts = new Map<string, number>();
    for (const error of this.errors) {
      if (!error.dismissed) {
        counts.set(error.toolName, (counts.get(error.toolName) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries()).map(([toolName, count]) => ({
      toolName,
      count,
    }));
  }

  /**
   * Determine whether a failed action is retryable based on the tool name
   * and error message heuristics.
   *
   * Strategy: check "not retryable" patterns first (validation, permission,
   * etc.) — if matched, return false. Then check "retryable" patterns
   * (network, timeout, etc.) — if matched, return true. Default: false.
   */
  isRetryable(toolName: string, errorMessage: string): boolean {
    const combined = `${toolName} ${errorMessage}`;

    for (const pattern of NOT_RETRYABLE_PATTERNS) {
      if (pattern.test(combined)) {
        return false;
      }
    }

    for (const pattern of RETRYABLE_PATTERNS) {
      if (pattern.test(combined)) {
        return true;
      }
    }

    return false;
  }

  // -----------------------------------------------------------------------
  // Auto-expiry
  // -----------------------------------------------------------------------

  private scheduleExpiry(errorId: string): void {
    const timer = setTimeout(() => {
      this.timers.delete(errorId);
      const error = this.errors.find((e) => e.id === errorId);
      if (error && !error.dismissed) {
        error.dismissed = true;
        this.notify();
      }
    }, this.expiryMs);
    this.timers.set(errorId, timer);
  }

  private clearTimer(errorId: string): void {
    const timer = this.timers.get(errorId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(errorId);
    }
  }

  // -----------------------------------------------------------------------
  // Cleanup
  // -----------------------------------------------------------------------

  destroy(): void {
    Array.from(this.timers.values()).forEach((timer) => {
      clearTimeout(timer);
    });
    this.timers.clear();
    this.errors = [];
    this.listeners.clear();
    this.errorCallbacks.clear();
  }
}
