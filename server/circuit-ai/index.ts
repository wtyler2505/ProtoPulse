/**
 * Circuit AI — AI-assisted schematic generation and review
 *
 * Endpoints:
 *   POST /api/circuits/:id/ai/generate — generate schematic from description
 *   POST /api/circuits/:id/ai/review   — analyze schematic for issues
 *   POST /api/circuits/:id/ai/analyze  — AI circuit analysis (what-if, filter topology, power est.)
 */

import type { Express } from 'express';
import type { IStorage } from '../storage';
import { registerCircuitAiGenerateRoute } from './generate';
import { registerCircuitAiReviewRoute } from './review';
import { registerCircuitAiAnalyzeRoute } from './analyze';

export function registerCircuitAIRoutes(app: Express, storage: IStorage): void {
  registerCircuitAiGenerateRoute(app, storage);
  registerCircuitAiReviewRoute(app, storage);
  registerCircuitAiAnalyzeRoute(app, storage);
}
