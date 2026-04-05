import { classifyLifecycle } from '@/lib/lifecycle-badges';
import { calculateScorecard } from '@/lib/risk-scorecard';
import type { Edge, Node } from '@xyflow/react';
import type { BomItem, ValidationIssue } from '@/lib/project-context';
import type { ScorecardResult } from '@/lib/risk-scorecard';

export interface WorkspaceReleaseConfidenceInput {
  bomItems: readonly BomItem[];
  validationIssues: readonly ValidationIssue[];
  nodes: readonly Node[];
  edges: readonly Edge[];
}

function getNodeLabel(node: Node): string {
  const data = node.data && typeof node.data === 'object'
    ? node.data as Record<string, unknown>
    : {};

  return typeof data.label === 'string' ? data.label : '';
}

function getNodeDescription(node: Node): string | undefined {
  const data = node.data && typeof node.data === 'object'
    ? node.data as Record<string, unknown>
    : {};

  return typeof data.description === 'string' ? data.description : undefined;
}

export function buildWorkspaceReleaseConfidence({
  bomItems,
  validationIssues,
  nodes,
  edges,
}: WorkspaceReleaseConfidenceInput): ScorecardResult {
  return calculateScorecard({
    validationIssues: validationIssues.map((issue) => ({
      severity: issue.severity,
      message: issue.message,
      componentId: issue.componentId ? String(issue.componentId) : undefined,
    })),
    bomItems: bomItems.map((item) => ({
      ...item,
      lifecycleStatus: classifyLifecycle(item.partNumber, item.manufacturer),
    })),
    nodes: nodes.map((node) => ({
      id: String(node.id),
      label: getNodeLabel(node),
      type: String(node.type ?? 'default'),
      description: getNodeDescription(node),
    })),
    edges: edges.map((edge) => ({
      id: String(edge.id),
      source: edge.source,
      target: edge.target,
    })),
  });
}
