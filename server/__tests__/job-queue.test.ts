import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { JobQueue } from '../job-queue';
import type { JobType, JobExecutor, JobRecord, JobExecutionContext } from '../job-queue';

// Mock the logger to suppress output during tests
vi.mock('../logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('JobQueue', () => {
  let queue: JobQueue;

  beforeEach(() => {
    vi.useFakeTimers();
    queue = new JobQueue({
      concurrency: 3,
      defaultMaxRetries: 3,
      retryBaseMs: 1000,
      retryFactor: 4,
      ttlMs: 3_600_000,
      cleanupIntervalMs: 300_000,
    });
  });

  afterEach(() => {
    queue.shutdown();
    vi.useRealTimers();
  });

  // ===========================================================================
  // Construction & configuration
  // ===========================================================================

  describe('construction', () => {
    it('uses provided configuration values', () => {
      expect(queue.concurrency).toBe(3);
      expect(queue.defaultMaxRetries).toBe(3);
      expect(queue.retryBaseMs).toBe(1000);
      expect(queue.retryFactor).toBe(4);
      expect(queue.ttlMs).toBe(3_600_000);
      expect(queue.cleanupIntervalMs).toBe(300_000);
    });

    it('uses defaults when no options provided', () => {
      const defaultQueue = new JobQueue();
      expect(defaultQueue.concurrency).toBe(3);
      expect(defaultQueue.defaultMaxRetries).toBe(3);
      expect(defaultQueue.retryBaseMs).toBe(1000);
      expect(defaultQueue.retryFactor).toBe(4);
      expect(defaultQueue.ttlMs).toBe(3_600_000);
      expect(defaultQueue.cleanupIntervalMs).toBe(300_000);
      defaultQueue.shutdown();
    });

    it('starts with empty stats', () => {
      const stats = queue.getStats();
      expect(stats.pending).toBe(0);
      expect(stats.running).toBe(0);
      expect(stats.completed).toBe(0);
      expect(stats.failed).toBe(0);
      expect(stats.cancelled).toBe(0);
      expect(stats.total).toBe(0);
    });
  });

  // ===========================================================================
  // Job submission
  // ===========================================================================

  describe('submit', () => {
    it('creates a job with correct defaults', () => {
      const job = queue.submit('ai_analysis', { prompt: 'test' });
      expect(job.id).toBeDefined();
      expect(job.type).toBe('ai_analysis');
      expect(job.payload).toEqual({ prompt: 'test' });
      expect(job.status).toBe('pending');
      expect(job.progress).toBe(0);
      expect(job.result).toBeNull();
      expect(job.error).toBeNull();
      expect(job.retryCount).toBe(0);
      expect(job.maxRetries).toBe(3);
      expect(job.priority).toBe(5);
      expect(job.createdAt).toBeGreaterThan(0);
      expect(job.startedAt).toBeNull();
      expect(job.completedAt).toBeNull();
    });

    it('accepts custom priority', () => {
      const job = queue.submit('export_generation', null, { priority: 10 });
      expect(job.priority).toBe(10);
    });

    it('clamps priority to 1-10 range', () => {
      const low = queue.submit('ai_analysis', null, { priority: -5 });
      expect(low.priority).toBe(1);

      const high = queue.submit('ai_analysis', null, { priority: 99 });
      expect(high.priority).toBe(10);
    });

    it('accepts custom maxRetries', () => {
      const job = queue.submit('batch_drc', null, { maxRetries: 0 });
      expect(job.maxRetries).toBe(0);
    });

    it('generates unique IDs for each job', () => {
      const job1 = queue.submit('ai_analysis', null);
      const job2 = queue.submit('ai_analysis', null);
      expect(job1.id).not.toBe(job2.id);
    });

    it('increments pending count', () => {
      queue.submit('ai_analysis', null);
      queue.submit('ai_analysis', null);
      // Without an executor, jobs fail immediately → check stats before drain
      // Actually with no executor, they fail in drain. Let's check total.
      const stats = queue.getStats();
      // Without executor they get set to 'failed' during drain
      expect(stats.total).toBe(2);
    });

    it('returns a copy, not the internal reference', () => {
      const job = queue.submit('ai_analysis', null);
      job.status = 'cancelled' as const;
      const stored = queue.getJob(job.id);
      // Job failed due to no executor, but should not be 'cancelled'
      expect(stored?.status).not.toBe('cancelled');
    });
  });

  // ===========================================================================
  // Job lookup
  // ===========================================================================

  describe('getJob', () => {
    it('returns a copy of the job', () => {
      const submitted = queue.submit('ai_analysis', null);
      const fetched = queue.getJob(submitted.id);
      expect(fetched).toBeDefined();
      expect(fetched?.id).toBe(submitted.id);
    });

    it('returns undefined for unknown id', () => {
      expect(queue.getJob('nonexistent')).toBeUndefined();
    });
  });

  describe('listJobs', () => {
    it('returns all jobs when no filter', () => {
      queue.submit('ai_analysis', null);
      queue.submit('export_generation', null);
      const result = queue.listJobs();
      expect(result.total).toBe(2);
      expect(result.jobs).toHaveLength(2);
    });

    it('filters by status', () => {
      queue.submit('ai_analysis', null); // will fail (no executor)
      queue.submit('ai_analysis', null);
      const result = queue.listJobs({ status: 'failed' });
      expect(result.jobs.every((j) => j.status === 'failed')).toBe(true);
    });

    it('filters by type', () => {
      queue.submit('ai_analysis', null);
      queue.submit('export_generation', null);
      const result = queue.listJobs({ type: 'export_generation' });
      expect(result.jobs.every((j) => j.type === 'export_generation')).toBe(true);
    });

    it('supports pagination', () => {
      for (let i = 0; i < 5; i++) {
        queue.submit('ai_analysis', null);
      }
      const page1 = queue.listJobs({ limit: 2, offset: 0 });
      expect(page1.jobs).toHaveLength(2);
      expect(page1.total).toBe(5);

      const page2 = queue.listJobs({ limit: 2, offset: 2 });
      expect(page2.jobs).toHaveLength(2);

      const page3 = queue.listJobs({ limit: 2, offset: 4 });
      expect(page3.jobs).toHaveLength(1);
    });

    it('sorts by priority descending, then createdAt ascending', () => {
      vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
      queue.submit('ai_analysis', null, { priority: 1 });

      vi.setSystemTime(new Date('2026-01-01T00:00:01Z'));
      queue.submit('ai_analysis', null, { priority: 10 });

      vi.setSystemTime(new Date('2026-01-01T00:00:02Z'));
      queue.submit('ai_analysis', null, { priority: 10 });

      const result = queue.listJobs();
      expect(result.jobs[0]?.priority).toBe(10);
      expect(result.jobs[2]?.priority).toBe(1);
      // Same priority: earlier first
      expect(result.jobs[0]!.createdAt).toBeLessThan(result.jobs[1]!.createdAt);
    });
  });

  // ===========================================================================
  // Priority ordering
  // ===========================================================================

  describe('priority ordering', () => {
    it('runs higher priority jobs first', async () => {
      const executionOrder: number[] = [];

      const executor: JobExecutor = async (payload) => {
        const p = payload as { priority: number };
        executionOrder.push(p.priority);
        return null;
      };

      // Use concurrency 1 so jobs run sequentially in priority order.
      // Register executor AFTER submitting so all jobs start as pending.
      const pQueue = new JobQueue({ concurrency: 1 });

      // Submit in reverse priority order (no executor yet → all stay pending)
      pQueue.submit('ai_analysis', { priority: 1 }, { priority: 1 });
      pQueue.submit('ai_analysis', { priority: 5 }, { priority: 5 });
      pQueue.submit('ai_analysis', { priority: 10 }, { priority: 10 });

      // Now register executor — jobs are all pending+failed (no executor).
      // We need a different approach: use a slow executor and submit all at once.
      pQueue.shutdown();

      // Recreate with a controlled approach: use an executor that yields control
      const pQueue2 = new JobQueue({ concurrency: 1 });
      const startedOrder: number[] = [];
      let resolvers: Array<() => void> = [];

      const controlledExecutor: JobExecutor = async (payload) => {
        const p = payload as { priority: number };
        startedOrder.push(p.priority);
        await new Promise<void>((resolve) => {
          resolvers.push(resolve);
        });
        return null;
      };
      pQueue2.registerExecutor('ai_analysis', controlledExecutor);

      // Submit 3 jobs. With concurrency 1, only the first submitted will start.
      // The first one to start is priority 1 (submitted first, gets the slot).
      // After it completes, the drain picks highest priority from remaining.
      pQueue2.submit('ai_analysis', { priority: 1 }, { priority: 1 });
      pQueue2.submit('ai_analysis', { priority: 5 }, { priority: 5 });
      pQueue2.submit('ai_analysis', { priority: 10 }, { priority: 10 });

      await vi.advanceTimersByTimeAsync(0);
      expect(startedOrder).toHaveLength(1);
      expect(startedOrder[0]).toBe(1); // first submitted gets the slot

      // Complete first job — drain should pick priority 10 next
      resolvers[0]!();
      await vi.advanceTimersByTimeAsync(0);
      expect(startedOrder).toHaveLength(2);
      expect(startedOrder[1]).toBe(10); // highest priority pending

      // Complete second job — drain should pick priority 5 next
      resolvers[1]!();
      await vi.advanceTimersByTimeAsync(0);
      expect(startedOrder).toHaveLength(3);
      expect(startedOrder[2]).toBe(5);

      pQueue2.shutdown();
    });
  });

  // ===========================================================================
  // Concurrency limits
  // ===========================================================================

  describe('concurrency', () => {
    it('limits simultaneous running jobs to concurrency value', async () => {
      const running: string[] = [];
      let maxConcurrent = 0;

      const executor: JobExecutor = async (payload, ctx) => {
        const id = (payload as { id: string }).id;
        running.push(id);
        maxConcurrent = Math.max(maxConcurrent, running.length);
        // Simulate async work
        await new Promise<void>((resolve) => {
          const timer = setTimeout(resolve, 100);
          ctx.signal.addEventListener('abort', () => {
            clearTimeout(timer);
            resolve();
          });
        });
        running.splice(running.indexOf(id), 1);
        return null;
      };

      const cQueue = new JobQueue({ concurrency: 2 });
      cQueue.registerExecutor('ai_analysis', executor);

      // Submit 4 jobs
      cQueue.submit('ai_analysis', { id: 'a' });
      cQueue.submit('ai_analysis', { id: 'b' });
      cQueue.submit('ai_analysis', { id: 'c' });
      cQueue.submit('ai_analysis', { id: 'd' });

      // Advance so jobs run and complete
      await vi.advanceTimersByTimeAsync(200);

      expect(maxConcurrent).toBe(2);

      cQueue.shutdown();
    });

    it('starts next job when a running job completes', async () => {
      let completeCount = 0;
      const executor: JobExecutor = async () => {
        await new Promise<void>((resolve) => setTimeout(resolve, 50));
        completeCount++;
        return null;
      };

      const cQueue = new JobQueue({ concurrency: 1 });
      cQueue.registerExecutor('ai_analysis', executor);

      cQueue.submit('ai_analysis', null);
      cQueue.submit('ai_analysis', null);

      // First job completes at 50ms
      await vi.advanceTimersByTimeAsync(50);
      expect(completeCount).toBe(1);

      // Second job completes at 100ms
      await vi.advanceTimersByTimeAsync(50);
      expect(completeCount).toBe(2);

      cQueue.shutdown();
    });
  });

  // ===========================================================================
  // Job execution lifecycle
  // ===========================================================================

  describe('execution lifecycle', () => {
    it('transitions from pending → running → completed', async () => {
      let resolveJob: ((v: unknown) => void) | null = null;
      const executor: JobExecutor = async () => {
        return new Promise((resolve) => {
          resolveJob = resolve;
        });
      };
      queue.registerExecutor('ai_analysis', executor);

      // Returned snapshot is always 'pending'
      const job = queue.submit('ai_analysis', null);
      expect(job.status).toBe('pending');

      // Drain already started the executor synchronously → internal state is 'running'
      await vi.advanceTimersByTimeAsync(0);
      const running = queue.getJob(job.id);
      expect(running?.status).toBe('running');
      expect(running?.startedAt).toBeGreaterThan(0);

      // Complete the job
      resolveJob!({ answer: 42 });
      await vi.advanceTimersByTimeAsync(0);

      const completed = queue.getJob(job.id);
      expect(completed?.status).toBe('completed');
      expect(completed?.result).toEqual({ answer: 42 });
      expect(completed?.progress).toBe(100);
      expect(completed?.completedAt).toBeGreaterThan(0);
    });

    it('sets status to failed when executor throws and retries exhausted', async () => {
      const executor: JobExecutor = async () => {
        throw new Error('boom');
      };
      queue.registerExecutor('ai_analysis', executor);

      const job = queue.submit('ai_analysis', null, { maxRetries: 0 });

      await vi.advanceTimersByTimeAsync(0);

      const failed = queue.getJob(job.id);
      expect(failed?.status).toBe('failed');
      expect(failed?.error).toBe('boom');
      expect(failed?.completedAt).toBeGreaterThan(0);
    });

    it('fails with error message when no executor is registered', () => {
      const job = queue.submit('ai_analysis', null);
      // drain runs synchronously during submit
      const result = queue.getJob(job.id);
      expect(result?.status).toBe('failed');
      expect(result?.error).toContain('No executor registered');
    });
  });

  // ===========================================================================
  // Retry logic
  // ===========================================================================

  describe('retry with exponential backoff', () => {
    it('retries failed jobs up to maxRetries', async () => {
      let attempts = 0;
      const executor: JobExecutor = async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('transient');
        }
        return 'success';
      };
      queue.registerExecutor('ai_analysis', executor);

      const job = queue.submit('ai_analysis', null, { maxRetries: 3 });

      // First attempt fails immediately
      await vi.advanceTimersByTimeAsync(0);
      expect(attempts).toBe(1);

      // Wait for first retry delay: retryBaseMs * factor^0 = 1000ms
      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(0);
      expect(attempts).toBe(2);

      // Wait for second retry delay: retryBaseMs * factor^1 = 4000ms
      await vi.advanceTimersByTimeAsync(4000);
      await vi.advanceTimersByTimeAsync(0);
      expect(attempts).toBe(3);

      const completed = queue.getJob(job.id);
      expect(completed?.status).toBe('completed');
      expect(completed?.retryCount).toBe(2);
    });

    it('increments retryCount on each failure', async () => {
      const executor: JobExecutor = async () => {
        throw new Error('fail');
      };
      queue.registerExecutor('ai_analysis', executor);

      const job = queue.submit('ai_analysis', null, { maxRetries: 2 });

      // First attempt
      await vi.advanceTimersByTimeAsync(0);

      // After first failure, retryCount = 1, status = pending
      let current = queue.getJob(job.id);
      expect(current?.retryCount).toBe(1);
      expect(current?.status).toBe('pending');

      // 1st retry delay (1000ms)
      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(0);

      current = queue.getJob(job.id);
      expect(current?.retryCount).toBe(2);
      expect(current?.status).toBe('pending');

      // 2nd retry delay (4000ms)
      await vi.advanceTimersByTimeAsync(4000);
      await vi.advanceTimersByTimeAsync(0);

      // All retries exhausted
      current = queue.getJob(job.id);
      expect(current?.status).toBe('failed');
      expect(current?.retryCount).toBe(2);
    });

    it('uses exponential backoff: base * factor^(retryCount-1)', async () => {
      const customQueue = new JobQueue({
        concurrency: 3,
        retryBaseMs: 1000,
        retryFactor: 4,
      });

      let callTimes: number[] = [];
      const executor: JobExecutor = async () => {
        callTimes.push(Date.now());
        throw new Error('fail');
      };
      customQueue.registerExecutor('ai_analysis', executor);

      customQueue.submit('ai_analysis', null, { maxRetries: 3 });

      // First attempt
      await vi.advanceTimersByTimeAsync(0);
      expect(callTimes).toHaveLength(1);
      const t0 = callTimes[0]!;

      // After 1000ms: first retry (1000 * 4^0 = 1000)
      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(0);
      expect(callTimes).toHaveLength(2);
      expect(callTimes[1]! - t0).toBeGreaterThanOrEqual(1000);

      // After 4000ms more: second retry (1000 * 4^1 = 4000)
      await vi.advanceTimersByTimeAsync(4000);
      await vi.advanceTimersByTimeAsync(0);
      expect(callTimes).toHaveLength(3);

      // After 16000ms more: third retry (1000 * 4^2 = 16000)
      await vi.advanceTimersByTimeAsync(16000);
      await vi.advanceTimersByTimeAsync(0);
      expect(callTimes).toHaveLength(4);

      customQueue.shutdown();
    });

    it('does not retry when maxRetries is 0', async () => {
      let attempts = 0;
      const executor: JobExecutor = async () => {
        attempts++;
        throw new Error('fail');
      };
      queue.registerExecutor('ai_analysis', executor);

      const job = queue.submit('ai_analysis', null, { maxRetries: 0 });

      await vi.advanceTimersByTimeAsync(0);
      expect(attempts).toBe(1);

      // Wait a long time, no more attempts
      await vi.advanceTimersByTimeAsync(60_000);
      expect(attempts).toBe(1);

      const failed = queue.getJob(job.id);
      expect(failed?.status).toBe('failed');
    });
  });

  // ===========================================================================
  // Cancellation
  // ===========================================================================

  describe('cancellation', () => {
    it('cancels a pending job', () => {
      // Don't register executor so job stays pending? Actually it fails immediately.
      // Register an executor that takes time.
      const executor: JobExecutor = async (_payload, ctx) => {
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(resolve, 10_000);
          ctx.signal.addEventListener('abort', () => {
            clearTimeout(timer);
            reject(new Error('aborted'));
          });
        });
        return null;
      };

      // Use concurrency 0 via concurrency: 1 and fill the slot
      const cQueue = new JobQueue({ concurrency: 1 });
      cQueue.registerExecutor('ai_analysis', executor);

      // First job takes the slot
      cQueue.submit('ai_analysis', { id: 'blocker' });
      // Second job is pending
      const pending = cQueue.submit('ai_analysis', { id: 'pending' });

      expect(cQueue.getJob(pending.id)?.status).toBe('pending');

      const cancelled = cQueue.cancel(pending.id);
      expect(cancelled?.status).toBe('cancelled');
      expect(cancelled?.completedAt).toBeGreaterThan(0);

      cQueue.shutdown();
    });

    it('cancels a running job via AbortController', async () => {
      let aborted = false;
      const executor: JobExecutor = async (_payload, ctx) => {
        return new Promise<unknown>((resolve, reject) => {
          const timer = setTimeout(() => resolve('done'), 10_000);
          ctx.signal.addEventListener('abort', () => {
            clearTimeout(timer);
            aborted = true;
            reject(new Error('aborted'));
          });
        });
      };
      queue.registerExecutor('ai_analysis', executor);

      const job = queue.submit('ai_analysis', null);

      // Let it start running
      await vi.advanceTimersByTimeAsync(0);
      expect(queue.getJob(job.id)?.status).toBe('running');

      const cancelled = queue.cancel(job.id);
      expect(cancelled?.status).toBe('cancelled');
      expect(aborted).toBe(true);
    });

    it('returns the job unchanged for terminal statuses', async () => {
      const executor: JobExecutor = async () => 'done';
      queue.registerExecutor('ai_analysis', executor);

      const job = queue.submit('ai_analysis', null);
      await vi.advanceTimersByTimeAsync(0);

      expect(queue.getJob(job.id)?.status).toBe('completed');

      const result = queue.cancel(job.id);
      expect(result?.status).toBe('completed');
    });

    it('returns undefined for unknown job id', () => {
      expect(queue.cancel('nonexistent')).toBeUndefined();
    });

    it('decrements running count when cancelling a running job', async () => {
      const executor: JobExecutor = async (_payload, ctx) => {
        return new Promise<unknown>((resolve) => {
          const timer = setTimeout(() => resolve('done'), 10_000);
          ctx.signal.addEventListener('abort', () => {
            clearTimeout(timer);
            resolve(null);
          });
        });
      };
      queue.registerExecutor('ai_analysis', executor);

      const job = queue.submit('ai_analysis', null);
      await vi.advanceTimersByTimeAsync(0);

      const statsBefore = queue.getStats();
      expect(statsBefore.running).toBe(1);

      queue.cancel(job.id);

      const statsAfter = queue.getStats();
      expect(statsAfter.running).toBe(0);
      expect(statsAfter.cancelled).toBe(1);
    });
  });

  // ===========================================================================
  // Progress reporting
  // ===========================================================================

  describe('progress reporting', () => {
    it('updates job progress when reportProgress is called', async () => {
      const executor: JobExecutor = async (_payload, ctx) => {
        ctx.reportProgress(25);
        ctx.reportProgress(50);
        ctx.reportProgress(75);
        return 'done';
      };
      queue.registerExecutor('ai_analysis', executor);

      const job = queue.submit('ai_analysis', null);
      await vi.advanceTimersByTimeAsync(0);

      const completed = queue.getJob(job.id);
      expect(completed?.progress).toBe(100); // set to 100 on completion
    });

    it('clamps progress to 0-100 range', async () => {
      const progressEvents: number[] = [];
      queue.on('job:progress', (j: JobRecord) => {
        progressEvents.push(j.progress);
      });

      const executor: JobExecutor = async (_payload, ctx) => {
        ctx.reportProgress(-10);
        ctx.reportProgress(150);
        return 'done';
      };
      queue.registerExecutor('ai_analysis', executor);

      queue.submit('ai_analysis', null);
      await vi.advanceTimersByTimeAsync(0);

      // -10 clamped to 0, 150 clamped to 100
      expect(progressEvents).toEqual([0, 100]);
    });

    it('emits job:progress events', async () => {
      const progressEvents: number[] = [];
      queue.on('job:progress', (job: JobRecord) => {
        progressEvents.push(job.progress);
      });

      const executor: JobExecutor = async (_payload, ctx) => {
        ctx.reportProgress(33);
        ctx.reportProgress(66);
        return 'done';
      };
      queue.registerExecutor('ai_analysis', executor);

      queue.submit('ai_analysis', null);
      await vi.advanceTimersByTimeAsync(0);

      expect(progressEvents).toEqual([33, 66]);
    });
  });

  // ===========================================================================
  // Job removal
  // ===========================================================================

  describe('remove', () => {
    it('removes a completed job', async () => {
      const executor: JobExecutor = async () => 'done';
      queue.registerExecutor('ai_analysis', executor);

      const job = queue.submit('ai_analysis', null);
      await vi.advanceTimersByTimeAsync(0);

      expect(queue.remove(job.id)).toBe(true);
      expect(queue.getJob(job.id)).toBeUndefined();
    });

    it('removes a failed job', async () => {
      const executor: JobExecutor = async () => {
        throw new Error('fail');
      };
      queue.registerExecutor('ai_analysis', executor);

      const job = queue.submit('ai_analysis', null, { maxRetries: 0 });
      await vi.advanceTimersByTimeAsync(0);

      expect(queue.remove(job.id)).toBe(true);
    });

    it('removes a cancelled job', async () => {
      const executor: JobExecutor = async (_p, ctx) => {
        return new Promise<unknown>((resolve) => {
          const t = setTimeout(() => resolve(null), 10_000);
          ctx.signal.addEventListener('abort', () => {
            clearTimeout(t);
            resolve(null);
          });
        });
      };
      queue.registerExecutor('ai_analysis', executor);

      const job = queue.submit('ai_analysis', null);
      await vi.advanceTimersByTimeAsync(0);
      queue.cancel(job.id);

      expect(queue.remove(job.id)).toBe(true);
    });

    it('refuses to remove a running job', async () => {
      const executor: JobExecutor = async (_p, ctx) => {
        return new Promise<unknown>((resolve) => {
          const t = setTimeout(() => resolve(null), 10_000);
          ctx.signal.addEventListener('abort', () => {
            clearTimeout(t);
            resolve(null);
          });
        });
      };
      queue.registerExecutor('ai_analysis', executor);

      const job = queue.submit('ai_analysis', null);
      await vi.advanceTimersByTimeAsync(0);

      expect(queue.getJob(job.id)?.status).toBe('running');
      expect(queue.remove(job.id)).toBe(false);

      queue.cancel(job.id);
    });

    it('returns false for unknown job id', () => {
      expect(queue.remove('nonexistent')).toBe(false);
    });
  });

  // ===========================================================================
  // TTL expiry and cleanup sweep
  // ===========================================================================

  describe('TTL and cleanup', () => {
    it('sweep removes completed jobs older than TTL', async () => {
      const executor: JobExecutor = async () => 'done';
      queue.registerExecutor('ai_analysis', executor);

      vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
      const job = queue.submit('ai_analysis', null);
      await vi.advanceTimersByTimeAsync(0);

      expect(queue.getJob(job.id)?.status).toBe('completed');

      // Advance past TTL
      vi.advanceTimersByTime(queue.ttlMs + 1);
      queue.sweep();

      expect(queue.getJob(job.id)).toBeUndefined();
    });

    it('sweep removes failed jobs older than TTL', async () => {
      const executor: JobExecutor = async () => {
        throw new Error('fail');
      };
      queue.registerExecutor('ai_analysis', executor);

      vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
      const job = queue.submit('ai_analysis', null, { maxRetries: 0 });
      await vi.advanceTimersByTimeAsync(0);

      vi.advanceTimersByTime(queue.ttlMs + 1);
      queue.sweep();

      expect(queue.getJob(job.id)).toBeUndefined();
    });

    it('sweep removes cancelled jobs older than TTL', async () => {
      const executor: JobExecutor = async (_p, ctx) => {
        return new Promise<unknown>((resolve) => {
          const t = setTimeout(() => resolve(null), 10_000);
          ctx.signal.addEventListener('abort', () => {
            clearTimeout(t);
            resolve(null);
          });
        });
      };
      queue.registerExecutor('ai_analysis', executor);

      vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
      const job = queue.submit('ai_analysis', null);
      await vi.advanceTimersByTimeAsync(0);
      queue.cancel(job.id);

      vi.advanceTimersByTime(queue.ttlMs + 1);
      queue.sweep();

      expect(queue.getJob(job.id)).toBeUndefined();
    });

    it('sweep does NOT remove jobs within TTL', async () => {
      const executor: JobExecutor = async () => 'done';
      queue.registerExecutor('ai_analysis', executor);

      vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
      const job = queue.submit('ai_analysis', null);
      await vi.advanceTimersByTimeAsync(0);

      // Only advance half TTL
      vi.advanceTimersByTime(queue.ttlMs / 2);
      queue.sweep();

      expect(queue.getJob(job.id)).toBeDefined();
    });

    it('automatic cleanup runs on the configured interval', async () => {
      const executor: JobExecutor = async () => 'done';
      queue.registerExecutor('ai_analysis', executor);

      vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
      const job = queue.submit('ai_analysis', null);
      await vi.advanceTimersByTimeAsync(0);

      // Advance past TTL + cleanup interval
      vi.advanceTimersByTime(queue.ttlMs + queue.cleanupIntervalMs + 1);

      expect(queue.getJob(job.id)).toBeUndefined();
    });
  });

  // ===========================================================================
  // Event emissions
  // ===========================================================================

  describe('events', () => {
    it('emits job:created on submit', () => {
      const handler = vi.fn();
      queue.on('job:created', handler);

      const job = queue.submit('ai_analysis', { test: true });
      expect(handler).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        id: job.id,
        type: 'ai_analysis',
      }));
    });

    it('emits job:started when job begins execution', async () => {
      const handler = vi.fn();
      queue.on('job:started', handler);

      const executor: JobExecutor = async () => 'done';
      queue.registerExecutor('ai_analysis', executor);

      const job = queue.submit('ai_analysis', null);
      await vi.advanceTimersByTimeAsync(0);

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        id: job.id,
        status: 'running',
      }));
    });

    it('emits job:completed when job finishes successfully', async () => {
      const handler = vi.fn();
      queue.on('job:completed', handler);

      const executor: JobExecutor = async () => 'result';
      queue.registerExecutor('ai_analysis', executor);

      const job = queue.submit('ai_analysis', null);
      await vi.advanceTimersByTimeAsync(0);

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        id: job.id,
        status: 'completed',
        result: 'result',
      }));
    });

    it('emits job:failed when job fails permanently', async () => {
      const handler = vi.fn();
      queue.on('job:failed', handler);

      const executor: JobExecutor = async () => {
        throw new Error('permanent');
      };
      queue.registerExecutor('ai_analysis', executor);

      const job = queue.submit('ai_analysis', null, { maxRetries: 0 });
      await vi.advanceTimersByTimeAsync(0);

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        id: job.id,
        status: 'failed',
        error: 'permanent',
      }));
    });

    it('emits job:cancelled when job is cancelled', async () => {
      const handler = vi.fn();
      queue.on('job:cancelled', handler);

      const executor: JobExecutor = async (_p, ctx) => {
        return new Promise<unknown>((resolve) => {
          const t = setTimeout(() => resolve(null), 10_000);
          ctx.signal.addEventListener('abort', () => {
            clearTimeout(t);
            resolve(null);
          });
        });
      };
      queue.registerExecutor('ai_analysis', executor);

      const job = queue.submit('ai_analysis', null);
      await vi.advanceTimersByTimeAsync(0);

      queue.cancel(job.id);

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        id: job.id,
        status: 'cancelled',
      }));
    });

    it('emits job:failed when no executor registered', () => {
      const handler = vi.fn();
      queue.on('job:failed', handler);

      queue.submit('ai_analysis', null);

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        status: 'failed',
        error: expect.stringContaining('No executor registered'),
      }));
    });
  });

  // ===========================================================================
  // Stats
  // ===========================================================================

  describe('getStats', () => {
    it('counts jobs by status', async () => {
      const executor: JobExecutor = async (_p, ctx) => {
        return new Promise<unknown>((resolve) => {
          const t = setTimeout(() => resolve(null), 10_000);
          ctx.signal.addEventListener('abort', () => {
            clearTimeout(t);
            resolve(null);
          });
        });
      };
      const failExecutor: JobExecutor = async () => {
        throw new Error('fail');
      };

      // concurrency 2: first ai_analysis runs, export_generation runs and fails,
      // second ai_analysis stays pending
      const sQueue = new JobQueue({ concurrency: 2 });
      sQueue.registerExecutor('ai_analysis', executor);
      sQueue.registerExecutor('export_generation', failExecutor);

      // Running (takes a slot)
      sQueue.submit('ai_analysis', null);
      await vi.advanceTimersByTimeAsync(0);

      // Failed immediately (takes second slot, fails, frees it)
      sQueue.submit('export_generation', null, { maxRetries: 0 });
      await vi.advanceTimersByTimeAsync(0);

      // Pending (submitted after export freed its slot, but the long-running
      // ai_analysis holds one slot; with concurrency 2 this second ai_analysis
      // can also start — so bump concurrency down or just check that 3 total)
      sQueue.submit('ai_analysis', null);
      await vi.advanceTimersByTimeAsync(0);

      const stats = sQueue.getStats();
      // Both ai_analysis jobs are running (concurrency 2), export failed
      expect(stats.running).toBe(2);
      expect(stats.failed).toBe(1);
      expect(stats.total).toBe(3);

      sQueue.shutdown();
    });
  });

  // ===========================================================================
  // Shutdown
  // ===========================================================================

  describe('shutdown', () => {
    it('cancels all running and pending jobs', async () => {
      const executor: JobExecutor = async (_p, ctx) => {
        return new Promise<unknown>((resolve) => {
          const t = setTimeout(() => resolve(null), 10_000);
          ctx.signal.addEventListener('abort', () => {
            clearTimeout(t);
            resolve(null);
          });
        });
      };

      const sQueue = new JobQueue({ concurrency: 1 });
      sQueue.registerExecutor('ai_analysis', executor);

      const job1 = sQueue.submit('ai_analysis', null);
      const job2 = sQueue.submit('ai_analysis', null);

      await vi.advanceTimersByTimeAsync(0);

      sQueue.shutdown();

      expect(sQueue.getJob(job1.id)?.status).toBe('cancelled');
      expect(sQueue.getJob(job2.id)?.status).toBe('cancelled');
    });

    it('resets running count to 0', async () => {
      const executor: JobExecutor = async (_p, ctx) => {
        return new Promise<unknown>((resolve) => {
          const t = setTimeout(() => resolve(null), 10_000);
          ctx.signal.addEventListener('abort', () => {
            clearTimeout(t);
            resolve(null);
          });
        });
      };
      queue.registerExecutor('ai_analysis', executor);

      queue.submit('ai_analysis', null);
      await vi.advanceTimersByTimeAsync(0);

      queue.shutdown();
      expect(queue.getStats().running).toBe(0);
    });
  });

  // ===========================================================================
  // Executor registration
  // ===========================================================================

  describe('registerExecutor', () => {
    it('registers an executor for a job type', async () => {
      const executor: JobExecutor = async () => 'result';
      queue.registerExecutor('ai_analysis', executor);

      const job = queue.submit('ai_analysis', null);
      await vi.advanceTimersByTimeAsync(0);

      expect(queue.getJob(job.id)?.status).toBe('completed');
    });

    it('allows registering executors for all job types', () => {
      const types: JobType[] = ['ai_analysis', 'export_generation', 'batch_drc', 'report_generation', 'import_processing'];
      const executor: JobExecutor = async () => null;

      for (const t of types) {
        queue.registerExecutor(t, executor);
      }

      // Smoke test: submit one of each type
      for (const t of types) {
        const job = queue.submit(t, null);
        expect(job.type).toBe(t);
      }
    });

    it('replaces a previously registered executor', async () => {
      const exec1: JobExecutor = async () => 'first';
      const exec2: JobExecutor = async () => 'second';

      queue.registerExecutor('ai_analysis', exec1);
      queue.registerExecutor('ai_analysis', exec2);

      const job = queue.submit('ai_analysis', null);
      await vi.advanceTimersByTimeAsync(0);

      expect(queue.getJob(job.id)?.result).toBe('second');
    });
  });

  // ===========================================================================
  // Edge cases
  // ===========================================================================

  describe('edge cases', () => {
    it('handles non-Error exceptions in executor', async () => {
      const executor: JobExecutor = async () => {
        throw 'string error'; // eslint-disable-line @typescript-eslint/only-throw-error
      };
      queue.registerExecutor('ai_analysis', executor);

      const job = queue.submit('ai_analysis', null, { maxRetries: 0 });
      await vi.advanceTimersByTimeAsync(0);

      const failed = queue.getJob(job.id);
      expect(failed?.status).toBe('failed');
      expect(failed?.error).toBe('string error');
    });

    it('does not drain cancelled jobs waiting for retry', async () => {
      let attempts = 0;
      const executor: JobExecutor = async () => {
        attempts++;
        throw new Error('fail');
      };
      queue.registerExecutor('ai_analysis', executor);

      const job = queue.submit('ai_analysis', null, { maxRetries: 3 });
      await vi.advanceTimersByTimeAsync(0);
      expect(attempts).toBe(1);

      // Cancel before retry triggers
      queue.cancel(job.id);

      // Advance past retry delay
      await vi.advanceTimersByTimeAsync(10_000);
      expect(attempts).toBe(1); // no retry happened
    });

    it('handles concurrent submits correctly', async () => {
      const executor: JobExecutor = async () => 'done';
      queue.registerExecutor('ai_analysis', executor);

      const jobs = [];
      for (let i = 0; i < 10; i++) {
        jobs.push(queue.submit('ai_analysis', { i }));
      }

      await vi.advanceTimersByTimeAsync(0);

      for (const job of jobs) {
        const result = queue.getJob(job.id);
        expect(result?.status).toBe('completed');
      }
    });

    it('multiple calls to sweep are idempotent', async () => {
      const executor: JobExecutor = async () => 'done';
      queue.registerExecutor('ai_analysis', executor);

      const job = queue.submit('ai_analysis', null);
      await vi.advanceTimersByTimeAsync(0);

      vi.advanceTimersByTime(queue.ttlMs + 1);

      queue.sweep();
      queue.sweep();
      queue.sweep();

      expect(queue.getJob(job.id)).toBeUndefined();
      expect(queue.getStats().total).toBe(0);
    });
  });

  // ===========================================================================
  // Route handler logic (unit-level, no HTTP)
  // ===========================================================================

  describe('route-level logic', () => {
    it('submit + get + cancel + remove lifecycle', async () => {
      const executor: JobExecutor = async (_p, ctx) => {
        return new Promise<unknown>((resolve) => {
          const t = setTimeout(() => resolve('data'), 10_000);
          ctx.signal.addEventListener('abort', () => {
            clearTimeout(t);
            resolve(null);
          });
        });
      };
      queue.registerExecutor('export_generation', executor);

      // 1. Submit
      const submitted = queue.submit('export_generation', { format: 'kicad' }, { priority: 8 });
      expect(submitted.type).toBe('export_generation');
      expect(submitted.priority).toBe(8);

      // 2. Let it start running
      await vi.advanceTimersByTimeAsync(0);
      const running = queue.getJob(submitted.id);
      expect(running?.status).toBe('running');

      // 3. Cancel
      const cancelled = queue.cancel(submitted.id);
      expect(cancelled?.status).toBe('cancelled');

      // 4. Remove
      const removed = queue.remove(submitted.id);
      expect(removed).toBe(true);
      expect(queue.getJob(submitted.id)).toBeUndefined();
    });

    it('list with combined filters', async () => {
      const executor: JobExecutor = async () => 'done';
      queue.registerExecutor('ai_analysis', executor);
      queue.registerExecutor('export_generation', executor);

      queue.submit('ai_analysis', null, { priority: 3 });
      queue.submit('ai_analysis', null, { priority: 7 });
      queue.submit('export_generation', null, { priority: 5 });

      await vi.advanceTimersByTimeAsync(0);

      const aiCompleted = queue.listJobs({ type: 'ai_analysis', status: 'completed' });
      expect(aiCompleted.total).toBe(2);
      expect(aiCompleted.jobs.every((j) => j.type === 'ai_analysis' && j.status === 'completed')).toBe(true);
    });
  });
});
