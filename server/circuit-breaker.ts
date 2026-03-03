import { logger } from './logger';

// ---------------------------------------------------------------------------
// Circuit Breaker — protects against cascading failures from AI providers
// ---------------------------------------------------------------------------

export enum CircuitBreakerState {
  /** Normal operation — requests pass through. */
  CLOSED = 'CLOSED',
  /** Too many failures — requests are rejected immediately. */
  OPEN = 'OPEN',
  /** Cooldown expired — next request is a probe to test recovery. */
  HALF_OPEN = 'HALF_OPEN',
}

export interface CircuitBreakerStatus {
  name: string;
  state: CircuitBreakerState;
  failures: number;
  failureThreshold: number;
  cooldownMs: number;
  lastFailureTime: number;
  nextRetryTime: number | null;
}

export class CircuitBreakerOpenError extends Error {
  public readonly retryAfterMs: number;

  constructor(name: string, retryAfterMs: number) {
    const retrySeconds = Math.ceil(retryAfterMs / 1000);
    super(
      `AI provider temporarily unavailable (circuit breaker open for "${name}"). Retrying in ${retrySeconds}s.`,
    );
    this.name = 'CircuitBreakerOpenError';
    this.retryAfterMs = retryAfterMs;
  }
}

export class CircuitBreaker {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private failures = 0;
  private lastFailureTime = 0;

  constructor(
    private readonly cbName: string,
    private readonly failureThreshold: number = 3,
    private readonly cooldownMs: number = 30_000,
  ) {}

  /**
   * Execute an async function through the circuit breaker.
   *
   * - CLOSED: request passes through. On failure, increment failure count.
   *           If failures reach the threshold, transition to OPEN.
   * - OPEN:   reject immediately with CircuitBreakerOpenError until cooldown expires.
   *           After cooldown, transition to HALF_OPEN.
   * - HALF_OPEN: allow exactly one probe request.
   *             On success → CLOSED. On failure → OPEN (reset cooldown timer).
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitBreakerState.OPEN) {
      const elapsed = Date.now() - this.lastFailureTime;
      if (elapsed >= this.cooldownMs) {
        // Cooldown expired — transition to HALF_OPEN for a probe
        this.state = CircuitBreakerState.HALF_OPEN;
        logger.info('Circuit breaker transitioning to HALF_OPEN', {
          breaker: this.cbName,
        });
      } else {
        const retryAfterMs = this.cooldownMs - elapsed;
        throw new CircuitBreakerOpenError(this.cbName, retryAfterMs);
      }
    }

    try {
      const result = await fn();

      // Success — if we were in HALF_OPEN, fully close the breaker
      if (this.state === CircuitBreakerState.HALF_OPEN) {
        logger.info('Circuit breaker recovered — transitioning to CLOSED', {
          breaker: this.cbName,
        });
        this.state = CircuitBreakerState.CLOSED;
        this.failures = 0;
        this.lastFailureTime = 0;
      } else if (this.state === CircuitBreakerState.CLOSED && this.failures > 0) {
        // Successful request in CLOSED state resets the failure counter
        this.failures = 0;
      }

      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  /** Return the current status for monitoring / diagnostics. */
  getStatus(): CircuitBreakerStatus {
    let nextRetryTime: number | null = null;
    if (this.state === CircuitBreakerState.OPEN) {
      nextRetryTime = this.lastFailureTime + this.cooldownMs;
    }

    return {
      name: this.cbName,
      state: this.state,
      failures: this.failures,
      failureThreshold: this.failureThreshold,
      cooldownMs: this.cooldownMs,
      lastFailureTime: this.lastFailureTime,
      nextRetryTime,
    };
  }

  /** Reset the breaker to its initial CLOSED state (useful for testing). */
  reset(): void {
    this.state = CircuitBreakerState.CLOSED;
    this.failures = 0;
    this.lastFailureTime = 0;
  }

  // -------------------------------------------------------------------------
  // Internal
  // -------------------------------------------------------------------------

  private recordFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      // Probe failed — go back to OPEN
      this.state = CircuitBreakerState.OPEN;
      logger.warn('Circuit breaker probe failed — reopening', {
        breaker: this.cbName,
        failures: this.failures,
      });
    } else if (
      this.state === CircuitBreakerState.CLOSED &&
      this.failures >= this.failureThreshold
    ) {
      // Threshold reached — trip the breaker
      this.state = CircuitBreakerState.OPEN;
      logger.warn('Circuit breaker tripped — transitioning to OPEN', {
        breaker: this.cbName,
        failures: this.failures,
        cooldownMs: this.cooldownMs,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton breakers for AI providers
// ---------------------------------------------------------------------------

const FAILURE_THRESHOLD = parseInt(process.env.CB_FAILURE_THRESHOLD ?? '3', 10);
const COOLDOWN_MS = parseInt(process.env.CB_COOLDOWN_MS ?? '30000', 10);

export const anthropicBreaker = new CircuitBreaker('anthropic', FAILURE_THRESHOLD, COOLDOWN_MS);
export const geminiBreaker = new CircuitBreaker('gemini', FAILURE_THRESHOLD, COOLDOWN_MS);
