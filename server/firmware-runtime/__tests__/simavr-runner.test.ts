import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Mock } from 'vitest';
import { SimavrRunner } from '../simavr-runner';
import type { SimRunOptions } from '../simavr-runner';
import { SimulatorProcessManager } from '../process-manager';
import { RuntimeEventBuffer } from '../runtime-events';
import type { IStorage } from '../../storage';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../process-manager', () => {
  const EventEmitter = require('events').EventEmitter;

  class MockProcessManager extends EventEmitter {
    projectId: number;
    private status = 'idle';
    private lastSpawnArgs: { firmwarePath: string; mcu: string; freq: number } | null = null;

    constructor(projectId: number) {
      super();
      this.projectId = projectId;
    }

    async spawn(firmwarePath: string, mcu: string, freq: number, _options?: Record<string, unknown>): Promise<void> {
      this.lastSpawnArgs = { firmwarePath, mcu, freq };
      this.status = 'running';
      this.emit('status', 'running');
    }

    async stop(): Promise<void> {
      this.status = 'idle';
      this.emit('status', 'idle');
    }

    async restart(): Promise<void> {
      if (!this.lastSpawnArgs) {
        throw new Error('Cannot restart: no previous spawn arguments');
      }
      this.status = 'running';
      this.emit('status', 'running');
    }

    getStatus() {
      return this.status;
    }

    getPid() {
      return this.status === 'running' ? 12345 : null;
    }
  }

  const instances = new Map<number, MockProcessManager>();

  return {
    SimulatorProcessManager: {
      getOrCreate: (projectId: number) => {
        let inst = instances.get(projectId);
        if (!inst) {
          inst = new MockProcessManager(projectId);
          instances.set(projectId, inst);
        }
        return inst;
      },
      get: (projectId: number) => instances.get(projectId),
      destroy: async (projectId: number) => {
        const inst = instances.get(projectId);
        if (inst) {
          await inst.stop();
          inst.removeAllListeners();
          instances.delete(projectId);
        }
      },
      destroyAll: async () => {
        for (const [id] of instances) {
          const inst = instances.get(id);
          if (inst) {
            await inst.stop();
            inst.removeAllListeners();
          }
        }
        instances.clear();
      },
      // Expose instances for test inspection
      _instances: instances,
    },
  };
});

vi.mock('../../logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockStorage(): IStorage {
  return {} as IStorage;
}

const defaultOptions: SimRunOptions = {
  mcu: 'atmega328p',
  freq: 16_000_000,
  enableGdb: false,
  vcdOutput: false,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SimavrRunner', () => {
  let runner: SimavrRunner;
  let storage: IStorage;

  beforeEach(() => {
    storage = createMockStorage();
    runner = new SimavrRunner(storage);
    // Clear process manager instances between tests
    const pm = SimulatorProcessManager as unknown as { _instances: Map<number, unknown> };
    pm._instances.clear();
  });

  afterEach(async () => {
    await runner.stopAll();
  });

  // -- startSimulation --

  describe('startSimulation', () => {
    it('should return a UUID session ID', async () => {
      const sessionId = await runner.startSimulation(1, '/path/to/firmware.hex', defaultOptions);
      expect(sessionId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });

    it('should create a session that is accessible via hasSession', async () => {
      const sessionId = await runner.startSimulation(1, '/path/to/firmware.hex', defaultOptions);
      expect(runner.hasSession(sessionId)).toBe(true);
    });

    it('should return unique session IDs for multiple calls', async () => {
      const id1 = await runner.startSimulation(1, '/path/to/fw1.hex', defaultOptions);
      // Different project to avoid process-already-running error
      const id2 = await runner.startSimulation(2, '/path/to/fw2.hex', defaultOptions);
      expect(id1).not.toBe(id2);
    });

    it('should spawn the process manager with correct args', async () => {
      const sessionId = await runner.startSimulation(1, '/path/to/firmware.hex', {
        mcu: 'atmega2560',
        freq: 8_000_000,
        enableGdb: true,
        vcdOutput: false,
      });

      const status = runner.getStatus(sessionId);
      expect(status.state).toBe('running');
    });

    it('should clean up session on spawn failure', async () => {
      // Make spawn throw
      const manager = SimulatorProcessManager.getOrCreate(99);
      const origSpawn = manager.spawn.bind(manager);
      manager.spawn = async () => {
        throw new Error('spawn failed');
      };

      await expect(
        runner.startSimulation(99, '/bad/path.hex', defaultOptions),
      ).rejects.toThrow('spawn failed');

      // Session should not exist
      expect(runner.hasSession('anything')).toBe(false);

      // Restore
      manager.spawn = origSpawn;
    });
  });

  // -- stopSimulation --

  describe('stopSimulation', () => {
    it('should stop a running session', async () => {
      const sessionId = await runner.startSimulation(1, '/path/to/firmware.hex', defaultOptions);
      await runner.stopSimulation(sessionId);

      const status = runner.getStatus(sessionId);
      expect(status.state).toBe('idle');
    });

    it('should throw for unknown session ID', async () => {
      await expect(runner.stopSimulation('nonexistent')).rejects.toThrow('Session not found');
    });
  });

  // -- resetSimulation --

  describe('resetSimulation', () => {
    it('should reset a session and clear events', async () => {
      const sessionId = await runner.startSimulation(1, '/path/to/firmware.hex', defaultOptions);

      // Verify session exists and is running
      expect(runner.getStatus(sessionId).state).toBe('running');

      await runner.resetSimulation(sessionId);

      // Session should still exist and be running after reset
      expect(runner.hasSession(sessionId)).toBe(true);
      expect(runner.getStatus(sessionId).state).toBe('running');
      expect(runner.getStatus(sessionId).eventCount).toBe(0);
    });

    it('should throw for unknown session ID', async () => {
      await expect(runner.resetSimulation('nonexistent')).rejects.toThrow('Session not found');
    });

    it('should reset cycle count to zero', async () => {
      const sessionId = await runner.startSimulation(1, '/path/to/firmware.hex', defaultOptions);
      await runner.resetSimulation(sessionId);

      const status = runner.getStatus(sessionId);
      expect(status.cycleCount).toBe(0);
    });
  });

  // -- getEvents --

  describe('getEvents', () => {
    it('should return empty array for a fresh session', async () => {
      const sessionId = await runner.startSimulation(1, '/path/to/firmware.hex', defaultOptions);
      const events = runner.getEvents(sessionId);
      expect(events).toEqual([]);
    });

    it('should throw for unknown session ID', () => {
      expect(() => runner.getEvents('nonexistent')).toThrow('Session not found');
    });

    it('should return events pushed to the buffer', async () => {
      const sessionId = await runner.startSimulation(1, '/path/to/firmware.hex', defaultOptions);
      const buffer = runner.getEventBuffer(sessionId);
      expect(buffer).not.toBeNull();

      buffer!.push({
        type: 'pin_change',
        pin: 'PB0',
        value: 1,
        timestampNs: 1000,
      });
      buffer!.push({
        type: 'pin_change',
        pin: 'PB1',
        value: 0,
        timestampNs: 2000,
      });

      const events = runner.getEvents(sessionId);
      expect(events).toHaveLength(2);
      expect(events[0].type).toBe('pin_change');
    });

    it('should filter events by since parameter', async () => {
      const sessionId = await runner.startSimulation(1, '/path/to/firmware.hex', defaultOptions);
      const buffer = runner.getEventBuffer(sessionId)!;

      buffer.push({ type: 'pin_change', pin: 'PB0', value: 1, timestampNs: 1000 });
      buffer.push({ type: 'pin_change', pin: 'PB1', value: 0, timestampNs: 2000 });
      buffer.push({ type: 'pin_change', pin: 'PB2', value: 1, timestampNs: 3000 });

      const filtered = runner.getEvents(sessionId, 1500);
      expect(filtered).toHaveLength(2);
      expect(filtered[0].timestampNs).toBe(2000);
      expect(filtered[1].timestampNs).toBe(3000);
    });
  });

  // -- getEventBuffer --

  describe('getEventBuffer', () => {
    it('should return the buffer for a valid session', async () => {
      const sessionId = await runner.startSimulation(1, '/path/to/firmware.hex', defaultOptions);
      const buffer = runner.getEventBuffer(sessionId);
      expect(buffer).toBeInstanceOf(RuntimeEventBuffer);
    });

    it('should return null for an unknown session', () => {
      expect(runner.getEventBuffer('nonexistent')).toBeNull();
    });
  });

  // -- getStatus --

  describe('getStatus', () => {
    it('should return correct initial status', async () => {
      const sessionId = await runner.startSimulation(1, '/path/to/firmware.hex', defaultOptions);
      const status = runner.getStatus(sessionId);

      expect(status.sessionId).toBe(sessionId);
      expect(status.state).toBe('running');
      expect(status.cycleCount).toBe(0);
      expect(status.eventCount).toBe(0);
      expect(status.lastEvent).toBeNull();
      expect(status.uptime).toBeGreaterThanOrEqual(0);
    });

    it('should reflect event count after pushing events', async () => {
      const sessionId = await runner.startSimulation(1, '/path/to/firmware.hex', defaultOptions);
      const buffer = runner.getEventBuffer(sessionId)!;

      buffer.push({ type: 'pin_change', pin: 'PB0', value: 1, timestampNs: 1000 });
      buffer.push({ type: 'uart_data', port: 0, byte: 65, char: 'A', timestampNs: 2000 });

      const status = runner.getStatus(sessionId);
      expect(status.eventCount).toBe(2);
      expect(status.lastEvent).not.toBeNull();
      expect(status.lastEvent!.type).toBe('uart_data');
    });

    it('should throw for unknown session ID', () => {
      expect(() => runner.getStatus('nonexistent')).toThrow('Session not found');
    });
  });

  // -- hasSession --

  describe('hasSession', () => {
    it('should return false for unknown session', () => {
      expect(runner.hasSession('nope')).toBe(false);
    });

    it('should return true for active session', async () => {
      const sessionId = await runner.startSimulation(1, '/path/to/firmware.hex', defaultOptions);
      expect(runner.hasSession(sessionId)).toBe(true);
    });
  });

  // -- removeSession --

  describe('removeSession', () => {
    it('should remove a session from tracking', async () => {
      const sessionId = await runner.startSimulation(1, '/path/to/firmware.hex', defaultOptions);
      await runner.stopSimulation(sessionId);
      runner.removeSession(sessionId);
      expect(runner.hasSession(sessionId)).toBe(false);
    });

    it('should be a no-op for unknown session', () => {
      expect(() => runner.removeSession('nonexistent')).not.toThrow();
    });
  });

  // -- stopAll --

  describe('stopAll', () => {
    it('should stop all active sessions', async () => {
      const id1 = await runner.startSimulation(1, '/path/to/fw1.hex', defaultOptions);
      const id2 = await runner.startSimulation(2, '/path/to/fw2.hex', defaultOptions);

      expect(runner.hasSession(id1)).toBe(true);
      expect(runner.hasSession(id2)).toBe(true);

      await runner.stopAll();

      expect(runner.hasSession(id1)).toBe(false);
      expect(runner.hasSession(id2)).toBe(false);
    });

    it('should handle empty sessions gracefully', async () => {
      await expect(runner.stopAll()).resolves.toBeUndefined();
    });
  });

  // -- stdout/stderr event wiring --

  describe('event wiring', () => {
    it('should parse UART data from stderr', async () => {
      const sessionId = await runner.startSimulation(1, '/path/to/firmware.hex', defaultOptions);
      const manager = SimulatorProcessManager.getOrCreate(1);

      // Simulate stderr output from simavr
      manager.emit('stderr', 'UART0: 48\n');

      const events = runner.getEvents(sessionId);
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('uart_data');
      if (events[0].type === 'uart_data') {
        expect(events[0].byte).toBe(0x48);
        expect(events[0].char).toBe('H');
        expect(events[0].port).toBe(0);
      }
    });

    it('should handle error events from process manager', async () => {
      const sessionId = await runner.startSimulation(1, '/path/to/firmware.hex', defaultOptions);
      const manager = SimulatorProcessManager.getOrCreate(1);

      manager.emit('error', new Error('process crashed'));

      const events = runner.getEvents(sessionId);
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('error');
      if (events[0].type === 'error') {
        expect(events[0].message).toBe('process crashed');
      }
    });

    it('should handle VCD output when vcdOutput is enabled', async () => {
      const sessionId = await runner.startSimulation(1, '/path/to/firmware.hex', {
        ...defaultOptions,
        vcdOutput: true,
      });
      const manager = SimulatorProcessManager.getOrCreate(1);

      // Simulate VCD header
      manager.emit('stdout', '$var wire 1 ! portb0 $end\n');
      manager.emit('stdout', '$enddefinitions $end\n');

      // Simulate VCD body — timestamp then value change
      manager.emit('stdout', '#1000\n');
      manager.emit('stdout', '1!\n');

      const events = runner.getEvents(sessionId);
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('pin_change');
      if (events[0].type === 'pin_change') {
        expect(events[0].pin).toBe('portb0');
        expect(events[0].value).toBe(1);
        expect(events[0].timestampNs).toBe(1000);
      }
    });

    it('should skip empty lines in stdout', async () => {
      const sessionId = await runner.startSimulation(1, '/path/to/firmware.hex', defaultOptions);
      const manager = SimulatorProcessManager.getOrCreate(1);

      manager.emit('stdout', '\n\n\n');

      const events = runner.getEvents(sessionId);
      expect(events).toHaveLength(0);
    });

    it('should skip empty lines in stderr', async () => {
      const sessionId = await runner.startSimulation(1, '/path/to/firmware.hex', defaultOptions);
      const manager = SimulatorProcessManager.getOrCreate(1);

      manager.emit('stderr', '\n\n\n');

      const events = runner.getEvents(sessionId);
      expect(events).toHaveLength(0);
    });
  });
});
