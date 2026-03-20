const fs = require('fs');

let content = fs.readFileSync('server/routes/arduino.ts', 'utf8');

const replacement = `  app.post(\`\${arduinoPrefix}/jobs/:jobId/cancel\`, requireProjectOwnership, asyncHandler(async (req, res) => {
    const jobId = parseIdParam(req.params.jobId);
    const success = await service.cancelJob(jobId);
    if (!success) {
      return res.status(404).json({ message: 'Job not found or cannot be cancelled' });
    }
    res.json({ success: true, message: 'Job cancellation requested' });
  }));

  // --- Memory Breakdown Analysis (BL-0616) ---
  app.get(\`\${arduinoPrefix}/jobs/:jobId/memory\`, requireProjectOwnership, asyncHandler(async (req, res) => {
    const jobId = parseIdParam(req.params.jobId);
    const job = await storage.getArduinoJob(jobId);
    if (!job || job.status !== 'completed' || job.jobType !== 'compile') {
      return res.status(400).json({ message: 'Memory analysis requires a successfully completed compile job.' });
    }

    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    
    // We need the .elf file specifically
    const fqbn = (job.args as any)?.fqbn?.replace(/:/g, '.') || '';
    const sketchPath = (job.args as any)?.sketchPath || '.';
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
      const { stdout } = await execAsync(\`nm -S --size-sort -r -C "\${elfPath}"\`);
      
      const symbols = stdout.split('\\n').filter(Boolean).map(line => {
        // Output format: <address> <size> <type> <name>
        const parts = line.trim().split(/\\s+/);
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
`;

content = content.replace(/  app\.post\(`\$\{arduinoPrefix\}\/jobs\/:jobId\/cancel`[\s\S]+?\}\)\);\n/m, replacement);

fs.writeFileSync('server/routes/arduino.ts', content, 'utf8');
console.log('Added memory endpoint to arduino routes');
