/**
 * @protopulse/ai — the AI crew runtime. Tool registry with scoped slices
 * enforced at dispatch, the budgeted context assembler, the shared agent
 * loop with the Draftsman and Analyst personas, and provider adapters
 * (Anthropic + scripted fake).
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
export {
  runAgentLoop,
  runDraftsman,
  type AgentLoopResult,
  type DraftsmanResult,
  type RunAgentLoopOptions,
  type RunDraftsmanOptions,
} from './agent.js';
export { createAnalystRegistry, sweepVectorName, ANALYST_TOOL_NAMES } from './tools/analyst.js';
export { runAnalyst, type AnalystResult, type RunAnalystOptions } from './analyst.js';
export { designDigest, digestSummary, type DesignDigest } from './tools/digest.js';
export {
  createProfessorRegistry,
  PROFESSOR_TOOL_NAMES,
  type CodeToConcept,
  type ConceptArticleData,
  type ConceptLookup,
} from './tools/professor.js';
export { runProfessor, type ProfessorResult, type RunProfessorOptions } from './professor.js';
export { createRouterRegistry, ROUTER_TOOLS } from './tools/router.js';
export { runRouter, type RouterResult, type RunRouterOptions } from './router.js';
export { createArchitectRegistry, ARCHITECT_TOOLS } from './tools/architect.js';
export { runArchitect, type ArchitectResult, type RunArchitectOptions } from './architect.js';
export {
  createBuyerRegistry,
  BUYER_TOOLS,
  type CatalogLike,
  type CatalogOfferLike,
} from './tools/buyer.js';
export { runBuyer, type BuyerResult, type RunBuyerOptions } from './buyer.js';
export {
  type PinnedDrcDigestFinding,
  type PinnedDrcFn,
  type PinnedRatsnestFn,
  type PinnedRouteFn,
  type PinnedRouteMode,
  type PinnedRouteOutcome,
  type PinnedRouteRequest,
  type PinnedUnroutedPair,
  type RouterHooks,
} from './route-types.js';
export {
  CONCEPT_PAUSE_MARKER,
  isTeachingDepth,
  narrationFor,
  stripConceptPause,
  TEACHING_DEPTHS,
  wantsConceptPause,
  type TeachingDepth,
} from './depth.js';
export {
  fidelitySummary,
  type Analysis,
  type FidelityEntry,
  type ModelTier,
  type PinnedSimulateFn,
  type SimResult,
  type SimResultWithManifest,
  type SimVector,
} from './sim-types.js';
