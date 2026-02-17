import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";

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
  | { type: "set_project_type"; projectType: string };

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
}

const MAX_CLIENT_CACHE = 10;

class LRUClientCache<T> {
  private cache = new Map<string, T>();
  private maxSize: number;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  get(key: string): T | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }

  set(key: string, value: T): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) this.cache.delete(oldest);
    }
    this.cache.set(key, value);
  }
}

const anthropicClients = new LRUClientCache<Anthropic>(MAX_CLIENT_CACHE);
const geminiClients = new LRUClientCache<GoogleGenerativeAI>(MAX_CLIENT_CACHE);

let cachedPromptHash = '';
let cachedPrompt = '';

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

function categorizeError(error: any): { code: AIErrorCode; userMessage: string } {
  const msg = error?.message || String(error);
  const status = error?.status || error?.statusCode;

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
  if (status >= 500) {
    return { code: 'PROVIDER_ERROR', userMessage: 'The AI provider is experiencing issues. Try again shortly.' };
  }

  const safe = msg.replace(/sk-[a-zA-Z0-9]+/g, '[REDACTED]').replace(/AIza[a-zA-Z0-9_-]+/g, '[REDACTED]');
  return { code: 'UNKNOWN', userMessage: `AI error: ${safe}` };
}

const activeRequests = new Map<string, Promise<{ message: string; actions: AIAction[] }>>();

function requestKey(message: string, provider: string, projectId: string): string {
  return `${provider}:${projectId}:${message.slice(0, 100)}`;
}

function getAnthropicClient(apiKey: string): Anthropic {
  let client = anthropicClients.get(apiKey);
  if (!client) {
    client = new Anthropic({ apiKey });
    anthropicClients.set(apiKey, client);
  }
  return client;
}

function getGeminiClient(apiKey: string): GoogleGenerativeAI {
  let client = geminiClients.get(apiKey);
  if (!client) {
    client = new GoogleGenerativeAI(apiKey);
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

## Available Actions

When the user asks you to MAKE CHANGES to the design, you can execute actions by including a JSON code block at the END of your response. The JSON must be an array of action objects.

IMPORTANT RULES:
- ONLY include actions when the user explicitly asks to make changes, add/remove components, modify the design, etc.
- For informational questions, discussions, explanations, or advice — respond with text only, NO actions.
- When you do include actions, explain what you're doing in your text response BEFORE the JSON block.
- You can include multiple actions in a single response to perform complex operations atomically.
- When referencing nodes in actions, use their LABEL (display name), not their internal ID.

### Action Schema Reference:

**View Navigation:**
\`{ "type": "switch_view", "view": "architecture" | "schematic" | "procurement" | "validation" | "output" | "project_explorer" }\`
Switch the active view in the application.

\`{ "type": "switch_schematic_sheet", "sheetId": "<sheet-id>" }\`
Switch to a specific schematic sheet.

**Architecture Diagram — Nodes:**
\`{ "type": "add_node", "nodeType": "<type>", "label": "<name>", "description": "<optional>", "positionX": <number>, "positionY": <number> }\`
Add a new component node to the architecture diagram. nodeType can be: "mcu", "sensor", "power", "comm", "connector", "memory", "actuator", "ic", "passive", "module", or any custom type. When positioning nodes, calculate positions relative to existing nodes. Place connected nodes near each other (within 200px). Place power nodes on the left (x: 100-200), MCUs in center (x: 300-500), peripherals on right (x: 600-800), sensors at bottom (y: 350-500).

\`{ "type": "remove_node", "nodeLabel": "<label>" }\`
Remove a node by its label.

\`{ "type": "update_node", "nodeLabel": "<label>", "newLabel": "<optional>", "newType": "<optional>", "newDescription": "<optional>" }\`
Update properties of an existing node.

\`{ "type": "clear_canvas" }\`
Remove all nodes and edges from the architecture diagram.

**Architecture Diagram — Connections:**
\`{ "type": "connect_nodes", "sourceLabel": "<label>", "targetLabel": "<label>", "edgeLabel": "<optional>", "busType": "<optional>", "signalType": "<optional>", "voltage": "<optional>", "busWidth": "<optional>", "netName": "<optional>" }\`
Create a connection between two nodes. busType examples: "SPI", "I2C", "UART", "USB", "Power", "GPIO", "CAN", "Ethernet". Optional signal metadata: signalType (e.g. "SPI", "analog"), voltage (e.g. "3.3V"), busWidth (e.g. "4-bit"), netName (e.g. "MOSI").

\`{ "type": "remove_edge", "sourceLabel": "<label>", "targetLabel": "<label>" }\`
Remove a connection between two nodes.

**Generate Full Architecture:**
\`{ "type": "generate_architecture", "components": [{ "label": "<name>", "nodeType": "<type>", "description": "<desc>", "positionX": <num>, "positionY": <num> }, ...], "connections": [{ "sourceLabel": "<label>", "targetLabel": "<label>", "label": "<bus/signal>", "busType": "<optional>" }, ...] }\`
Generate a complete architecture diagram, replacing the current one. Use this for creating entire system designs from scratch. Lay out components logically: power on the left, MCU in center, peripherals around it. Use reasonable spacing (150-200px between components).

**BOM Management:**
\`{ "type": "add_bom_item", "partNumber": "<pn>", "manufacturer": "<mfr>", "description": "<desc>", "quantity": <num>, "unitPrice": <num>, "supplier": "<supplier>", "status": "<status>" }\`
Add a component to the Bill of Materials. Status options: "In Stock", "Low Stock", "Out of Stock", "On Order".

\`{ "type": "remove_bom_item", "partNumber": "<pn>" }\`
Remove a BOM item by part number.

\`{ "type": "update_bom_item", "partNumber": "<pn>", "updates": { "<field>": "<value>", ... } }\`
Update fields of an existing BOM item. Fields: partNumber, manufacturer, description, quantity, unitPrice, supplier, status.

**Design Validation:**
\`{ "type": "run_validation" }\`
Trigger a design validation check.

\`{ "type": "clear_validation" }\`
Clear all validation issues.

\`{ "type": "add_validation_issue", "severity": "error" | "warning" | "info", "message": "<description>", "componentId": "<optional-node-label>", "suggestion": "<optional-fix>" }\`
Add a validation issue/finding.

**Project Settings:**
\`{ "type": "rename_project", "name": "<new-name>" }\`
Rename the project.

\`{ "type": "update_description", "description": "<new-description>" }\`
Update the project description.

**Export:**
\`{ "type": "export_bom_csv" }\`
Export the BOM as a CSV file.

**Undo/Redo:**
\`{ "type": "undo" }\` — Undo the last AI action.
\`{ "type": "redo" }\` — Redo the last undone action.

**Auto-Layout:**
\`{ "type": "auto_layout", "layout": "hierarchical" | "grid" | "circular" | "force" }\`
Reorganize all nodes on the canvas using the specified layout algorithm. Use "hierarchical" for tree-like designs, "grid" for uniform spacing, "circular" for ring topologies, "force" for organic layouts.

**Sub-circuit Templates:**
\`{ "type": "add_subcircuit", "template": "power_supply_ldo" | "usb_interface" | "spi_flash" | "i2c_sensors" | "uart_debug" | "battery_charger" | "motor_driver" | "led_driver" | "adc_frontend" | "dac_output", "positionX": <number>, "positionY": <number> }\`
Insert a pre-wired sub-circuit template at the specified position. Each template includes multiple components and their connections.

**Net Naming:**
\`{ "type": "assign_net_name", "sourceLabel": "<label>", "targetLabel": "<label>", "netName": "<net-name>" }\`
Assign a meaningful net name to an existing connection between two nodes.

**Multi-Sheet Management:**
\`{ "type": "create_sheet", "name": "<sheet-name>" }\`
Create a new schematic sheet (e.g., "Power_Supply.sch", "RF_Frontend.sch").

\`{ "type": "rename_sheet", "sheetId": "<id>", "newName": "<name>" }\`
Rename an existing schematic sheet.

\`{ "type": "move_to_sheet", "nodeLabel": "<label>", "sheetId": "<id>" }\`
Move a component to a different schematic sheet for organization.

**Pin-Level Connections:**
\`{ "type": "set_pin_map", "nodeLabel": "<label>", "pins": { "<pin_name>": "<connected_to>", ... } }\`
Set pin assignments for a component (e.g., {"MOSI": "GPIO23", "MISO": "GPIO19", "SCK": "GPIO18", "CS": "GPIO5"}).

\`{ "type": "auto_assign_pins", "nodeLabel": "<label>" }\`
Auto-assign optimal pin connections based on the component datasheet and existing connections.

**Advanced Validation:**
\`{ "type": "power_budget_analysis" }\`
Calculate total power budget across all power rails, tallying current draw from all components.

\`{ "type": "voltage_domain_check" }\`
Verify voltage compatibility across all connections and flag mismatches.

\`{ "type": "auto_fix_validation" }\`
Automatically fix validation issues by adding missing decoupling caps, pull-up resistors, ESD protection components.

\`{ "type": "dfm_check" }\`
Run Design for Manufacturing checks — flag hard-to-solder components, suggest assembly-friendly alternatives.

\`{ "type": "thermal_analysis" }\`
Estimate power dissipation per component, flag thermal hot spots, suggest heatsinks or thermal vias.

**BOM Intelligence:**
\`{ "type": "pricing_lookup", "partNumber": "<pn>" }\`
Look up real-time pricing and availability for a specific part across distributors (Digi-Key, Mouser, LCSC).

\`{ "type": "suggest_alternatives", "partNumber": "<pn>", "reason": "<cost|availability|performance>" }\`
Find alternative/equivalent parts for a BOM item. Specify reason: cost reduction, availability, or performance improvement.

\`{ "type": "optimize_bom" }\`
Analyze the entire BOM for cost optimization opportunities — supplier consolidation, quantity discounts, and cheaper equivalents.

\`{ "type": "check_lead_times" }\`
Check estimated lead times and delivery dates for all BOM items. Flag items with long lead times (>8 weeks).

\`{ "type": "parametric_search", "category": "<category>", "specs": { "<param>": "<value>", ... } }\`
Search for components by parametric specifications. Categories: "mcu", "sensor", "regulator", "capacitor", "resistor", "inductor", "connector", "transistor", "diode", "opamp". Specs examples: {"voltage": "3.3V", "package": "QFP-48", "frequency": ">100MHz"}.

**Design Documentation:**
\`{ "type": "analyze_image", "description": "<description>" }\`
Analyze an uploaded image or schematic reference — describe what's shown and suggest how to implement it.

\`{ "type": "save_design_decision", "decision": "<what>", "rationale": "<why>" }\`
Record a design decision with its rationale for future reference. This creates a permanent record of WHY choices were made.

\`{ "type": "add_annotation", "nodeLabel": "<label>", "note": "<comment>", "color": "yellow" | "blue" | "red" | "green" }\`
Add a sticky-note annotation to a component for documentation or review comments.

\`{ "type": "start_tutorial", "topic": "getting_started" | "power_design" | "pcb_layout" | "bom_management" | "validation" }\`
Start an interactive tutorial walkthrough for the specified topic.

**Export & Output:**
\`{ "type": "export_kicad" }\`
Generate a KiCad-compatible schematic file (.kicad_sch) from the current architecture. Creates hierarchical sheet structure matching the block diagram.

\`{ "type": "export_spice" }\`
Generate a SPICE netlist (.cir) for circuit simulation. Maps components to SPICE models and connections to nets.

\`{ "type": "preview_gerber" }\`
Generate a rough PCB layout preview showing component placement and basic routing estimation.

\`{ "type": "add_datasheet_link", "partNumber": "<pn>", "url": "<datasheet-url>" }\`
Attach a datasheet URL to a BOM item for quick reference.

\`{ "type": "export_design_report" }\`
Generate a comprehensive design report including architecture overview, BOM summary, validation status, and recommendations.

**Project Configuration:**
\`{ "type": "set_project_type", "projectType": "iot" | "wearable" | "industrial" | "automotive" | "consumer" | "medical" | "rf" | "power" }\`
Set the project type to optimize AI suggestions, component recommendations, and validation rules for the specific domain.

## Response Format

For informational responses (no changes needed):
Just respond with helpful text. No JSON block needed.

For action responses (user wants changes):
First explain what you will do in plain text, then include the actions at the very end:

\`\`\`json
[
  { "type": "action_type", ... },
  { "type": "another_action", ... }
]
\`\`\`

Always provide expert-level, detailed electronics advice. When suggesting components, include real part numbers, manufacturers, and typical specifications. When discussing design choices, explain trade-offs and best practices.${appState.customSystemPrompt ? `\n\n## Custom User Instructions\n\n${appState.customSystemPrompt}` : ''}`;
}

function parseActionsFromResponse(text: string): { message: string; actions: AIAction[] } {
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
  maxTokens?: number
): Promise<{ message: string; actions: AIAction[] }> {
  const client = getAnthropicClient(apiKey);

  const messages: Array<{ role: "user" | "assistant"; content: string }> = [];
  for (const msg of chatHistory) {
    if (msg.role === "user" || msg.role === "assistant") {
      messages.push({ role: msg.role as "user" | "assistant", content: msg.content });
    }
  }
  messages.push({ role: "user", content: userMessage });

  const response = await client.messages.create({
    model,
    max_tokens: maxTokens || 4096,
    system: systemPrompt,
    messages,
    temperature,
  });

  const responseText = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");

  return parseActionsFromResponse(responseText);
}

async function callGemini(
  apiKey: string,
  model: string,
  systemPrompt: string,
  chatHistory: Array<{ role: string; content: string }>,
  userMessage: string,
  temperature: number = 0.7,
  maxTokens?: number
): Promise<{ message: string; actions: AIAction[] }> {
  const genAI = getGeminiClient(apiKey);
  const geminiModel = genAI.getGenerativeModel({
    model,
    systemInstruction: systemPrompt,
    generationConfig: { temperature, maxOutputTokens: maxTokens || 4096 },
  });

  const history = chatHistory.map((msg) => ({
    role: msg.role === "assistant" ? "model" : "user",
    parts: [{ text: msg.content }],
  }));

  const chat = geminiModel.startChat({ history });
  const result = await chat.sendMessage(userMessage);
  const responseText = result.response.text();

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
}): Promise<{ message: string; actions: AIAction[] }> {
  try {
    const { message, provider, model, apiKey, appState, temperature = 0.7, maxTokens } = params;

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
    let systemPrompt: string;
    if (stateHash === cachedPromptHash) {
      systemPrompt = cachedPrompt;
    } else {
      systemPrompt = buildSystemPrompt(appState);
      cachedPromptHash = stateHash;
      cachedPrompt = systemPrompt;
    }
    const recentHistory = appState.chatHistory.slice(-10);

    const dedupeKey = requestKey(message, provider, String(appState.projectName));
    const existing = activeRequests.get(dedupeKey);
    if (existing) return existing;

    const promise = (async () => {
      if (provider === "anthropic") {
        return await callAnthropic(apiKey, model, systemPrompt, recentHistory, message, temperature, maxTokens);
      } else {
        return await callGemini(apiKey, model, systemPrompt, recentHistory, message, temperature, maxTokens);
      }
    })();
    activeRequests.set(dedupeKey, promise);
    try {
      return await promise;
    } finally {
      activeRequests.delete(dedupeKey);
    }
  } catch (error: any) {
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
  },
  write: (chunk: string) => void | Promise<void>,
  onComplete: (result: { message: string; actions: AIAction[] }) => void | Promise<void>,
  signal?: AbortSignal
): Promise<void> {
  try {
    const { message, provider, model, apiKey, appState, temperature = 0.7, maxTokens } = params;

    if (!apiKey || apiKey.trim().length === 0) {
      write(`No API key provided for ${provider}. Please add your ${provider === "anthropic" ? "Anthropic" : "Google Gemini"} API key in the settings panel to enable AI features.`);
      onComplete({ message: `No API key provided for ${provider}.`, actions: [] });
      return;
    }

    if (message.length > 32000) {
      write("Your message is too long. Please keep messages under 32,000 characters.");
      onComplete({ message: "Message too long.", actions: [] });
      return;
    }

    const stateHash = hashAppState(appState);
    let systemPrompt: string;
    if (stateHash === cachedPromptHash) {
      systemPrompt = cachedPrompt;
    } else {
      systemPrompt = buildSystemPrompt(appState);
      cachedPromptHash = stateHash;
      cachedPrompt = systemPrompt;
    }
    const recentHistory = appState.chatHistory.slice(-10);

    if (provider === "anthropic") {
      const client = getAnthropicClient(apiKey);

      const messages: Array<{ role: "user" | "assistant"; content: string }> = [];
      for (const msg of recentHistory) {
        if (msg.role === "user" || msg.role === "assistant") {
          messages.push({ role: msg.role as "user" | "assistant", content: msg.content });
        }
      }
      messages.push({ role: "user", content: message });

      const stream = client.messages.stream({
        model,
        max_tokens: maxTokens || 4096,
        system: systemPrompt,
        messages,
        temperature,
      }, signal ? { signal } : undefined);

      for await (const event of stream) {
        if (signal?.aborted) break;
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          await write(event.delta.text);
        }
      }

      if (signal?.aborted) {
        stream.abort();
        return;
      }

      const finalMessage = await stream.finalMessage();
      const fullText = finalMessage.content
        .filter((block): block is Anthropic.TextBlock => block.type === "text")
        .map((block) => block.text)
        .join("");

      const parsed = parseActionsFromResponse(fullText);
      await onComplete(parsed);
    } else {
      const genAI = getGeminiClient(apiKey);
      const geminiModel = genAI.getGenerativeModel({
        model,
        systemInstruction: systemPrompt,
        generationConfig: { temperature, maxOutputTokens: maxTokens || 4096 },
      });

      const history = recentHistory.map((msg) => ({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.content }],
      }));

      const chat = geminiModel.startChat({ history });
      const result = await chat.sendMessageStream(message);

      let fullText = "";
      try {
        for await (const chunk of result.stream) {
          if (signal?.aborted) break;
          const text = chunk.text();
          if (text) {
            await write(text);
            fullText += text;
          }
        }
      } catch (streamError: any) {
        if (signal?.aborted) return;
        const safe = (streamError?.message || 'Stream interrupted')
          .replace(/AIza[a-zA-Z0-9_-]+/g, '[REDACTED]');
        await write(`\n\n[Stream interrupted: ${safe}]`);
      }

      if (signal?.aborted) return;

      const parsed = parseActionsFromResponse(fullText);
      await onComplete(parsed);
    }
  } catch (error: any) {
    if (signal?.aborted) return;
    const { userMessage } = categorizeError(error);
    write(`\n\nError: ${userMessage}`);
    onComplete({ message: userMessage, actions: [] });
  }
}
