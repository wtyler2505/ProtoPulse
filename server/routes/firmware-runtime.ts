import type { Express } from 'express';
import type { IStorage } from '../storage';
import { z } from 'zod';
import { fromZodError } from 'zod-validation-error';
import { asyncHandler, parseIdParam } from './utils';
import { requireProjectOwnership } from './auth-middleware';
import { SimavrRunner } from '../firmware-runtime/simavr-runner';
import type { RuntimeEvent } from '../firmware-runtime/runtime-events';
import { logger } from '../logger';

let runner: SimavrRunner | null = null;

function getRunner(storage: IStorage): SimavrRunner {
  if (!runner) {
    runner = new SimavrRunner(storage);
  }
  return runner;
}

const simulateBodySchema = z.object({
  firmwarePath: z.string().min(1),
  mcu: z.string().min(1).default('atmega328p'),
  freq: z.number().int().positive().default(16_000_000),
  enableGdb: z.boolean().default(false),
  vcdOutput: z.boolean().default(false),
});

export function registerFirmwareRuntimeRoutes(app: Express, storage: IStorage): void {
  const prefix = '/api/projects/:id/firmware/simulate';
  const svc = getRunner(storage);

  // --- Start simulation ---
  app.post(prefix, requireProjectOwnership, asyncHandler(async (req, res) => {
    const projectId = parseIdParam(req.params.id);
    const parsed = simulateBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid request: ' + fromZodError(parsed.error).toString() });
    }

    const { firmwarePath, mcu, freq, enableGdb, vcdOutput } = parsed.data;

    try {
      const sessionId = await svc.startSimulation(projectId, firmwarePath, {
        mcu,
        freq,
        enableGdb,
        vcdOutput,
      });
      res.status(201).json({ sessionId });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start simulation';
      logger.error(`[firmware-runtime] Start failed: ${message}`);
      return res.status(500).json({ message });
    }
  }));

  // --- Stop simulation ---
  app.post(`${prefix}/:sessionId/stop`, requireProjectOwnership, asyncHandler(async (req, res) => {
    const sessionId = String(req.params.sessionId);
    if (!svc.hasSession(sessionId)) {
      return res.status(404).json({ message: 'Session not found' });
    }

    await svc.stopSimulation(sessionId);
    res.status(204).end();
  }));

  // --- Reset simulation ---
  app.post(`${prefix}/:sessionId/reset`, requireProjectOwnership, asyncHandler(async (req, res) => {
    const sessionId = String(req.params.sessionId);
    if (!svc.hasSession(sessionId)) {
      return res.status(404).json({ message: 'Session not found' });
    }

    await svc.resetSimulation(sessionId);
    res.json({ success: true });
  }));

  // --- SSE event stream ---
  app.get(`${prefix}/:sessionId/events`, requireProjectOwnership, asyncHandler(async (req, res) => {
    const sessionId = String(req.params.sessionId);
    if (!svc.hasSession(sessionId)) {
      return res.status(404).json({ message: 'Session not found' });
    }

    const eventBuffer = svc.getEventBuffer(sessionId);
    if (!eventBuffer) {
      return res.status(404).json({ message: 'Session not found' });
    }

    // SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const sendEvent = (event: RuntimeEvent): void => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    // Send all buffered events (late-join replay)
    const buffered = eventBuffer.getAll();
    for (const event of buffered) {
      sendEvent(event);
    }

    // Track the last sent timestamp to avoid duplicates
    let lastSentCount = buffered.length;

    // Poll for new events on a short interval
    // (RuntimeEventBuffer is not an EventEmitter, so we poll)
    const pollInterval = setInterval(() => {
      if (!svc.hasSession(sessionId)) {
        cleanup();
        return;
      }

      const allEvents = eventBuffer.getAll();
      if (allEvents.length > lastSentCount) {
        const newEvents = allEvents.slice(lastSentCount);
        for (const event of newEvents) {
          sendEvent(event);
        }
        lastSentCount = allEvents.length;
      }
    }, 100);

    // Heartbeat to keep connection alive
    const heartbeat = setInterval(() => {
      res.write(':heartbeat\n\n');
    }, 15_000);

    const cleanup = (): void => {
      clearInterval(pollInterval);
      clearInterval(heartbeat);
      if (!res.writableEnded) {
        res.end();
      }
    };

    // Clean up if client disconnects
    req.on('close', cleanup);
  }));

  // --- Get session status ---
  app.get(`${prefix}/:sessionId/status`, requireProjectOwnership, asyncHandler(async (req, res) => {
    const sessionId = String(req.params.sessionId);
    if (!svc.hasSession(sessionId)) {
      return res.status(404).json({ message: 'Session not found' });
    }

    const status = svc.getStatus(sessionId);
    res.json(status);
  }));
}
