import { genkit, z } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { storage } from './storage';
import { toolRegistry, type ToolContext } from './ai-tools/index';

// Initialize the Genkit instance
export const ai = genkit({
  plugins: [googleAI()],
});

// Dynamically convert all 125 tools to Genkit tools
export const allGenkitTools = toolRegistry.getAll().map(toolDef => 
  ai.defineTool({
    name: toolDef.name,
    description: toolDef.description,
    inputSchema: toolDef.parameters as z.ZodTypeAny,
    outputSchema: z.any() 
  }, async (input) => {
    // Access context from Genkit's current execution context
    const ctx = ai.currentContext() as ToolContext;
    if (!ctx) {
      throw new Error(`Tool ${toolDef.name} executed without context.`);
    }
    return await toolDef.execute(input, ctx);
  })
);

// A real tool using Genkit's Zod-based tooling that hooks into the actual database.
// projectId is read from the Genkit execution context (ToolContext), NOT from model input,
// to prevent model-controlled cross-tenant data access (AI-RT-04).
export const queryBomItemsTool = ai.defineTool({
  name: 'queryBomItems',
  description: 'Fetch all items in the Bill of Materials to analyze costs, availability, or specifications.',
  inputSchema: z.object({}),
  outputSchema: z.array(z.unknown())
}, async () => {
  const ctx = ai.currentContext() as ToolContext;
  if (!ctx?.projectId) {
    throw new Error('queryBomItems: no project context available');
  }
  return await storage.getBomItems(ctx.projectId);
});

// DEV-ONLY MOCK — returns random pricing data. Do NOT use in production flows.
// Kept for local testing of generateArduinoSketchFlow only.
export const pricingLookupTool = ai.defineTool({
  name: 'pricingLookup',
  description: '[DEV MOCK] Returns fake pricing data for a component part number. Not connected to real supplier APIs.',
  inputSchema: z.object({ partNumber: z.string() }),
  outputSchema: z.object({ price: z.number(), currency: z.string(), inStock: z.boolean() })
}, async (_input) => {
  return { price: Math.random() * 10, currency: 'USD', inStock: true };
});

// A proof-of-concept flow that takes an intent and uses Gemini via Genkit (dev-only)
export const generateArduinoSketchFlow = ai.defineFlow({
  name: 'generateArduinoSketchFlow',
  inputSchema: z.object({
    intent: z.string().describe('What the Arduino sketch should do'),
    boardType: z.string().optional(),
    projectId: z.number().optional().default(1),
  }),
  outputSchema: z.string().describe('The generated C++ code'),
}, async (input) => {
  const response = await ai.generate({
    model: googleAI.model('gemini-3-flash-preview'),
    prompt: `Write an Arduino sketch for a ${input.boardType || 'generic'} board. Intent: ${input.intent}. Respond ONLY with code.`,
    config: { temperature: 0.2 },
    context: { projectId: input.projectId, storage } as ToolContext,
    tools: [queryBomItemsTool],
  });
  return response.text;
});

// Flow to test the actual DB-connected tool
export const analyzeBomFlow = ai.defineFlow({
  name: 'analyzeBomFlow',
  inputSchema: z.object({
    projectId: z.number().optional().default(1),
    query: z.string().describe('What to ask about the BOM'),
  }),
  outputSchema: z.string().describe('The analysis result'),
}, async (input) => {
  const response = await ai.generate({
    model: googleAI.model('gemini-3-flash-preview'),
    prompt: `Analyze the BOM for project ${input.projectId} using your tools. Query: ${input.query}`,
    config: { temperature: 0.2 },
    context: { projectId: input.projectId, storage } as ToolContext,
    tools: [queryBomItemsTool],
  });
  return response.text;
});

// --- NEW EMBODIED REASONING TOOLS ---

// projectId read from Genkit execution context, not model input (AI-RT-04).
export const queryNodesTool = ai.defineTool({
  name: 'queryNodes',
  description: 'Fetch all component nodes in the architecture diagram to analyze system structure.',
  inputSchema: z.object({}),
  outputSchema: z.array(z.unknown())
}, async () => {
  const ctx = ai.currentContext() as ToolContext;
  if (!ctx?.projectId) {
    throw new Error('queryNodes: no project context available');
  }
  return await storage.getNodes(ctx.projectId);
});

// projectId read from Genkit execution context, not model input (AI-RT-04).
export const queryEdgesTool = ai.defineTool({
  name: 'queryEdges',
  description: 'Fetch all connections between components in the architecture diagram.',
  inputSchema: z.object({}),
  outputSchema: z.array(z.unknown())
}, async () => {
  const ctx = ai.currentContext() as ToolContext;
  if (!ctx?.projectId) {
    throw new Error('queryEdges: no project context available');
  }
  return await storage.getEdges(ctx.projectId);
});

// A highly advanced flow that utilizes Google's experimental Embodied Reasoning model
export const embodiedLayoutAnalysisFlow = ai.defineFlow({
  name: 'embodiedLayoutAnalysisFlow',
  inputSchema: z.object({
    projectId: z.number().optional().default(1),
    chassisDescription: z.string().describe("Description of the physical robot/device chassis"),
    query: z.string().describe("What layout or spatial analysis do you need?")
  }),
  outputSchema: z.string().describe("Spatial analysis and layout recommendations"),
}, async (input) => {
  const response = await ai.generate({
    // Using the raw string identifier since this is a highly experimental/preview model
    model: 'googleai/gemini-robotics-er-1.5-preview',
    prompt: `You are an Embodied Reasoning agent for ProtoPulse.
Analyze the electronic architecture for project ${input.projectId} using your tools.

Physical Chassis Constraints: ${input.chassisDescription}

User Query: ${input.query}

Provide concrete spatial reasoning: center of gravity impacts, optimal physical placement (X,Y,Z), wire harness routing paths to avoid kinematic pinch points, and thermal considerations. Do not write code, just provide expert spatial analysis.`,
    config: { temperature: 0.4 },
    context: { projectId: input.projectId, storage } as ToolContext,
    tools: [queryNodesTool, queryEdgesTool, queryBomItemsTool],
  });
  return response.text;
});

// A powerful flow for BL-0466: AI copilot co-debugs wiring + firmware together
export const hardwareCoDebugFlow = ai.defineFlow({
  name: 'hardwareCoDebugFlow',
  inputSchema: z.object({
    projectId: z.number().describe("The ID of the project"),
    code: z.string().describe("The current Arduino C++ sketch code"),
    serialLogs: z.string().describe("The last N lines of output from the Serial Monitor"),
  }),
  outputSchema: z.string().describe("A markdown-formatted debugging analysis"),
}, async (input) => {
  const response = await ai.generate({
    model: googleAI.model('gemini-3.1-pro-preview-customtools'),
    prompt: `You are the ultimate Hardware Co-Debug Copilot for ProtoPulse.
Your job is to look at the user's firmware code, their live serial logs, AND their physical hardware layout, and figure out why their circuit is failing.

Use your tools to query the current architecture nodes, edges, and BOM to understand how the components are physically wired. Compare that against the pin definitions and logic in their C++ code. Compare BOTH of those against the live error output in the Serial Logs.

FIRMWARE CODE:
\`\`\`cpp
${input.code}
\`\`\`

SERIAL LOGS:
\`\`\`text
${input.serialLogs}
\`\`\`

Give the user a clear, direct, and brilliant root-cause analysis. If they have a pin mismatch (e.g. code says pin 4, but schematic says pin 5), point it out. If they are reading an analog value from a digital-only pin, point it out. Do not write generic boilerplate. Be a senior hardware engineer.`,
    config: { temperature: 0.2 },
    context: { projectId: input.projectId, storage } as ToolContext,
    tools: [queryNodesTool, queryEdgesTool, queryBomItemsTool],
  });
  return response.text;
});

