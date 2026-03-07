/**
 * In-process async job queue for long-running AI/export tasks.
 *
 * Provides priority-based scheduling, configurable concurrency, retries with
 * exponential backoff, cancellation via AbortController, progress reporting,
 * TTL-based auto-cleanup, tenant scoping (projectId/userId), per-job watchdog
 * timeout, and an EventEmitter interface.
 *
 * All state is held in memory — no database dependency. One singleton instance
 * is exported for use across the server.
 */

import { EventEmitter } from 'events';
import { logger } from './logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type JobType =
  | 'ai_analysis'
  | 'export_generation'
  | 'batch_drc'
  | 'report_generation'
  | 'import_processing';

export type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface JobRecord {
  id: string;
  type: JobType;
  payload: unknown;
  status: JobStatus;
  progress: number;
  result: unknown;
  error: string | null;
  createdAt: number;
  startedAt: number | null;
  completedAt: number | null;
  retryCount: number;
  maxRetries: number;
  priority: number;
  projectId: number | null;
  userId: number | null;
}

export type JobEventType =
  | 'job:created'
  | 'job:started'
  | 'job:progress'
  | 'job:completed'
  | 'job:failed'
  | 'job:cancelled';

export interface JobExecutor {
  (payload: unknown, context: JobExecutionContext): Promise<unknown>;
}

export interface JobExecutionContext {
  signal: AbortSignal;
  reportProgress: (pct: number) => void;
}

export interface SubmitOptions {
  priority?: number;
  maxRetries?: number;
  projectId?: number;
  userId?: number;
  maxRunTimeMs?: number;
}

export interface JobQueueOptions {
  /** Maximum number of concurrently running jobs. Default 3. */
  concurrency?: number;
  /** Default max retries per job. Default 3. */
  defaultMaxRetries?: number;
  /** Base delay (ms) for exponential backoff. Default 1000. */
  retryBaseMs?: number;
  /** Multiplier for exponential backoff. Default 4. */
  retryFactor?: number;
  /** TTL (ms) for completed/failed/cancelled jobs before auto-cleanup. Default 3600000 (1h). */
  ttlMs?: number;
  /** Interval (ms) between cleanup sweeps. Default 300000 (5min). */
  cleanupIntervalMs?: number;
}

// ---------------------------------------------------------------------------
// Default watchdog timeouts per job type
// ---------------------------------------------------------------------------

const DEFAULT_MAX_RUN_TIME: Record<JobType, number> = {
  ai_analysis: 300_000,
  export_generation: 600_000,
  batch_drc: 300_000,
  report_generation: 600_000,
  import_processing: 300_000,
};

// ---------------------------------------------------------------------------
// JobQueue
// ---------------------------------------------------------------------------

export class JobQueue extends EventEmitter {
  private jobs = new Map<string, JobRecord>();
  private abortControllers = new Map<string, AbortController>();
  private executors = new Map<JobType, JobExecutor>();
  private runningCount = 0;
  private jobTimeoutMs = new Map<string, number>();
  private watchdogTimers = new Map<string, ReturnType<typeof setTimeout>>();

  readonly concurrency: number;
  readonly defaultMaxRetries: number;
  readonly retryBaseMs: number;
  readonly retryFactor: number;
  readonly ttlMs: number;
  readonly cleanupIntervalMs: number;

  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(options: JobQueueOptions = {}) {
    super();
    this.concurrency = options.concurrency ?? 3;
    this.defaultMaxRetries = options.defaultMaxRetries ?? 3;
    this.retryBaseMs = options.retryBaseMs ?? 1000;
    this.retryFactor = options.retryFactor ?? 4;
    this.ttlMs = options.ttlMs ?? 3_600_000;
    this.cleanupIntervalMs = options.cleanupIntervalMs ?? 300_000;

    this.startCleanupSweep();
  }

  // ---- Executor registration ------------------------------------------------

  registerExecutor(type: JobType, executor: JobExecutor): void {
    this.executors.set(type, executor);
  }

  // ---- Job submission -------------------------------------------------------

  submit(type: JobType, payload: unknown, options?: SubmitOptions): JobRecord {
    const id = crypto.randomUUID();
    const now = Date.now();

    const job: JobRecord = {
      id,
      type,
      payload,
      status: 'pending',
      progress: 0,
      result: null,
      error: null,
      createdAt: now,
      startedAt: null,
      completedAt: null,
      retryCount: 0,
      maxRetries: options?.maxRetries ?? this.defaultMaxRetries,
      priority: Math.min(10, Math.max(1, options?.priority ?? 5)),
      projectId: options?.projectId ?? null,
      userId: options?.userId ?? null,
    };

    // Store per-job timeout if provided (used by watchdog in executeJob)
    if (options?.maxRunTimeMs !== undefined) {
      this.jobTimeoutMs.set(id, options.maxRunTimeMs);
    }

    this.jobs.set(id, job);
    this.emit('job:created', job);
    logger.info('job-queue:created', { jobId: id, type, priority: job.priority });

    // Snapshot before drain so callers always see the job in 'pending' state.
    const snapshot = { ...job };
    this.drain();
    return snapshot;
  }

  // ---- Job lookup -----------------------------------------------------------

  getJob(id: string): JobRecord | undefined {
    const job = this.jobs.get(id);
    return job ? { ...job } : undefined;
  }

  listJobs(filters?: {
    status?: JobStatus;
    type?: JobType;
    limit?: number;
    offset?: number;
  }): { jobs: JobRecord[]; total: number } {
    let result = Array.from(this.jobs.values());

    if (filters?.status) {
      result = result.filter((j) => j.status === filters.status);
    }
    if (filters?.type) {
      result = result.filter((j) => j.type === filters.type);
    }

    const total = result.length;

    // Sort by priority desc, then createdAt asc
    result.sort((a, b) => b.priority - a.priority || a.createdAt - b.createdAt);

    const offset = filters?.offset ?? 0;
    const limit = filters?.limit ?? 50;
    result = result.slice(offset, offset + limit);

    return { jobs: result.map((j) => ({ ...j })), total };
  }

  // ---- Tenant-scoped queries ------------------------------------------------

  listByProject(projectId: number): JobRecord[] {
    return Array.from(this.jobs.values())
      .filter((j) => j.projectId === projectId)
      .map((j) => ({ ...j }))
      .sort((a, b) => b.priority - a.priority || a.createdAt - b.createdAt);
  }

  listByUser(userId: number): JobRecord[] {
    return Array.from(this.jobs.values())
      .filter((j) => j.userId === userId)
      .map((j) => ({ ...j }))
      .sort((a, b) => b.priority - a.priority || a.createdAt - b.createdAt);
  }

  // ---- Cancellation ---------------------------------------------------------

  cancel(id: string): JobRecord | undefined {
    const job = this.jobs.get(id);
    if (!job) {
      return undefined;
    }

    if (job.status !== 'pending' && job.status !== 'running') {
      return { ...job };
    }

    const wasRunning = job.status === 'running';

    job.status = 'cancelled';
    job.completedAt = Date.now();

    // Abort the running task
    const controller = this.abortControllers.get(id);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(id);
    }

    // Clear watchdog timer
    this.clearWatchdog(id);

    if (wasRunning) {
      this.runningCount--;
    }

    this.emit('job:cancelled', { ...job });
    logger.info('job-queue:cancelled', { jobId: id });

    // A slot freed up — try draining
    this.drain();
    return { ...job };
  }

  // ---- Deletion -------------------------------------------------------------

  remove(id: string): boolean {
    const job = this.jobs.get(id);
    if (!job) {
      return false;
    }

    // Only allow removal of terminal jobs
    if (job.status === 'pending' || job.status === 'running') {
      return false;
    }

    this.jobs.delete(id);
    this.abortControllers.delete(id);
    this.jobTimeoutMs.delete(id);
    return true;
  }

  // ---- Stats ----------------------------------------------------------------

  getStats(): { pending: number; running: number; completed: number; failed: number; cancelled: number; total: number } {
    let pending = 0;
    let running = 0;
    let completed = 0;
    let failed = 0;
    let cancelled = 0;

    const allJobs = Array.from(this.jobs.values());
    for (const job of allJobs) {
      switch (job.status) {
        case 'pending': pending++; break;
        case 'running': running++; break;
        case 'completed': completed++; break;
        case 'failed': failed++; break;
        case 'cancelled': cancelled++; break;
      }
    }

    return { pending, running, completed, failed, cancelled, total: this.jobs.size };
  }

  // ---- Shutdown -------------------------------------------------------------

  shutdown(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    // Clear all watchdog timers
    Array.from(this.watchdogTimers.values()).forEach((timer) => {
      clearTimeout(timer);
    });
    this.watchdogTimers.clear();
    this.jobTimeoutMs.clear();

    // Cancel all running and pending jobs
    const allJobs = Array.from(this.jobs.values());
    for (const job of allJobs) {
      if (job.status === 'running' || job.status === 'pending') {
        job.status = 'cancelled';
        job.completedAt = Date.now();
        const controller = this.abortControllers.get(job.id);
        if (controller) {
          controller.abort();
        }
      }
    }

    this.abortControllers.clear();
    this.runningCount = 0;
  }

  // ---- Async shutdown with grace period -------------------------------------

  async shutdownGraceful(graceMs = 10_000): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    // Cancel all pending jobs immediately
    const allJobs = Array.from(this.jobs.values());
    for (const job of allJobs) {
      if (job.status === 'pending') {
        job.status = 'cancelled';
        job.completedAt = Date.now();
      }
    }

    // Wait for running jobs up to graceMs
    const runningJobs = allJobs.filter((j) => j.status === 'running');
    if (runningJobs.length > 0) {
      logger.info('job-queue:shutdown-waiting', { runningCount: runningJobs.length, graceMs });

      await new Promise<void>((resolve) => {
        const check = () => {
          const stillRunning = Array.from(this.jobs.values()).filter((j) => j.status === 'running');
          if (stillRunning.length === 0) {
            resolve();
          }
        };

        // Listen for job completion events
        const onComplete = () => { check(); };
        const onFail = () => { check(); };
        const onCancel = () => { check(); };
        this.on('job:completed', onComplete);
        this.on('job:failed', onFail);
        this.on('job:cancelled', onCancel);

        // Force abort after grace period
        const graceTimer = setTimeout(() => {
          this.removeListener('job:completed', onComplete);
          this.removeListener('job:failed', onFail);
          this.removeListener('job:cancelled', onCancel);
          resolve();
        }, graceMs);

        if (typeof graceTimer === 'object' && 'unref' in graceTimer) {
          graceTimer.unref();
        }

        // Check immediately in case all already finished
        check();
      });
    }

    // Force-cancel any remaining running jobs
    this.shutdown();
  }

  // ---- Internal: watchdog ---------------------------------------------------

  private startWatchdog(job: JobRecord): void {
    const timeoutMs = this.jobTimeoutMs.get(job.id) ?? DEFAULT_MAX_RUN_TIME[job.type];
    const timer = setTimeout(() => {
      this.watchdogTimers.delete(job.id);
      // Only trigger if job is still running
      if (job.status !== 'running') {
        return;
      }

      logger.warn('job-queue:watchdog-timeout', { jobId: job.id, type: job.type, timeoutMs });

      // Abort via controller
      const controller = this.abortControllers.get(job.id);
      if (controller) {
        controller.abort();
        this.abortControllers.delete(job.id);
      }

      job.status = 'failed';
      job.error = `Job timed out after ${timeoutMs}ms`;
      job.completedAt = Date.now();
      this.runningCount--;

      this.emit('job:failed', { ...job });
      this.drain();
    }, timeoutMs);

    // Don't block process exit
    if (typeof timer === 'object' && 'unref' in timer) {
      timer.unref();
    }

    this.watchdogTimers.set(job.id, timer);
  }

  private clearWatchdog(id: string): void {
    const timer = this.watchdogTimers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.watchdogTimers.delete(id);
    }
    this.jobTimeoutMs.delete(id);
  }

  // ---- Internal: priority drain ---------------------------------------------

  private drain(): void {
    if (this.runningCount >= this.concurrency) {
      return;
    }

    // Get pending jobs sorted by priority desc, createdAt asc
    const pending = Array.from(this.jobs.values())
      .filter((j) => j.status === 'pending')
      .sort((a, b) => b.priority - a.priority || a.createdAt - b.createdAt);

    for (const job of pending) {
      if (this.runningCount >= this.concurrency) {
        break;
      }
      this.executeJob(job);
    }
  }

  private executeJob(job: JobRecord): void {
    const executor = this.executors.get(job.type);
    if (!executor) {
      job.status = 'failed';
      job.error = `No executor registered for job type: ${job.type}`;
      job.completedAt = Date.now();
      this.emit('job:failed', { ...job });
      logger.warn('job-queue:no-executor', { jobId: job.id, type: job.type });
      return;
    }

    job.status = 'running';
    job.startedAt = Date.now();
    this.runningCount++;

    const controller = new AbortController();
    this.abortControllers.set(job.id, controller);

    // Start watchdog timer
    this.startWatchdog(job);

    this.emit('job:started', { ...job });
    logger.info('job-queue:started', { jobId: job.id, type: job.type });

    const context: JobExecutionContext = {
      signal: controller.signal,
      reportProgress: (pct: number) => {
        const clampedPct = Math.min(100, Math.max(0, pct));
        job.progress = clampedPct;
        this.emit('job:progress', { ...job });
      },
    };

    executor(job.payload, context)
      .then((result) => {
        // Clear watchdog on success
        this.clearWatchdog(job.id);

        // Check if cancelled while running
        if (job.status === 'cancelled') {
          return;
        }

        job.status = 'completed';
        job.result = result;
        job.progress = 100;
        job.completedAt = Date.now();

        this.runningCount--;
        this.abortControllers.delete(job.id);

        this.emit('job:completed', { ...job });
        logger.info('job-queue:completed', { jobId: job.id, type: job.type });

        this.drain();
      })
      .catch((err: unknown) => {
        // Clear watchdog on error
        this.clearWatchdog(job.id);

        // Check if cancelled while running
        if (job.status === 'cancelled') {
          return;
        }

        // If already marked failed by watchdog, don't double-process
        if (job.status === 'failed') {
          return;
        }

        this.runningCount--;
        this.abortControllers.delete(job.id);

        const errorMessage = err instanceof Error ? err.message : String(err);

        // Retry logic
        if (job.retryCount < job.maxRetries) {
          job.retryCount++;
          job.status = 'pending';
          job.startedAt = null;
          job.error = null;

          const delayMs = this.retryBaseMs * Math.pow(this.retryFactor, job.retryCount - 1);
          logger.info('job-queue:retry-scheduled', {
            jobId: job.id,
            attempt: job.retryCount,
            delayMs,
          });

          setTimeout(() => {
            // Only drain if still pending (could be cancelled in the meantime)
            if (job.status === 'pending') {
              this.drain();
            }
          }, delayMs);
        } else {
          job.status = 'failed';
          job.error = errorMessage;
          job.completedAt = Date.now();

          this.emit('job:failed', { ...job });
          logger.error('job-queue:failed', { jobId: job.id, type: job.type, error: errorMessage });

          this.drain();
        }
      });
  }

  // ---- Internal: TTL cleanup ------------------------------------------------

  private startCleanupSweep(): void {
    this.cleanupTimer = setInterval(() => {
      this.sweep();
    }, this.cleanupIntervalMs);

    // Don't block process exit
    if (this.cleanupTimer && typeof this.cleanupTimer === 'object' && 'unref' in this.cleanupTimer) {
      this.cleanupTimer.unref();
    }
  }

  sweep(): void {
    const now = Date.now();
    const toRemove: string[] = [];

    const allJobs = Array.from(this.jobs.values());
    for (const job of allJobs) {
      if (
        (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') &&
        job.completedAt !== null &&
        now - job.completedAt > this.ttlMs
      ) {
        toRemove.push(job.id);
      }
    }

    for (const id of toRemove) {
      this.jobs.delete(id);
      this.abortControllers.delete(id);
      this.jobTimeoutMs.delete(id);
    }

    if (toRemove.length > 0) {
      logger.info('job-queue:cleanup', { removedCount: toRemove.length });
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

export const jobQueue = new JobQueue();
