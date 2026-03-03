import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  CircuitBreaker,
  CircuitBreakerState,
  CircuitBreakerOpenError,
} from '../circuit-breaker';

// Mock the logger to suppress output during tests
vi.mock('../logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker;
  const THRESHOLD = 3;
  const COOLDOWN = 10_000;

  beforeEach(() => {
    vi.useFakeTimers();
    breaker = new CircuitBreaker('test-provider', THRESHOLD, COOLDOWN);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ===========================================================================
  // Initial state
  // ===========================================================================

  describe('initial state', () => {
    it('starts in CLOSED state', () => {
      const status = breaker.getStatus();
      expect(status.state).toBe(CircuitBreakerState.CLOSED);
      expect(status.failures).toBe(0);
      expect(status.nextRetryTime).toBeNull();
    });

    it('has correct configuration in status', () => {
      const status = breaker.getStatus();
      expect(status.name).toBe('test-provider');
      expect(status.failureThreshold).toBe(THRESHOLD);
      expect(status.cooldownMs).toBe(COOLDOWN);
    });
  });

  // ===========================================================================
  // CLOSED state
  // ===========================================================================

  describe('CLOSED state', () => {
    it('passes through successful requests', async () => {
      const result = await breaker.execute(() => Promise.resolve('ok'));
      expect(result).toBe('ok');
      expect(breaker.getStatus().state).toBe(CircuitBreakerState.CLOSED);
    });

    it('propagates errors from the wrapped function', async () => {
      await expect(
        breaker.execute(() => Promise.reject(new Error('provider error'))),
      ).rejects.toThrow('provider error');
    });

    it('increments failure count on error', async () => {
      await expect(
        breaker.execute(() => Promise.reject(new Error('fail'))),
      ).rejects.toThrow();
      expect(breaker.getStatus().failures).toBe(1);
    });

    it('stays CLOSED when failures are below threshold', async () => {
      for (let i = 0; i < THRESHOLD - 1; i++) {
        await expect(
          breaker.execute(() => Promise.reject(new Error('fail'))),
        ).rejects.toThrow();
      }
      expect(breaker.getStatus().state).toBe(CircuitBreakerState.CLOSED);
      expect(breaker.getStatus().failures).toBe(THRESHOLD - 1);
    });

    it('resets failure count on a successful request', async () => {
      // Cause one failure
      await expect(
        breaker.execute(() => Promise.reject(new Error('fail'))),
      ).rejects.toThrow();
      expect(breaker.getStatus().failures).toBe(1);

      // Success resets the counter
      await breaker.execute(() => Promise.resolve('ok'));
      expect(breaker.getStatus().failures).toBe(0);
    });
  });

  // ===========================================================================
  // CLOSED → OPEN transition
  // ===========================================================================

  describe('CLOSED → OPEN transition', () => {
    it('transitions to OPEN after reaching failure threshold', async () => {
      for (let i = 0; i < THRESHOLD; i++) {
        await expect(
          breaker.execute(() => Promise.reject(new Error('fail'))),
        ).rejects.toThrow();
      }
      expect(breaker.getStatus().state).toBe(CircuitBreakerState.OPEN);
      expect(breaker.getStatus().failures).toBe(THRESHOLD);
    });

    it('records lastFailureTime on the triggering failure', async () => {
      vi.setSystemTime(new Date('2026-01-15T12:00:00Z'));
      for (let i = 0; i < THRESHOLD; i++) {
        await expect(
          breaker.execute(() => Promise.reject(new Error('fail'))),
        ).rejects.toThrow();
      }
      expect(breaker.getStatus().lastFailureTime).toBe(
        new Date('2026-01-15T12:00:00Z').getTime(),
      );
    });

    it('reports nextRetryTime when OPEN', async () => {
      vi.setSystemTime(new Date('2026-01-15T12:00:00Z'));
      for (let i = 0; i < THRESHOLD; i++) {
        await expect(
          breaker.execute(() => Promise.reject(new Error('fail'))),
        ).rejects.toThrow();
      }
      const status = breaker.getStatus();
      expect(status.nextRetryTime).toBe(
        new Date('2026-01-15T12:00:00Z').getTime() + COOLDOWN,
      );
    });
  });

  // ===========================================================================
  // OPEN state — requests rejected
  // ===========================================================================

  describe('OPEN state', () => {
    beforeEach(async () => {
      // Trip the breaker
      for (let i = 0; i < THRESHOLD; i++) {
        await expect(
          breaker.execute(() => Promise.reject(new Error('fail'))),
        ).rejects.toThrow('fail');
      }
      expect(breaker.getStatus().state).toBe(CircuitBreakerState.OPEN);
    });

    it('rejects requests immediately with CircuitBreakerOpenError', async () => {
      await expect(
        breaker.execute(() => Promise.resolve('should not reach')),
      ).rejects.toThrow(CircuitBreakerOpenError);
    });

    it('includes retry information in the error', async () => {
      try {
        await breaker.execute(() => Promise.resolve('nope'));
        expect.fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(CircuitBreakerOpenError);
        const cbErr = err as CircuitBreakerOpenError;
        expect(cbErr.retryAfterMs).toBeGreaterThan(0);
        expect(cbErr.retryAfterMs).toBeLessThanOrEqual(COOLDOWN);
        expect(cbErr.message).toContain('circuit breaker open');
        expect(cbErr.message).toContain('test-provider');
      }
    });

    it('does not call the wrapped function when OPEN', async () => {
      const fn = vi.fn().mockResolvedValue('nope');
      await expect(breaker.execute(fn)).rejects.toThrow(CircuitBreakerOpenError);
      expect(fn).not.toHaveBeenCalled();
    });

    it('rejects concurrent requests during OPEN state', async () => {
      const results = await Promise.allSettled([
        breaker.execute(() => Promise.resolve(1)),
        breaker.execute(() => Promise.resolve(2)),
        breaker.execute(() => Promise.resolve(3)),
      ]);

      for (const result of results) {
        expect(result.status).toBe('rejected');
        if (result.status === 'rejected') {
          expect(result.reason).toBeInstanceOf(CircuitBreakerOpenError);
        }
      }
    });
  });

  // ===========================================================================
  // OPEN → HALF_OPEN after cooldown
  // ===========================================================================

  describe('OPEN → HALF_OPEN after cooldown', () => {
    beforeEach(async () => {
      vi.setSystemTime(new Date('2026-01-15T12:00:00Z'));
      for (let i = 0; i < THRESHOLD; i++) {
        await expect(
          breaker.execute(() => Promise.reject(new Error('fail'))),
        ).rejects.toThrow();
      }
    });

    it('transitions to HALF_OPEN after cooldown expires', async () => {
      vi.advanceTimersByTime(COOLDOWN);

      // The next execute call should attempt the probe (HALF_OPEN)
      // If it succeeds, the breaker closes
      const result = await breaker.execute(() => Promise.resolve('recovered'));
      expect(result).toBe('recovered');
      expect(breaker.getStatus().state).toBe(CircuitBreakerState.CLOSED);
    });

    it('still rejects requests before cooldown expires', async () => {
      vi.advanceTimersByTime(COOLDOWN - 1);
      await expect(
        breaker.execute(() => Promise.resolve('too early')),
      ).rejects.toThrow(CircuitBreakerOpenError);
    });
  });

  // ===========================================================================
  // HALF_OPEN → CLOSED on success
  // ===========================================================================

  describe('HALF_OPEN → CLOSED on success', () => {
    beforeEach(async () => {
      vi.setSystemTime(new Date('2026-01-15T12:00:00Z'));
      for (let i = 0; i < THRESHOLD; i++) {
        await expect(
          breaker.execute(() => Promise.reject(new Error('fail'))),
        ).rejects.toThrow();
      }
      vi.advanceTimersByTime(COOLDOWN);
    });

    it('transitions to CLOSED on successful probe', async () => {
      await breaker.execute(() => Promise.resolve('ok'));
      const status = breaker.getStatus();
      expect(status.state).toBe(CircuitBreakerState.CLOSED);
      expect(status.failures).toBe(0);
      expect(status.lastFailureTime).toBe(0);
    });

    it('allows normal traffic after recovery', async () => {
      await breaker.execute(() => Promise.resolve('probe'));

      // Subsequent requests should work fine
      const result = await breaker.execute(() => Promise.resolve('normal'));
      expect(result).toBe('normal');
    });
  });

  // ===========================================================================
  // HALF_OPEN → OPEN on failure
  // ===========================================================================

  describe('HALF_OPEN → OPEN on failure', () => {
    beforeEach(async () => {
      vi.setSystemTime(new Date('2026-01-15T12:00:00Z'));
      for (let i = 0; i < THRESHOLD; i++) {
        await expect(
          breaker.execute(() => Promise.reject(new Error('fail'))),
        ).rejects.toThrow();
      }
      vi.advanceTimersByTime(COOLDOWN);
    });

    it('transitions back to OPEN if probe fails', async () => {
      await expect(
        breaker.execute(() => Promise.reject(new Error('still broken'))),
      ).rejects.toThrow('still broken');

      expect(breaker.getStatus().state).toBe(CircuitBreakerState.OPEN);
    });

    it('rejects subsequent requests after failed probe', async () => {
      vi.setSystemTime(new Date('2026-01-15T12:00:10.001Z')); // past original cooldown

      await expect(
        breaker.execute(() => Promise.reject(new Error('still broken'))),
      ).rejects.toThrow('still broken');

      // Should be OPEN again — immediate rejects
      await expect(
        breaker.execute(() => Promise.resolve('nope')),
      ).rejects.toThrow(CircuitBreakerOpenError);
    });

    it('requires another full cooldown after failed probe', async () => {
      vi.setSystemTime(new Date('2026-01-15T12:00:10.001Z'));

      await expect(
        breaker.execute(() => Promise.reject(new Error('still broken'))),
      ).rejects.toThrow('still broken');

      // Advance by cooldown from the failed probe time
      vi.advanceTimersByTime(COOLDOWN);

      // Now should allow a new probe
      const result = await breaker.execute(() => Promise.resolve('finally recovered'));
      expect(result).toBe('finally recovered');
      expect(breaker.getStatus().state).toBe(CircuitBreakerState.CLOSED);
    });
  });

  // ===========================================================================
  // reset()
  // ===========================================================================

  describe('reset()', () => {
    it('resets an OPEN breaker back to CLOSED', async () => {
      for (let i = 0; i < THRESHOLD; i++) {
        await expect(
          breaker.execute(() => Promise.reject(new Error('fail'))),
        ).rejects.toThrow();
      }
      expect(breaker.getStatus().state).toBe(CircuitBreakerState.OPEN);

      breaker.reset();
      const status = breaker.getStatus();
      expect(status.state).toBe(CircuitBreakerState.CLOSED);
      expect(status.failures).toBe(0);
      expect(status.lastFailureTime).toBe(0);
    });

    it('allows requests to pass through after reset', async () => {
      for (let i = 0; i < THRESHOLD; i++) {
        await expect(
          breaker.execute(() => Promise.reject(new Error('fail'))),
        ).rejects.toThrow();
      }
      breaker.reset();
      const result = await breaker.execute(() => Promise.resolve('ok'));
      expect(result).toBe('ok');
    });
  });

  // ===========================================================================
  // CircuitBreakerOpenError
  // ===========================================================================

  describe('CircuitBreakerOpenError', () => {
    it('has descriptive message with provider name', () => {
      const err = new CircuitBreakerOpenError('anthropic', 15_000);
      expect(err.message).toContain('anthropic');
      expect(err.message).toContain('15s');
      expect(err.name).toBe('CircuitBreakerOpenError');
    });

    it('carries retryAfterMs', () => {
      const err = new CircuitBreakerOpenError('gemini', 5_000);
      expect(err.retryAfterMs).toBe(5_000);
    });

    it('is an instance of Error', () => {
      const err = new CircuitBreakerOpenError('test', 1000);
      expect(err).toBeInstanceOf(Error);
    });
  });
});
