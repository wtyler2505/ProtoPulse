import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { JobQueue } from '../job-queue';

import type { JobExecutionContext } from '../job-queue';

// Mock the logger to suppress output during tests
vi.mock('../logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

/** Helper to create a controllable promise for executor mocking. */
function createDeferred<T = unknown>(): { promise: Promise<T>; resolve: (v: T) => void; reject: (e: unknown) => void } {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('JobQueue — tenant scoping', () => {
  let queue: JobQueue;

  beforeEach(() => {
    vi.useFakeTimers();
    queue = new JobQueue({
      concurrency: 3,
      defaultMaxRetries: 0,
      retryBaseMs: 1000,
      retryFactor: 4,
      ttlMs: 3_600_000,
      cleanupIntervalMs: 300_000,
    });
    queue.registerExecutor('ai_analysis', async () => 'done');
    queue.registerExecutor('export_generation', async () => 'exported');
  });

  afterEach(() => {
    queue.shutdown();
    vi.useRealTimers();
  });

  // ===========================================================================
  // projectId / userId on JobRecord
  // ===========================================================================

  describe('submit() with projectId and userId', () => {
    it('stores projectId and userId on the job record', () => {
      const job = queue.submit('ai_analysis', { query: 'test' }, {
        projectId: 42,
        userId: 7,
      });

      expect(job.projectId).toBe(42);
      expect(job.userId).toBe(7);
    });

    it('defaults projectId and userId to null when not provided', () => {
      const job = queue.submit('ai_analysis', { query: 'test' });

      expect(job.projectId).toBeNull();
      expect(job.userId).toBeNull();
    });

    it('persists tenant info in getJob()', () => {
      const submitted = queue.submit('ai_analysis', {}, { projectId: 10, userId: 5 });
      const fetched = queue.getJob(submitted.id);

      expect(fetched).toBeDefined();
      expect(fetched!.projectId).toBe(10);
      expect(fetched!.userId).toBe(5);
    });
  });

  // ===========================================================================
  // listByProject
  // ===========================================================================

  describe('listByProject()', () => {
    it('returns only jobs for the specified project', () => {
      queue.submit('ai_analysis', {}, { projectId: 1, userId: 10 });
      queue.submit('ai_analysis', {}, { projectId: 2, userId: 10 });
      queue.submit('ai_analysis', {}, { projectId: 1, userId: 20 });

      const proj1Jobs = queue.listByProject(1);
      expect(proj1Jobs).toHaveLength(2);
      expect(proj1Jobs.every((j) => j.projectId === 1)).toBe(true);
    });

    it('returns empty array when no jobs match the project', () => {
      queue.submit('ai_analysis', {}, { projectId: 1, userId: 10 });
      const result = queue.listByProject(999);
      expect(result).toHaveLength(0);
    });

    it('does not include jobs with null projectId', () => {
      queue.submit('ai_analysis', {}, { userId: 10 });
      const result = queue.listByProject(0);
      expect(result).toHaveLength(0);
    });

    it('returns snapshots (not references)', () => {
      queue.submit('ai_analysis', {}, { projectId: 5, userId: 1 });
      const jobs = queue.listByProject(5);
      expect(jobs).toHaveLength(1);

      // Mutating the returned object should not affect the queue
      jobs[0].projectId = 999;
      const jobsAgain = queue.listByProject(5);
      expect(jobsAgain).toHaveLength(1);
      expect(jobsAgain[0].projectId).toBe(5);
    });
  });

  // ===========================================================================
  // listByUser
  // ===========================================================================

  describe('listByUser()', () => {
    it('returns only jobs for the specified user', () => {
      queue.submit('ai_analysis', {}, { projectId: 1, userId: 10 });
      queue.submit('ai_analysis', {}, { projectId: 2, userId: 20 });
      queue.submit('export_generation', {}, { projectId: 1, userId: 10 });

      const userJobs = queue.listByUser(10);
      expect(userJobs).toHaveLength(2);
      expect(userJobs.every((j) => j.userId === 10)).toBe(true);
    });

    it('returns empty array when no jobs match the user', () => {
      queue.submit('ai_analysis', {}, { projectId: 1, userId: 10 });
      const result = queue.listByUser(999);
      expect(result).toHaveLength(0);
    });

    it('is sorted by priority desc, then createdAt asc', () => {
      queue.submit('ai_analysis', {}, { projectId: 1, userId: 10, priority: 3 });
      queue.submit('ai_analysis', {}, { projectId: 1, userId: 10, priority: 8 });
      queue.submit('ai_analysis', {}, { projectId: 1, userId: 10, priority: 5 });

      const jobs = queue.listByUser(10);
      expect(jobs).toHaveLength(3);
      expect(jobs[0].priority).toBe(8);
      expect(jobs[1].priority).toBe(5);
      expect(jobs[2].priority).toBe(3);
    });
  });

  // ===========================================================================
  // Cancel with ownership context
  // ===========================================================================

  describe('cancel() respects tenant info', () => {
    it('cancelled job retains its tenant fields', () => {
      const submitted = queue.submit('ai_analysis', {}, { projectId: 1, userId: 10 });
      const cancelled = queue.cancel(submitted.id);

      expect(cancelled).toBeDefined();
      expect(cancelled!.projectId).toBe(1);
      expect(cancelled!.userId).toBe(10);
      expect(cancelled!.status).toBe('cancelled');
    });
  });
});

describe('JobQueue — watchdog timeout', () => {
  let queue: JobQueue;

  beforeEach(() => {
    vi.useFakeTimers();
    queue = new JobQueue({
      concurrency: 3,
      defaultMaxRetries: 0,
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

  it('fails a job that exceeds the default timeout for its type', async () => {
    // ai_analysis default is 300_000ms (5 min)
    const deferred = createDeferred();
    queue.registerExecutor('ai_analysis', () => deferred.promise);

    const failedJobs: unknown[] = [];
    queue.on('job:failed', (job: unknown) => { failedJobs.push(job); });

    const job = queue.submit('ai_analysis', {});

    // Drain executes the job synchronously via microtask
    await vi.advanceTimersByTimeAsync(0);

    // Verify it's running
    const running = queue.getJob(job.id);
    expect(running?.status).toBe('running');

    // Advance past the 300s watchdog
    await vi.advanceTimersByTimeAsync(300_001);

    const timedOut = queue.getJob(job.id);
    expect(timedOut?.status).toBe('failed');
    expect(timedOut?.error).toContain('timed out');
    expect(failedJobs).toHaveLength(1);

    // Clean up so promise doesn't leak
    deferred.resolve('cleanup');
  });

  it('uses custom maxRunTimeMs when provided', async () => {
    const deferred = createDeferred();
    queue.registerExecutor('ai_analysis', () => deferred.promise);

    const failedJobs: unknown[] = [];
    queue.on('job:failed', (job: unknown) => { failedJobs.push(job); });

    const job = queue.submit('ai_analysis', {}, { maxRunTimeMs: 5000 });
    await vi.advanceTimersByTimeAsync(0);

    expect(queue.getJob(job.id)?.status).toBe('running');

    // Should not have timed out at 4s
    await vi.advanceTimersByTimeAsync(4000);
    expect(queue.getJob(job.id)?.status).toBe('running');

    // Should time out at 5s
    await vi.advanceTimersByTimeAsync(1001);
    expect(queue.getJob(job.id)?.status).toBe('failed');
    expect(queue.getJob(job.id)?.error).toContain('5000ms');
    expect(failedJobs).toHaveLength(1);

    deferred.resolve('cleanup');
  });

  it('clears watchdog when job completes before timeout', async () => {
    const deferred = createDeferred();
    queue.registerExecutor('ai_analysis', () => deferred.promise);

    const failedJobs: unknown[] = [];
    queue.on('job:failed', (job: unknown) => { failedJobs.push(job); });

    const job = queue.submit('ai_analysis', {}, { maxRunTimeMs: 10000 });
    await vi.advanceTimersByTimeAsync(0);

    expect(queue.getJob(job.id)?.status).toBe('running');

    // Complete the job before timeout
    deferred.resolve('success');
    await vi.advanceTimersByTimeAsync(0);

    expect(queue.getJob(job.id)?.status).toBe('completed');

    // Advance past the timeout — should NOT trigger failure
    await vi.advanceTimersByTimeAsync(15000);
    expect(queue.getJob(job.id)?.status).toBe('completed');
    expect(failedJobs).toHaveLength(0);
  });

  it('clears watchdog when job is cancelled', async () => {
    const deferred = createDeferred();
    queue.registerExecutor('ai_analysis', () => deferred.promise);

    const failedJobs: unknown[] = [];
    queue.on('job:failed', (job: unknown) => { failedJobs.push(job); });

    const job = queue.submit('ai_analysis', {}, { maxRunTimeMs: 10000 });
    await vi.advanceTimersByTimeAsync(0);

    // Cancel the job
    queue.cancel(job.id);

    // Advance past the timeout — should NOT trigger additional failure
    await vi.advanceTimersByTimeAsync(15000);
    expect(failedJobs).toHaveLength(0);

    deferred.resolve('cleanup');
  });

  it('aborts the signal when watchdog fires', async () => {
    let capturedSignal: AbortSignal | null = null;
    const deferred = createDeferred();
    queue.registerExecutor('ai_analysis', (_payload, ctx: JobExecutionContext) => {
      capturedSignal = ctx.signal;
      return deferred.promise;
    });

    queue.submit('ai_analysis', {}, { maxRunTimeMs: 2000 });
    await vi.advanceTimersByTimeAsync(0);

    expect(capturedSignal).not.toBeNull();
    expect(capturedSignal!.aborted).toBe(false);

    await vi.advanceTimersByTimeAsync(2001);
    expect(capturedSignal!.aborted).toBe(true);

    deferred.resolve('cleanup');
  });

  it('export_generation has a longer default timeout than ai_analysis', async () => {
    const aiDeferred = createDeferred();
    const exportDeferred = createDeferred();

    queue.registerExecutor('ai_analysis', () => aiDeferred.promise);
    queue.registerExecutor('export_generation', () => exportDeferred.promise);

    const aiJob = queue.submit('ai_analysis', {});
    const exportJob = queue.submit('export_generation', {});
    await vi.advanceTimersByTimeAsync(0);

    // After 300s, ai_analysis should timeout but export_generation should still be running
    await vi.advanceTimersByTimeAsync(300_001);

    expect(queue.getJob(aiJob.id)?.status).toBe('failed');
    expect(queue.getJob(exportJob.id)?.status).toBe('running');

    // After 600s total, export_generation should timeout
    await vi.advanceTimersByTimeAsync(300_000);

    expect(queue.getJob(exportJob.id)?.status).toBe('failed');

    aiDeferred.resolve('cleanup');
    exportDeferred.resolve('cleanup');
  });
});

describe('JobQueue — shutdownGraceful', () => {
  let queue: JobQueue;

  beforeEach(() => {
    vi.useFakeTimers();
    queue = new JobQueue({
      concurrency: 3,
      defaultMaxRetries: 0,
      cleanupIntervalMs: 300_000,
    });
  });

  afterEach(() => {
    queue.shutdown();
    vi.useRealTimers();
  });

  it('cancels pending jobs immediately', async () => {
    // Use a queue with concurrency 0 so jobs stay pending (drain never picks them up)
    const zeroQueue = new JobQueue({
      concurrency: 0,
      defaultMaxRetries: 0,
      cleanupIntervalMs: 300_000,
    });
    zeroQueue.registerExecutor('ai_analysis', async () => 'done');

    const job = zeroQueue.submit('ai_analysis', {}, { userId: 1 });
    expect(zeroQueue.getJob(job.id)?.status).toBe('pending');

    const shutdownPromise = zeroQueue.shutdownGraceful(5000);
    await vi.advanceTimersByTimeAsync(0);
    await shutdownPromise;

    expect(zeroQueue.getJob(job.id)?.status).toBe('cancelled');
  });

  it('waits for running jobs up to grace period', async () => {
    const deferred = createDeferred();
    queue.registerExecutor('ai_analysis', () => deferred.promise);

    queue.submit('ai_analysis', {}, { userId: 1 });
    await vi.advanceTimersByTimeAsync(0);

    const shutdownPromise = queue.shutdownGraceful(5000);

    // Complete the job within grace period
    deferred.resolve('done');
    await vi.advanceTimersByTimeAsync(0);

    await shutdownPromise;
    // Should complete without force-cancelling
  });

  it('force-cancels running jobs after grace period expires', async () => {
    const deferred = createDeferred();
    queue.registerExecutor('ai_analysis', () => deferred.promise);

    const job = queue.submit('ai_analysis', {}, { userId: 1, maxRunTimeMs: 999_999 });
    await vi.advanceTimersByTimeAsync(0);

    expect(queue.getJob(job.id)?.status).toBe('running');

    const shutdownPromise = queue.shutdownGraceful(2000);
    await vi.advanceTimersByTimeAsync(2001);
    await shutdownPromise;

    expect(queue.getJob(job.id)?.status).toBe('cancelled');

    deferred.resolve('cleanup');
  });
});
