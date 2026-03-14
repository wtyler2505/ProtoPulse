import crypto from 'crypto';
import { SimulatorProcessManager } from './process-manager';
import type { ProcessStatus } from './process-manager';
import type { RuntimeEvent, VcdSignalMap } from './runtime-events';
import {
  RuntimeEventBuffer,
  parseUartLine,
  parseVcdHeader,
  parseVcdTimestamp,
  parseVcdValueChange,
} from './runtime-events';
import type { IStorage } from '../storage';
import { logger } from '../logger';

export interface SimRunOptions {
  mcu: string;
  freq: number;
  enableGdb: boolean;
  vcdOutput: boolean;
}

export interface SimStatus {
  sessionId: string;
  state: ProcessStatus;
  uptime: number;
  cycleCount: number;
  eventCount: number;
  lastEvent: RuntimeEvent | null;
}

interface ActiveSession {
  manager: SimulatorProcessManager;
  events: RuntimeEventBuffer;
  projectId: number;
  firmwarePath: string;
  options: SimRunOptions;
  startedAt: number;
  cycleCount: number;
  vcdSignalMap: VcdSignalMap;
  vcdTimestampNs: number;
  vcdHeaderLines: string[];
  vcdHeaderParsed: boolean;
}

/**
 * High-level orchestrator that ties SimulatorProcessManager + RuntimeEventBuffer
 * together. Manages simulation sessions with unique IDs and provides a clean
 * API surface for the Express routes.
 */
export class SimavrRunner {
  private sessions = new Map<string, ActiveSession>();

  constructor(private storage: IStorage) {}

  /**
   * Start a new simulation session. Spawns a simavr process and wires
   * stdout/stderr into the runtime event parser.
   */
  async startSimulation(
    projectId: number,
    firmwarePath: string,
    options: SimRunOptions,
  ): Promise<string> {
    const sessionId = crypto.randomUUID();
    const manager = SimulatorProcessManager.getOrCreate(projectId);
    const events = new RuntimeEventBuffer();

    const session: ActiveSession = {
      manager,
      events,
      projectId,
      firmwarePath,
      options,
      startedAt: Date.now(),
      cycleCount: 0,
      vcdSignalMap: new Map(),
      vcdTimestampNs: 0,
      vcdHeaderLines: [],
      vcdHeaderParsed: false,
    };

    // Wire stdout lines into the event parser
    const handleStdout = (data: string): void => {
      const lines = data.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) {
          continue;
        }

        if (options.vcdOutput) {
          this.handleVcdLine(session, trimmed);
        } else {
          // Non-VCD mode: try UART parsing on stdout too
          const uartEvent = parseUartLine(trimmed, Date.now() * 1_000_000);
          if (uartEvent) {
            events.push(uartEvent);
          }
        }
      }
    };

    // Wire stderr — simavr sends UART data and errors on stderr
    const handleStderr = (data: string): void => {
      const lines = data.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) {
          continue;
        }
        const uartEvent = parseUartLine(trimmed, Date.now() * 1_000_000);
        if (uartEvent) {
          events.push(uartEvent);
        }
      }
    };

    const handleExit = (code: number | null, signal: NodeJS.Signals | null): void => {
      logger.info(
        `[simavr-runner] Session ${sessionId} exited: code=${String(code)}, signal=${String(signal)}`,
      );
    };

    const handleError = (err: Error): void => {
      logger.error(`[simavr-runner] Session ${sessionId} error: ${err.message}`);
      events.push({
        type: 'error',
        message: err.message,
        timestampNs: Date.now() * 1_000_000,
      });
    };

    manager.on('stdout', handleStdout);
    manager.on('stderr', handleStderr);
    manager.on('exit', handleExit);
    manager.on('error', handleError);

    this.sessions.set(sessionId, session);

    try {
      await manager.spawn(firmwarePath, options.mcu, options.freq, {
        gdb: options.enableGdb,
      });
    } catch (err) {
      // Clean up the session on spawn failure
      this.sessions.delete(sessionId);
      manager.removeListener('stdout', handleStdout);
      manager.removeListener('stderr', handleStderr);
      manager.removeListener('exit', handleExit);
      manager.removeListener('error', handleError);
      throw err;
    }

    return sessionId;
  }

  /**
   * Stop a running simulation session.
   */
  async stopSimulation(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    await session.manager.stop();
  }

  /**
   * Reset (restart) a simulation session with the same options.
   */
  async resetSimulation(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    session.events.clear();
    session.cycleCount = 0;
    session.startedAt = Date.now();
    session.vcdSignalMap = new Map();
    session.vcdTimestampNs = 0;
    session.vcdHeaderLines = [];
    session.vcdHeaderParsed = false;

    await session.manager.restart();
  }

  /**
   * Get events from a session, optionally filtered to events after a timestampNs.
   */
  getEvents(sessionId: string, since?: number): RuntimeEvent[] {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    if (since !== undefined) {
      return session.events.getSince(since);
    }

    return session.events.getAll();
  }

  /**
   * Get the event buffer for a session (for SSE streaming).
   */
  getEventBuffer(sessionId: string): RuntimeEventBuffer | null {
    const session = this.sessions.get(sessionId);
    return session?.events ?? null;
  }

  /**
   * Get the current status of a simulation session.
   */
  getStatus(sessionId: string): SimStatus {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const allEvents = session.events.getAll();
    const lastEvent = allEvents.length > 0 ? allEvents[allEvents.length - 1] : null;

    return {
      sessionId,
      state: session.manager.getStatus(),
      uptime: Date.now() - session.startedAt,
      cycleCount: session.cycleCount,
      eventCount: allEvents.length,
      lastEvent,
    };
  }

  /**
   * Check if a session exists.
   */
  hasSession(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  /**
   * Remove a session from the active sessions map.
   * Call after stopping if you want to fully clean up.
   */
  removeSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  /**
   * Stop all active sessions. Used during graceful shutdown.
   */
  async stopAll(): Promise<void> {
    const sessionIds = Array.from(this.sessions.keys());
    await Promise.all(sessionIds.map((id) => this.stopSimulation(id).catch(() => {})));
    this.sessions.clear();
  }

  // -- Private helpers --

  /**
   * Process a single VCD line through header/timestamp/value-change parsing.
   * Accumulates header lines until $enddefinitions, then parses value changes.
   */
  private handleVcdLine(session: ActiveSession, line: string): void {
    // Still collecting header lines
    if (!session.vcdHeaderParsed) {
      session.vcdHeaderLines.push(line);
      if (line.startsWith('$enddefinitions')) {
        session.vcdSignalMap = parseVcdHeader(session.vcdHeaderLines);
        session.vcdHeaderParsed = true;
      }
      return;
    }

    // Check for timestamp update
    const ts = parseVcdTimestamp(line);
    if (ts !== null) {
      session.vcdTimestampNs = ts;
      return;
    }

    // Try to parse as a value change
    const pinEvent = parseVcdValueChange(line, session.vcdSignalMap, session.vcdTimestampNs);
    if (pinEvent) {
      session.events.push(pinEvent);
    }
  }
}
