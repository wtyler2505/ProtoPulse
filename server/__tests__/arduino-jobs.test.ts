import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ArduinoJob } from '@shared/schema';

// ---------------------------------------------------------------------------
// Mock ArduinoService internals (child_process, fs)
// ---------------------------------------------------------------------------
vi.mock('child_process', () => {
  const EventEmitter = require('events');
  class MockChild extends EventEmitter {
    stdout = new EventEmitter();
    stderr = new EventEmitter();
    killed = false;
    kill(signal?: string) {
      this.killed = true;
      this.emit('close', null, signal ?? 'SIGTERM');
    }
  }
  return {
    spawn: vi.fn(() => new MockChild()),
    execSync: vi.fn(() => Buffer.from('{"VersionString":"1.0.0"}')),
    execFileSync: vi.fn(() => Buffer.from('[]')),
  };
});

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
    getArduinoBuildProfiles: vi.fn(async () => []),
    createArduinoBuildProfile: vi.fn(),
    updateArduinoBuildProfile: vi.fn(),
    deleteArduinoBuildProfile: vi.fn(async () => true),
    getArduinoSerialSessions: vi.fn(async () => []),
    createArduinoSerialSession: vi.fn(),
    updateArduinoSerialSession: vi.fn(),
    _jobs: jobs,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('ArduinoService — Job Cancellation (BL-0604)', () => {
  let service: InstanceType<typeof import('../arduino-service').ArduinoService>;
  let storage: ReturnType<typeof makeStorage>;

  beforeEach(async () => {
    storage = makeStorage();
    const { ArduinoService } = await import('../arduino-service');
    service = new ArduinoService(storage as never);
  });

  it('cancelJob returns false for non-existent job', async () => {
    const result = await service.cancelJob(999);
    expect(result).toBe(false);
  });

  it('cancelJob cancels a pending job (no running process)', async () => {
    const job = makeJob({ id: 10, status: 'pending' });
    storage._jobs.set(10, job);

    const result = await service.cancelJob(10);
    expect(result).toBe(true);
    expect(storage.updateArduinoJob).toHaveBeenCalledWith(10, expect.objectContaining({
      status: 'cancelled',
      summary: 'Cancelled before execution started',
    }));
  });

  it('cancelJob returns false for completed job with no process', async () => {
    const job = makeJob({ id: 11, status: 'completed' });
    storage._jobs.set(11, job);

    const result = await service.cancelJob(11);
    expect(result).toBe(false);
  });

  it('cancelJob returns false for failed job with no process', async () => {
    const job = makeJob({ id: 12, status: 'failed' });
    storage._jobs.set(12, job);

    const result = await service.cancelJob(12);
    expect(result).toBe(false);
  });

  it('runJob marks cancelled status when process receives SIGTERM', async () => {
    const job = makeJob({ id: 20, status: 'pending' });
    storage._jobs.set(20, job);

    const runPromise = service.runJob(20, 'compile', ['compile', '--fqbn', 'arduino:avr:uno', '.']);

    // The spawn mock emits close with SIGTERM when kill() is called
    const cancelled = await service.cancelJob(20);
    expect(cancelled).toBe(true);

    const result = await runPromise;
    expect(result.exitCode).toBe(-1);
    expect(storage.updateArduinoJob).toHaveBeenCalledWith(20, expect.objectContaining({
      status: 'cancelled',
      summary: 'Cancelled by user',
    }));
  });

  it('runJob skips execution if job was pre-cancelled', async () => {
    const job = makeJob({ id: 30, status: 'cancelled' });
    storage._jobs.set(30, job);

    const result = await service.runJob(30, 'compile', ['compile', '--fqbn', 'arduino:avr:uno', '.']);
    expect(result.exitCode).toBe(-1);
  });
});

describe('ArduinoService — Artifact Path (BL-0605)', () => {
  let service: InstanceType<typeof import('../arduino-service').ArduinoService>;
  let storage: ReturnType<typeof makeStorage>;

  beforeEach(async () => {
    storage = makeStorage();
    const { ArduinoService } = await import('../arduino-service');
    service = new ArduinoService(storage as never);
  });

  it('getArtifactPath returns null for non-existent job', async () => {
    const result = await service.getArtifactPath(999);
    expect(result).toBeNull();
  });

  it('getArtifactPath returns null for non-compile job', async () => {
    const job = makeJob({ id: 40, status: 'completed', jobType: 'upload' });
    storage._jobs.set(40, job);

    const result = await service.getArtifactPath(40);
    expect(result).toBeNull();
  });

  it('getArtifactPath returns null for failed compile job', async () => {
    const job = makeJob({ id: 41, status: 'failed', jobType: 'compile' });
    storage._jobs.set(41, job);

    const result = await service.getArtifactPath(41);
    expect(result).toBeNull();
  });

  it('getArtifactPath returns hex file path when found in build directory', async () => {
    const fsPromises = await import('fs/promises');
    (fsPromises.default.readdir as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      'sketch.ino.hex',
      'sketch.ino.elf',
    ]);

    const job = makeJob({
      id: 42,
      status: 'completed',
      jobType: 'compile',
      args: { fqbn: 'arduino:avr:uno', sketchPath: '/tmp/sketch' },
    });
    storage._jobs.set(42, job);

    const result = await service.getArtifactPath(42);
    expect(result).toContain('sketch.ino.hex');
  });

  it('getArtifactPath prefers hex over bin over elf', async () => {
    const fsPromises = await import('fs/promises');
    (fsPromises.default.readdir as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      'sketch.ino.elf',
      'sketch.ino.bin',
    ]);

    const job = makeJob({
      id: 43,
      status: 'completed',
      jobType: 'compile',
      args: { fqbn: 'esp32:esp32:esp32', sketchPath: '/tmp/sketch' },
    });
    storage._jobs.set(43, job);

    const result = await service.getArtifactPath(43);
    expect(result).toContain('.bin');
  });

  it('getArtifactPath falls back to workspace build directory', async () => {
    const fsPromises = await import('fs/promises');
    // First readdir fails (no build dir at sketch path)
    (fsPromises.default.readdir as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new Error('ENOENT'))
      .mockResolvedValueOnce(['firmware.hex']);

    const job = makeJob({
      id: 44,
      status: 'completed',
      jobType: 'compile',
      args: { fqbn: 'arduino:avr:uno', sketchPath: '/nonexistent' },
    });
    storage._jobs.set(44, job);

    const result = await service.getArtifactPath(44);
    expect(result).toContain('firmware.hex');
  });

  it('getArtifactPath returns null when no artifacts found anywhere', async () => {
    const fsPromises = await import('fs/promises');
    (fsPromises.default.readdir as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new Error('ENOENT'))
      .mockRejectedValueOnce(new Error('ENOENT'));

    const job = makeJob({
      id: 45,
      status: 'completed',
      jobType: 'compile',
      args: { fqbn: 'arduino:avr:uno', sketchPath: '/nonexistent' },
    });
    storage._jobs.set(45, job);

    const result = await service.getArtifactPath(45);
    expect(result).toBeNull();
  });
});
