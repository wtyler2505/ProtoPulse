/**
 * usePredictions — React hook for the AI Prediction Engine.
 *
 * Subscribes to the PredictionEngine singleton, auto-analyzes when inputs
 * change (debounced), and returns the current predictions with actions.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { PredictionEngine } from '@/lib/ai-prediction-engine';
import type { Prediction, PredictionBomItem, PredictionEdge, PredictionNode } from '@/lib/ai-prediction-engine';

export interface UsePredictionsReturn {
  predictions: Prediction[];
  dismiss: (id: string) => void;
  accept: (id: string) => void;
  clearAll: () => void;
  isAnalyzing: boolean;
  /** Trigger AI-enhanced analysis (heuristics + Gemini). Requires API key. */
  analyzeWithAI: (options: { apiKey: string; projectId: number; sessionId: string }) => Promise<void>;
}

export function usePredictions(
  nodes: PredictionNode[],
  edges: PredictionEdge[],
  bomItems: PredictionBomItem[],
): UsePredictionsReturn {
  const [, setTick] = useState(0);
  const engineRef = useRef<PredictionEngine | null>(null);

  // Subscribe to engine changes
  useEffect(() => {
    if (typeof window === 'undefined') { return; }
    const engine = PredictionEngine.getInstance();
    engineRef.current = engine;
    const unsubscribe = engine.subscribe(() => {
      setTick((t) => t + 1);
    });
    return unsubscribe;
  }, []);

  // Auto-analyze on input changes (debounced)
  useEffect(() => {
    if (typeof window === 'undefined') { return; }
    const engine = PredictionEngine.getInstance();
    engine.analyzeDebounced(nodes, edges, bomItems);
  }, [nodes, edges, bomItems]);

  const dismiss = useCallback((id: string) => {
    PredictionEngine.getInstance().dismiss(id);
  }, []);

  const accept = useCallback((id: string) => {
    PredictionEngine.getInstance().accept(id);
  }, []);

  const clearAll = useCallback(() => {
    PredictionEngine.getInstance().clearAll();
  }, []);

  const analyzeWithAI = useCallback(async (options: { apiKey: string; projectId: number; sessionId: string }) => {
    await PredictionEngine.getInstance().analyzeWithAI(nodes, edges, bomItems, options);
  }, [nodes, edges, bomItems]);

  const engine = engineRef.current ?? PredictionEngine.getInstance();

  return {
    predictions: engine.getPredictions(),
    dismiss,
    accept,
    clearAll,
    isAnalyzing: engine.getIsAnalyzing(),
    analyzeWithAI,
  };
}
