import type { Express } from 'express';
import type { IStorage } from '../storage';
import { z } from 'zod';
import { fromZodError } from 'zod-validation-error';
import { createReadStream } from 'fs';
import { basename } from 'path';
import {
  insertArduinoWorkspaceSchema,
  insertArduinoBuildProfileSchema,
  insertArduinoJobSchema,
  insertArduinoSerialSessionSchema
} from '@shared/schema';
import { asyncHandler, parseIdParam, payloadLimit } from './utils';
import { requireProjectOwnership } from './auth-middleware';
import { ArduinoService } from '../arduino-service';
import type { JobStreamEvent } from '../arduino-service';
import { logger } from '../logger';

/**
 * Shape of `ArduinoJob.args` (stored as jsonb) for compile/upload jobs.
 * Drizzle types `args` as `unknown`; this is the contract our service writes.
 */
interface ArduinoJobArgs {
  fqbn?: string;
  sketchPath?: string;
  [key: string]: unknown;
}

function getJobArgs(job: { args: unknown }): ArduinoJobArgs {
  return (job.args && typeof job.args === 'object' ? job.args : {}) as ArduinoJobArgs;
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  try { return JSON.stringify(err); } catch { return String(err); }
}

let arduinoService: ArduinoService | null = null;

function getArduinoService(storage: IStorage): ArduinoService {
  if (!arduinoService) {
    arduinoService = new ArduinoService(storage);
  }
  return arduinoService;
}

export function registerArduinoRoutes(app: Express, storage: IStorage): void {
  const arduinoPrefix = '/api/projects/:id/arduino';
  const service = getArduinoService(storage);

  // --- Health & Preflight ---
  app.get(`${arduinoPrefix}/health`, requireProjectOwnership, asyncHandler(async (req, res) => {
    const health = await service.getHealth();
    if (health.status === 'error') return res.status(503).json(health);
    res.json(health);
  }));

  // --- Workspace ---
  app.get(`${arduinoPrefix}/workspace`, requireProjectOwnership, asyncHandler(async (req, res) => {
    const projectId = parseIdParam(req.params.id);
    const workspace = await service.ensureWorkspace(projectId);

    // Auto-scan on access to keep metadata fresh
    await service.scanWorkspace(workspace.id).catch(e => logger.warn(`[arduino:scan] ${e.message}`));

    res.json(workspace);
  }));

  app.get(`${arduinoPrefix}/files`, requireProjectOwnership, asyncHandler(async (req, res) => {
    const projectId = parseIdParam(req.params.id);
    const workspace = await service.ensureWorkspace(projectId);
    const files = await storage.getArduinoSketchFiles(workspace.id);
    res.json({ data: files, total: files.length });
  }));

  app.get(`${arduinoPrefix}/files/read`, requireProjectOwnership, asyncHandler(async (req, res) => {
    const projectId = parseIdParam(req.params.id);
    const workspace = await service.ensureWorkspace(projectId);
    const path = req.query.path as string;
    if (!path) return res.status(400).json({ message: 'Missing file path' });

    const content = await service.readFile(workspace.id, path);
    res.json({ content });
  }));

  app.post(`${arduinoPrefix}/files/write`, requireProjectOwnership, payloadLimit(1024 * 1024), asyncHandler(async (req, res) => {
    const projectId = parseIdParam(req.params.id);
    const workspace = await service.ensureWorkspace(projectId);
    const { path, content } = req.body;
    if (!path) return res.status(400).json({ message: 'Missing file path' });

    await service.writeFile(workspace.id, path, content || '');
    res.json({ success: true });
  }));

  app.post(`${arduinoPrefix}/files/create`, requireProjectOwnership, payloadLimit(16 * 1024), asyncHandler(async (req, res) => {
    const projectId = parseIdParam(req.params.id);
    const workspace = await service.ensureWorkspace(projectId);
    const { path, content } = req.body;
    if (!path) return res.status(400).json({ message: 'Missing file path' });

    await service.createFile(workspace.id, path, content || '');
    res.status(201).json({ success: true });
  }));

  app.delete(`${arduinoPrefix}/files/:fileId`, requireProjectOwnership, asyncHandler(async (req, res) => {
    const fileId = parseIdParam(req.params.fileId);
    const deleted = await service.deleteFile(fileId);
    if (!deleted) return res.status(404).json({ message: 'File not found' });
    res.status(204).end();
  }));

  // --- Board Discovery ---
  app.get(`${arduinoPrefix}/boards/discover`, requireProjectOwnership, asyncHandler(async (req, res) => {
    const boards = await service.discoverBoards();
    res.json({ data: boards });
  }));

  // --- Sketch Generation ---
  app.post(`${arduinoPrefix}/generate-sketch`, requireProjectOwnership, payloadLimit(16 * 1024), asyncHandler(async (req, res) => {
    const projectId = parseIdParam(req.params.id);
    const { intent } = req.body;
    if (!intent) return res.status(400).json({ message: 'Missing generation intent' });

    const sketch = await service.generateSketch(projectId, intent);
    res.json({ sketch });
  }));

  // --- Library Management ---
  app.get(`${arduinoPrefix}/libraries/search`, requireProjectOwnership, asyncHandler(async (req, res) => {
    const query = req.query.q as string;
    if (!query) return res.status(400).json({ message: 'Missing search query' });
    const results = await service.searchLibraries(query);
    res.json({ data: results });
  }));

  app.get(`${arduinoPrefix}/libraries/installed`, requireProjectOwnership, asyncHandler(async (_req, res) => {
    const results = await service.listInstalledLibraries();
    res.json({ data: results });
  }));

  app.post(`${arduinoPrefix}/libraries/install`, requireProjectOwnership, payloadLimit(8 * 1024), asyncHandler(async (req, res) => {
    const { name } = req.body;
    if (!name || typeof name !== 'string') return res.status(400).json({ message: 'Missing library name' });
    const result = await service.installLibrary(name);
    if (!result.success) return res.status(500).json({ message: result.output });
    res.json({ success: true, output: result.output });
  }));

  app.post(`${arduinoPrefix}/libraries/uninstall`, requireProjectOwnership, payloadLimit(8 * 1024), asyncHandler(async (req, res) => {
    const { name } = req.body;
    if (!name || typeof name !== 'string') return res.status(400).json({ message: 'Missing library name' });
    const result = await service.uninstallLibrary(name);
    if (!result.success) return res.status(500).json({ message: result.output });
    res.json({ success: true, output: result.output });
  }));

  // --- Board / Core Management ---
  app.get(`${arduinoPrefix}/cores/list`, requireProjectOwnership, asyncHandler(async (_req, res) => {
    const cores = await service.listCores();
    res.json({ data: cores });
  }));

  app.get(`${arduinoPrefix}/cores/search`, requireProjectOwnership, asyncHandler(async (req, res) => {
    const query = req.query.q as string;
    if (!query) return res.status(400).json({ message: 'Missing search query' });
    const results = await service.searchCores(query);
    res.json({ data: results });
  }));

  app.post(`${arduinoPrefix}/cores/install`, requireProjectOwnership, payloadLimit(8 * 1024), asyncHandler(async (req, res) => {
    const { platform } = req.body;
    if (!platform || typeof platform !== 'string') return res.status(400).json({ message: 'Missing platform identifier' });
    const result = await service.installCore(platform);
    if (!result.success) return res.status(500).json({ message: result.output });
    res.json({ success: true, output: result.output });
  }));

  app.post(`${arduinoPrefix}/cores/uninstall`, requireProjectOwnership, payloadLimit(8 * 1024), asyncHandler(async (req, res) => {
    const { platform } = req.body;
    if (!platform || typeof platform !== 'string') return res.status(400).json({ message: 'Missing platform identifier' });
    const result = await service.uninstallCore(platform);
    if (!result.success) return res.status(500).json({ message: result.output });
    res.json({ success: true, output: result.output });
  }));

  // --- Build Profiles ---
  app.get(`${arduinoPrefix}/profiles`, requireProjectOwnership, asyncHandler(async (req, res) => {
    const projectId = parseIdParam(req.params.id);
    const profiles = await storage.getArduinoBuildProfiles(projectId);
    res.json({ data: profiles, total: profiles.length });
  }));

  app.post(`${arduinoPrefix}/profiles`, requireProjectOwnership, payloadLimit(16 * 1024), asyncHandler(async (req, res) => {
    const projectId = parseIdParam(req.params.id);
    const parsed = insertArduinoBuildProfileSchema.safeParse({ ...req.body, projectId });
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid request: ' + fromZodError(parsed.error).toString() });
    }
    const profile = await storage.createArduinoBuildProfile(parsed.data);
    res.status(201).json(profile);
  }));

  app.patch(`${arduinoPrefix}/profiles/:profileId`, requireProjectOwnership, payloadLimit(16 * 1024), asyncHandler(async (req, res) => {
    const profileId = parseIdParam(req.params.profileId);
    const updated = await storage.updateArduinoBuildProfile(profileId, req.body);
    if (!updated) return res.status(404).json({ message: 'Profile not found' });
    res.json(updated);
  }));

  app.delete(`${arduinoPrefix}/profiles/:profileId`, requireProjectOwnership, asyncHandler(async (req, res) => {
    const profileId = parseIdParam(req.params.profileId);
    const deleted = await storage.deleteArduinoBuildProfile(profileId);
    if (!deleted) return res.status(404).json({ message: 'Profile not found' });
    res.status(204).end();
  }));
  // --- Live Syntax Check (BL-0602) ---
  app.post(`${arduinoPrefix}/check-syntax`, requireProjectOwnership, payloadLimit(16 * 1024), asyncHandler(async (req, res) => {
    const projectId = parseIdParam(req.params.id);
    const { fqbn, sketchPath: clientPath, filename, sourceCode } = req.body;

    if (!fqbn || !filename || typeof sourceCode !== 'string') {
      return res.status(400).json({ message: 'Missing fqbn, filename, or sourceCode' });
    }

    const workspace = await storage.getArduinoWorkspace(projectId);
    if (!workspace) {
      return res.status(404).json({ message: 'Workspace not found' });
    }

    const sketchPath = (clientPath && clientPath !== '.') ? clientPath
      : (workspace.activeSketchPath ?? workspace.rootPath ?? '.');

    const stderr = await service.checkSyntax(projectId, fqbn, sketchPath, filename, sourceCode);
    
    res.json({ stderr });
  }));

  // --- Jobs (Compile/Upload) ---
  app.get(`${arduinoPrefix}/jobs`, requireProjectOwnership, asyncHandler(async (req, res) => {
    const projectId = parseIdParam(req.params.id);
    const jobs = await storage.getArduinoJobs(projectId);
    res.json({ data: jobs, total: jobs.length });
  }));

  app.get(`${arduinoPrefix}/jobs/:jobId`, requireProjectOwnership, asyncHandler(async (req, res) => {
    const jobId = parseIdParam(req.params.jobId);
    const job = await storage.getArduinoJob(jobId);
    if (!job) return res.status(404).json({ message: 'Job not found' });
    res.json(job);
  }));

  app.post(`${arduinoPrefix}/jobs/compile`, requireProjectOwnership, payloadLimit(16 * 1024), asyncHandler(async (req, res) => {
    const projectId = parseIdParam(req.params.id);

    // Resolve sketch path: prefer explicit client value, fall back to workspace activeSketchPath
    const clientPath: string = req.body.sketchPath ?? '';
    const workspace = await storage.getArduinoWorkspace(projectId);
    const sketchPath = (clientPath && clientPath !== '.') ? clientPath
      : (workspace?.activeSketchPath ?? workspace?.rootPath ?? '.');

    const job = await storage.createArduinoJob({
      projectId,
      jobType: 'compile',
      status: 'pending',
      command: 'arduino-cli compile',
      args: req.body,
      summary: 'Queued for compilation...',
    });

    // Start in background
    service.runJob(job.id, 'compile', [
      'compile',
      '--fqbn', req.body.fqbn,
      sketchPath,
    ]).catch(e => logger.error(`[arduino:compile] Job ${job.id} background failed: ${e.message}`));

    res.status(202).json(job);
  }));

  app.post(`${arduinoPrefix}/jobs/upload`, requireProjectOwnership, payloadLimit(16 * 1024), asyncHandler(async (req, res) => {
    const projectId = parseIdParam(req.params.id);

    // Resolve sketch path: prefer explicit client value, fall back to workspace activeSketchPath
    const clientPath: string = req.body.sketchPath ?? '';
    const workspace = await storage.getArduinoWorkspace(projectId);
    const sketchPath = (clientPath && clientPath !== '.') ? clientPath
      : (workspace?.activeSketchPath ?? workspace?.rootPath ?? '.');

    const job = await storage.createArduinoJob({
      projectId,
      jobType: 'upload',
      status: 'pending',
      command: 'arduino-cli upload',
      args: req.body,
      summary: 'Queued for upload...',
    });

    service.runJob(job.id, 'upload', [
      'upload',
      '--fqbn', req.body.fqbn,
      '--port', req.body.port,
      sketchPath,
    ]).catch(e => logger.error(`[arduino:upload] Job ${job.id} background failed: ${e.message}`));

    res.status(202).json(job);
  }));

  // --- Job Cancellation ---
  app.post(`${arduinoPrefix}/jobs/:jobId/cancel`, requireProjectOwnership, asyncHandler(async (req, res) => {
    const jobId = parseIdParam(req.params.jobId);
    const success = await service.cancelJob(jobId);
    if (!success) {
      return res.status(404).json({ message: 'Job not found or cannot be cancelled' });
    }
    res.json({ success: true, message: 'Job cancellation requested' });
  }));

  // --- Memory Breakdown Analysis (BL-0616) ---
  app.get(`${arduinoPrefix}/jobs/:jobId/memory`, requireProjectOwnership, asyncHandler(async (req, res) => {
    const jobId = parseIdParam(req.params.jobId);
    const job = await storage.getArduinoJob(jobId);
    if (!job || job.status !== 'completed' || job.jobType !== 'compile') {
      return res.status(400).json({ message: 'Memory analysis requires a successfully completed compile job.' });
    }

    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    
    // We need the .elf file specifically
    const jobArgs = getJobArgs(job);
    const fqbn = jobArgs.fqbn?.replace(/:/g, '.') || '';
    const sketchPath = jobArgs.sketchPath || '.';
    const { join, resolve } = await import('path');
    const buildDir = resolve(join(sketchPath, 'build', fqbn));
    
    try {
      const { readdir } = await import('fs/promises');
      const entries = await readdir(buildDir);
      const elfFile = entries.find(e => e.endsWith('.elf'));
      
      if (!elfFile) {
        return res.status(404).json({ message: 'No .elf file found to analyze.' });
      }

      const elfPath = join(buildDir, elfFile);
      
      // Use nm to get symbol sizes
      // -S = print size, --size-sort = sort by size, -C = demangle, -r = reverse sort
      // We also look for specific architecture nm tools if available, but host nm usually handles AVR/ESP ELFs ok enough to read sizes.
      const { stdout } = await execAsync(`nm -S --size-sort -r -C "${elfPath}"`);
      
      const symbols = stdout.split('\n').filter(Boolean).map(line => {
        // Output format: <address> <size> <type> <name>
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 4) {
          return {
            address: parts[0],
            size: parseInt(parts[1], 16),
            type: parts[2],
            name: parts.slice(3).join(' ')
          };
        }
        return null;
      }).filter(s => s && s.size > 0).slice(0, 100); // Top 100 symbols

      res.json({ 
        success: true, 
        elfPath,
        symbols 
      });
    } catch (e: any) {
      res.status(500).json({ message: 'Failed to analyze memory: ' + e.message });
    }
  }));

  // --- Job SSE Stream ---
  app.get(`${arduinoPrefix}/jobs/:jobId/stream`, requireProjectOwnership, asyncHandler(async (req, res) => {
    const jobId = parseIdParam(req.params.jobId);
    const job = await storage.getArduinoJob(jobId);
    if (!job) return res.status(404).json({ message: 'Job not found' });

    // SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const sendEvent = (event: JobStreamEvent) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    // If job already finished, send stored log lines + done event, then close
    const terminalStatuses = ['completed', 'failed', 'cancelled'];
    if (terminalStatuses.includes(job.status)) {
      if (job.log) {
        const lines = job.log.split('\n');
        for (const line of lines) {
          if (line.length > 0) {
            sendEvent({ type: 'log', content: line, timestamp: Date.now() });
          }
        }
      }
      sendEvent({ type: 'status', content: job.status, timestamp: Date.now() });
      sendEvent({ type: 'done', content: job.summary ?? job.status, timestamp: Date.now() });
      res.end();
      return;
    }

    // For pending jobs, send current status
    if (job.status === 'pending') {
      sendEvent({ type: 'status', content: 'pending', timestamp: Date.now() });
    }

    // Try to attach to the live stream
    const jobStream = service.getJobStream(jobId);
    if (!jobStream) {
      // No live stream (job may be pending and not yet spawned) — re-fetch to get latest state
      const freshJob = await storage.getArduinoJob(jobId);
      if (freshJob && terminalStatuses.includes(freshJob.status)) {
        if (freshJob.log) {
          const lines = freshJob.log.split('\n');
          for (const line of lines) {
            if (line.length > 0) {
              sendEvent({ type: 'log', content: line, timestamp: Date.now() });
            }
          }
        }
        sendEvent({ type: 'status', content: freshJob.status, timestamp: Date.now() });
        sendEvent({ type: 'done', content: freshJob.summary ?? freshJob.status, timestamp: Date.now() });
      } else {
        sendEvent({ type: 'status', content: freshJob?.status ?? 'pending', timestamp: Date.now() });
      }
      res.end();
      return;
    }

    // Send buffered events (late-join replay)
    for (const buffered of jobStream.getBuffer()) {
      sendEvent(buffered);
    }

    // Heartbeat to keep connection alive
    const heartbeat = setInterval(() => {
      res.write(':heartbeat\n\n');
    }, 15_000);

    // Listen for new events
    const onEvent = (event: JobStreamEvent) => {
      sendEvent(event);
      if (event.type === 'done') {
        cleanup();
      }
    };

    const cleanup = () => {
      clearInterval(heartbeat);
      jobStream.removeListener('event', onEvent);
      if (!res.writableEnded) {
        res.end();
      }
    };

    jobStream.on('event', onEvent);

    // Clean up if client disconnects
    req.on('close', cleanup);

    // If the stream already finished between getBuffer() and .on(), close now
    if (jobStream.finished && !res.writableEnded) {
      cleanup();
    }
  }));

  // --- Artifact Download ---
  app.get(`${arduinoPrefix}/jobs/:jobId/artifact`, requireProjectOwnership, asyncHandler(async (req, res) => {
    const jobId = parseIdParam(req.params.jobId);
    const artifactPath = await service.getArtifactPath(jobId);
    if (!artifactPath) {
      return res.status(404).json({ message: 'No compiled artifact found for this job' });
    }

    const filename = basename(artifactPath);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    const stream = createReadStream(artifactPath);
    stream.pipe(res);
    stream.on('error', () => {
      if (!res.headersSent) {
        res.status(500).json({ message: 'Failed to read artifact file' });
      }
    });
  }));

  // --- Serial Monitor ---
  app.get(`${arduinoPrefix}/serial`, requireProjectOwnership, asyncHandler(async (req, res) => {
    const projectId = parseIdParam(req.params.id);
    const sessions = await storage.getArduinoSerialSessions(projectId);
    res.json({ data: sessions, total: sessions.length });
  }));

  app.post(`${arduinoPrefix}/serial/open`, requireProjectOwnership, payloadLimit(8 * 1024), asyncHandler(async (req, res) => {
    const projectId = parseIdParam(req.params.id);
    const parsed = insertArduinoSerialSessionSchema.safeParse({ ...req.body, projectId });
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid request: ' + fromZodError(parsed.error).toString() });
    }
    const session = await storage.createArduinoSerialSession({ ...parsed.data, status: 'open' });
    res.status(201).json(session);
  }));

  app.post(`${arduinoPrefix}/serial/:sessionId/close`, requireProjectOwnership, asyncHandler(async (req, res) => {
    const sessionId = parseIdParam(req.params.sessionId);
    const updated = await storage.updateArduinoSerialSession(sessionId, { status: 'closed', endedAt: new Date() });
    if (!updated) return res.status(404).json({ message: 'Session not found' });
    res.json(updated);
  }));

  // --- Hardware Co-Debug (AI) ---
  app.post(`${arduinoPrefix}/co-debug`, requireProjectOwnership, payloadLimit(1024 * 1024), asyncHandler(async (req, res) => {
    const projectId = parseIdParam(req.params.id);
    const { code, serialLogs } = req.body;
    
    if (!code || !serialLogs) {
      return res.status(400).json({ message: 'Missing code or serialLogs' });
    }

    try {
      const { hardwareCoDebugFlow } = await import('../genkit');
      const result = await hardwareCoDebugFlow({ projectId, code, serialLogs });
      res.json({ result });
    } catch (err: any) {
      res.status(500).json({ message: `Co-Debug failed: ${err.message}` });
    }
  }));
}

