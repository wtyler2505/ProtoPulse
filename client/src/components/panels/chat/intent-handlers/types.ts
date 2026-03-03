import type { Node, Edge } from '@xyflow/react';
import type { AIAction } from '../chat-types';
import type { BomItem, ValidationIssue, ViewMode } from '@/lib/project-context';

export interface IntentContext {
  nodes: Node[];
  edges: Edge[];
  bom: BomItem[];
  issues: ValidationIssue[];
  projectName: string;
  projectDescription: string;
  activeView: ViewMode;
}

export interface ParsedIntent {
  /** Actions to execute through the unified action executor. */
  actions: AIAction[];
  /** Response message to display in chat. Null = build from action labels. */
  response: string | null;
}

/**
 * A handler that matches a specific user intent and produces structured actions.
 *
 * Handlers are evaluated in registration order — the first whose `match` returns
 * true wins, so more specific handlers must come before broader catch-all handlers.
 */
export interface IntentHandler {
  /** Return true if this handler should process the input. */
  match(lower: string): boolean;
  /** Process the input and return actions + response. */
  handle(msgText: string, ctx: IntentContext): ParsedIntent;
}
