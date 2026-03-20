const fs = require('fs');

function patchFile(filepath, promptFnName, routeName, successMsg) {
  let content = fs.readFileSync(filepath, 'utf8');

  // Replace everything above export function register...
  const startIdx = content.indexOf(`export function ${routeName}(app: Express, storage: IStorage): void {`);
  if (startIdx === -1) {
    console.error(`Could not find export function in ${filepath}`);
    return;
  }
  
  // Extract the function that builds the prompt (it's above the route)
  const topParts = content.substring(0, startIdx);
  // Keep the imports but we will rewrite them
  const newImportsAndPrompt = `/**
 * POST /api/circuits/:id/ai/${filepath.includes('review') ? 'review' : 'analyze'}
 */

import type { Express } from 'express';
import type { IStorage } from '../storage';
import type { ComponentPart } from '@shared/schema';
import { parseIdParam, payloadLimit, asyncHandler } from '../routes/utils';
import { categorizeError, redactSecrets } from '../ai';
import { fromZodError } from 'zod-validation-error';
import { logger } from '../logger';
import { ${filepath.includes('review') ? 'reviewSchema' : 'analyzeSchema'} } from './schemas';
import { ai } from '../genkit';
import { googleAI } from '@genkit-ai/google-genai';

` + topParts.substring(topParts.indexOf(`function ${promptFnName}`));

  const routeContent = `export function ${routeName}(app: Express, storage: IStorage): void {
  app.post(
    '/api/circuits/:circuitId/ai/${filepath.includes('review') ? 'review' : 'analyze'}',
    payloadLimit(64 * 1024),
    asyncHandler(async (req, res) => {
      const circuitId = parseIdParam(req.params.circuitId);
      const parsed = ${filepath.includes('review') ? 'reviewSchema' : 'analyzeSchema'}.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid request: ' + fromZodError(parsed.error).toString() });
      }

      const { ${filepath.includes('review') ? 'description,' : ''} apiKey, model } = parsed.data;

      const circuit = await storage.getCircuitDesign(circuitId);
      if (!circuit) {
        return res.status(404).json({ message: 'Circuit not found' });
      }

      const parts = await storage.getComponentParts(circuit.projectId);
      if (parts.length === 0) {
        return res.status(400).json({ message: 'No component parts available.' });
      }

      const prompt = ${promptFnName}(${filepath.includes('review') ? 'description, parts' : 'parts'});

      try {
        const response = await ai.generate({
          model: googleAI.model('gemini-3-pro-preview'), // Force gemini
          prompt,
          config: {
            temperature: 0.1,
            maxOutputTokens: 8192,
            apiKey: apiKey || undefined
          }
        });

        let text = response.text || '';
        if (text.startsWith('\`\`\`json')) {
          text = text.replace(/^\`\`\`json\\n/, '').replace(/\\n\`\`\`$/, '');
        } else if (text.startsWith('\`\`\`')) {
          text = text.replace(/^\`\`\`\\n/, '').replace(/\\n\`\`\`$/, '');
        }

        let resultData: any;
        try {
          resultData = JSON.parse(text);
        } catch {
          return res.status(422).json({ message: 'AI returned invalid JSON', raw: redactSecrets(text) });
        }

        res.json({ success: true, message: '${successMsg}', data: resultData });
      } catch (error: unknown) {
        const { userMessage } = categorizeError(error);
        logger.error(\`[circuit-ai] Generation error: \${redactSecrets(String(error))}\`);
        res.status(500).json({ message: userMessage });
      }
    }),
  );
}
`;

  fs.writeFileSync(filepath, newImportsAndPrompt + routeContent, 'utf8');
  console.log(`Patched ${filepath}`);
}

patchFile('server/circuit-ai/review.ts', 'buildReviewPrompt', 'registerCircuitAiReviewRoute', 'Review completed');
patchFile('server/circuit-ai/analyze.ts', 'buildAnalyzePrompt', 'registerCircuitAiAnalyzeRoute', 'Analysis completed');

