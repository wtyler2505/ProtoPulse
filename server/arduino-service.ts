import { spawn, execFileSync, execSync } from 'child_process';
import { join, resolve, sep } from 'path';
import { EventEmitter } from 'events';
import fs from 'fs/promises';
import { logger } from './logger';
import type { IStorage } from './storage';
import type { ArduinoJob, ArduinoWorkspace } from '@shared/schema';

// ---------------------------------------------------------------------------
// SSE job stream types
// ---------------------------------------------------------------------------

export interface JobStreamEvent {
  type: 'log' | 'status' | 'error' | 'done';
  content: string;
  timestamp: number;
}

/**
 * Per-job event emitter for SSE streaming.
 * Emits 'event' with JobStreamEvent payloads.
 * Also buffers all events so late-joining clients get the full history.
 */
export class JobStream extends EventEmitter {
  private buffer: JobStreamEvent[] = [];
  private _finished = false;

  get finished(): boolean {
    return this._finished;
  }

  /** Get all buffered events (for late joiners). */
  getBuffer(): readonly JobStreamEvent[] {
    return this.buffer;
  }

  /** Push a new event — buffers it and emits to listeners. */
  push(event: JobStreamEvent): void {
    if (this._finished) { return; }
    this.buffer.push(event);
    this.emit('event', event);
  }

  /** Mark the stream as finished. No more events will be accepted. */
  finish(): void {
    this._finished = true;
    this.removeAllListeners();
  }
}

export interface ArduinoCLIConfig {
  cliPath: string;
  dataDir: string;
  sketchRoot: string;
}

export class ArduinoService {
  private config: ArduinoCLIConfig;
  /** Tracks spawned child processes by job ID for cancellation. */
  private runningProcesses = new Map<number, ReturnType<typeof spawn>>();
  /** Tracks active SSE streams by job ID. */
  private jobStreams = new Map<number, JobStream>();
  /** Deduplicates concurrent workspace bootstrap calls per project. */
  private workspaceEnsures = new Map<number, Promise<ArduinoWorkspace>>();

  constructor(private storage: IStorage) {
    this.config = {
      cliPath: process.env.ARDUINO_CLI_PATH || 'arduino-cli',
      dataDir: process.env.ARDUINO_DATA_DIR || join(process.cwd(), 'data', 'arduino'),
      sketchRoot: process.env.ARDUINO_SKETCH_ROOT || join(process.cwd(), 'data', 'sketches'),
    };
  }

  /** Get basic health and version info from the CLI. */
  async getHealth() {
    try {
      const output = execSync(`${this.config.cliPath} version --format json`).toString();
      const versionData = JSON.parse(output);
      return {
        status: 'ok',
        version: versionData.VersionString || 'unknown',
        supported: true,
      };
    } catch (e) {
      logger.error(`[arduino:health] Failed to get CLI version: ${e instanceof Error ? e.message : String(e)}`);
      return {
        status: 'error',
        code: 'ARDUINO_CLI_NOT_FOUND',
        message: 'Arduino CLI not found or execution failed',
      };
    }
  }

  /** Get or create a workspace root for a project. */
  async ensureWorkspace(projectId: number): Promise<ArduinoWorkspace> {
    const inflight = this.workspaceEnsures.get(projectId);
    if (inflight) {
      return await inflight;
    }

    const ensurePromise = (async () => {
      const existing = await this.storage.getArduinoWorkspace(projectId);
      if (existing) {
        // A workspace row can outlive its directory. Heal the filesystem on read.
        await fs.mkdir(existing.rootPath, { recursive: true });
        return existing;
      }

      const rootPath = resolve(join(this.config.sketchRoot, `project_${projectId}`));
      await fs.mkdir(rootPath, { recursive: true });

      return await this.storage.createArduinoWorkspace({
        projectId,
        rootPath,
      });
    })();

    this.workspaceEnsures.set(projectId, ensurePromise);
    try {
      return await ensurePromise;
    } finally {
      this.workspaceEnsures.delete(projectId);
    }
  }

  /** Resolve a relative path within the workspace root, rejecting path traversal attempts. */
  private resolveSafe(workspaceRoot: string, relativePath: string): string {
    const resolved = resolve(join(workspaceRoot, relativePath));
    const normalizedRoot = resolve(workspaceRoot);
    if (resolved !== normalizedRoot && !resolved.startsWith(normalizedRoot + sep)) {
      throw new Error(`Path traversal rejected: "${relativePath}"`);
    }
    return resolved;
  }

  /** Recursively scan the workspace and sync metadata to DB. */
  async scanWorkspace(workspaceId: number): Promise<void> {
    const workspaces = await this.storage.getArduinoWorkspaces();
    const ws = workspaces.find(w => w.id === workspaceId);
    if (!ws) throw new Error(`Workspace ${workspaceId} not found`);
    await fs.mkdir(ws.rootPath, { recursive: true });

    const scan = async (dir: string, relative: string = '') => {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const relPath = join(relative, entry.name);
        const fullPath = join(dir, entry.name);

        if (entry.isDirectory()) {
          await scan(fullPath, relPath);
        } else {
          const stats = await fs.stat(fullPath);
          const ext = entry.name.split('.').pop() || '';
          await this.storage.upsertArduinoSketchFile({
            projectId: ws.projectId,
            workspaceId,
            relativePath: relPath,
            language: ext,
            sizeBytes: stats.size,
          });
        }
      }
    };

    await scan(ws.rootPath);
  }

  /** Read file content from the workspace. */
  async readFile(workspaceId: number, relativePath: string): Promise<string> {
    const workspaces = await this.storage.getArduinoWorkspaces();
    const ws = workspaces.find(w => w.id === workspaceId);
    if (!ws) throw new Error(`Workspace ${workspaceId} not found`);
    const fullPath = this.resolveSafe(ws.rootPath, relativePath);
    return await fs.readFile(fullPath, 'utf8');
  }

  /** Write file content to the workspace. */
  async writeFile(workspaceId: number, relativePath: string, content: string): Promise<void> {
    const workspaces = await this.storage.getArduinoWorkspaces();
    const ws = workspaces.find(w => w.id === workspaceId);
    if (!ws) throw new Error(`Workspace ${workspaceId} not found`);
    const fullPath = this.resolveSafe(ws.rootPath, relativePath);
    await fs.writeFile(fullPath, content, 'utf8');
    const stats = await fs.stat(fullPath);
    const ext = relativePath.split('.').pop() || '';
    await this.storage.upsertArduinoSketchFile({
      projectId: ws.projectId,
      workspaceId,
      relativePath,
      language: ext,
      sizeBytes: stats.size,
    });
  }

  /** Create a new file in the workspace. */
  async createFile(workspaceId: number, relativePath: string, content: string = ''): Promise<void> {
    const workspaces = await this.storage.getArduinoWorkspaces();
    const ws = workspaces.find(w => w.id === workspaceId);
    if (!ws) throw new Error(`Workspace ${workspaceId} not found`);
    const fullPath = this.resolveSafe(ws.rootPath, relativePath);
    await fs.mkdir(resolve(fullPath, '..'), { recursive: true });
    await this.writeFile(workspaceId, relativePath, content);
  }

  /** Delete a file from the workspace (disk + DB). */
  async deleteFile(fileId: number): Promise<boolean> {
    const file = await this.storage.getArduinoSketchFile(fileId);
    if (!file) return false;
    const workspaces = await this.storage.getArduinoWorkspaces();
    const ws = workspaces.find(w => w.id === file.workspaceId);
    if (ws) {
      try {
        const fullPath = this.resolveSafe(ws.rootPath, file.relativePath);
        await fs.unlink(fullPath);
      } catch (e) {
        logger.warn(`[arduino:deleteFile] Could not remove disk file: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    return await this.storage.deleteArduinoSketchFile(fileId);
  }

  /** List connected boards. */
  async discoverBoards() {
    try {
      const output = execSync(`${this.config.cliPath} board list --format json`).toString();
      return JSON.parse(output);
    } catch (e) {
      logger.error(`[arduino:discover] Failed to list boards: ${e instanceof Error ? e.message : String(e)}`);
      return [];
    }
  }

  /** Search the library index. Uses execFileSync to avoid shell injection. */
  async searchLibraries(query: string) {
    try {
      const output = execFileSync(this.config.cliPath, ['lib', 'search', query, '--format', 'json']).toString();
      return JSON.parse(output);
    } catch (e) {
      logger.error(`[arduino:lib-search] Failed to search libraries: ${e instanceof Error ? e.message : String(e)}`);
      return [];
    }
  }

  /** Install an Arduino library by name. */
  async installLibrary(name: string): Promise<{ success: boolean; output: string }> {
    try {
      const output = execFileSync(this.config.cliPath, ['lib', 'install', name, '--format', 'text']).toString();
      return { success: true, output };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      logger.error(`[arduino:lib-install] Failed to install library "${name}": ${message}`);
      return { success: false, output: message };
    }
  }

  /** Uninstall an Arduino library by name. */
  async uninstallLibrary(name: string): Promise<{ success: boolean; output: string }> {
    try {
      const output = execFileSync(this.config.cliPath, ['lib', 'uninstall', name, '--format', 'text']).toString();
      return { success: true, output };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      logger.error(`[arduino:lib-uninstall] Failed to uninstall library "${name}": ${message}`);
      return { success: false, output: message };
    }
  }

  /** List installed Arduino libraries. */
  async listInstalledLibraries() {
    try {
      const output = execFileSync(this.config.cliPath, ['lib', 'list', '--format', 'json']).toString();
      return JSON.parse(output);
    } catch (e) {
      logger.error(`[arduino:lib-list] Failed to list libraries: ${e instanceof Error ? e.message : String(e)}`);
      return [];
    }
  }

  /** List installed platform cores. */
  async listCores() {
    try {
      const output = execFileSync(this.config.cliPath, ['core', 'list', '--format', 'json']).toString();
      return JSON.parse(output);
    } catch (e) {
      logger.error(`[arduino:core-list] Failed to list cores: ${e instanceof Error ? e.message : String(e)}`);
      return [];
    }
  }

  /** Search available platform cores. */
  async searchCores(query: string) {
    try {
      const output = execFileSync(this.config.cliPath, ['core', 'search', query, '--format', 'json']).toString();
      return JSON.parse(output);
    } catch (e) {
      logger.error(`[arduino:core-search] Failed to search cores: ${e instanceof Error ? e.message : String(e)}`);
      return [];
    }
  }

  /** Install a platform core (e.g. "esp32:esp32"). */
  async installCore(platform: string): Promise<{ success: boolean; output: string }> {
    try {
      const output = execFileSync(this.config.cliPath, ['core', 'install', platform, '--format', 'text']).toString();
      return { success: true, output };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      logger.error(`[arduino:core-install] Failed to install core "${platform}": ${message}`);
      return { success: false, output: message };
    }
  }

  /** Uninstall a platform core. */
  async uninstallCore(platform: string): Promise<{ success: boolean; output: string }> {
    try {
      const output = execFileSync(this.config.cliPath, ['core', 'uninstall', platform, '--format', 'text']).toString();
      return { success: true, output };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      logger.error(`[arduino:core-uninstall] Failed to uninstall core "${platform}": ${message}`);
      return { success: false, output: message };
    }
  }

  /**
   * High-level sketch generator.
   * Analyzes project circuit data to build hardware-accurate boilerplate.
   */
  async generateSketch(projectId: number, intent: string): Promise<string> {
    const [nodes, _edges, _bom, _parts] = await Promise.all([
      this.storage.getNodes(projectId),
      this.storage.getEdges(projectId),
      this.storage.getBomItems(projectId),
      this.storage.getComponentParts(projectId),
    ]);

    // Simple template logic
    const mcuNode = nodes.find(n => n.nodeType === 'mcu');
    const boardLabel = mcuNode?.label || 'Arduino Uno';

    let code = `/**\n * ProtoPulse Generated Sketch\n * Project ID: ${projectId}\n * Intent: ${intent}\n * Target: ${boardLabel}\n */\n\n`;

    code += `void setup() {\n  Serial.begin(115200);\n  while(!Serial); // Wait for terminal\n  Serial.println("System Initialized");\n`;

    // Add pin assignments from edges/nets if possible
    nodes.filter(n => n.nodeType !== 'mcu').forEach(node => {
      code += `  // Setup for ${node.label} (${node.nodeType})\n`;
    });

    code += `}\n\nvoid loop() {\n  // Implement logic for: ${intent}\n  delay(1000);\n}\n`;

    return code;
  }

  /**
   * Get or create a JobStream for SSE streaming.
   * If the job is already completed/failed/cancelled, returns null
   * (callers should send stored log lines directly instead).
   */
  getJobStream(jobId: number): JobStream | null {
    const existing = this.jobStreams.get(jobId);
    if (existing) { return existing; }

    // Only create a stream for jobs that have a running process
    if (!this.runningProcesses.has(jobId)) {
      return null;
    }

    const stream = new JobStream();
    this.jobStreams.set(jobId, stream);
    return stream;
  }

  /**
   * Cancel a running job by killing its child process.
   * Returns true if the job was running and was cancelled.
   */
  async cancelJob(jobId: number): Promise<boolean> {
    const proc = this.runningProcesses.get(jobId);
    if (!proc) {
      // Process not tracked — check if the job is still in a cancellable state in DB
      const job = await this.storage.getArduinoJob(jobId);
      if (!job) return false;
      if (job.status === 'pending') {
        await this.storage.updateArduinoJob(jobId, {
          status: 'cancelled',
          finishedAt: new Date(),
          summary: 'Cancelled before execution started',
        });
        const stream = this.jobStreams.get(jobId);
        if (stream) {
          stream.push({ type: 'status', content: 'cancelled', timestamp: Date.now() });
          stream.push({ type: 'done', content: 'Cancelled before execution started', timestamp: Date.now() });
          stream.finish();
          this.jobStreams.delete(jobId);
        }
        return true;
      }
      return false;
    }

    proc.kill('SIGTERM');
    // Give it 2s to terminate gracefully, then force-kill
    setTimeout(() => {
      if (!proc.killed) {
        proc.kill('SIGKILL');
      }
    }, 2000);

    return true;
  }

  /**
   * Resolve the path to the compiled artifact (.hex/.bin/.elf) for a completed compile job.
   * Returns null if no artifact is found.
   */
  async getArtifactPath(jobId: number): Promise<string | null> {
    const job = await this.storage.getArduinoJob(jobId);
    if (!job || job.status !== 'completed' || job.jobType !== 'compile') {
      return null;
    }

    // Arduino CLI puts build artifacts in a temp directory or alongside the sketch.
    // The args JSONB contains the compile request body (fqbn, sketchPath, etc.)
    const jobArgs = job.args as Record<string, unknown> | null;
    const sketchPath = (jobArgs?.sketchPath ?? '.') as string;
    const fqbn = (jobArgs?.fqbn ?? '') as string;

    // Arduino CLI default build output: {sketchDir}/build/{fqbn-with-dots-replaced}/
    const fqbnDir = fqbn.replace(/:/g, '.');
    const buildDir = resolve(join(sketchPath, 'build', fqbnDir));

    try {
      const entries = await fs.readdir(buildDir);
      // Prefer .hex > .bin > .elf
      for (const ext of ['.hex', '.bin', '.elf']) {
        const match = entries.find(e => e.endsWith(ext));
        if (match) {
          return join(buildDir, match);
        }
      }
    } catch {
      // Build dir doesn't exist — try the workspace build directory
      const workspace = await this.storage.getArduinoWorkspace(job.projectId);
      if (workspace) {
        const wsBuildDir = resolve(join(workspace.rootPath, 'build', fqbnDir));
        try {
          const entries = await fs.readdir(wsBuildDir);
          for (const ext of ['.hex', '.bin', '.elf']) {
            const match = entries.find(e => e.endsWith(ext));
            if (match) {
              return join(wsBuildDir, match);
            }
          }
        } catch {
          // No build artifacts found
        }
      }
    }

    return null;
  }
  /**
   * Fast syntax check for live error highlighting (BL-0602).
   * Creates a shadow copy of the sketch, overwrites the target file with unsaved content,
   * and runs a syntax-only compilation, returning the raw stderr.
   */
  async checkSyntax(projectId: number, fqbn: string, sketchPath: string, filename: string, sourceCode: string): Promise<string> {
    const workspace = await this.storage.getArduinoWorkspace(projectId);
    if (!workspace) throw new Error('Workspace not found');

    const sourceDir = this.resolveSafe(workspace.rootPath, sketchPath);
    const { basename, join } = await import('path');
    const dirName = basename(sourceDir);
    const checkId = Date.now() + '_' + Math.floor(Math.random() * 1000);
    // Create a temp dir that preserves the sketch folder name (required by arduino-cli)
    const checkDir = resolve(join(workspace.rootPath, '.check-cache', checkId, dirName));
    const targetFile = join(checkDir, filename);

    // Ensure we don't escape the check directory
    if (!targetFile.startsWith(checkDir + sep)) {
      throw new Error(`Path traversal rejected: "${filename}"`);
    }

    try {
      // 1. Create check dir
      await fs.mkdir(checkDir, { recursive: true });
      
      // 2. Copy all files from source to check dir
      const entries = await fs.readdir(sourceDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile() && !entry.name.startsWith('.')) {
          await fs.copyFile(join(sourceDir, entry.name), join(checkDir, entry.name));
        }
      }

      // 3. Overwrite the target file with the unsaved code
      await fs.writeFile(targetFile, sourceCode, 'utf-8');

      // 4. Run syntax-only compilation
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);

      const cmd = `${this.config.cliPath} compile -b ${fqbn} --build-property "compiler.cpp.extra_flags=-fsyntax-only" ${checkDir}`;
      
      try {
        const { stderr } = await execAsync(cmd);
        return stderr;
      } catch (err: any) {
        // arduino-cli returns non-zero exit code on syntax errors, throwing an exception.
        // We expect it to fail if there are syntax errors!
        return err.stderr || err.stdout || err.message;
      } finally {
        // Cleanup temp check dir asynchronously
        fs.rm(resolve(join(workspace.rootPath, '.check-cache', checkId)), { recursive: true, force: true }).catch(() => {});
      }
    } catch (e) {
      logger.error(`[arduino:checkSyntax] Failed: ${e instanceof Error ? e.message : String(e)}`);
      return '';
    }
  }

  /**
   * Execute an Arduino CLI command as a job.
   * Streams logs to the database record and emits SSE events via JobStream.
   */
  async runJob(jobId: number, _command: string, args: string[]) {
    const job = await this.storage.getArduinoJob(jobId);
    if (!job) throw new Error(`Job ${jobId} not found`);

    // Check if job was cancelled before it started running
    const freshJob = await this.storage.getArduinoJob(jobId);
    if (freshJob?.status === 'cancelled') return { exitCode: -1 };

    await this.storage.updateArduinoJob(jobId, { status: 'running', startedAt: new Date() });

    // Create a stream for SSE listeners
    const stream = new JobStream();
    this.jobStreams.set(jobId, stream);
    stream.push({ type: 'status', content: 'running', timestamp: Date.now() });

    const fullArgs = [...args, '--format', 'text'];
    const proc = spawn(this.config.cliPath, fullArgs);
    this.runningProcesses.set(jobId, proc);

    let logBuffer = '';

    proc.stdout.on('data', (data: Buffer) => {
      const chunk = data.toString();
      logBuffer += chunk;
      // Emit each line to SSE stream
      const lines = chunk.split('\n');
      for (const line of lines) {
        if (line.length > 0) {
          stream.push({ type: 'log', content: line, timestamp: Date.now() });
        }
      }
      // Periodically flush logs to DB (fallback for history panel)
      if (logBuffer.length > 1024) {
        this.storage.updateArduinoJob(jobId, { log: logBuffer }).catch(() => {});
      }
    });

    proc.stderr.on('data', (data: Buffer) => {
      const chunk = data.toString();
      logBuffer += `ERROR: ${chunk}`;
      stream.push({ type: 'error', content: chunk.trimEnd(), timestamp: Date.now() });
    });

    const cleanupStream = () => {
      stream.finish();
      this.jobStreams.delete(jobId);
    };

    return new Promise<{ exitCode: number }>((promiseResolve, promiseReject) => {
      proc.on('close', async (code, signal) => {
        this.runningProcesses.delete(jobId);

        // If killed by signal (cancellation), mark as cancelled
        if (signal === 'SIGTERM' || signal === 'SIGKILL') {
          await this.storage.updateArduinoJob(jobId, {
            status: 'cancelled',
            finishedAt: new Date(),
            exitCode: code ?? -1,
            log: logBuffer + '\n--- Job cancelled by user ---',
            summary: 'Cancelled by user',
          });
          stream.push({ type: 'status', content: 'cancelled', timestamp: Date.now() });
          stream.push({ type: 'done', content: 'Cancelled by user', timestamp: Date.now() });
          cleanupStream();
          promiseResolve({ exitCode: code ?? -1 });
          return;
        }

        const status = code === 0 ? 'completed' : 'failed';
        await this.storage.updateArduinoJob(jobId, {
          status,
          finishedAt: new Date(),
          exitCode: code || 0,
          log: logBuffer,
          summary: code === 0 ? 'Operation successful' : 'Operation failed',
        });
        stream.push({ type: 'status', content: status, timestamp: Date.now() });
        stream.push({ type: 'done', content: code === 0 ? 'Operation successful' : 'Operation failed', timestamp: Date.now() });
        cleanupStream();
        promiseResolve({ exitCode: code || 0 });
      });

      proc.on('error', async (err) => {
        this.runningProcesses.delete(jobId);
        await this.storage.updateArduinoJob(jobId, {
          status: 'failed',
          finishedAt: new Date(),
          errorCode: 'EXEC_ERROR',
          summary: err.message,
          log: logBuffer + `\nCRITICAL ERROR: ${err.message}`,
        });
        stream.push({ type: 'error', content: err.message, timestamp: Date.now() });
        stream.push({ type: 'status', content: 'failed', timestamp: Date.now() });
        stream.push({ type: 'done', content: err.message, timestamp: Date.now() });
        cleanupStream();
        promiseReject(err);
      });
    });
  }
}
