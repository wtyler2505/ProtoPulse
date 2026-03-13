import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ActionErrorTracker } from '../action-error-tracker';
import type { ActionError } from '../action-error-tracker';

describe('ActionErrorTracker', () => {
  let tracker: ActionErrorTracker;

  beforeEach(() => {
    vi.useFakeTimers();
    tracker = ActionErrorTracker.createInstance(5 * 60 * 1000);
  });

  afterEach(() => {
    tracker.destroy();
    ActionErrorTracker.resetInstance();
    vi.useRealTimers();
  });

  // -------------------------------------------------------------------------
  // Singleton pattern
  // -------------------------------------------------------------------------

  describe('singleton', () => {
    it('returns the same instance on repeated calls', () => {
      const a = ActionErrorTracker.getInstance();
      const b = ActionErrorTracker.getInstance();
      expect(a).toBe(b);
    });

    it('returns a fresh instance after resetInstance', () => {
      const a = ActionErrorTracker.getInstance();
      ActionErrorTracker.resetInstance();
      const b = ActionErrorTracker.getInstance();
      expect(a).not.toBe(b);
    });

    it('createInstance returns a separate non-singleton instance', () => {
      const singleton = ActionErrorTracker.getInstance();
      const standalone = ActionErrorTracker.createInstance();
      expect(singleton).not.toBe(standalone);
      standalone.destroy();
    });
  });

  // -------------------------------------------------------------------------
  // subscribe (useSyncExternalStore compatible)
  // -------------------------------------------------------------------------

  describe('subscribe', () => {
    it('notifies listeners on trackError', () => {
      const listener = vi.fn();
      tracker.subscribe(listener);
      tracker.trackError('a1', 'add_node', 'boom');
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('notifies listeners on dismissError', () => {
      const listener = vi.fn();
      const err = tracker.trackError('a1', 'add_node', 'boom');
      tracker.subscribe(listener);
      tracker.dismissError(err.id);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('unsubscribe stops notifications', () => {
      const listener = vi.fn();
      const unsub = tracker.subscribe(listener);
      unsub();
      tracker.trackError('a1', 'add_node', 'boom');
      expect(listener).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // trackError
  // -------------------------------------------------------------------------

  describe('trackError', () => {
    it('creates an error with a unique ID', () => {
      const err = tracker.trackError('a1', 'add_node', 'Something failed');
      expect(err.id).toBeTruthy();
      expect(typeof err.id).toBe('string');
    });

    it('records actionId and toolName', () => {
      const err = tracker.trackError('action-42', 'generate_architecture', 'bad input');
      expect(err.actionId).toBe('action-42');
      expect(err.toolName).toBe('generate_architecture');
    });

    it('records the error message from a string', () => {
      const err = tracker.trackError('a1', 'add_node', 'Something broke');
      expect(err.errorMessage).toBe('Something broke');
    });

    it('records the error message from an Error object', () => {
      const err = tracker.trackError('a1', 'add_node', new Error('Error object'));
      expect(err.errorMessage).toBe('Error object');
    });

    it('sets timestamp to current time', () => {
      vi.setSystemTime(new Date('2026-01-15T10:00:00Z'));
      const err = tracker.trackError('a1', 'add_node', 'fail');
      expect(err.timestamp).toBe(new Date('2026-01-15T10:00:00Z').getTime());
    });

    it('initializes retryCount to 0 and dismissed to false', () => {
      const err = tracker.trackError('a1', 'add_node', 'fail');
      expect(err.retryCount).toBe(0);
      expect(err.dismissed).toBe(false);
    });

    it('determines retryable status based on error message', () => {
      const networkErr = tracker.trackError('a1', 'add_node', 'network timeout');
      expect(networkErr.retryable).toBe(true);

      const validationErr = tracker.trackError('a2', 'add_node', 'validation failed');
      expect(validationErr.retryable).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // getErrors
  // -------------------------------------------------------------------------

  describe('getErrors', () => {
    it('returns empty array initially', () => {
      expect(tracker.getErrors()).toEqual([]);
    });

    it('returns errors newest first', () => {
      vi.setSystemTime(new Date('2026-01-15T10:00:00Z'));
      tracker.trackError('a1', 'tool_a', 'first');
      vi.setSystemTime(new Date('2026-01-15T10:01:00Z'));
      tracker.trackError('a2', 'tool_b', 'second');
      vi.setSystemTime(new Date('2026-01-15T10:02:00Z'));
      tracker.trackError('a3', 'tool_c', 'third');

      const errors = tracker.getErrors();
      expect(errors).toHaveLength(3);
      expect(errors[0].errorMessage).toBe('third');
      expect(errors[1].errorMessage).toBe('second');
      expect(errors[2].errorMessage).toBe('first');
    });

    it('excludes dismissed errors', () => {
      const err1 = tracker.trackError('a1', 'tool_a', 'first');
      tracker.trackError('a2', 'tool_b', 'second');
      tracker.dismissError(err1.id);

      const errors = tracker.getErrors();
      expect(errors).toHaveLength(1);
      expect(errors[0].errorMessage).toBe('second');
    });

    it('returns copies — mutations do not affect internal state', () => {
      tracker.trackError('a1', 'tool_a', 'first');
      const errors1 = tracker.getErrors();
      const errors2 = tracker.getErrors();
      expect(errors1).not.toBe(errors2);
    });

    it('handles multiple dismissed errors correctly', () => {
      const err1 = tracker.trackError('a1', 'tool_a', 'first');
      const err2 = tracker.trackError('a2', 'tool_b', 'second');
      tracker.trackError('a3', 'tool_c', 'third');
      tracker.dismissError(err1.id);
      tracker.dismissError(err2.id);

      const errors = tracker.getErrors();
      expect(errors).toHaveLength(1);
      expect(errors[0].errorMessage).toBe('third');
    });
  });

  // -------------------------------------------------------------------------
  // getRecentErrors
  // -------------------------------------------------------------------------

  describe('getRecentErrors', () => {
    it('returns at most N errors', () => {
      for (let i = 0; i < 10; i++) {
        tracker.trackError(`a${i}`, 'tool', `error ${i}`);
      }
      const recent = tracker.getRecentErrors(3);
      expect(recent).toHaveLength(3);
    });

    it('returns newest first', () => {
      vi.setSystemTime(new Date('2026-01-15T10:00:00Z'));
      tracker.trackError('a1', 'tool', 'oldest');
      vi.setSystemTime(new Date('2026-01-15T10:01:00Z'));
      tracker.trackError('a2', 'tool', 'newest');

      const recent = tracker.getRecentErrors(1);
      expect(recent[0].errorMessage).toBe('newest');
    });

    it('returns all if count exceeds available', () => {
      tracker.trackError('a1', 'tool', 'only one');
      const recent = tracker.getRecentErrors(10);
      expect(recent).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------------
  // dismissError / dismissAll
  // -------------------------------------------------------------------------

  describe('dismissError', () => {
    it('marks a specific error as dismissed', () => {
      const err = tracker.trackError('a1', 'tool', 'fail');
      tracker.dismissError(err.id);
      expect(tracker.getErrors()).toHaveLength(0);
    });

    it('does nothing for non-existent error ID', () => {
      tracker.trackError('a1', 'tool', 'fail');
      tracker.dismissError('non-existent-id');
      expect(tracker.getErrors()).toHaveLength(1);
    });

    it('only dismisses the targeted error', () => {
      const err1 = tracker.trackError('a1', 'tool_a', 'first');
      tracker.trackError('a2', 'tool_b', 'second');
      tracker.dismissError(err1.id);

      const errors = tracker.getErrors();
      expect(errors).toHaveLength(1);
      expect(errors[0].errorMessage).toBe('second');
    });

    it('notifies listeners', () => {
      const err = tracker.trackError('a1', 'tool', 'fail');
      const listener = vi.fn();
      tracker.subscribe(listener);
      tracker.dismissError(err.id);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('does not notify if error ID does not exist', () => {
      const listener = vi.fn();
      tracker.subscribe(listener);
      tracker.dismissError('non-existent');
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('dismissAll', () => {
    it('dismisses all non-dismissed errors', () => {
      tracker.trackError('a1', 'tool_a', 'first');
      tracker.trackError('a2', 'tool_b', 'second');
      tracker.trackError('a3', 'tool_c', 'third');
      tracker.dismissAll();
      expect(tracker.getErrors()).toHaveLength(0);
      expect(tracker.getErrorCount()).toBe(0);
    });

    it('notifies listeners once', () => {
      tracker.trackError('a1', 'tool_a', 'first');
      tracker.trackError('a2', 'tool_b', 'second');
      const listener = vi.fn();
      tracker.subscribe(listener);
      tracker.dismissAll();
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('does not notify if no errors to dismiss', () => {
      const listener = vi.fn();
      tracker.subscribe(listener);
      tracker.dismissAll();
      expect(listener).not.toHaveBeenCalled();
    });

    it('is idempotent — second call does not notify', () => {
      tracker.trackError('a1', 'tool_a', 'first');
      tracker.dismissAll();
      const listener = vi.fn();
      tracker.subscribe(listener);
      tracker.dismissAll();
      expect(listener).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // markRetried
  // -------------------------------------------------------------------------

  describe('markRetried', () => {
    it('increments retryCount by 1', () => {
      const err = tracker.trackError('a1', 'tool', 'network error');
      expect(err.retryCount).toBe(0);
      tracker.markRetried(err.id);
      const errors = tracker.getErrors();
      expect(errors[0].retryCount).toBe(1);
    });

    it('increments on repeated calls', () => {
      const err = tracker.trackError('a1', 'tool', 'network error');
      tracker.markRetried(err.id);
      tracker.markRetried(err.id);
      tracker.markRetried(err.id);
      const errors = tracker.getErrors();
      expect(errors[0].retryCount).toBe(3);
    });

    it('does nothing for non-existent ID', () => {
      tracker.trackError('a1', 'tool', 'fail');
      // Should not throw
      tracker.markRetried('non-existent');
      expect(tracker.getErrors()[0].retryCount).toBe(0);
    });

    it('notifies listeners', () => {
      const err = tracker.trackError('a1', 'tool', 'fail');
      const listener = vi.fn();
      tracker.subscribe(listener);
      tracker.markRetried(err.id);
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // isRetryable
  // -------------------------------------------------------------------------

  describe('isRetryable', () => {
    it('returns true for network errors', () => {
      expect(tracker.isRetryable('add_node', 'Network request failed')).toBe(true);
    });

    it('returns true for timeout errors', () => {
      expect(tracker.isRetryable('generate', 'Request timed out')).toBe(true);
    });

    it('returns true for ECONNREFUSED', () => {
      expect(tracker.isRetryable('tool', 'connect ECONNREFUSED 127.0.0.1:5000')).toBe(true);
    });

    it('returns true for 503 errors', () => {
      expect(tracker.isRetryable('tool', 'HTTP 503 Service Unavailable')).toBe(true);
    });

    it('returns true for rate limit errors', () => {
      expect(tracker.isRetryable('tool', 'Rate limit exceeded')).toBe(true);
    });

    it('returns false for validation errors', () => {
      expect(tracker.isRetryable('add_node', 'Validation error: missing label')).toBe(false);
    });

    it('returns false for permission errors', () => {
      expect(tracker.isRetryable('delete_node', 'Permission denied')).toBe(false);
    });

    it('returns false for 401 Unauthorized', () => {
      expect(tracker.isRetryable('tool', '401 Unauthorized')).toBe(false);
    });

    it('returns false for 403 Forbidden', () => {
      expect(tracker.isRetryable('tool', '403 Forbidden')).toBe(false);
    });

    it('returns false for 404 Not Found', () => {
      expect(tracker.isRetryable('tool', '404 Not found')).toBe(false);
    });

    it('returns false for syntax errors', () => {
      expect(tracker.isRetryable('tool', 'Syntax error in expression')).toBe(false);
    });

    it('returns false for unknown error messages (default)', () => {
      expect(tracker.isRetryable('tool', 'Something completely unknown happened')).toBe(false);
    });

    it('prioritizes not-retryable over retryable when both match', () => {
      // "validation" matches not-retryable, "timeout" matches retryable
      // not-retryable is checked first
      expect(tracker.isRetryable('tool', 'validation timeout error')).toBe(false);
    });

    it('returns true for ETIMEDOUT', () => {
      expect(tracker.isRetryable('tool', 'connect ETIMEDOUT')).toBe(true);
    });

    it('returns true for socket hang up', () => {
      expect(tracker.isRetryable('tool', 'socket hang up')).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // getErrorSummary
  // -------------------------------------------------------------------------

  describe('getErrorSummary', () => {
    it('returns empty array when no errors', () => {
      expect(tracker.getErrorSummary()).toEqual([]);
    });

    it('groups counts by toolName', () => {
      tracker.trackError('a1', 'add_node', 'fail 1');
      tracker.trackError('a2', 'add_node', 'fail 2');
      tracker.trackError('a3', 'delete_node', 'fail 3');

      const summary = tracker.getErrorSummary();
      expect(summary).toHaveLength(2);

      const addNode = summary.find((s) => s.toolName === 'add_node');
      const deleteNode = summary.find((s) => s.toolName === 'delete_node');
      expect(addNode?.count).toBe(2);
      expect(deleteNode?.count).toBe(1);
    });

    it('excludes dismissed errors from summary', () => {
      const err1 = tracker.trackError('a1', 'add_node', 'fail 1');
      tracker.trackError('a2', 'add_node', 'fail 2');
      tracker.dismissError(err1.id);

      const summary = tracker.getErrorSummary();
      const addNode = summary.find((s) => s.toolName === 'add_node');
      expect(addNode?.count).toBe(1);
    });

    it('returns empty array when all errors are dismissed', () => {
      tracker.trackError('a1', 'add_node', 'fail');
      tracker.dismissAll();
      expect(tracker.getErrorSummary()).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // getErrorCount
  // -------------------------------------------------------------------------

  describe('getErrorCount', () => {
    it('returns 0 initially', () => {
      expect(tracker.getErrorCount()).toBe(0);
    });

    it('counts non-dismissed errors', () => {
      tracker.trackError('a1', 'tool_a', 'fail 1');
      tracker.trackError('a2', 'tool_b', 'fail 2');
      expect(tracker.getErrorCount()).toBe(2);
    });

    it('decreases when errors are dismissed', () => {
      const err1 = tracker.trackError('a1', 'tool_a', 'fail 1');
      tracker.trackError('a2', 'tool_b', 'fail 2');
      tracker.dismissError(err1.id);
      expect(tracker.getErrorCount()).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // Auto-expiry
  // -------------------------------------------------------------------------

  describe('auto-expiry', () => {
    it('auto-dismisses errors after expiry time', () => {
      const shortTracker = ActionErrorTracker.createInstance(1000); // 1 second
      shortTracker.trackError('a1', 'tool', 'will expire');
      expect(shortTracker.getErrorCount()).toBe(1);

      vi.advanceTimersByTime(1001);
      expect(shortTracker.getErrorCount()).toBe(0);
      shortTracker.destroy();
    });

    it('does not dismiss before expiry', () => {
      const shortTracker = ActionErrorTracker.createInstance(2000);
      shortTracker.trackError('a1', 'tool', 'still here');

      vi.advanceTimersByTime(1000);
      expect(shortTracker.getErrorCount()).toBe(1);
      shortTracker.destroy();
    });

    it('notifies listeners on auto-expire', () => {
      const shortTracker = ActionErrorTracker.createInstance(1000);
      shortTracker.trackError('a1', 'tool', 'will expire');
      const listener = vi.fn();
      shortTracker.subscribe(listener);

      vi.advanceTimersByTime(1001);
      expect(listener).toHaveBeenCalledTimes(1);
      shortTracker.destroy();
    });

    it('does not fire expiry for already dismissed errors', () => {
      const shortTracker = ActionErrorTracker.createInstance(1000);
      const err = shortTracker.trackError('a1', 'tool', 'dismiss me');
      shortTracker.dismissError(err.id);

      const listener = vi.fn();
      shortTracker.subscribe(listener);
      vi.advanceTimersByTime(1001);
      // Should not fire again — already dismissed and timer cleared
      expect(listener).not.toHaveBeenCalled();
      shortTracker.destroy();
    });
  });

  // -------------------------------------------------------------------------
  // Max errors (FIFO eviction)
  // -------------------------------------------------------------------------

  describe('FIFO eviction', () => {
    it('evicts oldest errors when exceeding 50', () => {
      for (let i = 0; i < 55; i++) {
        tracker.trackError(`a${i}`, 'tool', `error ${i}`);
      }
      // Internal storage should have exactly 50
      const all = tracker.getErrors();
      expect(all).toHaveLength(50);
      // Oldest (error 0-4) should be gone, newest (error 54) should be first
      expect(all[0].errorMessage).toBe('error 54');
      expect(all[49].errorMessage).toBe('error 5');
    });

    it('evicts only the excess', () => {
      for (let i = 0; i < 51; i++) {
        tracker.trackError(`a${i}`, 'tool', `error ${i}`);
      }
      const all = tracker.getErrors();
      expect(all).toHaveLength(50);
      expect(all[49].errorMessage).toBe('error 1');
    });

    it('clears expiry timers for evicted errors', () => {
      const shortTracker = ActionErrorTracker.createInstance(500);
      for (let i = 0; i < 55; i++) {
        shortTracker.trackError(`a${i}`, 'tool', `error ${i}`);
      }
      // Should not throw when evicted timers fire (they shouldn't exist)
      vi.advanceTimersByTime(600);
      // Remaining errors should be auto-expired
      expect(shortTracker.getErrorCount()).toBe(0);
      shortTracker.destroy();
    });
  });

  // -------------------------------------------------------------------------
  // onError callback
  // -------------------------------------------------------------------------

  describe('onError callback', () => {
    it('fires callback when a new error is tracked', () => {
      const cb = vi.fn();
      tracker.onError(cb);
      tracker.trackError('a1', 'add_node', 'boom');
      expect(cb).toHaveBeenCalledTimes(1);
      expect(cb).toHaveBeenCalledWith(
        expect.objectContaining({ toolName: 'add_node', errorMessage: 'boom' }),
      );
    });

    it('fires multiple callbacks', () => {
      const cb1 = vi.fn();
      const cb2 = vi.fn();
      tracker.onError(cb1);
      tracker.onError(cb2);
      tracker.trackError('a1', 'tool', 'fail');
      expect(cb1).toHaveBeenCalledTimes(1);
      expect(cb2).toHaveBeenCalledTimes(1);
    });

    it('unsubscribe stops callback', () => {
      const cb = vi.fn();
      const unsub = tracker.onError(cb);
      unsub();
      tracker.trackError('a1', 'tool', 'fail');
      expect(cb).not.toHaveBeenCalled();
    });

    it('does not fire on dismiss', () => {
      const cb = vi.fn();
      const err = tracker.trackError('a1', 'tool', 'fail');
      tracker.onError(cb);
      tracker.dismissError(err.id);
      expect(cb).not.toHaveBeenCalled();
    });

    it('receives the full ActionError object', () => {
      let received: ActionError | null = null;
      tracker.onError((error) => {
        received = error;
      });
      tracker.trackError('action-99', 'generate_architecture', 'network timeout');
      expect(received).not.toBeNull();
      expect(received!.actionId).toBe('action-99');
      expect(received!.toolName).toBe('generate_architecture');
      expect(received!.retryable).toBe(true);
      expect(received!.retryCount).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------

  describe('edge cases', () => {
    it('handles empty tracker gracefully', () => {
      expect(tracker.getErrors()).toEqual([]);
      expect(tracker.getRecentErrors(5)).toEqual([]);
      expect(tracker.getErrorCount()).toBe(0);
      expect(tracker.getErrorSummary()).toEqual([]);
    });

    it('handles dismiss on empty tracker', () => {
      tracker.dismissAll();
      tracker.dismissError('non-existent');
      expect(tracker.getErrorCount()).toBe(0);
    });

    it('handles markRetried on non-existent error', () => {
      tracker.markRetried('non-existent');
      expect(tracker.getErrorCount()).toBe(0);
    });

    it('handles rapid sequential errors', () => {
      for (let i = 0; i < 20; i++) {
        tracker.trackError(`a${i}`, 'tool', `error ${i}`);
      }
      expect(tracker.getErrorCount()).toBe(20);
      expect(tracker.getErrors()[0].errorMessage).toBe('error 19');
    });

    it('destroy cleans up all state', () => {
      tracker.trackError('a1', 'tool', 'fail');
      const listener = vi.fn();
      tracker.subscribe(listener);
      tracker.destroy();
      // After destroy, getErrors returns empty (errors cleared)
      expect(tracker.getErrors()).toEqual([]);
    });

    it('handles Error objects with empty message', () => {
      const err = tracker.trackError('a1', 'tool', new Error(''));
      expect(err.errorMessage).toBe('');
    });

    it('handles very long error messages', () => {
      const longMsg = 'x'.repeat(10000);
      const err = tracker.trackError('a1', 'tool', longMsg);
      expect(err.errorMessage).toBe(longMsg);
    });
  });
});
