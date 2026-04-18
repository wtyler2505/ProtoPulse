/**
 * AI Prediction Engine — proactively suggests what the user needs next based
 * on the current design state (architecture nodes, edges, BOM items).
 *
 * Singleton + Subscribe pattern. localStorage persistence for dismiss
 * cooldowns and per-rule feedback tracking.
 *
 * Domain knowledge for rules shared with the Proactive Healing Engine
 * (decoupling, flyback, …) lives in `shared/electronics-knowledge.ts`. Do
 * not duplicate explanations or default component values there — update the
 * shared file instead so both engines see the change.
 *
 * This file is a barrel that re-exports the public API from submodules:
 *
 *   - `./types`        — Prediction*, FeedbackRecord, etc.
 *   - `./constants`    — cooldown, storage keys, MAX_SUGGESTIONS
 *   - `./heuristics`   — node classifiers + pattern tables
 *   - `./context`      — buildAdjacency / connectedNodes / makePrediction
 *   - `./scoring`      — confidence adjustment, feedback tracking
 *   - `./cache`        — localStorage persistence for dismissals/feedback
 *   - `./ai-fetch`     — Gemini prompt + /api/chat/ai call
 *   - `./rules`        — 32 built-in PredictionRule factories
 *   - `./core`         — PredictionEngine class (singleton + subscribe)
 */

export type {
  DismissRecord,
  FeedbackRecord,
  Prediction,
  PredictionAction,
  PredictionBomItem,
  PredictionCategory,
  PredictionEdge,
  PredictionNode,
  PredictionRule,
} from './types';

export { PredictionEngine } from './core';
