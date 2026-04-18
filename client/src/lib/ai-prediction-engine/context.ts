/**
 * Graph (adjacency) helpers and the Prediction factory — the context that
 * rules use to introspect the design and emit findings.
 */

import type {
  Prediction,
  PredictionAction,
  PredictionCategory,
  PredictionEdge,
  PredictionNode,
} from './types';

export function buildAdjacency(edges: PredictionEdge[]): Map<string, Set<string>> {
  const adj = new Map<string, Set<string>>();
  edges.forEach((e) => {
    if (!adj.has(e.source)) { adj.set(e.source, new Set()); }
    adj.get(e.source)!.add(e.target);
    if (!adj.has(e.target)) { adj.set(e.target, new Set()); }
    adj.get(e.target)!.add(e.source);
  });
  return adj;
}

export function connectedNodes(
  nodeId: string,
  adj: Map<string, Set<string>>,
  allNodes: PredictionNode[],
): PredictionNode[] {
  const ids = adj.get(nodeId);
  if (!ids) { return []; }
  return allNodes.filter((n) => ids.has(n.id));
}

export function makePrediction(
  ruleId: string,
  title: string,
  description: string,
  confidence: number,
  category: PredictionCategory,
  action?: PredictionAction,
): Prediction {
  return {
    id: `${ruleId}-${crypto.randomUUID()}`,
    ruleId,
    title,
    description,
    confidence,
    category,
    action,
    dismissed: false,
  };
}
