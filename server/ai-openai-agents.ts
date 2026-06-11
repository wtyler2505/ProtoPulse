import { logger } from './logger';
import type { AIAction, AIStreamEvent } from './ai';

type OpenAIAgentsModule = typeof import('@openai/agents');

interface StreamOpenAIAgentMessageParams {
  message: string;
  model: string;
  apiKey: string;
  customSystemPrompt?: string;
}

const DEFAULT_OPENAI_SYSTEM_PROMPT = `You are the ProtoPulse AI assistant.
Give clear, practical design help for electronics and embedded workflows.
When uncertain, say so briefly and suggest the next concrete check.`;

let agentsModulePromise: Promise<OpenAIAgentsModule> | null = null;

async function loadOpenAIAgents(): Promise<OpenAIAgentsModule | null> {
  agentsModulePromise ??= import('@openai/agents');
  try {
    return await agentsModulePromise;
  } catch (error) {
    agentsModulePromise = null;
    const message = error instanceof Error ? error.message : String(error);
    logger.error('ai:openai-agents-import-failed', { error: message });
    return null;
  }
}

export async function streamOpenAIAgentMessage(
  params: StreamOpenAIAgentMessageParams,
  onEvent: (event: AIStreamEvent) => Promise<void>,
  signal?: AbortSignal,
): Promise<void> {
  const { message, model, apiKey, customSystemPrompt } = params;

  if (!apiKey) {
    await onEvent({
      type: 'error',
      message: 'No OpenAI API key provided. Add your OpenAI key in settings to use this lane.',
    });
    return;
  }

  const agents = await loadOpenAIAgents();
  if (!agents) {
    await onEvent({
      type: 'error',
      message: 'OpenAI Agents SDK is installed but cannot load. The current dependency tree needs the zod v4 peer conflict resolved before this lane can run.',
    });
    return;
  }

  const { Agent, run, setDefaultOpenAIKey } = agents;
  setDefaultOpenAIKey(apiKey);

  const agent = new Agent({
    name: 'ProtoPulse OpenAI Assistant',
    instructions: customSystemPrompt?.trim() || DEFAULT_OPENAI_SYSTEM_PROMPT,
    model,
  });

  const stream = await run(agent, message, { stream: true });
  let fullText = '';

  await onEvent({
    type: 'provider_info',
    provider: 'openai',
    model,
    isFallback: false,
  });

  for await (const event of stream) {
    if (signal?.aborted) {
      break;
    }
    if (event.type === 'raw_model_stream_event' && event.data?.type === 'output_text_delta') {
      const delta = event.data.delta ?? '';
      if (delta) {
        fullText += delta;
        await onEvent({ type: 'text', text: delta });
      }
      continue;
    }

    if (event.type === 'run_item_stream_event') {
      logger.debug('ai:openai-agents-run-item', { name: event.name });
    }
  }

  await onEvent({
    type: 'done',
    message: fullText.trim() || 'Done.',
    actions: [] as AIAction[],
    toolCalls: [],
  });
}
