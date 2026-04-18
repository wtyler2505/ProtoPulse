/**
 * Public types for the AI Prediction Engine.
 */

export type PredictionCategory =
  | 'missing_component'
  | 'best_practice'
  | 'safety'
  | 'optimization'
  | 'learning_tip';

export interface PredictionAction {
  type: 'add_component' | 'add_connection' | 'modify_value' | 'open_view' | 'show_info';
  payload: Record<string, unknown>;
}

export interface Prediction {
  id: string;
  ruleId: string;
  title: string;
  description: string;
  confidence: number;
  category: PredictionCategory;
  action?: PredictionAction;
  dismissed: boolean;
}

/** Minimal node representation consumed by the engine. */
export interface PredictionNode {
  id: string;
  type: string;
  label: string;
  data?: {
    partNumber?: string;
    description?: string;
    manufacturer?: string;
    specs?: Record<string, string>;
  };
}

/** Minimal edge representation consumed by the engine. */
export interface PredictionEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  signalType?: string;
  voltage?: string;
}

/** Minimal BOM item representation consumed by the engine. */
export interface PredictionBomItem {
  id: string;
  partNumber: string;
  description: string;
  manufacturer?: string;
  quantity: number;
}

export interface PredictionRule {
  id: string;
  name: string;
  category: PredictionCategory;
  baseConfidence: number;
  check: (nodes: PredictionNode[], edges: PredictionEdge[], bom: PredictionBomItem[]) => Prediction[];
}

export interface DismissRecord {
  ruleId: string;
  dismissedAt: number;
}

export interface FeedbackRecord {
  ruleId: string;
  accepts: number;
  dismisses: number;
}
