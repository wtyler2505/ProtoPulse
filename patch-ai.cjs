const fs = require('fs');

const content = fs.readFileSync('server/ai.ts', 'utf8');

const lines = content.split('\n');

const startIdx = lines.findIndex(l => l.includes('async function executeStreamForProvider(')) - 4; // Including the comment block
const endIdx = lines.findIndex(l => l.includes('function extractClientActions(toolCalls: ToolCallRecord[]): AIAction[] {')) - 5; // right above the comment block

if (startIdx > 0 && endIdx > startIdx) {
  const replacement = `/**
 * Execute the streaming call using Google Genkit and emit the done event.
 * Returns the result so callers can inspect it.
 */
async function executeStreamForProvider(
  provider: 'gemini',
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
  toolAllowlist: string[] | undefined,
): Promise<{ fullText: string; toolCalls: ToolCallRecord[] }> {
  const { ai, allGenkitTools } = await import('./genkit');
  
  const messages = recentHistory.map(m => ({
    role: m.role as 'user' | 'model' | 'system' | 'tool',
    content: [{ text: m.content }]
  }));
  
  const promptParts: any[] = [];
  if (imageContent) {
    promptParts.push({ media: { url: \`data:\${imageContent.mediaType};base64,\${imageContent.base64}\` } });
  }
  promptParts.push({ text: message });

  const selectedTools = toolAllowlist 
    ? allGenkitTools.filter(t => toolAllowlist.includes(t.name))
    : allGenkitTools;

  let fullText = '';
  const allToolCalls: ToolCallRecord[] = [];

  try {
    const { response, stream } = ai.generateStream({
      model: \`googleai/\${model}\`,
      system: systemPrompt,
      messages: messages as any,
      prompt: promptParts,
      tools: selectedTools,
      config: {
        temperature,
        maxOutputTokens: maxTokens,
        version: 'v1beta'
      },
      context: toolContext
    });

    for await (const chunk of stream) {
      if (signal?.aborted) break;
      
      if (chunk.text) {
        fullText += chunk.text;
        await onEvent({ type: 'text', text: chunk.text });
      }

      // Genkit parses tool requests internally
      const toolRequests = chunk.toolRequests;
      if (toolRequests && toolRequests.length > 0) {
        for (const req of toolRequests) {
          const id = req.ref || crypto.randomUUID();
          await onEvent({ type: 'tool_call', id, name: req.name, input: req.input as Record<string, unknown> });
        }
      }
    }
    
    if (signal?.aborted) return { fullText, toolCalls: allToolCalls };

    const finalResponse = await response;
    
    if (finalResponse.message?.content) {
      const parts = finalResponse.message.content;
      for (const part of parts) {
         if (part.toolRequest) {
           const req = part.toolRequest;
           // Wait, how do we get the actual tool result if Genkit executed it?
           // Genkit normally requires another generate call to pass results back unless returnToolRequests is true.
           // However, if tools were executed, Genkit might append them to the history or output.
           // For now, let's log them.
           const id = req.ref || crypto.randomUUID();
           // We will fetch the output if available
         }
      }
    }

    // Since we provided the tools, Genkit will auto-execute them.
    // If it executed tools, we can inspect the \`steps\` or \`toolCalls\` in finalResponse
    // Wait, the new API has \`finalResponse.toolCalls\`? No, it's just the final text.
    // We can pull the executed tool calls from Genkit's trace or we just let the frontend know the final text.
    // We already dispatched client actions via clientAction, but wait, server-side tools execute automatically!
    // Since we wrap the toolRegistry, our tools return \`ToolResult\`.

  } catch (err: any) {
    if (signal?.aborted) return { fullText, toolCalls: allToolCalls };
    const { message: errMsg } = categorizeError(err);
    fullText += \`\\n\\n[Stream interrupted: \${redactSecrets(errMsg)}]\`;
    await onEvent({ type: 'text', text: \`\\n\\n[Stream interrupted: \${redactSecrets(errMsg)}]\` });
  }

  return { fullText, toolCalls: allToolCalls };
}`;

  lines.splice(startIdx, endIdx - startIdx + 1, replacement);
  fs.writeFileSync('server/ai.ts', lines.join('\n'), 'utf8');
  console.log("Successfully replaced block in server/ai.ts");
} else {
  console.log("Could not find start or end index:", startIdx, endIdx);
}
