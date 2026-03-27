import { genkit, z } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import * as dotenv from 'dotenv';
dotenv.config();

const ai = genkit({
  plugins: [googleAI()]
});

const mockTool = ai.defineTool(
  {
    name: 'switch_view',
    description: 'Switch to a different view',
    inputSchema: z.object({ viewName: z.string() }),
    outputSchema: z.any()
  },
  async (input) => {
    return { type: 'open_view', target: input.viewName };
  }
);

async function main() {
  const { response, stream } = await ai.generateStream({
    model: 'googleai/gemini-2.5-flash',
    prompt: 'Switch to the Validation view now.',
    tools: [mockTool],
  });

  for await (const chunk of stream) {}

  const finalResponse = await response;
  
  const allToolCalls: any[] = [];
  
  if (finalResponse.request?.messages) {
    for (const msg of finalResponse.request.messages) {
      if (msg.role === 'tool' && msg.content) {
        for (const part of msg.content) {
          if (part.toolResponse) {
            allToolCalls.push({
              id: part.toolResponse.ref || 'unknown',
              name: part.toolResponse.name,
              input: {}, // Might need to grab this from a previous 'model' message if needed
              result: { data: part.toolResponse.output }
            });
          }
        }
      }
    }
  }
  
  console.log('allToolCalls:', JSON.stringify(allToolCalls, null, 2));
}

main().catch(console.error);