const fs = require('fs');
let content = fs.readFileSync('server/ai.ts', 'utf8');

// 1. Remove circuit breaker import completely
content = content.replace(/import \{ anthropicBreaker, geminiBreaker, CircuitBreakerOpenError \} from "\.\/circuit-breaker";\n/g, '');

// 2. Remove isRetryableError circuit breaker reference
content = content.replace(/if \(error instanceof CircuitBreakerOpenError\) \{\n\s+return true;\n\s+\}\n/g, '');

// 3. Remove Anthropic client code
content = content.replace(/export function getAnthropicClient[\s\S]+?\}\n\n/g, '');

// 4. Remove Gemini client code
content = content.replace(/export function getGeminiClient[\s\S]+?\}\n\n/g, '');

// 5. Replace callAnthropic and callGemini
const callGenkitStr = `async function callGenkit(
  apiKey: string,
  model: string,
  systemPrompt: string,
  chatHistory: Array<{ role: string; content: string }>,
  userMessage: string,
  temperature: number = 0.7,
  maxTokens?: number,
  imageContent?: ImageContent,
): Promise<{ message: string; actions: AIAction[] }> {
  const { ai, allGenkitTools } = await import('./genkit');
  
  const messages = chatHistory.map(m => ({
    role: m.role as 'user' | 'model' | 'system' | 'tool',
    content: [{ text: m.content }]
  }));
  
  const promptParts: any[] = [];
  if (imageContent) {
    promptParts.push({ media: { url: \`data:\${imageContent.mediaType};base64,\${imageContent.base64}\` } });
  }
  promptParts.push({ text: userMessage });

  const { text, message } = await ai.generate({
    model: \`googleai/\${model}\`,
    system: systemPrompt,
    messages: messages as any,
    prompt: promptParts,
    tools: allGenkitTools,
    config: {
      temperature,
      maxOutputTokens: maxTokens || 4096,
    }
  });

  const toolRequests = message?.content.filter((p: any) => p.toolRequest).map((p: any) => p.toolRequest) || [];
  if (toolRequests.length > 0) {
    const actions = toolRequests.map((req: any) => ({
      type: req?.name ?? '',
      ...(req?.input as Record<string, unknown>),
    })) as unknown as AIAction[];
    return { message: text ?? "", actions };
  }

  return parseActionsFromResponse(text ?? "");
}`;

// Replace everything from callAnthropic to the end of callGemini
content = content.replace(/async function callAnthropic[\s\S]+?return parseActionsFromResponse\(responseText\);\n\}/, callGenkitStr);

// 6. Update processAIMessage usage
content = content.replace(/const result = provider === "anthropic"[\s\S]+?await callGemini\(apiKey, model, systemPrompt, recentHistory, message, temperature, maxTokens, imageContent\);/, 
  `const result = await callGenkit(apiKey, model, systemPrompt, recentHistory, message, temperature, maxTokens, imageContent);`);

content = content.replace(/const fallbackResult = fallback.provider === "anthropic"[\s\S]+?await callGemini\(fallback\.apiKey, fallback\.model, systemPrompt, recentHistory, message, temperature, maxTokens, imageContent\);/, 
  `const fallbackResult = await callGenkit(fallback.apiKey, fallback.model, systemPrompt, recentHistory, message, temperature, maxTokens, imageContent);`);

content = content.replace(/provider: "anthropic" \| "gemini"/g, 'provider: "gemini"');
content = content.replace(/provider: 'anthropic' \| 'gemini'/g, "provider: 'gemini'");
content = content.replace(/fallbackProvider: 'anthropic' \| 'gemini'/g, "fallbackProvider: 'gemini'");

// 7. Fix missing categorizeError argument issues, or typing issues
content = content.replace(/const \{ message: errMsg \} = categorizeError\(err\);/g, 'const { userMessage: errMsg } = categorizeError(err);');

// Write back
fs.writeFileSync('server/ai.ts', content, 'utf8');
console.log("Patched server/ai.ts");
