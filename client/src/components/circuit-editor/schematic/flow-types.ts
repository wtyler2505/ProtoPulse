import type { GraphEdge, GraphNode } from '@/lib/graph-types';

export type SchematicNode<TData = Record<string, unknown>> = GraphNode<TData> & {
  selected?: boolean;
};

export type SchematicEdge<TData = Record<string, unknown>> = GraphEdge<TData> & {
  sourceHandle?: string;
  targetHandle?: string;
};

export interface SchematicFlowViewport {
  x: number;
  y: number;
  zoom: number;
}

export interface SchematicFlowLike {
  screenToFlowPosition(position: { x: number; y: number }): { x: number; y: number };
  getNodes(): SchematicNode[];
  setNodes?(updater: (nodes: SchematicNode[]) => SchematicNode[]): void;
  getViewport?(): SchematicFlowViewport;
}
