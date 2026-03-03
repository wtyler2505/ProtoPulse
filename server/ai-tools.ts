/**
 * AI Tool Definition Registry — backward-compatible barrel.
 *
 * The monolithic file has been decomposed into `server/ai-tools/` modules.
 * This file re-exports everything so existing imports remain unchanged.
 */

// Re-export all public API from the new module structure
export {
  toolRegistry,
  DESTRUCTIVE_TOOLS,
  ToolRegistry,
} from './ai-tools/index';

export type {
  ToolCategory,
  ToolResult,
  ToolContext,
  ModelTier,
  ToolDefinition,
  AnthropicTool,
  GeminiFunctionDeclaration,
} from './ai-tools/index';
