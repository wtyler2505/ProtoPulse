/**
 * ProtoPulse graph-domain types.
 *
 * These mirror the subset of node/edge shape used by app logic so domain code
 * does not need to import UI-library canvas types directly.
 */
export interface GraphPosition {
  x: number;
  y: number;
}

export interface GraphNode<TData = Record<string, unknown>> {
  id: string;
  type?: string;
  position: GraphPosition;
  data: TData;
  [key: string]: unknown;
}

export interface GraphEdge<TData = Record<string, unknown>> {
  id: string;
  source: string;
  target: string;
  label?: string;
  animated?: boolean;
  style?: Record<string, string | number>;
  data?: TData;
  [key: string]: unknown;
}
