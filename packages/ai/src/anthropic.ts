import Anthropic from '@anthropic-ai/sdk';

import type { AgentEvent, LlmProvider, LlmTurn } from './provider.js';

/**
 * Thin adapter over @anthropic-ai/sdk — NOT unit-tested against the
 * network. Maps Messages API content blocks to AgentEvents.
 */

export interface AnthropicProviderOptions {
  apiKey: string;
  /** Model id; the M1 Draftsman runs on Sonnet. */
  model?: string;
  maxTokens?: number;
}

export class AnthropicProvider implements LlmProvider {
  private client: Anthropic;
  private model: string;
  private maxTokens: number;

  constructor(opts: AnthropicProviderOptions) {
    this.client = new Anthropic({
      apiKey: opts.apiKey,
      // The app runs in a Tauri/browser webview; the key is the user's own.
      dangerouslyAllowBrowser: true,
    });
    this.model = opts.model ?? 'claude-sonnet-4-6';
    this.maxTokens = opts.maxTokens ?? 8192;
  }

  async turn(req: LlmTurn): Promise<AgentEvent[]> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: this.maxTokens,
      system: req.system,
      messages: req.messages as Anthropic.MessageParam[],
      tools: req.tools as Anthropic.Tool[],
    });

    const events: AgentEvent[] = [];
    for (const block of response.content) {
      if (block.type === 'text') {
        events.push({ kind: 'text', text: block.text });
      } else if (block.type === 'tool_use') {
        events.push({ kind: 'tool_use', id: block.id, name: block.name, input: block.input });
      }
    }
    events.push({ kind: 'done', stopReason: response.stop_reason ?? 'end_turn' });
    return events;
  }
}
