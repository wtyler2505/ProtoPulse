const fs = require('fs');
let content = fs.readFileSync('server/routes/arduino.ts', 'utf8');

const replacement = `  app.post(\`\${arduinoPrefix}/serial/:sessionId/close\`, requireProjectOwnership, asyncHandler(async (req, res) => {
    const sessionId = parseIdParam(req.params.sessionId);
    const updated = await storage.updateArduinoSerialSession(sessionId, { status: 'closed', endedAt: new Date() });
    if (!updated) return res.status(404).json({ message: 'Session not found' });
    res.json(updated);
  }));

  // --- Hardware Co-Debug (AI) ---
  app.post(\`\${arduinoPrefix}/co-debug\`, requireProjectOwnership, payloadLimit(1024 * 1024), asyncHandler(async (req, res) => {
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
      res.status(500).json({ message: \`Co-Debug failed: \${err.message}\` });
    }
  }));
}
`;

content = content.replace(/  app\.post\(`\$\{arduinoPrefix\}\/serial\/:sessionId\/close`[\s\S]+?\}\)\);\n\}/, replacement);
fs.writeFileSync('server/routes/arduino.ts', content, 'utf8');
console.log('Patched arduino routes');
