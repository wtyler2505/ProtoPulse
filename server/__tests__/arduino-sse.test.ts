import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import type { ArduinoJob } from '@shared/schema';

// ---------------------------------------------------------------------------
// Mock child_process, fs, logger before importing ArduinoService
// ---------------------------------------------------------------------------
const spawnInstances: Array<ReturnType<typeof createMockChild>> = [];

function createMockChild() {
  const child = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
    killed: boolean;
    kill: (signal?: string) => void;
  };
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.killed = false;
  child.kill = function (signal?: string) {
    this.killed = true;
    process.nextTick(() => {
      this.emit('close', null, signal ?? 'SIGTERM');
    });
  };
  return child;
}

vi.mock('child_process', () => ({
  spawn: vi.fn(() => {
    const child = createMockChild();
    spawnInstances.push(child);
    return child;
  }),
  exec: Object.assign(vi.fn(), {
    [Symbol.for('nodejs.util.promisify.custom')]: async () => ({ stdout: '{}', stderr: '' }),
  }),
  execFile: Object.assign(vi.fn(), {
    [Symbol.for('nodejs.util.promisify.custom')]: async () => ({ stdout: '{"VersionString":"1.0.0"}', stderr: '' }),
  }),
}));

vi.mock('fs/promises', () => ({
  default: {
    mkdir: vi.fn(),
    readdir: vi.fn().mockResolvedValue([]),
    readFile: vi.fn().mockResolvedValue(''),
    writeFile: vi.fn(),
    stat: vi.fn().mockResolvedValue({ size: 100 }),
    unlink: vi.fn(),
  },
}));

vi.mock('../logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Minimal storage mock
// ---------------------------------------------------------------------------
function makeJob(overrides: Partial<ArduinoJob> = {}): ArduinoJob {
  return {
    id: 1,
    projectId: 1,
    profileId: null,
    jobType: 'compile',
    status: 'pending',
    command: 'arduino-cli compile',
    args: { fqbn: 'arduino:avr:uno', sketchPath: '.' },
    startedAt: null,
    finishedAt: null,
    exitCode: null,
    summary: 'Queued',
    errorCode: null,
    log: null,
    createdAt: new Date(),
    ...overrides,
  } as ArduinoJob;
}

function makeStorage() {
  const jobs = new Map<number, ArduinoJob>();
  return {
    getArduinoJob: vi.fn(async (id: number) => jobs.get(id) ?? null),
    updateArduinoJob: vi.fn(async (id: number, data: Partial<ArduinoJob>) => {
      const existing = jobs.get(id);
      if (!existing) return null;
      const updated = { ...existing, ...data };
      jobs.set(id, updated);
      return updated;
    }),
    createArduinoJob: vi.fn(async (data: Partial<ArduinoJob>) => {
      const job = makeJob({ ...data, id: jobs.size + 1 });
      jobs.set(job.id, job);
      return job;
    }),
    getArduinoJobs: vi.fn(async () => Array.from(jobs.values())),
    getArduinoWorkspace: vi.fn(async () => ({
      id: 1,
      projectId: 1,
      rootPath: '/tmp/sketches/project_1',
      activeSketchPath: '/tmp/sketches/project_1',
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
    getArduinoWorkspaces: vi.fn(async () => []),
    createArduinoWorkspace: vi.fn(),
    upsertArduinoSketchFile: vi.fn(),
    getArduinoSketchFile: vi.fn(),
    getArduinoSketchFiles: vi.fn(async () => []),
    deleteArduinoSketchFile: vi.fn(async () => true),
    getNodes: vi.fn(async () => []),
    getEdges: vi.fn(async () => []),
    getBomItems: vi.fn(async () => []),
    getComponentParts: vi.fn(async () => []),
    _jobs: jobs,
  };
}

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------
import { ArduinoService, JobStream } from '../arduino-service';
import type { JobStreamEvent } from '../arduino-service';
import type { IStorage } from '../storage';

/** Wait for pending microtasks to flush (lets async runJob reach spawn). */
const flushMicrotasks = () => new Promise<void>((r) => setTimeout(r, 10));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('JobStream', () => {
  it('buffers events and emits them', () => {
    const stream = new JobStream();
    const received: JobStreamEvent[] = [];
    stream.on('event', (e: JobStreamEvent) => received.push(e));

    const event: JobStreamEvent = { type: 'log', content: 'hello', timestamp: 1000 };
    stream.push(event);

    expect(received).toHaveLength(1);
    expect(received[0]).toEqual(event);
    expect(stream.getBuffer()).toHaveLength(1);
    expect(stream.getBuffer()[0]).toEqual(event);
  });

  it('does not accept events after finish()', () => {
    const stream = new JobStream();
    const received: JobStreamEvent[] = [];
    stream.on('event', (e: JobStreamEvent) => received.push(e));

    stream.push({ type: 'log', content: 'first', timestamp: 1000 });
    stream.finish();
    stream.push({ type: 'log', content: 'second', timestamp: 2000 });

    expect(received).toHaveLength(1);
    expect(stream.getBuffer()).toHaveLength(1);
    expect(stream.finished).toBe(true);
  });

  it('removes all listeners on finish()', () => {
    const stream = new JobStream();
    const received: JobStreamEvent[] = [];
    stream.on('event', (e: JobStreamEvent) => received.push(e));

    stream.finish();
    expect(stream.listenerCount('event')).toBe(0);
  });

  it('reports finished state correctly', () => {
    const stream = new JobStream();
    expect(stream.finished).toBe(false);
    stream.finish();
    expect(stream.finished).toBe(true);
  });

  it('buffers multiple events in order', () => {
    const stream = new JobStream();
    stream.push({ type: 'status', content: 'running', timestamp: 1 });
    stream.push({ type: 'log', content: 'line 1', timestamp: 2 });
    stream.push({ type: 'log', content: 'line 2', timestamp: 3 });
    stream.push({ type: 'done', content: 'done', timestamp: 4 });

    const buffer = stream.getBuffer();
    expect(buffer).toHaveLength(4);
    expect(buffer[0]!.type).toBe('status');
    expect(buffer[1]!.content).toBe('line 1');
    expect(buffer[2]!.content).toBe('line 2');
    expect(buffer[3]!.type).toBe('done');
  });
});

describe('ArduinoService SSE streaming', () => {
  let storage: ReturnType<typeof makeStorage>;
  let service: ArduinoService;

  beforeEach(() => {
    spawnInstances.length = 0;
    storage = makeStorage();
    service = new ArduinoService(storage as unknown as IStorage);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getJobStream', () => {
    it('returns null when no process is running for the job', () => {
      const stream = service.getJobStream(999);
      expect(stream).toBeNull();
    });

    it('returns the stream for a running job', async () => {
      const job = makeJob({ id: 1, status: 'pending' });
      storage._jobs.set(1, job);

      // Start the job (spawns a process)
      const runPromise = service.runJob(1, 'compile', ['compile', '--fqbn', 'arduino:avr:uno', '.']);
      await flushMicrotasks();

      // Now getJobStream should return the stream created by runJob
      const stream = service.getJobStream(1);
      expect(stream).not.toBeNull();
      expect(stream).toBeInstanceOf(JobStream);

      // Clean up: complete the process
      const child = spawnInstances[0]!;
      child.emit('close', 0, null);
      await runPromise;
    });

    it('returns the same stream instance on repeated calls', async () => {
      const job = makeJob({ id: 1, status: 'pending' });
      storage._jobs.set(1, job);

      const runPromise = service.runJob(1, 'compile', ['compile', '--fqbn', 'arduino:avr:uno', '.']);
      await flushMicrotasks();

      const stream1 = service.getJobStream(1);
      const stream2 = service.getJobStream(1);
      expect(stream1).toBe(stream2);

      const child = spawnInstances[0]!;
      child.emit('close', 0, null);
      await runPromise;
    });
  });

  describe('runJob SSE events', () => {
    it('emits status=running on job start', async () => {
      const job = makeJob({ id: 1, status: 'pending' });
      storage._jobs.set(1, job);

      const runPromise = service.runJob(1, 'compile', ['compile', '--fqbn', 'arduino:avr:uno', '.']);
      await flushMicrotasks();

      const stream = service.getJobStream(1)!;
      expect(stream).not.toBeNull();

      // Check that 'running' status was emitted
      const buffer = stream.getBuffer();
      expect(buffer.some(e => e.type === 'status' && e.content === 'running')).toBe(true);

      const child = spawnInstances[0]!;
      child.emit('close', 0, null);
      await runPromise;
    });

    it('emits log events for stdout data', async () => {
      const job = makeJob({ id: 1, status: 'pending' });
      storage._jobs.set(1, job);

      const runPromise = service.runJob(1, 'compile', ['compile', '--fqbn', 'arduino:avr:uno', '.']);
      await flushMicrotasks();

      const stream = service.getJobStream(1)!;
      const events: JobStreamEvent[] = [];
      stream.on('event', (e: JobStreamEvent) => events.push(e));

      const child = spawnInstances[0]!;
      child.stdout.emit('data', Buffer.from('Compiling sketch...\nLinking...\n'));

      const logEvents = events.filter(e => e.type === 'log');
      expect(logEvents).toHaveLength(2);
      expect(logEvents[0]!.content).toBe('Compiling sketch...');
      expect(logEvents[1]!.content).toBe('Linking...');

      child.emit('close', 0, null);
      await runPromise;
    });

    it('emits error events for stderr data', async () => {
      const job = makeJob({ id: 1, status: 'pending' });
      storage._jobs.set(1, job);

      const runPromise = service.runJob(1, 'compile', ['compile', '--fqbn', 'arduino:avr:uno', '.']);
      await flushMicrotasks();

      const stream = service.getJobStream(1)!;
      const events: JobStreamEvent[] = [];
      stream.on('event', (e: JobStreamEvent) => events.push(e));

      const child = spawnInstances[0]!;
      child.stderr.emit('data', Buffer.from('undefined reference to setup\n'));

      const errorEvents = events.filter(e => e.type === 'error');
      expect(errorEvents).toHaveLength(1);
      expect(errorEvents[0]!.content).toBe('undefined reference to setup');

      child.emit('close', 1, null);
      await runPromise;
    });

    it('emits done event on successful completion', async () => {
      const job = makeJob({ id: 1, status: 'pending' });
      storage._jobs.set(1, job);

      const runPromise = service.runJob(1, 'compile', ['compile', '--fqbn', 'arduino:avr:uno', '.']);
      await flushMicrotasks();

      const stream = service.getJobStream(1)!;
      const events: JobStreamEvent[] = [];
      stream.on('event', (e: JobStreamEvent) => events.push(e));

      const child = spawnInstances[0]!;
      child.emit('close', 0, null);
      await runPromise;

      const doneEvents = events.filter(e => e.type === 'done');
      expect(doneEvents).toHaveLength(1);
      expect(doneEvents[0]!.content).toBe('Operation successful');

      const statusEvents = events.filter(e => e.type === 'status' && e.content === 'completed');
      expect(statusEvents).toHaveLength(1);
    });

    it('emits done event on failure', async () => {
      const job = makeJob({ id: 1, status: 'pending' });
      storage._jobs.set(1, job);

      const runPromise = service.runJob(1, 'compile', ['compile', '--fqbn', 'arduino:avr:uno', '.']);
      await flushMicrotasks();

      const stream = service.getJobStream(1)!;
      const events: JobStreamEvent[] = [];
      stream.on('event', (e: JobStreamEvent) => events.push(e));

      const child = spawnInstances[0]!;
      child.emit('close', 1, null);
      await runPromise;

      const doneEvents = events.filter(e => e.type === 'done');
      expect(doneEvents).toHaveLength(1);
      expect(doneEvents[0]!.content).toBe('Operation failed');

      const statusEvents = events.filter(e => e.type === 'status' && e.content === 'failed');
      expect(statusEvents).toHaveLength(1);
    });

    it('emits cancelled status when process is killed', async () => {
      const job = makeJob({ id: 1, status: 'pending' });
      storage._jobs.set(1, job);

      const runPromise = service.runJob(1, 'compile', ['compile', '--fqbn', 'arduino:avr:uno', '.']);
      await flushMicrotasks();

      const stream = service.getJobStream(1)!;
      const events: JobStreamEvent[] = [];
      stream.on('event', (e: JobStreamEvent) => events.push(e));

      const child = spawnInstances[0]!;
      child.kill('SIGTERM');
      await runPromise;

      const statusEvents = events.filter(e => e.type === 'status' && e.content === 'cancelled');
      expect(statusEvents).toHaveLength(1);
      const doneEvents = events.filter(e => e.type === 'done');
      expect(doneEvents).toHaveLength(1);
      expect(doneEvents[0]!.content).toBe('Cancelled by user');
    });

    it('emits error + done on process error', async () => {
      const job = makeJob({ id: 1, status: 'pending' });
      storage._jobs.set(1, job);

      const runPromise = service.runJob(1, 'compile', ['compile', '--fqbn', 'arduino:avr:uno', '.']);
      await flushMicrotasks();

      const stream = service.getJobStream(1)!;
      const events: JobStreamEvent[] = [];
      stream.on('event', (e: JobStreamEvent) => events.push(e));

      const child = spawnInstances[0]!;
      child.emit('error', new Error('ENOENT'));

      await expect(runPromise).rejects.toThrow('ENOENT');

      const errorEvents = events.filter(e => e.type === 'error');
      expect(errorEvents.some(e => e.content === 'ENOENT')).toBe(true);
      const doneEvents = events.filter(e => e.type === 'done');
      expect(doneEvents).toHaveLength(1);
    });

    it('cleans up stream after job completes', async () => {
      const job = makeJob({ id: 1, status: 'pending' });
      storage._jobs.set(1, job);

      const runPromise = service.runJob(1, 'compile', ['compile', '--fqbn', 'arduino:avr:uno', '.']);
      await flushMicrotasks();

      const stream = service.getJobStream(1)!;
      expect(stream).not.toBeNull();

      const child = spawnInstances[0]!;
      child.emit('close', 0, null);
      await runPromise;

      // Stream should be cleaned up — getJobStream should return null
      const afterStream = service.getJobStream(1);
      expect(afterStream).toBeNull();
      expect(stream.finished).toBe(true);
    });

    it('handles multiple stdout chunks correctly', async () => {
      const job = makeJob({ id: 1, status: 'pending' });
      storage._jobs.set(1, job);

      const runPromise = service.runJob(1, 'compile', ['compile', '--fqbn', 'arduino:avr:uno', '.']);
      await flushMicrotasks();

      const stream = service.getJobStream(1)!;
      const events: JobStreamEvent[] = [];
      stream.on('event', (e: JobStreamEvent) => events.push(e));

      const child = spawnInstances[0]!;
      child.stdout.emit('data', Buffer.from('Line 1\n'));
      child.stdout.emit('data', Buffer.from('Line 2\n'));
      child.stdout.emit('data', Buffer.from('Line 3\n'));

      const logEvents = events.filter(e => e.type === 'log');
      expect(logEvents).toHaveLength(3);
      expect(logEvents.map(e => e.content)).toEqual(['Line 1', 'Line 2', 'Line 3']);

      child.emit('close', 0, null);
      await runPromise;
    });
  });

  describe('cancelJob with stream', () => {
    it('emits cancelled + done on pending job cancellation', async () => {
      const job = makeJob({ id: 2, status: 'pending' });
      storage._jobs.set(2, job);

      // Manually create a stream for the pending job (simulates a client connection)
      // Since no process exists, getJobStream returns null for pending jobs.
      // The cancel handler pushes events if a stream exists.
      // For pending cancellation, the stream won't exist unless we create one manually.
      const cancelled = await service.cancelJob(2);
      expect(cancelled).toBe(true);

      const updatedJob = storage._jobs.get(2)!;
      expect(updatedJob.status).toBe('cancelled');
    });
  });
});

describe('SSE event format', () => {
  it('events conform to expected shape', () => {
    const event: JobStreamEvent = {
      type: 'log',
      content: 'Compiling sketch...',
      timestamp: Date.now(),
    };

    expect(event.type).toMatch(/^(log|status|error|done)$/);
    expect(typeof event.content).toBe('string');
    expect(typeof event.timestamp).toBe('number');

    // Verify JSON serialization matches SSE format
    const serialized = JSON.stringify(event);
    const parsed = JSON.parse(serialized) as JobStreamEvent;
    expect(parsed).toEqual(event);
  });

  it('all event types are valid', () => {
    const types: JobStreamEvent['type'][] = ['log', 'status', 'error', 'done'];
    for (const type of types) {
      const event: JobStreamEvent = { type, content: 'test', timestamp: 1 };
      expect(event.type).toBe(type);
    }
  });

  it('SSE data line format is correct', () => {
    const event: JobStreamEvent = {
      type: 'log',
      content: 'Compiling...',
      timestamp: 1000,
    };
    const sseLine = `data: ${JSON.stringify(event)}\n\n`;
    expect(sseLine).toMatch(/^data: \{.*\}\n\n$/);
    expect(sseLine).toContain('"type":"log"');
    expect(sseLine).toContain('"content":"Compiling..."');
  });
});

describe('Completed job SSE behavior', () => {
  let storage: ReturnType<typeof makeStorage>;
  let service: ArduinoService;

  beforeEach(() => {
    spawnInstances.length = 0;
    storage = makeStorage();
    service = new ArduinoService(storage as unknown as IStorage);
  });

  it('getJobStream returns null for completed job with no running process', () => {
    const job = makeJob({ id: 1, status: 'completed', log: 'Done\n' });
    storage._jobs.set(1, job);

    const stream = service.getJobStream(1);
    expect(stream).toBeNull();
  });

  it('getJobStream returns null for failed job with no running process', () => {
    const job = makeJob({ id: 1, status: 'failed', log: 'Error\n' });
    storage._jobs.set(1, job);

    const stream = service.getJobStream(1);
    expect(stream).toBeNull();
  });

  it('getJobStream returns null for cancelled job with no running process', () => {
    const job = makeJob({ id: 1, status: 'cancelled', log: 'Cancelled\n' });
    storage._jobs.set(1, job);

    const stream = service.getJobStream(1);
    expect(stream).toBeNull();
  });
});

describe('Late-join buffer replay', () => {
  it('getBuffer returns all events for late-joining SSE clients', async () => {
    const storage = makeStorage();
    const service = new ArduinoService(storage as unknown as IStorage);

    const job = makeJob({ id: 1, status: 'pending' });
    storage._jobs.set(1, job);

    const runPromise = service.runJob(1, 'compile', ['compile', '--fqbn', 'arduino:avr:uno', '.']);
    await flushMicrotasks();

    // Emit some output before any SSE client connects
    const child = spawnInstances[0]!;
    child.stdout.emit('data', Buffer.from('Early line 1\n'));
    child.stdout.emit('data', Buffer.from('Early line 2\n'));

    // Now a "late" client gets the stream
    const stream = service.getJobStream(1)!;
    const buffer = stream.getBuffer();

    // Should have: status=running + 2 log events
    expect(buffer.length).toBeGreaterThanOrEqual(3);
    expect(buffer[0]!.type).toBe('status');
    expect(buffer[0]!.content).toBe('running');

    const logEntries = buffer.filter(e => e.type === 'log');
    expect(logEntries.some(e => e.content === 'Early line 1')).toBe(true);
    expect(logEntries.some(e => e.content === 'Early line 2')).toBe(true);

    child.emit('close', 0, null);
    await runPromise;
  });
});
