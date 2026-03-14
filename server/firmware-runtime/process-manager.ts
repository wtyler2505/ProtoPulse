import { spawn } from 'child_process';
import type { ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

export type ProcessStatus = 'idle' | 'starting' | 'running' | 'stopping' | 'error';

export interface SpawnOptions {
  gdb?: boolean;
  gdbPort?: number;
  env?: Record<string, string>;
}

interface SpawnArgs {
  firmwarePath: string;
  mcu: string;
  freq: number;
  options?: SpawnOptions;
}

export interface SimulatorProcessManagerEvents {
  stdout: (data: string) => void;
  stderr: (data: string) => void;
  exit: (code: number | null, signal: NodeJS.Signals | null) => void;
  error: (err: Error) => void;
  status: (status: ProcessStatus) => void;
}

const SIMAVR_PATH = '/usr/bin/simavr';
const SIGKILL_TIMEOUT_MS = 5000;

/**
 * Manages the lifecycle of a single simavr child process.
 * Provides spawn/stop/restart with SIGTERM→SIGKILL escalation,
 * stdout/stderr streaming, and per-project singleton access.
 */
export class SimulatorProcessManager extends EventEmitter {
  private static instances = new Map<number, SimulatorProcessManager>();

  private process: ChildProcess | null = null;
  private status: ProcessStatus = 'idle';
  private lastSpawnArgs: SpawnArgs | null = null;
  private killTimer: ReturnType<typeof setTimeout> | null = null;

  private constructor(public readonly projectId: number) {
    super();
  }

  /**
   * Get or create a SimulatorProcessManager for the given project.
   */
  static getOrCreate(projectId: number): SimulatorProcessManager {
    let instance = SimulatorProcessManager.instances.get(projectId);
    if (!instance) {
      instance = new SimulatorProcessManager(projectId);
      SimulatorProcessManager.instances.set(projectId, instance);
    }
    return instance;
  }

  /**
   * Get an existing instance without creating one. Returns undefined if none exists.
   */
  static get(projectId: number): SimulatorProcessManager | undefined {
    return SimulatorProcessManager.instances.get(projectId);
  }

  /**
   * Destroy the singleton for a project, stopping any running process first.
   */
  static async destroy(projectId: number): Promise<void> {
    const instance = SimulatorProcessManager.instances.get(projectId);
    if (instance) {
      await instance.stop();
      instance.removeAllListeners();
      SimulatorProcessManager.instances.delete(projectId);
    }
  }

  /**
   * Stop and destroy all instances. Used during graceful shutdown.
   */
  static async destroyAll(): Promise<void> {
    const ids = Array.from(SimulatorProcessManager.instances.keys());
    await Promise.all(ids.map((id) => SimulatorProcessManager.destroy(id)));
  }

  /**
   * Spawn a simavr process for the given firmware.
   */
  async spawn(firmwarePath: string, mcu: string, freq: number, options?: SpawnOptions): Promise<void> {
    if (this.status === 'running' || this.status === 'starting') {
      throw new Error(`Process already ${this.status} for project ${this.projectId}`);
    }

    this.lastSpawnArgs = { firmwarePath, mcu, freq, options };
    this.setStatus('starting');

    const args = this.buildArgs(firmwarePath, mcu, freq, options);
    const env = options?.env ? { ...process.env, ...options.env } : process.env;

    try {
      const child = spawn(SIMAVR_PATH, args, {
        stdio: 'pipe',
        env,
      });

      this.process = child;

      child.stdout?.on('data', (data: Buffer) => {
        this.emit('stdout', data.toString());
      });

      child.stderr?.on('data', (data: Buffer) => {
        this.emit('stderr', data.toString());
      });

      child.on('error', (err: Error) => {
        this.clearKillTimer();
        this.setStatus('error');
        this.process = null;
        this.emit('error', err);
      });

      child.on('close', (code: number | null, signal: NodeJS.Signals | null) => {
        this.clearKillTimer();
        const wasStoppingOrError = this.status === 'stopping' || this.status === 'error';
        this.process = null;

        if (!wasStoppingOrError && code !== 0) {
          this.setStatus('error');
        } else if (this.status !== 'error') {
          this.setStatus('idle');
        }

        this.emit('exit', code, signal);
      });

      // If spawn succeeds (process has a pid), mark as running
      if (child.pid !== undefined) {
        this.setStatus('running');
      }
    } catch (err) {
      this.setStatus('error');
      this.process = null;
      throw err;
    }
  }

  /**
   * Stop the running process. Sends SIGTERM first, then SIGKILL after 5 seconds.
   */
  async stop(): Promise<void> {
    if (this.status === 'idle' || !this.process) {
      return;
    }

    if (this.status === 'stopping') {
      // Already stopping — wait for completion
      return this.waitForExit();
    }

    this.setStatus('stopping');
    const child = this.process;

    return new Promise<void>((resolve) => {
      const onClose = () => {
        this.clearKillTimer();
        resolve();
      };

      child.once('close', onClose);

      // Send SIGTERM
      child.kill('SIGTERM');

      // Escalate to SIGKILL after timeout
      this.killTimer = setTimeout(() => {
        if (this.process === child) {
          child.kill('SIGKILL');
        }
      }, SIGKILL_TIMEOUT_MS);
    });
  }

  /**
   * Restart the process with the same arguments used in the last spawn call.
   */
  async restart(): Promise<void> {
    if (!this.lastSpawnArgs) {
      throw new Error(`Cannot restart: no previous spawn arguments for project ${this.projectId}`);
    }

    const { firmwarePath, mcu, freq, options } = this.lastSpawnArgs;
    await this.stop();
    await this.spawn(firmwarePath, mcu, freq, options);
  }

  /**
   * Get the current process status.
   */
  getStatus(): ProcessStatus {
    return this.status;
  }

  /**
   * Get the PID of the running process, or null if not running.
   */
  getPid(): number | null {
    return this.process?.pid ?? null;
  }

  // -- Private helpers --

  private buildArgs(firmwarePath: string, mcu: string, freq: number, options?: SpawnOptions): string[] {
    const args = ['--mcu', mcu, '-f', String(freq)];

    if (options?.gdb) {
      args.push('--gdb');
      if (options.gdbPort && options.gdbPort !== 1234) {
        args.push('--gdb-port', String(options.gdbPort));
      }
    }

    args.push(firmwarePath);
    return args;
  }

  private setStatus(newStatus: ProcessStatus): void {
    if (this.status !== newStatus) {
      this.status = newStatus;
      this.emit('status', newStatus);
    }
  }

  private clearKillTimer(): void {
    if (this.killTimer) {
      clearTimeout(this.killTimer);
      this.killTimer = null;
    }
  }

  private waitForExit(): Promise<void> {
    return new Promise<void>((resolve) => {
      if (!this.process) {
        resolve();
        return;
      }
      this.process.once('close', () => {
        resolve();
      });
    });
  }
}
