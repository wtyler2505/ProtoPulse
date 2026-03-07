import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";
import { LRUClientCache } from "./lib/lru-cache";
import { logger } from "./logger";
import { toolRegistry, DESTRUCTIVE_TOOLS, type ToolResult, type ToolContext } from "./ai-tools";
import { anthropicBreaker, geminiBreaker, CircuitBreakerOpenError } from "./circuit-breaker";

export type AIAction =
  | { type: "switch_view"; view: "architecture" | "schematic" | "procurement" | "validation" | "output" | "project_explorer" }
  | { type: "switch_schematic_sheet"; sheetId: string }
  | { type: "add_node"; nodeType: string; label: string; description?: string; positionX?: number; positionY?: number }
  | { type: "remove_node"; nodeLabel: string }
  | { type: "update_node"; nodeLabel: string; newLabel?: string; newType?: string; newDescription?: string }
  | { type: "connect_nodes"; sourceLabel: string; targetLabel: string; edgeLabel?: string; busType?: string; signalType?: string; voltage?: string; busWidth?: number; netName?: string }
  | { type: "remove_edge"; sourceLabel: string; targetLabel: string }
  | { type: "clear_canvas" }
  | { type: "generate_architecture"; components: Array<{ label: string; nodeType: string; description: string; positionX: number; positionY: number }>; connections: Array<{ sourceLabel: string; targetLabel: string; label: string; busType?: string }> }
  | { type: "add_bom_item"; partNumber: string; manufacturer: string; description: string; quantity?: number; unitPrice?: number; supplier?: string; status?: string }
  | { type: "remove_bom_item"; partNumber: string }
  | { type: "update_bom_item"; partNumber: string; updates: Record<string, any> }
  | { type: "run_validation" }
  | { type: "clear_validation" }
  | { type: "add_validation_issue"; severity: string; message: string; componentId?: string; suggestion?: string }
  | { type: "rename_project"; name: string }
  | { type: "update_description"; description: string }
  | { type: "export_bom_csv" }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "auto_layout"; layout: "hierarchical" | "grid" | "circular" | "force" }
  | { type: "add_subcircuit"; template: string; positionX?: number; positionY?: number }
  | { type: "assign_net_name"; sourceLabel: string; targetLabel: string; netName: string }
  | { type: "create_sheet"; name: string }
  | { type: "rename_sheet"; sheetId: string; newName: string }
  | { type: "move_to_sheet"; nodeLabel: string; sheetId: string }
  | { type: "set_pin_map"; nodeLabel: string; pins: Record<string, string> }
  | { type: "auto_assign_pins"; nodeLabel: string }
  | { type: "power_budget_analysis" }
  | { type: "voltage_domain_check" }
  | { type: "auto_fix_validation" }
  | { type: "dfm_check" }
  | { type: "thermal_analysis" }
  | { type: "pricing_lookup"; partNumber: string }
  | { type: "suggest_alternatives"; partNumber: string; reason?: string }
  | { type: "optimize_bom" }
  | { type: "check_lead_times" }
  | { type: "parametric_search"; category: string; specs: Record<string, string> }
  | { type: "analyze_image"; description: string }
  | { type: "save_design_decision"; decision: string; rationale: string }
  | { type: "add_annotation"; nodeLabel: string; note: string; color?: string }
  | { type: "start_tutorial"; topic: string }
  | { type: "export_kicad" }
  | { type: "export_spice" }
  | { type: "preview_gerber" }
  | { type: "add_datasheet_link"; partNumber: string; url: string }
  | { type: "export_design_report" }
  | { type: "set_project_type"; projectType: string }
  // Phase 6: Server-generated file downloads
  | { type: "download_file"; filename: string; mimeType: string; content: string; encoding: "utf8" | "base64" }
  // Phase 6: New export tool action types
  | { type: "export_gerber"; circuitId?: number }
  | { type: "export_kicad_netlist"; circuitId?: number }
  | { type: "export_csv_netlist"; circuitId?: number }
  | { type: "export_pick_and_place"; circuitId?: number }
  | { type: "export_eagle" }
  | { type: "export_fritzing_project"; circuitId?: number };

interface AppState {
  projectName: string;
  projectDescription: string;
  activeView: string;
  selectedNodeId?: string | null;
  nodes: Array<{ id: string; label: string; type: string; description?: string; positionX: number; positionY: number }>;
  edges: Array<{ id: string; source: string; target: string; label?: string; signalType?: string; voltage?: string; busWidth?: number; netName?: string }>;
  bom: Array<{ id: string; partNumber: string; manufacturer: string; description: string; quantity: number; unitPrice: number; supplier: string; status: string }>;
  validationIssues: Array<{ id: string; severity: string; message: string; componentId?: string; suggestion?: string }>;
  schematicSheets: Array<{ id: string; name: string }>;
  activeSheetId: string;
  chatHistory: Array<{ role: string; content: string }>;
  customSystemPrompt?: string;
  changeDiff?: string;
  // Phase 2: Expanded context
  componentParts: Array<{ id: number; nodeId?: string; title?: string; family?: string; manufacturer?: string; mpn?: string; category?: string; pinCount: number }>;
  circuitDesigns: Array<{ id: number; name: string; description?: string; instanceCount: number; netCount: number }>;
  historyItems: Array<{ action: string; user: string; timestamp: string }>;
  bomMetadata: { totalCost: number; itemCount: number; outOfStockCount: number; lowStockCount: number };
  designPreferences: Array<{ category: string; key: string; value: string; source: string; confidence: number }>;
}

// ---------------------------------------------------------------------------
// Stream event types for native tool use
// ---------------------------------------------------------------------------

export interface ToolCallRecord {
  id: string;
  name: string;
  input: Record<string, unknown>;
  result: ToolResult;
}

export type AIStreamEvent =
  | { type: 'text'; text: string }
  | { type: 'tool_call'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; id: string; name: string; result: ToolResult }
  | { type: 'provider_info'; provider: 'anthropic' | 'gemini'; model: string; isFallback: boolean }
  | { type: 'done'; message: string; actions: AIAction[]; toolCalls: ToolCallRecord[]; actionGroupId?: string }
  | { type: 'error'; message: string };

const MAX_TOOL_TURNS = 10;

// ---------------------------------------------------------------------------
// Phase 6: Multi-model routing
// ---------------------------------------------------------------------------

export type RoutingStrategy = 'user' | 'auto' | 'quality' | 'speed' | 'cost';

type ModelTier = 'fast' | 'standard' | 'premium';

/** Design phase derived from the user's active view in the workspace. */
export type DesignPhase = 'architecture' | 'schematic' | 'pcb' | 'validation' | 'export' | 'exploration';

/** Task complexity inferred from message content and project state. */
export type TaskComplexity = 'simple' | 'moderate' | 'complex';

const MODEL_TIERS: Record<string, { fast: string; standard: string; premium: string }> = {
  anthropic: {
    fast: 'claude-haiku-4-5-20251001',
    standard: 'claude-sonnet-4-5-20250514',
    premium: 'claude-opus-4-5-20250514',
  },
  gemini: {
    fast: 'gemini-2.5-flash',
    standard: 'gemini-2.5-flash',
    premium: 'gemini-2.5-pro',
  },
};

/**
 * Phase-complexity routing matrix. Determines the model tier for a given
 * combination of design phase and task complexity under the 'auto' strategy.
 *
 * Rationale:
 * - Architecture/schematic: simple queries (navigation) stay fast; complex
 *   generation (multi-block architectures, full schematics) needs premium.
 * - PCB: even simple queries use standard because PCB layout context is dense.
 * - Validation: mostly rule-based — standard is sufficient even for complex runs.
 * - Export: lightweight generation; only complex multi-format exports need standard.
 * - Exploration: general chat; escalates with complexity.
 */
const PHASE_COMPLEXITY_MATRIX: Record<DesignPhase, Record<TaskComplexity, ModelTier>> = {
  architecture: { simple: 'fast', moderate: 'standard', complex: 'premium' },
  schematic:    { simple: 'fast', moderate: 'standard', complex: 'premium' },
  pcb:          { simple: 'standard', moderate: 'standard', complex: 'premium' },
  validation:   { simple: 'fast', moderate: 'standard', complex: 'standard' },
  export:       { simple: 'fast', moderate: 'fast', complex: 'standard' },
  exploration:  { simple: 'fast', moderate: 'standard', complex: 'standard' },
};

/** Maps from the activeView string in AppState to a canonical design phase. */
const VIEW_TO_PHASE: Record<string, DesignPhase> = {
  architecture: 'architecture',
  schematic: 'schematic',
  breadboard: 'schematic',
  pcb: 'pcb',
  validation: 'validation',
  output: 'export',
  exports: 'export',
};

/**
 * Detect the current design phase from the user's active workspace view.
 * Falls back to 'exploration' for views without a specific phase mapping
 * (dashboard, component_editor, procurement, simulation, lifecycle, etc.).
 */
export function detectDesignPhase(appState: Pick<AppState, 'activeView'>): DesignPhase {
  return VIEW_TO_PHASE[appState.activeView] ?? 'exploration';
}

/** Patterns that indicate a simple, navigational query. */
const SIMPLE_PATTERNS = /^(show\s+me|go\s+to|what\s+is|where\s+is|list|open|switch\s+to|navigate)\b/i;

/** Patterns that indicate a complex, multi-step or generative request. */
const COMPLEX_PATTERNS =
  /\b(design\s+a|generate|create\s+a\s+full|analyze|review|architect|build\s+a|implement|compare\s+and|refactor|optimize\s+the)\b/i;

/**
 * Infer the complexity of a user's request from message content and project state.
 *
 * Heuristics:
 * - **simple**: Short message (<100 chars) OR matches navigation-like patterns with
 *   no multi-step indicators.
 * - **complex**: Long message (>500 chars), matches generative/analytical patterns,
 *   or references multiple component names found in the current BOM/node list.
 * - **moderate**: Everything in between.
 */
export function detectTaskComplexity(message: string, appState: Pick<AppState, 'nodes' | 'bom'>): TaskComplexity {
  const trimmed = message.trim();
  const len = trimmed.length;

  // Short navigational messages are simple
  if (len < 100 && SIMPLE_PATTERNS.test(trimmed)) {
    return 'simple';
  }

  // Long messages are at least moderate; check for complex indicators
  if (len > 500) {
    return COMPLEX_PATTERNS.test(trimmed) ? 'complex' : 'moderate';
  }

  // Check for complex patterns regardless of length
  if (COMPLEX_PATTERNS.test(trimmed)) {
    return 'complex';
  }

  // Check if the message references multiple existing components (cross-referencing
  // indicates a more involved request that benefits from a stronger model)
  const componentNames = [
    ...appState.nodes.map((n) => n.label.toLowerCase()),
    ...appState.bom.map((b) => b.partNumber.toLowerCase()),
  ];
  if (componentNames.length > 0) {
    const lowerMessage = trimmed.toLowerCase();
    const matchCount = componentNames.filter((name) => name.length > 2 && lowerMessage.includes(name)).length;
    if (matchCount >= 3) {
      return 'complex';
    }
    if (matchCount >= 2) {
      return 'moderate';
    }
  }

  // Short messages without strong signals are simple
  if (len < 100) {
    return 'simple';
  }

  return 'moderate';
}

/**
 * Select an AI model based on routing strategy, provider capabilities, and
 * optionally the user's design phase and task complexity.
 *
 * Strategies:
 * - **user**: Always returns the user-selected model.
 * - **quality**: Always selects the premium tier.
 * - **speed**: Always selects the fast tier.
 * - **cost**: Always selects the fast tier.
 * - **auto**: Uses design-phase and task-complexity awareness when appState is
 *   provided; falls back to message-length heuristics otherwise. Images always
 *   route to standard+ tier for vision capability.
 */
export function routeToModel(params: {
  strategy: RoutingStrategy;
  provider: 'anthropic' | 'gemini';
  userModel: string;
  messageLength: number;
  hasImage: boolean;
  appState?: Pick<AppState, 'activeView' | 'nodes' | 'bom'>;
  message?: string;
}): { model: string; reason: string } {
  const { strategy, provider, userModel, messageLength, hasImage, appState, message } = params;

  if (strategy === 'user') {
    return { model: userModel, reason: 'User-selected model' };
  }

  const tiers = MODEL_TIERS[provider];
  if (!tiers) {
    return { model: userModel, reason: 'Unknown provider, using user model' };
  }

  if (strategy === 'quality') {
    return { model: tiers.premium, reason: 'Quality strategy: premium tier' };
  }
  if (strategy === 'speed') {
    return { model: tiers.fast, reason: 'Speed strategy: fast tier' };
  }
  if (strategy === 'cost') {
    return { model: tiers.fast, reason: 'Cost strategy: fast tier' };
  }

  // strategy === 'auto'
  // Images always require at least standard tier for vision capability
  if (hasImage) {
    // If we have phase info, upgrade to premium for complex image analysis
    if (appState && message) {
      const phase = detectDesignPhase(appState);
      const complexity = detectTaskComplexity(message, appState);
      const matrixTier = PHASE_COMPLEXITY_MATRIX[phase][complexity];
      const tier = matrixTier === 'fast' ? 'standard' : matrixTier;
      const selectedModel = tiers[tier];
      logger.info('AI model routing', {
        phase,
        complexity,
        strategy,
        selectedModel,
        reason: `Auto (phase-aware): image + ${phase}/${complexity} → ${tier}`,
      });
      return { model: selectedModel, reason: `Auto (phase-aware): image + ${phase}/${complexity} → ${tier}` };
    }
    return { model: tiers.standard, reason: 'Auto: image attached, using standard (vision-capable)' };
  }

  // Phase-aware routing when appState is available
  if (appState && message) {
    const phase = detectDesignPhase(appState);
    const complexity = detectTaskComplexity(message, appState);
    const tier = PHASE_COMPLEXITY_MATRIX[phase][complexity];
    const selectedModel = tiers[tier];
    logger.info('AI model routing', {
      phase,
      complexity,
      strategy,
      selectedModel,
      reason: `Auto (phase-aware): ${phase}/${complexity} → ${tier}`,
    });
    return { model: selectedModel, reason: `Auto (phase-aware): ${phase}/${complexity} → ${tier}` };
  }

  // Fallback: message-length heuristics when appState is not provided
  if (messageLength < 200) {
    logger.info('AI model routing', {
      phase: 'unknown',
      complexity: 'unknown',
      strategy,
      selectedModel: tiers.fast,
      reason: 'Auto (fallback): short message, using fast tier',
    });
    return { model: tiers.fast, reason: 'Auto (fallback): short message, using fast tier' };
  }
  if (messageLength > 2000) {
    logger.info('AI model routing', {
      phase: 'unknown',
      complexity: 'unknown',
      strategy,
      selectedModel: tiers.premium,
      reason: 'Auto (fallback): long/complex message, using premium tier',
    });
    return { model: tiers.premium, reason: 'Auto (fallback): long/complex message, using premium tier' };
  }
  logger.info('AI model routing', {
    phase: 'unknown',
    complexity: 'unknown',
    strategy,
    selectedModel: tiers.standard,
    reason: 'Auto (fallback): standard complexity',
  });
  return { model: tiers.standard, reason: 'Auto (fallback): standard complexity' };
}

// ---------------------------------------------------------------------------
// Context window management (EN-12)
// ---------------------------------------------------------------------------

/** Approximate token count. Uses word-count × 1.3 heuristic — accurate
 *  to ~10% for typical English/code content. */
function estimateTokens(text: string): number {
  if (!text) { return 0; }
  return Math.ceil(text.split(/\s+/).filter(Boolean).length * 1.3);
}

/** Known input context window sizes per model ID (tokens). */
const MODEL_CONTEXT_LIMITS: Record<string, number> = {
  // Anthropic
  'claude-opus-4-5-20250514': 200_000,
  'claude-sonnet-4-5-20250514': 200_000,
  'claude-haiku-4-5-20251001': 200_000,
  'claude-3-5-sonnet-20241022': 200_000,
  'claude-3-5-haiku-20241022': 200_000,
  'claude-3-haiku-20240307': 200_000,
  // Gemini
  'gemini-2.5-pro': 1_000_000,
  'gemini-2.5-flash': 1_000_000,
  'gemini-1.5-pro': 2_000_000,
  'gemini-1.5-flash': 1_000_000,
};

function getModelContextLimit(model: string): number {
  if (MODEL_CONTEXT_LIMITS[model]) { return MODEL_CONTEXT_LIMITS[model]; }
  // Prefix match: "claude-sonnet-4-5" matches "claude-sonnet-4-5-20250514"
  for (const [key, limit] of Object.entries(MODEL_CONTEXT_LIMITS)) {
    if (model.startsWith(key) || key.startsWith(model)) { return limit; }
  }
  return 200_000; // conservative default
}

/** Select the most-recent messages that fit within the model's context budget.
 *  Replaces the old fixed `.slice(-10)` with token-aware truncation. */
function fitMessagesToContext(
  chatHistory: Array<{ role: string; content: string }>,
  systemPromptTokens: number,
  currentMessageTokens: number,
  model: string,
): Array<{ role: string; content: string }> {
  const contextLimit = getModelContextLimit(model);
  // Reserve: max response tokens + system prompt + current message + safety margin
  const responseReserve = Math.min(4096, Math.floor(contextLimit * 0.05));
  const budget = contextLimit - responseReserve - systemPromptTokens - currentMessageTokens - 200;

  if (budget <= 0) { return []; }

  // Hard cap: never send more than 50 history messages (avoid degenerate loops)
  const candidates = chatHistory.slice(-50);

  const selected: Array<{ role: string; content: string }> = [];
  let used = 0;
  for (let i = candidates.length - 1; i >= 0; i--) {
    const tokens = estimateTokens(candidates[i].content);
    if (used + tokens > budget) { break; }
    selected.unshift(candidates[i]);
    used += tokens;
  }

  return selected;
}

/** Image content for multimodal messages (Phase 4). */
export interface ImageContent {
  base64: string;
  mediaType: string;
}

const MAX_CLIENT_CACHE = 10;

const anthropicClients = new LRUClientCache<Anthropic>(MAX_CLIENT_CACHE);
const geminiClients = new LRUClientCache<GoogleGenAI>(MAX_CLIENT_CACHE);

/**
 * Per-session prompt cache. Keyed by a composite of projectId + state hash
 * so different users/sessions don't share cached prompts (fixes the
 * module-level singleton bug where all users shared one cached prompt).
 */
const promptCache = new LRUClientCache<string>(20);

function hashAppState(appState: AppState, userId?: number): string {
  return JSON.stringify({
    userId: userId ?? null,
    name: appState.projectName,
    desc: appState.projectDescription,
    nodes: appState.nodes.length,
    edges: appState.edges.length,
    bom: appState.bom.length,
    validation: appState.validationIssues.length,
    sheets: appState.schematicSheets.length,
    view: appState.activeView,
    selected: appState.selectedNodeId,
    custom: appState.customSystemPrompt || '',
  });
}

type AIErrorCode = 'AUTH_FAILED' | 'RATE_LIMITED' | 'TIMEOUT' | 'MODEL_ERROR' | 'PROVIDER_ERROR' | 'UNKNOWN';

/** Safely extract message and HTTP status from unknown error shapes. */
function extractErrorInfo(error: unknown): { message: string; status: number | undefined } {
  if (error === null || typeof error !== 'object') {
    return { message: String(error ?? ''), status: undefined };
  }
  const e = error as Record<string, unknown>;
  return {
    message: typeof e.message === 'string' ? e.message : String(error),
    status:
      typeof e.status === 'number' ? e.status :
      typeof e.statusCode === 'number' ? e.statusCode :
      undefined,
  };
}

/** Strip API keys from error messages to prevent leaking secrets in responses. */
export function redactSecrets(text: string): string {
  return text.replace(/sk-[a-zA-Z0-9]+/g, '[REDACTED]').replace(/AIza[a-zA-Z0-9_-]+/g, '[REDACTED]');
}

export function categorizeError(error: unknown): { code: AIErrorCode; userMessage: string } {
  const { message: msg, status } = extractErrorInfo(error);

  if (status === 401 || msg.includes('authentication') || msg.includes('API key') || msg.includes('invalid_api_key')) {
    return { code: 'AUTH_FAILED', userMessage: `Authentication failed. Please check your API key in settings.` };
  }
  if (status === 429 || msg.includes('rate limit') || msg.includes('quota')) {
    return { code: 'RATE_LIMITED', userMessage: 'Rate limit exceeded. Please wait a moment and try again.' };
  }
  if (msg.includes('timeout') || msg.includes('ETIMEDOUT') || msg.includes('ECONNABORTED')) {
    return { code: 'TIMEOUT', userMessage: 'Request timed out. Try again with a shorter message.' };
  }
  if (status === 400 || msg.includes('invalid_request') || msg.includes('model not found')) {
    return { code: 'MODEL_ERROR', userMessage: `Invalid request. The model "${msg}" may not be available.` };
  }
  if (status !== undefined && status >= 500) {
    return { code: 'PROVIDER_ERROR', userMessage: 'The AI provider is experiencing issues. Try again shortly.' };
  }

  return { code: 'UNKNOWN', userMessage: `AI error: ${redactSecrets(msg)}` };
}

// ---------------------------------------------------------------------------
// AI provider fallback — retry with alternate provider on non-4xx errors
// ---------------------------------------------------------------------------

const FALLBACK_DISABLED = process.env.DISABLE_AI_FALLBACK === '1';

/**
 * Determine whether an error is retryable via fallback provider.
 * 4xx errors (client errors) are NOT retryable — they indicate a problem with
 * the request itself (bad key, invalid model, rate limited). Retrying with a
 * different provider won't help for auth/model errors and could mask issues.
 *
 * Retryable: 5xx, timeouts, network errors, circuit breaker open, unknown errors
 * without an HTTP status.
 */
export function isRetryableError(error: unknown): boolean {
  const { status } = extractErrorInfo(error);

  // Circuit breaker open is retryable — the other provider may be healthy
  if (error instanceof CircuitBreakerOpenError) {
    return true;
  }

  // 4xx errors are client errors — do NOT retry
  if (status !== undefined && status >= 400 && status < 500) {
    return false;
  }

  // 5xx, network errors (no status), timeouts — all retryable
  return true;
}

/** Parameters for the alternate (fallback) AI provider. */
export interface FallbackProviderConfig {
  provider: 'anthropic' | 'gemini';
  model: string;
  apiKey: string;
}

/**
 * Build the default fallback model for a given provider.
 * Uses the 'standard' tier from MODEL_TIERS for the alternate provider.
 */
export function getDefaultFallbackModel(fallbackProvider: 'anthropic' | 'gemini'): string {
  const tiers = MODEL_TIERS[fallbackProvider];
  return tiers ? tiers.standard : (fallbackProvider === 'anthropic' ? 'claude-sonnet-4-5-20250514' : 'gemini-2.5-flash');
}

const activeRequests = new Map<string, Promise<{ message: string; actions: AIAction[] }>>();

function requestKey(message: string, provider: string, projectId: string): string {
  return `${provider}:${projectId}:${message.slice(0, 100)}`;
}

export function getAnthropicClient(apiKey: string): Anthropic {
  let client = anthropicClients.get(apiKey);
  if (!client) {
    client = new Anthropic({ apiKey });
    anthropicClients.set(apiKey, client);
  }
  return client;
}

function getGeminiClient(apiKey: string): GoogleGenAI {
  let client = geminiClients.get(apiKey);
  if (!client) {
    client = new GoogleGenAI({ apiKey });
    geminiClients.set(apiKey, client);
  }
  return client;
}

// ---------------------------------------------------------------------------
// View-aware context: include full data for active view's domain, summaries
// for unrelated domains. Reduces prompt token count significantly.
// ---------------------------------------------------------------------------

const ARCH_VIEWS = new Set(['architecture', 'breadboard']);
const SCHEMATIC_VIEWS = new Set(['schematic', 'pcb']);
const BOM_VIEWS = new Set(['procurement']);
const VALIDATION_VIEWS = new Set(['validation']);

function isArchView(v: string): boolean { return ARCH_VIEWS.has(v); }
function isSchematicView(v: string): boolean { return SCHEMATIC_VIEWS.has(v); }
function isBomView(v: string): boolean { return BOM_VIEWS.has(v); }
function isValidationView(v: string): boolean { return VALIDATION_VIEWS.has(v); }

function buildNodesSummary(nodes: AppState['nodes']): string {
  if (nodes.length === 0) return "  (none)";
  const byType = new Map<string, number>();
  for (const n of nodes) {
    byType.set(n.type, (byType.get(n.type) || 0) + 1);
  }
  return `  ${nodes.length} components: ${Array.from(byType.entries()).map(([t, c]) => `${c} ${t}`).join(', ')} (use tools to query details)`;
}

function buildEdgesSummary(edges: AppState['edges']): string {
  if (edges.length === 0) return "  (none)";
  return `  ${edges.length} connections (use tools to query details)`;
}

function buildBomSummary(bom: AppState['bom']): string {
  if (bom.length === 0) return "  (none)";
  return `  ${bom.length} items (use tools to query details)`;
}

function buildValidationSummary(issues: AppState['validationIssues']): string {
  if (issues.length === 0) return "  (none)";
  const byLevel = new Map<string, number>();
  for (const v of issues) {
    byLevel.set(v.severity, (byLevel.get(v.severity) || 0) + 1);
  }
  return `  ${issues.length} issues: ${Array.from(byLevel.entries()).map(([s, c]) => `${c} ${s}`).join(', ')}`;
}

function buildSystemPrompt(appState: AppState): string {
  const view = appState.activeView;
  const archActive = isArchView(view);
  const schematicActive = isSchematicView(view);
  const bomActive = isBomView(view);
  const validationActive = isValidationView(view);

  // Architecture nodes/edges — always full for arch view, summary otherwise
  const nodesDescription = (archActive || appState.nodes.length <= 10)
    ? (appState.nodes.length > 0
      ? appState.nodes.map(n => `  - "${n.label}" (type: ${n.type}, id: ${n.id}, pos: ${n.positionX},${n.positionY}${n.description ? `, desc: ${n.description}` : ""})`).join("\n")
      : "  (none)")
    : buildNodesSummary(appState.nodes);

  const edgesDescription = (archActive || appState.edges.length <= 10)
    ? (appState.edges.length > 0
      ? appState.edges.map(e => {
          const srcNode = appState.nodes.find(n => n.id === e.source);
          const tgtNode = appState.nodes.find(n => n.id === e.target);
          const meta = [
            e.signalType ? `signal: ${e.signalType}` : "",
            e.voltage ? `voltage: ${e.voltage}` : "",
            e.busWidth ? `bus: ${e.busWidth}` : "",
            e.netName ? `net: ${e.netName}` : "",
          ].filter(Boolean).join(", ");
          return `  - "${srcNode?.label || e.source}" → "${tgtNode?.label || e.target}"${e.label ? ` [${e.label}]` : ""} (id: ${e.id}${meta ? `, ${meta}` : ""})`;
        }).join("\n")
      : "  (none)")
    : buildEdgesSummary(appState.edges);

  // BOM — full for procurement view, summary otherwise
  const bomDescription = (bomActive || appState.bom.length <= 5)
    ? (appState.bom.length > 0
      ? appState.bom.map(b => `  - ${b.partNumber} | ${b.manufacturer} | ${b.description} | qty: ${b.quantity} | $${b.unitPrice} | ${b.supplier} | ${b.status}`).join("\n")
      : "  (none)")
    : buildBomSummary(appState.bom);

  // Validation — full for validation view, summary otherwise
  const validationDescription = (validationActive || appState.validationIssues.length <= 5)
    ? (appState.validationIssues.length > 0
      ? appState.validationIssues.map(v => `  - [${v.severity}] ${v.message}${v.componentId ? ` (component: ${v.componentId})` : ""}${v.suggestion ? ` → ${v.suggestion}` : ""}`).join("\n")
      : "  (none)")
    : buildValidationSummary(appState.validationIssues);

  // Schematic sheets — full for schematic/PCB views, summary otherwise
  const sheetsDescription = (schematicActive || appState.schematicSheets.length <= 5)
    ? (appState.schematicSheets.length > 0
      ? appState.schematicSheets.map(s => `  - "${s.name}" (id: ${s.id}${s.id === appState.activeSheetId ? ", ACTIVE" : ""})`).join("\n")
      : "  (none)")
    : `  ${appState.schematicSheets.length} sheets (active: ${appState.activeSheetId})`;

  // Phase 2: Component Library description (tiered)
  let componentPartsDescription: string;
  if (appState.componentParts.length === 0) {
    componentPartsDescription = "  (none)";
  } else if (appState.componentParts.length <= 20) {
    componentPartsDescription = appState.componentParts.map(p =>
      `  - ${p.title || "(untitled)"} | ${p.category || "generic"} | ${p.manufacturer || "?"} | MPN: ${p.mpn || "?"} | ${p.pinCount} pins${p.nodeId ? ` | linked to node ${p.nodeId}` : ""}`
    ).join("\n");
  } else if (appState.componentParts.length <= 100) {
    const byCategory = new Map<string, number>();
    for (const p of appState.componentParts) {
      const cat = p.category || "uncategorized";
      byCategory.set(cat, (byCategory.get(cat) || 0) + 1);
    }
    componentPartsDescription = `  ${appState.componentParts.length} parts total. By category:\n` +
      Array.from(byCategory.entries()).map(([cat, count]) => `    - ${cat}: ${count}`).join("\n");
  } else {
    componentPartsDescription = `  ${appState.componentParts.length} parts in library (use tools to query specific parts)`;
  }

  // Phase 2: Circuit Designs description (tiered)
  let circuitDesignsDescription: string;
  if (appState.circuitDesigns.length === 0) {
    circuitDesignsDescription = "  (none)";
  } else if (appState.circuitDesigns.length <= 20) {
    circuitDesignsDescription = appState.circuitDesigns.map(c =>
      `  - "${c.name}" (id: ${c.id}) — ${c.instanceCount} instances, ${c.netCount} nets${c.description ? ` | ${c.description}` : ""}`
    ).join("\n");
  } else {
    circuitDesignsDescription = `  ${appState.circuitDesigns.length} circuit designs (${appState.circuitDesigns.reduce((s, c) => s + c.instanceCount, 0)} total instances, ${appState.circuitDesigns.reduce((s, c) => s + c.netCount, 0)} total nets)`;
  }

  // Phase 2: Recent History description (last 20)
  const recentHistory = appState.historyItems.slice(0, 20);
  const historyDescription = recentHistory.length > 0
    ? recentHistory.map(h => `  - [${h.user}] ${h.action} (${h.timestamp})`).join("\n")
    : "  (none)";

  // Phase 2: BOM Summary metadata
  const bomSummaryDescription = appState.bomMetadata.itemCount > 0
    ? `  Total items: ${appState.bomMetadata.itemCount} | Total cost: $${appState.bomMetadata.totalCost.toFixed(2)} | Out of stock: ${appState.bomMetadata.outOfStockCount} | Low stock: ${appState.bomMetadata.lowStockCount}`
    : "  (no BOM items)";

  return `You are ProtoPulse AI, an expert electronics and system design assistant embedded in the ProtoPulse application — a comprehensive hardware prototyping platform for designing, validating, and managing electronic systems.

You are a world-class expert in:
- PCB design and layout (multi-layer, impedance-controlled, high-speed)
- Component selection and sourcing (MCUs, sensors, power ICs, passives, connectors)
- Power management (LDOs, buck/boost converters, battery charging, power sequencing)
- RF and wireless design (antenna matching, Wi-Fi, BLE, LoRa, Zigbee, cellular)
- Communication protocols (SPI, I2C, UART, CAN, USB, Ethernet, MIPI)
- Firmware and embedded systems (RTOS, bare-metal, bootloaders, OTA updates)
- IoT system architecture (edge computing, cloud connectivity, MQTT, CoAP)
- Signal integrity and EMC/EMI compliance
- Thermal management and mechanical considerations
- Design for manufacturing (DFM) and design for test (DFT)
- BOM optimization and cost engineering
- Regulatory compliance (FCC, CE, UL, RoHS, REACH)

## Application Capabilities

ProtoPulse has these main views:
1. **Architecture View** — A node-based diagram editor where users design system block diagrams. Nodes represent components (MCUs, sensors, power ICs, etc.) and edges represent connections (buses like SPI, I2C, power rails).
2. **Schematic View** — A schematic viewer with multiple sheets for detailed circuit design.
3. **Procurement View** — Bill of Materials (BOM) management with part numbers, manufacturers, pricing, suppliers, stock status.
4. **Validation View** — Design rule checking with categorized issues (errors, warnings, info) and suggested fixes.
5. **Output View** — Export and output generation.
6. **Project Explorer** — Project settings, name, description.

## Current Project State

**Project:** ${appState.projectName}
**Description:** ${appState.projectDescription || "(none)"}
**Active View:** ${appState.activeView}
**Selected Component:** ${(() => {
    if (appState.selectedNodeId) {
      const sel = appState.nodes.find(n => n.id === appState.selectedNodeId);
      if (sel) return `"${sel.label}" (type: ${sel.type}, pos: ${sel.positionX},${sel.positionY}${sel.description ? `, desc: ${sel.description}` : ""})`;
    }
    return "(none)";
  })()}

### Recent Changes (since last AI turn):
${appState.changeDiff || "(no changes)"}

### Architecture Nodes:
${nodesDescription}

### Architecture Connections:
${edgesDescription}

### Bill of Materials:
${bomDescription}

### Validation Issues:
${validationDescription}

### Schematic Sheets:
${sheetsDescription}

### Component Library:
${componentPartsDescription}

### Circuit Designs:
${circuitDesignsDescription}

### Recent History:
${historyDescription}

### BOM Summary:
${bomSummaryDescription}

### Design Preferences:
${appState.designPreferences.length > 0
    ? appState.designPreferences.map(p => `  - [${p.category}] ${p.key}: ${p.value} (source: ${p.source}, confidence: ${(p.confidence * 100).toFixed(0)}%)`).join("\n")
    : "  (none — learn preferences from the user's design choices and stated requirements)"}

## Tools

You have access to tools that let you directly modify the project. When the user asks you to make changes, use the provided tools. You can call multiple tools to perform complex operations.

For informational questions, discussions, explanations, or advice — respond with text only, do NOT call tools.

Guidelines when using tools:
- When referencing architecture nodes, use their LABEL (display name), not internal IDs.
- Position new components logically: power on left (x: 100-200), MCUs center (x: 300-500), peripherals right (x: 600-800), sensors at bottom (y: 350-500). Place connected components near each other (within 200px). Use reasonable spacing (150-200px between components).
- Use real part numbers and manufacturers when adding BOM items.
- Explain your reasoning in text alongside tool calls.
- You can call multiple tools in sequence to perform complex operations atomically.

Always provide expert-level, detailed electronics advice. When suggesting components, include real part numbers, manufacturers, and typical specifications. When discussing design choices, explain trade-offs and best practices.${appState.customSystemPrompt ? `\n\n## Custom User Instructions\n\n${appState.customSystemPrompt}` : ''}`;
}

export function parseActionsFromResponse(text: string): { message: string; actions: AIAction[] } {
  const jsonBlockRegex = /```json\s*\n?([\s\S]*?)\n?\s*```/g;
  let lastMatch: RegExpExecArray | null = null;
  let match: RegExpExecArray | null;
  while ((match = jsonBlockRegex.exec(text)) !== null) {
    lastMatch = match;
  }

  if (!lastMatch) {
    const bareJsonRegex = /\[\s*\{[\s\S]*\}\s*\]\s*$/;
    const bareMatch = text.match(bareJsonRegex);
    if (bareMatch) {
      try {
        const parsed = JSON.parse(bareMatch[0]);
        const actions = Array.isArray(parsed) ? parsed.filter(a => a && typeof a === 'object' && typeof a.type === 'string') : [];
        if (actions.length > 0) {
          const message = text.slice(0, bareMatch.index).trim();
          return { message, actions };
        }
      } catch {}
    }
    return { message: text.trim(), actions: [] };
  }

  const message = text.slice(0, lastMatch.index).trim();
  try {
    const parsed = JSON.parse(lastMatch[1]);
    const actions: AIAction[] = Array.isArray(parsed) ? parsed : [parsed];
    const validActions = actions.filter((action): action is AIAction => {
      return action && typeof action === 'object' && typeof action.type === 'string';
    });
    return { message, actions: validActions };
  } catch {
    return { message: text.trim(), actions: [] };
  }
}

async function callAnthropic(
  apiKey: string,
  model: string,
  systemPrompt: string,
  chatHistory: Array<{ role: string; content: string }>,
  userMessage: string,
  temperature: number = 0.7,
  maxTokens?: number,
  imageContent?: ImageContent,
): Promise<{ message: string; actions: AIAction[] }> {
  const client = getAnthropicClient(apiKey);
  const anthropicTools = toolRegistry.toAnthropicTools();

  const messages: Anthropic.MessageParam[] = [];
  for (const msg of chatHistory) {
    if (msg.role === "user" || msg.role === "assistant") {
      messages.push({ role: msg.role as "user" | "assistant", content: msg.content });
    }
  }

  // Build user message — multimodal if image attached
  if (imageContent) {
    messages.push({
      role: "user",
      content: [
        {
          type: "image",
          source: {
            type: "base64",
            media_type: imageContent.mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
            data: imageContent.base64,
          },
        },
        { type: "text", text: userMessage },
      ],
    });
  } else {
    messages.push({ role: "user", content: userMessage });
  }

  const response = await anthropicBreaker.execute(() =>
    client.messages.create({
      model,
      max_tokens: maxTokens || 4096,
      system: systemPrompt,
      messages,
      temperature,
      tools: anthropicTools as Anthropic.Messages.Tool[],
      tool_choice: { type: "auto" },
    }),
  );

  // Extract text content
  const responseText = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");

  // Extract tool calls as actions (single turn — no server execution in non-streaming path)
  const toolUseBlocks = response.content.filter(
    (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
  );
  if (toolUseBlocks.length > 0) {
    const actions = toolUseBlocks.map(b => ({
      type: b.name,
      ...(b.input as Record<string, unknown>),
    })) as unknown as AIAction[];
    return { message: responseText.trim(), actions };
  }

  return parseActionsFromResponse(responseText);
}

async function callGemini(
  apiKey: string,
  model: string,
  systemPrompt: string,
  chatHistory: Array<{ role: string; content: string }>,
  userMessage: string,
  temperature: number = 0.7,
  maxTokens?: number,
  imageContent?: ImageContent,
): Promise<{ message: string; actions: AIAction[] }> {
  const genAI = getGeminiClient(apiKey);
  const geminiFunctionDeclarations = toolRegistry.toGeminiFunctionDeclarations();

  const history = chatHistory.map((msg) => ({
    role: msg.role === "assistant" ? ("model" as const) : ("user" as const),
    parts: [{ text: msg.content }],
  }));

  const chat = genAI.chats.create({
    model,
    config: {
      systemInstruction: systemPrompt,
      temperature,
      maxOutputTokens: maxTokens || 4096,
      tools: [{ functionDeclarations: geminiFunctionDeclarations }],
    },
    history,
  });

  // Build message — multimodal if image attached
  const messageParts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];
  if (imageContent) {
    messageParts.push({ inlineData: { mimeType: imageContent.mediaType, data: imageContent.base64 } });
  }
  messageParts.push({ text: userMessage });

  const result = await geminiBreaker.execute(() =>
    chat.sendMessage({ message: messageParts as Parameters<typeof chat.sendMessage>[0]["message"] }),
  );

  // Extract function calls as actions (single turn — no server execution in non-streaming path)
  const functionCalls = result.functionCalls;
  if (functionCalls && functionCalls.length > 0) {
    const actions = functionCalls.map(fc => ({
      type: fc.name ?? '',
      ...((fc.args ?? {}) as Record<string, unknown>),
    })) as unknown as AIAction[];
    const responseText = result.text ?? "";
    return { message: responseText.trim(), actions };
  }

  const responseText = result.text ?? "";
  return parseActionsFromResponse(responseText);
}

export async function processAIMessage(params: {
  message: string;
  provider: "anthropic" | "gemini";
  model: string;
  apiKey: string;
  appState: AppState;
  temperature?: number;
  maxTokens?: number;
  imageContent?: ImageContent;
  fallback?: FallbackProviderConfig;
  projectId?: number;
  userId?: number;
}): Promise<{ message: string; actions: AIAction[]; provider?: 'anthropic' | 'gemini' }> {
  try {
    const { message, provider, model, apiKey, appState, temperature = 0.7, maxTokens, imageContent, fallback, projectId, userId } = params;

    if (!apiKey || apiKey.trim().length === 0) {
      return {
        message: `No API key provided for ${provider}. Please add your ${provider === "anthropic" ? "Anthropic" : "Google Gemini"} API key in the settings panel to enable AI features.`,
        actions: [],
      };
    }

    if (message.length > 32000) {
      return {
        message: "Your message is too long. Please keep messages under 32,000 characters.",
        actions: [],
      };
    }

    const stateHash = hashAppState(appState, userId);
    const cachedPrompt = promptCache.get(stateHash);
    const systemPrompt = cachedPrompt ?? (() => {
      const built = buildSystemPrompt(appState);
      promptCache.set(stateHash, built);
      return built;
    })();
    const recentHistory = fitMessagesToContext(
      appState.chatHistory,
      estimateTokens(systemPrompt),
      estimateTokens(message),
      model,
    );

    const dedupeKey = requestKey(message, provider, String(projectId ?? appState.projectName));
    const existing = activeRequests.get(dedupeKey);
    if (existing) return existing;

    const promise = (async (): Promise<{ message: string; actions: AIAction[]; provider?: 'anthropic' | 'gemini' }> => {
      try {
        const result = provider === "anthropic"
          ? await callAnthropic(apiKey, model, systemPrompt, recentHistory, message, temperature, maxTokens, imageContent)
          : await callGemini(apiKey, model, systemPrompt, recentHistory, message, temperature, maxTokens, imageContent);
        return { ...result, provider };
      } catch (primaryError: unknown) {
        // Attempt fallback if enabled and error is retryable
        if (!FALLBACK_DISABLED && fallback && fallback.apiKey && isRetryableError(primaryError)) {
          const { code: primaryCode } = categorizeError(primaryError);
          const { message: primaryMsg } = extractErrorInfo(primaryError);
          logger.warn(`[ai:fallback] Primary provider ${provider} failed (${primaryCode}): ${redactSecrets(primaryMsg)}. Falling back to ${fallback.provider}.`);

          const fallbackResult = fallback.provider === "anthropic"
            ? await callAnthropic(fallback.apiKey, fallback.model, systemPrompt, recentHistory, message, temperature, maxTokens, imageContent)
            : await callGemini(fallback.apiKey, fallback.model, systemPrompt, recentHistory, message, temperature, maxTokens, imageContent);
          return { ...fallbackResult, provider: fallback.provider };
        }
        throw primaryError;
      }
    })();
    activeRequests.set(dedupeKey, promise);
    try {
      return await promise;
    } finally {
      activeRequests.delete(dedupeKey);
    }
  } catch (error: unknown) {
    const { userMessage } = categorizeError(error);
    return {
      message: userMessage,
      actions: [],
    };
  }
}

/**
 * Execute the streaming call for a single provider and emit the done event.
 * Returns the result so callers can inspect it (e.g. for fallback decisions).
 */
async function executeStreamForProvider(
  provider: 'anthropic' | 'gemini',
  apiKey: string,
  model: string,
  systemPrompt: string,
  recentHistory: Array<{ role: string; content: string }>,
  message: string,
  temperature: number,
  maxTokens: number,
  toolContext: ToolContext | undefined,
  onEvent: (event: AIStreamEvent) => void | Promise<void>,
  signal: AbortSignal | undefined,
  imageContent: ImageContent | undefined,
): Promise<{ fullText: string; toolCalls: ToolCallRecord[] }> {
  if (provider === 'anthropic') {
    return streamAnthropicWithTools(
      apiKey, model, systemPrompt, recentHistory, message,
      temperature, maxTokens, toolContext, onEvent, signal, imageContent,
    );
  } else {
    return streamGeminiWithTools(
      apiKey, model, systemPrompt, recentHistory, message,
      temperature, maxTokens, toolContext, onEvent, signal, imageContent,
    );
  }
}

export async function streamAIMessage(
  params: {
    message: string;
    provider: "anthropic" | "gemini";
    model: string;
    apiKey: string;
    appState: AppState;
    temperature?: number;
    maxTokens?: number;
    toolContext?: ToolContext;
    imageContent?: ImageContent;
    fallback?: FallbackProviderConfig;
    userId?: number;
  },
  onEvent: (event: AIStreamEvent) => void | Promise<void>,
  signal?: AbortSignal
): Promise<void> {
  try {
    const { message, provider, model, apiKey, appState, temperature = 0.7, maxTokens, toolContext, imageContent, fallback, userId } = params;

    if (!apiKey || apiKey.trim().length === 0) {
      const noKeyMsg = `No API key provided for ${provider}. Please add your ${provider === "anthropic" ? "Anthropic" : "Google Gemini"} API key in the settings panel to enable AI features.`;
      await onEvent({ type: 'text', text: noKeyMsg });
      await onEvent({ type: 'done', message: noKeyMsg, actions: [], toolCalls: [] });
      return;
    }

    if (message.length > 32000) {
      const longMsg = "Your message is too long. Please keep messages under 32,000 characters.";
      await onEvent({ type: 'text', text: longMsg });
      await onEvent({ type: 'done', message: longMsg, actions: [], toolCalls: [] });
      return;
    }

    const stateHash = hashAppState(appState, userId);
    const cachedPrompt2 = promptCache.get(stateHash);
    const systemPrompt = cachedPrompt2 ?? (() => {
      const built = buildSystemPrompt(appState);
      promptCache.set(stateHash, built);
      return built;
    })();
    const recentHistory = fitMessagesToContext(
      appState.chatHistory,
      estimateTokens(systemPrompt),
      estimateTokens(message),
      model,
    );
    const actionGroupId = crypto.randomUUID();

    let activeProvider = provider;
    let activeModel = model;
    let activeApiKey = apiKey;
    let isFallback = false;

    try {
      // Emit provider info for the primary provider
      await onEvent({ type: 'provider_info', provider: activeProvider, model: activeModel, isFallback: false });

      const result = await executeStreamForProvider(
        activeProvider, activeApiKey, activeModel, systemPrompt, recentHistory, message,
        temperature, maxTokens || 4096, toolContext, onEvent, signal, imageContent,
      );
      if (signal?.aborted) return;

      persistToolCalls(result.toolCalls, toolContext, actionGroupId).catch(() => {});

      const clientActions = extractClientActions(result.toolCalls);
      const textParsed = result.toolCalls.length === 0
        ? parseActionsFromResponse(result.fullText)
        : { message: result.fullText, actions: [] as AIAction[] };

      await onEvent({
        type: 'done',
        message: result.fullText.trim() || textParsed.message,
        actions: result.toolCalls.length > 0 ? clientActions : textParsed.actions,
        toolCalls: result.toolCalls,
        actionGroupId: result.toolCalls.length > 0 ? actionGroupId : undefined,
      });
    } catch (primaryError: unknown) {
      if (signal?.aborted) return;

      // Attempt fallback if enabled, fallback config present, and error is retryable
      if (!FALLBACK_DISABLED && fallback && fallback.apiKey && isRetryableError(primaryError)) {
        const { code: primaryCode } = categorizeError(primaryError);
        const { message: primaryMsg } = extractErrorInfo(primaryError);
        logger.warn(
          `[ai:fallback] Primary provider ${provider} failed (${primaryCode}): ${redactSecrets(primaryMsg)}. Falling back to ${fallback.provider}.`,
        );

        activeProvider = fallback.provider;
        activeModel = fallback.model;
        activeApiKey = fallback.apiKey;
        isFallback = true;

        // Notify client that we're falling back
        await onEvent({ type: 'text', text: `\n\n[Switching to ${fallback.provider} due to ${provider} error...]\n\n` });
        await onEvent({ type: 'provider_info', provider: activeProvider, model: activeModel, isFallback: true });

        const result = await executeStreamForProvider(
          activeProvider, activeApiKey, activeModel, systemPrompt, recentHistory, message,
          temperature, maxTokens || 4096, toolContext, onEvent, signal, imageContent,
        );
        if (signal?.aborted) return;

        persistToolCalls(result.toolCalls, toolContext, actionGroupId).catch(() => {});

        const clientActions = extractClientActions(result.toolCalls);
        const textParsed = result.toolCalls.length === 0
          ? parseActionsFromResponse(result.fullText)
          : { message: result.fullText, actions: [] as AIAction[] };

        await onEvent({
          type: 'done',
          message: result.fullText.trim() || textParsed.message,
          actions: result.toolCalls.length > 0 ? clientActions : textParsed.actions,
          toolCalls: result.toolCalls,
          actionGroupId: result.toolCalls.length > 0 ? actionGroupId : undefined,
        });
      } else {
        throw primaryError;
      }
    }
  } catch (error: unknown) {
    if (signal?.aborted) return;
    const { userMessage } = categorizeError(error);
    await onEvent({ type: 'text', text: `\n\nError: ${userMessage}` });
    await onEvent({ type: 'done', message: userMessage, actions: [], toolCalls: [] });
  }
}

/**
 * Persist completed tool calls to the ai_actions table for audit/replay.
 * Runs fire-and-forget — logging failures should never break the AI response.
 */
async function persistToolCalls(
  toolCalls: ToolCallRecord[],
  toolContext: ToolContext | undefined,
  chatMessageId?: string,
): Promise<void> {
  if (!toolContext || toolCalls.length === 0) return;
  const { projectId, storage } = toolContext;
  for (const tc of toolCalls) {
    try {
      await storage.createAiAction({
        projectId,
        chatMessageId: chatMessageId ?? null,
        toolName: tc.name,
        parameters: tc.input,
        result: tc.result as unknown as Record<string, unknown>,
        status: tc.result.success ? "completed" : "failed",
      });
    } catch (err) {
      logger.error(`[ai:persist] action=${tc.name} project=${projectId} error=${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Native tool use — Anthropic streaming with multi-turn tool calling
// ---------------------------------------------------------------------------

async function streamAnthropicWithTools(
  apiKey: string,
  model: string,
  systemPrompt: string,
  chatHistory: Array<{ role: string; content: string }>,
  userMessage: string,
  temperature: number,
  maxTokens: number,
  toolContext: ToolContext | undefined,
  onEvent: (event: AIStreamEvent) => void | Promise<void>,
  signal?: AbortSignal,
  imageContent?: ImageContent,
): Promise<{ fullText: string; toolCalls: ToolCallRecord[] }> {
  const client = getAnthropicClient(apiKey);
  const anthropicTools = toolRegistry.toAnthropicTools();

  // Build initial messages array — needs to support both string and block content for multi-turn
  const messages: Anthropic.MessageParam[] = [];
  for (const msg of chatHistory) {
    if (msg.role === "user" || msg.role === "assistant") {
      messages.push({ role: msg.role as "user" | "assistant", content: msg.content });
    }
  }

  // Multimodal: if image attached, build content blocks
  if (imageContent) {
    messages.push({
      role: "user",
      content: [
        {
          type: "image",
          source: {
            type: "base64",
            media_type: imageContent.mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
            data: imageContent.base64,
          },
        },
        { type: "text", text: userMessage },
      ],
    });
  } else {
    messages.push({ role: "user", content: userMessage });
  }

  const allToolCalls: ToolCallRecord[] = [];
  let fullText = '';

  for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
    if (signal?.aborted) break;

    const finalMessage = await anthropicBreaker.execute(async () => {
      const stream = client.messages.stream({
        model,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages,
        temperature,
        tools: anthropicTools as Anthropic.Messages.Tool[],
        tool_choice: { type: "auto" },
      }, signal ? { signal } : undefined);

      // Stream text chunks in real-time
      for await (const event of stream) {
        if (signal?.aborted) break;
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          fullText += event.delta.text;
          await onEvent({ type: 'text', text: event.delta.text });
        }
      }

      if (signal?.aborted) {
        stream.abort();
      }

      return stream.finalMessage();
    });

    if (signal?.aborted) break;

    // Check if model wants to call tools
    const toolUseBlocks = finalMessage.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
    );

    if (toolUseBlocks.length === 0 || !toolContext) {
      // No tool calls or no tool context — done
      break;
    }

    // Execute each tool call
    const toolResultBlocks: Anthropic.Messages.ToolResultBlockParam[] = [];
    for (const block of toolUseBlocks) {
      const input = (block.input ?? {}) as Record<string, unknown>;
      await onEvent({ type: 'tool_call', id: block.id, name: block.name, input });

      const result = await toolRegistry.execute(block.name, input, toolContext);
      allToolCalls.push({ id: block.id, name: block.name, input, result });

      await onEvent({ type: 'tool_result', id: block.id, name: block.name, result });

      toolResultBlocks.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: JSON.stringify(result),
        is_error: !result.success,
      });
    }

    // Append assistant response + tool results for next turn
    messages.push({ role: "assistant", content: finalMessage.content });
    messages.push({ role: "user", content: toolResultBlocks });
  }

  return { fullText, toolCalls: allToolCalls };
}

// ---------------------------------------------------------------------------
// Native tool use — Gemini streaming with multi-turn function calling
// ---------------------------------------------------------------------------

async function streamGeminiWithTools(
  apiKey: string,
  model: string,
  systemPrompt: string,
  chatHistory: Array<{ role: string; content: string }>,
  userMessage: string,
  temperature: number,
  maxTokens: number,
  toolContext: ToolContext | undefined,
  onEvent: (event: AIStreamEvent) => void | Promise<void>,
  signal?: AbortSignal,
  imageContent?: ImageContent,
): Promise<{ fullText: string; toolCalls: ToolCallRecord[] }> {
  const genAI = getGeminiClient(apiKey);
  const geminiFunctionDeclarations = toolRegistry.toGeminiFunctionDeclarations();

  const history = chatHistory.map((msg) => ({
    role: msg.role === "assistant" ? ("model" as const) : ("user" as const),
    parts: [{ text: msg.content }],
  }));

  const chat = genAI.chats.create({
    model,
    config: {
      systemInstruction: systemPrompt,
      temperature,
      maxOutputTokens: maxTokens,
      tools: [{ functionDeclarations: geminiFunctionDeclarations }],
    },
    history,
  });

  // Build first-turn message parts — multimodal if image attached
  const firstTurnParts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];
  if (imageContent) {
    firstTurnParts.push({ inlineData: { mimeType: imageContent.mediaType, data: imageContent.base64 } });
  }
  firstTurnParts.push({ text: userMessage });

  const allToolCalls: ToolCallRecord[] = [];
  let fullText = '';
  let isFirstTurn = true;

  for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
    if (signal?.aborted) break;

    let turnFunctionCalls: Array<{ name: string; args: Record<string, unknown> }> = [];

    if (isFirstTurn) {
      // First turn: stream the user message (with optional image)
      const stream = await geminiBreaker.execute(() =>
        chat.sendMessageStream({
          message: firstTurnParts as Parameters<typeof chat.sendMessageStream>[0]["message"],
        }),
      );
      try {
        for await (const chunk of stream) {
          if (signal?.aborted) break;
          const text = chunk.text ?? "";
          if (text) {
            fullText += text;
            await onEvent({ type: 'text', text });
          }
          // Collect function calls from chunks
          const fcs = chunk.functionCalls;
          if (fcs) {
            for (const fc of fcs) {
              turnFunctionCalls.push({ name: fc.name ?? '', args: (fc.args ?? {}) as Record<string, unknown> });
            }
          }
        }
      } catch (streamError: unknown) {
        if (signal?.aborted) break;
        const { message: errMsg } = extractErrorInfo(streamError);
        fullText += `\n\n[Stream interrupted: ${redactSecrets(errMsg || 'Stream interrupted')}]`;
        await onEvent({ type: 'text', text: `\n\n[Stream interrupted: ${redactSecrets(errMsg || 'Stream interrupted')}]` });
      }
      isFirstTurn = false;
    } else {
      // Subsequent turns: we already sent function responses via sendMessage,
      // now stream the model's next response
      // (this path is reached after sending function responses below)
      break; // Function responses are handled in the non-streaming sendMessage below
    }

    if (signal?.aborted || turnFunctionCalls.length === 0 || !toolContext) break;

    // Execute function calls
    const functionResponses: Array<{ name: string; response: unknown }> = [];
    for (const fc of turnFunctionCalls) {
      const toolId = crypto.randomUUID();
      await onEvent({ type: 'tool_call', id: toolId, name: fc.name, input: fc.args });

      const result = await toolRegistry.execute(fc.name, fc.args, toolContext);
      allToolCalls.push({ id: toolId, name: fc.name, input: fc.args, result });

      await onEvent({ type: 'tool_result', id: toolId, name: fc.name, result });

      functionResponses.push({ name: fc.name, response: result });
    }

    // Send function responses back to Gemini and stream the next response
    const frParts = functionResponses.map(fr => ({
      functionResponse: { name: fr.name, response: fr.response },
    }));
    const nextStream = await geminiBreaker.execute(() =>
      chat.sendMessageStream({
        message: frParts as Parameters<typeof chat.sendMessageStream>[0]["message"],
      }),
    );

    turnFunctionCalls = [];
    try {
      for await (const chunk of nextStream) {
        if (signal?.aborted) break;
        const text = chunk.text ?? "";
        if (text) {
          fullText += text;
          await onEvent({ type: 'text', text });
        }
        const fcs = chunk.functionCalls;
        if (fcs) {
          for (const fc of fcs) {
            turnFunctionCalls.push({ name: fc.name ?? '', args: (fc.args ?? {}) as Record<string, unknown> });
          }
        }
      }
    } catch (streamError: unknown) {
      if (signal?.aborted) break;
      const { message: errMsg } = extractErrorInfo(streamError);
      fullText += `\n\n[Stream interrupted: ${redactSecrets(errMsg || 'Stream interrupted')}]`;
      await onEvent({ type: 'text', text: `\n\n[Stream interrupted: ${redactSecrets(errMsg || 'Stream interrupted')}]` });
    }

    // If this turn also had function calls, continue the loop
    if (turnFunctionCalls.length === 0 || !toolContext) break;

    // Execute the new function calls
    const nextResponses: Array<{ name: string; response: unknown }> = [];
    for (const fc of turnFunctionCalls) {
      const toolId = crypto.randomUUID();
      await onEvent({ type: 'tool_call', id: toolId, name: fc.name, input: fc.args });

      const result = await toolRegistry.execute(fc.name, fc.args, toolContext);
      allToolCalls.push({ id: toolId, name: fc.name, input: fc.args, result });

      await onEvent({ type: 'tool_result', id: toolId, name: fc.name, result });

      nextResponses.push({ name: fc.name, response: result });
    }

    // Continue multi-turn by sending these responses
    const nextFrParts = nextResponses.map(fr => ({
      functionResponse: { name: fr.name, response: fr.response },
    }));
    const followUpStream = await geminiBreaker.execute(() =>
      chat.sendMessageStream({
        message: nextFrParts as Parameters<typeof chat.sendMessageStream>[0]["message"],
      }),
    );

    try {
      for await (const chunk of followUpStream) {
        if (signal?.aborted) break;
        const text = chunk.text ?? "";
        if (text) {
          fullText += text;
          await onEvent({ type: 'text', text });
        }
      }
    } catch (streamError: unknown) {
      if (signal?.aborted) break;
      const { message: errMsg } = extractErrorInfo(streamError);
      fullText += `\n\n[Stream interrupted: ${redactSecrets(errMsg || 'Stream interrupted')}]`;
      await onEvent({ type: 'text', text: `\n\n[Stream interrupted: ${redactSecrets(errMsg || 'Stream interrupted')}]` });
    }

    // After a follow-up response, break the outer loop (max 2 rounds of tool calling per turn)
    break;
  }

  return { fullText, toolCalls: allToolCalls };
}

// ---------------------------------------------------------------------------
// Helpers for extracting client-executable actions from tool results
// ---------------------------------------------------------------------------

function extractClientActions(toolCalls: ToolCallRecord[]): AIAction[] {
  return toolCalls
    .map(tc => tc.result.data)
    .filter((d): d is Record<string, unknown> =>
      d != null && typeof d === 'object' && 'type' in (d as Record<string, unknown>)
    )
    .map(d => d as unknown as AIAction);
}
