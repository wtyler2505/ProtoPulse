import type { Node, Edge } from '@xyflow/react';
import type { ViewMode } from '@/lib/project-context';

/** Data shape stored on architecture nodes in ProtoPulse. */
export interface CustomNodeData {
  label: string;
  type: string;
  description?: string;
  pins?: Record<string, string>;
  annotation?: string;
  annotationColor?: string;
  [key: string]: unknown;
}

/** Helper to read typed node data from a generic @xyflow/react Node. */
export function nodeData(n: Node): CustomNodeData {
  return n.data as CustomNodeData;
}

/** Edge metadata stored in edge.data for electrical signal info. */
export interface CustomEdgeData {
  signalType?: string;
  voltage?: string;
  busWidth?: number;
  netName?: string;
  [key: string]: unknown;
}

/** Helper to read typed edge data from a generic @xyflow/react Edge. */
export function edgeData(e: Edge): CustomEdgeData | undefined {
  return e.data as CustomEdgeData | undefined;
}

/** Represents a single AI-generated action returned from the streaming API. */
export interface AIAction {
  type: string;
  nodeLabel?: string;
  sourceLabel?: string;
  targetLabel?: string;
  edgeLabel?: string;
  signalType?: string;
  nodeType?: string;
  description?: string;
  label?: string;
  partNumber?: string;
  manufacturer?: string;
  supplier?: string;
  quantity?: number;
  unitPrice?: number;
  severity?: 'error' | 'warning' | 'info';
  message?: string;
  componentId?: string;
  suggestion?: string;
  annotation?: string;
  position?: { x: number; y: number };
  positionX?: number;
  positionY?: number;
  components?: GenComponent[];
  connections?: GenConnection[];
  layout?: string;
  field?: string;
  value?: string | number;
  voltage?: string;
  busWidth?: number;
  netName?: string;
  busType?: string;
  animated?: boolean;
  style?: Record<string, string | number>;
  view?: ViewMode;
  name?: string;
  newLabel?: string;
  newType?: string;
  newDescription?: string;
  template?: string;
  pins?: Record<string, string>;
  note?: string;
  color?: string;
  topic?: string;
  url?: string;
  decision?: string;
  rationale?: string;
  projectType?: string;
  category?: string;
  specs?: Record<string, string>;
  reason?: string;
  sheetId?: string;
  newName?: string;
  updates?: Record<string, unknown>;
  status?: string;
  [key: string]: unknown;
}

/** Shape for a generated architecture component inside an AIAction. */
export interface GenComponent {
  label: string;
  nodeType: string;
  description?: string;
  positionX: number;
  positionY: number;
}

/** Shape for a generated architecture connection inside an AIAction. */
export interface GenConnection {
  sourceLabel: string;
  targetLabel: string;
  label?: string;
  signalType?: string;
}
