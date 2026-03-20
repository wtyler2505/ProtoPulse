const fs = require('fs');

let code = fs.readFileSync('server/arduino-service.ts', 'utf8');

const newMethod = `
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
      throw new Error(\`Path traversal rejected: "\${filename}"\`);
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

      const cmd = \`\${this.config.cliPath} compile -b \${fqbn} --build-property "compiler.cpp.extra_flags=-fsyntax-only" \${checkDir}\`;
      
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
      logger.error(\`[arduino:checkSyntax] Failed: \${e instanceof Error ? e.message : String(e)}\`);
      return '';
    }
  }

  /**
   * Execute an Arduino CLI command as a job.`;

code = code.replace(
  /\s*\/\*\*\n\s*\* Execute an Arduino CLI command as a job\./,
  newMethod
);

fs.writeFileSync('server/arduino-service.ts', code);
