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
  | { type: "redo" };

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
Add a new component node to the architecture diagram. nodeType can be: "mcu", "sensor", "power", "comm", "connector", "memory", "actuator", "ic", "passive", "module", or any custom type.

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
  const jsonBlockRegex = /```json\s*\n([\s\S]*?)\n```\s*$/;
  const match = text.match(jsonBlockRegex);

  if (!match) {
    return { message: text.trim(), actions: [] };
  }

  const message = text.slice(0, match.index).trim();
  try {
    const parsed = JSON.parse(match[1]);
    const actions: AIAction[] = Array.isArray(parsed) ? parsed : [];
    return { message, actions };
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
  temperature: number = 0.7
): Promise<{ message: string; actions: AIAction[] }> {
  const client = new Anthropic({ apiKey });

  const messages: Array<{ role: "user" | "assistant"; content: string }> = [];
  for (const msg of chatHistory) {
    if (msg.role === "user" || msg.role === "assistant") {
      messages.push({ role: msg.role as "user" | "assistant", content: msg.content });
    }
  }
  messages.push({ role: "user", content: userMessage });

  const response = await client.messages.create({
    model,
    max_tokens: 4096,
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
  temperature: number = 0.7
): Promise<{ message: string; actions: AIAction[] }> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const geminiModel = genAI.getGenerativeModel({
    model,
    systemInstruction: systemPrompt,
    generationConfig: { temperature },
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
}): Promise<{ message: string; actions: AIAction[] }> {
  try {
    const { message, provider, model, apiKey, appState, temperature = 0.7 } = params;

    if (!apiKey || apiKey.trim().length === 0) {
      return {
        message: `No API key provided for ${provider}. Please add your ${provider === "anthropic" ? "Anthropic" : "Google Gemini"} API key in the settings panel to enable AI features.`,
        actions: [],
      };
    }

    const systemPrompt = buildSystemPrompt(appState);
    const recentHistory = appState.chatHistory.slice(-10);

    if (provider === "anthropic") {
      return await callAnthropic(apiKey, model, systemPrompt, recentHistory, message, temperature);
    } else {
      return await callGemini(apiKey, model, systemPrompt, recentHistory, message, temperature);
    }
  } catch (error: any) {
    const errorMessage = error?.message || String(error);

    if (errorMessage.includes("401") || errorMessage.includes("invalid") || errorMessage.includes("authentication") || errorMessage.includes("API key")) {
      return {
        message: `Authentication failed — your ${params.provider === "anthropic" ? "Anthropic" : "Google Gemini"} API key appears to be invalid. Please check your API key in settings and try again.`,
        actions: [],
      };
    }

    if (errorMessage.includes("429") || errorMessage.includes("rate limit")) {
      return {
        message: "Rate limit exceeded. Please wait a moment and try again.",
        actions: [],
      };
    }

    if (errorMessage.includes("timeout") || errorMessage.includes("ETIMEDOUT") || errorMessage.includes("ECONNABORTED")) {
      return {
        message: "The request timed out. Please try again with a shorter message or simpler request.",
        actions: [],
      };
    }

    return {
      message: `An error occurred while communicating with the AI provider: ${errorMessage}`,
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
  },
  write: (chunk: string) => void,
  onComplete: (result: { message: string; actions: AIAction[] }) => void
): Promise<void> {
  try {
    const { message, provider, model, apiKey, appState, temperature = 0.7 } = params;

    if (!apiKey || apiKey.trim().length === 0) {
      write(`No API key provided for ${provider}. Please add your ${provider === "anthropic" ? "Anthropic" : "Google Gemini"} API key in the settings panel to enable AI features.`);
      onComplete({ message: `No API key provided for ${provider}.`, actions: [] });
      return;
    }

    const systemPrompt = buildSystemPrompt(appState);
    const recentHistory = appState.chatHistory.slice(-10);

    if (provider === "anthropic") {
      const client = new Anthropic({ apiKey });

      const messages: Array<{ role: "user" | "assistant"; content: string }> = [];
      for (const msg of recentHistory) {
        if (msg.role === "user" || msg.role === "assistant") {
          messages.push({ role: msg.role as "user" | "assistant", content: msg.content });
        }
      }
      messages.push({ role: "user", content: message });

      const stream = client.messages.stream({
        model,
        max_tokens: 4096,
        system: systemPrompt,
        messages,
        temperature,
      });

      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          write(event.delta.text);
        }
      }

      const finalMessage = await stream.finalMessage();
      const fullText = finalMessage.content
        .filter((block): block is Anthropic.TextBlock => block.type === "text")
        .map((block) => block.text)
        .join("");

      const parsed = parseActionsFromResponse(fullText);
      onComplete(parsed);
    } else {
      const genAI = new GoogleGenerativeAI(apiKey);
      const geminiModel = genAI.getGenerativeModel({
        model,
        systemInstruction: systemPrompt,
        generationConfig: { temperature },
      });

      const history = recentHistory.map((msg) => ({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.content }],
      }));

      const chat = geminiModel.startChat({ history });
      const result = await chat.sendMessageStream(message);

      let fullText = "";
      for await (const chunk of result.stream) {
        const text = chunk.text();
        if (text) {
          write(text);
          fullText += text;
        }
      }

      const parsed = parseActionsFromResponse(fullText);
      onComplete(parsed);
    }
  } catch (error: any) {
    const errorMessage = error?.message || String(error);
    write(`\n\nError: ${errorMessage}`);
    onComplete({ message: `An error occurred while communicating with the AI provider: ${errorMessage}`, actions: [] });
  }
}
