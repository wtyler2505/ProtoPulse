# Genkit Migration Proof-of-Concept Plan

## Objective
Migrate a small, isolated portion of the AI logic in `server/ai.ts` to use Google Genkit as a proof-of-concept. This will demonstrate Genkit's unified API, Zod-based tool definitions, and developer observability UI without disrupting the existing production Anthropic/Gemini integrations.

## Background & Motivation
Currently, `server/ai.ts` manually orchestrates requests to both `@anthropic-ai/sdk` and `@google/genai`, implementing custom stream parsing, circuit breakers, and tool registries (`server/ai-tools.ts`). 
Integrating Genkit offers several advantages:
1. **Unified API**: One abstraction layer to call either Gemini or Claude models.
2. **Native Zod Tooling**: `ai.defineTool()` perfectly aligns with the project's heavy reliance on Zod schemas for validation.
3. **Observability**: The local `genkit start` UI will allow us to visualize traces of prompts, tool calls, and execution times, drastically improving the debugging experience for complex EDA tasks.

## Scope & Impact
This POC is strictly scoped to adding a new, isolated Genkit flow alongside the existing architecture. 
- **No disruption** to current `POST /api/chat` or `POST /api/action` routes initially.
- **Low risk**: If the Genkit flow fails, we can easily revert.
- **Outcome**: A single working feature (e.g., generating an Arduino sketch or performing a simple hardware query) orchestrated fully by Genkit, visible in the Developer UI.

## Implementation Steps

### 1. Setup & Dependencies
- Ensure `genkit` and `@genkit-ai/google-genai` are installed in `package.json`.
- Add a script to `package.json` to launch the Developer UI: `"genkit:dev": "genkit start -- npm run dev"`.

### 2. Genkit Initialization (`server/genkit.ts`)
Create a new file `server/genkit.ts` to encapsulate the Genkit configuration:
```typescript
import { genkit, z } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
// Will add anthropic plugin later if needed

export const ai = genkit({
  plugins: [googleAI()],
});
```

### 3. Define a Proof-of-Concept Flow
In `server/genkit.ts`, define a new flow to handle a specific domain task. Let's use Arduino Sketch generation as the POC, as it has clear inputs and outputs.
```typescript
export const generateArduinoSketchFlow = ai.defineFlow(
  {
    name: 'generateArduinoSketchFlow',
    inputSchema: z.object({
      intent: z.string().describe("What the Arduino sketch should do"),
      boardType: z.string().optional()
    }),
    outputSchema: z.string().describe("The generated C++ code"),
  },
  async (input) => {
    const response = await ai.generate({
      model: googleAI.model('gemini-2.5-flash'), // or pro
      prompt: `Write an Arduino sketch for a ${input.boardType || 'generic'} board. Intent: ${input.intent}. Respond ONLY with code.`,
      config: { temperature: 0.2 },
    });
    return response.text;
  }
);
```

### 4. Integrate with Existing Tools
Demonstrate tool usage by migrating one existing tool (e.g., `pricing_lookup`) to Genkit syntax:
```typescript
const pricingLookupTool = ai.defineTool({
  name: 'pricingLookup',
  description: 'Looks up the estimated price of a component part number',
  inputSchema: z.object({ partNumber: z.string() }),
  outputSchema: z.object({ price: z.number(), currency: z.string(), inStock: z.boolean() })
}, async (input) => {
  // Call existing logic
  return { price: 2.50, currency: "USD", inStock: true }; 
});
```

### 5. Create a Testing Endpoint
Add a dedicated testing route in `server/routes.ts` (e.g., `POST /api/genkit-test`) to invoke the new flow from the frontend without modifying the core chat handler yet.

## Verification
1. Run `npm run genkit:dev`.
2. Open the Genkit Developer UI in the browser.
3. Trigger the `generateArduinoSketchFlow` manually from the UI or via the new testing endpoint.
4. Verify the trace appears in the UI, showing the prompt, latency, and (if applicable) the tool call execution.

## Migration & Rollback
If the POC is successful and we decide to fully migrate:
- Phase 2: Refactor `server/ai-tools.ts` to export an array of Genkit tools.
- Phase 3: Replace the `anthropic` and `googleGenAI` clients in `server/ai.ts` with the unified `ai.generate()` method, supporting multi-model routing via Genkit.
- Rollback: Since this is purely additive, rollback simply requires removing `server/genkit.ts` and the test endpoint.