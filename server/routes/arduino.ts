import type { Express } from 'express';
import type { IStorage } from '../storage';
import { z } from 'zod';
import { fromZodError } from 'zod-validation-error';
import { 
  insertArduinoWorkspaceSchema, 
  insertArduinoBuildProfileSchema,
  insertArduinoJobSchema,
  insertArduinoSerialSessionSchema
} from '@shared/schema';
import { asyncHandler, parseIdParam, payloadLimit } from './utils';
import { requireProjectOwnership } from './auth-middleware';
import { ArduinoService } from '../arduino-service';
import { logger } from '../logger';

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
}
