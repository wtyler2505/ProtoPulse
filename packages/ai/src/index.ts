/**
 * @protopulse/ai — the AI crew runtime. Tool registry with scoped slices
 * enforced at dispatch, the budgeted context assembler, the Draftsman
 * agent loop, and provider adapters (Anthropic + scripted fake).
 */
export {
  ToolRegistry,
  zodToJsonSchema,
  type AiTool,
  type CostClass,
  type DispatchResult,
  type ToolCtx,
  type ToolResult,
} from './registry.js';
export {
  createDraftsmanRegistry,
  snapMmToGrid,
  DRAFTSMAN_TOOL_NAMES,
} from './tools/draftsman.js';
export { assembleContext, CONTEXT_BUDGETS } from './context.js';
export type {
  AgentEvent,
  LlmProvider,
  LlmTurn,
  ProviderContentBlock,
  ProviderMessage,
  ToolSpec,
} from './provider.js';
export { AnthropicProvider, type AnthropicProviderOptions } from './anthropic.js';
export { FakeProvider } from './fake-provider.js';
export { runDraftsman, type DraftsmanResult, type RunDraftsmanOptions } from './agent.js';
