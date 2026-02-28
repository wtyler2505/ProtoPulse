import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";
import { LRUClientCache } from "./lib/lru-cache";
import { toolRegistry, DESTRUCTIVE_TOOLS, type ToolResult, type ToolContext } from "./ai-tools";

export type AIAction =
  | { type: "switch_view"; view: "architecture" | "schematic" | "procurement" | "validation" | "output" | "project_explorer" }
  | { type: "switch_schematic_sheet"; sheetId: string }
  | { type: "add_node"; nodeType: string; label: string; description?: string; positionX?: number; positionY?: number }
  | { type: "remove_node"; nodeLabel: string }
  | { type: "update_node"; nodeLabel: string; newLabel?: string; newType?: string; newDescription?: string }
  | { type: "connect_nodes"; sourceLabel: string; targetLabel: string; edgeLabel?: string; busType?: string; signalType?: string; voltage?: string; busWidth?: string; netName?: string }
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
  edges: Array<{ id: string; source: string; target: string; label?: string; signalType?: string; voltage?: string; busWidth?: string; netName?: string }>;
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
  | { type: 'done'; message: string; actions: AIAction[]; toolCalls: ToolCallRecord[]; actionGroupId?: string }
  | { type: 'error'; message: string };

const MAX_TOOL_TURNS = 10;

// ---------------------------------------------------------------------------
// Phase 6: Multi-model routing
// ---------------------------------------------------------------------------

export type RoutingStrategy = 'user' | 'auto' | 'quality' | 'speed' | 'cost';

type ModelTier = 'fast' | 'standard' | 'premium';

const MODEL_TIERS: Record<string, { fast: string; standard: string; premium: string }> = {
  anthropic: {
    fast: 'claude-haiku-4-5-20250514',
    standard: 'claude-sonnet-4-5-20250514',
    premium: 'claude-4-6-opus-20260101',
  },
  gemini: {
    fast: 'gemini-2.0-flash',
    standard: 'gemini-2.5-flash',
    premium: 'gemini-2.5-pro',
  },
};

export function routeToModel(params: {
  strategy: RoutingStrategy;
  provider: 'anthropic' | 'gemini';
  userModel: string;
  messageLength: number;
  hasImage: boolean;
}): { model: string; reason: string } {
  const { strategy, provider, userModel, messageLength, hasImage } = params;

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
  if (hasImage) {
    return { model: tiers.standard, reason: 'Auto: image attached, using standard (vision-capable)' };
  }
  if (messageLength < 200) {
    return { model: tiers.fast, reason: 'Auto: short message, using fast tier' };
  }
  if (messageLength > 2000) {
    return { model: tiers.premium, reason: 'Auto: long/complex message, using premium tier' };
  }
  return { model: tiers.standard, reason: 'Auto: standard complexity' };
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

function hashAppState(appState: AppState): string {
  return JSON.stringify({
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

function buildSystemPrompt(appState: AppState): string {
  const nodesDescription = appState.nodes.length > 0
    ? appState.nodes.map(n => `  - "${n.label}" (type: ${n.type}, id: ${n.id}, pos: ${n.positionX},${n.positionY}${n.description ? `, desc: ${n.description}` : ""})`).join("\n")
    : "  (none)";

  const edgesDescription = appState.edges.length > 0
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
    : "  (none)";

  const bomDescription = appState.bom.length > 0
    ? appState.bom.map(b => `  - ${b.partNumber} | ${b.manufacturer} | ${b.description} | qty: ${b.quantity} | $${b.unitPrice} | ${b.supplier} | ${b.status}`).join("\n")
    : "  (none)";

  const validationDescription = appState.validationIssues.length > 0
    ? appState.validationIssues.map(v => `  - [${v.severity}] ${v.message}${v.componentId ? ` (component: ${v.componentId})` : ""}${v.suggestion ? ` → ${v.suggestion}` : ""}`).join("\n")
    : "  (none)";

  const sheetsDescription = appState.schematicSheets.length > 0
    ? appState.schematicSheets.map(s => `  - "${s.name}" (id: ${s.id}${s.id === appState.activeSheetId ? ", ACTIVE" : ""})`).join("\n")
    : "  (none)";

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

  const response = await client.messages.create({
    model,
    max_tokens: maxTokens || 4096,
    system: systemPrompt,
    messages,
    temperature,
    tools: anthropicTools as Anthropic.Messages.Tool[],
    tool_choice: { type: "auto" },
  });

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

  const result = await chat.sendMessage({ message: messageParts as Parameters<typeof chat.sendMessage>[0]["message"] });

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
}): Promise<{ message: string; actions: AIAction[] }> {
  try {
    const { message, provider, model, apiKey, appState, temperature = 0.7, maxTokens, imageContent } = params;

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

    const stateHash = hashAppState(appState);
    const cachedPrompt = promptCache.get(stateHash);
    const systemPrompt = cachedPrompt ?? (() => {
      const built = buildSystemPrompt(appState);
      promptCache.set(stateHash, built);
      return built;
    })();
    const recentHistory = appState.chatHistory.slice(-10);

    const dedupeKey = requestKey(message, provider, String(appState.projectName));
    const existing = activeRequests.get(dedupeKey);
    if (existing) return existing;

    const promise = (async () => {
      if (provider === "anthropic") {
        return await callAnthropic(apiKey, model, systemPrompt, recentHistory, message, temperature, maxTokens, imageContent);
      } else {
        return await callGemini(apiKey, model, systemPrompt, recentHistory, message, temperature, maxTokens, imageContent);
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
  },
  onEvent: (event: AIStreamEvent) => void | Promise<void>,
  signal?: AbortSignal
): Promise<void> {
  try {
    const { message, provider, model, apiKey, appState, temperature = 0.7, maxTokens, toolContext, imageContent } = params;

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

    const stateHash = hashAppState(appState);
    const cachedPrompt2 = promptCache.get(stateHash);
    const systemPrompt = cachedPrompt2 ?? (() => {
      const built = buildSystemPrompt(appState);
      promptCache.set(stateHash, built);
      return built;
    })();
    const recentHistory = appState.chatHistory.slice(-10);
    const actionGroupId = crypto.randomUUID();

    if (provider === "anthropic") {
      const result = await streamAnthropicWithTools(
        apiKey, model, systemPrompt, recentHistory, message,
        temperature, maxTokens || 4096, toolContext, onEvent, signal, imageContent,
      );
      if (signal?.aborted) return;

      persistToolCalls(result.toolCalls, toolContext, actionGroupId).catch(() => {});

      // Extract client-executable actions from tool results
      const clientActions = extractClientActions(result.toolCalls);
      // Fallback: if no tool calls were made, parse actions from text
      const fallbackParsed = result.toolCalls.length === 0
        ? parseActionsFromResponse(result.fullText)
        : { message: result.fullText, actions: [] as AIAction[] };

      await onEvent({
        type: 'done',
        message: result.fullText.trim() || fallbackParsed.message,
        actions: result.toolCalls.length > 0 ? clientActions : fallbackParsed.actions,
        toolCalls: result.toolCalls,
        actionGroupId: result.toolCalls.length > 0 ? actionGroupId : undefined,
      });
    } else {
      const result = await streamGeminiWithTools(
        apiKey, model, systemPrompt, recentHistory, message,
        temperature, maxTokens || 4096, toolContext, onEvent, signal, imageContent,
      );
      if (signal?.aborted) return;

      persistToolCalls(result.toolCalls, toolContext, actionGroupId).catch(() => {});

      const clientActions = extractClientActions(result.toolCalls);
      const fallbackParsed = result.toolCalls.length === 0
        ? parseActionsFromResponse(result.fullText)
        : { message: result.fullText, actions: [] as AIAction[] };

      await onEvent({
        type: 'done',
        message: result.fullText.trim() || fallbackParsed.message,
        actions: result.toolCalls.length > 0 ? clientActions : fallbackParsed.actions,
        toolCalls: result.toolCalls,
        actionGroupId: result.toolCalls.length > 0 ? actionGroupId : undefined,
      });
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
      console.error(`[ai:persist] action=${tc.name} project=${projectId} error=${err instanceof Error ? err.message : String(err)}`);
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
      break;
    }

    const finalMessage = await stream.finalMessage();

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
      const stream = await chat.sendMessageStream({
        message: firstTurnParts as Parameters<typeof chat.sendMessageStream>[0]["message"],
      });
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
    const nextStream = await chat.sendMessageStream({
      message: frParts as Parameters<typeof chat.sendMessageStream>[0]["message"],
    });

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
    const followUpStream = await chat.sendMessageStream({
      message: nextFrParts as Parameters<typeof chat.sendMessageStream>[0]["message"],
    });

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
