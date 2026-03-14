import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import { SimulatorProcessManager } from '../process-manager';
import type { ProcessStatus, SpawnOptions } from '../process-manager';

// --- Mock child_process.spawn ---

class MockChildProcess extends EventEmitter {
  pid: number | undefined = 12345;
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  killed = false;
  killSignals: string[] = [];

  kill(signal: string): boolean {
    this.killSignals.push(signal);
    this.killed = true;
    return true;
  }

  simulateClose(code: number | null, signal: NodeJS.Signals | null): void {
    this.emit('close', code, signal);
  }

  simulateError(err: Error): void {
    this.emit('error', err);
  }

  simulateStdout(data: string): void {
    this.stdout.emit('data', Buffer.from(data));
  }

  simulateStderr(data: string): void {
    this.stderr.emit('data', Buffer.from(data));
  }
}

let mockChild: MockChildProcess;
const mockSpawn = vi.fn();

vi.mock('child_process', () => ({
  spawn: (...args: unknown[]) => mockSpawn(...args),
}));

describe('SimulatorProcessManager', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockSpawn.mockClear();
    mockChild = new MockChildProcess();
    mockSpawn.mockReturnValue(mockChild);
    // Clear singleton map between tests
    (SimulatorProcessManager as unknown as { instances: Map<number, SimulatorProcessManager> }).instances.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // --- Singleton behavior ---

  describe('singleton management', () => {
    it('should return the same instance for the same projectId', () => {
      const a = SimulatorProcessManager.getOrCreate(1);
      const b = SimulatorProcessManager.getOrCreate(1);
      expect(a).toBe(b);
    });

    it('should return different instances for different projectIds', () => {
      const a = SimulatorProcessManager.getOrCreate(1);
      const b = SimulatorProcessManager.getOrCreate(2);
      expect(a).not.toBe(b);
    });

    it('should return undefined from get() when no instance exists', () => {
      expect(SimulatorProcessManager.get(999)).toBeUndefined();
    });

    it('should return existing instance from get()', () => {
      const created = SimulatorProcessManager.getOrCreate(5);
      expect(SimulatorProcessManager.get(5)).toBe(created);
    });

    it('should remove instance on destroy()', async () => {
      SimulatorProcessManager.getOrCreate(10);
      expect(SimulatorProcessManager.get(10)).toBeDefined();
      await SimulatorProcessManager.destroy(10);
      expect(SimulatorProcessManager.get(10)).toBeUndefined();
    });

    it('should handle destroy() for non-existent projectId gracefully', async () => {
      await expect(SimulatorProcessManager.destroy(999)).resolves.toBeUndefined();
    });

    it('should destroy all instances with destroyAll()', async () => {
      SimulatorProcessManager.getOrCreate(1);
      SimulatorProcessManager.getOrCreate(2);
      SimulatorProcessManager.getOrCreate(3);
      await SimulatorProcessManager.destroyAll();
      expect(SimulatorProcessManager.get(1)).toBeUndefined();
      expect(SimulatorProcessManager.get(2)).toBeUndefined();
      expect(SimulatorProcessManager.get(3)).toBeUndefined();
    });

    it('should expose projectId as a readonly property', () => {
      const mgr = SimulatorProcessManager.getOrCreate(42);
      expect(mgr.projectId).toBe(42);
    });
  });

  // --- spawn() ---

  describe('spawn()', () => {
    it('should call child_process.spawn with correct arguments', async () => {
      const mgr = SimulatorProcessManager.getOrCreate(1);
      await mgr.spawn('/path/to/firmware.hex', 'atmega328p', 16000000);

      expect(mockSpawn).toHaveBeenCalledWith(
        '/usr/bin/simavr',
        ['--mcu', 'atmega328p', '-f', '16000000', '/path/to/firmware.hex'],
        expect.objectContaining({ stdio: 'pipe' }),
      );
    });

    it('should include --gdb flag when gdb option is true', async () => {
      const mgr = SimulatorProcessManager.getOrCreate(1);
      await mgr.spawn('/fw.hex', 'atmega328p', 16000000, { gdb: true });

      expect(mockSpawn).toHaveBeenCalledWith(
        '/usr/bin/simavr',
        ['--mcu', 'atmega328p', '-f', '16000000', '--gdb', '/fw.hex'],
        expect.any(Object),
      );
    });

    it('should include --gdb-port when custom gdb port is provided', async () => {
      const mgr = SimulatorProcessManager.getOrCreate(1);
      await mgr.spawn('/fw.hex', 'atmega328p', 16000000, { gdb: true, gdbPort: 5678 });

      expect(mockSpawn).toHaveBeenCalledWith(
        '/usr/bin/simavr',
        ['--mcu', 'atmega328p', '-f', '16000000', '--gdb', '--gdb-port', '5678', '/fw.hex'],
        expect.any(Object),
      );
    });

    it('should not include --gdb-port for default port 1234', async () => {
      const mgr = SimulatorProcessManager.getOrCreate(1);
      await mgr.spawn('/fw.hex', 'atmega328p', 16000000, { gdb: true, gdbPort: 1234 });

      const spawnArgs = mockSpawn.mock.calls[0][1] as string[];
      expect(spawnArgs).not.toContain('--gdb-port');
    });

    it('should transition status from idle to starting to running', async () => {
      const mgr = SimulatorProcessManager.getOrCreate(1);
      const statuses: ProcessStatus[] = [];
      mgr.on('status', (s: ProcessStatus) => statuses.push(s));

      await mgr.spawn('/fw.hex', 'atmega328p', 16000000);

      expect(statuses).toEqual(['starting', 'running']);
      expect(mgr.getStatus()).toBe('running');
    });

    it('should throw when process is already running', async () => {
      const mgr = SimulatorProcessManager.getOrCreate(1);
      await mgr.spawn('/fw.hex', 'atmega328p', 16000000);

      await expect(mgr.spawn('/fw2.hex', 'atmega328p', 16000000)).rejects.toThrow(
        'Process already running for project 1',
      );
    });

    it('should pass custom env variables merged with process.env', async () => {
      const mgr = SimulatorProcessManager.getOrCreate(1);
      await mgr.spawn('/fw.hex', 'atmega328p', 16000000, { env: { MY_VAR: 'test' } });

      const opts = mockSpawn.mock.calls[0][2] as { env: Record<string, string> };
      expect(opts.env.MY_VAR).toBe('test');
    });

    it('should return pid of spawned process', async () => {
      const mgr = SimulatorProcessManager.getOrCreate(1);
      await mgr.spawn('/fw.hex', 'atmega328p', 16000000);
      expect(mgr.getPid()).toBe(12345);
    });

    it('should return null pid when no process is running', () => {
      const mgr = SimulatorProcessManager.getOrCreate(1);
      expect(mgr.getPid()).toBeNull();
    });
  });

  // --- Event emission ---

  describe('event emission', () => {
    it('should emit stdout events from child process', async () => {
      const mgr = SimulatorProcessManager.getOrCreate(1);
      const chunks: string[] = [];
      mgr.on('stdout', (data: string) => chunks.push(data));

      await mgr.spawn('/fw.hex', 'atmega328p', 16000000);
      mockChild.simulateStdout('Hello from simavr\n');

      expect(chunks).toEqual(['Hello from simavr\n']);
    });

    it('should emit stderr events from child process', async () => {
      const mgr = SimulatorProcessManager.getOrCreate(1);
      const chunks: string[] = [];
      mgr.on('stderr', (data: string) => chunks.push(data));

      await mgr.spawn('/fw.hex', 'atmega328p', 16000000);
      mockChild.simulateStderr('Warning: something\n');

      expect(chunks).toEqual(['Warning: something\n']);
    });

    it('should emit exit event with code on normal exit', async () => {
      const mgr = SimulatorProcessManager.getOrCreate(1);
      const exits: Array<{ code: number | null; signal: NodeJS.Signals | null }> = [];
      mgr.on('exit', (code: number | null, signal: NodeJS.Signals | null) => exits.push({ code, signal }));

      await mgr.spawn('/fw.hex', 'atmega328p', 16000000);
      mockChild.simulateClose(0, null);

      expect(exits).toEqual([{ code: 0, signal: null }]);
    });

    it('should emit error event on spawn error', async () => {
      const mgr = SimulatorProcessManager.getOrCreate(1);
      const errors: Error[] = [];
      mgr.on('error', (err: Error) => errors.push(err));

      await mgr.spawn('/fw.hex', 'atmega328p', 16000000);
      mockChild.simulateError(new Error('ENOENT'));

      expect(errors).toHaveLength(1);
      expect(errors[0].message).toBe('ENOENT');
    });
  });

  // --- Status transitions ---

  describe('status transitions', () => {
    it('should start as idle', () => {
      const mgr = SimulatorProcessManager.getOrCreate(1);
      expect(mgr.getStatus()).toBe('idle');
    });

    it('should transition to error on non-zero exit code', async () => {
      const mgr = SimulatorProcessManager.getOrCreate(1);
      await mgr.spawn('/fw.hex', 'atmega328p', 16000000);

      mockChild.simulateClose(1, null);
      expect(mgr.getStatus()).toBe('error');
    });

    it('should transition to idle on zero exit code', async () => {
      const mgr = SimulatorProcessManager.getOrCreate(1);
      await mgr.spawn('/fw.hex', 'atmega328p', 16000000);

      mockChild.simulateClose(0, null);
      expect(mgr.getStatus()).toBe('idle');
    });

    it('should transition to error on spawn error event', async () => {
      const mgr = SimulatorProcessManager.getOrCreate(1);
      mgr.on('error', () => {}); // Prevent unhandled error throw
      await mgr.spawn('/fw.hex', 'atmega328p', 16000000);

      mockChild.simulateError(new Error('crash'));
      expect(mgr.getStatus()).toBe('error');
    });

    it('should transition to idle after stop + close', async () => {
      const mgr = SimulatorProcessManager.getOrCreate(1);
      await mgr.spawn('/fw.hex', 'atmega328p', 16000000);

      const stopPromise = mgr.stop();
      expect(mgr.getStatus()).toBe('stopping');

      mockChild.simulateClose(0, 'SIGTERM');
      await stopPromise;

      expect(mgr.getStatus()).toBe('idle');
    });

    it('should clear pid after process exits', async () => {
      const mgr = SimulatorProcessManager.getOrCreate(1);
      await mgr.spawn('/fw.hex', 'atmega328p', 16000000);
      expect(mgr.getPid()).toBe(12345);

      mockChild.simulateClose(0, null);
      expect(mgr.getPid()).toBeNull();
    });
  });

  // --- stop() ---

  describe('stop()', () => {
    it('should send SIGTERM to process', async () => {
      const mgr = SimulatorProcessManager.getOrCreate(1);
      await mgr.spawn('/fw.hex', 'atmega328p', 16000000);

      const stopPromise = mgr.stop();
      expect(mockChild.killSignals).toContain('SIGTERM');

      mockChild.simulateClose(0, 'SIGTERM');
      await stopPromise;
    });

    it('should escalate to SIGKILL after 5 seconds', async () => {
      const mgr = SimulatorProcessManager.getOrCreate(1);
      await mgr.spawn('/fw.hex', 'atmega328p', 16000000);

      const stopPromise = mgr.stop();
      expect(mockChild.killSignals).toEqual(['SIGTERM']);

      // Advance past the 5s timeout
      vi.advanceTimersByTime(5000);
      expect(mockChild.killSignals).toEqual(['SIGTERM', 'SIGKILL']);

      mockChild.simulateClose(null, 'SIGKILL');
      await stopPromise;
    });

    it('should not escalate to SIGKILL if process exits before timeout', async () => {
      const mgr = SimulatorProcessManager.getOrCreate(1);
      await mgr.spawn('/fw.hex', 'atmega328p', 16000000);

      const stopPromise = mgr.stop();
      mockChild.simulateClose(0, 'SIGTERM');
      await stopPromise;

      vi.advanceTimersByTime(10000);
      expect(mockChild.killSignals).toEqual(['SIGTERM']);
    });

    it('should be a no-op when status is idle', async () => {
      const mgr = SimulatorProcessManager.getOrCreate(1);
      await mgr.stop(); // Should resolve immediately
      expect(mgr.getStatus()).toBe('idle');
    });

    it('should wait for existing stop when called twice', async () => {
      const mgr = SimulatorProcessManager.getOrCreate(1);
      await mgr.spawn('/fw.hex', 'atmega328p', 16000000);

      const stop1 = mgr.stop();
      const stop2 = mgr.stop();

      mockChild.simulateClose(0, 'SIGTERM');
      await Promise.all([stop1, stop2]);

      expect(mgr.getStatus()).toBe('idle');
    });
  });

  // --- restart() ---

  describe('restart()', () => {
    it('should stop and re-spawn with same arguments', async () => {
      const mgr = SimulatorProcessManager.getOrCreate(1);
      await mgr.spawn('/fw.hex', 'atmega328p', 16000000, { gdb: true });

      // First spawn
      const firstChild = mockChild;

      // Create new mock for the respawned process
      mockChild = new MockChildProcess();
      mockChild.pid = 67890;
      mockSpawn.mockReturnValue(mockChild);

      const restartPromise = mgr.restart();
      firstChild.simulateClose(0, 'SIGTERM');
      await restartPromise;

      expect(mgr.getStatus()).toBe('running');
      expect(mgr.getPid()).toBe(67890);

      // Verify re-spawn used same args
      expect(mockSpawn).toHaveBeenCalledTimes(2);
      const secondCallArgs = mockSpawn.mock.calls[1][1] as string[];
      expect(secondCallArgs).toContain('--gdb');
      expect(secondCallArgs).toContain('atmega328p');
    });

    it('should throw when no previous spawn arguments exist', async () => {
      const mgr = SimulatorProcessManager.getOrCreate(1);
      await expect(mgr.restart()).rejects.toThrow('Cannot restart: no previous spawn arguments');
    });
  });

  // --- Error handling ---

  describe('error handling', () => {
    it('should set error status on non-zero exit without stopping', async () => {
      const mgr = SimulatorProcessManager.getOrCreate(1);
      await mgr.spawn('/fw.hex', 'atmega328p', 16000000);

      mockChild.simulateClose(1, null);
      expect(mgr.getStatus()).toBe('error');
    });

    it('should set error status on signal kill without stopping', async () => {
      const mgr = SimulatorProcessManager.getOrCreate(1);
      await mgr.spawn('/fw.hex', 'atmega328p', 16000000);

      mockChild.simulateClose(null, 'SIGSEGV');
      expect(mgr.getStatus()).toBe('error');
    });

    it('should set idle on close during stop regardless of exit code', async () => {
      const mgr = SimulatorProcessManager.getOrCreate(1);
      await mgr.spawn('/fw.hex', 'atmega328p', 16000000);

      const stopPromise = mgr.stop();
      mockChild.simulateClose(1, 'SIGTERM');
      await stopPromise;

      expect(mgr.getStatus()).toBe('idle');
    });

    it('should handle spawn error event and set error status', async () => {
      const mgr = SimulatorProcessManager.getOrCreate(1);
      mgr.on('error', () => {}); // Prevent unhandled error throw
      await mgr.spawn('/fw.hex', 'atmega328p', 16000000);

      mockChild.simulateError(new Error('EACCES'));
      expect(mgr.getStatus()).toBe('error');
      expect(mgr.getPid()).toBeNull();
    });

    it('should allow re-spawn after error', async () => {
      const mgr = SimulatorProcessManager.getOrCreate(1);
      mgr.on('error', () => {}); // Prevent unhandled error throw
      await mgr.spawn('/fw.hex', 'atmega328p', 16000000);

      mockChild.simulateError(new Error('crash'));
      // Also need the close event to clean up fully
      mockChild.simulateClose(1, null);
      expect(mgr.getStatus()).toBe('error');

      // Reset mock for new spawn
      mockChild = new MockChildProcess();
      mockSpawn.mockReturnValue(mockChild);

      // Error status should not prevent a new spawn (it's not 'running' or 'starting')
      await mgr.spawn('/fw2.hex', 'atmega328p', 16000000);
      expect(mgr.getStatus()).toBe('running');
    });

    it('should handle process with undefined pid', async () => {
      const noPidChild = new MockChildProcess();
      noPidChild.pid = undefined;
      mockSpawn.mockReturnValue(noPidChild);

      const mgr = SimulatorProcessManager.getOrCreate(1);
      await mgr.spawn('/fw.hex', 'atmega328p', 16000000);

      // Should remain in starting (pid undefined means spawn hasn't completed)
      expect(mgr.getStatus()).toBe('starting');
    });
  });

  // --- destroy() ---

  describe('destroy()', () => {
    it('should stop running process before removing from map', async () => {
      const mgr = SimulatorProcessManager.getOrCreate(1);
      await mgr.spawn('/fw.hex', 'atmega328p', 16000000);

      const destroyPromise = SimulatorProcessManager.destroy(1);
      mockChild.simulateClose(0, 'SIGTERM');
      await destroyPromise;

      expect(SimulatorProcessManager.get(1)).toBeUndefined();
      expect(mockChild.killSignals).toContain('SIGTERM');
    });

    it('should remove all listeners on destroy', async () => {
      const mgr = SimulatorProcessManager.getOrCreate(1);
      mgr.on('stdout', () => {});
      mgr.on('stderr', () => {});
      mgr.on('exit', () => {});

      await SimulatorProcessManager.destroy(1);
      expect(mgr.listenerCount('stdout')).toBe(0);
      expect(mgr.listenerCount('stderr')).toBe(0);
      expect(mgr.listenerCount('exit')).toBe(0);
    });
  });
});
