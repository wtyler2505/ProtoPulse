/**
 * `PredictionEngine` — singleton + subscribe design. Holds rules, the current
 * list of active predictions, dismissal/feedback state, and orchestrates the
 * heuristic pipeline (optionally augmented by Gemini via `analyzeWithAI`).
 */

import { fetchAIPredictions } from './ai-fetch';
import {
  loadDismissals,
  loadFeedback,
  saveDismissals,
  saveFeedback,
} from './cache';
import { COOLDOWN_MS, DEBOUNCE_MS, MAX_SUGGESTIONS } from './constants';
import { getAllRules } from './rules';
import { adjustConfidence, trackFeedback } from './scoring';
import type {
  DismissRecord,
  FeedbackRecord,
  Prediction,
  PredictionBomItem,
  PredictionEdge,
  PredictionNode,
  PredictionRule,
} from './types';
import { logger } from '@/lib/logger';

export class PredictionEngine {
  private static instance: PredictionEngine | null = null;

  private rules: PredictionRule[];
  private predictions: Prediction[] = [];
  private subscribers: Set<() => void> = new Set();
  private dismissals: DismissRecord[] = [];
  private feedback: FeedbackRecord[] = [];
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private isAnalyzing = false;

  constructor() {
    this.rules = getAllRules();
    this.dismissals = loadDismissals();
    this.feedback = loadFeedback();
  }

  static getInstance(): PredictionEngine {
    if (!PredictionEngine.instance) {
      PredictionEngine.instance = new PredictionEngine();
    }
    return PredictionEngine.instance;
  }

  static resetInstance(): void {
    if (PredictionEngine.instance?.debounceTimer) {
      clearTimeout(PredictionEngine.instance.debounceTimer);
    }
    PredictionEngine.instance = null;
  }

  // -----------------------------------------------------------------------
  // Analysis
  // -----------------------------------------------------------------------

  analyze(nodes: PredictionNode[], edges: PredictionEdge[], bom: PredictionBomItem[]): Prediction[] {
    this.isAnalyzing = true;
    this.notify();

    const allPredictions: Prediction[] = [];
    this.rules.forEach((rule) => {
      const results = rule.check(nodes, edges, bom);
      results.forEach((p) => {
        p.confidence = adjustConfidence(this.feedback, p.ruleId, p.confidence);
      });
      allPredictions.push(...results);
    });

    // Filter out recently dismissed and apply cooldown
    const now = Date.now();
    const activeDismissals = this.dismissals.filter((d) => now - d.dismissedAt < COOLDOWN_MS);
    this.dismissals = activeDismissals;
    saveDismissals(this.dismissals);

    const dismissedRuleIds = new Set(activeDismissals.map((d) => d.ruleId));

    const filtered = allPredictions
      .filter((p) => !dismissedRuleIds.has(p.ruleId))
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, MAX_SUGGESTIONS);

    this.predictions = filtered;
    this.isAnalyzing = false;
    this.notify();

    return filtered;
  }

  analyzeDebounced(nodes: PredictionNode[], edges: PredictionEdge[], bom: PredictionBomItem[]): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      this.analyze(nodes, edges, bom);
      this.debounceTimer = null;
    }, DEBOUNCE_MS);
  }

  // -----------------------------------------------------------------------
  // Getters
  // -----------------------------------------------------------------------

  getPredictions(): Prediction[] {
    return [...this.predictions];
  }

  getIsAnalyzing(): boolean {
    return this.isAnalyzing;
  }

  getRules(): PredictionRule[] {
    return [...this.rules];
  }

  getRuleCount(): number {
    return this.rules.length;
  }

  // -----------------------------------------------------------------------
  // User actions
  // -----------------------------------------------------------------------

  dismiss(predictionId: string): void {
    const pred = this.predictions.find((p) => p.id === predictionId);
    if (!pred) { return; }

    pred.dismissed = true;
    this.predictions = this.predictions.filter((p) => p.id !== predictionId);

    this.dismissals.push({ ruleId: pred.ruleId, dismissedAt: Date.now() });
    saveDismissals(this.dismissals);

    trackFeedback(this.feedback, pred.ruleId, 'dismiss');
    saveFeedback(this.feedback);
    this.notify();
  }

  accept(predictionId: string): void {
    const pred = this.predictions.find((p) => p.id === predictionId);
    if (!pred) { return; }

    this.predictions = this.predictions.filter((p) => p.id !== predictionId);
    trackFeedback(this.feedback, pred.ruleId, 'accept');
    saveFeedback(this.feedback);
    this.notify();
  }

  clearAll(): void {
    const ruleIds = this.predictions.map((p) => p.ruleId);
    ruleIds.forEach((ruleId) => {
      this.dismissals.push({ ruleId, dismissedAt: Date.now() });
      trackFeedback(this.feedback, ruleId, 'dismiss');
    });
    this.predictions = [];
    saveDismissals(this.dismissals);
    saveFeedback(this.feedback);
    this.notify();
  }

  // -----------------------------------------------------------------------
  // Subscription
  // -----------------------------------------------------------------------

  subscribe(callback: () => void): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  getFeedback(): FeedbackRecord[] {
    return [...this.feedback];
  }

  private notify(): void {
    this.subscribers.forEach((cb) => { cb(); });
  }

  // -----------------------------------------------------------------------
  // AI-Enhanced Analysis (hybrid: heuristics + Gemini)
  // -----------------------------------------------------------------------

  /**
   * Run AI-enhanced prediction analysis. First runs local heuristic rules
   * (instant, free), then calls Gemini for deeper analysis that heuristics
   * can't catch (novel circuits, cross-domain issues, optimization opportunities).
   *
   * @param nodes Current architecture nodes
   * @param edges Current architecture edges
   * @param bom Current BOM items
   * @param options.apiKey Gemini API key (required for AI enhancement)
   * @param options.projectId Project ID for server context
   * @param options.sessionId Session ID for auth
   * @returns Combined predictions from heuristics + AI
   */
  async analyzeWithAI(
    nodes: PredictionNode[],
    edges: PredictionEdge[],
    bom: PredictionBomItem[],
    options: { apiKey: string; projectId: number; sessionId: string },
  ): Promise<Prediction[]> {
    // Step 1: Run heuristic rules immediately (free, instant)
    const heuristicResults = this.analyze(nodes, edges, bom);

    // Step 2: Skip AI if no API key or empty design
    if (!options.apiKey || nodes.length === 0) {
      return heuristicResults;
    }

    this.isAnalyzing = true;
    this.notify();

    try {
      const aiPredictions = await fetchAIPredictions(nodes, edges, bom, options);

      // Step 3: Merge, deduplicate by title similarity, cap at MAX_SUGGESTIONS
      const heuristicTitles = new Set(heuristicResults.map((p) => p.title.toLowerCase()));
      const uniqueAI = aiPredictions.filter(
        (p) => !heuristicTitles.has(p.title.toLowerCase()),
      );

      const merged = [...heuristicResults, ...uniqueAI]
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, MAX_SUGGESTIONS + 3); // Allow a few extra for AI insights

      this.predictions = merged;
      return merged;
    } catch (err: unknown) {
      // AI failure is non-fatal — heuristic results still stand
      logger.warn('[PredictionEngine] AI enhancement failed, using heuristic results only:', err instanceof Error ? err.message : String(err));
      return heuristicResults;
    } finally {
      this.isAnalyzing = false;
      this.notify();
    }
  }
}
