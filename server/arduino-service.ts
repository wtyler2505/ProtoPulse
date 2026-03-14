import { spawn, execFileSync, execSync } from 'child_process';
import type { ChildProcess } from 'child_process';
import { join, resolve, sep } from 'path';
import fs from 'fs/promises';
import { logger } from './logger';
import type { IStorage } from './storage';
import type { ArduinoJob, ArduinoWorkspace } from '@shared/schema';

export interface ArduinoCLIConfig {
  cliPath: string;
  dataDir: string;
  sketchRoot: string;
}

export class ArduinoService {
  private config: ArduinoCLIConfig;
  /** Tracks spawned child processes by job ID for cancellation. */
  private runningProcesses = new Map<number, ChildProcess>();

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
    const existing = await this.storage.getArduinoWorkspace(projectId);
    if (existing) return existing;

    const rootPath = resolve(join(this.config.sketchRoot, `project_${projectId}`));
    await fs.mkdir(rootPath, { recursive: true });

    return await this.storage.createArduinoWorkspace({
      projectId,
      rootPath,
    });
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
    const [nodes, edges, bom, parts] = await Promise.all([
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
   * Execute an Arduino CLI command as a job.
   * Streams logs to the database record.
   */
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
    const args = job.args as Record<string, unknown> | null;
    const sketchPath = (args?.sketchPath ?? '.') as string;
    const fqbn = (args?.fqbn ?? '') as string;

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
   * Execute an Arduino CLI command as a job.
   * Streams logs to the database record.
   */
  async runJob(jobId: number, command: string, args: string[]) {
    const job = await this.storage.getArduinoJob(jobId);
    if (!job) throw new Error(`Job ${jobId} not found`);

    // Check if job was cancelled before it started running
    const freshJob = await this.storage.getArduinoJob(jobId);
    if (freshJob?.status === 'cancelled') return { exitCode: -1 };

    await this.storage.updateArduinoJob(jobId, { status: 'running', startedAt: new Date() });

    const fullArgs = [...args, '--format', 'text'];
    const proc = spawn(this.config.cliPath, fullArgs);
    this.runningProcesses.set(jobId, proc);

    let logBuffer = '';

    proc.stdout.on('data', (data) => {
      const chunk = data.toString();
      logBuffer += chunk;
      // Periodically flush logs to DB (for real streaming we'd use SSE/WS)
      if (logBuffer.length > 1024) {
        this.storage.updateArduinoJob(jobId, { log: logBuffer }).catch(() => {});
      }
    });

    proc.stderr.on('data', (data) => {
      logBuffer += `ERROR: ${data.toString()}`;
    });

    return new Promise<{ exitCode: number }>((resolve, reject) => {
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
          resolve({ exitCode: code ?? -1 });
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
        resolve({ exitCode: code || 0 });
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
        reject(err);
      });
    });
  }
}
