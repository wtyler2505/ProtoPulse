const fs = require('fs');
const content = fs.readFileSync('server/ai.ts', 'utf8');

// Replace callAnthropic and callGemini
const newContent = content.replace(/async function callAnthropic[\s\S]+?async function callGemini[\s\S]+?return parseActionsFromResponse\(responseText\);\n\}/, `async function callGenkit(
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
      version: 'v1beta'
    }
  });

  const toolRequests = message?.content.filter(p => p.toolRequest).map(p => p.toolRequest) || [];
  if (toolRequests.length > 0) {
    const actions = toolRequests.map(req => ({
      type: req?.name ?? '',
      ...(req?.input as Record<string, unknown>),
    })) as unknown as AIAction[];
    return { message: text ?? "", actions };
  }

  return parseActionsFromResponse(text ?? "");
}`);

const finalContent = newContent.replace(/if \(provider === 'anthropic'\) \{\n\s+const result = await callAnthropic\([\s\S]+?\} else \{\n\s+const result = await callGemini\([\s\S]+?\n\s+\}/, `const result = await callGenkit(
      apiKeyToUse, resolvedModel, systemPrompt, recentHistory, message,
      temperature, maxTokens, imageContent
    );`);

fs.writeFileSync('server/ai.ts', finalContent, 'utf8');
