/**
 * AI Tool type definitions.
 *
 * Shared types used across all tool category modules and the registry.
 * Every AI tool registered in the system conforms to {@link ToolDefinition},
 * which pairs a Zod parameter schema with an async executor function.
 *
 * @module ai-tools/types
 */

import type { z, ZodObject, ZodRawShape } from 'zod';
import type { IStorage } from '../storage';

/**
 * Discriminated category tag for grouping related AI tools.
 *
 * Each tool belongs to exactly one category, used for:
 * - Filtering tools in the registry via {@link ToolRegistry.getByCategory}
 * - Organizing tool listings in the AI system prompt
 * - Multi-model routing decisions
 */
export type ToolCategory =
  | 'architecture'
  | 'circuit'
  | 'component'
  | 'bom'
  | 'validation'
  | 'export'
  | 'project'
  | 'navigation'
  | 'arduino'
  | 'simulation'
  | 'vision'
  | 'manufacturing'
  | 'testbench'
  | 'generative'
  | 'bom-optimization'
  | 'risk-analysis';

/**
 * Reference to a design element used as a source for an AI answer.
 * Enables the \"Source Panel\" UX (BL-0160).
 */
export interface ToolSource {
  type: 'bom_item' | 'node' | 'edge' | 'net' | 'sheet' | 'validation_issue' | 'project' | 'knowledge_base';
  label: string;
  id?: string | number;
  metadata?: Record<string, unknown>;
}

/**
 * Standardized result returned by every tool executor.
 *
 * @property success    - Whether the tool operation completed without error.
 * @property message    - Human-readable summary of what happened, streamed to the user.
 * @property data       - Optional structured payload (e.g., file download data, comparison tables,
 *                        or client-side action descriptors dispatched via {@link clientAction}).
 * @property sources    - Optional list of design elements analyzed to produce this result (BL-0160).
 * @property confidence - Optional AI confidence score for analytical tools.
 */
export interface ToolResult {
  success: boolean;
  message: string;
  data?: unknown;
  sources?: ToolSource[];
  confidence?: ConfidenceScore;
}

/**
 * Execution context passed to every tool's `execute` function.
 *
 * Provides the active project ID and the storage layer so tools can
 * read/write project data without importing storage directly.
 *
 * @property projectId - The numeric ID of the project the AI chat session is operating on.
 * @property storage   - The {@link IStorage} implementation (typically {@link DatabaseStorage}).
 */
export interface ToolContext {
  projectId: number;
  storage: IStorage;
  /** When true, the user has explicitly confirmed a destructive action. */
  confirmed?: boolean;
  /** Optional Google Workspace OAuth token or Service Account string */
  googleWorkspaceToken?: string;
}

/**
 * Model tier hint for multi-model routing.
 *
 * When a tool specifies a {@link ToolDefinition.modelPreference}, the AI router
 * can select the most cost-effective model for that tool invocation.
 *
 * - `'fast'`     - Lightweight tasks (navigation, simple lookups).
 * - `'standard'` - Typical tool calls (CRUD, validation).
 * - `'premium'`  - Complex generation or analysis requiring the strongest model.
 */
export type ModelTier = 'fast' | 'standard' | 'premium';

/**
 * Permission tier for AI tool access control.
 *
 * Classifies tools by the level of privilege they require:
 * - `'read'`        - Read-only lookups (no side effects).
 * - `'suggest'`     - Propose changes the user can accept or reject.
 * - `'mutate'`      - Directly modify project state (add/update/delete entities).
 * - `'destructive'` - Irreversible or bulk-destructive operations requiring explicit confirmation.
 */
export type PermissionTier = 'read' | 'suggest' | 'mutate' | 'destructive';

/**
 * AI confidence scoring for tool results and suggestions.
 *
 * Attached to AI responses that involve data lookups, component matching,
 * or analysis where certainty varies (e.g., BOM pricing, component identification).
 *
 * @property score       - Numeric confidence 0-100 (100 = absolute certainty).
 * @property explanation - Human-readable summary of why this score was assigned.
 * @property factors     - Itemized list of signals that contributed to the score.
 */
export interface ConfidenceScore {
  score: number;
  explanation: string;
  factors: string[];
}

/**
 * Complete definition of a single AI tool.
 *
 * Tools are registered with the {@link ToolRegistry} and converted to
 * Anthropic or Gemini native formats for inclusion in API requests.
 *
 * @typeParam TSchema - Zod raw shape describing the tool's input parameters.
 *
 * @property name                 - Unique identifier used in tool_use blocks (e.g., `'add_node'`).
 * @property description          - Natural-language description shown to the AI model.
 * @property category             - Logical grouping ({@link ToolCategory}).
 * @property parameters           - Zod schema that validates and coerces incoming parameters.
 * @property execute              - Async function that performs the tool action. Receives parsed
 *                                  params and a {@link ToolContext}.
 * @property requiresConfirmation - If `true`, the client must prompt the user before executing
 *                                  (used for destructive operations like deletes and clears).
 * @property modelPreference      - Optional hint for multi-model routing ({@link ModelTier}).
 */
export interface ToolDefinition<TSchema extends ZodRawShape = ZodRawShape> {
  name: string;
  description: string;
  category: ToolCategory;
  parameters: ZodObject<TSchema>;
  execute: (params: z.infer<ZodObject<TSchema>>, ctx: ToolContext) => Promise<ToolResult>;
  requiresConfirmation: boolean;
  /** Hint for multi-model routing — suggests which model tier is best for this tool. */
  modelPreference?: ModelTier;
  /** Permission tier for access control — defaults to `'destructive'` when requiresConfirmation is true, `'suggest'` otherwise. */
  permissionTier?: PermissionTier;
}
